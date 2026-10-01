import { createRequire as __snowlumaCreateRequire } from "node:module";
__snowlumaCreateRequire(import.meta.url);
import { format } from "util";
import fs from "node:fs";
import path from "node:path";
import fs$1 from "fs";
import path$1 from "path";
import { AsyncLocalStorage } from "async_hooks";
//#region ../common/src/log-sanitize.ts
var ESC = 27;
var BEL = 7;
var C1_CSI = 155;
var C1_ST = 156;
var C1_OSC = 157;
var C1_STRING_STARTERS = /* @__PURE__ */ new Set([
	144,
	152,
	158,
	159
]);
function skipCsi(line, start) {
	for (let i = start; i < line.length; i += 1) {
		const code = line.charCodeAt(i);
		if (code >= 64 && code <= 126) return i + 1;
	}
	return line.length;
}
function skipControlString(line, start, allowBell) {
	for (let i = start; i < line.length; i += 1) {
		const code = line.charCodeAt(i);
		if (allowBell && code === BEL) return i + 1;
		if (code === C1_ST) return i + 1;
		if (code === ESC && line.charCodeAt(i + 1) === 92) return i + 2;
	}
	return line.length;
}
function skipEscSequence(line, start) {
	if (start >= line.length) return line.length;
	const first = line.charCodeAt(start);
	if (first === 91) return skipCsi(line, start + 1);
	if (first === 93) return skipControlString(line, start + 1, true);
	if (first === 80 || first === 88 || first === 94 || first === 95) return skipControlString(line, start + 1, false);
	let i = start;
	while (i < line.length) {
		const code = line.charCodeAt(i);
		if (code < 32 || code > 47) break;
		i += 1;
	}
	const final = line.charCodeAt(i);
	return final >= 48 && final <= 126 ? i + 1 : start;
}
/**
* Remove terminal presentation and control sequences from a log line.
*
* The parser handles both seven-bit ESC forms and eight-bit C1 forms,
* including CSI styling, OSC hyperlinks, and DCS/SOS/PM/APC control strings.
* TAB and LF remain available for formatted records such as stack traces.
* Unterminated terminal strings consume the remainder instead of leaking their
* invisible payload into persisted or downloaded logs.
*/
function sanitizeLogLine(line) {
	let plain = "";
	for (let i = 0; i < line.length;) {
		const code = line.charCodeAt(i);
		if (code === ESC) {
			i = skipEscSequence(line, i + 1);
			continue;
		}
		if (code === C1_CSI) {
			i = skipCsi(line, i + 1);
			continue;
		}
		if (code === C1_OSC || C1_STRING_STARTERS.has(code)) {
			i = skipControlString(line, i + 1, code === C1_OSC);
			continue;
		}
		if (code < 32 && code !== 9 && code !== 10 || code >= 127 && code <= 159) {
			i += 1;
			continue;
		}
		plain += line[i];
		i += 1;
	}
	return plain;
}
//#endregion
//#region ../common/src/runtime.ts
var CONFIG_DIR = "config";
var RUNTIME_CONFIG_PATH = path$1.join(CONFIG_DIR, "runtime.json");
var DEFAULT_WEBUI_PORT = 5099;
var DEFAULT_WEBUI_HOST = "127.0.0.1";
var DEFAULT_LOG_MAX_TOTAL_MB = 1024;
var MAX_LOG_TOTAL_MB = Math.floor(Number.MAX_SAFE_INTEGER / (1024 * 1024));
var MAX_LOG_RETAIN_DAYS = Math.floor(Number.MAX_SAFE_INTEGER / (1440 * 60 * 1e3));
/**
* Pure on-disk-object → typed config normalization (defaults + validation,
* no fs / no env). Exported for testing; `loadRuntimeConfig` wraps it.
*/
function normalizeRuntimeConfig(parsed) {
	const obj = isObject(parsed) ? parsed : {};
	return {
		webuiPort: normalizePort(obj.webuiPort ?? DEFAULT_WEBUI_PORT, DEFAULT_WEBUI_PORT),
		hookAutoLoad: normalizeBool(obj.hookAutoLoad, false),
		webuiHost: normalizeHost(obj.webuiHost),
		webuiTls: { enabled: isObject(obj.webuiTls) ? normalizeBool(obj.webuiTls.enabled, false) : false },
		trustProxy: typeof obj.trustProxy === "string" ? obj.trustProxy : "",
		logMaxTotalMb: normalizeRequiredInteger(obj.logMaxTotalMb, DEFAULT_LOG_MAX_TOTAL_MB, 1, MAX_LOG_TOTAL_MB, "logMaxTotalMb"),
		logRetainDays: normalizeRequiredInteger(obj.logRetainDays, 7, 0, MAX_LOG_RETAIN_DAYS, "logRetainDays"),
		logPerUin: normalizeRequiredBool(obj.logPerUin, false, "logPerUin")
	};
}
/**
* Pure SNOWLUMA_* env → override patch (no fs). Env wins over runtime.json
* (a trusted launcher like SnowLumaDesktop pins these per-launch without
* rewriting the file). Absent vars produce no key.
*/
function resolveRuntimeEnvOverrides(env) {
	const out = {};
	const port = parsePortString(env.SNOWLUMA_WEBUI_PORT);
	if (port !== void 0) out.webuiPort = port;
	const host = env.SNOWLUMA_WEBUI_HOST;
	if (typeof host === "string" && host.trim()) out.webuiHost = host.trim();
	const tp = env.SNOWLUMA_WEBUI_TRUST_PROXY;
	if (typeof tp === "string") out.trustProxy = tp;
	const logMaxTotalMb = parseRequiredIntegerEnv(env.SNOWLUMA_LOG_MAX_TOTAL_MB, 1, MAX_LOG_TOTAL_MB, "SNOWLUMA_LOG_MAX_TOTAL_MB");
	if (logMaxTotalMb !== void 0) out.logMaxTotalMb = logMaxTotalMb;
	const logRetainDays = parseRequiredIntegerEnv(env.SNOWLUMA_LOG_RETAIN_DAYS, 0, MAX_LOG_RETAIN_DAYS, "SNOWLUMA_LOG_RETAIN_DAYS");
	if (logRetainDays !== void 0) out.logRetainDays = logRetainDays;
	const logPerUin = parseRequiredBoolEnv(env.SNOWLUMA_LOG_PER_UIN, "SNOWLUMA_LOG_PER_UIN");
	if (logPerUin !== void 0) out.logPerUin = logPerUin;
	return out;
}
function loadRuntimeConfig() {
	fs$1.mkdirSync(CONFIG_DIR, { recursive: true });
	const parsed = tryLoadRuntimeConfig();
	const normalized = normalizeRuntimeConfig(parsed ?? {});
	if (parsed === null || !sameRuntimeConfig(parsed, normalized)) saveRuntimeConfig(normalized);
	return {
		...normalized,
		...resolveRuntimeEnvOverrides(process.env)
	};
}
/**
* Read the persisted config (normalized, no env overrides, no write). For the
* settings panel's GET — shows what's actually saved/editable on disk.
*/
function readRuntimeConfig() {
	return normalizeRuntimeConfig(tryLoadRuntimeConfig() ?? {});
}
/**
* Persist a partial update. Merges onto the ON-DISK config (not the env-merged
* runtime view) so an env override (e.g. SNOWLUMA_WEBUI_PORT) is never baked
* into runtime.json. Returns the new persisted config (without env overrides).
*/
function updateRuntimeConfig(patch) {
	fs$1.mkdirSync(CONFIG_DIR, { recursive: true });
	const next = normalizeRuntimeConfig({
		...normalizeRuntimeConfig(tryLoadRuntimeConfig() ?? {}),
		...patch
	});
	saveRuntimeConfig(next);
	return next;
}
function tryLoadRuntimeConfig() {
	if (!fs$1.existsSync(RUNTIME_CONFIG_PATH)) return null;
	try {
		const parsed = JSON.parse(fs$1.readFileSync(RUNTIME_CONFIG_PATH, "utf8"));
		return isObject(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
function saveRuntimeConfig(config) {
	const temporaryPath = `${RUNTIME_CONFIG_PATH}.tmp-${String(process.pid)}`;
	try {
		fs$1.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), "utf8");
		fs$1.renameSync(temporaryPath, RUNTIME_CONFIG_PATH);
	} catch (error) {
		try {
			fs$1.unlinkSync(temporaryPath);
		} catch (cleanupError) {
			if (!isErrnoCode(cleanupError, "ENOENT")) throw new AggregateError([error, cleanupError], "failed to persist runtime config and remove its temporary file");
		}
		throw error;
	}
}
/** True when the raw on-disk object already matches the normalized config
*  on every known field (so we can skip a needless rewrite). */
function sameRuntimeConfig(parsed, n) {
	const parsedTls = isObject(parsed.webuiTls) ? parsed.webuiTls.enabled : void 0;
	return parsed.webuiPort === n.webuiPort && parsed.hookAutoLoad === n.hookAutoLoad && parsed.webuiHost === n.webuiHost && parsedTls === n.webuiTls?.enabled && parsed.trustProxy === n.trustProxy && parsed.logMaxTotalMb === n.logMaxTotalMb && parsed.logRetainDays === n.logRetainDays && parsed.logPerUin === n.logPerUin;
}
function parsePortString(raw) {
	if (typeof raw !== "string" || !raw.trim()) return void 0;
	const n = Number(raw.trim());
	if (!Number.isFinite(n)) return void 0;
	const port = Math.trunc(n);
	if (port <= 0 || port > 65535) return void 0;
	return port;
}
function normalizeHost(value) {
	if (typeof value === "string" && value.trim()) return value.trim();
	return DEFAULT_WEBUI_HOST;
}
function normalizePort(value, fallback) {
	if (typeof value === "number" && Number.isFinite(value)) {
		const n = Math.trunc(value);
		if (n > 0 && n <= 65535) return n;
		return fallback;
	}
	if (typeof value === "string" && value.trim()) {
		const n = Number(value);
		if (Number.isFinite(n)) {
			const port = Math.trunc(n);
			if (port > 0 && port <= 65535) return port;
		}
	}
	return fallback;
}
function normalizeRequiredInteger(value, fallback, min, max, field) {
	if (value === void 0) return fallback;
	const n = typeof value === "string" && value.trim() ? Number(value.trim()) : value;
	if (typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max) return n;
	throw new RangeError(`${field} must be an integer in ${String(min)}..${String(max)}`);
}
function normalizeRequiredBool(value, fallback, field) {
	if (value === void 0) return fallback;
	const parsed = parseBoolValue(value);
	if (parsed !== void 0) return parsed;
	throw new TypeError(`${field} must be a boolean`);
}
function normalizeBool(value, fallback) {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	if (typeof value === "string") {
		const v = value.trim().toLowerCase();
		if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
		if (v === "false" || v === "0" || v === "no" || v === "off" || v === "") return false;
	}
	return fallback;
}
function parseRequiredIntegerEnv(raw, min, max, field) {
	if (typeof raw !== "string" || !raw.trim()) return void 0;
	const n = Number(raw.trim());
	if (Number.isSafeInteger(n) && n >= min && n <= max) return n;
	throw new RangeError(`${field} must be an integer in ${String(min)}..${String(max)}`);
}
function parseRequiredBoolEnv(raw, field) {
	if (typeof raw !== "string" || !raw.trim()) return void 0;
	const parsed = parseBoolValue(raw);
	if (parsed !== void 0) return parsed;
	throw new TypeError(`${field} must be a boolean`);
}
function parseBoolValue(raw) {
	if (typeof raw === "boolean") return raw;
	if (raw === 1) return true;
	if (raw === 0) return false;
	if (typeof raw !== "string") return void 0;
	const value = raw.trim().toLowerCase();
	if (value === "true" || value === "1" || value === "yes" || value === "on") return true;
	if (value === "false" || value === "0" || value === "no" || value === "off") return false;
}
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isErrnoCode(error, code) {
	return error instanceof Error && "code" in error && error.code === code;
}
//#endregion
//#region ../common/src/log-file-transport.ts
var DEFAULT_DIR = "logs";
var DEFAULT_MAX_MB = 50;
var DEFAULT_MAX_TOTAL_MB = 1024;
var DEFAULT_RETAIN_DAYS = 7;
var FILE_PREFIX = "snowluma-";
var FILE_SUFFIX = ".log";
var FILE_RE = /^snowluma-(\d{4}-\d{2}-\d{2})(?:\.(\d+))?\.log$/;
var ACCOUNT_DIR_RE = /^\d+$/;
var QUOTA_RETRY_MS = 5e3;
function parseNonNegativeInt(value, fallback, max, field) {
	if (value === void 0 || value.trim() === "") return fallback;
	const parsed = Number(value.trim());
	if (Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= max) return parsed;
	if (field) throw new RangeError(`${field} must be an integer in 0..${String(max)}`);
	return fallback;
}
function parseRequiredPositiveInt(value, fallback, max, field) {
	if (value === void 0 || value.trim() === "") return fallback;
	const parsed = Number(value.trim());
	if (Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max) return parsed;
	throw new RangeError(`${field} must be an integer in 1..${String(max)}`);
}
function parseRequiredBool(value, fallback, field) {
	if (value === void 0 || value.trim() === "") return fallback;
	const normalized = value.trim().toLowerCase();
	if ([
		"1",
		"true",
		"yes",
		"on"
	].includes(normalized)) return true;
	if ([
		"0",
		"false",
		"no",
		"off"
	].includes(normalized)) return false;
	throw new TypeError(`${field} must be a boolean`);
}
function todayString(d = /* @__PURE__ */ new Date()) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateOf(s) {
	const [y, m, d] = s.split("-").map((v) => Number.parseInt(v, 10));
	return new Date(y, m - 1, d);
}
/**
* Owns the byte budget for the whole managed log tree. Writers reserve bytes
* here before enqueueing them to a WriteStream, so buffered bytes count toward
* the hard limit even before fs.stat can observe them.
*/
var LogQuota = class {
	root;
	maxTotalBytes;
	retainDays;
	files = /* @__PURE__ */ new Map();
	active = /* @__PURE__ */ new Set();
	usedBytes = 0;
	degraded = false;
	lastError = null;
	nextRetryAt = 0;
	droppedLines = 0;
	maintenanceSuspensions = 0;
	constructor(root, maxTotalBytes, retainDays, maintainOnLoad = true) {
		this.root = root;
		this.maxTotalBytes = maxTotalBytes;
		this.retainDays = retainDays;
		this.loadManagedFiles();
		if (maintainOnLoad) {
			this.cleanupExpired();
			this.ensureCapacity(0);
		}
	}
	activate(filePath) {
		const normalized = path.resolve(filePath);
		const known = this.files.get(normalized);
		if (known) {
			this.active.add(normalized);
			return known.bytes;
		}
		let bytes = 0;
		let mtimeMs = Date.now();
		try {
			const stat = fs.statSync(normalized);
			bytes = stat.size;
			mtimeMs = stat.mtimeMs;
		} catch (error) {
			if (!isMissing(error)) {
				this.enterDegraded(`failed to inspect active log ${normalized}: ${errorMessage(error)}`);
				return null;
			}
		}
		const date = FILE_RE.exec(path.basename(normalized))?.[1] ?? todayString();
		this.files.set(normalized, {
			path: normalized,
			bytes,
			mtimeMs,
			date
		});
		this.usedBytes += bytes;
		this.active.add(normalized);
		return bytes;
	}
	deactivate(filePath) {
		this.active.delete(path.resolve(filePath));
		if (this.maintenanceSuspensions > 0) return;
		this.maintainAfterClose();
	}
	suspendMaintenance() {
		this.maintenanceSuspensions += 1;
		let resumed = false;
		return () => {
			if (resumed) return;
			resumed = true;
			this.maintenanceSuspensions = Math.max(0, this.maintenanceSuspensions - 1);
		};
	}
	reserve(filePath, bytes) {
		if (bytes <= 0) return true;
		if (this.degraded && !this.retry(false)) {
			this.droppedLines += 1;
			return false;
		}
		if (!this.ensureCapacity(bytes)) {
			this.droppedLines += 1;
			return false;
		}
		const normalized = path.resolve(filePath);
		const file = this.files.get(normalized);
		if (!file) {
			if (this.activate(normalized) === null) {
				this.droppedLines += 1;
				return false;
			}
			return this.reserve(normalized, bytes);
		}
		file.bytes += bytes;
		file.mtimeMs = Date.now();
		this.usedBytes += bytes;
		return true;
	}
	writeFailed(filePath, error) {
		this.storageFailed(`write ${filePath}`, error);
	}
	storageFailed(operation, error) {
		this.enterDegraded(`${operation}: ${errorMessage(error)}`);
	}
	snapshot() {
		return {
			state: this.degraded ? "degraded" : this.lastError ? "warning" : "healthy",
			totalBytes: this.usedBytes,
			fileCount: this.files.size,
			activeFileCount: this.active.size,
			droppedLines: this.droppedLines,
			...this.lastError ? { lastError: this.lastError } : {}
		};
	}
	updatePolicy(maxTotalBytes, retainDays) {
		this.maxTotalBytes = maxTotalBytes;
		this.retainDays = retainDays;
		this.degraded = false;
		this.lastError = null;
		this.nextRetryAt = 0;
		try {
			this.refreshClosedFiles();
			this.cleanupExpired();
			this.ensureCapacity(0);
		} catch (error) {
			this.enterDegraded(`failed to apply log storage policy: ${errorMessage(error)}`);
			throw error;
		}
	}
	clearClosedFiles() {
		this.refreshClosedFiles();
		let deletedFiles = 0;
		let freedBytes = 0;
		const failures = [];
		const candidates = [...this.files.values()].filter((file) => !this.active.has(file.path)).sort((a, b) => a.mtimeMs - b.mtimeMs || a.path.localeCompare(b.path));
		for (const file of candidates) {
			const bytes = file.bytes;
			if (this.deleteManagedFile(file, "capacity")) {
				deletedFiles += 1;
				freedBytes += bytes;
			} else failures.push({
				file: path.relative(this.root, file.path),
				message: this.lastError ?? "unknown cleanup error"
			});
		}
		if (failures.length === 0) {
			this.degraded = false;
			this.lastError = null;
			this.nextRetryAt = 0;
		} else if (this.usedBytes > this.maxTotalBytes) this.enterDegraded(`managed logs still use ${String(this.usedBytes)} bytes after manual cleanup, exceeding the ${String(this.maxTotalBytes)} byte limit`);
		this.ensureCapacity(0);
		return {
			deletedFiles,
			freedBytes,
			failures
		};
	}
	retry(force) {
		if (!force && Date.now() < this.nextRetryAt) return false;
		this.degraded = false;
		this.lastError = null;
		try {
			this.refreshClosedFiles();
			const recovered = this.ensureCapacity(0);
			if (recovered) this.nextRetryAt = 0;
			return recovered;
		} catch (error) {
			this.enterDegraded(`failed to refresh managed logs: ${errorMessage(error)}`);
			return false;
		}
	}
	maintainAfterClose() {
		try {
			this.refreshClosedFiles();
			this.cleanupExpired();
			if (this.degraded) this.retry(true);
			else this.ensureCapacity(0);
		} catch (error) {
			this.enterDegraded(`failed to maintain managed logs after rotation: ${errorMessage(error)}`);
		}
	}
	ensureCapacity(incomingBytes) {
		if (this.usedBytes + incomingBytes <= this.maxTotalBytes) return true;
		const candidates = [...this.files.values()].filter((file) => !this.active.has(file.path)).sort((a, b) => a.mtimeMs - b.mtimeMs || a.path.localeCompare(b.path));
		for (const file of candidates) {
			if (this.usedBytes + incomingBytes <= this.maxTotalBytes) break;
			if (!this.deleteManagedFile(file, "capacity")) break;
		}
		if (this.usedBytes + incomingBytes <= this.maxTotalBytes) return true;
		this.enterDegraded(`managed logs require ${String(this.usedBytes + incomingBytes)} bytes, exceeding the ${String(this.maxTotalBytes)} byte limit; no closed log can be reclaimed`);
		return false;
	}
	enterDegraded(message) {
		const shouldReport = !this.degraded || this.lastError !== message;
		this.degraded = true;
		this.lastError = message;
		this.nextRetryAt = Date.now() + QUOTA_RETRY_MS;
		if (shouldReport) reportStorageError(message);
	}
	cleanupExpired() {
		if (this.retainDays === 0) return;
		const cutoff = Date.now() - this.retainDays * 24 * 60 * 60 * 1e3;
		const expired = [...this.files.values()].filter((file) => !this.active.has(file.path) && dateOf(file.date).getTime() < cutoff).sort((a, b) => a.mtimeMs - b.mtimeMs || a.path.localeCompare(b.path));
		for (const file of expired) if (!this.deleteManagedFile(file, "retention")) break;
	}
	deleteManagedFile(file, reason) {
		try {
			fs.unlinkSync(file.path);
			this.files.delete(file.path);
			this.usedBytes = Math.max(0, this.usedBytes - file.bytes);
			return true;
		} catch (error) {
			this.lastError = `${reason} cleanup failed for ${file.path}: ${error instanceof Error ? error.message : String(error)}`;
			reportStorageError(this.lastError);
			return false;
		}
	}
	loadManagedFiles() {
		for (const file of listManagedLogFiles(this.root)) {
			this.files.set(file.path, file);
			this.usedBytes += file.bytes;
		}
	}
	/** Refresh only closed files; active stream bytes are tracked in-memory and
	* may be newer than fs.stat while the WriteStream buffer is still flushing. */
	refreshClosedFiles() {
		const disk = new Map(listManagedLogFiles(this.root).map((file) => [file.path, file]));
		for (const [filePath, file] of this.files) {
			if (this.active.has(filePath)) continue;
			const next = disk.get(filePath);
			this.usedBytes -= file.bytes;
			if (next) {
				this.files.set(filePath, next);
				this.usedBytes += next.bytes;
				disk.delete(filePath);
			} else this.files.delete(filePath);
		}
		for (const file of disk.values()) {
			if (this.files.has(file.path)) continue;
			this.files.set(file.path, file);
			this.usedBytes += file.bytes;
		}
	}
};
function listManagedLogFiles(root) {
	const out = [];
	const readDirectory = (dir) => {
		try {
			return fs.readdirSync(dir, { withFileTypes: true });
		} catch (error) {
			if (isMissing(error)) return null;
			throw new Error(`failed to read managed log directory ${dir}: ${errorMessage(error)}`, { cause: error });
		}
	};
	const visit = (dir, entries) => {
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			const match = FILE_RE.exec(entry.name);
			if (!match) continue;
			const filePath = path.resolve(dir, entry.name);
			try {
				const stat = fs.statSync(filePath);
				out.push({
					path: filePath,
					bytes: stat.size,
					mtimeMs: stat.mtimeMs,
					date: match[1]
				});
			} catch (error) {
				if (isMissing(error)) continue;
				throw new Error(`failed to stat managed log ${filePath}: ${errorMessage(error)}`, { cause: error });
			}
		}
	};
	const rootEntries = readDirectory(root);
	if (!rootEntries) return out;
	visit(root, rootEntries);
	for (const entry of rootEntries) if (entry.isDirectory() && ACCOUNT_DIR_RE.test(entry.name)) {
		const accountDir = path.join(root, entry.name);
		const accountEntries = readDirectory(accountDir);
		if (accountEntries) visit(accountDir, accountEntries);
	}
	return out;
}
function reportStorageError(message) {
	process.stderr.write(`[logger.storage] ${message}\n`);
}
/**
* Owns one output directory: keeps at most one open WriteStream, handles
* daily rollover and the per-file size cap. Retention and total-tree quota
* belong to the shared LogQuota, never to each writer independently.
*/
var FileWriter = class {
	dir;
	maxBytes;
	quota;
	disabled = false;
	file = null;
	pendingCloses = /* @__PURE__ */ new Set();
	constructor(dir, maxBytes, quota) {
		this.dir = dir;
		this.maxBytes = maxBytes;
		this.quota = quota;
		try {
			fs.mkdirSync(dir, { recursive: true });
		} catch (err) {
			this.disabled = true;
			this.quota.storageFailed(`failed to create log directory ${dir}`, err);
			return;
		}
	}
	get isDisabled() {
		return this.disabled;
	}
	get currentPath() {
		return this.file?.path ?? null;
	}
	async prepare() {
		this.ensureForToday(todayString());
		const stream = this.file?.stream;
		if (!stream) throw new Error(`failed to prepare log writer in ${this.dir}`);
		await new Promise((resolve, reject) => {
			const opened = () => {
				stream.off("error", failed);
				resolve();
			};
			const failed = (error) => {
				stream.off("open", opened);
				reject(error);
			};
			stream.once("open", opened);
			stream.once("error", failed);
		});
	}
	write(data, bytes) {
		if (this.disabled) return false;
		const today = todayString();
		this.ensureForToday(today);
		if (!this.file) return false;
		if (this.file.bytes + bytes > this.maxBytes && this.file.bytes > 0) {
			this.rotateBySize();
			if (!this.file) return false;
		}
		if (!this.quota.reserve(this.file.path, bytes)) return false;
		try {
			this.file.stream.write(data);
		} catch (error) {
			this.disabled = true;
			this.quota.writeFailed(this.file.path, error);
			return false;
		}
		this.file.bytes += bytes;
		return true;
	}
	async close() {
		this.closeCurrent();
		await Promise.all(this.pendingCloses);
	}
	ensureForToday(today) {
		if (this.file && this.file.date === today) return;
		if (this.file) this.closeCurrent();
		let idx = 0;
		while (fs.existsSync(this.pathFor(today, idx + 1))) idx++;
		this.file = this.openFile(today, idx);
	}
	rotateBySize() {
		if (!this.file) return;
		const date = this.file.date;
		const previousIndex = this.file.splitIndex;
		this.closeCurrent();
		let next = previousIndex + 1;
		while (fs.existsSync(this.pathFor(date, next))) next++;
		this.file = this.openFile(date, next);
	}
	closeCurrent() {
		const file = this.file;
		this.file = null;
		if (!file) return;
		let finish;
		const closed = new Promise((resolve) => {
			let settled = false;
			finish = () => {
				if (settled) return;
				settled = true;
				this.quota.deactivate(file.path);
				resolve();
			};
		});
		this.pendingCloses.add(closed);
		closed.finally(() => this.pendingCloses.delete(closed));
		file.stream.once("error", finish);
		try {
			file.stream.end(finish);
		} catch (error) {
			this.quota.writeFailed(file.path, error);
			finish();
		}
	}
	openFile(date, splitIndex) {
		const p = this.pathFor(date, splitIndex);
		const existingBytes = this.quota.activate(p);
		if (existingBytes === null) return null;
		try {
			const stream = fs.createWriteStream(p, { flags: "a" });
			stream.on("error", (err) => {
				this.disabled = true;
				if (this.file?.stream === stream) this.file = null;
				this.quota.deactivate(p);
				this.quota.writeFailed(p, err);
			});
			return {
				stream,
				bytes: existingBytes,
				date,
				splitIndex,
				path: p
			};
		} catch (err) {
			this.disabled = true;
			this.quota.deactivate(p);
			this.quota.storageFailed(`failed to open log file ${p}`, err);
			return null;
		}
	}
	pathFor(date, splitIndex) {
		const tail = splitIndex > 0 ? `.${splitIndex}` : "";
		return path.join(this.dir, `${FILE_PREFIX}${date}${tail}${FILE_SUFFIX}`);
	}
};
var FileTransport = class {
	dir;
	maxBytes;
	maxTotalBytes;
	retainDays;
	enabled;
	perUinEnabled;
	initializationError = null;
	nextWriterRetryAt = 0;
	quota = null;
	shared = null;
	perUin = /* @__PURE__ */ new Map();
	constructor(policy) {
		if (policy) validatePolicy(policy);
		this.dir = path.resolve(process.env.SNOWLUMA_LOG_DIR || DEFAULT_DIR);
		this.maxBytes = parseRequiredPositiveInt(process.env.SNOWLUMA_LOG_MAX_MB, DEFAULT_MAX_MB, MAX_LOG_TOTAL_MB, "SNOWLUMA_LOG_MAX_MB") * 1024 * 1024;
		this.maxTotalBytes = (policy?.maxTotalMb ?? parseRequiredPositiveInt(process.env.SNOWLUMA_LOG_MAX_TOTAL_MB, DEFAULT_MAX_TOTAL_MB, MAX_LOG_TOTAL_MB, "SNOWLUMA_LOG_MAX_TOTAL_MB")) * 1024 * 1024;
		this.retainDays = policy?.retainDays ?? parseNonNegativeInt(process.env.SNOWLUMA_LOG_RETAIN_DAYS, DEFAULT_RETAIN_DAYS, MAX_LOG_RETAIN_DAYS, "SNOWLUMA_LOG_RETAIN_DAYS");
		this.enabled = process.env.SNOWLUMA_LOG_FILE !== "0";
		this.perUinEnabled = policy?.perUinEnabled ?? parseRequiredBool(process.env.SNOWLUMA_LOG_PER_UIN, false, "SNOWLUMA_LOG_PER_UIN");
		if (this.enabled) this.initialize();
	}
	/** True when no file output will happen (env disable or init failure). */
	get isDisabled() {
		return !this.shared;
	}
	/** Current shared-file path (or null if disabled / not yet opened). */
	get currentPath() {
		return this.shared?.currentPath ?? null;
	}
	/** Path of the per-UIN file for the given UIN, if open. */
	perUinPath(uin) {
		return this.perUin.get(uin)?.currentPath ?? null;
	}
	getStorageStatus() {
		if (!this.quota) return {
			state: "disabled",
			directory: this.dir,
			totalBytes: 0,
			maxTotalBytes: this.maxTotalBytes,
			retainDays: this.retainDays,
			perUinEnabled: this.perUinEnabled,
			fileCount: 0,
			activeFileCount: 0,
			droppedLines: 0,
			...this.initializationError ? { lastError: this.initializationError } : {}
		};
		return {
			...this.quota.snapshot(),
			directory: this.dir,
			maxTotalBytes: this.maxTotalBytes,
			retainDays: this.retainDays,
			perUinEnabled: this.perUinEnabled
		};
	}
	async updatePolicy(policy) {
		validatePolicy(policy);
		this.maxTotalBytes = policy.maxTotalMb * 1024 * 1024;
		this.retainDays = policy.retainDays;
		const disablingPerUin = this.perUinEnabled && !policy.perUinEnabled;
		this.perUinEnabled = policy.perUinEnabled;
		if (disablingPerUin) {
			const writers = [...this.perUin.values()];
			this.perUin.clear();
			await Promise.all(writers.map((writer) => writer.close()));
		}
		if (this.quota) this.quota.updatePolicy(this.maxTotalBytes, this.retainDays);
		if (this.enabled && (!this.quota || !this.shared || this.shared.isDisabled)) await this.recoverSharedWriter(true);
		return this.getStorageStatus();
	}
	async clearManagedLogs() {
		if (!this.enabled) return this.clearLogsWhileDisabled();
		if (!this.quota) try {
			this.quota = new LogQuota(this.dir, this.maxTotalBytes, this.retainDays);
		} catch (error) {
			this.recordWriterRecoveryFailure(error);
		}
		if (!this.quota) return {
			deletedFiles: 0,
			freedBytes: 0,
			failures: this.initializationError ? [{
				file: ".",
				message: this.initializationError
			}] : [],
			status: this.getStorageStatus()
		};
		const quota = this.quota;
		const accountUins = [...this.perUin.keys()];
		const writers = [...this.shared ? [this.shared] : [], ...this.perUin.values()];
		this.shared = null;
		this.perUin.clear();
		const resumeMaintenance = quota.suspendMaintenance();
		try {
			await Promise.all(writers.map((writer) => writer.close()));
		} finally {
			resumeMaintenance();
		}
		const result = quota.clearClosedFiles();
		const shared = new FileWriter(this.dir, this.maxBytes, quota);
		try {
			await shared.prepare();
			this.shared = shared;
			this.initializationError = null;
			this.nextWriterRetryAt = 0;
		} catch (error) {
			this.recordWriterRecoveryFailure(error);
			result.failures.push({
				file: ".",
				message: this.initializationError ?? "failed to reopen the shared log writer"
			});
		}
		if (this.perUinEnabled) for (const uin of accountUins) {
			const writer = new FileWriter(path.join(this.dir, String(uin)), this.maxBytes, quota);
			if (writer.isDisabled) continue;
			try {
				await writer.prepare();
				this.perUin.set(uin, writer);
			} catch (error) {
				quota.storageFailed(`failed to reopen account log writer for ${String(uin)}`, error);
				result.failures.push({
					file: String(uin),
					message: `failed to reopen account log writer: ${errorMessage(error)}`
				});
			}
		}
		return {
			...result,
			status: this.getStorageStatus()
		};
	}
	write(line, uin) {
		if (!this.enabled) return;
		if (!this.shared || this.shared.isDisabled) {
			if (!this.recoverSharedWriterForWrite()) return;
		}
		if (!this.shared) return;
		const data = sanitizeLogLine(line) + "\n";
		const bytes = Buffer.byteLength(data, "utf8");
		if (!this.shared.write(data, bytes)) {
			if (this.shared.isDisabled) {
				this.shared = null;
				this.nextWriterRetryAt = Date.now() + QUOTA_RETRY_MS;
			}
			return;
		}
		if (uin !== void 0 && this.perUinEnabled && this.quota) {
			let w = this.perUin.get(uin);
			if (w?.isDisabled) {
				this.perUin.delete(uin);
				w = void 0;
			}
			if (!w) {
				w = new FileWriter(path.join(this.dir, String(uin)), this.maxBytes, this.quota);
				if (w.isDisabled) return;
				this.perUin.set(uin, w);
			}
			w.write(data, bytes);
		}
	}
	async close() {
		const closes = [];
		if (this.shared) closes.push(this.shared.close());
		for (const w of this.perUin.values()) closes.push(w.close());
		this.shared = null;
		this.perUin.clear();
		await Promise.all(closes);
	}
	async recoverSharedWriter(force) {
		if (!this.enabled) return;
		if (!force && Date.now() < this.nextWriterRetryAt) throw new Error(this.initializationError ?? "log writer retry is rate-limited");
		if (this.shared?.isDisabled) this.shared = null;
		if (!this.quota) this.initialize();
		if (!this.shared && this.quota) {
			const writer = new FileWriter(this.dir, this.maxBytes, this.quota);
			if (!writer.isDisabled) this.shared = writer;
		}
		const writer = this.shared;
		if (!writer) throw new Error(this.initializationError ?? "failed to create the shared log writer");
		try {
			await writer.prepare();
			if (writer.isDisabled || !writer.currentPath) throw new Error("the shared log writer did not open a file");
			this.initializationError = null;
			this.nextWriterRetryAt = 0;
		} catch (error) {
			this.shared = null;
			this.recordWriterRecoveryFailure(error);
			throw error;
		}
	}
	recoverSharedWriterForWrite() {
		if (!this.enabled || Date.now() < this.nextWriterRetryAt) return false;
		if (this.shared?.isDisabled) this.shared = null;
		if (!this.quota) this.initialize();
		if (!this.shared && this.quota) {
			const writer = new FileWriter(this.dir, this.maxBytes, this.quota);
			if (!writer.isDisabled) this.shared = writer;
		}
		if (this.shared) {
			this.initializationError = null;
			this.nextWriterRetryAt = 0;
			return true;
		}
		return false;
	}
	clearLogsWhileDisabled() {
		try {
			const quota = new LogQuota(this.dir, this.maxTotalBytes, this.retainDays, false);
			const result = quota.clearClosedFiles();
			const snapshot = quota.snapshot();
			return {
				...result,
				status: {
					...snapshot,
					state: "disabled",
					directory: this.dir,
					maxTotalBytes: this.maxTotalBytes,
					retainDays: this.retainDays,
					perUinEnabled: this.perUinEnabled
				}
			};
		} catch (error) {
			const message = `failed to clear disabled log storage ${this.dir}: ${errorMessage(error)}`;
			reportStorageError(message);
			return {
				deletedFiles: 0,
				freedBytes: 0,
				failures: [{
					file: ".",
					message
				}],
				status: {
					state: "disabled",
					directory: this.dir,
					totalBytes: 0,
					maxTotalBytes: this.maxTotalBytes,
					retainDays: this.retainDays,
					perUinEnabled: this.perUinEnabled,
					fileCount: 0,
					activeFileCount: 0,
					droppedLines: 0,
					lastError: message
				}
			};
		}
	}
	recordWriterRecoveryFailure(error) {
		this.initializationError = `failed to initialize log storage ${this.dir}: ${errorMessage(error)}`;
		this.nextWriterRetryAt = Date.now() + QUOTA_RETRY_MS;
		reportStorageError(this.initializationError);
	}
	initialize() {
		try {
			fs.mkdirSync(this.dir, { recursive: true });
			const quota = new LogQuota(this.dir, this.maxTotalBytes, this.retainDays);
			const writer = new FileWriter(this.dir, this.maxBytes, quota);
			if (writer.isDisabled) throw new Error(`failed to create shared log writer in ${this.dir}`);
			this.quota = quota;
			this.shared = writer;
			this.initializationError = null;
			this.nextWriterRetryAt = 0;
		} catch (error) {
			this.quota = null;
			this.shared = null;
			this.recordWriterRecoveryFailure(error);
		}
	}
};
function validatePolicy(policy) {
	if (!Number.isSafeInteger(policy.maxTotalMb) || policy.maxTotalMb <= 0 || policy.maxTotalMb > MAX_LOG_TOTAL_MB) throw new RangeError(`maxTotalMb must be an integer in 1..${String(MAX_LOG_TOTAL_MB)}`);
	if (!Number.isSafeInteger(policy.retainDays) || policy.retainDays < 0 || policy.retainDays > MAX_LOG_RETAIN_DAYS) throw new RangeError(`retainDays must be an integer in 0..${String(MAX_LOG_RETAIN_DAYS)}`);
	if (typeof policy.perUinEnabled !== "boolean") throw new TypeError("perUinEnabled must be a boolean");
}
var singleton = null;
var configuredPolicy = null;
function getFileTransport() {
	if (!singleton) singleton = new FileTransport(configuredPolicy ?? void 0);
	return singleton;
}
async function configureFileTransport(policy) {
	validatePolicy(policy);
	configuredPolicy = { ...policy };
	if (!singleton) singleton = new FileTransport(configuredPolicy);
	else await singleton.updatePolicy(configuredPolicy);
	return singleton.getStorageStatus();
}
function getLogStorageStatus() {
	return getFileTransport().getStorageStatus();
}
function clearManagedLogs() {
	return getFileTransport().clearManagedLogs();
}
function isMissing(error) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region ../common/src/log-summary.ts
var MAX_FIELD = 40;
var MAX_TOTAL = 200;
var SENSITIVE_SEGMENTS = /* @__PURE__ */ new Set([
	"authorization",
	"cookie",
	"credential",
	"credentials",
	"password",
	"passwd",
	"secret",
	"token",
	"apikey",
	"privatekey",
	"sessionkey"
]);
function isSensitiveKey(key) {
	const segments = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[-_.\s]+/).filter(Boolean).map((segment) => segment.toLowerCase());
	return segments.some((segment, index) => {
		if (SENSITIVE_SEGMENTS.has(segment)) return true;
		return segments[index + 1] === "key" && (segment === "api" || segment === "private" || segment === "session");
	});
}
function valueRepr(v, key) {
	if (key !== void 0 && isSensitiveKey(key)) return "\"***\"";
	if (v === null) return "null";
	if (v === void 0) return "undefined";
	switch (typeof v) {
		case "string": return v.length > MAX_FIELD ? `"${v.slice(0, MAX_FIELD)}..."` : `"${v}"`;
		case "number":
		case "boolean":
		case "bigint": return String(v);
		case "object":
			if (Array.isArray(v)) return `[len=${v.length}]`;
			return "{...}";
		default: return typeof v;
	}
}
/**
* Render a params object as a single line for logging. Skips deep
* traversal: nested objects collapse to `{...}`, arrays to `[len=N]`.
* Strings are quoted; long ones are truncated with an ellipsis.
*
* Output is capped at MAX_TOTAL chars; on overflow the tail is
* replaced with `...` so the next field doesn't get half-rendered.
*/
function summarizeParams(params) {
	if (params === null || params === void 0) return "{}";
	if (typeof params !== "object") {
		const s = String(params);
		return s.length > MAX_TOTAL ? `${s.slice(0, MAX_TOTAL - 3)}...` : s;
	}
	if (Array.isArray(params)) return `[len=${params.length}]`;
	const out = [];
	let total = 0;
	for (const [k, v] of Object.entries(params)) {
		const entry = `${k}=${valueRepr(v, k)}`;
		const separatorLength = out.length > 0 ? 1 : 0;
		if (total + separatorLength + entry.length > MAX_TOTAL) {
			if (out.length === 0) return `${entry.slice(0, MAX_TOTAL - 3)}...`;
			const rendered = out.join(" ");
			return rendered.length + 4 <= MAX_TOTAL ? `${rendered} ...` : `${rendered.slice(0, MAX_TOTAL - 3)}...`;
		}
		out.push(entry);
		total += separatorLength + entry.length;
	}
	return out.join(" ");
}
var ASSIGNMENT_START = /(^|[^A-Za-z0-9_-])(["']?)([-_]*(?=[A-Za-z0-9_.-]*[A-Za-z])[A-Za-z0-9][A-Za-z0-9_.-]*)\2(\s*[:=]\s*)/gi;
var AUTHORIZATION_BOUNDARY_SEGMENTS = /* @__PURE__ */ new Set([
	"authorization",
	"cookie",
	"password",
	"passwd",
	"secret",
	"token",
	"apikey",
	"privatekey",
	"sessionkey"
]);
function keySegments(key) {
	return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[-_.\s]+/).filter(Boolean).map((segment) => segment.toLowerCase());
}
function isKeyKind(key, kind) {
	return keySegments(key).includes(kind);
}
function isAuthorizationBoundaryKey(key) {
	const segments = keySegments(key);
	return segments.some((segment, index) => {
		if (AUTHORIZATION_BOUNDARY_SEGMENTS.has(segment)) return true;
		return segments[index + 1] === "key" && (segment === "api" || segment === "private" || segment === "session");
	});
}
function quotedValueEnd(message, start) {
	const quote = message[start];
	if (quote !== "\"" && quote !== "'") return void 0;
	for (let index = start + 1; index < message.length; index += 1) if (message[index] === "\\") index += 1;
	else if (message[index] === quote) return index + 1;
	return message.length;
}
function cookieValueEnd(message, start) {
	const initialQuotedEnd = quotedValueEnd(message, start);
	let end;
	if (initialQuotedEnd !== void 0) end = initialQuotedEnd;
	else {
		end = start;
		while (end < message.length && !/[;\s,}\]&\r\n]/.test(message[end])) end += 1;
	}
	while (end < message.length) {
		let semicolon = end;
		while (message[semicolon] === " " || message[semicolon] === "	") semicolon += 1;
		if (message[semicolon] !== ";") break;
		let nameStart = semicolon + 1;
		while (message[nameStart] === " " || message[nameStart] === "	") nameStart += 1;
		let nameEnd = nameStart;
		while (/[A-Za-z0-9_-]/.test(message[nameEnd] ?? "")) nameEnd += 1;
		if (nameEnd === nameStart) break;
		end = nameEnd;
		if (message[end] !== "=") continue;
		const attribute = message.slice(nameStart, nameEnd).toLowerCase();
		const valueStart = end + 1;
		const quotedEnd = quotedValueEnd(message, valueStart);
		if (quotedEnd !== void 0) {
			end = quotedEnd;
			continue;
		}
		if (attribute !== "expires") {
			end = valueStart;
			while (end < message.length && !/[;\s,}\]&\r\n]/.test(message[end])) end += 1;
			continue;
		}
		end = valueStart;
		while (end < message.length && !/[;}\]&\r\n]/.test(message[end])) end += 1;
		const assignments = new RegExp(ASSIGNMENT_START.source, "gi");
		assignments.lastIndex = valueStart;
		const nextField = assignments.exec(message);
		if (nextField && nextField.index < end) end = nextField.index;
	}
	return end;
}
function genericValueEnd(message, start) {
	const quotedEnd = quotedValueEnd(message, start);
	if (quotedEnd !== void 0) return quotedEnd;
	let end = start;
	while (end < message.length && !/[\s,}\]&\r\n]/.test(message[end])) end += 1;
	return end;
}
function authorizationValueEnd(message, start, query) {
	const quotedEnd = quotedValueEnd(message, start);
	if (quotedEnd !== void 0) return quotedEnd;
	if (query) {
		const queryEnd = message.indexOf("&", start);
		return queryEnd >= 0 ? queryEnd : message.length;
	}
	let end = message.length;
	const structural = message.slice(start).search(/[\r\n}\]]/);
	if (structural >= 0) end = start + structural;
	const assignments = new RegExp(ASSIGNMENT_START.source, "gi");
	const remaining = message.slice(start, end);
	for (let match = assignments.exec(remaining); match; match = assignments.exec(remaining)) if (isAuthorizationBoundaryKey(match[3])) {
		end = start + match.index;
		break;
	}
	return end;
}
/** Redact explicit authentication assignments in ordinary formatted logs. */
function redactLogMessage(message) {
	let out = "";
	let cursor = 0;
	ASSIGNMENT_START.lastIndex = 0;
	for (let match = ASSIGNMENT_START.exec(message); match; match = ASSIGNMENT_START.exec(message)) {
		const key = match[3];
		if (!isSensitiveKey(key)) {
			ASSIGNMENT_START.lastIndex = Math.max(match.index + 1, ASSIGNMENT_START.lastIndex - 1);
			continue;
		}
		const valueStart = ASSIGNMENT_START.lastIndex;
		const valueEnd = isKeyKind(key, "authorization") ? authorizationValueEnd(message, valueStart, match[1] === "?" || match[1] === "&") : isKeyKind(key, "cookie") ? cookieValueEnd(message, valueStart) : genericValueEnd(message, valueStart);
		out += message.slice(cursor, valueStart) + "***";
		cursor = valueEnd;
		ASSIGNMENT_START.lastIndex = valueEnd;
	}
	return out + message.slice(cursor);
}
/**
* Lossless nested renderer for explicit TRACE diagnostics. TRACE is an
* operator-enabled, memory-only mode and intentionally leaves values
* unredacted so a reproduction contains the complete business input.
*/
function renderParamsVerbose(params) {
	const seen = /* @__PURE__ */ new WeakSet();
	const walk = (value) => {
		if (value === null) return "null";
		if (value === void 0) return "undefined";
		switch (typeof value) {
			case "string": return JSON.stringify(value);
			case "number":
			case "boolean":
			case "bigint": return String(value);
			case "object": {
				if (seen.has(value)) return "\"[circular]\"";
				seen.add(value);
				const out = Array.isArray(value) ? `[${value.map((item) => walk(item)).join(",")}]` : `{${Object.entries(value).map(([key, item]) => `${key}:${walk(item)}`).join(",")}}`;
				seen.delete(value);
				return out;
			}
			default: return typeof value;
		}
	};
	return walk(params);
}
//#endregion
//#region ../common/src/request-context.ts
var storage = new AsyncLocalStorage();
var counter = 0;
/**
* Allocate the next per-process request id (monotonic). Wraps via uint32 so
* it never overflows to a non-integer; `0` is skipped so "no id" stays
* unambiguous.
*/
function nextRequestId() {
	counter = counter + 1 >>> 0;
	if (counter === 0) counter = 1;
	return counter;
}
/**
* Run `fn` with `id` bound as the ambient request id for the entire async
* chain it spawns. Any logger call anywhere in that chain — across packages,
* across awaits — picks it up via {@link currentRequestId} with no signature
* threading. Used by the OneBot action handler to correlate a request's whole
* journey (entry → outbound packets → exit) under one `[req#N]` tag.
*/
function runWithRequestId(id, fn) {
	return storage.run({ id }, fn);
}
/** Run `fn` without inheriting an ambient request id. */
function runWithoutRequestContext(fn) {
	return storage.run(void 0, fn);
}
/** The request id bound to the current async context, or undefined outside one. */
function currentRequestId() {
	return storage.getStore()?.id;
}
//#endregion
//#region ../common/src/logger.ts
var UIN_SLOT_WIDTH = 12;
var LEVEL_WEIGHT = {
	trace: 5,
	debug: 10,
	info: 20,
	success: 25,
	warn: 30,
	error: 40
};
var LEVEL_LABEL = {
	trace: "TRACE",
	debug: "DEBUG",
	info: "INFO",
	success: "OK",
	warn: "WARN",
	error: "ERROR"
};
var COLOR_CODE = {
	trace: 90,
	debug: 90,
	info: 36,
	success: 32,
	warn: 33,
	error: 31
};
var COLOR_SCOPE = 35;
var COLOR_DIM = 2;
var COLOR_RESET = "\x1B[0m";
var MAX_LOG_ENTRIES = 1e3;
/** Trace ring cap — env-tunable since trace is the high-volume stream. */
function resolveTraceBufferMax() {
	const raw = Number.parseInt(process.env.SNOWLUMA_TRACE_BUFFER ?? "", 10);
	return Number.isFinite(raw) && raw >= 100 ? raw : 5e3;
}
var TRACE_BUFFER_MAX = resolveTraceBufferMax();
/**
* Fixed-capacity circular buffer. O(1) push + eviction (no array `.shift()`),
* so the high-throughput trace stream never pays an O(n) shift per overflow.
*/
var RingBuffer = class {
	cap;
	buf;
	start = 0;
	count = 0;
	constructor(cap) {
		this.cap = cap;
		this.buf = new Array(cap);
	}
	push(item) {
		const end = (this.start + this.count) % this.cap;
		this.buf[end] = item;
		if (this.count < this.cap) this.count += 1;
		else this.start = (this.start + 1) % this.cap;
	}
	/** Most recent `n` items, oldest→newest. */
	recent(n) {
		const take = Math.max(0, Math.min(Math.trunc(n), this.count));
		const out = new Array(take);
		const first = this.start + (this.count - take);
		for (let i = 0; i < take; i += 1) out[i] = this.buf[(first + i) % this.cap];
		return out;
	}
	toArray() {
		return this.recent(this.count);
	}
	get size() {
		return this.count;
	}
};
var logRing = new RingBuffer(MAX_LOG_ENTRIES);
var traceRing = new RingBuffer(TRACE_BUFFER_MAX);
var logSubscribers = /* @__PURE__ */ new Set();
var nextLogId = 1;
function resolveMinLevel() {
	const raw = (process.env.SNOWLUMA_LOG_LEVEL ?? "info").toLowerCase();
	if (raw === "trace" || raw === "debug" || raw === "info" || raw === "success" || raw === "warn" || raw === "error") return raw;
	return "info";
}
function resolveFileMinLevel() {
	const raw = process.env.SNOWLUMA_LOG_FILE_LEVEL;
	if (raw === void 0 || raw.trim() === "") return "debug";
	const normalized = raw.trim().toLowerCase();
	if (normalized === "debug" || normalized === "info" || normalized === "success" || normalized === "warn" || normalized === "error") return normalized;
	throw new TypeError("SNOWLUMA_LOG_FILE_LEVEL must be one of: debug, info, success, warn, error");
}
var currentLevel = resolveMinLevel();
var currentFileLevel = resolveFileMinLevel();
function shouldLog(level) {
	return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[currentLevel];
}
function shouldLogToFile(level) {
	return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[currentFileLevel];
}
var LOG_LEVELS = [
	"trace",
	"debug",
	"info",
	"success",
	"warn",
	"error"
];
function getLogLevel() {
	return currentLevel;
}
function setLogLevel(level) {
	const lower = String(level).toLowerCase();
	if (!LOG_LEVELS.includes(lower)) return false;
	currentLevel = lower;
	return true;
}
function useColor() {
	if (process.env.NO_COLOR === "1") return false;
	return Boolean(process.stdout.isTTY);
}
function ansi(code, text) {
	return `\x1b[${code}m${text}${COLOR_RESET}`;
}
function currentTime() {
	const d = /* @__PURE__ */ new Date();
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
function render(level, options, message, reqId) {
	const ts = currentTime();
	const label = LEVEL_LABEL[level].padEnd(5, " ");
	const uinTag = options.uin !== void 0 ? `[${options.uin}]` : "";
	const uinSlot = uinTag.padEnd(UIN_SLOT_WIDTH);
	const reqTag = reqId !== void 0 ? `[req#${reqId}]` : "";
	if (!useColor()) return `${ts} ${label} ${uinSlot} [${options.scope}] ${reqTag ? `${reqTag} ` : ""}${message}`;
	return `${ansi(COLOR_DIM, ts)} ${ansi(COLOR_CODE[level], label)} ${uinTag ? ansi(COLOR_DIM, uinTag) + " ".repeat(Math.max(0, UIN_SLOT_WIDTH - uinTag.length)) : " ".repeat(UIN_SLOT_WIDTH)} ${ansi(COLOR_SCOPE, `[${options.scope}]`)} ${reqTag ? `${ansi(COLOR_DIM, reqTag)} ` : ""}${message}`;
}
function emit(level, options, args) {
	const passesConsole = shouldLog(level);
	const passesFile = level !== "trace" && shouldLogToFile(level);
	if (!passesConsole && !passesFile) return;
	if (level === "trace" && !passesConsole) return;
	let realArgs = args;
	if (level === "trace" && args.length === 1 && typeof args[0] === "function") realArgs = args[0]();
	const reqId = currentRequestId();
	const formattedMessage = format(...realArgs);
	const message = level === "trace" ? formattedMessage : redactLogMessage(formattedMessage);
	const line = render(level, options, message, reqId);
	const entry = {
		id: nextLogId++,
		time: (/* @__PURE__ */ new Date()).toISOString(),
		level,
		scope: options.scope,
		...options.uin !== void 0 ? { uin: options.uin } : {},
		...reqId !== void 0 ? { req: reqId } : {},
		message,
		line: sanitizeLogLine(line)
	};
	if (passesConsole) {
		(level === "trace" ? traceRing : logRing).push(entry);
		for (const subscriber of logSubscribers) subscriber(entry);
		const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
		const consoleLine = line.replace(/[\x00-\x08\x0B-\x1A\x1C-\x1F\x7F]/g, "") + "\n";
		try {
			stream.write(consoleLine);
		} catch {}
	}
	if (passesFile) getFileTransport().write(line, options.uin);
}
/**
* Flush and close the underlying log file. Call from shutdown hooks
* (SIGINT / SIGTERM / uncaughtException) so the WriteStream's internal
* buffer makes it to disk. Returns a promise that resolves once the OS
* has finalized the write.
*/
function closeLogger() {
	return getFileTransport().close();
}
function mergeLogRings() {
	return traceRing.size > 0 ? [...logRing.toArray(), ...traceRing.toArray()].sort((a, b) => a.id - b.id) : logRing.toArray();
}
function getLogSnapshot() {
	return mergeLogRings();
}
function getRecentLogs(limit = 300) {
	const n = Math.max(1, Math.trunc(limit));
	return mergeLogRings().slice(-n);
}
function subscribeLogs(callback) {
	logSubscribers.add(callback);
	return () => {
		logSubscribers.delete(callback);
	};
}
function makeLogger(opts) {
	return {
		trace: (...args) => emit("trace", opts, args),
		debug: (...args) => emit("debug", opts, args),
		info: (...args) => emit("info", opts, args),
		success: (...args) => emit("success", opts, args),
		warn: (...args) => emit("warn", opts, args),
		error: (...args) => emit("error", opts, args),
		child: (meta) => {
			const nextUin = typeof meta.uin === "number" ? meta.uin : opts.uin;
			return makeLogger({
				scope: opts.scope,
				uin: nextUin,
				meta: {
					...opts.meta ?? {},
					...meta
				}
			});
		}
	};
}
function createLogger(scope) {
	return makeLogger({ scope });
}
function renderTraceBytes(body) {
	return Buffer.from(body.buffer, body.byteOffset, body.byteLength).toString("hex");
}
function runWithTraceRequest(fn) {
	if (currentRequestId() !== void 0 || currentLevel !== "trace") return fn();
	return runWithRequestId(nextRequestId(), fn);
}
function logInitialWebuiCredentials(password) {
	const line = render("info", { scope: "WebUI" }, format("initial credentials: user=admin password=%s", password));
	process.stdout.write(line.replace(/[\x00-\x08\x0B-\x1A\x1C-\x1F\x7F]/g, "") + "\n");
}
//#endregion
export { loadRuntimeConfig as C, updateRuntimeConfig as D, resolveRuntimeEnvOverrides as E, MAX_LOG_TOTAL_MB as S, readRuntimeConfig as T, clearManagedLogs as _, getLogSnapshot as a, DEFAULT_LOG_MAX_TOTAL_MB as b, renderTraceBytes as c, subscribeLogs as d, currentRequestId as f, summarizeParams as g, renderParamsVerbose as h, getLogLevel as i, runWithTraceRequest as l, runWithoutRequestContext as m, closeLogger as n, getRecentLogs as o, runWithRequestId as p, createLogger as r, logInitialWebuiCredentials as s, LOG_LEVELS as t, setLogLevel as u, configureFileTransport as v, normalizeRuntimeConfig as w, MAX_LOG_RETAIN_DAYS as x, getLogStorageStatus as y };
