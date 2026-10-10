/* Generated from employee-0.1.0.schema.json. Run pnpm generate; do not edit. */

/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "EmployeeContract".
 */
export type EmployeeContract =
	EmployeeCharter | TaskAssignment | WorkProduct | ContextManifest | ReviewRequest | ReviewDecision;
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "ContractVersion".
 */
export type ContractVersion = "0.1.0";
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "StableId".
 */
export type StableId = string;
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "Text".
 */
export type Text = string;
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "Revision".
 */
export type Revision = string;
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "TaskAssignment".
 */
export type TaskAssignment = {
	contractVersion: ContractVersion;
	kind: "task-assignment";
	id: StableId;
	revision: Revision;
	scope: Scope;
	outcome: Text;
	/**
	 * @minItems 1
	 */
	requiredCapabilities: StableId[];
	/**
	 * @minItems 0
	 */
	inputs: ArtifactRef[];
	/**
	 * @minItems 0
	 */
	constraints: Text[];
	status: "assigned" | "running" | "awaiting_review" | "blocked" | "completed" | "failed" | "cancelled";
	/**
	 * @minItems 0
	 */
	workProductRefs: ArtifactRef[];
	/**
	 * @minItems 0
	 */
	reviewDecisionRefs: RecordRef[];
};
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "Uri".
 */
export type Uri = string;
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "WorkProduct".
 */
export type WorkProduct = {
	contractVersion: ContractVersion;
	kind: "work-product";
	scope: Scope;
	taskRevision: Revision;
	artifact: ArtifactRef;
	status: "draft" | "ready_for_review" | "blocked" | "failed" | "final";
	/**
	 * @minItems 0
	 */
	inputs: ArtifactRef[];
	/**
	 * @minItems 0
	 */
	evidence: SourceEvidence[];
	/**
	 * @minItems 0
	 */
	findings: Finding[];
	/**
	 * @minItems 0
	 */
	assumptions: Assumption[];
	uncertainty: Text;
	confidence?: number;
	/**
	 * @minItems 0
	 */
	blockers: Blocker[];
	review: WorkReview;
};
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "Timestamp".
 */
export type Timestamp = string;
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "Finding".
 */
export type Finding = {
	id: StableId;
	basis: "measured" | "assumed" | "unknown";
	value: string | number | boolean | null;
	unit: Text;
	/**
	 * @minItems 0
	 */
	evidenceIds: StableId[];
	/**
	 * @minItems 0
	 */
	assumptionIds: StableId[];
	reason?: Text;
};
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "ContractErrorCode".
 */
export type ContractErrorCode =
	| "unsupported_version"
	| "invalid_contract"
	| "authority_denied"
	| "scope_mismatch"
	| "revision_mismatch"
	| "missing_input"
	| "source_unavailable"
	| "access_denied"
	| "stale_evidence"
	| "conflicting_evidence"
	| "approval_required"
	| "unsupported_capability";
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "WorkReview".
 */
export type WorkReview = {
	status: "unreviewed" | "pending" | "approved" | "rejected" | "changes_requested";
	/**
	 * @minItems 0
	 */
	decisionRefs: RecordRef[];
};

/**
 * Portable employee records. Structural validity is not authorization or professional acceptance.
 */
