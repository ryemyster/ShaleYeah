import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type {
	ConnectorConfiguration,
	ContractErrorCode,
	ContractVersion,
	EmployeeContract,
	SourceContract,
	ValidationOptions,
} from "./generated.js";

export type * from "./generated.js";

const schema = JSON.parse(
	readFileSync(new URL("../shaleyeah_contracts/schemas/employee-0.1.0.schema.json", import.meta.url), "utf8"),
);
export const CONTRACT_VERSION: ContractVersion = schema.$defs.ContractVersion.const;
const ajv = new Ajv2020({ allErrors: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
const check = ajv.compile<EmployeeContract>(schema);
const checkOptions = ajv.compile<ValidationOptions>({ $ref: `${schema.$id}#/$defs/ValidationOptions` });
const sourceSchema = JSON.parse(
	readFileSync(new URL("../shaleyeah_contracts/schemas/data-connectors-0.1.0.schema.json", import.meta.url), "utf8"),
);
const checkSource = ajv.compile<SourceContract>(sourceSchema);
const checkConnector = ajv.compile<ConnectorConfiguration>({
	$ref: `${sourceSchema.$id}#/$defs/ConnectorConfiguration`,
});

export class ContractValidationError extends Error {
	constructor(
		public readonly code: ContractErrorCode,
		public readonly issues: ReadonlyArray<{ path: string; keyword: string }> = [],
	) {
		super(`Employee contract rejected: ${code}`);
		this.name = "ContractValidationError";
	}
}

function fail(code: ContractErrorCode, path: string, keyword: string): never {
	throw new ContractValidationError(code, [{ path, keyword }]);
}

function isJson(value: unknown, ancestors = new Set<object>()): boolean {
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value !== "object" || ancestors.has(value)) return false;
	if (
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) !== Object.prototype &&
		Object.getPrototypeOf(value) !== null
	)
		return false;
	ancestors.add(value);
	const valid =
		!Object.getOwnPropertySymbols(value).length &&
		(Array.isArray(value)
			? Array.from(value).every((item) => isJson(item, ancestors))
			: Object.values(value).every((item) => isJson(item, ancestors)));
	ancestors.delete(value);
	return valid;
}

function uniqueIds(values: { id: string }[], path: string): void {
	if (new Set(values.map((value) => value.id)).size !== values.length) fail("invalid_contract", path, "uniqueIds");
}

function checkSemantics(record: EmployeeContract): void {
	if (record.kind === "task-assignment" && record.id !== record.scope.taskId)
		fail("scope_mismatch", "/scope/taskId", "taskIdentity");
	if (record.kind === "work-product") {
		uniqueIds(record.evidence, "/evidence");
		uniqueIds(record.assumptions, "/assumptions");
		uniqueIds(record.findings, "/findings");
		const evidence = new Set(record.evidence.map((item) => item.id));
		const assumptions = new Set(record.assumptions.map((item) => item.id));
		for (const item of [...record.findings, ...record.assumptions]) {
			if (item.evidenceIds.some((id) => !evidence.has(id))) fail("invalid_contract", "/evidence", "reference");
		}
		for (const item of record.findings) {
			if (item.assumptionIds.some((id) => !assumptions.has(id))) fail("invalid_contract", "/assumptions", "reference");
		}
	}
	if (record.kind === "context-manifest") {
		if (Date.parse(record.retention.expiresAt) <= Date.parse(record.assembledAt))
			fail("invalid_contract", "/retention/expiresAt", "chronology");
		const count = record.selectedEvidence.length + record.workingArtifactRefs.length + record.sharedKnowledge.length;
		if (count > record.budget.maxItems) fail("invalid_contract", "/budget/maxItems", "itemBudget");
		for (const item of record.sharedKnowledge) {
			if (item.origin.customerId !== record.scope.customerId)
				fail("scope_mismatch", "/sharedKnowledge", "customerBoundary");
		}
	}
}

function checkSourceSemantics(record: SourceContract): void {
	if (record.kind === "source-artifact") {
		if (
			record.artifact.id !== record.evidence.id ||
			record.artifact.revision !== record.evidence.hash.value ||
			record.artifact.uri !== `urn:sha256:${record.evidence.hash.value}`
		)
			fail("invalid_contract", "/artifact", "sourceHashBinding");
		if (Date.parse(record.retrievedAt) < Date.parse(record.evidence.asOf))
			fail("invalid_contract", "/retrievedAt", "chronology");
		checkSourceUri(record.evidence.uri);
		if (new Set(record.units.map((unit) => unit.field)).size !== record.units.length)
			fail("invalid_contract", "/units", "uniqueFields");
	}
	if (record.kind === "connector-status" && (record.status === "ready") !== (record.errorCode === null))
		fail("invalid_contract", "/status", "healthErrorBinding");
}

