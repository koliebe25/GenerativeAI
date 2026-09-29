// Class mode for shared classroom deployments.
//
// When both env vars are set, the instructor's Muapi key never reaches the
// browser: middleware.js stamps it onto every proxied /api/* request, and a
// class passcode guards every page and API route so a leaked URL cannot spend
// the instructor's credits.
//
//   MUAPI_API_KEY      instructor's Muapi access key (server-side only)
//   CLASS_PASSCODE     code students type once per browser to enter
//   CLASS_HIDDEN_TABS  optional comma-separated studio ids to remove from the
//                      menu, e.g. "body-swap,ai-influencer" (navigation only,
//                      not an access control)
//
// CLASS_PASSCODE alone turns on just the gate (students then bring their own
// key). MUAPI_API_KEY alone is ignored on purpose: injecting a paid key into a
// public, unguarded site would let anyone spend it.
//
// Uses only Web Crypto so the same code runs in the Edge middleware and in
// Node route handlers / server components.

import { MANAGED_KEY_PLACEHOLDER } from './classConstants';

export { MANAGED_KEY_PLACEHOLDER };

export const CLASS_COOKIE = 'ogai_class';
export const CLASS_SESSION_SECONDS = 60 * 60 * 12; // one class day

export function getClassConfig() {
    const apiKey = (process.env.MUAPI_API_KEY || '').trim();
    const passcode = (process.env.CLASS_PASSCODE || '').trim();
    const hiddenTabs = (process.env.CLASS_HIDDEN_TABS || '')
        .split(',')
        .map((tabId) => tabId.trim())
        .filter(Boolean);
    return {
        apiKey,
        passcode,
        hiddenTabs,
        gateEnabled: Boolean(passcode),
        managedKey: Boolean(apiKey && passcode),
    };
}

// Props the studio pages pass to StandaloneShell (never includes secrets).
export function getShellClassProps() {
    const { managedKey, hiddenTabs } = getClassConfig();
    return { managedKey, hiddenTabs };
}

async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

// Session token = hash of the passcode and key, so changing either one logs
// every student out (e.g. change CLASS_PASSCODE after class).
export async function classSessionToken(config = getClassConfig()) {
    return sha256Hex(`ogai-class-v1:${config.passcode}:${config.apiKey}`);
}

export async function isPasscodeCorrect(input, config = getClassConfig()) {
    if (!config.gateEnabled || typeof input !== 'string') return false;
    const [given, expected] = await Promise.all([
        sha256Hex(`ogai-passcode:${input.trim()}`),
        sha256Hex(`ogai-passcode:${config.passcode}`),
    ]);
    return timingSafeEqual(given, expected);
}

// True when the gate is off, or the cookie holds a valid session token.
export async function hasClassAccess(cookieValue, config = getClassConfig()) {
    if (!config.gateEnabled) return true;
    if (!cookieValue) return false;
    return timingSafeEqual(cookieValue, await classSessionToken(config));
}

// Server components that call Muapi directly (the /agents pages) use this
// instead of trusting the browser's muapi_key cookie.
export async function resolveServerApiKey(cookieStore) {
    const config = getClassConfig();
    if (config.managedKey && await hasClassAccess(cookieStore.get(CLASS_COOKIE)?.value, config)) {
        return config.apiKey;
    }
    const fromCookie = cookieStore.get('muapi_key')?.value;
    return fromCookie && fromCookie !== MANAGED_KEY_PLACEHOLDER ? fromCookie : null;
}

// Only allow same-site relative paths as post-login redirects.
export function safeNextPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
        return '/';
    }
    if (value === '/class-login' || value.startsWith('/class-login?')) return '/';
    return value;
}