export interface ContractBindings {
	record: EmployeeContract;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "EmployeeCharter".
 */
export interface EmployeeCharter {
	contractVersion: ContractVersion;
	kind: "employee-charter";
	employeeId: StableId;
	displayName: Text;
	/**
	 * @minItems 0
	 */
	aliases?: Text[];
	role: {
		id: StableId;
		name: Text;
	};
	owner: {
		principalId: StableId;
		customerId: StableId;
	};
	/**
	 * @minItems 1
	 */
	responsibilities: Text[];
	/**
	 * @minItems 1
	 */
	nonGoals: Text[];
	/**
	 * @minItems 1
	 */
	capabilities: StableId[];
	/**
	 * @minItems 1
	 */
	inputTypes: VersionedRef[];
	/**
	 * @minItems 1
	 */
	outputTypes: VersionedRef[];
	authorityPolicy: VersionedRef;
	sourcePolicy: VersionedRef;
	contextPolicy: VersionedRef;
	/**
	 * @minItems 4
	 * @maxItems 4
	 */
	contextIsolation: ("customer" | "asset" | "task" | "employee")[];
	/**
	 * @minItems 1
	 */
	evalProfiles: VersionedRef[];
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "VersionedRef".
 */
export interface VersionedRef {
	id: StableId;
	version: Revision;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "Scope".
 */
export interface Scope {
	customerId: StableId;
	assetId: StableId;
	taskId: StableId;
	employeeId: StableId;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "ArtifactRef".
 */
export interface ArtifactRef {
	id: StableId;
	revision: Revision;
	uri: Uri;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "RecordRef".
 */
export interface RecordRef {
	id: StableId;
	revision: Revision;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "SourceEvidence".
 */
export interface SourceEvidence {
	id: StableId;
	uri: Uri;
	hash: {
		algorithm: "sha256";
		value: string;
	};
	revision: Revision;
	asOf: Timestamp;
	accessClassification: "public" | "internal" | "restricted" | "licensed";
	usagePolicy: VersionedRef;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "Assumption".
 */
export interface Assumption {
	id: StableId;
	statement: Text;
	/**
	 * @minItems 0
	 */
	evidenceIds: StableId[];
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "Blocker".
 */
export interface Blocker {
	code: ContractErrorCode;
	message: Text;
	/**
	 * @minItems 0
	 */
	references: RecordRef[];
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "ContextManifest".
 */
export interface ContextManifest {
	contractVersion: ContractVersion;
	kind: "context-manifest";
	id: StableId;
	revision: Revision;
	scope: Scope;
	taskRevision: Revision;
	contextPolicy: VersionedRef;
	/**
	 * @minItems 0
	 */
	selectedEvidence: SourceEvidence[];
	/**
	 * @minItems 0
	 */
	workingArtifactRefs: ArtifactRef[];
	/**
	 * @minItems 0
	 */
	sharedKnowledge: SharedKnowledgeRef[];
	assembledAt: Timestamp;
	retention: {
		policy: VersionedRef;
		expiresAt: Timestamp;
	};
	budget: {
		maxItems: number;
		maxBytes: number;
		maxTokens: number;
	};
	/**
	 * @minItems 0
	 */
	blockers: Blocker[];
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "SharedKnowledgeRef".
 */
export interface SharedKnowledgeRef {
	artifact: ArtifactRef;
	origin: Scope;
	/**
	 * @minItems 1
	 */
	evidence: SourceEvidence[];
	reviewDecisionRef: RecordRef;
	usagePolicy: VersionedRef;
	retentionPolicy: VersionedRef;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "ReviewRequest".
 */
export interface ReviewRequest {
	contractVersion: ContractVersion;
	kind: "review-request";
	id: StableId;
	revision: Revision;
	scope: Scope;
	taskRevision: Revision;
	productRef: ArtifactRef;
	requestedDecision: Text;
	reviewerPolicy: VersionedRef;
	createdAt: Timestamp;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "ReviewDecision".
 */
export interface ReviewDecision {
	contractVersion: ContractVersion;
	kind: "review-decision";
	id: StableId;
	revision: Revision;
	scope: Scope;
	taskRevision: Revision;
	requestRef: RecordRef;
	productRef: ArtifactRef;
	decision: "approve" | "reject" | "request_changes";
	reviewer: {
		principalId: StableId;
		authorityPolicy: VersionedRef;
	};
	reason: Text;
	decidedAt: Timestamp;
	auditRef: RecordRef;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "AuthorityGrant".
 */
export interface AuthorityGrant {
	employeeId: StableId;
	customerId: StableId;
	/**
	 * @minItems 0
	 */
	capabilities: StableId[];
	authorityPolicy: VersionedRef;
}
/**
 * This interface was referenced by `ContractBindings`'s JSON-Schema
 * via the `definition` "ValidationOptions".
 */
export interface ValidationOptions {
	expectedScope?: Scope;
	expectedTaskRevision?: Revision;
	expectedProductRef?: ArtifactRef;
	trustedAuthority?: AuthorityGrant;
}
