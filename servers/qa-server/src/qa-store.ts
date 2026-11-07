import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { reviewJson } from "@shaleyeah/sdk";
import { QAError, type QARef, qaRefSchema, qaScopeSchema } from "./qa-inputs.js";
import type { QAScope } from "./tools/qa-rules.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
interface Stored {
	id: string;
	namespace: string;
	digest: string;
	body: string;
	expires: string;
}
/** Executing service-owned private immutable artifacts; task/source rights are rechecked by QAService. */
export class QAResultStore {
	private readonly root: string;
	private readonly file: string;
	private readonly identity: { rootDev: number; rootIno: number; fileDev: number; fileIno: number };
	private readonly db: DatabaseSync;
	private closed = false;
	constructor(
		directory: string,
		private readonly options: { maxRecords?: number; maxBytes?: number; clock?: () => Date } = {},
	) {
		if (
			!Number.isSafeInteger(options.maxRecords ?? 1000) ||
			(options.maxRecords ?? 1000) < 1 ||
			(options.maxRecords ?? 1000) > 100000 ||
			!Number.isSafeInteger(options.maxBytes ?? 8_000_000) ||
			(options.maxBytes ?? 8_000_000) < 1024 ||
			(options.maxBytes ?? 8_000_000) > 8_000_000
		)
			throw new QAError("configuration");
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		const root = lstatSync(directory);
		if (
			!root.isDirectory() ||
			root.isSymbolicLink() ||
			root.mode & 0o077 ||
			(process.getuid && root.uid !== process.getuid())
		)
			throw new QAError("storage_policy");
		this.root = realpathSync(directory);
		this.file = path.join(this.root, "results.sqlite");
		const fd = openSync(
			this.file,
			constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK,
			0o600,
		);
		try {
			const info = fstatSync(fd);
			if (!info.isFile() || info.nlink !== 1 || info.mode & 0o077 || (process.getuid && info.uid !== process.getuid()))
				throw new QAError("storage_policy");
			this.identity = { rootDev: root.dev, rootIno: root.ino, fileDev: info.dev, fileIno: info.ino };
		} finally {
			closeSync(fd);
		}
		this.db = new DatabaseSync(this.file);
		this.db.exec(
			"PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY, namespace TEXT NOT NULL, digest TEXT NOT NULL, body TEXT NOT NULL, expires TEXT NOT NULL)",
		);
	}
	private check() {
		if (this.closed) throw new QAError("storage_unavailable");
		for (const [file, dev, ino, directory] of [
			[this.root, this.identity.rootDev, this.identity.rootIno, true],
			[this.file, this.identity.fileDev, this.identity.fileIno, false],
		] as const) {
			const info = lstatSync(file);
			if (
				info.isSymbolicLink() ||
				(directory ? !info.isDirectory() : !info.isFile() || info.nlink !== 1) ||
				info.dev !== dev ||
				info.ino !== ino ||
				info.mode & 0o077 ||
				(process.getuid && info.uid !== process.getuid())
			)
				throw new QAError("storage_policy");
		}
	}
	private now() {
		return (this.options.clock?.() ?? new Date()).getTime();
	}
	put(scope: QAScope, payload: unknown, expiresAt: string): QARef {
		this.check();
		const namespace = hash(reviewJson(qaScopeSchema.parse(scope))),
			body = reviewJson(payload);
		if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= this.now())
			throw new QAError("invalid_expiry");
		if (Buffer.byteLength(body) > (this.options.maxBytes ?? 8_000_000)) throw new QAError("artifact_limit");
		const digest = hash(body),
			id = `result.qa.${hash(reviewJson({ namespace, digest }))}`;
		const ref = { id, revision: "r1", uri: `urn:qa:result:${digest}` };
		this.db.exec("BEGIN IMMEDIATE");
		try {
			this.db
				.prepare("DELETE FROM results WHERE id<>? AND julianday(expires)<=julianday(?)")
				.run(id, new Date(this.now()).toISOString());
			const existing = this.db.prepare("SELECT * FROM results WHERE id=?").get(id) as unknown as Stored | undefined;
			if (existing) {
				if (existing.namespace !== namespace || existing.digest !== digest || existing.body !== body)
					throw new QAError("artifact_conflict");
				if (Date.parse(existing.expires) <= this.now()) throw new QAError("expired");
			} else {
				const count = this.db.prepare("SELECT COUNT(*) AS total FROM results").get()!;
				if (Number(count.total) >= (this.options.maxRecords ?? 1000)) throw new QAError("store_limit");
				this.db
					.prepare("INSERT INTO results(id,namespace,digest,body,expires) VALUES(?,?,?,?,?)")
					.run(id, namespace, digest, body, expiresAt);
			}
			this.db.exec("COMMIT");
			return ref;
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}
	get(scope: QAScope, reference: QARef): unknown {
		this.check();
		const ref = qaRefSchema.parse(reference),
			namespace = hash(reviewJson(qaScopeSchema.parse(scope)));
		const stored = this.db.prepare("SELECT * FROM results WHERE id=?").get(ref.id) as unknown as Stored | undefined;
		if (!stored || stored.namespace !== namespace) throw new QAError("access_denied");
		if (Date.parse(stored.expires) <= this.now()) {
			this.db.prepare("DELETE FROM results WHERE id=? AND namespace=?").run(ref.id, namespace);
			throw new QAError("expired");
		}
		if (
			hash(stored.body) !== stored.digest ||
			ref.revision !== "r1" ||
			(ref.uri !== undefined && ref.uri !== `urn:qa:result:${stored.digest}`)
		)
			throw new QAError("artifact_conflict");
		return JSON.parse(stored.body);
	}
	close() {
		if (!this.closed) {
			this.db.close();
			this.closed = true;
		}
	}
}