function checkSourceUri(uri: string): void {
	const parsed = new URL(uri);
	// Only credential-free logical identifiers leave the private connector configuration.
	if (
		!["urn:", "https:"].includes(parsed.protocol) ||
		parsed.username ||
		parsed.password ||
		parsed.search ||
		parsed.hash
	)
		fail("invalid_contract", "/evidence/uri", "publicSourceIdentifier");
}

export function validateConnectorConfiguration(value: unknown): ConnectorConfiguration {
	if (!isJson(value)) fail("invalid_contract", "", "jsonValue");
	if (value && typeof value === "object" && "contractVersion" in value && value.contractVersion !== CONTRACT_VERSION)
		fail("unsupported_version", "/contractVersion", "supportedVersion");
	if (!checkConnector(value)) fail("invalid_contract", "", "connectorConfiguration");
	if (
		value.manifest.owner.customerId !== value.scope.customerId ||
		value.manifest.owner.employeeId !== value.scope.employeeId ||
		Object.entries(value.scope).some(
			([key, expected]) => value.grant.scope[key as keyof typeof value.scope] !== expected,
		) ||
		value.grant.taskRevision !== value.taskRevision ||
		value.grant.connectorId !== value.manifest.id
	)
		fail("scope_mismatch", "/scope", "connectorOwner");
	uniqueIds(
		value.sources.map((source) => source.evidence),
		"/sources",
	);
	for (const source of value.sources) {
		checkSourceUri(source.evidence.uri);
		if (!value.manifest.formats.includes(source.format) || !value.manifest.sourceKinds.includes(source.sourceKind))
			fail("unsupported_capability", "/sources", "connectorCapability");
		if (new Set(source.units.map((unit) => unit.field)).size !== source.units.length)
			fail("invalid_contract", "/sources/units", "uniqueFields");
	}
	return value;
}

function checkExpectations(record: EmployeeContract | SourceContract, options: ValidationOptions): void {
	if (options.expectedScope) {
		if (
			!("scope" in record) ||
			Object.entries(options.expectedScope).some(
				([key, value]) => record.scope[key as keyof typeof record.scope] !== value,
			)
		)
			fail("scope_mismatch", "/scope", "expectedScope");
	}
	if (options.expectedTaskRevision) {
		const revision =
			record.kind === "task-assignment" ? record.revision : "taskRevision" in record ? record.taskRevision : undefined;
		if (revision !== options.expectedTaskRevision) fail("revision_mismatch", "/taskRevision", "expectedTaskRevision");
	}
	if (options.expectedProductRef) {
		const product =
			record.kind === "work-product" ? record.artifact : "productRef" in record ? record.productRef : undefined;
		if (
			!product ||
			Object.entries(options.expectedProductRef).some(([key, value]) => product[key as keyof typeof product] !== value)
		)
			fail("revision_mismatch", "/productRef", "expectedProductRef");
	}
	// The caller supplies a policy obtained through its trusted boundary; a match is not authentication.
	if (options.trustedAuthority) {
		const grant = options.trustedAuthority;
		if (
			record.kind !== "employee-charter" ||
			record.employeeId !== grant.employeeId ||
			record.owner.customerId !== grant.customerId ||
			record.authorityPolicy.id !== grant.authorityPolicy.id ||
			record.authorityPolicy.version !== grant.authorityPolicy.version ||
			record.capabilities.some((capability) => !grant.capabilities.includes(capability))
		)
			fail("authority_denied", "/authorityPolicy", "trustedPolicy");
	}
}

export function validateContract(value: unknown, options: ValidationOptions = {}): EmployeeContract {
	if (!isJson(value) || !isJson(options)) fail("invalid_contract", "", "jsonValue");
	if (
		value &&
		typeof value === "object" &&
		"contractVersion" in value &&
		typeof value.contractVersion === "string" &&
		value.contractVersion !== CONTRACT_VERSION
	)
		fail("unsupported_version", "/contractVersion", "supportedVersion");
	if (!check(value))
		throw new ContractValidationError(
			"invalid_contract",
			(check.errors ?? []).map((error) => ({ path: error.instancePath, keyword: error.keyword })),
		);
	if (!checkOptions(options)) fail("invalid_contract", "/options", "validationOptions");
	checkSemantics(value);
	checkExpectations(value, options);
	return value;
}

export function validateSourceContract(value: unknown, options: ValidationOptions = {}): SourceContract {
	if (!isJson(value) || !isJson(options)) fail("invalid_contract", "", "jsonValue");
	if (
		value &&
		typeof value === "object" &&
		"contractVersion" in value &&
		typeof value.contractVersion === "string" &&
		value.contractVersion !== CONTRACT_VERSION
	)
		fail("unsupported_version", "/contractVersion", "supportedVersion");
	if (!checkSource(value))
		throw new ContractValidationError(
			"invalid_contract",
			(checkSource.errors ?? []).map((error) => ({ path: error.instancePath, keyword: error.keyword })),
		);
	if (!checkOptions(options)) fail("invalid_contract", "/options", "validationOptions");
	checkSourceSemantics(value);
	checkExpectations(value, options);
	return value;
}
