import { createRequire as __snowlumaCreateRequire } from "node:module";
__snowlumaCreateRequire(import.meta.url);
import { f as resolveLocalFilePath } from "./utils-tSVKpzEf.js";
import { c as renderTraceBytes, h as renderParamsVerbose, i as getLogLevel, l as runWithTraceRequest, r as createLogger } from "./logger-BAozzyTt.js";
import fs from "node:fs";
import path from "node:path";
import fs$1 from "fs";
import path$1 from "path";
import net from "net";
import { createHash, randomBytes } from "crypto";
import net$1, { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import { readFile } from "node:fs/promises";
import { createHash as createHash$1 } from "node:crypto";
import os from "node:os";
import dns from "dns/promises";
import tls from "node:tls";
//#region ../common/src/uin.ts
function isRealUin(uin) {
	return /^\d{5,10}$/.test(uin);
}
//#endregion
//#region ../onebot/src/config.ts
var log$7 = createLogger("OneBot.Config");
var CONFIG_DIR$2 = "config";
var DEFAULT_CONFIG_PATH = path$1.join(CONFIG_DIR$2, "onebot.json");
var DEFAULT_ACCESS_TOKEN_BYTES = 32;
var NODE_TIMER_MAX_MS = 2147483647;
var PER_UIN_SNAPSHOT_MARKER = "snapshot";
var DEFAULT_STATUS_COMMAND = {
	enabled: true,
	swallow: false,
	cooldownSeconds: 5,
	trigger: "#sl"
};
/** Upper bound on the status-command reply cooldown — a year is effectively "off but sane". */
var STATUS_COMMAND_COOLDOWN_MAX = 31536e3;
function makeDefaultStatusCommand() {
	return { ...DEFAULT_STATUS_COMMAND };
}
function makeDefaultOneBotConfig() {
	return {
		networks: {
			httpServers: [{
				name: "http-default",
				host: "127.0.0.1",
				port: 3e3,
				path: "/",
				enableWebSocket: false,
				accessToken: generateAccessToken(),
				messageFormat: "array",
				reportSelfMessage: false
			}],
			httpClients: [],
			wsServers: [{
				name: "ws-default",
				host: "127.0.0.1",
				port: 3001,
				path: "/",
				role: "Universal",
				accessToken: generateAccessToken(),
				messageFormat: "array",
				reportSelfMessage: false
			}],
			wsClients: []
		},
		statusCommand: makeDefaultStatusCommand(),
		historySync: { enabled: false },
		notifications: { channelIds: [] }
	};
}
function generateAccessToken() {
	return randomBytes(DEFAULT_ACCESS_TOKEN_BYTES).toString("base64url");
}
/** A deterministic configuration error. Callers may safely return this as a
*  4xx without conflating it with filesystem/runtime failures. */
var OneBotConfigValidationError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "OneBotConfigValidationError";
	}
};
function loadOneBotConfig(uin, options = {}) {
	ensureConfigDir$1();
	const perUinPath = path$1.join(CONFIG_DIR$2, `onebot_${uin}.json`);
	const globalRaw = tryLoadJson(DEFAULT_CONFIG_PATH);
	const perUinRaw = tryLoadJson(perUinPath, true);
	const legacy = !!perUinRaw && hasLegacyTopLevel(perUinRaw);
	const sources = [];
	const isCanonicalSnapshot = perUinRaw?.mode === PER_UIN_SNAPSHOT_MARKER;
	if (globalRaw && !isCanonicalSnapshot) sources.push(globalRaw);
	if (perUinRaw) sources.push(perUinRaw);
	const config = fromJson(sources, !perUinRaw && !globalRaw);
	if (options.persistDefaults && (!perUinRaw || legacy)) saveOneBotConfig(uin, config, { mode: globalRaw ? "overlay" : "snapshot" });
	return config;
}
function saveOneBotConfig(uin, config, options = {}) {
	assertValidOneBotConfig(config);
	ensureConfigDir$1();
	saveJson(path$1.join(CONFIG_DIR$2, `onebot_${uin}.json`), toJsonObject(config, options.mode ?? "snapshot"));
}
/**
* Parse and canonicalize an on-disk OneBot config without touching the
* filesystem. Restore uses this owner-provided seam so legacy layouts are
* migrated deliberately while malformed values cannot disappear through the
* normal load path's permissive compatibility parser.
*/
function prepareOneBotConfigForRestore(value, scope, inheritedGlobal) {
	if (!isObject$2(value)) invalid("restore source must be an object");
	validateOneBotRestoreSource(value);
	let global = null;
	if (inheritedGlobal !== void 0 && inheritedGlobal !== null) {
		if (!isObject$2(inheritedGlobal)) invalid("inherited global restore source must be an object");
		validateOneBotRestoreSource(inheritedGlobal);
		global = inheritedGlobal;
	}
	if (scope === "global") return {
		value,
		migratedFields: []
	};
	const canonical = toJsonObject(fromJson(value.mode !== PER_UIN_SNAPSHOT_MARKER && global ? [global, value] : [value], false), scope === "per-uin" && value.mode === PER_UIN_SNAPSHOT_MARKER ? "snapshot" : "overlay");
	if (Object.prototype.hasOwnProperty.call(value, "musicSignUrl")) canonical.musicSignUrl = value.musicSignUrl;
	return {
		value: canonical,
		migratedFields: JSON.stringify(value) === JSON.stringify(canonical) ? [] : ["$"]
	};
}
var RESTORE_TOP_LEVEL_KEYS = /* @__PURE__ */ new Set([
	"mode",
	"networks",
	"statusCommand",
	"historySync",
	"notifications",
	"musicSignUrl",
	"httpServers",
	"httpClients",
	"httpPostEndpoints",
	"wsServers",
	"wsClients",
	"messageFormat",
	"reportSelfMessage"
]);
var RESTORE_NETWORK_KEYS = /* @__PURE__ */ new Set([
	"httpServers",
	"httpClients",
	"wsServers",
	"wsClients"
]);
var RESTORE_BASE_ADAPTER_KEYS = [
	"name",
	"enabled",
	"accessToken",
	"messageFormat",
	"reportSelfMessage"
];
function validateOneBotRestoreSource(value) {
	rejectUnknownKeys(value, RESTORE_TOP_LEVEL_KEYS, "$");
	if (value.mode !== void 0 && value.mode !== "snapshot" && value.mode !== "overlay") invalid("$.mode must be snapshot or overlay");
	if (value.messageFormat !== void 0 && parseMessageFormat(value.messageFormat) === void 0) invalid("$.messageFormat must be array or string");
	if (value.reportSelfMessage !== void 0 && typeof value.reportSelfMessage !== "boolean") invalid("$.reportSelfMessage must be a boolean");
	if (value.musicSignUrl !== void 0) {
		if (typeof value.musicSignUrl !== "string") invalid("$.musicSignUrl must be a string");
		const url = value.musicSignUrl.trim();
		if (url && !isHttpUrlForRestore(url)) invalid("$.musicSignUrl must be empty or an http(s) URL");
	}
	const networks = value.networks;
	if (networks !== void 0) {
		if (!isObject$2(networks)) invalid("$.networks must be an object");
		rejectUnknownKeys(networks, RESTORE_NETWORK_KEYS, "$.networks");
	}
	const counts = {
		httpServers: 0,
		httpClients: 0,
		wsServers: 0,
		wsClients: 0
	};
	const visit = (owner, key, pathPrefix) => {
		if (owner[key] === void 0) return;
		counts[key] += validateRestoreAdapterArray(owner[key], key, `${pathPrefix}.${key}`);
	};
	if (isObject$2(networks)) for (const key of RESTORE_NETWORK_KEYS) visit(networks, key, "$.networks");
	for (const key of RESTORE_NETWORK_KEYS) visit(value, key, "$");
	if (value.httpPostEndpoints !== void 0) counts.httpClients += validateRestoreAdapterArray(value.httpPostEndpoints, "httpClients", "$.httpPostEndpoints");
	validateRestoreStatusCommand(value.statusCommand);
	validateRestoreHistorySync(value.historySync);
	validateRestoreNotifications(value.notifications);
	const parsed = fromJson([value], false);
	for (const key of RESTORE_NETWORK_KEYS) {
		const kind = key;
		if (parsed.networks[kind].length !== counts[kind]) invalid(`$.${kind} contains a duplicate or unusable adapter`);
	}
}
function validateRestoreAdapterArray(value, kind, at) {
	if (!Array.isArray(value)) invalid(`${at} must be an array`);
	const specific = kind === "httpServers" || kind === "wsServers" ? [
		"host",
		"port",
		"path"
	] : kind === "httpClients" ? ["url", "timeoutMs"] : [
		"url",
		"role",
		"reconnectIntervalMs"
	];
	if (kind === "httpServers") specific.push("enableWebSocket");
	if (kind === "wsServers") specific.push("role");
	const allowed = /* @__PURE__ */ new Set([...RESTORE_BASE_ADAPTER_KEYS, ...specific]);
	value.forEach((raw, index) => {
		const pathAt = `${at}[${String(index)}]`;
		if (!isObject$2(raw)) invalid(`${pathAt} must be an object`);
		rejectUnknownKeys(raw, allowed, pathAt);
		if (raw.name !== void 0 && typeof raw.name !== "string") invalid(`${pathAt}.name must be a string`);
		if (raw.enabled !== void 0 && typeof raw.enabled !== "boolean") invalid(`${pathAt}.enabled must be a boolean`);
		if (raw.accessToken !== void 0 && typeof raw.accessToken !== "string") invalid(`${pathAt}.accessToken must be a string`);
		if (raw.messageFormat !== void 0 && parseMessageFormat(raw.messageFormat) === void 0) invalid(`${pathAt}.messageFormat must be array or string`);
		if (raw.reportSelfMessage !== void 0 && typeof raw.reportSelfMessage !== "boolean") invalid(`${pathAt}.reportSelfMessage must be a boolean`);
		if (kind === "httpServers" || kind === "wsServers") {
			const port = parseRestoreInteger(raw.port);
			if (port === null || port <= 0 || port > 65535) invalid(`${pathAt}.port must be an integer between 1 and 65535`);
			if (raw.host !== void 0 && typeof raw.host !== "string") invalid(`${pathAt}.host must be a string`);
			if (raw.path !== void 0 && typeof raw.path !== "string") invalid(`${pathAt}.path must be a string`);
			if (kind === "httpServers" && raw.enableWebSocket !== void 0 && typeof raw.enableWebSocket !== "boolean") invalid(`${pathAt}.enableWebSocket must be a boolean`);
		} else {
			if (raw.url !== void 0 && typeof raw.url !== "string") invalid(`${pathAt}.url must be a string`);
			if (raw.url === void 0 && raw.enabled !== false) invalid(`${pathAt}.url is required while the adapter is enabled`);
		}
		if (kind === "httpClients" && raw.timeoutMs !== void 0) {
			const timeout = parseRestoreInteger(raw.timeoutMs);
			if (timeout === null || timeout <= 0 || timeout > NODE_TIMER_MAX_MS) invalid(`${pathAt}.timeoutMs must be an integer between 1 and ${NODE_TIMER_MAX_MS}`);
		}
		if (kind === "wsServers" || kind === "wsClients") {
			const role = raw.role;
			if (role !== void 0 && ![
				"api",
				"event",
				"universal"
			].includes(String(role).toLowerCase())) invalid(`${pathAt}.role must be Api, Event, or Universal`);
		}
		if (kind === "wsClients" && raw.reconnectIntervalMs !== void 0) {
			const interval = parseRestoreInteger(raw.reconnectIntervalMs);
			if (interval === null || interval < 1e3 || interval > NODE_TIMER_MAX_MS) invalid(`${pathAt}.reconnectIntervalMs must be an integer between 1000 and ${NODE_TIMER_MAX_MS}`);
		}
	});
	return value.length;
}
function validateRestoreStatusCommand(value) {
	if (value === void 0) return;
	if (!isObject$2(value)) invalid("$.statusCommand must be an object");
	rejectUnknownKeys(value, /* @__PURE__ */ new Set([
		"enabled",
		"swallow",
		"cooldownSeconds",
		"trigger"
	]), "$.statusCommand");
	if (value.enabled !== void 0 && typeof value.enabled !== "boolean") invalid("$.statusCommand.enabled must be a boolean");
	if (value.swallow !== void 0 && typeof value.swallow !== "boolean") invalid("$.statusCommand.swallow must be a boolean");
	if (value.cooldownSeconds !== void 0) {
		const cooldown = parseRestoreInteger(value.cooldownSeconds);
		if (cooldown === null || cooldown < 0 || cooldown > STATUS_COMMAND_COOLDOWN_MAX) invalid(`$.statusCommand.cooldownSeconds must be an integer between 0 and ${STATUS_COMMAND_COOLDOWN_MAX}`);
	}
	if (value.trigger !== void 0) {
		const trigger = typeof value.trigger === "string" ? value.trigger.trim() : "";
		if (typeof value.trigger !== "string" || !trigger || /[\r\n]/.test(value.trigger) || trigger.length > 32) invalid(`$.statusCommand.trigger must be non-empty, single-line, and <= 32 characters`);
	}
}
function validateRestoreNotifications(value) {
	if (value === void 0) return;
	if (!isObject$2(value)) invalid("$.notifications must be an object");
	rejectUnknownKeys(value, /* @__PURE__ */ new Set(["channelIds"]), "$.notifications");
	if (value.channelIds === void 0) return;
	if (!Array.isArray(value.channelIds)) invalid("$.notifications.channelIds must be an array");
	value.channelIds.forEach((id, index) => {
		if (typeof id !== "string") invalid(`$.notifications.channelIds[${String(index)}] must be a string`);
		const normalized = id.trim();
		if (!normalized || normalized.length > 64 || !/^[\w.-]+$/.test(normalized)) invalid(`$.notifications.channelIds[${String(index)}] is invalid`);
	});
}
function validateRestoreHistorySync(value) {
	if (value === void 0) return;
	if (!isObject$2(value)) invalid("$.historySync must be an object");
	rejectUnknownKeys(value, /* @__PURE__ */ new Set(["enabled"]), "$.historySync");
	if (value.enabled !== void 0 && typeof value.enabled !== "boolean") invalid("$.historySync.enabled must be a boolean");
}
function rejectUnknownKeys(value, allowed, at) {
	const unknown = Object.keys(value).find((key) => !allowed.has(key));
	if (unknown) invalid(`${at}.${unknown} is not supported`);
}
function parseRestoreInteger(value) {
	const number = typeof value === "string" && value.trim() ? Number(value) : value;
	return typeof number === "number" && Number.isSafeInteger(number) ? number : null;
}
function isHttpUrlForRestore(value) {
	try {
		const parsed = new URL(value);
		return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host.length > 0;
	} catch {
		return false;
	}
}
/** Validate the normalized, public OneBot configuration shape before it is
*  persisted or compiled into a live network plan. Adapter names form one
*  process-wide namespace per account, not four independent namespaces. */
function assertValidOneBotConfig(value) {
	if (!isObject$2(value)) invalid("configuration must be an object");
	if (!isObject$2(value.networks)) invalid("networks must be an object");
	const seen = /* @__PURE__ */ new Map();
	const serverBindings = /* @__PURE__ */ new Map();
	validateNetworkList(value.networks, "httpServers", seen, (item, at) => {
		validateServer(item, at);
		if (item.enableWebSocket !== void 0 && typeof item.enableWebSocket !== "boolean") invalid(`${at}.enableWebSocket must be a boolean`);
		validateServerBinding(item, at, serverBindings);
	});
	validateNetworkList(value.networks, "httpClients", seen, (item, at) => {
		validateClient(item, at, /* @__PURE__ */ new Set(["http:", "https:"]));
		if (item.timeoutMs !== void 0 && (typeof item.timeoutMs !== "number" || !Number.isSafeInteger(item.timeoutMs) || item.timeoutMs <= 0 || item.timeoutMs > NODE_TIMER_MAX_MS)) invalid(`${at}.timeoutMs must be an integer between 1 and ${NODE_TIMER_MAX_MS}`);
	});
	validateNetworkList(value.networks, "wsServers", seen, (item, at) => {
		validateServer(item, at);
		validateServerBinding(item, at, serverBindings);
		validateRole(item.role, `${at}.role`);
	});
	validateNetworkList(value.networks, "wsClients", seen, (item, at) => {
		validateClient(item, at, /* @__PURE__ */ new Set(["ws:", "wss:"]));
		validateRole(item.role, `${at}.role`);
		if (item.reconnectIntervalMs !== void 0 && (typeof item.reconnectIntervalMs !== "number" || !Number.isSafeInteger(item.reconnectIntervalMs) || item.reconnectIntervalMs < 1e3 || item.reconnectIntervalMs > NODE_TIMER_MAX_MS)) invalid(`${at}.reconnectIntervalMs must be an integer between 1000 and ${NODE_TIMER_MAX_MS}`);
	});
	if (!isObject$2(value.statusCommand)) invalid("statusCommand must be an object");
	const status = value.statusCommand;
	if (typeof status.enabled !== "boolean") invalid("statusCommand.enabled must be a boolean");
	if (typeof status.swallow !== "boolean") invalid("statusCommand.swallow must be a boolean");
	if (typeof status.cooldownSeconds !== "number" || !Number.isInteger(status.cooldownSeconds) || status.cooldownSeconds < 0) invalid("statusCommand.cooldownSeconds must be a non-negative integer");
	if (typeof status.trigger !== "string" || !status.trigger.trim() || status.trigger.length > 32 || /[\r\n]/.test(status.trigger)) invalid(`statusCommand.trigger must be non-empty, single-line, and <= 32 characters`);
	if (!isObject$2(value.historySync)) invalid("historySync must be an object");
	if (typeof value.historySync.enabled !== "boolean") invalid("historySync.enabled must be a boolean");
	if (value.notifications !== void 0) {
		if (!isObject$2(value.notifications) || !Array.isArray(value.notifications.channelIds)) invalid("notifications.channelIds must be an array");
		for (const [index, channelId] of value.notifications.channelIds.entries()) if (typeof channelId !== "string" || !channelId || channelId.length > 64 || !/^[\w.-]+$/.test(channelId)) invalid(`notifications.channelIds[${index}] is invalid`);
	}
}
function validateNetworkList(networks, kind, seen, validateSpecific) {
	const list = networks[kind];
	if (!Array.isArray(list)) invalid(`networks.${kind} must be an array`);
	for (let index = 0; index < list.length; index += 1) {
		const item = list[index];
		const at = `networks.${kind}[${index}]`;
		if (!isObject$2(item)) invalid(`${at} must be an object`);
		validateNetworkBase(item, at);
		const name = item.name;
		const previousKind = seen.get(name);
		if (previousKind !== void 0) invalid(`network adapter name "${name}" is duplicated in ${previousKind} and ${kind}`);
		seen.set(name, kind);
		validateSpecific(item, at);
	}
}
function validateNetworkBase(item, at) {
	if (typeof item.name !== "string" || !item.name.trim()) invalid(`${at}.name must be a non-empty string`);
	if (item.name !== item.name.trim()) invalid(`${at}.name must not have surrounding whitespace`);
	if (item.enabled !== void 0 && typeof item.enabled !== "boolean") invalid(`${at}.enabled must be a boolean`);
	if (item.accessToken !== void 0 && typeof item.accessToken !== "string") invalid(`${at}.accessToken must be a string`);
	if (item.messageFormat !== "array" && item.messageFormat !== "string") invalid(`${at}.messageFormat must be "array" or "string"`);
	if (typeof item.reportSelfMessage !== "boolean") invalid(`${at}.reportSelfMessage must be a boolean`);
}
function validateServer(item, at) {
	if (!Number.isInteger(item.port) || item.port <= 0 || item.port > 65535) invalid(`${at}.port must be an integer between 1 and 65535`);
	if (item.host !== void 0) {
		if (typeof item.host !== "string") invalid(`${at}.host must be a string`);
		if (!item.host.trim()) invalid(`${at}.host must be a non-empty string when provided`);
		if (item.host !== item.host.trim()) invalid(`${at}.host must not have surrounding whitespace`);
		if (!isValidBindHost(item.host)) invalid(`${at}.host must be a valid TCP bind host`);
	}
	if (item.path !== void 0) {
		if (typeof item.path !== "string") invalid(`${at}.path must be a string`);
		if (item.path !== item.path.trim()) invalid(`${at}.path must not have surrounding whitespace`);
		const pathValue = item.path || "/";
		if (!pathValue.startsWith("/")) invalid(`${at}.path must be empty or start with /`);
		if (pathValue.includes("?") || pathValue.includes("#")) invalid(`${at}.path must not include query or hash`);
		if (new URL(`http://127.0.0.1${pathValue}`).pathname !== pathValue) invalid(`${at}.path must already be a normalized URL pathname`);
	}
}
function validateServerBinding(item, at, bindings) {
	if (item.enabled === false) return;
	const host = typeof item.host === "string" && item.host.trim() ? item.host.trim().toLowerCase() : "0.0.0.0";
	const port = item.port;
	const binding = `${host}:${String(port)}`;
	const exact = bindings.get(binding);
	if (exact) invalid(`${at} conflicts with ${exact} on server binding ${binding}`);
	const wildcardKey = `*:${String(port)}`;
	const previousWildcard = bindings.get(wildcardKey);
	if (previousWildcard) invalid(`${at} conflicts with ${previousWildcard} on wildcard server port ${String(port)}`);
	if (host === "0.0.0.0" || host === "::" || host === "[::]") {
		const previousSamePort = [...bindings.entries()].find(([key]) => key.endsWith(`:${String(port)}`));
		if (previousSamePort) invalid(`${at} conflicts with ${previousSamePort[1]} on wildcard server port ${String(port)}`);
		bindings.set(wildcardKey, at);
	}
	bindings.set(binding, at);
}
function validateClient(item, at, protocols) {
	if (typeof item.url !== "string") invalid(`${at}.url must be a string`);
	if (item.enabled === false) return;
	if (!item.url.trim()) invalid(`${at}.url must be non-empty while the adapter is enabled`);
	let parsed;
	try {
		parsed = new URL(item.url);
	} catch {
		invalid(`${at}.url must be a valid absolute URL`);
	}
	if (!protocols.has(parsed.protocol)) invalid(`${at}.url protocol must be one of ${[...protocols].join(", ")}`);
}
function validateRole(value, at) {
	if (value !== void 0 && value !== "Api" && value !== "Event" && value !== "Universal") invalid(`${at} must be Api, Event, or Universal`);
}
function invalid(message) {
	throw new OneBotConfigValidationError(message);
}
function ensureConfigDir$1() {
	fs$1.mkdirSync(CONFIG_DIR$2, { recursive: true });
}
var PER_UIN_CONFIG = /^onebot_(\d+)\.json$/;
/**
* Remove per-UIN config files whose UIN is not a real QQ account — leftovers
* from the phantom-account bug where the native hook reported a garbage
* (timestamp-shaped) UIN and a `onebot_<garbage>.json` got persisted (issue
* #162). Only files matching `onebot_<digits>.json` are considered, and only
* those failing isRealUin (i.e. 11+ digits) are deleted — legitimate accounts
* are never touched. Returns the deleted file names. Safe to call at startup.
*/
function cleanupInvalidPerUinConfigs() {
	let entries;
	try {
		entries = fs$1.readdirSync(CONFIG_DIR$2);
	} catch {
		return [];
	}
	const removed = [];
	for (const name of entries) {
		const match = PER_UIN_CONFIG.exec(name);
		if (!match || isRealUin(match[1])) continue;
		try {
			fs$1.unlinkSync(path$1.join(CONFIG_DIR$2, name));
			removed.push(name);
			log$7.warn("removed phantom per-UIN config (invalid UIN): %s", name);
		} catch (err) {
			log$7.warn("failed to remove phantom config %s: %s", name, err instanceof Error ? err.message : String(err));
		}
	}
	return removed;
}
function toJsonObject(config, mode) {
	const nets = config.networks;
	return {
		mode,
		networks: {
			httpServers: nets.httpServers.map(httpServerToJson),
			httpClients: nets.httpClients.map(httpClientToJson),
			wsServers: nets.wsServers.map(wsServerToJson),
			wsClients: nets.wsClients.map(wsClientToJson)
		},
		statusCommand: {
			enabled: config.statusCommand.enabled,
			swallow: config.statusCommand.swallow,
			cooldownSeconds: config.statusCommand.cooldownSeconds,
			trigger: config.statusCommand.trigger
		},
		historySync: { enabled: config.historySync.enabled },
		notifications: { channelIds: config.notifications?.channelIds ?? [] }
	};
}
function applyBase(out, n) {
	out.name = n.name;
	if (n.enabled === false) out.enabled = false;
	if (n.accessToken) out.accessToken = n.accessToken;
	out.messageFormat = n.messageFormat;
	out.reportSelfMessage = n.reportSelfMessage;
}
function httpServerToJson(n) {
	const out = {};
	applyBase(out, n);
	out.host = n.host ?? "0.0.0.0";
	out.port = n.port;
	out.path = n.path ?? "/";
	out.enableWebSocket = n.enableWebSocket === true;
	return out;
}
function httpClientToJson(n) {
	const out = {};
	applyBase(out, n);
	out.url = n.url;
	if (typeof n.timeoutMs === "number" && n.timeoutMs > 0) out.timeoutMs = n.timeoutMs;
	return out;
}
function wsServerToJson(n) {
	const out = {};
	applyBase(out, n);
	out.host = n.host ?? "0.0.0.0";
	out.port = n.port;
	out.path = n.path ?? "/";
	out.role = n.role ?? "Universal";
	return out;
}
function wsClientToJson(n) {
	const out = {};
	applyBase(out, n);
	out.url = n.url;
	out.role = n.role ?? "Universal";
	out.reconnectIntervalMs = typeof n.reconnectIntervalMs === "number" && Number.isFinite(n.reconnectIntervalMs) ? Math.max(1e3, Math.trunc(n.reconnectIntervalMs)) : 5e3;
	return out;
}
function fromJson(sources, freshInstall) {
	let legacyFormat;
	let legacyReport;
	for (const src of sources) {
		const mf = parseMessageFormat(src.messageFormat);
		if (mf) legacyFormat = mf;
		if (typeof src.reportSelfMessage === "boolean") legacyReport = src.reportSelfMessage;
	}
	const adapterDefaults = {
		messageFormat: legacyFormat ?? "array",
		reportSelfMessage: legacyReport ?? false
	};
	const httpServers = collectByName(sources, "httpServers", (raw) => parseHttpServer(raw, adapterDefaults));
	const httpClients = collectByName(sources, "httpClients", (raw) => parseHttpClient(raw, adapterDefaults), "httpPostEndpoints");
	const wsServers = collectByName(sources, "wsServers", (raw) => parseWsServer(raw, adapterDefaults));
	const wsClients = collectByName(sources, "wsClients", (raw) => parseWsClient(raw, adapterDefaults));
	if (freshInstall && httpServers.length === 0 && httpClients.length === 0 && wsServers.length === 0 && wsClients.length === 0) {
		const defaults = makeDefaultOneBotConfig().networks;
		httpServers.push(...defaults.httpServers);
		wsServers.push(...defaults.wsServers);
	}
	const config = {
		networks: {
			httpServers,
			httpClients,
			wsServers,
			wsClients
		},
		statusCommand: parseStatusCommand(sources),
		historySync: parseHistorySync(sources),
		notifications: parseNotifications(sources)
	};
	assertValidOneBotConfig(config);
	return config;
}
function parseHistorySync(sources) {
	let enabled = false;
	for (const source of sources) {
		if (!Object.prototype.hasOwnProperty.call(source, "historySync")) continue;
		const raw = source.historySync;
		if (!isObject$2(raw)) invalid("historySync must be an object");
		rejectUnknownKeys(raw, /* @__PURE__ */ new Set(["enabled"]), "historySync");
		if (typeof raw.enabled !== "boolean") invalid("historySync.enabled must be a boolean");
		enabled = raw.enabled;
	}
	return { enabled };
}
/** Last-write-wins merge of `notifications.channelIds` across config sources,
*  each id validated as a slug + deduped. Mirrors the channel-id rule in
*  packages/core/src/notifications/config.ts (CHANNEL_ID_RE) — duplicated
*  deliberately: core depends on onebot, so onebot cannot import from core. */
function parseNotifications(sources) {
	let channelIds = [];
	for (const src of sources) {
		const raw = src.notifications;
		if (!isObject$2(raw)) continue;
		if (Array.isArray(raw.channelIds)) channelIds = normalizeChannelIds(raw.channelIds);
	}
	return { channelIds };
}
function normalizeChannelIds(value) {
	if (!Array.isArray(value)) return [];
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const item of value) {
		if (typeof item !== "string") continue;
		const v = item.trim();
		if (!v || v.length > 64 || !/^[\w.-]+$/.test(v)) continue;
		if (seen.has(v)) continue;
		seen.add(v);
		out.push(v);
	}
	return out;
}
/** Last-write-wins merge of `statusCommand` across config sources, with
*  defaults filled and the cooldown clamped to a sane non-negative range. */
function parseStatusCommand(sources) {
	const out = makeDefaultStatusCommand();
	for (const src of sources) {
		const raw = src.statusCommand;
		if (!isObject$2(raw)) continue;
		if (typeof raw.enabled === "boolean") out.enabled = raw.enabled;
		if (typeof raw.swallow === "boolean") out.swallow = raw.swallow;
		if (raw.cooldownSeconds !== void 0) out.cooldownSeconds = Math.min(STATUS_COMMAND_COOLDOWN_MAX, asNumber(raw.cooldownSeconds, DEFAULT_STATUS_COMMAND.cooldownSeconds));
		if (typeof raw.trigger === "string" && raw.trigger.trim().length > 0 && !/[\r\n]/.test(raw.trigger)) out.trigger = raw.trigger.trim().slice(0, 32);
	}
	return out;
}
function collectByName(sources, kind, parse, legacyKey) {
	const byName = /* @__PURE__ */ new Map();
	const order = [];
	let counter = 0;
	const ingest = (rawArr) => {
		if (!Array.isArray(rawArr)) return;
		for (const raw of rawArr) {
			if (!isObject$2(raw)) continue;
			const parsed = parse(raw);
			if (!parsed) continue;
			const name = parsed.name && parsed.name.trim() ? parsed.name.trim() : pickAutoName(kind, byName, ++counter);
			parsed.name = name;
			if (!byName.has(name)) order.push(name);
			byName.set(name, parsed);
		}
	};
	for (const src of sources) {
		ingest(isObject$2(src.networks) ? src.networks[kind] : void 0);
		if (legacyKey) ingest(src[legacyKey]);
		ingest(src[kind]);
	}
	return order.map((n) => byName.get(n));
}
function pickAutoName(kind, used, counter) {
	const prefix = kind === "httpServers" ? "http" : kind === "httpClients" ? "httppost" : kind === "wsServers" ? "ws" : "wsclient";
	let candidate = `${prefix}-${counter}`;
	while (used.has(candidate)) {
		counter += 1;
		candidate = `${prefix}-${counter}`;
	}
	return candidate;
}
function parseBase(value, defaults) {
	return {
		name: asString(value.name),
		enabled: typeof value.enabled === "boolean" ? value.enabled : void 0,
		accessToken: asString(value.accessToken) || void 0,
		messageFormat: parseMessageFormat(value.messageFormat) ?? defaults.messageFormat,
		reportSelfMessage: typeof value.reportSelfMessage === "boolean" ? value.reportSelfMessage : defaults.reportSelfMessage
	};
}
function parseHttpServer(value, defaults) {
	if (value.enableWebSocket !== void 0 && typeof value.enableWebSocket !== "boolean") invalid("http server enableWebSocket must be a boolean");
	const port = asNumber(value.port, 0);
	if (port <= 0) return null;
	return clean({
		...parseBase(value, defaults),
		host: asString(value.host, "0.0.0.0"),
		port,
		path: asString(value.path, "/"),
		enableWebSocket: value.enableWebSocket === true
	});
}
function parseHttpClient(value, defaults) {
	const url = asString(value.url);
	const base = parseBase(value, defaults);
	if (!url && base.enabled !== false) return null;
	const timeout = asNumber(value.timeoutMs, 0);
	return clean({
		...base,
		url,
		timeoutMs: timeout > 0 ? timeout : void 0
	});
}
function parseWsServer(value, defaults) {
	const port = asNumber(value.port, 0);
	if (port <= 0) return null;
	return clean({
		...parseBase(value, defaults),
		host: asString(value.host, "0.0.0.0"),
		port,
		path: asString(value.path, "/"),
		role: asRole(value.role, "Universal")
	});
}
function parseWsClient(value, defaults) {
	const url = asString(value.url);
	const base = parseBase(value, defaults);
	if (!url && base.enabled !== false) return null;
	const reconnectIntervalMs = asNumber(value.reconnectIntervalMs, 5e3);
	return clean({
		...base,
		url,
		role: asRole(value.role, "Universal"),
		reconnectIntervalMs: Math.max(1e3, reconnectIntervalMs)
	});
}
function hasLegacyTopLevel(raw) {
	return Array.isArray(raw.httpServers) || Array.isArray(raw.httpPostEndpoints) || Array.isArray(raw.wsServers) || Array.isArray(raw.wsClients) || typeof raw.messageFormat === "string" || typeof raw.reportSelfMessage === "boolean";
}
function parseMessageFormat(value) {
	if (value === "array" || value === "string") return value;
}
function clean(obj) {
	for (const key of Object.keys(obj)) if (obj[key] === void 0) delete obj[key];
	return obj;
}
function asRole(value, fallback) {
	const text = asString(value, fallback).toLowerCase();
	if (text === "api") return "Api";
	if (text === "event") return "Event";
	if (text === "universal") return "Universal";
	return fallback;
}
function asString(value, fallback = "") {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return fallback;
}
function asNumber(value, fallback = 0) {
	if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
	if (typeof value === "string" && value.trim()) {
		const n = Number(value);
		if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
	}
	return fallback;
}
function tryLoadJson(filePath, failOnCorrupt = false) {
	if (!fs$1.existsSync(filePath)) return null;
	try {
		const raw = fs$1.readFileSync(filePath, "utf8");
		const parsed = JSON.parse(raw);
		if (!isObject$2(parsed)) throw new Error("configuration root must be an object");
		return parsed;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (failOnCorrupt) throw new Error(`config file ${filePath} is corrupt: ${message}`, { cause: err });
		log$7.warn("config file %s is corrupt and will be ignored: %s", filePath, message);
		return null;
	}
}
function saveJson(filePath, json) {
	const dir = path$1.dirname(filePath);
	fs$1.mkdirSync(dir, { recursive: true });
	const tempPath = path$1.join(dir, `.${path$1.basename(filePath)}.${String(process.pid)}.${randomBytes(6).toString("hex")}.tmp`);
	let fd = null;
	try {
		fd = fs$1.openSync(tempPath, "wx", 384);
		fs$1.writeFileSync(fd, JSON.stringify(json, null, 2), "utf8");
		fs$1.fsyncSync(fd);
		fs$1.closeSync(fd);
		fd = null;
		fs$1.renameSync(tempPath, filePath);
	} catch (error) {
		if (fd !== null) try {
			fs$1.closeSync(fd);
		} catch {}
		try {
			fs$1.unlinkSync(tempPath);
		} catch {}
		throw error;
	}
}
function isObject$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isValidBindHost(value) {
	if (!value || value.length > 253 || /[\s/?#@]/u.test(value)) return false;
	if (value.includes(":")) return isIP(value) === 6;
	if (/^[\d.]+$/.test(value)) return isIP(value) === 4;
	return (value.endsWith(".") ? value.slice(0, -1) : value).split(".").every((label) => /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/.test(label));
}
//#endregion
//#region ../onebot/src/global-config.ts
var log$6 = createLogger("OneBot.GlobalConfig");
var CONFIG_DIR$1 = "config";
var GLOBAL_CONFIG_PATH = path$1.join(CONFIG_DIR$1, "snowluma.json");
function defaultGlobalSettings() {
	return {
		rkey: { fallbackServers: [] },
		musicSignUrl: ""
	};
}
/** Keep only well-formed, deduped http(s) URLs (must parse + have a host). */
function normalizeRkeyServers(value) {
	if (!Array.isArray(value)) return [];
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const item of value) {
		if (typeof item !== "string") continue;
		const v = item.trim();
		if (!v || !isHttpUrl$1(v) || seen.has(v)) continue;
		seen.add(v);
		out.push(v);
	}
	return out;
}
function isHttpUrl$1(value) {
	try {
		const u = new URL(value);
		return (u.protocol === "http:" || u.protocol === "https:") && u.host.length > 0;
	} catch {
		return false;
	}
}
function normalizeGlobalSettings(value) {
	const out = defaultGlobalSettings();
	if (!isObject$1(value)) return out;
	const rkey = value.rkey;
	if (isObject$1(rkey)) out.rkey.fallbackServers = normalizeRkeyServers(rkey.fallbackServers);
	if (typeof value.musicSignUrl === "string") {
		const v = value.musicSignUrl.trim();
		out.musicSignUrl = v && isHttpUrl$1(v) ? v : "";
	}
	return out;
}
function loadGlobalSettings() {
	if (!fs$1.existsSync(GLOBAL_CONFIG_PATH)) return defaultGlobalSettings();
	try {
		const raw = fs$1.readFileSync(GLOBAL_CONFIG_PATH, "utf8");
		return normalizeGlobalSettings(JSON.parse(raw));
	} catch (err) {
		log$6.warn("config/snowluma.json is corrupt and will be ignored: %s", err instanceof Error ? err.message : String(err));
		return defaultGlobalSettings();
	}
}
/**
* Persist global settings, SECTION-MERGING over what's on disk: only the
* top-level sections actually present in `incoming` are overwritten, so a
* partial save (e.g. just `rkey`) never wipes a sibling knob. Mirrors
* saveNotificationsConfig's merge discipline.
*/
function saveGlobalSettings(incoming) {
	const merged = loadGlobalSettings();
	if (isObject$1(incoming)) {
		if (isObject$1(incoming.rkey)) merged.rkey.fallbackServers = normalizeRkeyServers(incoming.rkey.fallbackServers);
		if (typeof incoming.musicSignUrl === "string") {
			const v = incoming.musicSignUrl.trim();
			merged.musicSignUrl = v && isHttpUrl$1(v) ? v : "";
		}
	}
	fs$1.mkdirSync(CONFIG_DIR$1, { recursive: true });
	const tmp = GLOBAL_CONFIG_PATH + ".tmp";
	fs$1.writeFileSync(tmp, JSON.stringify(toJson(merged), null, 2), "utf8");
	fs$1.renameSync(tmp, GLOBAL_CONFIG_PATH);
	return merged;
}
function toJson(settings) {
	return {
		rkey: { fallbackServers: settings.rkey.fallbackServers },
		musicSignUrl: settings.musicSignUrl
	};
}
function isObject$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* One-shot copy-up: `musicSignUrl` used to live in per-UIN config. If the global
* store has none yet, lift the first non-empty value found in any legacy
* `config/onebot*.json` into `config/snowluma.json`. Idempotent — skips once the
* global value is set. (If an operator later clears the global value while a
* stale per-UIN value lingers, a restart would re-copy it; benign and rare.)
*/
function migrateGlobalSettings() {
	if (globalConfigHasMusicSignUrlKey()) return;
	const found = scanLegacyMusicSignUrl();
	if (!found) return;
	saveGlobalSettings({ musicSignUrl: found.value });
	const extra = found.others.length ? `; ignored differing value(s) in ${found.others.join(", ")}` : "";
	log$6.info("migrated musicSignUrl to global config from %s: %s%s", found.source, found.value, extra);
}
function globalConfigHasMusicSignUrlKey() {
	if (!fs$1.existsSync(GLOBAL_CONFIG_PATH)) return false;
	try {
		const raw = JSON.parse(fs$1.readFileSync(GLOBAL_CONFIG_PATH, "utf8"));
		return isObject$1(raw) && "musicSignUrl" in raw;
	} catch {
		return false;
	}
}
/** Scan config/onebot.json + config/onebot_<uin>.json for a non-empty
*  musicSignUrl. Returns the first found plus any other files that carried a
*  (differing) value, for logging. */
function scanLegacyMusicSignUrl() {
	let dir;
	try {
		dir = fs$1.readdirSync(CONFIG_DIR$1);
	} catch {
		return null;
	}
	const files = dir.filter((f) => f === "onebot.json" || /^onebot_\d+\.json$/.test(f)).sort();
	let first = null;
	const others = [];
	for (const file of files) {
		let value;
		try {
			const raw = JSON.parse(fs$1.readFileSync(path$1.join(CONFIG_DIR$1, file), "utf8"));
			value = isObject$1(raw) ? raw.musicSignUrl : void 0;
		} catch {
			continue;
		}
		if (typeof value !== "string") continue;
		const v = value.trim();
		if (!v || !isHttpUrl$1(v)) continue;
		if (!first) first = {
			value: v,
			source: file
		};
		else if (v !== first.value) others.push(file);
	}
	return first ? {
		...first,
		others
	} : null;
}
//#endregion
//#region ../onebot/src/types.ts
/** True only when a stored sequence can safely be sent back to QQ. */
function hasAuthoritativeSequence(meta) {
	return meta?.sequenceAuthoritative === true && Number.isInteger(meta.sequence) && meta.sequence > 0;
}
var RETCODE = {
	ACTION_FAILED: 100,
	INTERNAL_ERROR: 1200,
	BAD_REQUEST: 1400,
	UNKNOWN_ACTION: 1404
};
function okResponse(data = null) {
	return {
		status: "ok",
		retcode: 0,
		data
	};
}
function failedResponse(retcode, wording) {
	return {
		status: "failed",
		retcode,
		data: null,
		wording
	};
}
//#endregion
//#region ../onebot/src/streaming.ts
/** Marks an OB11 envelope as one frame of a streaming response. */
var STREAM_MARK = "stream-action";
/** Frame `type` discriminator carried inside each frame's `data`. */
var StreamStatus = /* @__PURE__ */ function(StreamStatus) {
	/** An intermediate chunk frame (transfer in progress). */
	StreamStatus["Stream"] = "stream";
	/** The terminal frame — the stream finished successfully. */
	StreamStatus["Response"] = "response";
	/** A stream was reset / aborted by the caller. */
	StreamStatus["Reset"] = "reset";
	/** The terminal frame — the stream failed. */
	StreamStatus["Error"] = "error";
	return StreamStatus;
}({});
var StreamTransportClosedError = class extends Error {
	constructor(message = "stream transport closed") {
		super(message);
		this.name = "StreamTransportClosedError";
	}
};
/** Fallback sink for when a stream action is invoked over a transport that
*  can't stream (or by a plain client): intermediate frames are dropped, the
*  terminal response is still returned normally. */
var NOOP_SINK = { send: async () => {} };
/** Wrap a raw stream-frame `data` payload into an OB11 envelope carrying the
*  stream marker (mirrors NapCat's `OB11Response.ok(data, echo, true)`). The
*  empty `message`/`wording` pair matches NapCat — clients reading either key
*  on an intermediate frame get `''`, never `undefined`. */
function wrapStreamFrame(data, echo) {
	const frame = {
		status: "ok",
		retcode: 0,
		data,
		message: "",
		wording: "",
		stream: STREAM_MARK
	};
	if (echo !== void 0) frame.echo = echo;
	return frame;
}
/** Turn an action's terminal `ApiResponse` into the final streaming frame:
*  attach the stream marker + echo, mirror `wording` into `message` (NapCat
*  sets both), and — on failure — normalise `data` to an error packet
*  (`{ type:'error' }`) so NapCat clients see the error `type` while the
*  human-readable reason stays in `message`/`wording`.
*
*  Contract: on success the action's `data` MUST carry `type:'response'` (the
*  client treats that frame as the stream terminator). Stream actions are
*  responsible for that, mirroring NapCat's `BaseDownloadStream`. */
function wrapStreamTerminal(response, echo) {
	const frame = {
		...response,
		stream: STREAM_MARK
	};
	if (echo !== void 0) frame.echo = echo;
	if (response.status === "failed") frame.data = {
		type: "error",
		data_type: "error"
	};
	frame.message = frame.wording ?? "";
	if (frame.wording === void 0) frame.wording = "";
	return frame;
}
//#endregion
//#region ../onebot/src/action-kit.ts
var ok = (value) => ({
	ok: true,
	value
});
var err = (field, reason) => ({
	ok: false,
	field,
	reason
});
/** Only an absent key produces MISSING — this is what lets a present `0` /
*  `''` / `false` be distinguished from "not provided". */
var MISSING = Symbol("missing");
var FieldImpl = class FieldImpl {
	core;
	doc;
	constructor(core, doc) {
		this.core = core;
		this.doc = doc;
	}
	coerce(raw, field) {
		if (raw === MISSING) {
			if (this.doc.required) return err(field, "is required");
			return ok(this.doc.default);
		}
		return this.core(raw, field);
	}
	optional() {
		return new FieldImpl(this.core, {
			...this.doc,
			required: false,
			default: void 0
		});
	}
	default(value) {
		return new FieldImpl(this.core, {
			...this.doc,
			required: false,
			default: value
		});
	}
	describe(text) {
		return new FieldImpl(this.core, {
			...this.doc,
			desc: text
		});
	}
	role(role) {
		return new FieldImpl(this.core, {
			...this.doc,
			role
		});
	}
	toJsonSchema() {
		const out = { ...this.doc.schema ?? {} };
		if (this.doc.desc) out.description = this.doc.desc;
		if (this.doc.default !== void 0) out.default = this.doc.default;
		if (this.doc.role) out["x-role"] = this.doc.role;
		return out;
	}
};
/** Accept a number or numeric string, truncate to integer (matches the legacy
*  `asNumber`), then apply bounds. Non-numeric / blank ⇒ Err. */
function intCore(typeName, opts) {
	return (raw, field) => {
		let n;
		if (typeof raw === "number" && Number.isFinite(raw)) n = Math.trunc(raw);
		else if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) n = Math.trunc(Number(raw));
		else return err(field, `expected ${typeName}`);
		if (opts.nonZero && n === 0) return err(field, "must not be 0");
		if (opts.min !== void 0 && n < opts.min) return err(field, `must be >= ${opts.min}`);
		if (opts.max !== void 0 && n > opts.max) return err(field, `must be <= ${opts.max}`);
		return ok(n);
	};
}
function intSchema(opts) {
	const s = { type: "integer" };
	if (opts.min !== void 0) s.minimum = opts.min;
	if (opts.max !== void 0) s.maximum = opts.max;
	if (opts.nonZero) s.not = { const: 0 };
	return s;
}
function strSchema(opts) {
	const s = { type: "string" };
	if (opts.allowEmpty === false) s.minLength = 1;
	if (opts.maxLen !== void 0) s.maxLength = opts.maxLen;
	return s;
}
/** Coerce to string (numbers/booleans stringify; matches legacy `asString`),
*  then apply emptiness / length bounds. Shared by `f.string()` and the
*  string-valued semantic constructors. */
function stringCore(opts) {
	return (raw, field) => {
		let s;
		if (typeof raw === "string") s = raw;
		else if (typeof raw === "number" || typeof raw === "boolean") s = String(raw);
		else return err(field, "expected a string");
		if (opts.allowEmpty === false && s === "") return err(field, "must not be empty");
		if (opts.maxLen !== void 0 && s.length > opts.maxLen) return err(field, `must be <= ${opts.maxLen} chars`);
		return ok(s);
	};
}
function arrayField(el, mustBeNonEmpty) {
	const core = (raw, field) => {
		if (!Array.isArray(raw)) return err(field, "expected an array");
		const out = [];
		for (let i = 0; i < raw.length; i++) {
			const r = el.coerce(raw[i], `${field}[${i}]`);
			if (!r.ok) return r;
			out.push(r.value);
		}
		if (mustBeNonEmpty && out.length === 0) return err(field, "must not be empty");
		return ok(out);
	};
	const base = new FieldImpl(core, {
		type: `${el.doc.type}[]`,
		required: true,
		schema: {
			type: "array",
			items: el.toJsonSchema(),
			...mustBeNonEmpty ? { minItems: 1 } : {}
		}
	});
	return Object.assign(base, { nonEmpty: () => arrayField(el, true) });
}
var f = {
	/** Positive integer (>0): group_id / user_id / message_id. */
	uint() {
		return new FieldImpl(intCore("a positive integer", { min: 1 }), {
			type: "uint",
			required: true,
			schema: intSchema({ min: 1 })
		});
	},
	/** Integer with optional bounds; allows 0 / negatives unless bounded.
	*  e.g. a duration where 0 is meaningful: `f.int({ min: 0 })`. */
	int(opts = {}) {
		return new FieldImpl(intCore("an integer", opts), {
			type: "int",
			required: true,
			schema: intSchema(opts)
		});
	},
	/** OneBot message id: a non-zero integer. NEGATIVES ARE VALID (ids are a
	*  signed int32 hash) — do NOT use `uint()` for message_id. */
	messageId() {
		return new FieldImpl(intCore("a message id", { nonZero: true }), {
			type: "messageId",
			required: true,
			role: "message_id",
			schema: intSchema({ nonZero: true })
		});
	},
	/** Group number (uint) → group picker. */
	groupId() {
		return new FieldImpl(intCore("a positive integer", { min: 1 }), {
			type: "uint",
			required: true,
			role: "group_id",
			schema: intSchema({ min: 1 })
		});
	},
	/** Friend / stranger uin (uint) → friend picker. */
	userId() {
		return new FieldImpl(intCore("a positive integer", { min: 1 }), {
			type: "uint",
			required: true,
			role: "user_id",
			schema: intSchema({ min: 1 })
		});
	},
	/** Group member's uin (uint) → member picker, linked to a sibling group_id. */
	memberId() {
		return new FieldImpl(intCore("a positive integer", { min: 1 }), {
			type: "uint",
			required: true,
			role: "member_id",
			schema: intSchema({ min: 1 })
		});
	},
	/** Opaque file id (string) → file picker / history. */
	fileId() {
		return new FieldImpl(stringCore({ allowEmpty: false }), {
			type: "string",
			required: true,
			role: "file_id",
			schema: strSchema({ allowEmpty: false })
		});
	},
	/** Local path / URL / base64 of a generic file → FileSource control. */
	file() {
		return new FieldImpl(stringCore({ allowEmpty: false }), {
			type: "string",
			required: true,
			role: "file",
			schema: strSchema({ allowEmpty: false })
		});
	},
	/** Image source (path / URL / base64) → FileSource control. */
	image() {
		return new FieldImpl(stringCore({ allowEmpty: false }), {
			type: "string",
			required: true,
			role: "image",
			schema: strSchema({ allowEmpty: false })
		});
	},
	/** Voice/record source → FileSource control. */
	record() {
		return new FieldImpl(stringCore({ allowEmpty: false }), {
			type: "string",
			required: true,
			role: "record",
			schema: strSchema({ allowEmpty: false })
		});
	},
	/** Video source → FileSource control. */
	video() {
		return new FieldImpl(stringCore({ allowEmpty: false }), {
			type: "string",
			required: true,
			role: "video",
			schema: strSchema({ allowEmpty: false })
		});
	},
	/** Seconds (int ≥ 0) → duration control. */
	duration() {
		return new FieldImpl(intCore("an integer", { min: 0 }), {
			type: "int",
			required: true,
			role: "duration",
			schema: intSchema({ min: 0 })
		});
	},
	/** Unix timestamp (int ≥ 0) → datetime control. */
	timestamp() {
		return new FieldImpl(intCore("an integer", { min: 0 }), {
			type: "int",
			required: true,
			role: "timestamp",
			schema: intSchema({ min: 0 })
		});
	},
	/** QQ face id (non-negative int; face 0 is valid) → face grid. */
	faceId() {
		return new FieldImpl(intCore("a non-negative integer", { min: 0 }), {
			type: "int",
			required: true,
			role: "face_id",
			schema: intSchema({ min: 0 })
		});
	},
	/** Finite number (fractions allowed). */
	number() {
		return new FieldImpl((raw, field) => {
			if (typeof raw === "number" && Number.isFinite(raw)) return ok(raw);
			if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return ok(Number(raw));
			return err(field, "expected a number");
		}, {
			type: "number",
			required: true,
			schema: { type: "number" }
		});
	},
	/** String. Numbers/booleans stringify (matches legacy `asString`). Empty
	*  allowed by default; `{ allowEmpty: false }` rejects ''. */
	string(opts = {}) {
		return new FieldImpl(stringCore(opts), {
			type: "string",
			required: true,
			schema: strSchema(opts)
		});
	},
	/** true/1/yes/on ⇒ true; false/0/no/off ⇒ false (matches legacy `asBoolean`). */
	bool() {
		return new FieldImpl((raw, field) => {
			if (typeof raw === "boolean") return ok(raw);
			if (typeof raw === "number") return ok(raw !== 0);
			if (typeof raw === "string") {
				const t = raw.trim().toLowerCase();
				if (t === "true" || t === "1" || t === "yes" || t === "on") return ok(true);
				if (t === "false" || t === "0" || t === "no" || t === "off") return ok(false);
			}
			return err(field, "expected a boolean");
		}, {
			type: "bool",
			required: true,
			schema: { type: "boolean" }
		});
	},
	/** OneBot message union: string | segment[] | object. A string that looks
	*  like a JSON array is parsed (matches legacy `asMessage`); otherwise the
	*  value passes through. Output stays `JsonValue` — downstream ctx.* accept it. */
	message() {
		return new FieldImpl((raw, _field) => {
			if (typeof raw === "string") {
				const t = raw.trim();
				if (t.startsWith("[") && t.endsWith("]")) try {
					const parsed = JSON.parse(t);
					if (Array.isArray(parsed)) return ok(parsed);
				} catch {}
			}
			return ok(raw);
		}, {
			type: "message",
			required: true,
			schema: { description: "OneBot message: string | segment[] | object. In segment arrays, text segments whose text field is exactly \"\" are compatibility placeholders and do not count as sendable segments; missing, null, and whitespace-only text remain subject to normal validation." }
		});
	},
	/** Homogeneous array; `.nonEmpty()` rejects []. */
	array(el) {
		return arrayField(el, false);
	},
	/** Constrained literal set. */
	enum(...values) {
		return new FieldImpl((raw, field) => {
			if ((typeof raw === "string" || typeof raw === "number") && values.includes(raw)) return ok(raw);
			return err(field, `expected one of: ${values.join(", ")}`);
		}, {
			type: "enum",
			required: true,
			values,
			schema: { enum: [...values] }
		});
	},
	/** Escape hatch — pass the raw value (or undefined) through, validate nothing. */
	raw() {
		return new FieldImpl((raw) => ok(raw), {
			type: "raw",
			required: false,
			default: void 0,
			schema: {}
		});
	}
};
var present = (p, key) => p[key] !== void 0;
var groupOk = (p, g) => Array.isArray(g) ? g.every((k) => present(p, k)) : present(p, g);
var groupLabel = (g) => Array.isArray(g) ? `(${g.join("+")})` : g;
var RULES = {
	exactlyOneOf(...groups) {
		const doc = `exactly one of: ${groups.map(groupLabel).join(" | ")}`;
		return {
			doc,
			check: (p) => groups.filter((g) => groupOk(p, g)).length === 1 ? null : err("", doc)
		};
	},
	atLeastOneOf(...keys) {
		const doc = `at least one of: ${keys.join(", ")}`;
		return {
			doc,
			check: (p) => keys.some((k) => present(p, k)) ? null : err("", doc)
		};
	},
	requiredTogether(...keys) {
		const doc = `all or none of: ${keys.join(", ")}`;
		return {
			doc,
			check: (p) => {
				const n = keys.filter((k) => present(p, k)).length;
				return n === 0 || n === keys.length ? null : err("", doc);
			}
		};
	},
	mutuallyExclusive(...keys) {
		const doc = `at most one of: ${keys.join(", ")}`;
		return {
			doc,
			check: (p) => keys.filter((k) => present(p, k)).length <= 1 ? null : err("", doc)
		};
	},
	rule(doc, okFn) {
		return {
			doc,
			check: (p) => okFn(p) ? null : err("", doc)
		};
	}
};
var wording = (e) => e.field ? `${e.field}: ${e.reason}` : e.reason;
function defineAction(def) {
	const names = Object.freeze(typeof def.name === "string" ? [def.name] : [...def.name]);
	const rules = def.rules ? def.rules(RULES) : [];
	const parse = (raw) => {
		const out = {};
		for (const key of Object.keys(def.params)) {
			const field = def.params[key];
			const value = Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : MISSING;
			const r = field.coerce(value, key);
			if (!r.ok) return r;
			out[key] = r.value;
		}
		for (const rule of rules) {
			const e = rule.check(out);
			if (e) return e;
		}
		return ok(out);
	};
	const toHandler = (ctx) => async (params) => {
		const r = parse(params);
		if (!r.ok) return failedResponse(RETCODE.BAD_REQUEST, wording(r));
		return def.run(r.value, ctx);
	};
	return {
		kind: "normal",
		names,
		params: def.params,
		parse,
		toHandler,
		describe: () => {
			const entries = Object.entries(def.params);
			const properties = {};
			const required = [];
			for (const [name, field] of entries) {
				properties[name] = field.toJsonSchema();
				if (field.doc.required) required.push(name);
			}
			const inputSchema = {
				type: "object",
				properties,
				...required.length ? { required } : {},
				additionalProperties: true
			};
			return {
				name: names[0],
				aliases: names.slice(1),
				summary: def.summary,
				returns: def.returns,
				returnsSchema: def.returnsSchema,
				readOnly: def.readOnly ?? false,
				params: entries.map(([name, field]) => ({
					name,
					...field.doc
				})),
				invariants: rules.map((rule) => rule.doc),
				inputSchema
			};
		}
	};
}
function defineStreamAction(def) {
	const base = defineAction({
		name: def.name,
		summary: def.summary,
		returns: def.returns,
		returnsSchema: def.returnsSchema,
		readOnly: def.readOnly,
		params: def.params,
		rules: def.rules,
		run: () => failedResponse(RETCODE.INTERNAL_ERROR, "stream action dispatched without a sink")
	});
	const toHandler = (ctx) => async (params, sink) => {
		const r = base.parse(params);
		if (!r.ok) return failedResponse(RETCODE.BAD_REQUEST, wording(r));
		return def.run(r.value, ctx, sink ?? NOOP_SINK);
	};
	return {
		kind: "stream",
		names: base.names,
		params: def.params,
		parse: base.parse,
		toHandler,
		describe: () => ({
			...base.describe(),
			stream: true
		})
	};
}
/** Pre-seeds `group_id` (uint, required). */
function groupAction(def) {
	const params = {
		group_id: f.groupId().describe("群号"),
		...def.params ?? {}
	};
	return defineAction({
		...def,
		params
	});
}
/** Pre-seeds `group_id` + `user_id` (both uint, required). */
function groupUserAction(def) {
	const params = {
		group_id: f.groupId().describe("群号"),
		user_id: f.memberId().describe("QQ 号"),
		...def.params ?? {}
	};
	return defineAction({
		...def,
		params
	});
}
//#endregion
//#region ../onebot/src/actions/info.ts
var appVersion = "1.14.19";
var actions$12 = [
	defineAction({
		name: "get_login_info",
		readOnly: true,
		returns: "当前登录账号的 QQ 号与昵称。",
		returnsSchema: {
			type: "object",
			properties: {
				user_id: {
					type: "integer",
					description: "登录 QQ 号"
				},
				nickname: {
					type: "string",
					description: "登录昵称"
				}
			},
			required: ["user_id", "nickname"]
		},
		params: {},
		run: (_p, ctx) => {
			const login = ctx.getLoginInfo();
			return okResponse({
				user_id: login.userId,
				nickname: login.nickname
			});
		}
	}),
	defineAction({
		name: "get_status",
		readOnly: true,
		returns: "运行状态。`online` 表示账号在线；`good` 表示已确认的收发链路健康状态。",
		returnsSchema: {
			type: "object",
			properties: {
				online: {
					type: "boolean",
					description: "是否在线"
				},
				good: {
					type: "boolean",
					description: "收发链路健康状态；确认接收停滞或主动请求连接失效时为 false"
				}
			},
			required: ["online", "good"]
		},
		params: {},
		run: (_p, ctx) => {
			const online = ctx.isOnline();
			return okResponse({
				online,
				good: online && ctx.bridge.receiveHealthy
			});
		}
	}),
	defineAction({
		name: "get_version_info",
		readOnly: true,
		returns: "实现与协议版本信息。",
		returnsSchema: {
			type: "object",
			properties: {
				app_name: {
					type: "string",
					description: "实现名称（SnowLuma）"
				},
				app_version: {
					type: "string",
					description: "实现版本"
				},
				protocol_version: {
					type: "string",
					description: "OneBot 协议版本"
				}
			},
			required: [
				"app_name",
				"app_version",
				"protocol_version"
			]
		},
		params: {},
		run: () => {
			return okResponse({
				app_name: "SnowLuma",
				app_version: `${appVersion}-node`,
				protocol_version: "v11"
			});
		}
	}),
	defineAction({
		name: "can_send_image",
		readOnly: true,
		returns: "能力查询结果。",
		returnsSchema: {
			type: "object",
			properties: { yes: {
				type: "boolean",
				description: "是否支持发送图片"
			} },
			required: ["yes"]
		},
		params: {},
		run: (_p, ctx) => {
			return okResponse({ yes: ctx.canSendImage?.() ?? false });
		}
	}),
	defineAction({
		name: "can_send_record",
		readOnly: true,
		returns: "能力查询结果。",
		returnsSchema: {
			type: "object",
			properties: { yes: {
				type: "boolean",
				description: "是否支持发送语音"
			} },
			required: ["yes"]
		},
		params: {},
		run: (_p, ctx) => {
			return okResponse({ yes: ctx.canSendRecord?.() ?? false });
		}
	})
];
//#endregion
//#region ../onebot/src/actions/message.ts
/** send_msg only (#426). Some clients send `group_id: ""` on private chats.
*  Treat that exact empty string as absent. Do not change `f.groupId()`. */
function sendMsgOptionalGroupId() {
	const inner = f.groupId().optional();
	return Object.assign(Object.create(inner), { coerce(raw, field) {
		if (raw === "") return {
			ok: true,
			value: void 0
		};
		return inner.coerce(raw, field);
	} });
}
var log$5 = createLogger("OneBot");
/**
* Re-sign image URLs in a stored message event at read time. `get_msg`
* returns a copy persisted when the message first arrived, and image rkeys
* expire — so walk the segment array and refresh each image URL through
* `ctx.getImageInfo`, which mints a current rkey. Best-effort and in-place;
* `findEvent` returns a fresh parse, so mutating the array is safe.
*/
async function refreshStoredImageUrls(event, ctx) {
	const segments = event.message;
	if (!Array.isArray(segments)) return;
	for (const seg of segments) {
		if (!seg || typeof seg !== "object") continue;
		const segment = seg;
		if (segment.type !== "image") continue;
		const data = segment.data;
		if (!data || typeof data !== "object") continue;
		const file = typeof data.file === "string" ? data.file : typeof data.file_id === "string" ? data.file_id : "";
		if (!file) continue;
		try {
			const info = await ctx.getImageInfo(file);
			if (info && typeof info.url === "string" && info.url) data.url = info.url;
		} catch {}
	}
}
var actions$11 = [
	defineAction({
		name: "send_msg",
		summary: "发送消息（按 message_type/群号 自动路由群聊或私聊）",
		returns: "{ message_id: number }",
		params: {
			message: f.message(),
			message_type: f.string().optional(),
			group_id: sendMsgOptionalGroupId(),
			user_id: f.userId().optional(),
			auto_escape: f.bool().default(false)
		},
		run: async (p, ctx) => {
			const isTempReply = p.message_type === "private" && p.user_id !== void 0 && p.group_id !== void 0;
			if (!isTempReply && (p.message_type === "group" || p.group_id !== void 0)) {
				if (p.group_id === void 0) return failedResponse(RETCODE.BAD_REQUEST, "group_id is required");
				return okResponse({ message_id: (await ctx.sendGroupMessage(p.group_id, p.message, p.auto_escape)).messageId });
			}
			if (p.user_id === void 0) return failedResponse(RETCODE.BAD_REQUEST, "user_id is required");
			return okResponse({ message_id: (await ctx.sendPrivateMessage(p.user_id, p.message, p.auto_escape, isTempReply ? p.group_id : void 0)).messageId });
		}
	}),
	defineAction({
		name: "send_private_msg",
		summary: "发送私聊消息",
		returns: "{ message_id: number }",
		params: {
			user_id: f.userId(),
			message: f.message(),
			group_id: f.int({ min: 0 }).optional(),
			auto_escape: f.bool().default(false)
		},
		run: async (p, ctx) => {
			const tempGroupId = p.group_id && p.group_id > 0 ? p.group_id : void 0;
			return okResponse({ message_id: (await ctx.sendPrivateMessage(p.user_id, p.message, p.auto_escape, tempGroupId)).messageId });
		}
	}),
	groupAction({
		name: "send_group_msg",
		summary: "发送群消息",
		returns: "{ message_id: number }",
		params: {
			message: f.message(),
			auto_escape: f.bool().default(false)
		},
		run: async (p, ctx) => {
			return okResponse({ message_id: (await ctx.sendGroupMessage(p.group_id, p.message, p.auto_escape)).messageId });
		}
	}),
	defineAction({
		name: "get_msg",
		summary: "获取消息",
		readOnly: true,
		returns: "消息事件对象（首次收到时存储的副本，已去除 post_type/self_id、附带 real_id 字段并刷新图片 URL）。",
		params: { message_id: f.messageId() },
		run: async (p, ctx) => {
			const data = ctx.getMessage(p.message_id);
			if (!data) {
				log$5.warn("[get_msg] miss message_id=%d", p.message_id);
				return failedResponse(RETCODE.ACTION_FAILED, "message not found");
			}
			const result = { ...data };
			delete result.post_type;
			delete result.self_id;
			result.real_id = result.message_id ?? p.message_id;
			await refreshStoredImageUrls(result, ctx);
			return okResponse(result);
		}
	}),
	defineAction({
		name: "delete_msg",
		summary: "撤回消息",
		params: { message_id: f.messageId() },
		run: async (p, ctx) => {
			const meta = ctx.getMessageMeta(p.message_id);
			if (!meta) return failedResponse(RETCODE.ACTION_FAILED, "message not found or not retractable");
			await ctx.deleteMessage(p.message_id, meta);
			return okResponse();
		}
	})
];
//#endregion
//#region ../onebot/src/actions/friend.ts
var actions$10 = [
	defineAction({
		name: "get_friend_list",
		summary: "获取好友列表",
		readOnly: true,
		returns: "好友列表数组，每项含 QQ 号、昵称与备注。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					user_id: {
						type: "integer",
						description: "好友 QQ 号"
					},
					nickname: {
						type: "string",
						description: "好友昵称"
					},
					remark: {
						type: "string",
						description: "好友备注"
					}
				},
				required: [
					"user_id",
					"nickname",
					"remark"
				]
			}
		},
		params: {},
		run: async (_p, ctx) => {
			if (ctx.getFriendList) return okResponse(await ctx.getFriendList());
			return okResponse([]);
		}
	}),
	defineAction({
		name: "get_stranger_info",
		summary: "获取陌生人信息",
		readOnly: true,
		returns: "用户资料：QQ 号、昵称、好友备注、性别、年龄与个性签名，命中资料时另含等级、企点标志与企业名称。",
		returnsSchema: {
			type: "object",
			properties: {
				user_id: {
					type: "integer",
					description: "QQ 号"
				},
				nickname: {
					type: "string",
					description: "昵称"
				},
				remark: {
					type: "string",
					description: "好友备注；非好友或未设置时为空字符串"
				},
				sex: {
					type: "string",
					description: "性别（male/female/unknown）"
				},
				age: {
					type: "integer",
					description: "年龄"
				},
				long_nick: {
					type: "string",
					description: "个性签名"
				},
				qq_level: {
					type: "integer",
					description: "QQ 等级（仅查到资料时返回）"
				},
				level: {
					type: "integer",
					description: "QQ 等级，同 qq_level（仅查到资料时返回）"
				},
				status: {
					type: "integer",
					description: "在线状态码"
				},
				extStatus: {
					type: "integer",
					description: "扩展状态码"
				},
				ext_status: {
					type: "integer",
					description: "扩展状态码（同 extStatus）"
				},
				batteryStatus: {
					type: "integer",
					description: "电量状态"
				},
				customStatus: {
					type: "object",
					description: "自定义状态",
					nullable: true
				},
				customStatusDescInfo: {
					type: "string",
					description: "自定义状态说明"
				},
				qidian_master_flag: {
					type: "integer",
					description: "企点主号标志，0 或 1；普通账号为 0"
				},
				qidian_crew_flag: {
					type: "integer",
					description: "企点员工标志，0 或 1；普通账号为 0"
				},
				qidian_crew_flag_2: {
					type: "integer",
					description: "企点保留标志，0 或 1；普通账号为 0"
				},
				qidian_enterprise_name: {
					type: "string",
					description: "企点企业名称；非企点账号或未获取到时为空字符串"
				}
			},
			required: [
				"user_id",
				"nickname",
				"remark",
				"sex",
				"age",
				"long_nick"
			]
		},
		params: { user_id: f.userId().describe("QQ 号") },
		run: async (p, ctx) => {
			const userId = p.user_id;
			if (ctx.getStrangerInfo) return okResponse(await ctx.getStrangerInfo(userId) ?? {
				user_id: userId,
				nickname: "",
				remark: "",
				sex: "unknown",
				age: 0,
				long_nick: ""
			});
			return okResponse({
				user_id: userId,
				nickname: "",
				remark: "",
				sex: "unknown",
				age: 0,
				long_nick: ""
			});
		}
	}),
	defineAction({
		name: "delete_friend",
		summary: "删除好友",
		params: {
			user_id: f.userId().describe("QQ 号"),
			block: f.bool().default(false)
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.friend.delete(p.user_id, p.block);
			return okResponse();
		}
	})
];
//#endregion
//#region ../protocol/src/web/request-util.ts
var log$4 = createLogger("Protocol.Http");
function validateLimit(name, value) {
	const exceedsTimerRange = name === "timeoutMs" && value !== void 0 && value > 2147483647;
	if (value !== void 0 && (!Number.isSafeInteger(value) || value <= 0 || exceedsTimerRange)) throw new Error(`${name} must be a positive safe integer`);
}
var httpFailures = /* @__PURE__ */ new WeakMap();
function errorObject(error) {
	return error instanceof Error ? error : new Error(String(error));
}
function errorText(error) {
	return errorObject(error).message;
}
function fail(outcome, reason, error) {
	const result = errorObject(error);
	if (!httpFailures.has(result)) httpFailures.set(result, {
		outcome,
		reason
	});
	return result;
}
function traceTerminal(trace, outcome, reason, error) {
	if (trace.terminal) return;
	trace.terminal = true;
	log$4.trace(() => [
		"http_terminal method=%j url=%j outcome=%s reason=%s%s elapsedMs=%d",
		trace.method,
		trace.url,
		outcome,
		reason,
		error === void 0 ? "" : ` error=${JSON.stringify(errorText(error))}`,
		Date.now() - trace.startedAt
	]);
}
var SENSITIVE_REDIRECT_HEADERS = /* @__PURE__ */ new Set([
	"authorization",
	"cookie",
	"cookie2",
	"host",
	"proxy-authorization"
]);
function headersForRedirect(headers, source, target) {
	if (source.origin === target.origin) return headers;
	return Object.fromEntries(Object.entries(headers).filter(([name]) => !SENSITIVE_REDIRECT_HEADERS.has(name.toLowerCase())));
}
var RequestUtil = class {
	static async HttpsGetCookies(url, depth = 0) {
		const startedAt = Date.now();
		return runWithTraceRequest(async () => {
			const cookies = {};
			log$4.trace("http_cookie_start url=%j depth=%d", url, depth);
			let result;
			try {
				result = await this.collectCookies(url, depth, cookies);
			} catch (error) {
				result = {
					reason: "transport_failure",
					error: errorObject(error)
				};
			}
			log$4.trace(() => [
				"http_cookie_terminal url=%j outcome=completed reason=%s failOpen=%s cookies=%s%s elapsedMs=%d",
				url,
				result.reason,
				result.reason !== "response_complete",
				renderParamsVerbose(cookies),
				result.error === void 0 ? "" : ` error=${JSON.stringify(errorText(result.error))}`,
				Date.now() - startedAt
			]);
			return cookies;
		});
	}
	static collectCookies(url, depth, cookies) {
		const client = url.startsWith("https") ? https : http;
		return new Promise((resolve) => {
			let settled = false;
			let traceResponseDeadline;
			const done = (reason, error) => {
				if (settled) return;
				settled = true;
				resolve({
					reason,
					...error === void 0 ? {} : { error: errorObject(error) }
				});
			};
			const req = client.get(url, (res) => {
				if (res.headers["set-cookie"]) this.extractCookies(res.headers["set-cookie"], cookies);
				log$4.trace(() => [
					"http_cookie_response url=%j status=%s headers=%s cookies=%s",
					url,
					res.statusCode ?? "unknown",
					renderParamsVerbose(res.headers),
					renderParamsVerbose(cookies)
				]);
				const traceChunks = getLogLevel() === "trace" ? [] : null;
				let traceResponseBytes = 0;
				let bodyTraced = false;
				const traceBody = (state) => {
					if (bodyTraced) return;
					bodyTraced = true;
					if (traceChunks === null) return;
					const body = Buffer.concat(traceChunks, traceResponseBytes);
					log$4.trace(() => [
						"http_cookie_body url=%j state=%s bodyBytes=%d bodyHex=%s body=%j",
						url,
						state,
						traceResponseBytes,
						renderTraceBytes(body),
						body.toString()
					]);
				};
				traceResponseDeadline = () => traceBody("deadline");
				res.on("data", (chunk) => {
					if (traceChunks === null) return;
					const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
					traceResponseBytes += bytes.length;
					traceChunks.push(bytes);
				});
				res.once("aborted", () => {
					traceBody("aborted");
					done("transport_failure", /* @__PURE__ */ new Error("cookie response aborted before completion"));
				});
				res.once("error", (error) => {
					traceBody("error");
					done("transport_failure", error);
				});
				res.on("end", () => {
					traceBody("complete");
					const location = res.headers.location;
					if ((res.statusCode === 301 || res.statusCode === 302) && location) {
						if (depth >= 5) {
							done("redirect_limit");
							return;
						}
						let redirectUrl;
						try {
							redirectUrl = new URL(location, url).href;
						} catch {
							done("redirect_failure");
							return;
						}
						log$4.trace(() => [
							"http_cookie_branch branch=redirect status=%d from=%j to=%j cookies=%s remainingRedirects=%d",
							res.statusCode,
							url,
							redirectUrl,
							renderParamsVerbose(cookies),
							5 - depth
						]);
						this.collectCookies(redirectUrl, depth + 1, cookies).then((result) => {
							if (settled) return;
							settled = true;
							resolve(result);
						}).catch((error) => done("transport_failure", error));
						return;
					}
					done("response_complete");
				});
			});
			req.setTimeout(8e3, () => {
				traceResponseDeadline?.();
				req.destroy();
				done("deadline");
			});
			req.on("error", (error) => done("transport_failure", error));
		});
	}
	static extractCookies(setCookieHeaders, cookies) {
		setCookieHeaders.forEach((cookie) => {
			const parts = cookie.split(";")[0]?.split("=");
			if (parts) {
				const key = parts[0];
				const value = parts[1];
				if (key && value && key.length > 0 && value.length > 0) cookies[key] = value;
			}
		});
	}
	static async HttpGetJson(url, method = "GET", data, headers = {}, isJsonRet = true, isArgJson = true, maxRedirects = 5, responseLimits = {}) {
		const methodName = method.toUpperCase();
		const trace = {
			startedAt: Date.now(),
			method: methodName,
			url,
			terminal: false
		};
		return runWithTraceRequest(async () => {
			log$4.trace(() => [
				"http_start method=%j url=%j headers=%s data=%s responseType=%s timeoutMs=%s maxResponseBytes=%s",
				methodName,
				url,
				renderParamsVerbose(headers),
				renderParamsVerbose(data),
				isJsonRet ? "json" : "text",
				responseLimits.timeoutMs ?? "none",
				responseLimits.maxResponseBytes ?? "none"
			]);
			try {
				try {
					validateLimit("timeoutMs", responseLimits.timeoutMs);
					validateLimit("maxResponseBytes", responseLimits.maxResponseBytes);
				} catch (error) {
					throw fail("failed", "request_invalid", error);
				}
				const value = await this.request({
					url,
					method: methodName,
					data,
					headers,
					isJsonRet,
					isArgJson,
					maxRedirects,
					responseLimits,
					deadlineAt: responseLimits.timeoutMs === void 0 ? void 0 : Date.now() + responseLimits.timeoutMs
				});
				traceTerminal(trace, "completed", "response_complete");
				return value;
			} catch (error) {
				const result = errorObject(error);
				const classification = httpFailures.get(result) ?? {
					outcome: "failed",
					reason: "transport_failure"
				};
				traceTerminal(trace, classification.outcome, classification.reason, result);
				throw result;
			}
		});
	}
	static async request(context) {
		let option;
		try {
			option = new URL(context.url);
		} catch (error) {
			throw fail("failed", "request_invalid", error);
		}
		const protocol = option.protocol === "https:" ? https : option.protocol === "http:" ? http : void 0;
		if (!protocol) throw fail("failed", "request_invalid", /* @__PURE__ */ new Error(`unsupported request protocol: ${option.protocol}`));
		const remainingTimeoutMs = context.deadlineAt === void 0 ? void 0 : context.deadlineAt - Date.now();
		if (remainingTimeoutMs !== void 0 && remainingTimeoutMs <= 0) throw fail("timeout", "deadline", /* @__PURE__ */ new Error(`request timed out after ${context.responseLimits.timeoutMs} ms`));
		const options = {
			hostname: option.hostname,
			port: option.port,
			path: option.pathname + option.search,
			method: context.method,
			headers: context.headers
		};
		return new Promise((resolve, reject) => {
			let settled = false;
			let timeout;
			let traceResponseFailure;
			const clearDeadline = () => {
				if (timeout !== void 0) clearTimeout(timeout);
			};
			const resolveOnce = (value) => {
				if (settled) return;
				settled = true;
				clearDeadline();
				resolve(value);
			};
			const rejectOnce = (error) => {
				if (settled) return;
				settled = true;
				clearDeadline();
				reject(error);
			};
			const handOff = (next) => {
				if (settled) return;
				settled = true;
				clearDeadline();
				next.then(resolve).catch(reject);
			};
			let req;
			try {
				req = protocol.request(options, (res) => {
					const statusCode = res.statusCode ?? 0;
					const closeCurrent = () => {
						res.destroy();
						req.destroy();
					};
					res.once("error", (error) => {
						traceResponseFailure?.("error");
						rejectOnce(fail("failed", "transport_failure", error));
					});
					res.once("aborted", () => {
						traceResponseFailure?.("aborted");
						rejectOnce(fail("cancelled", "response_aborted", /* @__PURE__ */ new Error("response aborted before completion")));
					});
					if ((statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) && res.headers.location) {
						log$4.trace(() => [
							"http_response status=%d url=%j headers=%s bodyState=not_read",
							statusCode,
							context.url,
							renderParamsVerbose(res.headers)
						]);
						if (context.maxRedirects <= 0) {
							rejectOnce(fail("failed", "redirect_failure", /* @__PURE__ */ new Error("Too many redirects")));
							closeCurrent();
							return;
						}
						let redirectUrl;
						try {
							redirectUrl = new URL(res.headers.location, option);
						} catch (error) {
							rejectOnce(fail("failed", "redirect_failure", new Error("invalid redirect location", { cause: error })));
							closeCurrent();
							return;
						}
						if (redirectUrl.protocol !== "http:" && redirectUrl.protocol !== "https:") {
							rejectOnce(fail("failed", "redirect_failure", /* @__PURE__ */ new Error(`unsupported redirect protocol: ${redirectUrl.protocol}`)));
							closeCurrent();
							return;
						}
						if (option.origin !== redirectUrl.origin && context.method.toUpperCase() !== "GET" && context.method.toUpperCase() !== "HEAD") {
							rejectOnce(fail("failed", "redirect_failure", /* @__PURE__ */ new Error(`cross-origin redirect cannot forward method ${context.method.toUpperCase()}`)));
							closeCurrent();
							return;
						}
						const redirectHeaders = headersForRedirect(context.headers, option, redirectUrl);
						log$4.trace(() => [
							"http_branch branch=redirect status=%d from=%j to=%j nextHeaders=%s remainingRedirects=%d",
							statusCode,
							context.url,
							redirectUrl.href,
							renderParamsVerbose(redirectHeaders),
							context.maxRedirects - 1
						]);
						handOff(this.request({
							...context,
							url: redirectUrl.href,
							headers: redirectHeaders,
							maxRedirects: context.maxRedirects - 1
						}));
						closeCurrent();
						return;
					}
					if (statusCode < 200 || statusCode >= 300) {
						log$4.trace(() => [
							"http_response status=%d url=%j headers=%s bodyState=not_read",
							statusCode,
							context.url,
							renderParamsVerbose(res.headers)
						]);
						rejectOnce(fail("failed", "non_2xx", /* @__PURE__ */ new Error(`Unexpected status code: ${res.statusCode}`)));
						closeCurrent();
						return;
					}
					const chunks = [];
					let responseBytes = 0;
					let failureBodyTraced = false;
					traceResponseFailure = (state) => {
						if (failureBodyTraced) return;
						failureBodyTraced = true;
						log$4.trace(() => {
							const observedBody = Buffer.concat(chunks, responseBytes);
							return [
								"http_response status=%d url=%j headers=%s bodyState=%s bodyBytes=%d bodyHex=%s body=%j",
								statusCode,
								context.url,
								renderParamsVerbose(res.headers),
								state,
								responseBytes,
								renderTraceBytes(observedBody),
								observedBody.toString()
							];
						});
					};
					res.on("data", (chunk) => {
						if (settled) return;
						const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
						responseBytes += bytes.length;
						chunks.push(bytes);
						if (context.responseLimits.maxResponseBytes !== void 0 && responseBytes > context.responseLimits.maxResponseBytes) {
							traceResponseFailure?.("too_large");
							rejectOnce(fail("failed", "response_too_large", /* @__PURE__ */ new Error(`response body exceeds ${context.responseLimits.maxResponseBytes} bytes`)));
							closeCurrent();
							return;
						}
					});
					res.on("end", () => {
						if (settled) return;
						failureBodyTraced = true;
						const responseBuffer = Buffer.concat(chunks, responseBytes);
						const responseBody = responseBuffer.toString();
						log$4.trace(() => [
							"http_response status=%d url=%j headers=%s bodyBytes=%d bodyHex=%s body=%j",
							statusCode,
							context.url,
							renderParamsVerbose(res.headers),
							responseBytes,
							renderTraceBytes(responseBuffer),
							responseBody
						]);
						try {
							if (context.isJsonRet) {
								const parsed = JSON.parse(responseBody);
								log$4.trace(() => ["http_branch branch=parse_completed responseType=json result=%s", renderParamsVerbose(parsed)]);
								resolveOnce(parsed);
							} else {
								log$4.trace("http_branch branch=parse_completed responseType=text");
								resolveOnce(responseBody);
							}
						} catch (parseError) {
							log$4.trace(() => ["http_branch branch=parse_failed responseType=json error=%j", errorText(parseError)]);
							rejectOnce(fail("failed", "parse_failure", parseError));
						}
					});
				});
			} catch (error) {
				rejectOnce(fail("failed", "request_invalid", error));
				return;
			}
			if (remainingTimeoutMs !== void 0) timeout = setTimeout(() => {
				traceResponseFailure?.("deadline");
				rejectOnce(fail("timeout", "deadline", /* @__PURE__ */ new Error(`request timed out after ${context.responseLimits.timeoutMs} ms`)));
				req.destroy();
			}, remainingTimeoutMs);
			req.on("error", (error) => rejectOnce(fail("failed", "transport_failure", error)));
			try {
				if (context.method === "POST" || context.method === "PUT" || context.method === "PATCH") {
					const requestBody = context.isArgJson ? JSON.stringify(context.data) : context.data;
					if (typeof requestBody === "string" || Buffer.isBuffer(requestBody) || requestBody instanceof Uint8Array) log$4.trace(() => {
						const requestBytes = typeof requestBody === "string" ? Buffer.from(requestBody) : requestBody;
						return [
							"http_branch branch=request_body url=%j requestBytes=%d requestHex=%s",
							context.url,
							requestBytes.byteLength,
							renderTraceBytes(requestBytes)
						];
					});
					req.write(requestBody);
				}
				req.end();
			} catch (error) {
				rejectOnce(fail("failed", "request_invalid", error));
				req.destroy();
			}
		});
	}
	static async HttpGetText(url, method = "GET", data, headers = {}, responseLimits = {}) {
		return this.HttpGetJson(url, method, data, headers, false, false, 5, responseLimits);
	}
};
function cookieToString(cookieObject) {
	return Object.entries(cookieObject).map(([key, value]) => `${key}=${value}`).join("; ");
}
function getBknFromCookie(cookieObject) {
	const skey = cookieObject["p_skey"] || cookieObject["skey"] || "";
	let hash = 5381;
	for (let i = 0; i < skey.length; i++) hash += (hash << 5) + skey.charCodeAt(i);
	return (hash & 2147483647).toString();
}
//#endregion
//#region ../protocol/src/web/group-honor.ts
var log$3 = createLogger("Bridge.Web");
var WebHonorType = /* @__PURE__ */ function(WebHonorType) {
	WebHonorType["TALKATIVE"] = "talkative";
	WebHonorType["PERFORMER"] = "performer";
	WebHonorType["LEGEND"] = "legend";
	WebHonorType["EMOTION"] = "emotion";
	WebHonorType["ALL"] = "all";
	return WebHonorType;
}({});
async function fetchHonorData(cookieObject, groupCode, type) {
	let resJson;
	try {
		const res = await RequestUtil.HttpGetText(`https://qun.qq.com/interactive/honorlist?${new URLSearchParams({
			gc: groupCode,
			type: type.toString()
		}).toString()}`, "GET", "", { Cookie: cookieToString(cookieObject) });
		const match = /window\.__INITIAL_STATE__=(.*?);/.exec(res);
		if (match?.[1]) resJson = JSON.parse(match[1].trim());
		return type === 1 ? resJson?.talkativeList : resJson?.actorList;
	} catch (e) {
		throw new Error(`获取群 ${groupCode} 类型 ${type} 的荣誉信息失败: ${e}`);
	}
}
async function getHonorListWebAPI(cookieObject, groupCode, type) {
	try {
		const data = await fetchHonorData(cookieObject, groupCode, type);
		if (!data) return [];
		return data.map((item) => ({
			user_id: item?.uin ?? null,
			nickname: item?.name ?? "",
			avatar: item?.avatar ?? "",
			description: item?.desc ?? ""
		}));
	} catch (e) {
		log$3.warn("getHonorListWebAPI failed (group=%s type=%d): %s", groupCode, type, e instanceof Error ? e.stack ?? e.message : String(e));
		return [];
	}
}
//#endregion
//#region ../onebot/src/actions/group-info.ts
var groupInfoReturnsSchema = {
	type: "object",
	properties: {
		group_id: {
			type: "integer",
			description: "群号"
		},
		group_name: {
			type: "string",
			description: "群名"
		},
		group_remark: {
			type: "string",
			description: "当前账号设置的群备注"
		},
		member_count: {
			type: "integer",
			description: "当前成员数"
		},
		max_member_count: {
			type: "integer",
			description: "成员上限"
		},
		group_create_time: {
			type: "integer",
			description: "建群时间戳（秒）"
		},
		group_level: {
			type: "integer",
			description: "群等级"
		},
		group_memo: {
			type: "string",
			description: "群简介 / 公告预览"
		},
		group_all_shut: {
			type: "integer",
			enum: [-1, 0],
			description: "是否开启全员禁言（-1 开启，0 关闭）"
		}
	},
	required: [
		"group_id",
		"group_name",
		"group_remark",
		"member_count",
		"max_member_count",
		"group_all_shut"
	]
};
var actions$9 = [
	defineAction({
		name: "get_group_list",
		summary: "获取群列表",
		readOnly: true,
		returns: "群信息对象数组。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					group_id: {
						type: "integer",
						description: "群号"
					},
					group_name: {
						type: "string",
						description: "群名"
					},
					group_remark: {
						type: "string",
						description: "当前账号设置的群备注"
					},
					member_count: {
						type: "integer",
						description: "当前成员数"
					},
					max_member_count: {
						type: "integer",
						description: "成员上限"
					},
					group_create_time: {
						type: "integer",
						description: "建群时间戳（秒）"
					},
					group_level: {
						type: "integer",
						description: "群等级（列表批量场景恒 0，详见 get_group_info）"
					},
					group_memo: {
						type: "string",
						description: "群简介 / 公告预览"
					},
					group_all_shut: {
						type: "integer",
						enum: [-1, 0],
						description: "是否开启全员禁言（-1 开启，0 关闭）"
					}
				},
				required: [
					"group_id",
					"group_name",
					"group_remark",
					"member_count",
					"max_member_count",
					"group_all_shut"
				]
			}
		},
		params: { no_cache: f.bool().default(false) },
		run: async (p, ctx) => {
			const noCache = p.no_cache;
			if (ctx.getGroupList) return okResponse(await ctx.getGroupList(noCache));
			return okResponse([]);
		}
	}),
	groupAction({
		name: "get_group_info",
		summary: "获取群信息",
		readOnly: true,
		returns: "群信息对象。",
		returnsSchema: groupInfoReturnsSchema,
		params: { no_cache: f.bool().default(false) },
		run: async (p, ctx) => {
			const groupId = p.group_id;
			const noCache = p.no_cache;
			const fallback = {
				group_id: groupId,
				group_name: "",
				group_remark: "",
				member_count: 0,
				max_member_count: 0,
				group_create_time: 0,
				group_level: 0,
				group_memo: "",
				group_all_shut: 0
			};
			if (ctx.getGroupInfo) return okResponse(await ctx.getGroupInfo(groupId, noCache) ?? fallback);
			return okResponse(fallback);
		}
	}),
	groupAction({
		name: "get_group_member_list",
		summary: "获取群成员列表",
		readOnly: true,
		returns: "群成员信息对象数组。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					group_id: {
						type: "integer",
						description: "群号"
					},
					user_id: {
						type: "integer",
						description: "QQ 号"
					},
					nickname: {
						type: "string",
						description: "昵称"
					},
					card: {
						type: "string",
						description: "群名片"
					},
					is_robot: {
						type: "boolean",
						description: "是否为机器人"
					},
					sex: {
						type: "string",
						enum: [
							"male",
							"female",
							"unknown"
						],
						description: "性别"
					},
					age: {
						type: "integer",
						description: "年龄"
					},
					join_time: {
						type: "integer",
						description: "入群时间戳（秒）"
					},
					last_sent_time: {
						type: "integer",
						description: "最后发言时间戳（秒）"
					},
					shut_up_timestamp: {
						type: "integer",
						description: "禁言结束时间戳（秒，未禁言时为 0）"
					},
					level: {
						type: "string",
						description: "群等级"
					},
					role: {
						type: "string",
						enum: [
							"owner",
							"admin",
							"member"
						],
						description: "角色"
					},
					title: {
						type: "string",
						description: "专属头衔"
					},
					area: {
						type: "string",
						description: "地区（QQ NT 不提供，恒空）"
					},
					unfriendly: {
						type: "boolean",
						description: "是否不良记录（QQ NT 不提供，恒 false）"
					},
					title_expire_time: {
						type: "integer",
						description: "头衔过期时间戳（QQ NT 不提供，恒 0）"
					},
					card_changeable: {
						type: "boolean",
						description: "是否可改名片（占位，恒 true）"
					},
					qidian_master_flag: {
						type: "integer",
						description: "企点主号标志，0 或 1；普通账号为 0"
					},
					qidian_crew_flag: {
						type: "integer",
						description: "企点员工标志，0 或 1；普通账号为 0"
					},
					qidian_crew_flag_2: {
						type: "integer",
						description: "企点保留标志，0 或 1；普通账号为 0"
					}
				},
				required: [
					"group_id",
					"user_id",
					"nickname",
					"role"
				]
			}
		},
		params: { no_cache: f.bool().default(false) },
		run: async (p, ctx) => {
			const groupId = p.group_id;
			const noCache = p.no_cache;
			if (ctx.getGroupMemberList) return okResponse(await ctx.getGroupMemberList(groupId, noCache));
			return okResponse([]);
		}
	}),
	groupUserAction({
		name: "get_group_member_info",
		summary: "获取群成员信息",
		readOnly: true,
		returns: "群成员信息对象。",
		returnsSchema: {
			type: "object",
			properties: {
				group_id: {
					type: "integer",
					description: "群号"
				},
				user_id: {
					type: "integer",
					description: "QQ 号"
				},
				nickname: {
					type: "string",
					description: "昵称"
				},
				card: {
					type: "string",
					description: "群名片"
				},
				is_robot: {
					type: "boolean",
					description: "是否为机器人"
				},
				sex: {
					type: "string",
					enum: [
						"male",
						"female",
						"unknown"
					],
					description: "性别"
				},
				age: {
					type: "integer",
					description: "年龄"
				},
				join_time: {
					type: "integer",
					description: "入群时间戳（秒）"
				},
				last_sent_time: {
					type: "integer",
					description: "最后发言时间戳（秒）"
				},
				shut_up_timestamp: {
					type: "integer",
					description: "禁言结束时间戳（秒，未禁言时为 0）"
				},
				level: {
					type: "string",
					description: "群等级"
				},
				role: {
					type: "string",
					enum: [
						"owner",
						"admin",
						"member"
					],
					description: "角色"
				},
				title: {
					type: "string",
					description: "专属头衔"
				},
				area: {
					type: "string",
					description: "地区（QQ NT 不提供，恒空）"
				},
				unfriendly: {
					type: "boolean",
					description: "是否不良记录（QQ NT 不提供，恒 false）"
				},
				title_expire_time: {
					type: "integer",
					description: "头衔过期时间戳（QQ NT 不提供，恒 0）"
				},
				card_changeable: {
					type: "boolean",
					description: "是否可改名片（占位，恒 true）"
				},
				qidian_master_flag: {
					type: "integer",
					description: "企点主号标志，0 或 1；普通账号为 0"
				},
				qidian_crew_flag: {
					type: "integer",
					description: "企点员工标志，0 或 1；普通账号为 0"
				},
				qidian_crew_flag_2: {
					type: "integer",
					description: "企点保留标志，0 或 1；普通账号为 0"
				}
			},
			required: [
				"group_id",
				"user_id",
				"nickname",
				"role"
			]
		},
		params: { no_cache: f.bool().default(false) },
		run: async (p, ctx) => {
			const groupId = p.group_id;
			const userId = p.user_id;
			const noCache = p.no_cache;
			if (ctx.getGroupMemberInfo) return okResponse(await ctx.getGroupMemberInfo(groupId, userId, noCache) ?? {
				group_id: groupId,
				user_id: userId,
				nickname: "",
				card: "",
				is_robot: false,
				sex: "unknown",
				age: 0,
				join_time: 0,
				last_sent_time: 0,
				shut_up_timestamp: 0,
				level: "0",
				role: "member",
				title: "",
				qidian_master_flag: 0,
				qidian_crew_flag: 0,
				qidian_crew_flag_2: 0
			});
			return okResponse({
				group_id: groupId,
				user_id: userId,
				nickname: "",
				card: "",
				is_robot: false,
				sex: "unknown",
				age: 0,
				join_time: 0,
				last_sent_time: 0,
				shut_up_timestamp: 0,
				level: "0",
				role: "member",
				title: ""
			});
		}
	}),
	groupAction({
		name: "get_group_honor_info",
		summary: "获取群荣誉信息",
		readOnly: true,
		params: { type: f.string().optional() },
		run: async (p, ctx) => {
			const groupId = p.group_id;
			const typeStr = p.type || "all";
			const typeValues = Object.values(WebHonorType);
			if (!typeValues.includes(typeStr)) return failedResponse(RETCODE.BAD_REQUEST, `invalid type, must be one of ${typeValues.join(", ")}`);
			try {
				return okResponse(await ctx.bridge.apis.web.getHonorInfo(groupId, typeStr));
			} catch (e) {
				return failedResponse(RETCODE.ACTION_FAILED, `failed to get group honor info: ${e.message}`);
			}
		}
	}),
	defineAction({
		name: "get_group_system_msg",
		summary: "获取群系统消息",
		readOnly: true,
		returns: "群系统消息数组，可按群号或未处理状态过滤。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					group_id: {
						type: "integer",
						description: "群号"
					},
					group_name: {
						type: "string",
						description: "群名称"
					},
					request_id: {
						type: "integer",
						description: "请求序列号"
					},
					requester_uin: {
						type: "integer",
						description: "申请人 QQ 号"
					},
					requester_nick: {
						type: "string",
						description: "申请人昵称"
					},
					invitor_uin: {
						type: "integer",
						description: "邀请人 QQ 号，无邀请时为 0"
					},
					invitor_nick: {
						type: "string",
						description: "邀请人昵称"
					},
					message: {
						type: "string",
						description: "验证留言"
					},
					checked: {
						type: "boolean",
						description: "是否已处理"
					},
					flag: {
						type: "string",
						description: "处理请求使用的规范 flag"
					}
				},
				required: [
					"group_id",
					"group_name",
					"request_id",
					"requester_uin",
					"requester_nick",
					"invitor_uin",
					"invitor_nick",
					"message",
					"checked",
					"flag"
				]
			}
		},
		params: {
			group_id: f.groupId().optional(),
			only_pending: f.bool().default(false),
			count: f.int({
				min: 1,
				max: 100
			}).default(50).describe("每个收件箱最多读取的记录数")
		},
		run: async (p, ctx) => {
			if (ctx.handleGetGroupSystemMsg) return okResponse(await ctx.handleGetGroupSystemMsg({
				groupId: p.group_id,
				onlyPending: p.only_pending,
				count: p.count
			}));
			return okResponse([]);
		}
	})
];
//#endregion
//#region ../onebot/src/actions/group-admin.ts
var actions$8 = [
	groupUserAction({
		name: "set_group_kick",
		summary: "踢出群成员",
		params: { reject_add_request: f.bool().default(false) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.kickMember(p.group_id, p.user_id, p.reject_add_request);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_kick_members",
		summary: "批量踢出群成员",
		params: {
			user_id: f.array(f.memberId()).nonEmpty(),
			reject_add_request: f.bool().default(false)
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.kickMembers(p.group_id, p.user_id, p.reject_add_request);
			return okResponse();
		}
	}),
	groupUserAction({
		name: "set_group_ban",
		summary: "禁言群成员（duration=0 解除）",
		params: { duration: f.duration().default(1800) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.muteMember(p.group_id, p.user_id, p.duration);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_whole_ban",
		summary: "全员禁言开关",
		params: { enable: f.bool().default(true) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.muteAll(p.group_id, p.enable);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_add_option",
		summary: "设置加群选项",
		params: {
			add_type: f.int({ min: 0 }).default(0),
			group_question: f.string().optional(),
			group_answer: f.string().optional()
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setAddOption(p.group_id, p.add_type, p.group_question, p.group_answer);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_search",
		summary: "设置群被搜索方式（群指纹 / 群号搜索开关）",
		params: {
			no_finger_open: f.int({ min: 0 }).optional(),
			no_code_finger_open: f.int({ min: 0 }).optional()
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setSearch(p.group_id, p.no_finger_open, p.no_code_finger_open);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_member_invite_policy",
		summary: "设置群成员邀请策略",
		params: { policy: f.enum("disabled", "require_approval", "no_approval", "no_approval_under_100") },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setMemberInvitePolicy(p.group_id, p.policy);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_new_member_history_visibility",
		summary: "设置新成员是否可查看历史消息",
		params: { visible: f.bool() },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setNewMemberHistoryVisibility(p.group_id, p.visible);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_member_permissions",
		summary: "设置群成员权限（仅群主可改）",
		params: {
			allow_member_upload_album: f.bool().optional(),
			allow_member_temporary_session: f.bool().optional(),
			allow_member_create_group: f.bool().optional()
		},
		rules: (r) => [r.atLeastOneOf("allow_member_upload_album", "allow_member_temporary_session", "allow_member_create_group")],
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setMemberPermissions(p.group_id, {
				allowMemberUploadAlbum: p.allow_member_upload_album,
				allowMemberTemporarySession: p.allow_member_temporary_session,
				allowMemberCreateGroup: p.allow_member_create_group
			});
			return okResponse();
		}
	}),
	groupAction({
		name: "get_group_admin_settings",
		summary: "获取群管理设置的当前值",
		readOnly: true,
		returns: "与对应设置接口字段对齐的当前群管理设置。",
		returnsSchema: {
			type: "object",
			properties: {
				add_type: {
					type: "integer",
					description: "加群选项（同 set_group_add_option.add_type）"
				},
				group_question: {
					type: "string",
					description: "加群问题（同 set_group_add_option.group_question）"
				},
				group_answer: {
					type: "string",
					description: "加群答案（同 set_group_add_option.group_answer）"
				},
				robot_member_switch: {
					type: "integer",
					description: "机器人加群开关（同 set_group_robot_add_option）"
				},
				robot_member_examine: {
					type: "integer",
					description: "机器人加群审核（同 set_group_robot_add_option）"
				},
				member_invite_policy: {
					type: "string",
					enum: [
						"disabled",
						"require_approval",
						"no_approval",
						"no_approval_under_100"
					],
					description: "成员邀请策略（同 set_group_member_invite_policy.policy）"
				},
				allow_member_upload_album: {
					type: "boolean",
					description: "是否允许成员上传相册"
				},
				allow_member_temporary_session: {
					type: "boolean",
					description: "是否允许成员发起临时会话"
				},
				allow_member_create_group: {
					type: "boolean",
					description: "是否允许成员创建群聊"
				},
				new_member_history_visible: {
					type: "boolean",
					description: "新成员是否可查看历史消息"
				},
				no_finger_open: {
					type: "integer",
					description: "是否关闭群指纹/关键词搜索（0 开 1 关）"
				},
				no_code_finger_open: {
					type: "integer",
					description: "是否关闭群号搜索（0 开 1 关）"
				}
			},
			required: [
				"add_type",
				"group_question",
				"group_answer",
				"robot_member_switch",
				"robot_member_examine",
				"member_invite_policy",
				"allow_member_upload_album",
				"allow_member_temporary_session",
				"allow_member_create_group",
				"new_member_history_visible",
				"no_finger_open",
				"no_code_finger_open"
			]
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAdmin.getAdminSettings(p.group_id));
		}
	}),
	groupUserAction({
		name: "set_group_admin",
		summary: "设置/取消管理员",
		params: { enable: f.bool().default(true) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setAdmin(p.group_id, p.user_id, p.enable);
			return okResponse();
		}
	}),
	groupUserAction({
		name: "set_group_card",
		summary: "设置群名片（空字符串清除）",
		params: { card: f.string().default("") },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setCard(p.group_id, p.user_id, p.card);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_name",
		summary: "设置群名",
		params: { group_name: f.string().default("") },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setName(p.group_id, p.group_name);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_leave",
		summary: "退群",
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.leave(p.group_id);
			return okResponse();
		}
	}),
	groupUserAction({
		name: "set_group_special_title",
		summary: "设置群头衔",
		params: { special_title: f.string().default("") },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setSpecialTitle(p.group_id, p.user_id, p.special_title);
			return okResponse();
		}
	}),
	defineAction({
		name: "set_group_anonymous",
		summary: "匿名开关（未实现，返回 ok）",
		params: {},
		run: () => okResponse()
	}),
	defineAction({
		name: "set_group_anonymous_ban",
		summary: "匿名禁言（未实现，返回 ok）",
		params: {},
		run: () => okResponse()
	}),
	groupAction({
		name: "set_group_portrait",
		summary: "设置群头像",
		params: { file: f.image() },
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.setGroupAvatar(p.group_id, p.file);
			return okResponse();
		}
	})
];
//#endregion
//#region ../onebot/src/actions/group-file.ts
function busidOr102(raw) {
	const n = typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : NaN;
	return Number.isInteger(n) && n >= 0 ? n : 102;
}
var actions$7 = [
	groupAction({
		name: "upload_group_file",
		summary: "上传群文件",
		returns: "{ file_id: string }",
		params: {
			file: f.file(),
			name: f.string().default(""),
			folder: f.string().default(""),
			folder_id: f.string().default(""),
			upload_file: f.bool().default(true)
		},
		run: async (p, ctx) => {
			const folderId = p.folder || p.folder_id || "/";
			return okResponse({ file_id: (await ctx.bridge.apis.groupFile.upload(p.group_id, p.file, p.name, folderId, p.upload_file)).fileId });
		}
	}),
	defineAction({
		name: "upload_private_file",
		summary: "上传私聊文件",
		returns: "{ file_id: string }",
		params: {
			user_id: f.userId(),
			file: f.file(),
			name: f.string().default(""),
			upload_file: f.bool().default(true)
		},
		run: async (p, ctx) => {
			const result = await ctx.bridge.apis.groupFile.uploadPrivate(p.user_id, p.file, p.name, p.upload_file, false);
			if (p.upload_file) {
				if (!result.fileId) throw new Error("private file upload returned no file_id");
				const uploaded = ctx.bridge.recallUploadedFile(result.fileId);
				if (!uploaded || uploaded.scope !== "private" || uploaded.userId !== p.user_id) throw new Error(`private file upload metadata missing for file_id ${result.fileId}`);
				await ctx.sendPrivateMessage(p.user_id, [{
					type: "file",
					data: {
						file_id: result.fileId,
						name: uploaded.fileName,
						file_size: uploaded.fileSize,
						md5: Buffer.from(uploaded.fileMd5).toString("hex"),
						file_hash: result.fileHash ?? uploaded.fileHash ?? ""
					}
				}], false);
			}
			return okResponse({ file_id: result.fileId });
		}
	}),
	groupAction({
		name: "get_group_file_url",
		summary: "获取群文件下载链接",
		readOnly: true,
		returns: "群文件下载链接。",
		returnsSchema: {
			type: "object",
			properties: { url: {
				type: "string",
				description: "文件下载直链"
			} },
			required: ["url"]
		},
		params: {
			file_id: f.fileId(),
			busid: f.raw()
		},
		run: async (p, ctx) => {
			return okResponse({ url: await ctx.bridge.apis.groupFile.getUrl(p.group_id, p.file_id, busidOr102(p.busid)) });
		}
	}),
	groupAction({
		name: "get_group_root_files",
		summary: "获取群根目录文件列表",
		readOnly: true,
		returns: "群文件系统信息（文件与文件夹列表）。",
		returnsSchema: {
			type: "object",
			properties: {
				files: {
					type: "array",
					description: "文件列表",
					items: {
						type: "object",
						properties: {
							group_id: {
								type: "integer",
								description: "群号"
							},
							file_id: {
								type: "string",
								description: "文件 ID"
							},
							file_name: {
								type: "string",
								description: "文件名"
							},
							busid: {
								type: "integer",
								description: "业务 ID"
							},
							file_size: {
								type: "integer",
								description: "文件大小（字节）"
							},
							upload_time: {
								type: "integer",
								description: "上传时间戳"
							},
							dead_time: {
								type: "integer",
								description: "过期时间戳"
							},
							modify_time: {
								type: "integer",
								description: "修改时间戳"
							},
							download_times: {
								type: "integer",
								description: "下载次数"
							},
							uploader: {
								type: "integer",
								description: "上传者 QQ 号"
							},
							uploader_name: {
								type: "string",
								description: "上传者昵称"
							}
						}
					}
				},
				folders: {
					type: "array",
					description: "文件夹列表",
					items: {
						type: "object",
						properties: {
							group_id: {
								type: "integer",
								description: "群号"
							},
							folder_id: {
								type: "string",
								description: "文件夹 ID"
							},
							folder_name: {
								type: "string",
								description: "文件夹名"
							},
							create_time: {
								type: "integer",
								description: "创建时间戳"
							},
							creator: {
								type: "integer",
								description: "创建者 QQ 号"
							},
							create_name: {
								type: "string",
								description: "创建者昵称"
							},
							total_file_count: {
								type: "integer",
								description: "文件夹内文件总数"
							},
							last_upload_time: {
								type: "integer",
								description: "最后上传时间戳"
							},
							last_uploader: {
								type: "integer",
								description: "最后上传者 QQ 号"
							},
							last_uploader_name: {
								type: "string",
								description: "最后上传者昵称"
							}
						}
					}
				}
			},
			required: ["files", "folders"]
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.getGroupFiles(p.group_id, "/"));
		}
	}),
	groupAction({
		name: "get_group_files_by_folder",
		summary: "获取群子目录文件列表",
		readOnly: true,
		returns: "群文件系统信息（文件与文件夹列表）。",
		returnsSchema: {
			type: "object",
			properties: {
				files: {
					type: "array",
					description: "文件列表",
					items: {
						type: "object",
						properties: {
							group_id: {
								type: "integer",
								description: "群号"
							},
							file_id: {
								type: "string",
								description: "文件 ID"
							},
							file_name: {
								type: "string",
								description: "文件名"
							},
							busid: {
								type: "integer",
								description: "业务 ID"
							},
							file_size: {
								type: "integer",
								description: "文件大小（字节）"
							},
							upload_time: {
								type: "integer",
								description: "上传时间戳"
							},
							dead_time: {
								type: "integer",
								description: "过期时间戳"
							},
							modify_time: {
								type: "integer",
								description: "修改时间戳"
							},
							download_times: {
								type: "integer",
								description: "下载次数"
							},
							uploader: {
								type: "integer",
								description: "上传者 QQ 号"
							},
							uploader_name: {
								type: "string",
								description: "上传者昵称"
							}
						}
					}
				},
				folders: {
					type: "array",
					description: "文件夹列表",
					items: {
						type: "object",
						properties: {
							group_id: {
								type: "integer",
								description: "群号"
							},
							folder_id: {
								type: "string",
								description: "文件夹 ID"
							},
							folder_name: {
								type: "string",
								description: "文件夹名"
							},
							create_time: {
								type: "integer",
								description: "创建时间戳"
							},
							creator: {
								type: "integer",
								description: "创建者 QQ 号"
							},
							create_name: {
								type: "string",
								description: "创建者昵称"
							},
							total_file_count: {
								type: "integer",
								description: "文件夹内文件总数"
							},
							last_upload_time: {
								type: "integer",
								description: "最后上传时间戳"
							},
							last_uploader: {
								type: "integer",
								description: "最后上传者 QQ 号"
							},
							last_uploader_name: {
								type: "string",
								description: "最后上传者昵称"
							}
						}
					}
				}
			},
			required: ["files", "folders"]
		},
		params: {
			folder_id: f.string().default(""),
			folder: f.string().default("")
		},
		run: async (p, ctx) => {
			const folderId = p.folder_id || p.folder || "/";
			return okResponse(await ctx.getGroupFiles(p.group_id, folderId));
		}
	}),
	groupAction({
		name: "delete_group_file",
		summary: "删除群文件",
		params: { file_id: f.fileId() },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupFile.delete(p.group_id, p.file_id);
			return okResponse();
		}
	}),
	groupAction({
		name: "move_group_file",
		summary: "移动群文件",
		params: {
			file_id: f.fileId(),
			parent_directory: f.string({ allowEmpty: false }),
			target_directory: f.string({ allowEmpty: false })
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupFile.move(p.group_id, p.file_id, p.parent_directory, p.target_directory);
			return okResponse();
		}
	}),
	groupAction({
		name: "rename_group_file",
		summary: "重命名群文件",
		params: {
			file_id: f.fileId(),
			current_parent_directory: f.string().default("/"),
			new_name: f.string({ allowEmpty: false })
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupFile.rename(p.group_id, p.file_id, p.current_parent_directory || "/", p.new_name);
			return okResponse({ ok: true });
		}
	}),
	groupAction({
		name: "create_group_file_folder",
		summary: "创建群文件夹",
		returns: "{ result: { retCode, retMsg }, groupItem: { folderInfo: { folderId, folderName, folderPath, createTime, modifyTime, createUin, modifyUin } } }",
		params: {
			name: f.string({ allowEmpty: false }),
			parent_id: f.string().default("/")
		},
		run: async (p, ctx) => {
			return okResponse({
				result: {
					retCode: 0,
					retMsg: "success"
				},
				groupItem: { folderInfo: await ctx.bridge.apis.groupFile.createFolder(p.group_id, p.name, p.parent_id || "/") }
			});
		}
	}),
	groupAction({
		name: "delete_group_file_folder",
		summary: "删除群文件夹",
		params: { folder_id: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupFile.deleteFolder(p.group_id, p.folder_id);
			return okResponse();
		}
	}),
	groupAction({
		name: "rename_group_file_folder",
		summary: "重命名群文件夹",
		params: {
			folder_id: f.string({ allowEmpty: false }),
			new_folder_name: f.string().default(""),
			name: f.string().default("")
		},
		run: async (p, ctx) => {
			const newName = p.new_folder_name || p.name;
			if (!newName) return failedResponse(RETCODE.BAD_REQUEST, "group_id, folder_id and new_folder_name are required");
			await ctx.bridge.apis.groupFile.renameFolder(p.group_id, p.folder_id, newName);
			return okResponse();
		}
	}),
	defineAction({
		name: "get_private_file_url",
		summary: "获取私聊文件下载链接",
		readOnly: true,
		returns: "私聊文件下载链接。",
		returnsSchema: {
			type: "object",
			properties: { url: {
				type: "string",
				description: "文件下载直链"
			} },
			required: ["url"]
		},
		params: {
			user_id: f.userId().optional(),
			file_id: f.fileId(),
			file_hash: f.string().default("")
		},
		run: async (p, ctx) => {
			return okResponse({ url: await ctx.bridge.apis.groupFile.getPrivateUrl(p.user_id ?? 0, p.file_id, p.file_hash) });
		}
	})
];
//#endregion
//#region ../onebot/src/actions/request.ts
var actions$6 = [defineAction({
	name: "set_friend_add_request",
	summary: "处理好友添加请求",
	params: {
		flag: f.string({ allowEmpty: false }),
		approve: f.bool().default(true)
	},
	run: async (p, ctx) => {
		await ctx.bridge.apis.friend.handleRequest(p.flag, p.approve);
		return okResponse();
	}
}), defineAction({
	name: "set_group_add_request",
	summary: "处理加群请求",
	params: {
		flag: f.string({ allowEmpty: false }),
		sub_type: f.string().optional(),
		type: f.string().optional(),
		approve: f.bool().default(true),
		reason: f.string().default("")
	},
	run: async (p, ctx) => {
		const subType = p.sub_type !== void 0 ? p.sub_type : p.type !== void 0 ? p.type : "add";
		await ctx.handleGroupRequest(p.flag, subType, p.approve, p.reason);
		return okResponse();
	}
})];
//#endregion
//#region ../protocol/src/web/friend-dress.ts
var FriendDressError = class extends Error {
	kind;
	constructor(kind, message, options) {
		super(message, options);
		this.kind = kind;
		this.name = "FriendDressError";
	}
};
/** appId → 装扮类别（取自装扮页 business-name / tab 文案）。 */
var APP_KIND = {
	2: "气泡",
	4: "挂件",
	5: "字体",
	15: "名片",
	17: "来电",
	22: "彩色屏保",
	23: "头像",
	47: "头像双击动作",
	352: "输入状态"
};
/**
* 服务器不会回真值的装扮类型：气泡(2)/字体(5)/头像(23)。这几类只按 targetUin 查
* 永远回默认款，必须客户端在请求里带对应 id 才知道对方用了啥 —— 拿到也是废数据，剔除。
*/
var UNRESOLVABLE_APPS = /* @__PURE__ */ new Set([
	2,
	5,
	23
]);
/**
* HAR 里的 traceDetail：base64({"appid":"toaio","page_id":"37","item_id":"","item_type":""})。
* 与 targetUin 无关，固定值；已是编码后的串，拼接时不可再被二次编码。
*/
var TRACE_DETAIL = "base64-eyJhcHBpZCI6InRvYWlvIiwicGFnZV9pZCI6IjM3IiwiaXRlbV9pZCI6IiIsIml0ZW1fdHlwZSI6%0AIiJ9%0A";
/** aio webview 的移动端 UA（照 HAR；桌面 UA 可能返回不同壳）。 */
var DRESS_UA = "Mozilla/5.0 (Linux; Android 13; 2109119BC Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.71 MQQBrowser/6.2 TBS/047925 Mobile Safari/537.36 V1_AND_SQ_9.2.66_13188_YYB_D QQ/9.2.66.33870 NetType/WIFI WebP/0.3.0 AppId/537339358";
var DRESS_RESPONSE_LIMITS = {
	timeoutMs: 1e4,
	maxResponseBytes: 2 * 1024 * 1024
};
/** 按 targetUin 拼装扮页 URL（结构照 HAR）。 */
function buildDressUrl(targetUin) {
	const inner = `https://zb.vip.qq.com/v2/pages/aioDressPage?fromPage=1&targetUin=${targetUin}&widgetId=0&fontEffectId=0&bgId=custom&chatId=${targetUin}&isGroup=0&traceDetail=${TRACE_DETAIL}`;
	return `https://zb.vip.qq.com/v2/pages/aioDressPage?${new URLSearchParams({
		fromPage: "1",
		enteranceId: "aio",
		url: inner,
		fontEffectId: "0",
		chatId: targetUin,
		widgetId: "0",
		targetUin,
		isGroup: "0",
		bgId: "custom"
	}).toString()}&traceDetail=${TRACE_DETAIL}`;
}
/** 从 SSR HTML 抠出 window.__INITIAL_ASYNCDATA__ 的 JSON（抠不到/坏 JSON 抛 parse）。 */
function parseAsyncData(html) {
	const m = html.match(/window\.__INITIAL_ASYNCDATA__\s*=\s*(\{[\s\S]*?\});\(function/);
	if (!m?.[1]) throw new FriendDressError("parse", "装扮页中未找到 __INITIAL_ASYNCDATA__（未登录态/风控/页面改版）");
	try {
		return JSON.parse(m[1]);
	} catch (e) {
		throw new FriendDressError("parse", "__INITIAL_ASYNCDATA__ 不是合法 JSON", { cause: e });
	}
}
/** 运行时结构校验：不符合预期的一律抛 structure，绝不带着畸形数据继续。 */
function validateAsyncData(data) {
	if (data === null || typeof data !== "object" || Array.isArray(data)) throw new FriendDressError("structure", "__INITIAL_ASYNCDATA__ 顶层不是对象");
	const d = data;
	if (typeof d["targetUin"] !== "string" || d["targetUin"].length === 0) throw new FriendDressError("structure", "targetUin 缺失或不是非空字符串");
	if (d["isSvip"] !== void 0 && typeof d["isSvip"] !== "boolean") throw new FriendDressError("structure", "isSvip 不是布尔值");
	if (d["avatarImage"] !== void 0 && typeof d["avatarImage"] !== "string") throw new FriendDressError("structure", "avatarImage 不是字符串");
	if (!Array.isArray(d["rawUsingList"])) throw new FriendDressError("structure", "rawUsingList 缺失或不是数组");
	d["rawUsingList"].forEach((item, i) => {
		if (item === null || typeof item !== "object" || Array.isArray(item)) throw new FriendDressError("structure", `rawUsingList[${i}] 不是对象`);
		const r = item;
		if (typeof r["appId"] !== "number") throw new FriendDressError("structure", `rawUsingList[${i}].appId 缺失或不是数字`);
		if (r["itemId"] !== void 0 && typeof r["itemId"] !== "number") throw new FriendDressError("structure", `rawUsingList[${i}].itemId 不是数字`);
		if (r["name"] !== void 0 && typeof r["name"] !== "string") throw new FriendDressError("structure", `rawUsingList[${i}].name 不是字符串`);
		if (r["image"] !== void 0 && typeof r["image"] !== "string") throw new FriendDressError("structure", `rawUsingList[${i}].image 不是字符串`);
		if (r["extraappinfo"] !== void 0) {
			if (r["extraappinfo"] === null || typeof r["extraappinfo"] !== "object" || Array.isArray(r["extraappinfo"])) throw new FriendDressError("structure", `rawUsingList[${i}].extraappinfo 不是对象`);
			const extraInfo = r["extraappinfo"]["extraInfo"];
			if (extraInfo !== void 0) {
				if (extraInfo === null || typeof extraInfo !== "object" || Array.isArray(extraInfo)) throw new FriendDressError("structure", `rawUsingList[${i}].extraappinfo.extraInfo 不是对象`);
				const immersiveMaterial = extraInfo["immersiveMaterial"];
				if (immersiveMaterial !== void 0 && typeof immersiveMaterial !== "string") throw new FriendDressError("structure", `rawUsingList[${i}].extraappinfo.extraInfo.immersiveMaterial 不是字符串`);
			}
		}
	});
	return data;
}
/**
* 抠出该装扮项的动态预览视频 url（没有则空串）。
*  - 名片(appId 15)：video 藏在 extraInfo.immersiveMaterial（JSON 字符串）的 videoUrl。
*  - 来电(appId 17)：无独立字段，按预览图同目录换名 (web_)image.jpg → media.mp4
*    （funCall/item/{itemId}/media.mp4，已验证可访问）；文件名不匹配时不猜测，返回空串。
*/
function resolveVideoUrl(r) {
	if (r.appId === 15) {
		const raw = r.extraappinfo?.extraInfo?.immersiveMaterial;
		if (raw === void 0) return "";
		let material;
		try {
			material = JSON.parse(raw);
		} catch (error) {
			throw new FriendDressError("structure", `装扮 appId=${r.appId} itemId=${r.itemId ?? 0} 的 immersiveMaterial 不是合法 JSON`, { cause: error });
		}
		if (material === null || typeof material !== "object" || Array.isArray(material)) throw new FriendDressError("structure", `装扮 appId=${r.appId} itemId=${r.itemId ?? 0} 的 immersiveMaterial 不是对象`);
		const videoUrl = material["videoUrl"];
		if (typeof videoUrl !== "string" || videoUrl.length === 0) throw new FriendDressError("structure", `装扮 appId=${r.appId} itemId=${r.itemId ?? 0} 的 immersiveMaterial.videoUrl 缺失或不是非空字符串`);
		return videoUrl;
	}
	if (r.appId === 17 && r.image && /\/(?:web_)?image\.jpg$/.test(r.image)) return r.image.replace(/\/(?:web_)?image\.jpg$/, "/media.mp4");
	return "";
}
function toItem(r) {
	return {
		app_id: r.appId,
		kind: APP_KIND[r.appId] ?? `appId=${r.appId}`,
		item_id: r.itemId ?? 0,
		name: r.name ?? "",
		preview_url: r.image ?? "",
		video_url: resolveVideoUrl(r),
		price: typeof r.extrainfo?.price === "number" ? r.extrainfo.price : 0
	};
}
/**
* 查 targetUin 正在用的好友装扮（挂件/名片/来电/输入状态等）。「查到但没装扮」
* 正常返回空 items；请求/解析/校验的任何一环失败都抛 {@link FriendDressError}，
* 带 kind 区分网络、未登录态/风控、页面改版、串号数据。
*/
async function getFriendDressWebAPI(cookieObject, targetUin) {
	let html;
	try {
		html = await RequestUtil.HttpGetText(buildDressUrl(targetUin), "GET", "", {
			Cookie: cookieToString(cookieObject),
			"User-Agent": DRESS_UA,
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "zh-CN,zh;q=0.9"
		}, DRESS_RESPONSE_LIMITS);
	} catch (e) {
		throw new FriendDressError("network", `装扮页请求失败: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
	}
	const data = validateAsyncData(parseAsyncData(html));
	if (data.targetUin !== targetUin) throw new FriendDressError("uin_mismatch", `装扮页返回账号 ${data.targetUin} 与请求账号 ${targetUin} 不一致`);
	return {
		target_uin: data.targetUin,
		is_svip: data.isSvip ?? false,
		avatar_url: data.avatarImage ?? "",
		items: data.rawUsingList.filter((r) => !UNRESOLVABLE_APPS.has(r.appId)).map(toItem)
	};
}
//#endregion
//#region ../protocol/src/qq-info.ts
/** Canonical SnowLuma group-request flag (version 1). */
function formatGroupRequestFlag(handle) {
	return [
		"slreq",
		"1",
		handle.sequence,
		handle.groupId,
		handle.eventType,
		handle.filtered ? 1 : 0
	].join(":");
}
//#endregion
//#region ../onebot/src/message-id.ts
var GROUP_MESSAGE_EVENT = "group_message";
var PRIVATE_MESSAGE_EVENT = "private_message";
/** Legacy/fallback namespace for private messages sent by the current account. */
var PRIVATE_SENT_MESSAGE_EVENT = "private_message_sent";
/** Namespace for private messages keyed by QQ's conversation-wide NT sequence. */
var PRIVATE_NT_MESSAGE_EVENT = "private_message_nt";
function privateMessageEventName(sentBySelf, hasNtSequence) {
	if (hasNtSequence) return PRIVATE_NT_MESSAGE_EVENT;
	return sentBySelf ? PRIVATE_SENT_MESSAGE_EVENT : PRIVATE_MESSAGE_EVENT;
}
function hashMessageIdInt32(sequence, sessionId, eventName) {
	const key = `${Number.isFinite(sequence) ? Math.trunc(sequence) : 0}:${Number.isFinite(sessionId) ? Math.trunc(sessionId) : 0}:${eventName}`;
	let id = createHash$1("sha1").update(key).digest().readInt32BE(0);
	if (id === 0) id = 1;
	return id;
}
//#endregion
//#region ../onebot/src/actions/extended.ts
var DOWNLOAD_FILE_MAX_BYTES = 1024 * 1024 * 1024;
var DOWNLOAD_FILE_TIMEOUT_MS = 6e4;
var profileLikeUserSchema = {
	type: "object",
	properties: {
		uid: {
			type: "string",
			description: "用户 uid"
		},
		uin: {
			type: "integer",
			description: "用户 QQ 号；资料中没有有效号码时为 0"
		},
		src: {
			type: "integer",
			description: "来源类型"
		},
		latestTime: {
			type: "integer",
			description: "最近互动时间戳"
		},
		count: {
			type: "integer",
			description: "互动次数"
		},
		giftCount: {
			type: "integer",
			description: "礼物数量"
		},
		customId: {
			type: "integer",
			description: "自定义标识"
		},
		lastCharged: {
			type: "integer",
			description: "最近充能时间"
		},
		bAvailableCnt: {
			type: "integer",
			description: "可用次数"
		},
		bTodayVotedCnt: {
			type: "integer",
			description: "今日已点赞次数"
		},
		nick: {
			type: "string",
			description: "昵称"
		},
		gender: {
			type: "integer",
			description: "性别"
		},
		age: {
			type: "integer",
			description: "年龄"
		},
		isFriend: {
			type: "boolean",
			description: "是否为好友"
		},
		isvip: {
			type: "boolean",
			description: "是否为会员"
		},
		isSvip: {
			type: "boolean",
			description: "是否为超级会员"
		}
	},
	required: [
		"uid",
		"uin",
		"src",
		"latestTime",
		"count",
		"giftCount",
		"customId",
		"lastCharged",
		"bAvailableCnt",
		"bTodayVotedCnt",
		"nick",
		"gender",
		"age",
		"isFriend",
		"isvip",
		"isSvip"
	]
};
function essenceNumber(value, field) {
	if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+$/.test(value))) throw new Error(`invalid group essence field ${field}: ${String(value)}`);
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isSafeInteger(parsed)) throw new Error(`invalid group essence field ${field}: ${String(value)}`);
	return parsed;
}
function essencePositiveNumber(value, field) {
	const parsed = essenceNumber(value, field);
	if (parsed <= 0) throw new Error(`group essence field ${field} must be positive: ${parsed}`);
	return parsed;
}
function essenceNonNegativeNumber(value, field) {
	const parsed = essenceNumber(value, field);
	if (parsed < 0) throw new Error(`group essence field ${field} must not be negative: ${parsed}`);
	return parsed;
}
function essenceString(value, field, allowEmpty) {
	if (typeof value !== "string" || !allowEmpty && value.trim().length === 0) throw new Error(`invalid group essence field ${field}: ${String(value)}`);
	return value;
}
function optionalEssenceText(value) {
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : void 0;
}
/** Unknown digest types (share cards, future msg_type values) degrade to
*  text so one unmapped item cannot fail the whole essence list. */
function degradeEssenceContent(content) {
	const brief = optionalEssenceText(content.share_brief);
	const title = optionalEssenceText(content.share_title);
	const summary = optionalEssenceText(content.share_summary);
	const url = optionalEssenceText(content.share_url);
	const text = optionalEssenceText(content.text);
	const heading = brief ?? title ?? summary ?? text;
	const parts = [];
	if (heading) parts.push(heading);
	if (title && title !== heading) parts.push(title);
	if (summary && summary !== heading && summary !== title) parts.push(summary);
	if (text && text !== heading) parts.push(text);
	if (url) parts.push(url);
	return {
		type: "text",
		data: { text: parts.length > 0 ? parts.join("\n") : `[essence type ${content.msg_type}]` }
	};
}
function essenceContentToSegment(content) {
	switch (content.msg_type) {
		case 1: return {
			type: "text",
			data: { text: essenceString(content.text, "msg_content.text", true) }
		};
		case 2: return {
			type: "face",
			data: { id: String(essenceNonNegativeNumber(content.face_index, "msg_content.face_index")) }
		};
		case 3: return {
			type: "image",
			data: {
				file: "",
				url: essenceString(content.image_url, "msg_content.image_url", false)
			}
		};
		case 4: {
			const fileName = essenceString(content.file_name, "msg_content.file_name", false);
			const fileId = essenceString(content.file_id, "msg_content.file_id", false);
			const fileSize = essenceNonNegativeNumber(content.file_size, "msg_content.file_size");
			return {
				type: "file",
				data: {
					file: fileName,
					file_id: fileId,
					file_size: fileSize,
					name: fileName,
					id: fileId,
					size: fileSize,
					busid: essenceNonNegativeNumber(content.file_bus_id, "msg_content.file_bus_id")
				}
			};
		}
		default: return degradeEssenceContent(content);
	}
}
function projectEssenceMessage(message, groupId) {
	const messageGroupId = essencePositiveNumber(message.group_code, "group_code");
	if (messageGroupId !== groupId) throw new Error(`group essence field group_code does not match requested group: ${messageGroupId} !== ${groupId}`);
	const sequence = essencePositiveNumber(message.msg_seq, "msg_seq");
	const random = essenceNonNegativeNumber(message.msg_random, "msg_random");
	const timestamp = essenceNonNegativeNumber(message.sender_time, "sender_time");
	const senderId = essencePositiveNumber(message.sender_uin, "sender_uin");
	const operatorId = essencePositiveNumber(message.add_digest_uin, "add_digest_uin");
	const operatorTime = essenceNonNegativeNumber(message.add_digest_time, "add_digest_time");
	const senderNick = essenceString(message.sender_nick, "sender_nick", true);
	const operatorNick = essenceString(message.add_digest_nick, "add_digest_nick", true);
	if (!Array.isArray(message.msg_content)) throw new Error(`invalid group essence field msg_content: ${String(message.msg_content)}`);
	const content = message.msg_content.map(essenceContentToSegment);
	const messageId = hashMessageIdInt32(sequence, groupId, GROUP_MESSAGE_EVENT);
	return {
		messageId,
		meta: {
			isGroup: true,
			targetId: groupId,
			sequence,
			sequenceAuthoritative: true,
			eventName: GROUP_MESSAGE_EVENT,
			clientSequence: 0,
			random,
			timestamp
		},
		result: {
			msg_seq: sequence,
			msg_random: random,
			sender_id: senderId,
			sender_nick: senderNick,
			sender_time: timestamp,
			operator_id: operatorId,
			operator_nick: operatorNick,
			operator_time: operatorTime,
			message_id: messageId,
			content
		}
	};
}
async function fetchDownloadFile(url, headers, maxBytes, timeoutMs) {
	const response = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
	const declared = Number(response.headers.get("content-length") ?? "0");
	if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`download too large: ${declared} > ${maxBytes}`);
	const reader = response.body?.getReader();
	if (!reader) {
		const bytes = Buffer.from(await response.arrayBuffer());
		if (bytes.length > maxBytes) throw new Error(`download too large: ${bytes.length} > ${maxBytes}`);
		return bytes;
	}
	const chunks = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel().catch(() => {});
				throw new Error(`download too large: > ${maxBytes}`);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	return Buffer.concat(chunks, total);
}
async function saveDownloadBuffer(buf, preferredName) {
	const fs = await import("fs");
	const pathMod = await import("path");
	const cryptoMod = await import("crypto");
	const tempDir = pathMod.resolve("data", "downloads");
	if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
	const rawName = preferredName || cryptoMod.createHash("md5").update(buf).digest("hex");
	const safeName = pathMod.basename(rawName);
	if (!safeName || safeName === "." || safeName === ".." || /[\\/]/.test(safeName)) throw new Error("invalid file name");
	const resolved = pathMod.resolve(tempDir, safeName);
	const rel = pathMod.relative(tempDir, resolved);
	if (rel.startsWith("..") || pathMod.isAbsolute(rel)) throw new Error("invalid file name");
	await fs.promises.writeFile(resolved, buf);
	return resolved;
}
function optionalExactString() {
	const inner = f.string().optional();
	return Object.assign(Object.create(inner), { coerce(raw, field) {
		if (typeof raw === "number" || typeof raw === "boolean" || raw === null || typeof raw === "object" && raw !== null) return {
			ok: false,
			field,
			reason: "expected a string"
		};
		return inner.coerce(raw, field);
	} });
}
function integerFromDecimalString(value) {
	if (value.trim() === "") return 0;
	const n = Number(value);
	return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function primitiveText(value) {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
}
var forwardPreviewParams = {
	source: f.string().optional(),
	summary: f.string().optional(),
	prompt: f.string().optional(),
	news: f.raw()
};
function readForwardPreviewMeta(p) {
	const source = p.source || void 0;
	const summary = p.summary || void 0;
	const prompt = p.prompt || void 0;
	let news;
	if (Array.isArray(p.news)) {
		const collected = [];
		for (const item of p.news) if (typeof item === "string") collected.push({ text: item });
		else if (item && typeof item === "object" && !Array.isArray(item)) {
			const text = primitiveText(item.text);
			if (text) collected.push({ text });
		}
		if (collected.length > 0) news = collected;
	}
	if (!source && !summary && !prompt && !news) return void 0;
	return {
		source,
		summary,
		prompt,
		news
	};
}
async function groupTodoRun(p, ctx, op) {
	const meta = ctx.getMessageMeta(p.message_id);
	if (!meta) return failedResponse(RETCODE.ACTION_FAILED, "message not found");
	if (!meta.isGroup || meta.targetId !== p.group_id) return failedResponse(RETCODE.ACTION_FAILED, "message does not belong to this group");
	if (!hasAuthoritativeSequence(meta)) return failedResponse(RETCODE.ACTION_FAILED, "message has no authoritative QQ sequence");
	await op(p.group_id, BigInt(meta.sequence));
	return okResponse();
}
function parseFlashTaskFiles(raw) {
	const items = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
	if (items.length === 0) return { error: "files must not be empty" };
	const files = [];
	for (const item of items) {
		if (typeof item === "string") {
			if (item === "") return { error: "files must not be empty" };
			files.push({ file: item });
			continue;
		}
		if (item && typeof item === "object" && !Array.isArray(item)) {
			const file = item.file;
			const name = item.name;
			if (typeof file !== "string" || file === "") return { error: "files must not be empty" };
			if (name !== void 0 && typeof name !== "string") return { error: "files[].name must be a string" };
			files.push({
				file,
				name
			});
			continue;
		}
		return { error: "files must be a path string, { file, name }, or an array of those" };
	}
	return { files };
}
/** FlashTransferApi 返回的 FlashFileInfo → OneBot JSON 响应（plain object，JsonObject 兼容）。
*  字段名对齐 NapCat（get_flash_file_list 用 size，非 file_size），便于客户端 drop-in 迁移。 */
function flashFileInfoToJson(f) {
	return {
		fileset_id: f.filesetUuid,
		file_name: f.fileName,
		orig_name: f.origName,
		size: f.fileSize,
		share_url: f.shareUrl,
		file_id: f.fileId,
		download_url: f.downloadUrl
	};
}
var actions$5 = [
	defineAction({
		name: "send_like",
		summary: "点赞",
		params: {
			user_id: f.userId(),
			times: f.int({ min: 0 }).default(1)
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.interaction.sendLike(p.user_id, p.times);
			return okResponse();
		}
	}),
	defineAction({
		name: "friend_poke",
		summary: "好友拍一拍",
		params: {
			user_id: f.userId(),
			target_id: f.userId().optional()
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.interaction.sendPoke(false, p.user_id, p.target_id);
			return okResponse();
		}
	}),
	groupUserAction({
		name: "group_poke",
		summary: "群拍一拍",
		run: async (p, ctx) => {
			await ctx.bridge.apis.interaction.sendPoke(true, p.group_id, p.user_id);
			return okResponse();
		}
	}),
	defineAction({
		name: "send_poke",
		summary: "拍一拍（群聊/私聊自动路由）",
		params: {
			user_id: f.userId(),
			group_id: f.groupId().optional()
		},
		run: async (p, ctx) => {
			if (p.group_id) await ctx.bridge.apis.interaction.sendPoke(true, p.group_id, p.user_id);
			else await ctx.bridge.apis.interaction.sendPoke(false, p.user_id);
			return okResponse();
		}
	}),
	defineAction({
		name: "set_essence_msg",
		summary: "设置精华消息",
		params: { message_id: f.messageId() },
		run: async (p, ctx) => {
			await ctx.setEssenceMsg(p.message_id);
			return okResponse();
		}
	}),
	defineAction({
		name: "delete_essence_msg",
		summary: "移除精华消息",
		params: { message_id: f.messageId() },
		run: async (p, ctx) => {
			await ctx.deleteEssenceMsg(p.message_id);
			return okResponse();
		}
	}),
	groupAction({
		name: "get_essence_msg_list",
		summary: "获取精华消息列表",
		readOnly: true,
		run: async (p, ctx) => {
			try {
				const projections = (await ctx.bridge.apis.web.getEssenceAll(p.group_id)).flatMap((res) => res.data.msg_list).filter((message) => message !== null).map((message) => projectEssenceMessage(message, p.group_id));
				ctx.cacheMessageMetas(projections.map(({ messageId, meta }) => ({
					messageId,
					meta
				})));
				return okResponse(projections.map(({ result }) => result));
			} catch (e) {
				return failedResponse(RETCODE.ACTION_FAILED, `获取精华消息失败: ${e}`);
			}
		}
	}),
	defineAction({
		name: "set_group_reaction",
		summary: "群聊表情回应",
		params: {
			group_id: f.groupId().optional(),
			message_id: f.messageId(),
			code: f.string({ allowEmpty: false }),
			is_set: f.bool().default(true)
		},
		run: async (p, ctx) => {
			const meta = ctx.getMessageMeta(p.message_id);
			if (!meta || !meta.isGroup) return failedResponse(RETCODE.ACTION_FAILED, "message not found or not a group message");
			if (p.group_id && p.group_id !== meta.targetId) return failedResponse(RETCODE.BAD_REQUEST, "group_id does not match message session");
			if (!hasAuthoritativeSequence(meta)) return failedResponse(RETCODE.ACTION_FAILED, "message has no authoritative QQ sequence");
			await ctx.bridge.apis.interaction.setReaction(meta.targetId, meta.sequence, p.code, p.is_set);
			return okResponse();
		}
	}),
	defineAction({
		name: "delete_custom_face",
		summary: "删除收藏表情",
		params: { emoji_id: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.deleteCustomFace(p.emoji_id);
			return okResponse();
		}
	}),
	defineAction({
		name: "add_custom_face",
		summary: "添加收藏表情",
		params: { file: f.image() },
		run: async (p, ctx) => {
			return okResponse({ emoji_id: await ctx.bridge.apis.profile.addCustomFace(p.file) });
		}
	}),
	defineAction({
		name: "modify_custom_face",
		summary: "修改收藏表情备注",
		params: {
			emoji_id: f.string({ allowEmpty: false }),
			desc: f.string().default("")
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.modifyCustomFace(p.emoji_id, p.desc);
			return okResponse();
		}
	}),
	defineAction({
		name: "move_custom_face_to_front",
		summary: "收藏表情移到最前",
		params: { emoji_id: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.moveCustomFaceToFront(p.emoji_id);
			return okResponse();
		}
	}),
	groupAction({
		name: "get_group_msg_history",
		summary: "获取群消息历史",
		readOnly: true,
		returns: "{ messages }：群消息事件对象数组（每项为 OneBot 消息事件，内部字段不固定）。",
		returnsSchema: {
			type: "object",
			properties: { messages: {
				type: "array",
				description: "消息事件对象数组",
				items: { type: "object" }
			} },
			required: ["messages"]
		},
		params: {
			message_id: f.int().default(0).role("message_id"),
			count: f.int({ min: 0 }).default(20),
			reverse_order: f.bool().default(true).describe("仅在 message_id 非 0 时生效；true 返回锚点及更旧消息，false 返回锚点及更新消息")
		},
		run: async (p, ctx) => {
			return okResponse({ messages: await ctx.getGroupMsgHistory(p.group_id, p.message_id, p.count, p.reverse_order) });
		}
	}),
	defineAction({
		name: "get_friend_msg_history",
		summary: "获取好友消息历史（无锚点时从服务器获取最新双向记录）",
		readOnly: true,
		returns: "{ messages }：好友消息事件对象数组（每项为 OneBot 消息事件，内部字段不固定）。",
		returnsSchema: {
			type: "object",
			properties: { messages: {
				type: "array",
				description: "消息事件对象数组",
				items: { type: "object" }
			} },
			required: ["messages"]
		},
		params: {
			user_id: f.userId(),
			message_id: f.int().default(0).role("message_id"),
			count: f.int({ min: 0 }).default(20).describe("无锚点时从 QQ 服务器获取最新双向历史；服务器或身份解析失败时动作失败，不返回不完整的本地缓存"),
			reverse_order: f.bool().default(true).describe("仅在 message_id 非 0 时生效；true 返回锚点及更旧消息，false 返回锚点及更新消息")
		},
		run: async (p, ctx) => {
			return okResponse({ messages: await ctx.getFriendMsgHistory(p.user_id, p.message_id, p.count, p.reverse_order) });
		}
	}),
	defineAction({
		name: "mark_group_msg_as_read",
		summary: "标记群消息已读",
		params: {
			message_id: f.messageId(),
			group_id: f.groupId().optional()
		},
		run: async (p, ctx) => {
			const meta = ctx.getMessageMeta(p.message_id);
			if (!meta || !meta.isGroup) return failedResponse(RETCODE.ACTION_FAILED, "message not found or not a group message");
			if (p.group_id && p.group_id !== meta.targetId) return failedResponse(RETCODE.BAD_REQUEST, "group_id does not match message session");
			await ctx.bridge.apis.message.markGroupRead(meta.targetId);
			return okResponse();
		}
	}),
	defineAction({
		name: "mark_private_msg_as_read",
		summary: "标记私聊消息已读",
		params: {
			message_id: f.messageId(),
			user_id: f.userId().optional()
		},
		run: async (p, ctx) => {
			const meta = ctx.getMessageMeta(p.message_id);
			if (!meta || meta.isGroup) return failedResponse(RETCODE.ACTION_FAILED, "message not found or not a private message");
			if (p.user_id && p.user_id !== meta.targetId) return failedResponse(RETCODE.BAD_REQUEST, "user_id does not match message session");
			await ctx.bridge.apis.message.markPrivateRead(meta.targetId);
			return okResponse();
		}
	}),
	defineAction({
		name: "mark_msg_as_read",
		summary: "标记消息已读（群聊/私聊自动路由）",
		params: {
			message_id: f.messageId(),
			target_id: f.uint().optional()
		},
		run: async (p, ctx) => {
			const meta = ctx.getMessageMeta(p.message_id);
			if (!meta) return failedResponse(RETCODE.ACTION_FAILED, "message not found");
			if (p.target_id && p.target_id !== meta.targetId) return failedResponse(RETCODE.BAD_REQUEST, "target_id does not match message session");
			if (meta.isGroup) await ctx.bridge.apis.message.markGroupRead(meta.targetId);
			else await ctx.bridge.apis.message.markPrivateRead(meta.targetId);
			return okResponse();
		}
	}),
	groupAction({
		name: "_send_group_notice",
		summary: "发送群公告（支持置顶、弹窗、新成员、群昵称引导与确认）",
		params: {
			content: f.string({ allowEmpty: false }).describe("公告正文"),
			image: f.string().default("").role("image").describe("可选公告图片（本地路径、URL 或 base64）"),
			pinned: f.int({
				min: 0,
				max: 1
			}).default(0).describe("是否置顶：1=置顶，0=不置顶"),
			type: f.int().optional().describe("发布类型：1=普通公告，20=新成员公告；建议使用 send_to_new_members"),
			send_to_new_members: f.bool().optional().describe("是否在成员新加入群时发送（与 type=20 等价）"),
			is_show_edit_card: f.int({
				min: 0,
				max: 1
			}).default(1).describe("是否引导群成员修改群昵称：1=是，0=否"),
			tip_window_type: f.int({
				min: 0,
				max: 1
			}).default(1).describe("弹窗展示：0=开启弹窗，1=关闭弹窗（QQ 原始字段为反向语义）"),
			confirm_required: f.int({
				min: 0,
				max: 1
			}).default(1).describe("是否需要群成员确认收到：1=是，0=否")
		},
		rules: (r) => [r.rule("type must be 1 (regular) or 20 (new members)", (p) => p.type === void 0 || p.type === 1 || p.type === 20), r.rule("send_to_new_members conflicts with type", (p) => p.send_to_new_members === void 0 || p.type === void 0 || p.type === (p.send_to_new_members ? 20 : 1))],
		run: async (p, ctx) => {
			const options = {
				image: p.image || void 0,
				pinned: p.pinned,
				type: p.type,
				sendToNewMembers: p.send_to_new_members,
				isShowEditCard: p.is_show_edit_card,
				tipWindowType: p.tip_window_type,
				confirmRequired: p.confirm_required
			};
			await ctx.bridge.apis.web.sendNotice(p.group_id, p.content, options);
			return okResponse();
		}
	}),
	groupAction({
		name: "_get_group_notice",
		summary: "获取群公告",
		returns: "普通公告与新成员公告的合并数组；send_to_new_members 标识后者；图片含 id、url、宽高",
		readOnly: true,
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.web.getNotice(p.group_id));
		}
	}),
	defineAction({
		name: "upload_forward_msg",
		summary: "上传转发消息",
		params: {
			messages: f.message().optional(),
			message: f.message().optional(),
			group_id: f.groupId().optional()
		},
		run: async (p, ctx) => {
			const messages = p.messages ?? p.message;
			const groupId = p.group_id ?? 0;
			if (messages === void 0) return failedResponse(RETCODE.BAD_REQUEST, "message/messages is required");
			const result = await ctx.sendForwardMsg(messages, groupId > 0 ? groupId : void 0);
			const data = {
				res_id: result.forwardId,
				forward_id: result.forwardId,
				message_id: 0
			};
			if (groupId > 0) data.group_id = groupId;
			return okResponse(data);
		}
	}),
	defineAction({
		name: "upload_foward_msg",
		summary: "上传转发消息（别名拼写）",
		params: {
			messages: f.message().optional(),
			message: f.message().optional(),
			group_id: f.groupId().optional()
		},
		run: async (p, ctx) => {
			const messages = p.messages ?? p.message;
			const groupId = p.group_id ?? 0;
			if (messages === void 0) return failedResponse(RETCODE.BAD_REQUEST, "message/messages is required");
			const result = await ctx.sendForwardMsg(messages, groupId > 0 ? groupId : void 0);
			return okResponse({
				res_id: result.forwardId,
				forward_id: result.forwardId,
				message_id: 0
			});
		}
	}),
	defineAction({
		name: "get_image",
		summary: "获取图片信息",
		readOnly: true,
		params: {
			file: f.string().default("").role("image"),
			file_id: f.string().default("").role("file_id")
		},
		run: async (p, ctx) => {
			const file = p.file || p.file_id;
			if (!file) return failedResponse(RETCODE.BAD_REQUEST, "file is required");
			const info = await ctx.getImageInfo(file);
			if (info) return okResponse(info);
			return failedResponse(RETCODE.ACTION_FAILED, "image not found in cache");
		}
	}),
	defineAction({
		name: "get_record",
		summary: "获取语音信息；传 out_format 则服务端转码并附带 base64",
		readOnly: true,
		params: {
			file: f.string().default("").role("record"),
			file_id: f.string().default("").role("file_id"),
			out_format: f.enum("mp3", "amr", "wma", "m4a", "spx", "ogg", "wav", "flac").optional()
		},
		run: async (p, ctx) => {
			const file = p.file || p.file_id;
			if (!file) return failedResponse(RETCODE.BAD_REQUEST, "file is required");
			const info = await ctx.getRecordInfo(file);
			if (!info) return failedResponse(RETCODE.ACTION_FAILED, "record not found in cache");
			if (!p.out_format) return okResponse(info);
			const source = String(info.url || info.file || "");
			if (!source) return failedResponse(RETCODE.ACTION_FAILED, "record has no downloadable source");
			try {
				const { base64 } = await ctx.bridge.apis.extras.convertRecord(source, p.out_format);
				return okResponse({
					...info,
					out_format: p.out_format,
					base64
				});
			} catch (e) {
				return failedResponse(RETCODE.ACTION_FAILED, `语音转码失败：${e instanceof Error ? e.message : String(e)}`);
			}
		}
	}),
	defineAction({
		name: [
			"fetch_ptt_text",
			"get_ptt_text",
			"get_record_text"
		],
		summary: "获取语音转文字结果",
		readOnly: true,
		returns: "{ text }：语音识别出的文本。",
		returnsSchema: {
			type: "object",
			properties: { text: {
				type: "string",
				description: "语音转写文本"
			} },
			required: ["text"]
		},
		params: { message_id: f.messageId() },
		run: async (p, ctx) => {
			return okResponse(await ctx.fetchPttText(p.message_id));
		}
	}),
	defineAction({
		name: "get_cookies",
		summary: "获取 Cookies",
		readOnly: true,
		returns: "{ cookies }：指定域名的 Cookie 字符串。",
		returnsSchema: {
			type: "object",
			properties: { cookies: {
				type: "string",
				description: "该域名的 Cookie 字符串"
			} },
			required: ["cookies"]
		},
		params: { domain: f.string().default("qun.qq.com") },
		run: async (p, ctx) => {
			return okResponse({ cookies: await ctx.bridge.apis.web.getCookiesStr(p.domain || "qun.qq.com") });
		}
	}),
	defineAction({
		name: "get_csrf_token",
		summary: "获取 CSRF 令牌",
		readOnly: true,
		returns: "{ token }：CSRF 令牌（bkn，数值）。",
		returnsSchema: {
			type: "object",
			properties: { token: {
				type: "integer",
				description: "CSRF 令牌（bkn）"
			} },
			required: ["token"]
		},
		params: {},
		run: async (_p, ctx) => {
			return okResponse({ token: await ctx.bridge.apis.web.getCsrfToken() });
		}
	}),
	defineAction({
		name: "get_credentials",
		summary: "获取凭证",
		readOnly: true,
		returns: "{ cookies, token, csrf_token }：Cookie 字符串与 CSRF 令牌（token 与 csrf_token 同值）。",
		returnsSchema: {
			type: "object",
			properties: {
				cookies: {
					type: "string",
					description: "该域名的 Cookie 字符串"
				},
				token: {
					type: "integer",
					description: "CSRF 令牌（bkn）"
				},
				csrf_token: {
					type: "integer",
					description: "CSRF 令牌（同 token）"
				}
			},
			required: [
				"cookies",
				"token",
				"csrf_token"
			]
		},
		params: { domain: f.string().default("qun.qq.com") },
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.web.getCredentials(p.domain || "qun.qq.com"));
		}
	}),
	defineAction({
		name: "set_restart",
		summary: "重启（不支持）",
		params: {},
		run: async () => {
			return failedResponse(RETCODE.ACTION_FAILED, "not supported");
		}
	}),
	defineAction({
		name: "clean_cache",
		summary: "清理缓存",
		params: {},
		run: async () => {
			return okResponse();
		}
	}),
	defineAction({
		name: "set_friend_remark",
		summary: "设置好友备注",
		params: {
			user_id: f.userId(),
			remark: f.string()
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.friend.setRemark(p.user_id, p.remark);
			return okResponse();
		}
	}),
	defineAction({
		name: "set_group_remark",
		summary: "设置群备注",
		params: {
			group_id: f.groupId(),
			remark: f.string()
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setRemark(p.group_id, p.remark);
			return okResponse();
		}
	}),
	defineAction({
		name: "set_msg_emoji_like",
		summary: "设置消息表情回应",
		params: {
			message_id: f.messageId(),
			emoji_id: f.string({ allowEmpty: false }),
			set: f.bool().default(true)
		},
		run: async (p, ctx) => {
			await ctx.setMsgEmojiLike(p.message_id, p.emoji_id, p.set);
			return okResponse();
		}
	}),
	defineAction({
		name: "_mark_all_as_read",
		summary: "标记全部已读",
		params: {},
		run: async (_p, ctx) => {
			const sessions = ctx.listReadSessions();
			await ctx.bridge.apis.message.markAllRead(sessions.groupIds, sessions.privateUserIds);
			return okResponse();
		}
	}),
	groupAction({
		name: "get_group_file_system_info",
		summary: "获取群文件系统信息",
		readOnly: true,
		returns: "{ file_count, limit_count, used_space, total_space }：群文件数量与容量信息（均为服务端实际值）。",
		returnsSchema: {
			type: "object",
			properties: {
				file_count: {
					type: "integer",
					description: "当前文件数"
				},
				limit_count: {
					type: "integer",
					description: "文件数上限"
				},
				used_space: {
					type: "integer",
					description: "已用空间（字节）"
				},
				total_space: {
					type: "integer",
					description: "总空间（字节）"
				}
			},
			required: [
				"file_count",
				"limit_count",
				"used_space",
				"total_space"
			]
		},
		run: async (p, ctx) => {
			const [count, space] = await Promise.all([ctx.bridge.apis.groupFile.getCount(p.group_id), ctx.bridge.apis.groupFile.getSpace(p.group_id)]);
			return okResponse({
				file_count: count.fileCount,
				limit_count: count.maxCount,
				used_space: space.usedSpace,
				total_space: space.totalSpace
			});
		}
	}),
	defineAction({
		name: "check_url_safely",
		summary: "检查链接安全性",
		readOnly: true,
		returns: "{ level }：安全等级（占位实现，恒为 1）。",
		returnsSchema: {
			type: "object",
			properties: { level: {
				type: "integer",
				description: "安全等级（占位，恒 1）"
			} },
			required: ["level"]
		},
		params: {},
		run: async () => {
			return okResponse({ level: 1 });
		}
	}),
	defineAction({
		name: "set_qq_profile",
		summary: "设置 QQ 资料",
		params: {
			nickname: f.string().optional(),
			personal_note: f.string().optional(),
			sex: f.int({
				min: 0,
				max: 2
			}).optional().describe("0 未知，1 男，2 女")
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.setProfile(p.nickname, p.personal_note, p.sex);
			return okResponse();
		}
	}),
	defineAction({
		name: "set_online_status",
		summary: "设置在线状态",
		params: {
			status: f.int({ nonZero: true }),
			ext_status: f.int({ min: 0 }).default(0),
			battery_status: f.int({ min: 0 }).default(100)
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.setOnlineStatus(p.status, p.ext_status, p.battery_status);
			return okResponse();
		}
	}),
	defineAction({
		name: "set_diy_online_status",
		summary: "设置自定义在线状态",
		params: {
			face_id: f.faceId(),
			face_type: f.int({ min: 0 }).default(1),
			wording: f.string().default("")
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.setDiyOnlineStatus(p.face_id, p.wording, p.face_type);
			return okResponse();
		}
	}),
	defineAction({
		name: "get_group_ignored_notifies",
		summary: "获取被过滤的入群请求",
		readOnly: true,
		returns: "被过滤的入群请求数组，每项含群号、申请人、邀请人、留言与处理标记。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					group_id: {
						type: "integer",
						description: "群号"
					},
					group_name: {
						type: "string",
						description: "群名称"
					},
					request_id: {
						type: "integer",
						description: "请求序列号"
					},
					requester_uin: {
						type: "integer",
						description: "申请人 QQ 号"
					},
					requester_nick: {
						type: "string",
						description: "申请人昵称"
					},
					message: {
						type: "string",
						description: "验证留言"
					},
					checked: {
						type: "boolean",
						description: "是否已处理"
					},
					actor: {
						type: "integer",
						description: "处理人 QQ 号"
					},
					invitor_uin: {
						type: "integer",
						description: "邀请人 QQ 号"
					},
					invitor_nick: {
						type: "string",
						description: "邀请人昵称"
					},
					flag: {
						type: "string",
						description: "处理请求使用的规范 flag"
					}
				},
				required: [
					"group_id",
					"group_name",
					"request_id",
					"requester_uin",
					"requester_nick",
					"message",
					"checked",
					"actor",
					"invitor_uin",
					"invitor_nick",
					"flag"
				]
			}
		},
		params: {},
		run: async (_p, ctx) => {
			return okResponse((await fetchFilteredGroupRequests(ctx)).map((r) => ({
				group_id: r.groupId,
				group_name: r.groupName,
				request_id: r.sequence,
				requester_uin: r.targetUin,
				requester_nick: r.targetName,
				message: r.comment,
				checked: r.state !== 1,
				actor: r.operatorUin,
				invitor_uin: r.invitorUin,
				invitor_nick: r.invitorName,
				flag: formatGroupRequestFlag(r)
			})));
		}
	}),
	defineAction({
		name: "get_group_ignore_add_request",
		summary: "获取被忽略的入群请求（NapCat）",
		readOnly: true,
		returns: "被忽略的入群请求数组（NapCat 字段命名），每项含请求序列、邀请人、群信息与处理标记。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					request_id: {
						type: "integer",
						description: "请求序列号"
					},
					invitor_uin: {
						type: "integer",
						description: "邀请人 QQ 号"
					},
					invitor_nick: {
						type: "string",
						description: "邀请人昵称"
					},
					group_id: {
						type: "integer",
						description: "群号"
					},
					message: {
						type: "string",
						description: "验证留言"
					},
					group_name: {
						type: "string",
						description: "群名称"
					},
					checked: {
						type: "boolean",
						description: "是否已处理"
					},
					actor: {
						type: "integer",
						description: "处理人 QQ 号"
					},
					requester_nick: {
						type: "string",
						description: "申请人昵称"
					}
				},
				required: [
					"request_id",
					"invitor_uin",
					"invitor_nick",
					"group_id",
					"message",
					"group_name",
					"checked",
					"actor",
					"requester_nick"
				]
			}
		},
		params: {},
		run: async (_p, ctx) => {
			return okResponse((await fetchFilteredGroupRequests(ctx)).map((r) => ({
				request_id: r.sequence,
				invitor_uin: r.invitorUin,
				invitor_nick: r.invitorName,
				group_id: r.groupId,
				message: r.comment,
				group_name: r.groupName,
				checked: r.state !== 1,
				actor: r.operatorUin,
				requester_nick: r.targetName
			})));
		}
	}),
	groupAction({
		name: "get_group_shut_list",
		summary: "获取群禁言列表",
		readOnly: true,
		returns: "仍在禁言中的成员数组，每项含 QQ 号、昵称与禁言到期时间戳（秒）。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					user_id: {
						type: "integer",
						description: "成员 QQ 号"
					},
					nickname: {
						type: "string",
						description: "成员昵称"
					},
					shut_up_time: {
						type: "integer",
						description: "禁言到期时间戳（秒）"
					}
				},
				required: [
					"user_id",
					"nickname",
					"shut_up_time"
				]
			}
		},
		run: async (p, ctx) => {
			const members = await ctx.bridge.apis.contacts.fetchGroupMemberList(p.group_id);
			const nowSec = Math.floor(Date.now() / 1e3);
			return okResponse(members.filter((m) => (m.shutUpTime ?? 0) > nowSec).map((m) => ({
				user_id: m.uin,
				nickname: m.nickname,
				shut_up_time: m.shutUpTime
			})));
		}
	}),
	groupAction({
		name: "get_group_signed_list",
		summary: "获取群今日打卡列表",
		readOnly: true,
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.web.getSignedList(p.group_id));
		}
	}),
	defineAction({
		name: "forward_friend_single_msg",
		summary: "转发单条消息给好友",
		params: {
			message_id: f.messageId(),
			user_id: f.userId()
		},
		run: async (p, ctx) => {
			return okResponse({ message_id: (await ctx.forwardSingleMsg(p.message_id, { userId: p.user_id })).messageId });
		}
	}),
	defineAction({
		name: "forward_group_single_msg",
		summary: "转发单条消息到群",
		params: {
			message_id: f.messageId(),
			group_id: f.groupId()
		},
		run: async (p, ctx) => {
			return okResponse({ message_id: (await ctx.forwardSingleMsg(p.message_id, { groupId: p.group_id })).messageId });
		}
	}),
	defineAction({
		name: "get_profile_like",
		summary: "获取资料点赞",
		readOnly: true,
		returns: "点赞资料：uid、最近点赞时间、收藏与点赞统计及用户明细。",
		returnsSchema: {
			type: "object",
			properties: {
				uid: {
					type: "string",
					description: "用户 uid"
				},
				time: {
					type: "integer",
					description: "最近点赞时间戳"
				},
				favoriteInfo: {
					type: "object",
					description: "收藏统计",
					properties: {
						total_count: {
							type: "integer",
							description: "收藏总数"
						},
						last_time: {
							type: "integer",
							description: "最近收藏时间戳"
						},
						today_count: {
							type: "integer",
							description: "今日收藏数"
						},
						userInfos: {
							type: "array",
							description: "收藏用户列表",
							items: profileLikeUserSchema
						}
					}
				},
				voteInfo: {
					type: "object",
					description: "点赞统计",
					properties: {
						total_count: {
							type: "integer",
							description: "点赞总数"
						},
						new_count: {
							type: "integer",
							description: "新增点赞数"
						},
						new_nearby_count: {
							type: "integer",
							description: "附近的人新增点赞数"
						},
						last_visit_time: {
							type: "integer",
							description: "最近访问时间戳"
						},
						userInfos: {
							type: "array",
							description: "点赞用户列表",
							items: profileLikeUserSchema
						}
					}
				}
			},
			required: [
				"uid",
				"time",
				"favoriteInfo",
				"voteInfo"
			]
		},
		params: {
			user_id: f.int({ min: 0 }).default(0).role("user_id"),
			start: f.int({ min: 0 }).default(0),
			count: f.int({ min: 0 }).default(10)
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.profile.getLike(p.user_id, p.start, p.count));
		}
	}),
	defineAction({
		name: "fetch_custom_face",
		summary: "获取自定义表情",
		readOnly: true,
		returns: "字符串数组：return_type=url 时为图片 URL，return_type=id 时为 emoji_id。",
		returnsSchema: {
			type: "array",
			items: {
				type: "string",
				description: "图片 URL 或 emoji_id（取决于 return_type）"
			}
		},
		params: {
			count: f.int({ min: 0 }).default(10),
			return_type: f.string().default("url")
		},
		run: async (p, ctx) => {
			if (p.return_type === "id") return okResponse(await ctx.bridge.apis.profile.fetchCustomFaceIds(p.count));
			return okResponse(await ctx.bridge.apis.profile.fetchCustomFace(p.count));
		}
	}),
	defineAction({
		name: "fetch_custom_face_detail",
		summary: "获取自定义表情详情",
		readOnly: true,
		returns: "自定义表情详情数组，包含资源标识、图片地址、摘要与描述。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					emoji_id: {
						type: "string",
						description: "可传给 SnowLuma 表情管理接口的资源标识"
					},
					resId: {
						type: "string",
						description: "兼容 NapCat 的资源标识"
					},
					url: {
						type: "string",
						description: "表情图片地址"
					},
					md5: {
						type: "string",
						description: "表情内容摘要"
					},
					desc: {
						type: "string",
						description: "自定义表情描述；未设置时为空字符串"
					}
				},
				required: [
					"emoji_id",
					"resId",
					"url",
					"md5",
					"desc"
				]
			}
		},
		params: { count: f.int({ min: 0 }).default(48) },
		run: async (p, ctx) => {
			return okResponse((await ctx.bridge.apis.profile.fetchCustomFaceDetails(p.count)).map((detail) => ({
				emoji_id: detail.emojiId,
				resId: detail.emojiId,
				url: detail.url,
				md5: detail.md5,
				desc: detail.desc
			})));
		}
	}),
	defineAction({
		name: "get_emoji_likes",
		summary: "获取表情回应用户",
		readOnly: true,
		returns: "{ emoji_like_list }：回应该表情的用户列表（nick_name 恒为空串）。",
		returnsSchema: {
			type: "object",
			properties: { emoji_like_list: {
				type: "array",
				description: "回应用户列表",
				items: {
					type: "object",
					properties: {
						user_id: {
							type: "string",
							description: "用户 QQ 号（字符串）"
						},
						nick_name: {
							type: "string",
							description: "昵称（当前实现恒为空串）"
						}
					},
					required: ["user_id", "nick_name"]
				}
			} },
			required: ["emoji_like_list"]
		},
		params: {
			message_id: f.messageId(),
			emoji_id: f.string({ allowEmpty: false })
		},
		run: async (p, ctx) => {
			return okResponse({ emoji_like_list: (await ctx.fetchEmojiLikeUsers(p.message_id, p.emoji_id, 1e3)).users.map((u) => ({
				user_id: String(u.uin),
				nick_name: ""
			})) });
		}
	}),
	defineAction({
		name: "fetch_emoji_like",
		summary: "获取表情回应用户（NapCat 分页）",
		readOnly: true,
		returns: "分页的表情回应用户列表（NapCat 形状），含分页游标 cookie 与首/末页标记。",
		returnsSchema: {
			type: "object",
			properties: {
				result: {
					type: "integer",
					description: "结果码（恒 0）"
				},
				errMsg: {
					type: "string",
					description: "错误信息（恒空串）"
				},
				emojiLikesList: {
					type: "array",
					description: "回应用户列表",
					items: {
						type: "object",
						properties: {
							tinyId: {
								type: "string",
								description: "用户 QQ 号（字符串）"
							},
							nickName: {
								type: "string",
								description: "昵称（恒空串）"
							},
							headUrl: {
								type: "string",
								description: "头像 URL（恒空串）"
							}
						},
						required: [
							"tinyId",
							"nickName",
							"headUrl"
						]
					}
				},
				cookie: {
					type: "string",
					description: "下一页游标（末页为空串）"
				},
				isLastPage: {
					type: "boolean",
					description: "是否末页"
				},
				isFirstPage: {
					type: "boolean",
					description: "是否首页"
				}
			},
			required: [
				"result",
				"errMsg",
				"emojiLikesList",
				"cookie",
				"isLastPage",
				"isFirstPage"
			]
		},
		params: {
			message_id: f.messageId(),
			emojiId: f.string({ allowEmpty: false }),
			count: f.int({ min: 0 }).default(10),
			cookie: f.string().default("")
		},
		run: async (p, ctx) => {
			const offset = p.cookie ? Number.parseInt(p.cookie, 10) || 0 : 0;
			const result = await ctx.fetchEmojiLikeUsers(p.message_id, p.emojiId, p.count, offset);
			const nextOffset = offset + result.users.length;
			const isLastPage = nextOffset >= result.cachedCount;
			return okResponse({
				result: 0,
				errMsg: "",
				emojiLikesList: result.users.map((u) => ({
					tinyId: String(u.uin),
					nickName: "",
					headUrl: ""
				})),
				cookie: isLastPage ? "" : String(nextOffset),
				isLastPage,
				isFirstPage: offset === 0
			});
		}
	}),
	defineAction({
		name: "get_msg_emoji_likes",
		summary: "获取一条消息的全部表情回应",
		readOnly: true,
		returns: "该消息上每个表情回应的编号、数量与用户列表。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					emoji_id: {
						type: "string",
						description: "表情编号"
					},
					emoji_type: {
						type: "integer",
						description: "表情类型"
					},
					count: {
						type: "integer",
						description: "回应数量"
					},
					last_reaction_time: {
						type: "integer",
						description: "最近一次回应时间"
					},
					users: {
						type: "array",
						items: {
							type: "object",
							properties: { user_id: {
								type: "integer",
								description: "用户 QQ 号"
							} },
							required: ["user_id"]
						}
					}
				},
				required: [
					"emoji_id",
					"emoji_type",
					"count",
					"last_reaction_time",
					"users"
				]
			}
		},
		params: { message_id: f.messageId() },
		run: async (p, ctx) => {
			if (!ctx.fetchEmojiLikeSummary) return failedResponse(RETCODE.ACTION_FAILED, "emoji reaction summary is unavailable");
			return okResponse(await ctx.fetchEmojiLikeSummary(p.message_id));
		}
	}),
	defineAction({
		name: "get_friends_with_category",
		summary: "获取分组好友列表",
		readOnly: true,
		returns: "好友分组数组；每组包含 categoryId、categoryName、categoryMbCount 和 buddyList。",
		returnsSchema: {
			type: "array",
			description: "带分组的好友列表",
			items: {
				type: "object",
				properties: {
					categoryId: {
						type: "integer",
						description: "分组 ID"
					},
					categoryName: {
						type: "string",
						description: "分组名称"
					},
					categoryMbCount: {
						type: "integer",
						description: "服务端报告的分组好友数"
					},
					buddyList: {
						type: "array",
						description: "该分组内的好友",
						items: {
							type: "object",
							properties: {
								user_id: {
									type: "integer",
									description: "QQ 号"
								},
								nickname: {
									type: "string",
									description: "昵称"
								},
								remark: {
									type: "string",
									description: "好友备注"
								}
							},
							required: [
								"user_id",
								"nickname",
								"remark"
							]
						}
					}
				},
				required: [
					"categoryId",
					"categoryName",
					"categoryMbCount",
					"buddyList"
				]
			}
		},
		params: {},
		run: async (_p, ctx) => {
			return okResponse((await ctx.bridge.apis.contacts.fetchFriendCategories()).map((category) => ({
				categoryId: category.categoryId,
				categoryName: category.categoryName,
				categoryMbCount: category.memberCount,
				buddyList: category.friends.map((friend) => ({
					user_id: friend.uin,
					nickname: friend.nickname,
					remark: friend.remark
				}))
			})));
		}
	}),
	defineAction({
		name: "set_friends_category",
		summary: "移动好友到指定分组",
		returns: "成功时返回空数据。",
		params: {
			uin: f.userId().describe("要移动的好友 QQ 号"),
			categoryId: f.int({ min: 0 }).optional().describe("目标分组 ID"),
			categoryName: f.string({ allowEmpty: false }).optional().describe("目标分组名称（必须唯一且完全匹配）")
		},
		rules: (rules) => [rules.exactlyOneOf("categoryId", "categoryName")],
		run: async (params, ctx) => {
			await ctx.bridge.apis.contacts.setFriendCategory({
				uin: params.uin,
				categoryId: params.categoryId,
				categoryName: params.categoryName
			});
			return okResponse();
		}
	}),
	defineAction({
		name: "get_recent_contact",
		summary: "获取最近会话（占位）",
		readOnly: true,
		returns: "占位实现，恒返回空数组。",
		returnsSchema: {
			type: "array",
			description: "最近会话列表（占位，恒空）"
		},
		params: { count: f.int({ min: 0 }).default(10) },
		run: async () => {
			return okResponse([]);
		}
	}),
	defineAction({
		name: "get_online_clients",
		summary: "获取在线客户端",
		readOnly: true,
		returns: "{ clients }：QQ 本次会话最近推送的在线设备快照。",
		returnsSchema: {
			type: "object",
			properties: { clients: {
				type: "array",
				description: "在线设备列表",
				items: {
					type: "object",
					properties: {
						app_id: {
							type: "integer",
							description: "客户端 ID"
						},
						device_name: {
							type: "string",
							description: "设备名称"
						},
						device_kind: {
							type: "string",
							enum: [
								"电脑",
								"Pad",
								"手机",
								"未知设备"
							],
							description: "设备类别"
						}
					},
					required: [
						"app_id",
						"device_name",
						"device_kind"
					]
				}
			} },
			required: ["clients"]
		},
		params: { no_cache: f.bool().default(false).describe("是否强制刷新；QQ 当前仅暴露本地快照，true 会明确失败") },
		run: async (p, ctx) => {
			if (p.no_cache) return failedResponse(RETCODE.ACTION_FAILED, "online-client fresh refresh is unavailable; QQ exposes only its local snapshot");
			const snapshot = ctx.bridge.getOnlineClients();
			if (snapshot === null) return failedResponse(RETCODE.ACTION_FAILED, "online-client snapshot has not been observed in this session");
			const kindLabels = {
				computer: "电脑",
				pad: "Pad",
				phone: "手机",
				unknown: "未知设备"
			};
			return okResponse({ clients: snapshot.map((device) => ({
				app_id: device.appId,
				device_name: device.deviceName,
				device_kind: kindLabels[device.deviceKind]
			})) });
		}
	}),
	defineAction({
		name: "_get_model_show",
		summary: "获取机型展示（兼容 mock）",
		readOnly: true,
		returns: "数组，每项含 variants（回显请求的机型名与 need_pay 标记）。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: { variants: {
					type: "object",
					properties: {
						model_show: {
							type: "string",
							description: "机型展示名（回显请求的 model，缺省 snowluma）"
						},
						need_pay: {
							type: "boolean",
							description: "是否需付费（恒 false）"
						}
					},
					required: ["model_show", "need_pay"]
				} },
				required: ["variants"]
			}
		},
		params: { model: f.string().default("") },
		run: async (p) => {
			return okResponse([{ variants: {
				model_show: p.model || "snowluma",
				need_pay: false
			} }]);
		}
	}),
	defineAction({
		name: "_set_model_show",
		summary: "设置机型展示（占位）",
		params: {},
		run: async () => {
			return okResponse();
		}
	}),
	groupAction({
		name: "get_group_at_all_remain",
		summary: "获取群 @全体成员 剩余次数",
		readOnly: true,
		returns: "{ can_at_all, remain_at_all_count_for_group, remain_at_all_count_for_uin }：@全体可用性与剩余次数。",
		returnsSchema: {
			type: "object",
			properties: {
				can_at_all: {
					type: "boolean",
					description: "当前是否可 @全体成员"
				},
				remain_at_all_count_for_group: {
					type: "integer",
					description: "本群今日剩余 @全体次数"
				},
				remain_at_all_count_for_uin: {
					type: "integer",
					description: "本账号今日剩余 @全体次数"
				}
			},
			required: [
				"can_at_all",
				"remain_at_all_count_for_group",
				"remain_at_all_count_for_uin"
			]
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAdmin.getAtAllRemain(p.group_id));
		}
	}),
	defineAction({
		name: "get_unidirectional_friend_list",
		summary: "获取单向好友列表",
		readOnly: true,
		params: {},
		run: async (_p, ctx) => {
			return okResponse(await ctx.bridge.apis.profile.getUnidirectionalFriendList());
		}
	}),
	defineAction({
		name: "get_clientkey",
		summary: "获取 clientkey",
		readOnly: true,
		returns: "{ clientKey, expireTime, keyIndex }：clientkey 及其过期时间与索引。",
		returnsSchema: {
			type: "object",
			properties: {
				clientKey: {
					type: "string",
					description: "clientkey"
				},
				expireTime: {
					type: "string",
					description: "过期时间"
				},
				keyIndex: {
					type: "string",
					description: "key 索引"
				}
			},
			required: [
				"clientKey",
				"expireTime",
				"keyIndex"
			]
		},
		params: {},
		run: async (_p, ctx) => {
			const clientKeyInfo = await ctx.bridge.apis.web.forceFetchClientKey();
			if (!clientKeyInfo.clientKey) return failedResponse(RETCODE.ACTION_FAILED, "get clientkey error");
			return okResponse({ ...clientKeyInfo });
		}
	}),
	defineAction({
		name: "share_peer",
		summary: "分享用户/群 Ark 卡片",
		readOnly: true,
		returns: "{ arkMsg }：服务端生成的推荐联系人 Ark 卡片 JSON 字符串。",
		returnsSchema: {
			type: "object",
			properties: { arkMsg: {
				type: "string",
				description: "Ark 卡片 JSON 字符串"
			} },
			required: ["arkMsg"]
		},
		params: {
			user_id: f.userId().optional(),
			group_id: f.groupId().optional(),
			phone_number: f.string().default("")
		},
		run: async (p, ctx) => {
			if (p.group_id) return okResponse({ arkMsg: await ctx.bridge.apis.contacts.getGroupRecommendArk(p.group_id) });
			if (p.user_id) return okResponse({ arkMsg: await ctx.bridge.apis.contacts.getBuddyRecommendArk(p.user_id, p.phone_number) });
			return failedResponse(RETCODE.BAD_REQUEST, "user_id or group_id is required");
		}
	}),
	defineAction({
		name: "send_ark_share",
		summary: "分享用户/群 Ark 卡片（NapCat 标准名）",
		readOnly: true,
		returns: "{ arkMsg }：服务端生成的推荐联系人 Ark 卡片 JSON 字符串。",
		returnsSchema: {
			type: "object",
			properties: { arkMsg: {
				type: "string",
				description: "Ark 卡片 JSON 字符串"
			} },
			required: ["arkMsg"]
		},
		params: {
			user_id: f.userId().optional(),
			group_id: f.groupId().optional(),
			phone_number: f.string().default("")
		},
		run: async (p, ctx) => {
			if (p.group_id) return okResponse({ arkMsg: await ctx.bridge.apis.contacts.getGroupRecommendArk(p.group_id) });
			if (p.user_id) return okResponse({ arkMsg: await ctx.bridge.apis.contacts.getBuddyRecommendArk(p.user_id, p.phone_number) });
			return failedResponse(RETCODE.BAD_REQUEST, "user_id or group_id is required");
		}
	}),
	defineAction({
		name: "send_tuwen_ark",
		summary: "发送图文 Ark 卡片（私聊/群聊）",
		readOnly: false,
		returns: "null",
		returnsSchema: { type: "null" },
		params: {
			user_id: f.userId().optional(),
			group_id: f.groupId().optional(),
			title: f.string(),
			desc: f.string(),
			summary: f.string().default("[分享]"),
			preview_url: f.string().default("https://tangram-1251316161.file.myqcloud.com/files/20210721/e50a8e37e08f29bf1ffc7466e1950690.png"),
			jump_url: f.string()
		},
		run: async (p, ctx) => {
			if (p.group_id) {
				await ctx.bridge.apis.contacts.sendTuwenArk({
					targetId: p.group_id,
					peerType: 1,
					title: p.title,
					desc: p.desc,
					summary: p.summary,
					previewUrl: p.preview_url,
					jumpUrl: p.jump_url
				});
				return okResponse(null);
			}
			if (p.user_id) {
				await ctx.bridge.apis.contacts.sendTuwenArk({
					targetId: p.user_id,
					peerType: 0,
					title: p.title,
					desc: p.desc,
					summary: p.summary,
					previewUrl: p.preview_url,
					jumpUrl: p.jump_url
				});
				return okResponse(null);
			}
			return failedResponse(RETCODE.BAD_REQUEST, "user_id or group_id is required");
		}
	}),
	defineAction({
		name: "share_group_ex",
		summary: "分享群 Ark 卡片",
		readOnly: true,
		returns: "服务端生成的群推荐 Ark 卡片 JSON 字符串。",
		returnsSchema: {
			type: "string",
			description: "群 Ark 卡片 JSON 字符串"
		},
		params: { group_id: f.groupId() },
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.contacts.getGroupRecommendArk(p.group_id));
		}
	}),
	defineAction({
		name: "send_group_ark_share",
		summary: "分享群 Ark 卡片（NapCat 标准名）",
		readOnly: true,
		returns: "服务端生成的群推荐 Ark 卡片 JSON 字符串。",
		returnsSchema: {
			type: "string",
			description: "群 Ark 卡片 JSON 字符串"
		},
		params: { group_id: f.groupId() },
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.contacts.getGroupRecommendArk(p.group_id));
		}
	}),
	defineAction({
		name: "get_doubt_friends_add_request",
		summary: "获取可疑好友申请",
		readOnly: true,
		returns: "可疑好友申请数组，每项含 uid（作为处理用 flag）、昵称、来源、留言与申请时间。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					uid: {
						type: "string",
						description: "申请人 uid（回传作 set_doubt_friends_add_request 的 flag）"
					},
					user_id: {
						type: "integer",
						description: "申请人 QQ 号"
					},
					nick: {
						type: "string",
						description: "申请人昵称"
					},
					source: {
						type: "string",
						description: "申请来源"
					},
					reason: {
						type: "string",
						description: "附加说明"
					},
					msg: {
						type: "string",
						description: "验证留言"
					},
					group_code: {
						type: "string",
						description: "来源群号，无则为空串"
					},
					reqTime: {
						type: "integer",
						description: "申请时间戳"
					}
				},
				required: [
					"uid",
					"user_id",
					"nick",
					"source",
					"reason",
					"msg",
					"group_code",
					"reqTime"
				]
			}
		},
		params: { count: f.int({ min: 0 }).default(50) },
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.friend.getDoubtRequests(p.count));
		}
	}),
	defineAction({
		name: "set_doubt_friends_add_request",
		summary: "处理可疑好友申请",
		params: {
			flag: f.string({ allowEmpty: false }),
			approve: f.bool().default(true)
		},
		run: async (p, ctx) => {
			if (p.approve) await ctx.bridge.apis.friend.approveDoubtRequest(p.flag);
			else await ctx.bridge.apis.friend.rejectDoubtRequest(p.flag);
			return okResponse();
		}
	}),
	groupAction({
		name: "set_group_robot_add_option",
		summary: "设置群机器人加群选项",
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAdmin.setRobotAddOption(p.group_id, p.robot_member_switch, p.robot_member_examine);
			return okResponse();
		},
		params: {
			robot_member_switch: f.int({ min: 0 }).optional(),
			robot_member_examine: f.int({ min: 0 }).optional()
		}
	}),
	defineAction({
		name: "get_collection_list",
		summary: "获取收藏列表",
		readOnly: true,
		returns: "返回收藏条目、是否还有更多数据及底部时间游标。",
		returnsSchema: {
			type: "object",
			properties: {
				errCode: { type: "integer" },
				errMsg: { type: "string" },
				collectionSearchList: {
					type: "object",
					properties: {
						collectionItemList: {
							type: "array",
							items: {
								type: "object",
								properties: {
									cid: { type: "string" },
									type: { type: "integer" },
									status: { type: "integer" },
									author: {
										type: "object",
										properties: {
											type: { type: "integer" },
											numId: { type: "string" },
											strId: { type: "string" },
											groupId: { type: "string" },
											groupName: { type: "string" },
											uid: { type: "string" }
										},
										required: [
											"type",
											"numId",
											"strId",
											"groupId",
											"groupName",
											"uid"
										]
									},
									bid: { type: "integer" },
									category: { type: "integer" },
									createTime: { type: "string" },
									collectTime: { type: "string" },
									modifyTime: { type: "string" },
									sequence: { type: "string" },
									shareUrl: { type: "string" },
									customGroupId: { type: "integer" },
									securityBeat: { type: "boolean" },
									summary: {
										type: "object",
										properties: {
											textSummary: { type: ["object", "null"] },
											linkSummary: { type: ["object", "null"] },
											gallerySummary: { type: ["object", "null"] },
											audioSummary: { type: ["object", "null"] },
											videoSummary: { type: ["object", "null"] },
											fileSummary: { type: ["object", "null"] },
											locationSummary: { type: ["object", "null"] },
											richMediaSummary: { type: ["object", "null"] }
										},
										required: [
											"textSummary",
											"linkSummary",
											"gallerySummary",
											"audioSummary",
											"videoSummary",
											"fileSummary",
											"locationSummary",
											"richMediaSummary"
										]
									}
								},
								required: [
									"cid",
									"type",
									"status",
									"author",
									"bid",
									"category",
									"createTime",
									"collectTime",
									"modifyTime",
									"sequence",
									"shareUrl",
									"customGroupId",
									"securityBeat",
									"summary"
								]
							}
						},
						hasMore: { type: "boolean" },
						bottomTimeStamp: { type: "string" }
					},
					required: [
						"collectionItemList",
						"hasMore",
						"bottomTimeStamp"
					]
				}
			},
			required: [
				"errCode",
				"errMsg",
				"collectionSearchList"
			]
		},
		params: {
			category: f.int({ min: 0 }).describe("收藏分类 ID；0 表示全部分类").default(0),
			count: f.int({
				min: 1,
				max: 500
			}).describe("最多返回的收藏数量").default(50)
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.collection.list(p.category, p.count));
		}
	}),
	defineAction({
		name: "create_collection",
		summary: "创建收藏（未实现）",
		params: {},
		run: async () => {
			return failedResponse(RETCODE.ACTION_FAILED, "not yet implemented");
		}
	}),
	defineAction({
		name: ".get_word_slices",
		summary: "分词（未实现）",
		readOnly: true,
		params: {},
		run: async () => {
			return failedResponse(RETCODE.ACTION_FAILED, "not yet implemented");
		}
	}),
	defineAction({
		name: "set_qq_avatar",
		summary: "设置 QQ 头像",
		params: { file: f.image() },
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.setAvatar(p.file);
			return okResponse();
		}
	}),
	defineAction({
		name: "set_input_status",
		summary: "设置输入状态",
		params: {
			user_id: f.userId(),
			event_type: f.int().default(0)
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.profile.setInputStatus(p.user_id, p.event_type);
			return okResponse({});
		}
	}),
	defineAction({
		name: "get_group_info_ex",
		summary: "获取群信息（扩展）",
		readOnly: true,
		returnsSchema: groupInfoReturnsSchema,
		params: {
			group_id: f.groupId(),
			no_cache: f.bool().default(false)
		},
		run: async (p, ctx) => {
			if (ctx.getGroupInfo) return okResponse(await ctx.getGroupInfo(p.group_id, p.no_cache));
			return failedResponse(RETCODE.ACTION_FAILED, "not implemented");
		}
	}),
	defineAction({
		name: "get_group_detail_info",
		summary: "获取群详细信息",
		readOnly: true,
		returnsSchema: groupInfoReturnsSchema,
		params: {
			group_id: f.groupId(),
			no_cache: f.bool().default(false)
		},
		run: async (p, ctx) => {
			if (ctx.getGroupInfo) return okResponse(await ctx.getGroupInfo(p.group_id, p.no_cache));
			return failedResponse(RETCODE.ACTION_FAILED, "not implemented");
		}
	}),
	defineAction({
		name: "trans_group_file",
		summary: "转存群文件",
		returns: "{ ok: true }",
		params: {
			group_id: f.groupId(),
			file_id: f.fileId()
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupFile.trans(p.group_id, p.file_id);
			return okResponse({ ok: true });
		}
	}),
	defineAction({
		name: "get_file",
		summary: "获取文件信息（仅图片/语音缓存；群文件请用 get_group_file_url）",
		readOnly: true,
		params: {
			file_id: f.string().default("").role("file_id"),
			file: f.string().default("").role("file")
		},
		run: async (p, ctx) => {
			const fileId = p.file || p.file_id;
			if (!fileId) return failedResponse(RETCODE.BAD_REQUEST, "file_id is required");
			const image = await ctx.getImageInfo(fileId);
			if (image) return okResponse(image);
			const record = await ctx.getRecordInfo(fileId);
			if (record) return okResponse(record);
			return failedResponse(RETCODE.ACTION_FAILED, "file_id not found in the image/voice cache. get_file only resolves cached image/voice ids; for group/normal files use get_group_file_url or get_private_file_url");
		}
	}),
	defineAction({
		name: "bot_exit",
		summary: "退出机器人",
		params: {},
		run: async () => {
			setTimeout(() => process.exit(0), 50);
			return okResponse();
		}
	}),
	defineAction({
		name: "nc_get_packet_status",
		summary: "获取 packet 状态（占位）",
		readOnly: true,
		returns: "占位实现，恒返回 null。",
		returnsSchema: {
			type: "null",
			description: "packet 状态（占位，恒 null）"
		},
		params: {},
		run: async () => {
			return okResponse(null);
		}
	}),
	groupAction({
		name: "delete_group_folder",
		summary: "删除群文件夹",
		params: { folder_id: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupFile.deleteFolder(p.group_id, p.folder_id);
			return okResponse();
		}
	}),
	defineAction({
		name: "nc_get_user_status",
		summary: "获取用户在线/扩展状态",
		readOnly: true,
		returns: "{ status, ext_status }：用户在线状态码与扩展状态码。",
		returnsSchema: {
			type: "object",
			properties: {
				status: {
					type: "integer",
					description: "在线状态码"
				},
				ext_status: {
					type: "integer",
					description: "扩展状态码"
				}
			},
			required: ["status", "ext_status"]
		},
		params: { user_id: f.userId() },
		run: async (p, ctx) => {
			const status = await ctx.bridge.apis.extras.getStrangerStatus(p.user_id);
			if (!status) return failedResponse(RETCODE.ACTION_FAILED, "failed to fetch user status");
			return okResponse({ ...status });
		}
	}),
	groupAction({
		name: "get_ai_characters",
		summary: "获取 AI 语音角色",
		readOnly: true,
		returns: "按分类分组的 AI 语音角色列表，每组含分类名与角色（id、名称、试听 URL）。",
		returnsSchema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					type: {
						type: "string",
						description: "角色分类名"
					},
					characters: {
						type: "array",
						description: "该分类下的角色列表",
						items: {
							type: "object",
							properties: {
								character_id: {
									type: "string",
									description: "角色 ID"
								},
								character_name: {
									type: "string",
									description: "角色显示名"
								},
								preview_url: {
									type: "string",
									description: "试听音频 URL"
								}
							},
							required: [
								"character_id",
								"character_name",
								"preview_url"
							]
						}
					}
				},
				required: ["type", "characters"]
			}
		},
		params: { chat_type: f.int({ min: 0 }).default(1) },
		run: async (p, ctx) => {
			return okResponse((await ctx.bridge.apis.extras.fetchAiVoiceList(p.group_id, p.chat_type)).map((cat) => ({
				type: cat.category,
				characters: cat.voices.map((v) => ({
					character_id: v.voiceId,
					character_name: v.voiceDisplayName,
					preview_url: v.voiceExampleUrl
				}))
			})));
		}
	}),
	groupAction({
		name: "get_ai_record",
		summary: "生成 AI 语音",
		params: {
			character: f.string({ allowEmpty: false }),
			text: f.string({ allowEmpty: false }),
			chat_type: f.int({ min: 0 }).default(1)
		},
		run: async (p, ctx) => {
			const node = await ctx.bridge.apis.extras.fetchAiVoice(p.group_id, p.character, p.text, p.chat_type);
			return okResponse(await ctx.bridge.apis.groupFile.getPttUrl(p.group_id, node));
		}
	}),
	groupAction({
		name: "send_group_ai_record",
		summary: "发送 AI 语音到群",
		returns: "{ message_id }：已发送 AI 语音的 OneBot 消息 ID。",
		params: {
			character: f.string({ allowEmpty: false }),
			text: f.string({ allowEmpty: false }),
			chat_type: f.int({ min: 0 }).default(1)
		},
		run: async (p, ctx) => {
			return okResponse({ message_id: hashMessageIdInt32((await ctx.bridge.apis.extras.sendAiVoice(p.group_id, p.character, p.text, p.chat_type)).sequence, p.group_id, GROUP_MESSAGE_EVENT) });
		}
	}),
	defineAction({
		name: "request_decrypt_key",
		summary: "请求数据库解密密钥",
		params: { db_path: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			const buffer = Buffer.alloc(128);
			const fileHandle = await readFile(p.db_path);
			if (fileHandle.length < 175) return failedResponse(RETCODE.ACTION_FAILED, "Database file too short");
			fileHandle.copy(buffer, 0, 47, 175);
			const dbSalt = buffer.toString("utf8");
			if (!/^[0-9a-fA-F]{128}$/.test(dbSalt)) return failedResponse(RETCODE.ACTION_FAILED, "Invalid db_salt: not a valid 128-character hex string");
			return okResponse({ db_key: await ctx.bridge.apis.misc.getDecryptKey(dbSalt.toLowerCase()) });
		}
	}),
	defineAction({
		name: ["get_rkey", "nc_get_rkey"],
		summary: "获取下载 rkey",
		readOnly: true,
		params: {},
		run: async (_p, ctx) => ctx.getDownloadRKeys ? okResponse(await ctx.getDownloadRKeys()) : failedResponse(RETCODE.ACTION_FAILED, "not implemented")
	}),
	defineAction({
		name: "get_rkey_server",
		summary: "获取 rkey 服务器信息",
		readOnly: true,
		returns: "{ expired_time, name, private_rkey?, group_rkey? }：rkey 过期时间与（存在时的）私聊/群聊 rkey。",
		returnsSchema: {
			type: "object",
			properties: {
				expired_time: {
					type: "integer",
					description: "过期时间戳（秒）"
				},
				name: {
					type: "string",
					description: "服务器名（恒 SnowLuma）"
				},
				private_rkey: {
					type: "string",
					description: "私聊 rkey（存在时返回）"
				},
				group_rkey: {
					type: "string",
					description: "群聊 rkey（存在时返回）"
				}
			},
			required: ["expired_time", "name"]
		},
		params: {},
		run: async (_p, ctx) => {
			if (!ctx.getDownloadRKeys) return failedResponse(RETCODE.ACTION_FAILED, "not implemented");
			const rkeys = await ctx.getDownloadRKeys();
			const pick = (type) => rkeys.find((r) => r.type === type);
			const priv = pick(10);
			const group = pick(20);
			if (!priv?.rkey && !group?.rkey) return failedResponse(RETCODE.ACTION_FAILED, "no download rkey available");
			const ttls = [priv?.ttl, group?.ttl].filter((t) => typeof t === "number" && t > 0);
			const minTtl = ttls.length ? Math.min(...ttls) : 0;
			const data = {
				expired_time: Math.floor(Date.now() / 1e3) + minTtl,
				name: "SnowLuma"
			};
			if (priv?.rkey) data.private_rkey = priv.rkey;
			if (group?.rkey) data.group_rkey = group.rkey;
			return okResponse(data);
		}
	}),
	defineAction({
		name: ["ocr_image", ".ocr_image"],
		summary: "OCR 图片（服务端，需图片 URL 或已缓存的图片 file_id）",
		readOnly: true,
		returns: "{ texts, language }：识别文本数组（含置信度与坐标）与识别语言。",
		returnsSchema: {
			type: "object",
			properties: {
				texts: {
					type: "array",
					description: "识别出的文本块",
					items: {
						type: "object",
						properties: {
							text: {
								type: "string",
								description: "文本内容"
							},
							confidence: {
								type: "number",
								description: "置信度"
							},
							coordinates: {
								type: "array",
								description: "文本框顶点坐标",
								items: {
									type: "object",
									properties: {
										x: {
											type: "number",
											description: "X 坐标"
										},
										y: {
											type: "number",
											description: "Y 坐标"
										}
									},
									required: ["x", "y"]
								}
							}
						},
						required: [
							"text",
							"confidence",
							"coordinates"
						]
					}
				},
				language: {
					type: "string",
					description: "识别语言"
				}
			},
			required: ["texts", "language"]
		},
		params: { image: f.image() },
		run: async (p, ctx) => {
			let url = /^https?:\/\//i.test(p.image) ? p.image : "";
			if (!url) {
				const info = await ctx.getImageInfo(p.image);
				const resolved = info && typeof info.url === "string" ? info.url : "";
				if (resolved) url = resolved;
			}
			if (!url) return failedResponse(RETCODE.ACTION_FAILED, "ocr_image needs an http(s) image url or a cached image file_id; base64/local-file input is not supported");
			return okResponse(await ctx.bridge.apis.misc.ocrImage(url));
		}
	}),
	groupAction({
		name: "_del_group_notice",
		summary: "删除群公告（fid 或 notice_id 二选一）",
		params: {
			fid: f.string().optional(),
			notice_id: f.string().optional()
		},
		run: async (p, ctx) => {
			const fid = p.fid || p.notice_id;
			if (!fid) return failedResponse(RETCODE.BAD_REQUEST, "group_id and fid/notice_id are required");
			return await ctx.bridge.apis.web.deleteNotice(p.group_id, fid) ? okResponse() : failedResponse(RETCODE.ACTION_FAILED, "delete failed");
		}
	}),
	defineAction({
		name: "send_forward_msg",
		summary: "发送合并转发（按 message_type/群号自动路由）",
		returns: "{ message_id, res_id, forward_id }",
		params: {
			messages: f.message().optional(),
			message: f.message().optional(),
			message_type: f.string().optional(),
			group_id: f.int({ min: 0 }).optional(),
			user_id: f.int({ min: 0 }).optional(),
			...forwardPreviewParams
		},
		run: async (p, ctx) => {
			const messageType = p.message_type ?? "";
			const groupId = p.group_id ?? 0;
			const userId = p.user_id ?? 0;
			const messages = p.messages ?? p.message;
			const meta = readForwardPreviewMeta(p);
			if (messages === void 0) return failedResponse(RETCODE.BAD_REQUEST, "message/messages is required");
			if ((messageType === "group" || groupId > 0) && ctx.sendGroupForwardMsg) {
				if (!groupId) return failedResponse(RETCODE.BAD_REQUEST, "group_id is required");
				const result = await ctx.sendGroupForwardMsg(groupId, messages, meta);
				return okResponse({
					message_id: result.messageId,
					res_id: result.forwardId,
					forward_id: result.forwardId
				});
			}
			if ((messageType === "private" || userId > 0) && ctx.sendPrivateForwardMsg) {
				if (!userId) return failedResponse(RETCODE.BAD_REQUEST, "user_id is required");
				const result = await ctx.sendPrivateForwardMsg(userId, messages, meta);
				return okResponse({
					message_id: result.messageId,
					res_id: result.forwardId,
					forward_id: result.forwardId
				});
			}
			const result = await ctx.sendForwardMsg(messages);
			return okResponse({
				message_id: 0,
				res_id: result.forwardId,
				forward_id: result.forwardId
			});
		}
	}),
	groupAction({
		name: "send_group_forward_msg",
		summary: "发送群合并转发",
		returns: "{ message_id, res_id, forward_id }",
		params: {
			messages: f.message().optional(),
			message: f.message().optional(),
			...forwardPreviewParams
		},
		run: async (p, ctx) => {
			const messages = p.messages ?? p.message;
			if (messages === void 0) return failedResponse(RETCODE.BAD_REQUEST, "message/messages is required");
			const result = await ctx.sendGroupForwardMsg(p.group_id, messages, readForwardPreviewMeta(p));
			return okResponse({
				message_id: result.messageId,
				res_id: result.forwardId,
				forward_id: result.forwardId
			});
		}
	}),
	defineAction({
		name: "send_private_forward_msg",
		summary: "发送私聊合并转发",
		returns: "{ message_id, res_id, forward_id }",
		params: {
			user_id: f.userId(),
			messages: f.message().optional(),
			message: f.message().optional(),
			...forwardPreviewParams
		},
		run: async (p, ctx) => {
			const messages = p.messages ?? p.message;
			if (messages === void 0) return failedResponse(RETCODE.BAD_REQUEST, "message/messages is required");
			const result = await ctx.sendPrivateForwardMsg(p.user_id, messages, readForwardPreviewMeta(p));
			return okResponse({
				message_id: result.messageId,
				res_id: result.forwardId,
				forward_id: result.forwardId
			});
		}
	}),
	defineAction({
		name: "get_forward_msg",
		summary: "获取合并转发消息（id 或 message_id）",
		readOnly: true,
		returns: "{ messages }：转发内的消息节点数组（每项为 OneBot 消息事件，内部字段不固定）。",
		returnsSchema: {
			type: "object",
			properties: { messages: {
				type: "array",
				description: "转发消息节点数组",
				items: { type: "object" }
			} },
			required: ["messages"]
		},
		params: {
			id: f.string().optional(),
			message_id: f.string().optional()
		},
		run: async (p, ctx) => {
			let id = p.id || "";
			if (!id && p.message_id !== void 0) {
				const numericMessageId = integerFromDecimalString(p.message_id);
				if (numericMessageId > 0) {
					const event = ctx.getMessage(numericMessageId);
					const segments = Array.isArray(event?.message) ? event.message : [];
					for (const seg of segments) {
						if (typeof seg !== "object" || seg === null || Array.isArray(seg)) continue;
						const so = seg;
						if (String(so.type ?? "") !== "forward") continue;
						const data = typeof so.data === "object" && so.data !== null && !Array.isArray(so.data) ? so.data : null;
						const candidate = primitiveText(data?.id) || primitiveText(data?.res_id) || primitiveText(data?.forward_id);
						if (candidate) {
							id = candidate;
							break;
						}
					}
				}
				if (!id) id = p.message_id;
			}
			if (!id) return failedResponse(RETCODE.BAD_REQUEST, "id or message_id is required");
			return okResponse({ messages: await ctx.getForwardMsg(id) });
		}
	}),
	defineAction({
		name: "download_file",
		summary: "下载文件（url 或 base64）到 data/downloads",
		returns: "{ file }",
		params: {
			url: f.string().default(""),
			base64: f.string().default(""),
			name: f.string().default(""),
			headers: f.raw()
		},
		run: async (p) => {
			const url = p.url;
			const base64 = p.base64;
			const name = p.name;
			if (!url && !base64) return failedResponse(RETCODE.BAD_REQUEST, "url or base64 is required");
			let buf;
			if (base64) {
				if (Math.floor(base64.length * 3 / 4) > DOWNLOAD_FILE_MAX_BYTES) return failedResponse(RETCODE.BAD_REQUEST, `base64 payload too large: > ${DOWNLOAD_FILE_MAX_BYTES} bytes`);
				buf = Buffer.from(base64, "base64");
				if (buf.length > DOWNLOAD_FILE_MAX_BYTES) return failedResponse(RETCODE.BAD_REQUEST, `base64 payload too large: ${buf.length} > ${DOWNLOAD_FILE_MAX_BYTES} bytes`);
			} else buf = await fetchDownloadFile(url, parseDownloadHeaders(p.headers), DOWNLOAD_FILE_MAX_BYTES, DOWNLOAD_FILE_TIMEOUT_MS);
			try {
				return okResponse({ file: await saveDownloadBuffer(buf, name) });
			} catch (err) {
				return failedResponse(RETCODE.BAD_REQUEST, err instanceof Error ? err.message : String(err));
			}
		}
	}),
	defineAction({
		name: "translate_en2zh",
		summary: "英译中",
		readOnly: true,
		returns: "{ words }：与输入等长的中文译文字符串数组。",
		returnsSchema: {
			type: "object",
			properties: { words: {
				type: "array",
				description: "译文数组",
				items: { type: "string" }
			} },
			required: ["words"]
		},
		params: { words: f.array(f.string()) },
		run: async (p, ctx) => {
			return okResponse({ words: await ctx.bridge.apis.misc.translateEn2Zh(p.words) });
		}
	}),
	defineAction({
		name: "set_self_longnick",
		summary: "设置个性签名（longNick/long_nick，严格 string）",
		params: {
			longNick: optionalExactString(),
			long_nick: optionalExactString()
		},
		run: async (p, ctx) => {
			const longNick = p.longNick !== void 0 ? p.longNick : p.long_nick;
			if (typeof longNick !== "string") return failedResponse(RETCODE.BAD_REQUEST, "invalid longNick");
			await ctx.bridge.apis.profile.setSelfLongNick(longNick);
			return okResponse({});
		}
	}),
	defineAction({
		name: "get_mini_app_ark",
		summary: "获取小程序卡片 ark",
		readOnly: true,
		params: {
			type: f.string().optional(),
			title: f.string().optional(),
			desc: f.string().optional(),
			picUrl: f.string().optional(),
			pic_url: f.string().optional(),
			jumpUrl: f.string().optional(),
			jump_url: f.string().optional()
		},
		run: async (p, ctx) => {
			const type = p.type || "bili";
			const title = p.title || "";
			const desc = p.desc || "";
			const picUrl = p.picUrl || p.pic_url || "";
			const jumpUrl = p.jumpUrl || p.jump_url || "";
			return okResponse(await ctx.bridge.apis.misc.getMiniAppArk(type, title, desc, picUrl, jumpUrl));
		}
	}),
	groupAction({
		name: "click_inline_keyboard_button",
		summary: "点击内联键盘按钮",
		params: {
			bot_appid: f.uint(),
			msg_seq: f.uint(),
			button_id: f.string({ allowEmpty: false }),
			callback_data: f.string().default("")
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.misc.clickInlineKeyboardButton(p.group_id, p.bot_appid, p.button_id, p.callback_data, p.msg_seq));
		}
	}),
	groupAction({
		name: ["set_group_sign", "send_group_sign"],
		summary: "群签到",
		run: async (p, ctx) => {
			await ctx.bridge.apis.misc.sendGroupSign(p.group_id);
			return okResponse({});
		}
	}),
	defineAction({
		name: ["send_packet", ".send_packet"],
		summary: "发送原始 SSO 包（cmd + hex data）",
		params: {
			cmd: f.string({ allowEmpty: false }),
			data: f.string().default(""),
			rsp: f.bool().default(true)
		},
		run: async (p, ctx) => {
			if (!/^[0-9a-fA-F]*$/.test(p.data) || p.data.length % 2 !== 0) return failedResponse(RETCODE.BAD_REQUEST, "data must be a hex string of even length");
			const body = hexToBytes(p.data);
			const result = await ctx.bridge.sendRawPacket(p.cmd, body);
			if (!result.success) return failedResponse(RETCODE.ACTION_FAILED, result.errorMessage || "send failed");
			if (!p.rsp) return okResponse(null);
			return okResponse(result.responseData ? bytesToHex(result.responseData) : "");
		}
	}),
	groupAction({
		name: "get_group_todo_list",
		summary: "获取群待办列表",
		returns: "群待办数组，包含可用于待办操作的消息标识、服务端摘要与时间",
		readOnly: true,
		run: async (p, ctx) => {
			const projections = (await ctx.bridge.apis.extras.getGroupTodoList(p.group_id)).map((todo) => {
				return {
					todo,
					messageId: hashMessageIdInt32(todo.sequence, p.group_id, GROUP_MESSAGE_EVENT),
					meta: {
						isGroup: true,
						targetId: p.group_id,
						sequence: todo.sequence,
						sequenceAuthoritative: true,
						eventName: GROUP_MESSAGE_EVENT,
						clientSequence: 0,
						random: todo.random,
						timestamp: todo.createdAt
					}
				};
			});
			ctx.cacheMessageMetas(projections.map(({ messageId, meta }) => ({
				messageId,
				meta
			})));
			return okResponse(projections.map(({ todo, messageId }) => {
				const cached = ctx.getMessage(messageId)?.message;
				return {
					message_id: messageId,
					message_seq: todo.sequence,
					message_random: todo.random,
					message: Array.isArray(cached) ? cached : null,
					text: todo.text,
					create_time: todo.createdAt,
					update_time: todo.updatedAt
				};
			}));
		}
	}),
	groupAction({
		name: "set_group_todo",
		summary: "设置群待办",
		params: { message_id: f.messageId() },
		run: (p, ctx) => groupTodoRun(p, ctx, (g, s) => ctx.bridge.apis.extras.setGroupTodo(g, s))
	}),
	groupAction({
		name: "complete_group_todo",
		summary: "完成群待办",
		params: { message_id: f.messageId() },
		run: (p, ctx) => groupTodoRun(p, ctx, (g, s) => ctx.bridge.apis.extras.completeGroupTodo(g, s))
	}),
	groupAction({
		name: "cancel_group_todo",
		summary: "取消群待办",
		params: { message_id: f.messageId() },
		run: (p, ctx) => groupTodoRun(p, ctx, (g, s) => ctx.bridge.apis.extras.cancelGroupTodo(g, s))
	}),
	defineAction({
		name: "create_flash_task",
		summary: "创建闪传任务",
		params: {
			files: f.raw().describe("路径、{ file, name }，或它们的数组"),
			name: f.string().optional(),
			thumb_path: f.string().optional()
		},
		run: async (p, ctx) => {
			const parsed = parseFlashTaskFiles(p.files);
			if ("error" in parsed) return failedResponse(RETCODE.BAD_REQUEST, parsed.error);
			const result = await ctx.bridge.apis.flashTransfer.createFlashTask(parsed.files, p.name, p.thumb_path);
			return okResponse({
				fileset_id: result.filesetId,
				task_id: result.filesetId
			});
		}
	}),
	defineAction({
		name: "get_fileset_info",
		summary: "获取文件集信息",
		params: { fileset_id: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			const list = await ctx.bridge.apis.flashTransfer.getFilesetInfo(p.fileset_id);
			return okResponse({
				fileset_id: p.fileset_id,
				file_list: list.map(flashFileInfoToJson)
			});
		}
	}),
	defineAction({
		name: "get_flash_file_list",
		summary: "获取闪传文件列表",
		params: { fileset_id: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			return okResponse((await ctx.bridge.apis.flashTransfer.getFlashFileList(p.fileset_id)).map(flashFileInfoToJson));
		}
	}),
	defineAction({
		name: "list_filesets",
		summary: "列出当前账号的所有闪传文件集",
		params: {},
		run: async (_p, ctx) => {
			return okResponse((await ctx.bridge.apis.flashTransfer.listFilesets()).map(flashFileInfoToJson));
		}
	}),
	defineAction({
		name: "get_flash_file_url",
		summary: "获取闪传文件链接",
		params: {
			fileset_id: f.string({ allowEmpty: false }),
			file_name: f.string().optional(),
			file_index: f.number().optional()
		},
		run: async (p, ctx) => {
			return okResponse({ url: await ctx.bridge.apis.flashTransfer.getFlashFileUrl(p.fileset_id, p.file_index) });
		}
	}),
	defineAction({
		name: "get_share_link",
		summary: "获取文件分享链接",
		params: { fileset_id: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.flashTransfer.getShareLink(p.fileset_id));
		}
	}),
	defineAction({
		name: "delete_flash_file",
		summary: "删除闪传文件",
		params: { fileset_id: f.string({ allowEmpty: false }) },
		run: async (p, ctx) => {
			await ctx.bridge.apis.flashTransfer.deleteFlashFile(p.fileset_id);
			return okResponse();
		}
	}),
	defineAction({
		name: "rename_flash_file",
		summary: "重命名闪传文件",
		params: {
			fileset_id: f.string({ allowEmpty: false }),
			new_name: f.string({ allowEmpty: false })
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.flashTransfer.renameFlashFile(p.fileset_id, p.new_name);
			return okResponse();
		}
	}),
	defineAction({
		name: "download_fileset",
		summary: "解析闪传文件下载直链（不下载，由调用方实现下载）",
		returns: "{ url, file_name, file_size }",
		params: {
			fileset_id: f.string({ allowEmpty: false }),
			file_name: f.string().optional(),
			file_index: f.number().optional()
		},
		run: async (p, ctx) => {
			const target = await ctx.bridge.apis.flashTransfer.downloadFileset(p.fileset_id, {
				fileName: p.file_name,
				fileIndex: p.file_index
			});
			return okResponse({
				url: target.url,
				file_name: target.fileName,
				file_size: target.fileSize
			});
		}
	}),
	defineAction({
		name: "send_flash_msg",
		summary: "发送闪传消息（私聊或群聊，引用 fileset_id 让对端下载）",
		returns: "{ message_id }",
		params: {
			fileset_id: f.string({ allowEmpty: false }),
			user_id: f.userId().optional(),
			group_id: f.groupId().optional()
		},
		run: async (p, ctx) => {
			if (!p.user_id && !p.group_id) return failedResponse(RETCODE.BAD_REQUEST, "user_id or group_id is required");
			await ctx.bridge.apis.flashTransfer.sendFlashMsg(p.fileset_id, {
				userId: p.user_id,
				groupId: p.group_id
			});
			return okResponse({ message_id: 0 });
		}
	}),
	defineAction({
		name: "get_fileset_id",
		summary: "从 QQ 闪传分享码或官方分享链接获取 fileset_id",
		readOnly: true,
		returns: "{ fileset_id }：解析出的文件集 ID。",
		returnsSchema: {
			type: "object",
			properties: { fileset_id: {
				type: "string",
				description: "文件集 ID"
			} },
			required: ["fileset_id"]
		},
		params: { share_code: f.string({ allowEmpty: false }).describe("QQ 闪传分享码，或 https://qfile.qq.com/q/... 官方分享链接") },
		run: async (p, ctx) => {
			return okResponse({ fileset_id: await ctx.bridge.apis.flashTransfer.getFilesetIdByCode(p.share_code) });
		}
	}),
	defineAction({
		name: "_get_friend_dress",
		summary: "获取指定 QQ 号正在使用的个性装扮（挂件/名片/来电/输入状态等）",
		returns: "装扮信息；目标未使用任何可查询装扮时 items 为空数组。网络失败、未登录态/风控、页面改版、返回账号与请求不一致时返回失败并附具体原因",
		readOnly: true,
		params: { user_id: f.userId().describe("目标 QQ 号") },
		run: async (p, ctx) => {
			try {
				return okResponse(await ctx.bridge.apis.web.getFriendDress(p.user_id));
			} catch (e) {
				if (e instanceof FriendDressError) return failedResponse(RETCODE.ACTION_FAILED, `failed to get friend dress (${e.kind}): ${e.message}`);
				return failedResponse(RETCODE.ACTION_FAILED, `failed to get friend dress: ${e.message}`);
			}
		}
	})
];
async function fetchFilteredGroupRequests(ctx) {
	return ctx.bridge.apis.contacts.fetchGroupRequests(true);
}
function hexToBytes(hex) {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}
function bytesToHex(buf) {
	return (buf instanceof Buffer ? buf : Buffer.from(buf)).toString("hex");
}
function parseDownloadHeaders(headers) {
	const result = {};
	if (!headers) return result;
	const headerList = [];
	if (typeof headers === "string") headerList.push(...headers.split(/\r?\n/).filter(Boolean));
	else if (Array.isArray(headers)) {
		for (const h of headers) if (typeof h === "string") headerList.push(h);
	}
	for (const line of headerList) {
		const idx = line.indexOf("=");
		if (idx > 0) result[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
	}
	return result;
}
//#endregion
//#region ../onebot/src/actions/group-album.ts
var albumCoverUrlSchema = {
	type: ["object", "null"],
	properties: {
		url: {
			type: "string",
			description: "封面地址"
		},
		width: {
			type: "integer",
			description: "封面宽度"
		},
		height: {
			type: "integer",
			description: "封面高度"
		}
	},
	required: [
		"url",
		"width",
		"height"
	]
};
var albumCoverSchema = {
	type: ["object", "null"],
	description: "相册封面；没有封面时为 null",
	properties: {
		type: {
			type: "integer",
			description: "封面媒体类型"
		},
		image: {
			type: ["object", "null"],
			description: "封面图片信息",
			properties: {
				name: {
					type: "string",
					description: "图片名称"
				},
				sloc: {
					type: "string",
					description: "图片短定位标识"
				},
				lloc: {
					type: "string",
					description: "图片长定位标识"
				},
				photoUrls: {
					type: "array",
					description: "不同规格的封面地址",
					items: {
						type: "object",
						properties: {
							spec: {
								type: "integer",
								description: "图片规格"
							},
							url: albumCoverUrlSchema
						},
						required: ["spec", "url"]
					}
				},
				defaultUrl: albumCoverUrlSchema,
				isGif: {
					type: "boolean",
					description: "是否为动图"
				},
				hasRaw: {
					type: "boolean",
					description: "是否有原图"
				}
			},
			required: [
				"name",
				"sloc",
				"lloc",
				"photoUrls",
				"defaultUrl",
				"isGif",
				"hasRaw"
			]
		}
	},
	required: ["type", "image"]
};
var actions$4 = [
	groupAction({
		name: "get_group_album_list",
		readOnly: true,
		returns: "群相册列表数组，每项为一个相册的基本信息。",
		returnsSchema: {
			type: "array",
			description: "群相册列表",
			items: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description: "相册 id"
					},
					name: {
						type: "string",
						description: "相册名称"
					},
					picNum: {
						type: "integer",
						description: "相册内照片数量"
					},
					createTime: {
						type: "integer",
						description: "相册创建时间（unix 秒）"
					},
					last_upload_time: {
						type: "integer",
						description: "最后上传时间（unix 秒）"
					},
					cover: albumCoverSchema,
					createuin: {
						type: "string",
						description: "相册创建者 QQ 号"
					},
					createnickname: {
						type: "string",
						description: "相册创建者昵称（原始 Unicode）"
					}
				},
				required: [
					"id",
					"name",
					"picNum",
					"createTime",
					"last_upload_time",
					"cover",
					"createuin",
					"createnickname"
				]
			}
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAlbum.list(p.group_id));
		}
	}),
	groupAction({
		name: "get_qun_album_list",
		readOnly: true,
		returns: "NapCat 风格的相册列表封套：{album_list, attach_info, has_more}。",
		returnsSchema: {
			type: "object",
			properties: {
				album_list: {
					type: "array",
					description: "相册列表",
					items: {
						type: "object",
						properties: {
							album_id: {
								type: "string",
								description: "相册 id"
							},
							name: {
								type: "string",
								description: "相册名称"
							},
							create_time: {
								type: "string",
								description: "相册创建时间（unix 秒）"
							},
							last_upload_time: {
								type: "string",
								description: "最后上传时间（unix 秒）"
							},
							upload_number: {
								type: "string",
								description: "相册内媒体数量"
							},
							cover: albumCoverSchema,
							creator: {
								type: "object",
								description: "相册创建者信息",
								properties: {
									uin: {
										type: "string",
										description: "创建者 QQ 号"
									},
									uid: {
										type: "string",
										description: "创建者 UID"
									},
									nick: {
										type: "string",
										description: "创建者原始 Unicode 昵称"
									}
								}
							}
						},
						required: [
							"album_id",
							"name",
							"create_time",
							"last_upload_time",
							"upload_number",
							"cover"
						]
					}
				},
				attach_info: {
					type: "string",
					description: "下一页分页游标"
				},
				has_more: {
					type: "boolean",
					description: "是否还有更多"
				}
			},
			required: [
				"album_list",
				"attach_info",
				"has_more"
			]
		},
		params: { attach_info: f.string().default("") },
		run: async (p, ctx) => {
			const result = await ctx.bridge.apis.groupAlbum.listQun(p.group_id, p.attach_info);
			return okResponse({
				album_list: result.albumList,
				attach_info: result.attachInfo,
				has_more: result.hasMore
			});
		}
	}),
	groupAction({
		name: "upload_image_to_qun_album",
		params: {
			album_id: f.string({ allowEmpty: false }),
			album_name: f.string({ allowEmpty: false }),
			file: f.image()
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.groupAlbum.upload(p.group_id, p.album_id, p.album_name, p.file);
			return okResponse(null);
		}
	}),
	groupAction({
		name: "upload_video_to_qun_album",
		summary: "上传视频到群相册",
		returns: "{ id: string }",
		returnsSchema: {
			type: "object",
			properties: { id: {
				type: "string",
				description: "视频 id"
			} },
			required: ["id"]
		},
		params: {
			album_id: f.string({ allowEmpty: false }).describe("相册 id"),
			album_name: f.string({ allowEmpty: false }).describe("相册名称"),
			file: f.video().describe("视频文件")
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAlbum.uploadVideo(p.group_id, p.album_id, p.album_name, p.file));
		}
	}),
	groupAction({
		name: "get_group_album_media_list",
		readOnly: true,
		returns: "相册图片/视频列表及下一页分页游标；视频项包含 id、url、cover、尺寸、时长和多规格地址。",
		returnsSchema: {
			type: "object",
			properties: {
				mediaList: {
					type: "array",
					description: "相册媒体项列表（各项字段不固定）",
					items: { type: "object" }
				},
				nextAttachInfo: {
					type: "string",
					description: "下一页分页游标（空串表示无更多）"
				}
			},
			required: ["mediaList", "nextAttachInfo"]
		},
		params: {
			album_id: f.string({ allowEmpty: false }),
			attach_info: f.string().default("")
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAlbum.getMediaList(p.group_id, p.album_id, p.attach_info));
		}
	}),
	groupAction({
		name: "do_group_album_comment",
		params: {
			album_id: f.string({ allowEmpty: false }),
			lloc: f.string({ allowEmpty: false }),
			content: f.string({ allowEmpty: false })
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAlbum.comment(p.group_id, p.album_id, p.lloc, p.content));
		}
	}),
	groupAction({
		name: "set_group_album_media_like",
		params: {
			album_id: f.string({ allowEmpty: false }),
			batch_id: f.string({ allowEmpty: false }),
			lloc: f.string().optional()
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAlbum.like(p.group_id, p.album_id, p.batch_id, p.lloc || void 0, true));
		}
	}),
	groupAction({
		name: "cancel_group_album_media_like",
		params: {
			album_id: f.string({ allowEmpty: false }),
			batch_id: f.string({ allowEmpty: false }),
			lloc: f.string().optional()
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAlbum.like(p.group_id, p.album_id, p.batch_id, p.lloc || void 0, false));
		}
	}),
	groupAction({
		name: "del_group_album_media",
		summary: "删除群相册图片或视频",
		params: {
			album_id: f.string({ allowEmpty: false }),
			lloc: f.string({ allowEmpty: false }).describe("图片长定位标识，或视频 id")
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.groupAlbum.delete(p.group_id, p.album_id, p.lloc));
		}
	})
];
//#endregion
//#region ../onebot/src/actions/qzone.ts
async function uploadQzoneImages(ctx, images, select) {
	const parts = [];
	for (let i = 0; i < images.length; i++) try {
		const upload = await ctx.bridge.apis.qzone.uploadImageFromSource(images[i]);
		parts.push(select(upload));
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		throw new Error(`第 ${i + 1} 张图片上传失败: ${message}`);
	}
	return parts.join("	");
}
var QZONE_UGC_RIGHTS = /* @__PURE__ */ new Set([
	1,
	4,
	16,
	64,
	128
]);
var actions$3 = [
	defineAction({
		name: "get_qzone_msg_list",
		readOnly: true,
		returns: "说说列表对象，含说说总数与本页说说数组。",
		returnsSchema: {
			type: "object",
			properties: {
				total: {
					type: "integer",
					description: "账号说说总数（非本页数量）"
				},
				msglist: {
					type: "array",
					description: "本页说说数组",
					items: {
						type: "object",
						properties: {
							tid: {
								type: "string",
								description: "说说 id（delete/comment/like 的句柄）"
							},
							content: {
								type: "string",
								description: "说说正文"
							},
							time: {
								type: "integer",
								description: "发表时间（unix 秒）"
							},
							comment_num: {
								type: "integer",
								description: "评论数"
							},
							is_private: {
								type: "boolean",
								description: "是否仅自己可见"
							},
							images: {
								type: "array",
								items: { type: "string" },
								description: "图片 URL 列表（每图取最大可用变体）"
							}
						},
						required: [
							"tid",
							"content",
							"time",
							"comment_num",
							"is_private",
							"images"
						]
					}
				}
			},
			required: ["total", "msglist"]
		},
		summary: "获取 QQ 空间说说列表（默认机器人自己的空间）",
		params: {
			target_uin: f.userId().describe("目标 QQ 号，省略则取机器人自己").optional(),
			pos: f.int({ min: 0 }).describe("起始偏移").default(0),
			num: f.int({
				min: 1,
				max: 100
			}).describe("本页数量").default(20)
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.qzone.getMsgList(p.target_uin, p.pos, p.num));
		}
	}),
	defineAction({
		name: "get_qzone_feeds",
		readOnly: true,
		returns: "好友动态对象，含本页 feed 数组与是否有更多页。",
		returnsSchema: {
			type: "object",
			properties: {
				feeds: {
					type: "array",
					description: "本页好友动态数组",
					items: {
						type: "object",
						properties: {
							uin: {
								type: "integer",
								description: "动态作者 QQ 号"
							},
							nickname: {
								type: "string",
								description: "作者昵称"
							},
							time: {
								type: "integer",
								description: "发表时间（unix 秒）"
							},
							appid: {
								type: "integer",
								description: "Qzone 应用 id（311=说说，4=相册，…）"
							},
							key: {
								type: "string",
								description: "feed 句柄（Qzone 用于定位该条动态）"
							},
							html: {
								type: "string",
								description: "预渲染 HTML 原样透传"
							}
						},
						required: [
							"uin",
							"nickname",
							"time",
							"appid",
							"key",
							"html"
						]
					}
				},
				has_more: {
					type: "boolean",
					description: "服务端是否报告本页之后还有更多页"
				}
			},
			required: ["feeds", "has_more"]
		},
		summary: "获取 QQ 空间好友动态（feed）；page_num 仅首页可靠，深翻页需时间游标（暂未实现）",
		params: {
			page_num: f.int({ min: 1 }).describe("页码（1 起；仅首页可靠）").default(1),
			count: f.int({
				min: 1,
				max: 50
			}).describe("本页数量").default(10)
		},
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.qzone.getFeeds(p.page_num, p.count));
		}
	}),
	defineAction({
		name: "send_qzone_msg",
		summary: "发表说说（QQ 空间，支持纯文字或带图；传 images 自动上传；可设置查看权限）",
		params: {
			content: f.string({ allowEmpty: false }).describe("说说正文"),
			images: f.array(f.string({ allowEmpty: false })).describe("图片数组（可选），支持 file:// http:// base64://；自动上传").optional(),
			ugc_right: f.int({ min: 1 }).describe("查看权限：1=所有人可见，4=好友可见，16=部分好友可见，64=仅自己可见，128=部分好友不可见").default(1),
			target_uins: f.array(f.uint()).describe("权限作用 QQ 号数组；ugc_right=16 时表示可见名单，128 时表示不可见名单").optional()
		},
		rules: (r) => [r.rule("ugc_right must be one of 1, 4, 16, 64, 128", (p) => QZONE_UGC_RIGHTS.has(p.ugc_right)), r.rule("target_uins is required when ugc_right is 16 or 128", (p) => p.ugc_right !== 16 && p.ugc_right !== 128 || !!p.target_uins?.length)],
		run: async (p, ctx) => {
			if (p.images && p.images.length > 0) {
				const richval = await uploadQzoneImages(ctx, p.images, (upload) => upload.richval);
				return okResponse(await ctx.bridge.apis.qzone.publish(p.content, 1, richval, p.ugc_right, p.target_uins?.join("|")));
			}
			return okResponse(await ctx.bridge.apis.qzone.publish(p.content, void 0, void 0, p.ugc_right, p.target_uins?.join("|")));
		}
	}),
	defineAction({
		name: "delete_qzone_msg",
		summary: "删除一条说说（QQ 空间，按 tid）",
		params: { tid: f.string({ allowEmpty: false }).describe("说说 tid（来自 get_qzone_msg_list / send_qzone_msg）") },
		run: async (p, ctx) => {
			await ctx.bridge.apis.qzone.delete(p.tid);
			return okResponse(null);
		}
	}),
	defineAction({
		name: "set_qzone_msg_right",
		returns: "更新后的权限对象。",
		returnsSchema: {
			type: "object",
			properties: { ugc_right: {
				type: "integer",
				description: "更新后的查看权限"
			} },
			required: ["ugc_right"]
		},
		summary: "修改一条已发说说的查看权限（QQ 空间，按 tid）",
		params: {
			tid: f.string({ allowEmpty: false }).describe("说说 tid（来自 get_qzone_msg_list / send_qzone_msg）"),
			ugc_right: f.int({ min: 1 }).describe("查看权限：1=所有人可见，4=好友可见，16=部分好友可见，64=仅自己可见，128=部分好友不可见"),
			target_uins: f.array(f.uint()).describe("权限作用 QQ 号数组；ugc_right=16 时表示可见名单，128 时表示不可见名单").optional()
		},
		rules: (r) => [r.rule("ugc_right must be one of 1, 4, 16, 64, 128", (p) => QZONE_UGC_RIGHTS.has(p.ugc_right)), r.rule("target_uins is required when ugc_right is 16 or 128", (p) => p.ugc_right !== 16 && p.ugc_right !== 128 || !!p.target_uins?.length)],
		run: async (p, ctx) => {
			return okResponse(await ctx.bridge.apis.qzone.updateRight(p.tid, p.ugc_right, p.target_uins?.join("|")));
		}
	}),
	defineAction({
		name: "like_qzone",
		summary: "给一条说说点赞（QQ 空间）",
		params: {
			tid: f.string({ allowEmpty: false }).describe("说说 tid"),
			target_uin: f.userId().describe("说说所属 QQ 号，省略则为机器人自己").optional(),
			abstime: f.int({ min: 0 }).describe("说说发表时间（unix 秒），传真实值更可靠").default(0).role("timestamp")
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.qzone.like(p.tid, p.target_uin, true, p.abstime);
			return okResponse(null);
		}
	}),
	defineAction({
		name: "unlike_qzone",
		summary: "取消对一条说说的点赞（QQ 空间；取消赞端点待真机核实）",
		params: {
			tid: f.string({ allowEmpty: false }).describe("说说 tid"),
			target_uin: f.userId().describe("说说所属 QQ 号，省略则为机器人自己").optional(),
			abstime: f.int({ min: 0 }).describe("说说发表时间（unix 秒），传真实值更可靠").default(0).role("timestamp")
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.qzone.like(p.tid, p.target_uin, false, p.abstime);
			return okResponse(null);
		}
	}),
	defineAction({
		name: "comment_qzone",
		summary: "评论一条说说（QQ 空间，支持纯文字或带图；传 images 自动上传）",
		params: {
			tid: f.string({ allowEmpty: false }).describe("说说 tid"),
			content: f.string({ allowEmpty: false }).describe("评论内容"),
			target_uin: f.userId().describe("说说所属 QQ 号，省略则为机器人自己").optional(),
			images: f.array(f.string({ allowEmpty: false })).describe("图片数组（可选），支持 file:// http:// base64://；自动上传").optional()
		},
		run: async (p, ctx) => {
			if (p.images && p.images.length > 0) {
				const richval = await uploadQzoneImages(ctx, p.images, (upload) => upload.url);
				return okResponse(await ctx.bridge.apis.qzone.comment(p.tid, p.content, p.target_uin, 1, richval));
			}
			return okResponse(await ctx.bridge.apis.qzone.comment(p.tid, p.content, p.target_uin));
		}
	}),
	defineAction({
		name: "set_qzone_ban",
		summary: "拉黑或解除拉黑某人（修改机器人自身 QQ 空间黑名单；enable=true 拉黑，false 解除）",
		params: {
			user_id: f.userId().describe("目标 QQ 号"),
			enable: f.bool().describe("true 拉黑，false 解除拉黑").default(true)
		},
		run: async (p, ctx) => {
			await ctx.bridge.apis.qzone.setBlack(p.user_id, p.enable);
			return okResponse(null);
		}
	})
];
//#endregion
//#region ../onebot/src/stream-storage.ts
var StreamStorage = class {
	root;
	uploadDir;
	downloadDir;
	activeItems = /* @__PURE__ */ new Map();
	nextActiveItemId = 1;
	constructor(root) {
		this.root = resolveManagedRoot(root);
		this.uploadDir = path.join(this.root, "upload");
		this.downloadDir = path.join(this.root, "download");
	}
	/**
	* Create a directory inside the managed root without following a substituted
	* directory link. Existing directories remain usable when they belong to the
	* current account and cannot be modified by other local accounts.
	*/
	ensureDirectory(directory) {
		const resolved = path.resolve(directory);
		if (resolved !== this.root && !isStrictDescendant(this.root, resolved)) throw new Error(`stream directory is outside the managed root: ${directory}`);
		let current = this.root;
		ensureManagedDirectory(current);
		const relative = path.relative(this.root, resolved);
		if (!relative) return;
		for (const segment of relative.split(path.sep)) {
			current = path.join(current, segment);
			ensureManagedDirectory(current);
		}
	}
	registerActiveItem(paths) {
		const normalized = paths.map((item) => {
			const resolved = path.resolve(item);
			if (!isStrictDescendant(this.root, resolved)) throw new Error(`active stream path is outside the managed root: ${item}`);
			return resolved;
		});
		const id = this.nextActiveItemId++;
		this.activeItems.set(id, normalized);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.activeItems.delete(id);
		};
	}
	snapshot() {
		if (!this.assertRootDirectoryOrMissing()) return {
			totalBytes: 0,
			fileCount: 0,
			activeItemCount: this.activeItems.size
		};
		let totalBytes = 0;
		let fileCount = 0;
		this.walkFiles(this.root, (stat) => {
			totalBytes += stat.size;
			fileCount += 1;
		});
		return {
			totalBytes,
			fileCount,
			activeItemCount: this.activeItems.size
		};
	}
	clearInactive() {
		const result = {
			deletedFiles: 0,
			freedBytes: 0,
			skippedActiveItems: this.activeItems.size,
			failures: []
		};
		if (!this.assertRootDirectoryOrMissing()) return result;
		const activePaths = [...this.activeItems.values()].flat();
		let entries;
		try {
			entries = fs.readdirSync(this.root, { withFileTypes: true });
		} catch (error) {
			result.failures.push({
				item: ".",
				message: this.publicErrorMessage(error)
			});
			return result;
		}
		for (const entry of entries) this.clearNode(path.join(this.root, entry.name), activePaths, result);
		return result;
	}
	assertRootDirectoryOrMissing() {
		try {
			const stat = fs.lstatSync(this.root);
			assertManagedDirectory(this.root, stat);
			return true;
		} catch (error) {
			if (isMissing(error)) return false;
			throw error;
		}
	}
	walkFiles(dir, visit) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const item = path.join(dir, entry.name);
			const stat = fs.lstatSync(item);
			if (stat.isDirectory()) this.walkFiles(item, visit);
			else visit(stat);
		}
	}
	clearNode(item, activePaths, result) {
		const resolved = path.resolve(item);
		if (activePaths.some((active) => isSameOrDescendant(active, resolved))) return;
		let stat;
		try {
			stat = fs.lstatSync(resolved);
		} catch (error) {
			if (!isMissing(error)) result.failures.push({
				item: this.displayPath(resolved),
				message: this.publicErrorMessage(error)
			});
			return;
		}
		if (!stat.isDirectory()) {
			try {
				fs.unlinkSync(resolved);
				result.deletedFiles += 1;
				result.freedBytes += stat.size;
			} catch (error) {
				if (!isMissing(error)) result.failures.push({
					item: this.displayPath(resolved),
					message: this.publicErrorMessage(error)
				});
			}
			return;
		}
		let entries;
		try {
			entries = fs.readdirSync(resolved, { withFileTypes: true });
		} catch (error) {
			result.failures.push({
				item: this.displayPath(resolved),
				message: this.publicErrorMessage(error)
			});
			return;
		}
		for (const entry of entries) this.clearNode(path.join(resolved, entry.name), activePaths, result);
		try {
			if (fs.readdirSync(resolved).length === 0) fs.rmdirSync(resolved);
		} catch (error) {
			if (!isMissing(error)) result.failures.push({
				item: this.displayPath(resolved),
				message: this.publicErrorMessage(error)
			});
		}
	}
	displayPath(item) {
		return path.relative(this.root, item) || ".";
	}
	publicErrorMessage(error) {
		return errorMessage$1(error).split(this.root).join("[临时目录]");
	}
};
function isStrictDescendant(root, candidate) {
	const relative = path.relative(root, candidate);
	return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
function isSameOrDescendant(root, candidate) {
	return root === candidate || isStrictDescendant(root, candidate);
}
function isMissing(error) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function errorMessage$1(error) {
	return error instanceof Error ? error.message : String(error);
}
function assertManagedDirectory(directory, stat) {
	if (stat.isSymbolicLink()) throw new Error(`managed stream directory must not be a symbolic link: ${directory}`);
	if (!stat.isDirectory()) throw new Error(`managed stream path is not a directory: ${directory}`);
	const currentUid = typeof process.getuid === "function" ? process.getuid() : void 0;
	if (currentUid !== void 0 && stat.uid !== currentUid) throw new Error(`managed stream directory is owned by another account: ${directory}`);
	if (process.platform !== "win32" && (stat.mode & 18) !== 0) throw new Error(`managed stream directory is writable by other accounts: ${directory}`);
}
function ensureManagedDirectory(directory) {
	let stat;
	try {
		stat = fs.lstatSync(directory);
	} catch (error) {
		if (!isMissing(error)) throw error;
		try {
			fs.mkdirSync(directory, { mode: 448 });
		} catch (mkdirError) {
			if (!(mkdirError instanceof Error && "code" in mkdirError && mkdirError.code === "EEXIST")) throw mkdirError;
		}
		stat = fs.lstatSync(directory);
	}
	assertManagedDirectory(directory, stat);
}
function resolveManagedRoot(input) {
	const absolute = path.resolve(input);
	try {
		assertManagedDirectory(absolute, fs.lstatSync(absolute));
		return fs.realpathSync(absolute);
	} catch (error) {
		if (!isMissing(error)) throw error;
	}
	const parent = path.dirname(absolute);
	if (!fs.statSync(parent).isDirectory()) throw new Error(`managed stream parent is not a directory: ${parent}`);
	return path.join(fs.realpathSync(parent), path.basename(absolute));
}
var streamStorage = new StreamStorage(path.join(os.tmpdir(), "onebot-stream"));
var STREAM_ROOT = streamStorage.root;
var STREAM_UPLOAD_DIR = streamStorage.uploadDir;
streamStorage.downloadDir;
function registerActiveStreamItem(paths) {
	return streamStorage.registerActiveItem(paths);
}
function ensureStreamDirectory(directory) {
	streamStorage.ensureDirectory(directory);
}
function snapshotStreamStorage() {
	return streamStorage.snapshot();
}
function clearInactiveStreamStorage() {
	return streamStorage.clearInactive();
}
//#endregion
//#region ../onebot/src/actions/stream-file.ts
var log$2 = createLogger("OneBot.Stream");
var UPLOAD_TIMEOUT_MS = 600 * 1e3;
var DEFAULT_RETENTION_MS = 300 * 1e3;
var MAX_CONCURRENT_STREAMS = 64;
var MAX_CHUNKS = 2e5;
var MAX_CHUNK_BYTES = 32 * 1024 * 1024;
var MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024;
var SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
var StreamError = class extends Error {};
function validateStreamId(id) {
	if (!SAFE_ID_RE.test(id)) throw new StreamError("invalid stream_id (allowed: 1-128 chars of A-Z a-z 0-9 _ -)");
}
/** Account namespace for the in-memory map + on-disk dirs. Empty (tests / no
*  login) → flat, un-namespaced. Sanitised so it can't widen the path either. */
function accountKey(ctx) {
	let raw = "";
	try {
		raw = String(ctx?.getLoginInfo?.().userId ?? "");
	} catch {
		raw = "";
	}
	return raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}
/** Belt-and-braces: assert a derived path stays inside the upload dir even if
*  the allowlist above is ever weakened. */
function assertWithin(root, target) {
	const rel = path$1.relative(root, target);
	if (rel === "" || rel.startsWith("..") || path$1.isAbsolute(rel)) throw new StreamError("resolved stream path escapes the upload directory");
}
/** Process-wide. Key is account-namespaced so two accounts (same process) can't
*  collide on a shared/non-UUID stream_id. */
var uploads = /* @__PURE__ */ new Map();
function reapTimer(key) {
	const t = setTimeout(() => {
		cleanupUpload(key, true);
	}, UPLOAD_TIMEOUT_MS);
	if (typeof t.unref === "function") t.unref();
	return t;
}
function cleanupUpload(key, deleteFinal) {
	const state = uploads.get(key);
	if (!state) return;
	clearTimeout(state.timeoutId);
	try {
		fs$1.rmSync(state.tempDir, {
			recursive: true,
			force: true
		});
	} catch (error) {
		log$2.warn("failed to delete stream upload chunks %s: %s", state.tempDir, errorMessage(error));
	}
	if (deleteFinal) try {
		fs$1.rmSync(state.finalPath, { force: true });
	} catch (error) {
		log$2.warn("failed to delete stream upload file %s: %s", state.finalPath, errorMessage(error));
	}
	uploads.delete(key);
	state.releaseStorageActivity();
}
function safeFilename(name, id) {
	return (name ?? "").replace(/[/\\]/g, "_").replace(/\.\.+/g, "_").replace(/^\.+/, "").trim() || `upload_${id}`;
}
function createUpload(p, account) {
	if (!p.total_chunks || p.total_chunks <= 0) throw new StreamError("total_chunks required for new stream");
	if (p.total_chunks > MAX_CHUNKS) throw new StreamError(`total_chunks exceeds limit (${MAX_CHUNKS})`);
	if (p.file_size !== void 0 && p.file_size > MAX_UPLOAD_BYTES) throw new StreamError(`file_size exceeds limit (${MAX_UPLOAD_BYTES} bytes)`);
	if (uploads.size >= MAX_CONCURRENT_STREAMS) throw new StreamError(`too many concurrent upload streams (${MAX_CONCURRENT_STREAMS})`);
	const filename = safeFilename(p.filename, p.stream_id);
	const dirRoot = account ? path$1.join(STREAM_UPLOAD_DIR, account) : STREAM_UPLOAD_DIR;
	const tempDir = path$1.join(dirRoot, p.stream_id);
	const finalPath = path$1.join(dirRoot, `${p.stream_id}__${filename}`);
	assertWithin(STREAM_UPLOAD_DIR, tempDir);
	assertWithin(STREAM_UPLOAD_DIR, finalPath);
	ensureStreamDirectory(tempDir);
	const key = account ? `${account}:${p.stream_id}` : p.stream_id;
	const releaseStorageActivity = registerActiveStreamItem([tempDir, finalPath]);
	const state = {
		id: p.stream_id,
		key,
		filename,
		totalChunks: p.total_chunks,
		claimed: /* @__PURE__ */ new Set(),
		written: /* @__PURE__ */ new Set(),
		bytesWritten: 0,
		fileSize: p.file_size,
		expectedSha256: p.expected_sha256,
		tempDir,
		finalPath,
		fileRetention: p.file_retention,
		timeoutId: reapTimer(key),
		releaseStorageActivity
	};
	uploads.set(key, state);
	return state;
}
function statusFrame(state, status) {
	return okResponse({
		type: StreamStatus.Stream,
		stream_id: state.id,
		status,
		received_chunks: state.written.size,
		total_chunks: state.totalChunks
	});
}
function writeChunkToStream(stream, buf) {
	return new Promise((resolve, reject) => {
		stream.write(buf, (err) => err ? reject(err) : resolve());
	});
}
async function completeUpload(state) {
	if (state.written.size !== state.totalChunks) {
		const missing = [];
		for (let i = 0; i < state.totalChunks && missing.length < 16; i++) if (!state.written.has(i)) missing.push(i);
		const more = state.totalChunks - state.written.size > missing.length ? "…" : "";
		throw new StreamError(`incomplete stream: missing ${state.totalChunks - state.written.size} chunk(s) [${missing.join(",")}${more}]`);
	}
	const hash = createHash("sha256");
	const out = fs$1.createWriteStream(state.finalPath);
	try {
		for (let i = 0; i < state.totalChunks; i++) {
			const buf = await fs$1.promises.readFile(path$1.join(state.tempDir, `${i}.chunk`));
			hash.update(buf);
			await writeChunkToStream(out, buf);
		}
		await new Promise((resolve, reject) => out.end((err) => err ? reject(err) : resolve()));
	} catch (err) {
		out.destroy();
		try {
			fs$1.rmSync(state.finalPath, { force: true });
		} catch (error) {
			log$2.warn("failed to delete incomplete stream file %s: %s", state.finalPath, errorMessage(error));
		}
		throw err;
	}
	const sha256 = hash.digest("hex");
	if (state.expectedSha256 && sha256 !== state.expectedSha256) {
		try {
			fs$1.rmSync(state.finalPath, { force: true });
		} catch (error) {
			log$2.warn("failed to delete invalid stream file %s: %s", state.finalPath, errorMessage(error));
		}
		throw new StreamError(`sha256 mismatch (expected ${state.expectedSha256}, got ${sha256})`);
	}
	const finalPath = state.finalPath;
	const fileSize = fs$1.statSync(finalPath).size;
	const received = state.written.size;
	const total = state.totalChunks;
	const retention = state.fileRetention;
	cleanupUpload(state.key, false);
	if (retention > 0) {
		const t = setTimeout(() => {
			fs$1.rm(finalPath, { force: true }, (err) => {
				if (err) log$2.warn("failed to delete retained stream file %s: %s", finalPath, err.message);
			});
		}, retention);
		if (typeof t.unref === "function") t.unref();
	}
	return okResponse({
		type: StreamStatus.Response,
		stream_id: state.id,
		status: "file_complete",
		received_chunks: received,
		total_chunks: total,
		file_path: finalPath,
		file_name: state.filename,
		file_size: fileSize,
		sha256
	});
}
async function handleUpload(p, account = "") {
	validateStreamId(p.stream_id);
	const key = account ? `${account}:${p.stream_id}` : p.stream_id;
	if (p.reset) {
		cleanupUpload(key, true);
		throw new StreamError("Stream reset completed");
	}
	if (p.verify_only) {
		const state = uploads.get(key);
		if (!state) throw new StreamError("stream not found");
		return statusFrame(state, "file_created");
	}
	const state = uploads.get(key) ?? createUpload(p, account);
	if (p.expected_sha256 !== void 0) state.expectedSha256 = p.expected_sha256;
	if (p.file_size !== void 0) state.fileSize = p.file_size;
	if (p.chunk_data !== void 0 && p.chunk_index !== void 0) {
		const index = p.chunk_index;
		if (index < 0 || index >= state.totalChunks) throw new StreamError(`invalid chunk index: ${index}`);
		if (state.claimed.has(index)) return statusFrame(state, "chunk_received");
		const buf = Buffer.from(p.chunk_data, "base64");
		if (buf.length > MAX_CHUNK_BYTES) throw new StreamError(`chunk exceeds size limit (${MAX_CHUNK_BYTES} bytes)`);
		if (state.bytesWritten + buf.length > MAX_UPLOAD_BYTES) throw new StreamError(`stream exceeds total size limit (${MAX_UPLOAD_BYTES} bytes)`);
		state.claimed.add(index);
		state.bytesWritten += buf.length;
		try {
			await fs$1.promises.writeFile(path$1.join(state.tempDir, `${index}.chunk`), buf);
		} catch (err) {
			state.claimed.delete(index);
			state.bytesWritten -= buf.length;
			throw err;
		}
		state.written.add(index);
		clearTimeout(state.timeoutId);
		state.timeoutId = reapTimer(state.key);
		return statusFrame(state, "chunk_received");
	}
	if (p.is_complete || state.written.size === state.totalChunks) return completeUpload(state);
	return statusFrame(state, "file_created");
}
var actions$2 = [defineStreamAction({
	name: "upload_file_stream",
	summary: "以流式分块方式上传文件到机器人本地(返回可用于发送的本地路径)",
	returns: "流式帧:分块确认 type=stream、完成 type=response(含 file_path/file_name/file_size/sha256)",
	params: {
		stream_id: f.string({ allowEmpty: false }).describe("流 ID(客户端生成的 UUID,限 [A-Za-z0-9_-])"),
		chunk_data: f.string().optional().describe("分块数据(Base64)"),
		chunk_index: f.int({ min: 0 }).optional().describe("分块索引(从 0 开始)"),
		total_chunks: f.int({ min: 1 }).optional().describe("总分块数(新流必填)"),
		file_size: f.int({ min: 0 }).optional().describe("文件总大小(字节)"),
		expected_sha256: f.string().optional().describe("期望的整文件 SHA256(校验)"),
		is_complete: f.bool().optional().describe("是否为最后一个分块/触发合并"),
		filename: f.string().optional().describe("文件名"),
		reset: f.bool().optional().describe("重置并丢弃该流"),
		verify_only: f.bool().optional().describe("仅查询当前流状态"),
		file_retention: f.int({ min: 0 }).default(DEFAULT_RETENTION_MS).describe("合并文件保留毫秒(0=不回收)")
	},
	run: (p, ctx) => handleUpload(p, accountKey(ctx))
}), defineAction({
	name: "clean_stream_temp_file",
	summary: "清理流式传输临时文件(仅清理 stream 上传/下载目录)",
	returns: "{ message, removed }",
	params: {},
	run: () => {
		const result = clearInactiveStreamStorage();
		for (const failure of result.failures) log$2.warn("failed to remove stream temp %s: %s", failure.item, failure.message);
		if (result.failures.length > 0) throw new StreamError(`failed to remove ${result.failures.length} stream temp item(s)`);
		return okResponse({
			message: "success",
			removed: result.deletedFiles,
			freed_bytes: result.freedBytes,
			skipped_active: result.skippedActiveItems
		});
	}
})];
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region ../onebot/src/actions/stream-download.ts
var DEFAULT_CHUNK_BYTES = 64 * 1024;
var MAX_CHUNK_REQUEST_BYTES = 16 * 1024 * 1024;
var MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024 * 1024;
var FETCH_CONNECT_TIMEOUT_MS = 3e4;
var IDLE_TIMEOUT_MS = 6e4;
var MAX_REDIRECTS = 5;
var DOWNLOAD_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var DownloadError = class extends Error {};
function isWithinStreamRoot(p) {
	let root = path$1.resolve(STREAM_ROOT);
	try {
		root = fs$1.realpathSync(STREAM_ROOT);
	} catch {}
	const rel = path$1.relative(root, path$1.resolve(p));
	return rel !== "" && !rel.startsWith("..") && !path$1.isAbsolute(rel);
}
function isPrivateV4(o) {
	return o[0] === 0 || o[0] === 127 || o[0] === 10 || o[0] === 192 && o[1] === 168 || o[0] === 172 && o[1] >= 16 && o[1] <= 31 || o[0] === 169 && o[1] === 254 || o[0] === 100 && o[1] >= 64 && o[1] <= 127;
}
/** Parse an IPv6 string (any form, incl. `::` compression and embedded IPv4)
*  to its 16 bytes. `new URL().hostname` normalises v4-mapped addresses to hex
*  (`::ffff:7f00:1`), so string matching is unreliable — we work on bytes. */
function ipv6ToBytes(input) {
	let s = input.replace(/^\[|\]$/g, "");
	if (net.isIP(s) !== 6) return null;
	const v4m = /:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
	if (v4m) {
		const o = v4m[1].split(".").map(Number);
		if (o.some((n) => n > 255)) return null;
		s = s.slice(0, v4m.index) + `:${(o[0] << 8 | o[1]).toString(16)}:${(o[2] << 8 | o[3]).toString(16)}`;
	}
	const halves = s.split("::");
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(":") : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
	let groups;
	if (halves.length === 2) {
		const missing = 8 - head.length - tail.length;
		if (missing < 0) return null;
		groups = [
			...head,
			...new Array(missing).fill("0"),
			...tail
		];
	} else groups = head;
	if (groups.length !== 8) return null;
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	for (let i = 0; i < 8; i++) {
		const g = parseInt(groups[i] || "0", 16);
		if (Number.isNaN(g) || g < 0 || g > 65535) return null;
		bytes[i * 2] = g >> 8;
		bytes[i * 2 + 1] = g & 255;
	}
	return bytes;
}
function isPrivateIp(ip) {
	const host = ip.replace(/^\[|\]$/g, "");
	const fam = net.isIP(host);
	if (fam === 4) return isPrivateV4(host.split(".").map(Number));
	if (fam === 6) {
		const b = ipv6ToBytes(host);
		if (!b) return true;
		if (b.every((x) => x === 0)) return true;
		if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return true;
		if ((b[0] & 254) === 252) return true;
		if (b[0] === 254 && (b[1] & 192) === 128) return true;
		if (b.slice(0, 10).every((x) => x === 0) && (b[10] === 255 && b[11] === 255 || b[10] === 0 && b[11] === 0)) return isPrivateV4([
			b[12],
			b[13],
			b[14],
			b[15]
		]);
		if (b[0] === 0 && b[1] === 100 && b[2] === 255 && b[3] === 155 && b.slice(4, 12).every((x) => x === 0)) return isPrivateV4([
			b[12],
			b[13],
			b[14],
			b[15]
		]);
		return false;
	}
	return false;
}
/** Parse + SSRF-guard a URL: http(s) only, and neither the literal host nor any
*  DNS-resolved address may be private/loopback/link-local. Not bulletproof
*  against DNS rebinding, but blocks the obvious metadata-endpoint / internal
*  service reach. */
async function assertSafeUrl(raw) {
	let u;
	try {
		u = new URL(raw);
	} catch {
		throw new DownloadError("invalid URL");
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") throw new DownloadError("only http(s) URLs are allowed");
	const host = u.hostname.replace(/^\[|\]$/g, "");
	if (net.isIP(host)) {
		if (isPrivateIp(host)) throw new DownloadError("refusing to fetch a private/loopback address");
		return u;
	}
	let addrs;
	try {
		addrs = await dns.lookup(host, { all: true });
	} catch {
		throw new DownloadError(`cannot resolve host: ${host}`);
	}
	for (const a of addrs) if (isPrivateIp(a.address)) throw new DownloadError("refusing to fetch a host that resolves to a private address");
	return u;
}
var asStr = (v) => typeof v === "string" ? v : "";
var asNum = (v) => {
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? n : 0;
};
/** Follow redirects MANUALLY, SSRF-guarding every hop. Default fetch follows
*  redirects automatically and would NOT re-check the target, so a public URL
*  could 302 to a private/metadata address — re-validating each Location closes
*  that. Each hop gets a TTFB-only timeout (cleared once headers arrive, so a
*  legitimate slow/large body isn't cut mid-transfer); the final hop's
*  AbortController is returned so the caller's idle watchdog can kill a stalled
*  body. (DNS rebinding between our check and undici's own connect remains a
*  known residual — it needs connect-time peer-IP validation to fully close.) */
async function fetchGuarded(rawUrl) {
	let current = rawUrl;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const u = await assertSafeUrl(current);
		const ac = new AbortController();
		const t = setTimeout(() => ac.abort(), FETCH_CONNECT_TIMEOUT_MS);
		let resp;
		try {
			resp = await fetch(u, {
				headers: { "User-Agent": DOWNLOAD_USER_AGENT },
				redirect: "manual",
				signal: ac.signal
			});
		} finally {
			clearTimeout(t);
		}
		if (resp.status >= 300 && resp.status < 400) {
			const loc = resp.headers.get("location");
			await resp.body?.cancel().catch(() => {});
			if (!loc) throw new DownloadError(`download failed: ${resp.status} redirect without Location`);
			current = new URL(loc, u).toString();
			continue;
		}
		return {
			resp,
			abort: () => ac.abort()
		};
	}
	throw new DownloadError("download failed: too many redirects");
}
async function openUrl(rawUrl, name, knownSize) {
	const { resp, abort } = await fetchGuarded(rawUrl);
	if (!resp.ok) {
		await resp.body?.cancel().catch(() => {});
		throw new DownloadError(`download failed: HTTP ${resp.status}`);
	}
	const declared = Number(resp.headers.get("content-length") ?? "");
	const size = (Number.isFinite(declared) && declared > 0 ? declared : 0) || knownSize;
	if (!resp.body) throw new DownloadError("download failed: empty response body");
	return {
		name: name || urlBasename(rawUrl),
		size,
		iterable: resp.body,
		abort
	};
}
function urlBasename(u) {
	try {
		const name = path$1.basename(new URL(u).pathname);
		return name && name !== "/" ? decodeURIComponent(name) : "download.bin";
	} catch {
		return "download.bin";
	}
}
async function resolveDownload(target, ctx, prefer, chunkSize) {
	const local = resolveLocalFilePath(target);
	if (local) {
		let st = null;
		try {
			st = fs$1.statSync(local);
		} catch {
			st = null;
		}
		if (st?.isFile()) {
			ensureStreamDirectory(STREAM_ROOT);
			let real = local;
			try {
				real = fs$1.realpathSync(local);
			} catch {}
			if (!isWithinStreamRoot(real)) throw new DownloadError("local downloads are restricted to the stream temp directory");
			const rs = fs$1.createReadStream(real, { highWaterMark: chunkSize });
			return {
				name: path$1.basename(real),
				size: st.size,
				iterable: rs,
				managedPath: real,
				abort: () => rs.destroy()
			};
		}
	}
	if (/^https?:\/\//i.test(target)) return openUrl(target, "", 0);
	let info = null;
	if (prefer !== "record") info = await ctx.getImageInfo(target);
	if (!info && prefer !== "image") info = await ctx.getRecordInfo(target);
	if (info) {
		const url = asStr(info.url) || asStr(info.file);
		if (/^https?:\/\//i.test(url)) return openUrl(url, asStr(info.file_name), asNum(info.file_size));
	}
	throw new DownloadError("file not found (expected a stream-dir path, an http(s) URL, or a cached image/voice id)");
}
async function streamChunks(sink, iterable, totalSize, dataType, abort) {
	let index = 0;
	let bytesRead = 0;
	let idle = null;
	const armIdle = () => {
		if (idle) clearTimeout(idle);
		idle = setTimeout(() => {
			abort?.();
		}, IDLE_TIMEOUT_MS);
		if (idle.unref) idle.unref();
	};
	armIdle();
	try {
		for await (const part of iterable) {
			armIdle();
			const buf = Buffer.isBuffer(part) ? part : Buffer.from(part);
			bytesRead += buf.length;
			if (bytesRead > MAX_DOWNLOAD_BYTES) throw new DownloadError(`download exceeds size limit (${MAX_DOWNLOAD_BYTES} bytes)`);
			const b64 = buf.toString("base64");
			await sink.send({
				type: StreamStatus.Stream,
				data_type: dataType,
				index,
				data: b64,
				size: buf.length,
				progress: totalSize > 0 ? Math.min(100, Math.round(bytesRead / totalSize * 100)) : 0,
				base64_size: b64.length
			});
			index++;
		}
	} finally {
		if (idle) clearTimeout(idle);
	}
	return {
		totalChunks: index,
		totalBytes: bytesRead
	};
}
async function runDownload(target, chunkSizeReq, ctx, sink, prefer) {
	if (!target) throw new DownloadError("file is required");
	let chunkSize = chunkSizeReq && chunkSizeReq > 0 ? chunkSizeReq : DEFAULT_CHUNK_BYTES;
	if (chunkSize > MAX_CHUNK_REQUEST_BYTES) chunkSize = MAX_CHUNK_REQUEST_BYTES;
	const src = await resolveDownload(target, ctx, prefer, chunkSize);
	const releaseStorageActivity = src.managedPath ? registerActiveStreamItem([src.managedPath]) : void 0;
	try {
		await sink.send({
			type: StreamStatus.Stream,
			data_type: "file_info",
			file_name: src.name,
			file_size: src.size,
			chunk_size: chunkSize
		});
		const { totalChunks, totalBytes } = await streamChunks(sink, src.iterable, src.size, "file_chunk", src.abort);
		return okResponse({
			type: StreamStatus.Response,
			data_type: "file_complete",
			file_name: src.name,
			total_chunks: totalChunks,
			total_bytes: totalBytes,
			message: "Download completed"
		});
	} finally {
		releaseStorageActivity?.();
	}
}
var downloadParams = {
	file: f.string().optional().describe("文件路径(限 stream 临时目录)/ http(s) URL").role("file"),
	file_id: f.string().optional().describe("文件 ID(缓存的图片/语音 id)").role("file_id"),
	chunk_size: f.int({ min: 1 }).optional().describe("分块大小(字节,默认 64KB)")
};
var actions$1 = [
	defineStreamAction({
		name: "download_file_stream",
		summary: "以流式方式下载文件(stream 目录本地文件 / URL / 缓存媒体)",
		returns: "流式帧:file_info → file_chunk* → file_complete",
		params: downloadParams,
		run: (p, ctx, sink) => runDownload(p.file || p.file_id || "", p.chunk_size, ctx, sink, "auto")
	}),
	defineStreamAction({
		name: "download_file_image_stream",
		summary: "以流式方式下载图片(缓存图片 id / URL / stream 目录本地文件)",
		returns: "流式帧:file_info → file_chunk* → file_complete",
		params: downloadParams,
		run: (p, ctx, sink) => runDownload(p.file || p.file_id || "", p.chunk_size, ctx, sink, "image")
	}),
	defineStreamAction({
		name: "download_file_record_stream",
		summary: "以流式方式下载语音(缓存语音 id / URL / stream 目录本地文件)",
		returns: "流式帧:file_info → file_chunk* → file_complete",
		params: downloadParams,
		run: (p, ctx, sink) => runDownload(p.file || p.file_id || "", p.chunk_size, ctx, sink, "record")
	}),
	defineStreamAction({
		name: "test_download_stream",
		summary: "测试下载流(推送 10 个数据帧,验证流式传输,不触达 QQ)",
		returns: "流式帧:data_chunk*10 → data_complete(error=true 时以 error 帧结束)",
		params: { error: f.bool().default(false).describe("是否触发测试错误") },
		run: async (p, _ctx, sink) => {
			for (let i = 0; i < 10; i++) await sink.send({
				type: StreamStatus.Stream,
				data: `Index-> ${i + 1}`,
				data_type: "data_chunk"
			});
			if (p.error) throw new DownloadError("This is a test error");
			return okResponse({
				type: StreamStatus.Response,
				data_type: "data_complete",
				data: "Stream transmission complete"
			});
		}
	})
];
//#endregion
//#region ../proton/src/runtime.ts
var PROTOBUF_UNKNOWN_FIELDS = Symbol.for("snowluma.proton.unknownFields");
var EMPTY_UNKNOWN_FIELD_METADATA = Object.freeze({
	fields: Object.freeze([]),
	totalOccurrences: 0,
	omittedOccurrences: 0,
	omittedByteLength: 0
});
function protobuf_getUnknownFieldMetadata(value) {
	if (typeof value !== "object" || value === null) return EMPTY_UNKNOWN_FIELD_METADATA;
	const metadata = value[PROTOBUF_UNKNOWN_FIELDS];
	if (typeof metadata !== "object" || metadata === null) return EMPTY_UNKNOWN_FIELD_METADATA;
	const candidate = metadata;
	if (!Array.isArray(candidate.fields)) return EMPTY_UNKNOWN_FIELD_METADATA;
	return {
		fields: candidate.fields,
		totalOccurrences: candidate.totalOccurrences ?? candidate.fields.length,
		omittedOccurrences: candidate.omittedOccurrences ?? 0,
		omittedByteLength: candidate.omittedByteLength ?? 0
	};
}
//#endregion
//#region ../protocol/src/bridge-oidb.ts
/**
* Build the OidbBase<T>-shaped TS value. Pure helper, no protobuf
* encoding happens here — pair with `encodeOidbEnv<T>` to produce the
* wire bytes.
*
* The `isUid` flag sets the envelope `reserved` field to 1; despite the
* name (kept for back-compat with the legacy API), `reserved = 1`
* empirically signals the UIN-form variant of an OIDB call. Omit
* (default false) for genuinely UID-keyed calls.
*/
function makeOidbEnvelope(oidbCmd, subCmd, body, isUid = false) {
	return {
		command: oidbCmd,
		subCommand: subCmd,
		errorCode: 0,
		body,
		errorMsg: "",
		reserved: isUid ? 1 : 0
	};
}
//#endregion
//#region ../protocol/src/oidb-service.ts
var __td$1 = new TextDecoder();
function __readVarint32$1(data, offset, end) {
	let value = 0;
	for (let i = 0; i < 5; i++) {
		if (offset >= end) throw new Error("protobuf truncated uint32 varint");
		const byte = data[offset++];
		if (i === 4 && (byte & 240) !== 0) throw new Error("protobuf uint32 varint overflow");
		value += (byte & 127) * 2 ** (i * 7);
		if ((byte & 128) === 0) return [value >>> 0, offset];
	}
	throw new Error("protobuf uint32 varint overflow");
}
function __readVarint64$1(data, offset, end) {
	let value = 0n;
	for (let i = 0; i < 10; i++) {
		if (offset >= end) throw new Error("protobuf truncated uint64 varint");
		const byte = data[offset++];
		if (i === 9 && byte > 1) throw new Error("protobuf uint64 varint overflow");
		value |= BigInt(byte & 127) << BigInt(i * 7);
		if ((byte & 128) === 0) return [value, offset];
	}
	throw new Error("protobuf uint64 varint overflow");
}
function __readVarint32Value$1(data, offset, end) {
	const [value, next] = __readVarint64$1(data, offset, end);
	return [Number(BigInt.asUintN(32, value)), next];
}
function __skipVarint$1(data, offset, end) {
	for (let i = 0; i < 10; i++) {
		if (offset >= end) throw new Error("protobuf truncated varint");
		const byte = data[offset++];
		if (i === 9 && byte > 1) throw new Error("protobuf varint overflow");
		if ((byte & 128) === 0) return offset;
	}
	throw new Error("protobuf varint overflow");
}
function __checkedEnd$1(offset, length, end) {
	if (length > end - offset) throw new Error("protobuf length-delimited field exceeds parent bounds");
	return offset + length;
}
function __skipUnknownField$1(data, offset, end, wireType, fieldNumber, depth = 0) {
	if (depth > 64) throw new Error("protobuf group nesting exceeds 64");
	if (wireType === 0) return __skipVarint$1(data, offset, end);
	if (wireType === 1) {
		if (end - offset < 8) throw new Error("protobuf truncated fixed64 field");
		return offset + 8;
	}
	if (wireType === 2) {
		const [length, next] = __readVarint32$1(data, offset, end);
		return __checkedEnd$1(next, length, end);
	}
	if (wireType === 3) {
		while (offset < end) {
			const [tag, next] = __readVarint32$1(data, offset, end);
			offset = next;
			const nestedField = tag >>> 3;
			const nestedWire = tag & 7;
			if (nestedField === 0) throw new Error("protobuf field number 0 is invalid");
			if (nestedWire === 4) {
				if (nestedField !== fieldNumber) throw new Error("protobuf mismatched end-group tag");
				return offset;
			}
			offset = __skipUnknownField$1(data, offset, end, nestedWire, nestedField, depth + 1);
		}
		throw new Error("protobuf unterminated group");
	}
	if (wireType === 4) throw new Error("protobuf unexpected end-group tag");
	if (wireType === 5) {
		if (end - offset < 4) throw new Error("protobuf truncated fixed32 field");
		return offset + 4;
	}
	throw new Error("protobuf invalid wire type " + wireType);
}
function protobuf_decode_OidbBaseMeta(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	let _f0 = null;
	let _f1 = null;
	let _f2 = null;
	let _f3 = null;
	let _f4 = null;
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32$1(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 8: {
				const [_val, _val_offset] = __readVarint32Value$1(data, offset, end);
				offset = _val_offset;
				_f0 = _val >>> 0;
				break;
			}
			case 16: {
				const [_val, _val_offset] = __readVarint32Value$1(data, offset, end);
				offset = _val_offset;
				_f1 = _val >>> 0;
				break;
			}
			case 24: {
				const [_val, _val_offset] = __readVarint32Value$1(data, offset, end);
				offset = _val_offset;
				_f2 = _val >>> 0;
				break;
			}
			case 42: {
				const [_len, _len_offset] = __readVarint32$1(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd$1(offset, _len, end);
				_f3 = __td$1.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			case 96: {
				const [_val, _val_offset] = __readVarint64$1(data, offset, end);
				offset = _val_offset;
				_f4 = Number(BigInt.asIntN(32, _val));
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField$1(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		command: _f0,
		subCommand: _f1,
		errorCode: _f2,
		errorMsg: _f3,
		reserved: _f4
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function resolveOidbCall(spec, params, ctx) {
	return {
		command: spec.resolveCommand ? spec.resolveCommand(params, ctx) : spec.command,
		subCommand: spec.resolveSubCommand ? spec.resolveSubCommand(params, ctx) : spec.subCommand
	};
}
function isAcceptedEnvelopeCode(spec, code) {
	if (code == null || code === 0) return true;
	return spec.acceptedEnvelopeCodes?.includes(code) === true;
}
var OidbError = class extends Error {
	code;
	serverMsg;
	command;
	subCommand;
	constructor(code, serverMsg, command, subCommand) {
		super(`OIDB error ${code} on 0x${command.toString(16)}_${subCommand}: ${serverMsg}`);
		this.code = code;
		this.serverMsg = serverMsg;
		this.command = command;
		this.subCommand = subCommand;
		this.name = "OidbError";
	}
};
/**
* Template method for every OIDB call. Builds the envelope, encodes it,
* sends through the ctx's `sendRawPacket`, validates the envelope's
* `errorCode`, decodes the body, and hands the wire-shaped response to
* the spec's `deserialize` for transformation into the business result.
*
* `ctx` is threaded into both `serialize` and `deserialize` so the
* namespace can do uid resolution / identity reads in-place rather
* than forcing the caller to pre-bake values into the params.
*/
async function invokeOidb(ctx, spec, params, timeoutMs) {
	const { command, subCommand } = resolveOidbCall(spec, params, ctx);
	const env = makeOidbEnvelope(command, subCommand, await spec.serialize(ctx, params), spec.uinForm ?? false);
	const reqBytes = spec.encode(env);
	const wireName = spec.wireName ? spec.wireName(command, subCommand) : `OidbSvcTrpcTcp.0x${command.toString(16)}_${subCommand}`;
	const result = timeoutMs === void 0 ? await ctx.sendRawPacket(wireName, reqBytes) : await ctx.sendRawPacket(wireName, reqBytes, timeoutMs);
	if (!result.gotResponse) throw new Error(result.errorMessage || "no response");
	if (!result.success) if (result.errorCode && result.errorCode !== 0) {
		if (!isAcceptedEnvelopeCode(spec, result.errorCode)) throw new OidbError(result.errorCode, result.errorMessage || "", command, subCommand);
	} else throw new Error(result.errorMessage || "packet send failed");
	const respBytes = result.responseData ?? /* @__PURE__ */ new Uint8Array(0);
	if (respBytes.length > 0) {
		const meta = protobuf_decode_OidbBaseMeta(respBytes);
		const code = meta?.errorCode;
		if (code && code !== 0 && !isAcceptedEnvelopeCode(spec, code)) throw new OidbError(code, meta?.errorMsg ?? "", command, subCommand);
	}
	const respBody = spec.decode(respBytes).body ?? {};
	return spec.deserialize(ctx, respBody);
}
//#endregion
//#region ../protocol/src/oidb-services/sys-faces/fetch-sys-faces.ts
var __td = new TextDecoder();
function __utf8Len(value) {
	let length = 0;
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code < 128) {
			length++;
			continue;
		}
		if (code < 2048) {
			length += 2;
			continue;
		}
		if ((code & 64512) === 55296) {
			if (i + 1 < value.length) {
				if ((value.charCodeAt(i + 1) & 64512) === 56320) {
					length += 4;
					i++;
					continue;
				}
			}
			length += 3;
			continue;
		}
		if ((code & 64512) === 56320) {
			length += 3;
			continue;
		}
		length += 3;
	}
	return length;
}
function __utf8Write(buf, offset, value) {
	for (let i = 0; i < value.length; i++) {
		let code = value.charCodeAt(i);
		if (code < 128) {
			buf[offset++] = code;
			continue;
		}
		if (code < 2048) {
			buf[offset++] = 192 | code >> 6;
			buf[offset++] = 128 | code & 63;
			continue;
		}
		if ((code & 64512) === 55296) {
			if (i + 1 < value.length) {
				const next = value.charCodeAt(i + 1);
				if ((next & 64512) === 56320) {
					const point = (code - 55296 << 10) + (next - 56320) + 65536;
					buf[offset++] = 240 | point >> 18;
					buf[offset++] = 128 | point >> 12 & 63;
					buf[offset++] = 128 | point >> 6 & 63;
					buf[offset++] = 128 | point & 63;
					i++;
					continue;
				}
			}
			code = 65533;
		} else if ((code & 64512) === 56320) code = 65533;
		buf[offset++] = 224 | code >> 12;
		buf[offset++] = 128 | code >> 6 & 63;
		buf[offset++] = 128 | code & 63;
	}
	return offset;
}
function __readVarint32(data, offset, end) {
	let value = 0;
	for (let i = 0; i < 5; i++) {
		if (offset >= end) throw new Error("protobuf truncated uint32 varint");
		const byte = data[offset++];
		if (i === 4 && (byte & 240) !== 0) throw new Error("protobuf uint32 varint overflow");
		value += (byte & 127) * 2 ** (i * 7);
		if ((byte & 128) === 0) return [value >>> 0, offset];
	}
	throw new Error("protobuf uint32 varint overflow");
}
function __readVarint64(data, offset, end) {
	let value = 0n;
	for (let i = 0; i < 10; i++) {
		if (offset >= end) throw new Error("protobuf truncated uint64 varint");
		const byte = data[offset++];
		if (i === 9 && byte > 1) throw new Error("protobuf uint64 varint overflow");
		value |= BigInt(byte & 127) << BigInt(i * 7);
		if ((byte & 128) === 0) return [value, offset];
	}
	throw new Error("protobuf uint64 varint overflow");
}
function __readVarint32Value(data, offset, end) {
	const [value, next] = __readVarint64(data, offset, end);
	return [Number(BigInt.asUintN(32, value)), next];
}
function __skipVarint(data, offset, end) {
	for (let i = 0; i < 10; i++) {
		if (offset >= end) throw new Error("protobuf truncated varint");
		const byte = data[offset++];
		if (i === 9 && byte > 1) throw new Error("protobuf varint overflow");
		if ((byte & 128) === 0) return offset;
	}
	throw new Error("protobuf varint overflow");
}
function __checkedEnd(offset, length, end) {
	if (length > end - offset) throw new Error("protobuf length-delimited field exceeds parent bounds");
	return offset + length;
}
function __skipUnknownField(data, offset, end, wireType, fieldNumber, depth = 0) {
	if (depth > 64) throw new Error("protobuf group nesting exceeds 64");
	if (wireType === 0) return __skipVarint(data, offset, end);
	if (wireType === 1) {
		if (end - offset < 8) throw new Error("protobuf truncated fixed64 field");
		return offset + 8;
	}
	if (wireType === 2) {
		const [length, next] = __readVarint32(data, offset, end);
		return __checkedEnd(next, length, end);
	}
	if (wireType === 3) {
		while (offset < end) {
			const [tag, next] = __readVarint32(data, offset, end);
			offset = next;
			const nestedField = tag >>> 3;
			const nestedWire = tag & 7;
			if (nestedField === 0) throw new Error("protobuf field number 0 is invalid");
			if (nestedWire === 4) {
				if (nestedField !== fieldNumber) throw new Error("protobuf mismatched end-group tag");
				return offset;
			}
			offset = __skipUnknownField(data, offset, end, nestedWire, nestedField, depth + 1);
		}
		throw new Error("protobuf unterminated group");
	}
	if (wireType === 4) throw new Error("protobuf unexpected end-group tag");
	if (wireType === 5) {
		if (end - offset < 4) throw new Error("protobuf truncated fixed32 field");
		return offset + 4;
	}
	throw new Error("protobuf invalid wire type " + wireType);
}
function protobuf_encode_OidbProperty(obj) {
	let size = 0;
	const _f0 = obj.key;
	let _c0;
	const _f1 = obj.value;
	if (_f0 != null && _f0 !== "") {
		_c0 = __utf8Len(_f0);
		const _len = _c0;
		size += 1;
		size += _len < 128 ? 1 : _len < 16384 ? 2 : _len < 2097152 ? 3 : _len < 268435456 ? 4 : 5;
		size += _len;
	}
	if (_f1 != null && _f1.length > 0) {
		const _len = _f1.length;
		size += 1;
		size += _len < 128 ? 1 : _len < 16384 ? 2 : _len < 2097152 ? 3 : _len < 268435456 ? 4 : 5;
		size += _len;
	}
	const buf = new Uint8Array(size);
	let offset = 0;
	if (_f0 != null && _f0 !== "") {
		buf[offset++] = 10;
		let _v = _c0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
		offset = __utf8Write(buf, offset, _f0);
	}
	if (_f1 != null && _f1.length > 0) {
		buf[offset++] = 18;
		const _len = _f1.length;
		let _v = _len;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
		buf.set(_f1, offset);
		offset += _len;
	}
	return buf;
}
function protobuf_decode_OidbProperty(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	let _f0 = null;
	let _f1 = null;
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 10: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f0 = __td.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			case 18: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f1 = data.slice(offset, _end);
				offset = _end;
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		key: _f0,
		value: _f1
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function protobuf_encode_OidbFetchSysFacesExpInfo(obj) {
	let size = 0;
	const _f0 = obj.field1;
	let _c0;
	if (_f0 != null && _f0 !== "") {
		_c0 = __utf8Len(_f0);
		const _len = _c0;
		size += 1;
		size += _len < 128 ? 1 : _len < 16384 ? 2 : _len < 2097152 ? 3 : _len < 268435456 ? 4 : 5;
		size += _len;
	}
	const buf = new Uint8Array(size);
	let offset = 0;
	if (_f0 != null && _f0 !== "") {
		buf[offset++] = 10;
		let _v = _c0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
		offset = __utf8Write(buf, offset, _f0);
	}
	return buf;
}
function protobuf_encode_OidbFetchSysFacesReq(obj) {
	let size = 0;
	const _f0 = obj.field1;
	const _f1 = obj.field2;
	const _f2 = obj.field3;
	const _f3 = obj.field4;
	let _c3;
	if (_f0 != null && _f0 !== 0) {
		const _val = _f0 >>> 0;
		size += 1;
		size += _val < 128 ? 1 : _val < 16384 ? 2 : _val < 2097152 ? 3 : _val < 268435456 ? 4 : 5;
	}
	if (_f1 != null && _f1 !== 0) {
		const _val = _f1 >>> 0;
		size += 1;
		size += _val < 128 ? 1 : _val < 16384 ? 2 : _val < 2097152 ? 3 : _val < 268435456 ? 4 : 5;
	}
	if (_f2 != null && _f2 !== 0) {
		const _val = _f2 >>> 0;
		size += 1;
		size += _val < 128 ? 1 : _val < 16384 ? 2 : _val < 2097152 ? 3 : _val < 268435456 ? 4 : 5;
	}
	if (_f3 != null) {
		_c3 = protobuf_encode_OidbFetchSysFacesExpInfo(_f3);
		const _len = _c3.length;
		size += 1;
		size += _len < 128 ? 1 : _len < 16384 ? 2 : _len < 2097152 ? 3 : _len < 268435456 ? 4 : 5;
		size += _len;
	}
	const buf = new Uint8Array(size);
	let offset = 0;
	if (_f0 != null && _f0 !== 0) {
		buf[offset++] = 8;
		let _v = _f0 >>> 0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
	}
	if (_f1 != null && _f1 !== 0) {
		buf[offset++] = 16;
		let _v = _f1 >>> 0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
	}
	if (_f2 != null && _f2 !== 0) {
		buf[offset++] = 24;
		let _v = _f2 >>> 0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
	}
	if (_f3 != null) {
		const _data = _c3;
		buf[offset++] = 34;
		const _len = _data.length;
		let _v = _len;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
		buf.set(_data, offset);
		offset += _len;
	}
	return buf;
}
function protobuf_decode_OidbFaceResourceUrl(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	let _f0 = null;
	let _f1 = null;
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 10: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f0 = __td.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			case 18: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f1 = __td.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		baseUrl: _f0,
		advUrl: _f1
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function protobuf_decode_OidbFaceEmoji(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	let _f0 = null;
	let _f1 = null;
	let _f2 = null;
	let _f3 = null;
	let _f4 = null;
	let _f5 = null;
	let _f6 = null;
	let _f7 = null;
	const _f8 = [];
	let _f9 = null;
	let _f10 = null;
	let _f11 = null;
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 10: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f0 = __td.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			case 18: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f1 = __td.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			case 26: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f2 = __td.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			case 32: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f3 = Number(BigInt.asIntN(32, _val));
				break;
			}
			case 40: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f4 = Number(BigInt.asIntN(32, _val));
				break;
			}
			case 48: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f5 = Number(BigInt.asIntN(32, _val));
				break;
			}
			case 56: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f6 = Number(BigInt.asIntN(32, _val));
				break;
			}
			case 66: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f7 = protobuf_decode_OidbFaceResourceUrl(data, offset, _end);
				offset = _end;
				break;
			}
			case 74: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f8.push(__td.decode(data.subarray(offset, _end)));
				offset = _end;
				break;
			}
			case 80: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f9 = Number(BigInt.asIntN(32, _val));
				break;
			}
			case 104: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f10 = Number(BigInt.asIntN(32, _val));
				break;
			}
			case 112: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f11 = Number(BigInt.asIntN(32, _val));
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		qSid: _f0,
		qDes: _f1,
		emCode: _f2,
		qCid: _f3,
		aniStickerType: _f4,
		aniStickerPackId: _f5,
		aniStickerId: _f6,
		url: _f7,
		emojiNameAlias: _f8,
		unknown10: _f9,
		aniStickerWidth: _f10,
		aniStickerHeight: _f11
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function protobuf_decode_OidbFaceEmojiList(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	let _f0 = null;
	const _f1 = [];
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 10: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f0 = __td.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			case 18: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f1.push(protobuf_decode_OidbFaceEmoji(data, offset, _end));
				offset = _end;
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		emojiPackName: _f0,
		emojiDetail: _f1
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function protobuf_decode_OidbFaceContent(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	const _f0 = [];
	let _f1 = null;
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 10: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f0.push(protobuf_decode_OidbFaceEmojiList(data, offset, _end));
				offset = _end;
				break;
			}
			case 18: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f1 = protobuf_decode_OidbFaceResourceUrl(data, offset, _end);
				offset = _end;
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		emojiList: _f0,
		resourceUrl: _f1
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function protobuf_decode_OidbFaceMagicContentList(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	const _f0 = [];
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 18: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f0.push(protobuf_decode_OidbFaceEmoji(data, offset, _end));
				offset = _end;
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = { emojiList: _f0 };
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function protobuf_decode_OidbFaceMagicContent(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	let _f0 = null;
	let _f1 = null;
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 10: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f0 = protobuf_decode_OidbFaceMagicContentList(data, offset, _end);
				offset = _end;
				break;
			}
			case 18: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f1 = protobuf_decode_OidbFaceResourceUrl(data, offset, _end);
				offset = _end;
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		field1: _f0,
		resourceUrl: _f1
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function protobuf_decode_OidbFetchSysFacesResp(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	let _f0 = null;
	let _f1 = null;
	let _f2 = null;
	let _f3 = null;
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 8: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f0 = Number(BigInt.asIntN(32, _val));
				break;
			}
			case 18: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f1 = protobuf_decode_OidbFaceContent(data, offset, _end);
				offset = _end;
				break;
			}
			case 26: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f2 = protobuf_decode_OidbFaceContent(data, offset, _end);
				offset = _end;
				break;
			}
			case 34: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f3 = protobuf_decode_OidbFaceMagicContent(data, offset, _end);
				offset = _end;
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		field1: _f0,
		commonFace: _f1,
		specialBigFace: _f2,
		specialMagicFace: _f3
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
function protobuf_encode_OidbBase__OidbFetchSysFacesReq(obj) {
	let size = 0;
	const _f0 = obj.command;
	const _f1 = obj.subCommand;
	const _f2 = obj.errorCode;
	const _f3 = obj.body;
	let _c3;
	const _f4 = obj.errorMsg;
	let _c4;
	const _f5 = obj.properties;
	let _c5;
	const _f6 = obj.reserved;
	if (_f0 != null && _f0 !== 0) {
		const _val = _f0 >>> 0;
		size += 1;
		size += _val < 128 ? 1 : _val < 16384 ? 2 : _val < 2097152 ? 3 : _val < 268435456 ? 4 : 5;
	}
	if (_f1 != null && _f1 !== 0) {
		const _val = _f1 >>> 0;
		size += 1;
		size += _val < 128 ? 1 : _val < 16384 ? 2 : _val < 2097152 ? 3 : _val < 268435456 ? 4 : 5;
	}
	if (_f2 != null && _f2 !== 0) {
		const _val = _f2 >>> 0;
		size += 1;
		size += _val < 128 ? 1 : _val < 16384 ? 2 : _val < 2097152 ? 3 : _val < 268435456 ? 4 : 5;
	}
	if (_f3 != null) {
		_c3 = protobuf_encode_OidbFetchSysFacesReq(_f3);
		const _len = _c3.length;
		size += 1;
		size += _len < 128 ? 1 : _len < 16384 ? 2 : _len < 2097152 ? 3 : _len < 268435456 ? 4 : 5;
		size += _len;
	}
	if (_f4 != null && _f4 !== "") {
		_c4 = __utf8Len(_f4);
		const _len = _c4;
		size += 1;
		size += _len < 128 ? 1 : _len < 16384 ? 2 : _len < 2097152 ? 3 : _len < 268435456 ? 4 : 5;
		size += _len;
	}
	if (_f5 != null && _f5.length > 0) {
		_c5 = new Array(_f5.length);
		for (let _i = 0; _i < _f5.length; _i++) {
			const _data = protobuf_encode_OidbProperty(_f5[_i]);
			_c5[_i] = _data;
			const _len = _data.length;
			size += 1;
			size += _len < 128 ? 1 : _len < 16384 ? 2 : _len < 2097152 ? 3 : _len < 268435456 ? 4 : 5;
			size += _len;
		}
	}
	if (_f6 != null && _f6 !== 0) {
		const _val = _f6 >>> 0;
		size += 1;
		size += _val < 128 ? 1 : _val < 16384 ? 2 : _val < 2097152 ? 3 : _val < 268435456 ? 4 : 5;
	}
	const buf = new Uint8Array(size);
	let offset = 0;
	if (_f0 != null && _f0 !== 0) {
		buf[offset++] = 8;
		let _v = _f0 >>> 0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
	}
	if (_f1 != null && _f1 !== 0) {
		buf[offset++] = 16;
		let _v = _f1 >>> 0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
	}
	if (_f2 != null && _f2 !== 0) {
		buf[offset++] = 24;
		let _v = _f2 >>> 0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
	}
	if (_f3 != null) {
		const _data = _c3;
		buf[offset++] = 34;
		const _len = _data.length;
		let _v = _len;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
		buf.set(_data, offset);
		offset += _len;
	}
	if (_f4 != null && _f4 !== "") {
		buf[offset++] = 42;
		let _v = _c4;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
		offset = __utf8Write(buf, offset, _f4);
	}
	if (_f5 != null && _f5.length > 0) for (let _i = 0; _i < _f5.length; _i++) {
		const _data = _c5[_i];
		buf[offset++] = 90;
		const _len = _data.length;
		let _v = _len;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
		buf.set(_data, offset);
		offset += _len;
	}
	if (_f6 != null && _f6 !== 0) {
		buf[offset++] = 96;
		let _v = _f6 >>> 0;
		if (_v < 128) buf[offset++] = _v;
		else if (_v < 16384) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7;
		} else if (_v < 2097152) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14;
		} else if (_v < 268435456) {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21;
		} else {
			buf[offset++] = _v & 127 | 128;
			buf[offset++] = _v >>> 7 & 127 | 128;
			buf[offset++] = _v >>> 14 & 127 | 128;
			buf[offset++] = _v >>> 21 & 127 | 128;
			buf[offset++] = _v >>> 28;
		}
	}
	return buf;
}
function protobuf_decode_OidbBase__OidbFetchSysFacesResp(data, offset = 0, end = data.length) {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > data.length) throw new Error("protobuf decoder bounds are invalid");
	let _f0 = null;
	let _f1 = null;
	let _f2 = null;
	let _f3 = null;
	let _f4 = null;
	const _f5 = [];
	let _f6 = null;
	let _unknownFields = null;
	let _unknownFieldsByKey = null;
	let _unknownTotalOccurrences = 0;
	let _unknownOmittedOccurrences = 0;
	let _unknownOmittedByteLength = 0;
	while (offset < end) {
		const _fieldStart = offset;
		const [_tag, _tagOffset] = __readVarint32(data, offset, end);
		offset = _tagOffset;
		if (_tag >>> 3 === 0) throw new Error("protobuf field number 0 is invalid");
		switch (_tag) {
			case 8: {
				const [_val, _val_offset] = __readVarint32Value(data, offset, end);
				offset = _val_offset;
				_f0 = _val >>> 0;
				break;
			}
			case 16: {
				const [_val, _val_offset] = __readVarint32Value(data, offset, end);
				offset = _val_offset;
				_f1 = _val >>> 0;
				break;
			}
			case 24: {
				const [_val, _val_offset] = __readVarint32Value(data, offset, end);
				offset = _val_offset;
				_f2 = _val >>> 0;
				break;
			}
			case 34: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f3 = protobuf_decode_OidbFetchSysFacesResp(data, offset, _end);
				offset = _end;
				break;
			}
			case 42: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f4 = __td.decode(data.subarray(offset, _end));
				offset = _end;
				break;
			}
			case 90: {
				const [_len, _len_offset] = __readVarint32(data, offset, end);
				offset = _len_offset;
				const _end = __checkedEnd(offset, _len, end);
				_f5.push(protobuf_decode_OidbProperty(data, offset, _end));
				offset = _end;
				break;
			}
			case 96: {
				const [_val, _val_offset] = __readVarint64(data, offset, end);
				offset = _val_offset;
				_f6 = Number(BigInt.asIntN(32, _val));
				break;
			}
			default: {
				const _unknownStart = offset;
				const wireType = _tag & 7;
				offset = __skipUnknownField(data, offset, end, wireType, _tag >>> 3);
				const _unknownFieldNumber = _tag >>> 3;
				const _unknownByteLength = offset - _unknownStart;
				const _unknownKey = _unknownFieldNumber * 8 + wireType;
				_unknownTotalOccurrences++;
				const _knownUnknown = _unknownFieldsByKey?.get(_unknownKey);
				if (_knownUnknown) {
					_knownUnknown.count++;
					_knownUnknown.totalByteLength += _unknownByteLength;
				} else if ((_unknownFields?.length ?? 0) < 64) {
					const _unknown = {
						fieldNumber: _unknownFieldNumber,
						wireType,
						count: 1,
						totalByteLength: _unknownByteLength
					};
					(_unknownFields ??= []).push(_unknown);
					(_unknownFieldsByKey ??= /* @__PURE__ */ new Map()).set(_unknownKey, _unknown);
				} else {
					_unknownOmittedOccurrences++;
					_unknownOmittedByteLength += _unknownByteLength;
				}
				break;
			}
		}
		if (offset <= _fieldStart || offset > end) throw new Error("protobuf decoder made invalid progress");
	}
	const _result = {
		command: _f0,
		subCommand: _f1,
		errorCode: _f2,
		body: _f3,
		errorMsg: _f4,
		properties: _f5,
		reserved: _f6
	};
	if (_unknownTotalOccurrences > 0) Object.defineProperty(_result, Symbol.for("snowluma.proton.unknownFields"), {
		value: {
			fields: _unknownFields ?? [],
			totalOccurrences: _unknownTotalOccurrences,
			omittedOccurrences: _unknownOmittedOccurrences,
			omittedByteLength: _unknownOmittedByteLength
		},
		enumerable: false
	});
	return _result;
}
var log$1 = createLogger("SysFace");
function emojiToEntry(e, location) {
	const qSid = e.qSid;
	if (qSid == null || qSid === "") {
		const metadata = protobuf_getUnknownFieldMetadata(e);
		const unexpectedIdFields = metadata.fields.filter((field) => field.fieldNumber === 1);
		if (unexpectedIdFields.length > 0) throw new Error(`system face id uses unsupported wire encoding at source ${location.source}, pack ${location.packIndex}, face ${location.faceIndex}: wireTypes=${unexpectedIdFields.map((field) => field.wireType).join(",")}`);
		log$1.warn("system face catalog skipped entry without id: source=%s pack=%d face=%d hasDescription=%s hasCode=%s unknownFields=%d", location.source, location.packIndex, location.faceIndex, Boolean(e.qDes), Boolean(e.emCode), metadata.totalOccurrences);
		return null;
	}
	if (typeof qSid !== "string") throw new Error(`system face id has invalid decoded type at source ${location.source}, pack ${location.packIndex}, face ${location.faceIndex}: ${typeof qSid}`);
	return {
		qSid,
		qDes: e.qDes ?? "",
		emCode: e.emCode ?? "",
		qCid: e.qCid ?? null,
		aniStickerType: e.aniStickerType ?? null,
		aniStickerPackId: e.aniStickerPackId ?? null,
		aniStickerId: e.aniStickerId ?? null,
		url: e.url?.baseUrl ?? null,
		emojiNameAlias: e.emojiNameAlias ?? [],
		aniStickerWidth: e.aniStickerWidth ?? null,
		aniStickerHeight: e.aniStickerHeight ?? null
	};
}
function emojisToEntries(emojis, source, packIndex) {
	const entries = [];
	for (const [faceIndex, emoji] of emojis.entries()) {
		const entry = emojiToEntry(emoji, {
			source,
			packIndex,
			faceIndex
		});
		if (entry) entries.push(entry);
	}
	return entries;
}
var FetchSysFaces;
(function(_FetchSysFaces) {
	_FetchSysFaces.command = 37204;
	_FetchSysFaces.subCommand = 1;
	_FetchSysFaces.serialize = (_ctx, _p) => ({
		field1: 0,
		field2: 7,
		field3: 0
	});
	_FetchSysFaces.deserialize = (_ctx, body) => {
		const packs = [];
		for (const [source, content] of [["common", body.commonFace], ["special-big", body.specialBigFace]]) for (const list of content?.emojiList ?? []) {
			const packIndex = packs.length;
			packs.push({
				packName: list.emojiPackName ?? "",
				emojis: emojisToEntries(list.emojiDetail ?? [], source, packIndex)
			});
		}
		const magicEmojis = body.specialMagicFace?.field1?.emojiList ?? [];
		if (magicEmojis.length > 0) {
			const packIndex = packs.length;
			packs.push({
				packName: "MagicFace",
				emojis: emojisToEntries(magicEmojis, "magic", packIndex)
			});
		}
		return packs;
	};
	_FetchSysFaces.encode = (env) => protobuf_encode_OidbBase__OidbFetchSysFacesReq(env);
	_FetchSysFaces.decode = (bytes) => protobuf_decode_OidbBase__OidbFetchSysFacesResp(bytes);
	_FetchSysFaces.invoke = (deps, params = {}) => invokeOidb(deps, FetchSysFaces, params);
})(FetchSysFaces || (FetchSysFaces = {}));
/** True when the catalog metadata selects the existing super-face send path. */
function isSuperFaceEntry(emoji) {
	if (emoji.aniStickerType == null || emoji.aniStickerPackId == null) return false;
	return !(emoji.aniStickerType === 1 && emoji.aniStickerPackId === 1);
}
//#endregion
//#region ../onebot/src/actions/system-face.ts
function faceEntry(face) {
	return {
		q_sid: face.qSid,
		q_des: face.qDes,
		em_code: face.emCode,
		q_cid: face.qCid,
		ani_sticker_type: face.aniStickerType,
		ani_sticker_pack_id: face.aniStickerPackId,
		ani_sticker_id: face.aniStickerId,
		url: face.url,
		emoji_name_alias: face.emojiNameAlias,
		ani_sticker_width: face.aniStickerWidth,
		ani_sticker_height: face.aniStickerHeight,
		is_super: isSuperFaceEntry(face)
	};
}
var refreshField = () => f.bool().default(false).describe("是否强制从 QQ 刷新目录");
var faceIdField = () => f.faceId().describe("QQ 系统表情编号");
var nullableInteger = { type: ["integer", "null"] };
var faceSchema = {
	type: "object",
	properties: {
		q_sid: {
			type: "string",
			description: "QQ 表情目录标识（部分 emoji 为 Unicode 表情字符串）"
		},
		q_des: {
			type: "string",
			description: "表情描述"
		},
		em_code: { type: "string" },
		q_cid: nullableInteger,
		ani_sticker_type: nullableInteger,
		ani_sticker_pack_id: nullableInteger,
		ani_sticker_id: nullableInteger,
		url: { type: ["string", "null"] },
		emoji_name_alias: {
			type: "array",
			items: { type: "string" }
		},
		ani_sticker_width: nullableInteger,
		ani_sticker_height: nullableInteger,
		is_super: {
			type: "boolean",
			description: "是否使用超级表情格式"
		}
	},
	required: [
		"q_sid",
		"q_des",
		"em_code",
		"q_cid",
		"ani_sticker_type",
		"ani_sticker_pack_id",
		"ani_sticker_id",
		"url",
		"emoji_name_alias",
		"ani_sticker_width",
		"ani_sticker_height",
		"is_super"
	]
};
var actions = [
	defineAction({
		name: "fetch_sys_faces",
		summary: "获取 QQ 系统表情目录",
		readOnly: true,
		returns: "按分组返回完整的 QQ 系统表情映射。",
		returnsSchema: {
			type: "object",
			properties: { packs: {
				type: "array",
				items: {
					type: "object",
					properties: {
						pack_name: { type: "string" },
						emojis: {
							type: "array",
							items: faceSchema
						}
					},
					required: ["pack_name", "emojis"]
				}
			} },
			required: ["packs"]
		},
		params: { refresh: refreshField() },
		run: async (params, ctx) => {
			return okResponse({ packs: (await ctx.bridge.apis.systemFace.fetchCatalog(params.refresh)).map((pack) => ({
				pack_name: pack.packName,
				emojis: pack.emojis.map(faceEntry)
			})) });
		}
	}),
	defineAction({
		name: "fetch_face_entity",
		summary: "按编号查询 QQ 系统表情",
		readOnly: true,
		returns: "表情详情；编号不存在时返回 null。",
		returnsSchema: { anyOf: [faceSchema, { type: "null" }] },
		params: {
			face_id: faceIdField(),
			refresh: refreshField()
		},
		run: async (params, ctx) => {
			const face = await ctx.bridge.apis.systemFace.fetchFace(params.face_id, params.refresh);
			return okResponse(face ? faceEntry(face) : null);
		}
	}),
	defineAction({
		name: "search_sys_faces",
		summary: "搜索 QQ 系统表情",
		readOnly: true,
		returns: "匹配编号、名称、别名或分组名的表情列表。",
		returnsSchema: {
			type: "object",
			properties: { faces: {
				type: "array",
				items: faceSchema
			} },
			required: ["faces"]
		},
		params: { query: f.string({ allowEmpty: false }).describe("编号、名称、别名或分组名") },
		run: async (params, ctx) => okResponse({ faces: (await ctx.bridge.apis.systemFace.search(params.query)).map(faceEntry) })
	}),
	defineAction({
		name: "fetch_super_face_id",
		summary: "判断 QQ 系统表情是否使用超级表情格式",
		readOnly: true,
		returns: "是否使用超级表情格式。",
		returnsSchema: {
			type: "object",
			properties: { is_super: { type: "boolean" } },
			required: ["is_super"]
		},
		params: {
			face_id: faceIdField(),
			refresh: refreshField()
		},
		run: async (params, ctx) => okResponse({ is_super: await ctx.bridge.apis.systemFace.isSuper(params.face_id, params.refresh) })
	})
];
//#endregion
//#region ../onebot/src/actions/index.ts
function validateSpecProjection(spec, doc) {
	const canonical = spec.names[0];
	if (!canonical || canonical.trim() === "") throw new Error(`Action registry invalid ${spec.kind} action: canonical name must not be empty`);
	for (const name of spec.names) if (name.trim() === "") throw new Error(`Action registry invalid ${spec.kind} action canonical "${canonical}": executable name must not be empty`);
	const aliases = spec.names.slice(1);
	if (doc.name !== canonical || doc.aliases.length !== aliases.length || doc.aliases.some((name, i) => name !== aliases[i])) throw new Error(`Action registry invalid ${spec.kind} action canonical "${canonical}": describe() names do not match executable names`);
	const documentedKind = doc.stream === true ? "stream" : "normal";
	if (documentedKind !== spec.kind) throw new Error(`Action registry invalid ${spec.kind} action canonical "${canonical}": describe() reports kind ${documentedKind}`);
}
function conflictMessage(name, first, second) {
	return [
		`Action registry conflict for executable name "${name}"`,
		`canonical "${first.canonical}" (name "${first.name}", kind ${first.kind}, role ${first.role})`,
		`canonical "${second.canonical}" (name "${second.name}", kind ${second.kind}, role ${second.role})`
	].join(": ");
}
/** Compile and validate a complete executable namespace. Exported so the
*  conflict matrix can be tested without constructing an ApiHandler. */
function compileActionRegistry(groups, rawReservations = []) {
	const actions = [];
	const executableNames = [];
	const rawActions = [];
	const byName = /* @__PURE__ */ new Map();
	const claim = (next) => {
		const previous = byName.get(next.name);
		if (previous) throw new Error(conflictMessage(next.name, previous, next));
		byName.set(next.name, next);
		executableNames.push(next);
	};
	for (const group of groups) for (const spec of group.actions) {
		const described = spec.describe();
		validateSpecProjection(spec, described);
		const canonical = spec.names[0];
		const action = Object.freeze({
			canonical,
			names: Object.freeze([...spec.names]),
			kind: spec.kind,
			category: group.category,
			doc: Object.freeze({
				...described,
				category: group.category
			}),
			spec
		});
		actions.push(action);
		action.names.forEach((name, index) => claim(Object.freeze({
			name,
			canonical,
			kind: action.kind,
			role: index === 0 ? "canonical" : "alias",
			action
		})));
	}
	for (const reservation of rawReservations) {
		if (reservation.name.trim() === "" || reservation.canonical.trim() === "") throw new Error("Action registry invalid raw action: canonical and executable name must not be empty");
		const raw = Object.freeze({
			name: reservation.name,
			canonical: reservation.canonical,
			kind: "raw",
			role: "raw"
		});
		claim(raw);
		rawActions.push(raw);
	}
	const categories = groups.map(({ category, actions: groupActions }) => Object.freeze({
		category,
		count: groupActions.length
	}));
	return Object.freeze({
		actions: Object.freeze(actions),
		executableNames: Object.freeze(executableNames),
		categories: Object.freeze(categories),
		rawActions: Object.freeze(rawActions),
		resolve: (name) => byName.get(name),
		bind: (ctx, api, rawFactories) => bindActionRegistry(executableNames, ctx, api, rawFactories)
	});
}
function bindActionRegistry(executableNames, ctx, api, rawFactories) {
	const factoryNames = new Set(Object.keys(rawFactories));
	const handlers = /* @__PURE__ */ new Map();
	for (const claim of executableNames) {
		if (claim.kind === "raw") {
			const factory = rawFactories[claim.canonical];
			if (!factory) throw new Error(`Action registry raw factory missing: canonical "${claim.canonical}" (name "${claim.name}", kind raw)`);
			factoryNames.delete(claim.canonical);
			handlers.set(claim.name, Object.freeze({
				handler: factory(api),
				canonical: claim.canonical,
				kind: "raw"
			}));
			continue;
		}
		const handler = claim.action.spec.toHandler(ctx);
		handlers.set(claim.name, Object.freeze({
			handler,
			canonical: claim.canonical,
			kind: claim.kind
		}));
	}
	if (factoryNames.size > 0) {
		const extra = [...factoryNames][0];
		throw new Error(`Action registry unexpected raw factory: canonical "${extra}" (name "${extra}", kind raw)`);
	}
	return handlers;
}
/** Every declarative action, grouped by domain category. Authored input. */
var ACTION_GROUPS = [
	{
		category: "信息",
		actions: actions$12
	},
	{
		category: "消息",
		actions: actions$11
	},
	{
		category: "好友",
		actions: actions$10
	},
	{
		category: "群信息",
		actions: actions$9
	},
	{
		category: "群管理",
		actions: actions$8
	},
	{
		category: "群文件",
		actions: actions$7
	},
	{
		category: "请求",
		actions: actions$6
	},
	{
		category: "扩展",
		actions: actions$5
	},
	{
		category: "群相册",
		actions: actions$4
	},
	{
		category: "空间",
		actions: actions$3
	},
	{
		category: "系统表情",
		actions
	},
	{
		category: "流式接口",
		actions: [...actions$2, ...actions$1]
	}
];
/** Hidden OneBot v11 quick-operation handler; `_async` is the NoneBot 1 alias. */
var HANDLE_QUICK_OPERATION_ACTION = ".handle_quick_operation";
/** Complete, validated runtime/docs registry. Compilation happens on import. */
var ACTION_REGISTRY = compileActionRegistry(ACTION_GROUPS, [{
	name: HANDLE_QUICK_OPERATION_ACTION,
	canonical: HANDLE_QUICK_OPERATION_ACTION
}, {
	name: ".handle_quick_operation_async",
	canonical: HANDLE_QUICK_OPERATION_ACTION
}]);
//#endregion
//#region ../common/src/single-flight-cache.ts
var SingleFlightCache = class {
	ttlMs;
	load;
	shouldCache;
	now;
	fresh = /* @__PURE__ */ new Map();
	inflight = /* @__PURE__ */ new Map();
	constructor(opts) {
		this.ttlMs = opts.ttlMs;
		this.load = opts.load;
		this.shouldCache = opts.shouldCache ?? (() => true);
		this.now = opts.now ?? Date.now;
	}
	/**
	* Get the value for `key`.
	*
	* - Returns a fresh cached value when the last load was within `ttlMs`.
	* - Otherwise de-dupes concurrent callers onto a single `load()` and caches
	*   the result (subject to `shouldCache`). A rejected `load` propagates to
	*   every joined caller, clears the in-flight slot, and is not cached.
	* - `force` bypasses the freshness check but still joins an in-flight load
	*   rather than starting a second one.
	*/
	get(key, opts = {}) {
		if (!opts.force) {
			const hit = this.fresh.get(key);
			if (hit && this.now() - hit.at < this.ttlMs) return Promise.resolve(hit.value);
		}
		const existing = this.inflight.get(key);
		if (existing) return existing;
		const task = (async () => {
			try {
				const value = await this.load(key);
				if (this.shouldCache(value)) this.fresh.set(key, {
					at: this.now(),
					value
				});
				return value;
			} finally {
				this.inflight.delete(key);
			}
		})();
		this.inflight.set(key, task);
		return task;
	}
	/** Drop a cached entry. Does not abort an in-flight load. */
	invalidate(key) {
		this.fresh.delete(key);
	}
	/** Drop all cached entries. Does not abort in-flight loads. */
	clear() {
		this.fresh.clear();
	}
};
function createSingleFlightCache(opts) {
	return new SingleFlightCache(opts);
}
//#endregion
//#region ../common/src/coerce.ts
/** True only for a plain, non-null, non-array object. */
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** The value when it is a real boolean, else the fallback. Strings/numbers
*  are NOT coerced — `'true'` and `1` both yield the fallback. */
function boolOr(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}
/** A finite number (numeric strings coerced) clamped to `[min, max]`, else
*  the fallback. Fractional precision is preserved — use `clampInt` to floor. */
function clampNum(value, min, max, fallback) {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}
/** `clampNum` truncated toward zero — clamp first, then drop the fraction. */
function clampInt(value, min, max, fallback) {
	return Math.trunc(clampNum(value, min, max, fallback));
}
//#endregion
//#region src/notifications/smtp.ts
var CRLF = "\r\n";
var DEFAULT_TIMEOUT_MS = 15e3;
var SmtpError = class extends Error {
	responseCode;
	code;
	constructor(message, opts) {
		super(message);
		this.name = "SmtpError";
		this.responseCode = opts?.responseCode;
		this.code = opts?.code;
	}
};
function looksLikeEmail(value) {
	return /^[^\s<>@]+@[^\s<>@]+$/.test(value);
}
/** Address from `Name <user@host>` or a bare addr; null if neither is usable. */
function extractAddress(value) {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const angled = /<([^<>]+)>/.exec(trimmed);
	const addr = (angled ? angled[1] : trimmed).trim();
	return looksLikeEmail(addr) ? addr : null;
}
/** Split a comma / semicolon / newline list and keep unique addresses. */
function parseRecipients(value) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const part of value.split(/[,;\n]+/)) {
		const addr = extractAddress(part);
		if (!addr) continue;
		const key = addr.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(addr);
	}
	return out;
}
function encodeHeader(value) {
	if (/^[\x20-\x7E]*$/.test(value) && !/[\r\n]/.test(value)) return value;
	return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
function rfc5322Date(d) {
	return d.toUTCString().replace(/GMT$/, "+0000");
}
function wrap76(b64) {
	return b64.replace(/.{1,76}/g, (line) => `${line}\r\n`).trimEnd();
}
function isHtmlBody(body) {
	return /^\s*</.test(body);
}
function dotStuff(payload) {
	return payload.replace(/^\./gm, "..");
}
/** Build a single-part MIME message (plain or HTML). Exported for tests. */
function buildMimeMessage(mail, now = /* @__PURE__ */ new Date()) {
	const fromAddr = extractAddress(mail.from);
	const toHeader = mail.to.join(", ");
	const html = isHtmlBody(mail.body);
	const id = `<${now.getTime()}.${Math.random().toString(36).slice(2, 10)}@snowluma>`;
	const headers = [
		`From: ${mail.from.trim() || (fromAddr ? `<${fromAddr}>` : "")}`,
		`To: ${toHeader}`,
		`Subject: ${encodeHeader(mail.subject)}`,
		`Date: ${rfc5322Date(now)}`,
		`Message-ID: ${id}`,
		"MIME-Version: 1.0",
		`Content-Type: ${html ? "text/html" : "text/plain"}; charset=UTF-8`,
		"Content-Transfer-Encoding: base64"
	];
	const body = wrap76(Buffer.from(mail.body, "utf8").toString("base64"));
	return `${headers.join(CRLF)}${CRLF}${CRLF}${body}${CRLF}`;
}
function consumeReply(buf) {
	let offset = 0;
	const lines = [];
	let code = 0;
	while (offset < buf.length) {
		const nl = buf.indexOf("\n", offset);
		if (nl === -1) return null;
		const line = buf.slice(offset, nl).replace(/\r$/, "");
		offset = nl + 1;
		const m = /^(\d{3})([ -])(.*)$/.exec(line);
		if (!m) continue;
		code = Number(m[1]);
		lines.push(m[3]);
		if (m[2] === " ") return {
			reply: {
				code,
				lines,
				text: lines.join("\n")
			},
			rest: buf.slice(offset)
		};
	}
	return null;
}
function parseCapabilities(reply) {
	const auth = /* @__PURE__ */ new Set();
	let starttls = false;
	for (const line of reply.lines) {
		const u = line.toUpperCase();
		if (u === "STARTTLS" || u.startsWith("STARTTLS ")) starttls = true;
		if (u.startsWith("AUTH ")) {
			for (const mech of u.slice(5).split(/\s+/)) if (mech) auth.add(mech);
		}
	}
	return {
		starttls,
		auth
	};
}
function connectSocket(host, port, secure, timeoutMs, rejectUnauthorized) {
	return new Promise((resolve, reject) => {
		const sock = secure ? tls.connect({
			host,
			port,
			servername: net$1.isIP(host) === 0 ? host : void 0,
			rejectUnauthorized
		}) : net$1.connect({
			host,
			port
		});
		const fail = (err) => {
			sock.destroy();
			reject(err);
		};
		sock.setTimeout(timeoutMs);
		sock.once("timeout", () => fail(new SmtpError("SMTP connection timed out", { code: "ETIMEDOUT" })));
		sock.once("error", fail);
		sock.once(secure ? "secureConnect" : "connect", () => {
			sock.removeAllListeners("timeout");
			sock.removeAllListeners("error");
			resolve(sock);
		});
	});
}
function upgradeTls(socket, host, timeoutMs, rejectUnauthorized) {
	return new Promise((resolve, reject) => {
		const tlsSocket = tls.connect({
			socket,
			servername: net$1.isIP(host) === 0 ? host : void 0,
			rejectUnauthorized
		}, () => resolve(tlsSocket));
		tlsSocket.setTimeout(timeoutMs);
		tlsSocket.once("timeout", () => {
			tlsSocket.destroy();
			reject(new SmtpError("SMTP STARTTLS timed out", { code: "ETIMEDOUT" }));
		});
		tlsSocket.once("error", reject);
	});
}
var SmtpSession = class {
	socket;
	buf = "";
	constructor(socket) {
		this.socket = socket;
	}
	destroy() {
		this.socket.destroy();
	}
	attachTimeout(timeoutMs, onTimeout) {
		this.socket.setTimeout(timeoutMs);
		this.socket.once("timeout", onTimeout);
	}
	async read() {
		const ready = consumeReply(this.buf);
		if (ready) {
			this.buf = ready.rest;
			return ready.reply;
		}
		return new Promise((resolve, reject) => {
			const onData = (chunk) => {
				this.buf += chunk.toString("utf8");
				const got = consumeReply(this.buf);
				if (!got) return;
				this.buf = got.rest;
				cleanup();
				resolve(got.reply);
			};
			const onError = (err) => {
				cleanup();
				reject(err);
			};
			const onClose = () => {
				cleanup();
				reject(new SmtpError("SMTP connection closed"));
			};
			const cleanup = () => {
				this.socket.removeListener("data", onData);
				this.socket.removeListener("error", onError);
				this.socket.removeListener("close", onClose);
			};
			this.socket.on("data", onData);
			this.socket.once("error", onError);
			this.socket.once("close", onClose);
		});
	}
	write(data) {
		this.socket.write(data);
	}
	async command(line, ok, label) {
		this.write(line + CRLF);
		const reply = await this.read();
		if (!ok(reply.code)) throw new SmtpError(`${label ?? line.split(" ")[0] ?? "SMTP"} failed: ${reply.code} ${reply.text}`.trim(), { responseCode: reply.code });
		return reply;
	}
	replaceSocket(next) {
		this.socket = next;
		this.buf = "";
	}
};
function formatSmtpError(err, host, port) {
	if (err instanceof SmtpError) {
		if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") return `无法连接 SMTP：${host}:${port}`;
		if (err.responseCode === 535) return "SMTP 认证失败";
		return err.message;
	}
	if (err instanceof Error) {
		const code = err.code;
		if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") return `无法连接 SMTP：${host}:${port}`;
		if (/self-signed|unable to verify/i.test(err.message)) return `SMTP 证书不受信任：${host}`;
		return err.message || "邮件发送失败";
	}
	return "邮件发送失败";
}
async function sendSmtpMail(mail, opts = {}) {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const rejectUnauthorized = opts.rejectUnauthorized ?? true;
	const fromAddr = extractAddress(mail.from);
	if (!fromAddr) throw new SmtpError("invalid from address");
	if (mail.to.length === 0) throw new SmtpError("no recipients");
	let sock = await connectSocket(mail.host, mail.port, mail.secure, timeoutMs, rejectUnauthorized);
	const session = new SmtpSession(sock);
	let finished = false;
	const failTimeout = () => {
		if (finished) return;
		session.destroy();
	};
	session.attachTimeout(timeoutMs, failTimeout);
	try {
		const greeting = await session.read();
		if (greeting.code !== 220) throw new SmtpError(`SMTP greeting failed: ${greeting.code} ${greeting.text}`.trim(), { responseCode: greeting.code });
		const ehlo = async () => session.command("EHLO [127.0.0.1]", (c) => c === 250);
		let caps = parseCapabilities(await ehlo());
		if (!mail.secure && caps.starttls) {
			await session.command("STARTTLS", (c) => c === 220);
			const upgraded = await upgradeTls(sock, mail.host, timeoutMs, rejectUnauthorized);
			session.replaceSocket(upgraded);
			session.attachTimeout(timeoutMs, failTimeout);
			sock = upgraded;
			caps = parseCapabilities(await ehlo());
		}
		const user = mail.user?.trim() ?? "";
		if (user) await authenticate(session, caps.auth, user, mail.pass ?? "");
		await session.command(`MAIL FROM:<${fromAddr}>`, (c) => c === 250);
		for (const rcpt of mail.to) await session.command(`RCPT TO:<${rcpt}>`, (c) => c === 250 || c === 251);
		await session.command("DATA", (c) => c === 354);
		session.write(dotStuff(buildMimeMessage(mail)));
		await session.command(".", (c) => c === 250, "DATA");
		try {
			await session.command("QUIT", (c) => c === 221);
		} catch {}
		finished = true;
	} catch (err) {
		finished = true;
		throw err;
	} finally {
		session.destroy();
	}
}
async function authenticate(session, mechs, user, pass) {
	const hasPlain = mechs.has("PLAIN");
	const hasLogin = mechs.has("LOGIN");
	if (hasPlain || !hasLogin) try {
		const token = Buffer.from(`\0${user}\0${pass}`, "utf8").toString("base64");
		await session.command(`AUTH PLAIN ${token}`, (c) => c === 235, "AUTH");
		return;
	} catch (err) {
		if (hasPlain && !hasLogin) throw err;
		if (err instanceof SmtpError && err.responseCode === 535) throw err;
	}
	await loginAuth(session, user, pass);
}
async function loginAuth(session, user, pass) {
	await session.command("AUTH LOGIN", (c) => c === 334, "AUTH");
	await session.command(Buffer.from(user, "utf8").toString("base64"), (c) => c === 334, "AUTH");
	await session.command(Buffer.from(pass, "utf8").toString("base64"), (c) => c === 235, "AUTH");
}
//#endregion
//#region src/notifications/config.ts
var log = createLogger("Notifications.Config");
var CONFIG_DIR = "config";
var NOTIFICATIONS_CONFIG_PATH = path$1.join(CONFIG_DIR, "notifications.json");
var DEBOUNCE_SECONDS_MAX = 3600;
/** A channel id is a slug: it is referenced by per-UIN `channelIds`, so it must
*  be safe to use as a stable key. Kept in sync with `normalizeChannelIds` in
*  packages/onebot/src/config.ts (cross-package; can't share without a circular
*  dep — core depends on onebot, not the reverse). */
var CHANNEL_ID_RE = /^[\w.-]+$/;
var CHANNEL_ID_MAX = 64;
var CHANNEL_NAME_MAX = 128;
var BODY_TEMPLATE_MAX = 8192;
var HEADER_NAME_MAX = 128;
var HEADER_VALUE_MAX = 1024;
var HEADERS_MAX = 16;
var HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
function isEmailChannel(ch) {
	return ch.type === "email";
}
/** Default body template — Server酱-style JSON ({title}/{desp}). The WebUI
*  ships additional per-vendor presets (钉钉/Discord/…) as frontend constants
*  the operator can drop in. */
var DEFAULT_BODY_TEMPLATE = `{
  "title": "账号状态通知：{event}",
  "desp": "您的账号状态发生了改变。\\n\\n**昵称**：{nickname}\\n**QQ号**：{uin}\\n**当前状态**：{event}\\n**时间**：{time}"
}`;
var DEFAULT_EMAIL_BODY_TEMPLATE = `账号状态发生了改变。

昵称：{nickname}
QQ号：{uin}
当前状态：{event}
时间：{time}`;
var SMTP_HOST_MAX = 253;
var SMTP_USER_MAX = 256;
var SMTP_PASS_MAX = 256;
var EMAIL_FIELD_MAX = 1024;
var SUBJECT_TEMPLATE_MAX = 256;
var SMTP_PORT_MIN = 1;
var SMTP_PORT_MAX = 65535;
function defaultNotificationsConfig() {
	return {
		version: 1,
		debounceSeconds: 30,
		channels: []
	};
}
/**
* Mechanical `{key}` substitution — no logic, no conditionals, no escaping.
* A key present in `vars` is replaced by its value; an unknown `{key}` is left
* untouched (原样) so a typo'd placeholder is visible rather than silently
* blanked. Pure + total (a non-string template yields '').
*
* **JSON safety**: When the template is valid JSON (parseable by JSON.parse),
* values are escaped to prevent breaking the JSON structure — backslashes
* become `\\` and double-quotes become `\"`.
*/
function renderTemplate(template, vars) {
	if (typeof template !== "string") return "";
	let isJson = false;
	try {
		JSON.parse(template);
		isJson = true;
	} catch {}
	return template.replace(/\{(\w+)\}/g, (match, key) => {
		if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
		const val = vars[key];
		return isJson ? val.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") : val;
	});
}
function strOr(value, fallback, maxLen) {
	return typeof value === "string" ? value.slice(0, maxLen) : fallback;
}
function normalizeChannelId(value) {
	if (typeof value !== "string") return null;
	const v = value.trim();
	if (v.length === 0 || v.length > CHANNEL_ID_MAX) return null;
	if (!CHANNEL_ID_RE.test(v)) return null;
	return v;
}
function isHttpUrl(value) {
	try {
		const u = new URL(value);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}
function normalizeHeaders(value) {
	if (!isObject(value)) return void 0;
	const out = {};
	const seen = /* @__PURE__ */ new Set();
	for (const [rawName, rawValue] of Object.entries(value)) {
		if (Object.keys(out).length >= HEADERS_MAX) break;
		if (typeof rawValue !== "string") continue;
		const name = rawName.trim();
		if (name.length === 0 || name.length > HEADER_NAME_MAX) continue;
		if (!HEADER_NAME_RE.test(name)) continue;
		const folded = name.toLowerCase();
		if (seen.has(folded)) continue;
		const headerValue = rawValue.trim();
		if (headerValue.length === 0 || headerValue.length > HEADER_VALUE_MAX) continue;
		if (headerValue.includes("\r") || headerValue.includes("\n")) continue;
		seen.add(folded);
		out[name] = headerValue;
	}
	return Object.keys(out).length > 0 ? out : void 0;
}
function normalizeSmtpHost(value) {
	if (typeof value !== "string") return null;
	const v = value.trim();
	if (!v || v.length > SMTP_HOST_MAX) return null;
	if (/\s/.test(v) || v.includes("/") || v.includes("://")) return null;
	return v;
}
function normalizeFrom(value) {
	if (typeof value !== "string") return null;
	const v = value.trim().slice(0, EMAIL_FIELD_MAX);
	return extractAddress(v) ? v : null;
}
function normalizeTo(value) {
	if (typeof value !== "string") return null;
	const addrs = parseRecipients(value.trim().slice(0, EMAIL_FIELD_MAX));
	return addrs.length > 0 ? addrs.join(", ") : null;
}
function normalizeChannelType(value) {
	if (value === "email") return "email";
	if (value === "webhook" || value === void 0 || value === "") return "webhook";
	return null;
}
function normalizeEmailChannel(raw, id, name) {
	const smtpHost = normalizeSmtpHost(raw.smtpHost);
	const from = normalizeFrom(raw.from);
	const to = normalizeTo(raw.to);
	if (!smtpHost || !from || !to) return null;
	const portRaw = raw.smtpPort;
	const portProvided = portRaw !== void 0 && portRaw !== null && portRaw !== "";
	const secureProvided = typeof raw.smtpSecure === "boolean";
	const port = portProvided ? clampInt(portRaw, SMTP_PORT_MIN, SMTP_PORT_MAX, 0) : 0;
	if (portProvided && port === 0) return null;
	const smtpSecure = secureProvided ? Boolean(raw.smtpSecure) : port === 465 || port === 0;
	const smtpPort = port === 0 ? smtpSecure ? 465 : 587 : port;
	const smtpUser = typeof raw.smtpUser === "string" ? raw.smtpUser.trim().slice(0, SMTP_USER_MAX) : "";
	const smtpPass = typeof raw.smtpPass === "string" ? raw.smtpPass.slice(0, SMTP_PASS_MAX) : "";
	return {
		id,
		name,
		type: "email",
		url: "",
		bodyTemplate: strOr(raw.bodyTemplate, DEFAULT_EMAIL_BODY_TEMPLATE, BODY_TEMPLATE_MAX),
		enabled: boolOr(raw.enabled, true),
		smtpHost,
		smtpPort,
		smtpSecure,
		...smtpUser ? { smtpUser } : {},
		...smtpPass ? { smtpPass } : {},
		from,
		to,
		subjectTemplate: strOr(raw.subjectTemplate, "账号{event}：{nickname} ({uin})", SUBJECT_TEMPLATE_MAX) || "账号{event}：{nickname} ({uin})"
	};
}
/** A channel is usable only with a valid id AND a deliverable target —
*  http(s) URL for webhooks, SMTP host + from/to for email. Anything else
*  is dropped (total normalize). */
function normalizeChannel(raw) {
	if (!isObject(raw)) return null;
	const id = normalizeChannelId(raw.id);
	if (!id) return null;
	const type = normalizeChannelType(raw.type);
	if (!type) return null;
	const name = strOr(raw.name, id, CHANNEL_NAME_MAX).trim() || id;
	if (type === "email") return normalizeEmailChannel(raw, id, name);
	const url = typeof raw.url === "string" ? raw.url.trim() : "";
	if (!isHttpUrl(url)) return null;
	const headers = normalizeHeaders(raw.headers);
	return {
		id,
		name,
		type: "webhook",
		url,
		bodyTemplate: strOr(raw.bodyTemplate, DEFAULT_BODY_TEMPLATE, BODY_TEMPLATE_MAX),
		enabled: boolOr(raw.enabled, true),
		...headers ? { headers } : {}
	};
}
function normalizeChannels(value) {
	if (!Array.isArray(value)) return [];
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const raw of value) {
		const ch = normalizeChannel(raw);
		if (!ch) continue;
		if (seen.has(ch.id)) continue;
		seen.add(ch.id);
		out.push(ch);
	}
	return out;
}
function normalizeNotificationsConfig(value) {
	const v = isObject(value) ? value : {};
	return {
		version: 1,
		debounceSeconds: clampInt(v.debounceSeconds, 0, DEBOUNCE_SECONDS_MAX, 30),
		channels: normalizeChannels(v.channels)
	};
}
function ensureConfigDir() {
	fs$1.mkdirSync(CONFIG_DIR, { recursive: true });
}
function enforceSensitiveFileMode(file) {
	if (process.platform !== "win32") fs$1.chmodSync(file, 384);
}
function atomicWrite(config) {
	ensureConfigDir();
	const tmp = NOTIFICATIONS_CONFIG_PATH + ".tmp";
	fs$1.writeFileSync(tmp, JSON.stringify(config, null, 2), {
		encoding: "utf8",
		mode: 384
	});
	enforceSensitiveFileMode(tmp);
	fs$1.renameSync(tmp, NOTIFICATIONS_CONFIG_PATH);
	enforceSensitiveFileMode(NOTIFICATIONS_CONFIG_PATH);
}
var cached = null;
/** Load + normalize the channel store, creating it from defaults if absent. */
function loadNotificationsConfig() {
	if (cached) return cached;
	ensureConfigDir();
	if (!fs$1.existsSync(NOTIFICATIONS_CONFIG_PATH)) {
		const fresh = defaultNotificationsConfig();
		try {
			atomicWrite(fresh);
		} catch (err) {
			log.warn("failed to write initial notifications.json: %s", err instanceof Error ? err.message : String(err));
		}
		cached = fresh;
		return fresh;
	}
	enforceSensitiveFileMode(NOTIFICATIONS_CONFIG_PATH);
	try {
		const raw = fs$1.readFileSync(NOTIFICATIONS_CONFIG_PATH, "utf8");
		const parsed = JSON.parse(raw);
		const normalized = normalizeNotificationsConfig(parsed);
		if (JSON.stringify(parsed) !== JSON.stringify(normalized)) try {
			atomicWrite(normalized);
		} catch (err) {
			log.warn("failed to normalize notifications.json on disk: %s", err instanceof Error ? err.message : String(err));
		}
		cached = normalized;
		return normalized;
	} catch (err) {
		log.warn("notifications.json unreadable; using defaults: %s", err instanceof Error ? err.message : String(err));
		const fresh = defaultNotificationsConfig();
		cached = fresh;
		return fresh;
	}
}
/**
* Persist a (possibly partial) client-supplied config. A missing `channels` or
* `debounceSeconds` keeps the current on-disk value — section-level merge, same
* as `saveUiConfig`. Returns the stored, normalized config.
*/
function saveNotificationsConfig(incoming) {
	const current = loadNotificationsConfig();
	const v = isObject(incoming) ? incoming : {};
	const next = {
		version: 1,
		debounceSeconds: v.debounceSeconds !== void 0 ? clampInt(v.debounceSeconds, 0, DEBOUNCE_SECONDS_MAX, 30) : current.debounceSeconds,
		channels: Array.isArray(v.channels) ? normalizeChannels(v.channels) : current.channels
	};
	atomicWrite(next);
	cached = next;
	return next;
}
//#endregion
export { isRealUin as $, getFriendDressWebAPI as A, failedResponse as B, GROUP_MESSAGE_EVENT as C, hashMessageIdInt32 as D, PRIVATE_SENT_MESSAGE_EVENT as E, getBknFromCookie as F, normalizeGlobalSettings as G, okResponse as H, StreamTransportClosedError as I, assertValidOneBotConfig as J, saveGlobalSettings as K, wrapStreamFrame as L, getHonorListWebAPI as M, RequestUtil as N, privateMessageEventName as O, cookieToString as P, saveOneBotConfig as Q, wrapStreamTerminal as R, snapshotStreamStorage as S, PRIVATE_NT_MESSAGE_EVENT as T, loadGlobalSettings as U, hasAuthoritativeSequence as V, migrateGlobalSettings as W, loadOneBotConfig as X, cleanupInvalidPerUinConfigs as Y, prepareOneBotConfigForRestore as Z, isSuperFaceEntry as _, saveNotificationsConfig as a, protobuf_getUnknownFieldMetadata as b, sendSmtpMail as c, clampNum as d, isObject as f, FetchSysFaces as g, HANDLE_QUICK_OPERATION_ACTION as h, renderTemplate as i, WebHonorType as j, formatGroupRequestFlag as k, boolOr as l, ACTION_REGISTRY as m, loadNotificationsConfig as n, formatSmtpError as o, createSingleFlightCache as p, OneBotConfigValidationError as q, normalizeNotificationsConfig as r, parseRecipients as s, isEmailChannel as t, clampInt as u, OidbError as v, PRIVATE_MESSAGE_EVENT as w, clearInactiveStreamStorage as x, invokeOidb as y, RETCODE as z };
