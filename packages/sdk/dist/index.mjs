var ae = Object.defineProperty;
var se = (a, e, t) => e in a ? ae(a, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : a[e] = t;
var h = (a, e, t) => se(a, typeof e != "symbol" ? e + "" : e, t);
import { Wallet as U, parseUnits as ie, Contract as S, keccak256 as m, getBytes as P, formatUnits as oe, AbiCoder as W, Interface as K, toBeHex as v, JsonRpcProvider as q } from "ethers";
import { set as N, get as k, del as ce, clear as de } from "idb-keyval";
function E(a) {
  const e = new Uint8Array(a);
  let t = "";
  for (const r of e)
    t += String.fromCharCode(r);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function M(a) {
  const e = a.replace(/-/g, "+").replace(/_/g, "/"), t = (4 - e.length % 4) % 4, n = e.padEnd(e.length + t, "="), r = atob(n), s = new ArrayBuffer(r.length), i = new Uint8Array(s);
  for (let c = 0; c < r.length; c++)
    i[c] = r.charCodeAt(c);
  return s;
}
function H() {
  return le.stubThis((globalThis == null ? void 0 : globalThis.PublicKeyCredential) !== void 0 && typeof globalThis.PublicKeyCredential == "function");
}
const le = {
  stubThis: (a) => a
};
function Q(a) {
  const { id: e } = a;
  return {
    ...a,
    id: M(e),
    /**
     * `descriptor.transports` is an array of our `AuthenticatorTransportFuture` that includes newer
     * transports that TypeScript's DOM lib is ignorant of. Convince TS that our list of transports
     * are fine to pass to WebAuthn since browsers will recognize the new value.
     */
    transports: a.transports
  };
}
function Z(a) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    a === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(a)
  );
}
class A extends Error {
  constructor({ message: e, code: t, cause: n, name: r }) {
    super(e, { cause: n }), Object.defineProperty(this, "code", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.name = r ?? n.name, this.code = t;
  }
}
function ue({ error: a, options: e }) {
  var n, r, s;
  const { publicKey: t } = e;
  if (!t)
    throw Error("options was missing required publicKey property");
  if (a.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new A({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: a
      });
  } else if (a.name === "ConstraintError") {
    if (((n = t.authenticatorSelection) == null ? void 0 : n.requireResidentKey) === !0)
      return new A({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: a
      });
    if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      e.mediation === "conditional" && ((r = t.authenticatorSelection) == null ? void 0 : r.userVerification) === "required"
    )
      return new A({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: a
      });
    if (((s = t.authenticatorSelection) == null ? void 0 : s.userVerification) === "required")
      return new A({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: a
      });
  } else {
    if (a.name === "InvalidStateError")
      return new A({
        message: "The authenticator was previously registered",
        code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
        cause: a
      });
    if (a.name === "NotAllowedError")
      return new A({
        message: a.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: a
      });
    if (a.name === "NotSupportedError")
      return t.pubKeyCredParams.filter((c) => c.type === "public-key").length === 0 ? new A({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: a
      }) : new A({
        message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
        code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
        cause: a
      });
    if (a.name === "SecurityError") {
      const i = globalThis.location.hostname;
      if (Z(i)) {
        if (t.rp.id !== i)
          return new A({
            message: `The RP ID "${t.rp.id}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: a
          });
      } else return new A({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: a
      });
    } else if (a.name === "TypeError") {
      if (t.user.id.byteLength < 1 || t.user.id.byteLength > 64)
        return new A({
          message: "User ID was not between 1 and 64 characters",
          code: "ERROR_INVALID_USER_ID_LENGTH",
          cause: a
        });
    } else if (a.name === "UnknownError")
      return new A({
        message: "The authenticator was unable to process the specified options, or could not create a new credential",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: a
      });
  }
  return a;
}
class he {
  constructor() {
    Object.defineProperty(this, "controller", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    });
  }
  createNewAbortSignal() {
    if (this.controller) {
      const t = new Error("Cancelling existing WebAuthn API call for new one");
      t.name = "AbortError", this.controller.abort(t);
    }
    const e = new AbortController();
    return this.controller = e, e.signal;
  }
  cancelCeremony() {
    if (this.controller) {
      const e = new Error("Manually cancelling existing WebAuthn API call");
      e.name = "AbortError", this.controller.abort(e), this.controller = void 0;
    }
  }
}
const ee = new he(), pe = ["cross-platform", "platform"];
function te(a) {
  if (a && !(pe.indexOf(a) < 0))
    return a;
}
async function ne(a) {
  var w;
  !a.optionsJSON && a.challenge && (console.warn("startRegistration() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."), a = { optionsJSON: a });
  const { optionsJSON: e, useAutoRegister: t = !1 } = a;
  if (!H())
    throw new Error("WebAuthn is not supported in this browser");
  const n = {
    ...e,
    challenge: M(e.challenge),
    user: {
      ...e.user,
      id: M(e.user.id)
    },
    excludeCredentials: (w = e.excludeCredentials) == null ? void 0 : w.map(Q)
  }, r = {};
  t && (r.mediation = "conditional"), r.publicKey = n, r.signal = ee.createNewAbortSignal();
  let s;
  try {
    s = await navigator.credentials.create(r);
  } catch (p) {
    throw ue({ error: p, options: r });
  }
  if (!s)
    throw new Error("Registration was not completed");
  const { id: i, rawId: c, response: l, type: d } = s;
  let u;
  typeof l.getTransports == "function" && (u = l.getTransports());
  let g;
  if (typeof l.getPublicKeyAlgorithm == "function")
    try {
      g = l.getPublicKeyAlgorithm();
    } catch (p) {
      F("getPublicKeyAlgorithm()", p);
    }
  let f;
  if (typeof l.getPublicKey == "function")
    try {
      const p = l.getPublicKey();
      p !== null && (f = E(p));
    } catch (p) {
      F("getPublicKey()", p);
    }
  let y;
  if (typeof l.getAuthenticatorData == "function")
    try {
      y = E(l.getAuthenticatorData());
    } catch (p) {
      F("getAuthenticatorData()", p);
    }
  return {
    id: i,
    rawId: E(c),
    response: {
      attestationObject: E(l.attestationObject),
      clientDataJSON: E(l.clientDataJSON),
      transports: u,
      publicKeyAlgorithm: g,
      publicKey: f,
      authenticatorData: y
    },
    type: d,
    clientExtensionResults: s.getClientExtensionResults(),
    authenticatorAttachment: te(s.authenticatorAttachment)
  };
}
function F(a, e) {
  console.warn(`The browser extension that intercepted this WebAuthn API call incorrectly implemented ${a}. You should report this error to them.
`, e);
}
function ye() {
  if (!H())
    return _.stubThis(new Promise((e) => e(!1)));
  const a = globalThis.PublicKeyCredential;
  return (a == null ? void 0 : a.isConditionalMediationAvailable) === void 0 ? _.stubThis(new Promise((e) => e(!1))) : _.stubThis(a.isConditionalMediationAvailable());
}
const _ = {
  stubThis: (a) => a
};
function fe({ error: a, options: e }) {
  const { publicKey: t } = e;
  if (!t)
    throw Error("options was missing required publicKey property");
  if (a.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new A({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: a
      });
  } else {
    if (a.name === "NotAllowedError")
      return new A({
        message: a.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: a
      });
    if (a.name === "SecurityError") {
      const n = globalThis.location.hostname;
      if (Z(n)) {
        if (t.rpId !== n)
          return new A({
            message: `The RP ID "${t.rpId}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: a
          });
      } else return new A({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: a
      });
    } else if (a.name === "UnknownError")
      return new A({
        message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: a
      });
  }
  return a;
}
async function L(a) {
  var y, w;
  !a.optionsJSON && a.challenge && (console.warn("startAuthentication() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."), a = { optionsJSON: a });
  const { optionsJSON: e, useBrowserAutofill: t = !1, verifyBrowserAutofillInput: n = !0 } = a;
  if (!H())
    throw new Error("WebAuthn is not supported in this browser");
  let r;
  ((y = e.allowCredentials) == null ? void 0 : y.length) !== 0 && (r = (w = e.allowCredentials) == null ? void 0 : w.map(Q));
  const s = {
    ...e,
    challenge: M(e.challenge),
    allowCredentials: r
  }, i = {};
  if (t) {
    if (!await ye())
      throw Error("Browser does not support WebAuthn autofill");
    if (document.querySelectorAll("input[autocomplete$='webauthn']").length < 1 && n)
      throw Error('No <input> with "webauthn" as the only or last value in its `autocomplete` attribute was detected');
    i.mediation = "conditional", s.allowCredentials = [];
  }
  i.publicKey = s, i.signal = ee.createNewAbortSignal();
  let c;
  try {
    c = await navigator.credentials.get(i);
  } catch (p) {
    throw fe({ error: p, options: i });
  }
  if (!c)
    throw new Error("Authentication was not completed");
  const { id: l, rawId: d, response: u, type: g } = c;
  let f;
  return u.userHandle && (f = E(u.userHandle)), {
    id: l,
    rawId: E(d),
    response: {
      authenticatorData: E(u.authenticatorData),
      clientDataJSON: E(u.clientDataJSON),
      signature: E(u.signature),
      userHandle: f
    },
    type: g,
    clientExtensionResults: c.getClientExtensionResults(),
    authenticatorAttachment: te(c.authenticatorAttachment)
  };
}
var ge = /* @__PURE__ */ ((a) => (a[a.DEBUG = 0] = "DEBUG", a[a.INFO = 1] = "INFO", a[a.WARN = 2] = "WARN", a[a.ERROR = 3] = "ERROR", a[a.SILENT = 4] = "SILENT", a))(ge || {});
class re {
  constructor(e) {
    h(this, "config");
    h(this, "sentryInitialized", !1);
    this.config = {
      level: 1,
      enableConsole: typeof window < "u",
      enableSentry: !1,
      environment: "development",
      ...e
    }, this.config.enableSentry && this.config.sentryDsn && this.initSentry();
  }
  initSentry() {
    typeof window > "u" || this.sentryInitialized || this.config.sentryDsn && import("@sentry/browser").then((e) => {
      e.init({
        dsn: this.config.sentryDsn,
        environment: this.config.environment,
        beforeSend(t) {
          return t.extra && (delete t.extra.privateKey, delete t.extra.mnemonic, delete t.extra.seed), t;
        }
      }), this.sentryInitialized = !0;
    }).catch(() => {
    });
  }
  shouldLog(e) {
    return e >= this.config.level;
  }
  formatMessage(e, t, n) {
    const r = (/* @__PURE__ */ new Date()).toISOString(), s = (n == null ? void 0 : n.component) || "SDK";
    return `[${r}] [${e}] [${s}] ${t}`;
  }
  sanitizeContext(e) {
    if (!e) return;
    const t = { ...e };
    return ["privateKey", "mnemonic", "seed", "password", "secret"].forEach((r) => {
      r in t && delete t[r];
    }), t;
  }
  debug(e, t) {
    if (!this.shouldLog(
      0
      /* DEBUG */
    )) return;
    const n = this.sanitizeContext(t);
    this.config.enableConsole && console.debug(this.formatMessage("DEBUG", e, n), n || "");
  }
  info(e, t) {
    if (!this.shouldLog(
      1
      /* INFO */
    )) return;
    const n = this.sanitizeContext(t);
    this.config.enableConsole && console.info(this.formatMessage("INFO", e, n), n || "");
  }
  warn(e, t) {
    if (!this.shouldLog(
      2
      /* WARN */
    )) return;
    const n = this.sanitizeContext(t);
    this.config.enableConsole && console.warn(this.formatMessage("WARN", e, n), n || ""), this.config.enableSentry && this.sentryInitialized && import("@sentry/browser").then((r) => {
      r.captureMessage(e, {
        level: "warning",
        extra: n
      });
    }).catch(() => {
    });
  }
  error(e, t, n) {
    if (!this.shouldLog(
      3
      /* ERROR */
    )) return;
    const r = this.sanitizeContext(n);
    this.config.enableConsole && console.error(this.formatMessage("ERROR", e, r), t || "", r || ""), this.config.enableSentry && this.sentryInitialized && import("@sentry/browser").then((s) => {
      t ? s.captureException(t, {
        extra: { message: e, ...r }
      }) : s.captureMessage(e, {
        level: "error",
        extra: r
      });
    }).catch(() => {
    });
  }
  setLevel(e) {
    this.config.level = e;
  }
  setContext(e) {
  }
}
const o = new re({
  level: process.env.NODE_ENV === "production" ? 2 : 0,
  enableConsole: !0,
  enableSentry: process.env.NODE_ENV === "production",
  sentryDsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development"
});
function $e(a) {
  return new re(a);
}
class Ve extends Error {
  constructor(t, n) {
    super(t);
    h(this, "cause");
    this.name = "PasskeyDiagnosticError", n != null && n.cause && (this.cause = n.cause);
  }
}
const we = [
  "vivo",
  "iqoo",
  "oppo",
  "realme",
  "oneplus",
  "xiaomi",
  "redmi",
  "poco",
  "miui",
  "huawei",
  "honor",
  "harmonyos",
  "zte",
  "nubia",
  "meizu",
  "lenovo",
  "moto",
  "motorola",
  "tecno",
  "infinix",
  "funtouch",
  "coloros",
  "oxygenos",
  "originos"
], T = {
  HIGH_RISK_DEVICE: "Passkey creation may not be reliable on this device. Try using a device with iCloud Keychain (iOS) or Google Password Manager (Android) for best results.",
  NO_PLATFORM_SUPPORT: "Your browser does not support passkeys. Please use a modern browser like Chrome, Safari, or Edge.",
  DIAGNOSTIC_FAILED: "Passkey health check failed. Try creating your passkey on a different device or browser."
};
function me() {
  var e;
  if (typeof window > "u") return "disabled";
  const a = ((e = process.env.PASSKEY_DIAGNOSTIC_MODE) == null ? void 0 : e.toLowerCase()) || "high-risk";
  return a === "always" ? "always" : a === "disabled" ? "disabled" : "high-risk";
}
function Ae() {
  var n, r;
  if (typeof window > "u" || typeof navigator > "u")
    return !1;
  const a = navigator.userAgent.toLowerCase(), e = ((n = navigator.vendor) == null ? void 0 : n.toLowerCase()) || "", t = ((r = navigator.platform) == null ? void 0 : r.toLowerCase()) || "";
  return we.some((s) => a.includes(s) || e.includes(s) || t.includes(s));
}
function be() {
  if (Ae())
    return "high";
  if (typeof navigator < "u") {
    const e = navigator.userAgent.match(/OS (\d+)_/);
    if (e && parseInt(e[1]) < 16)
      return "medium";
  }
  return "low";
}
async function Ce() {
  if (typeof window > "u" || !window.PublicKeyCredential)
    return !1;
  try {
    const a = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return o.debug("Platform authenticator check", {
      component: "PasskeyDiagnostic",
      available: a
    }), a;
  } catch (a) {
    return o.warn("Failed to check platform authenticator", {
      component: "PasskeyDiagnostic",
      error: a instanceof Error ? a.message : String(a)
    }), !1;
  }
}
async function Ee(a = "high-risk") {
  if (a === "disabled")
    return { success: !0, deviceRisk: "low", platformSupport: !0 };
  const e = be(), t = await Ce();
  if (o.info("Running passkey diagnostic", {
    component: "PasskeyDiagnostic",
    mode: a,
    deviceRisk: e,
    platformSupport: t
  }), a === "always") {
    if (!t)
      return {
        success: !1,
        deviceRisk: e,
        platformSupport: !1,
        errorMessage: T.NO_PLATFORM_SUPPORT
      };
    if (e === "high")
      return {
        success: !1,
        deviceRisk: e,
        platformSupport: t,
        errorMessage: T.HIGH_RISK_DEVICE
      };
  }
  return a === "high-risk" && e === "high" ? (o.warn("High-risk device detected", {
    component: "PasskeyDiagnostic",
    userAgent: typeof navigator < "u" ? navigator.userAgent : "unknown"
  }), {
    success: !0,
    // Allow but warn
    deviceRisk: e,
    platformSupport: t,
    errorMessage: T.HIGH_RISK_DEVICE
  }) : {
    success: !0,
    deviceRisk: e,
    platformSupport: t
  };
}
function Se(a) {
  return a.success && !a.errorMessage ? null : a.errorMessage ? a.errorMessage : a.platformSupport ? a.deviceRisk === "high" ? T.HIGH_RISK_DEVICE : T.DIAGNOSTIC_FAILED : T.NO_PLATFORM_SUPPORT;
}
class De {
  constructor(e) {
    h(this, "backendUrl");
    if (this.backendUrl = e.backendUrl || "https://arcwallet-backend.onrender.com", !this.isSupported())
      throw new Error("WebAuthn is not supported in this browser");
  }
  /**
   * Check if WebAuthn is supported
   */
  isSupported() {
    return typeof window < "u" && window.PublicKeyCredential !== void 0 && typeof window.PublicKeyCredential == "function";
  }
  /**
   * Get CSRF token from cookie
   */
  getCsrfToken() {
    if (typeof document > "u") return null;
    const e = document.cookie.match(/(?:^|; )_csrf=([^;]*)/);
    return e ? decodeURIComponent(e[1]) : null;
  }
  /**
   * Get headers with CSRF token for API requests
   */
  getHeaders() {
    const e = {
      "Content-Type": "application/json"
    }, t = this.getCsrfToken();
    return t && (e["X-CSRF-Token"] = t), e;
  }
  /**
   * Create new passkey for user using @simplewebauthn/browser
   */
  async createPasskey(e, t) {
    var n, r;
    try {
      o.info("Starting passkey registration", {
        component: "WebAuthn",
        action: "createPasskey",
        userId: e
      });
      const s = me(), i = await Ee(s), c = Se(i);
      c && o.warn("Passkey diagnostic warning", {
        component: "WebAuthn",
        deviceRisk: i.deviceRisk,
        platformSupport: i.platformSupport,
        message: c
      });
      const l = await fetch(`${this.backendUrl}/passkeys/register/start`, {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          username: e,
          // Backend expects 'username' (email)
          displayName: t
          // Backend expects 'displayName' (friendly name)
        })
      });
      if (!l.ok)
        throw new Error("Failed to get registration options");
      const d = await l.json(), u = ((n = d.data) == null ? void 0 : n.options) || d;
      o.debug("Received registration options from backend", {
        component: "WebAuthn",
        challenge: ((r = u.challenge) == null ? void 0 : r.substring(0, 20)) + "..."
      });
      const g = await ne({ optionsJSON: u });
      o.debug("Credential created successfully", {
        component: "WebAuthn",
        credentialId: g.id.substring(0, 20) + "..."
      });
      const f = await fetch(`${this.backendUrl}/passkeys/register/finish`, {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          username: e,
          // Backend expects 'username' not 'userId'
          credential: g
        })
      });
      if (!f.ok) {
        const w = await f.json().catch(() => ({})), p = w.error || w.message || "Failed to verify credential";
        throw console.error("[WebAuthn] Credential verification failed:", w), new Error(p);
      }
      const y = await f.json();
      return o.info("Passkey registered successfully", {
        component: "WebAuthn",
        credentialId: g.id.substring(0, 20) + "..."
      }), {
        id: g.id,
        publicKey: y.publicKey || g.id,
        // Backend should return the actual public key
        userId: e,
        // Include userId as required by PasskeyCredential interface
        createdAt: /* @__PURE__ */ new Date()
      };
    } catch (s) {
      throw o.error("Passkey creation failed", s, {
        component: "WebAuthn",
        action: "createPasskey"
      }), s.name === "NotAllowedError" ? new Error(
        "Passkey creation was cancelled. Please try again and allow the passkey when prompted."
      ) : s.name === "InvalidStateError" ? new Error(
        "This device is already registered. Please sign in with your existing passkey."
      ) : new Error(`Failed to create passkey: ${s.message}`);
    }
  }
  /**
   * Authenticate with existing passkey using @simplewebauthn/browser
   */
  async authenticate(e) {
    var t, n;
    try {
      o.info("Starting passkey authentication", {
        component: "WebAuthn",
        action: "authenticate",
        credentialId: e == null ? void 0 : e.substring(0, 20)
      });
      const r = await fetch(`${this.backendUrl}/passkeys/auth/start`, {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify({ credentialId: e })
      });
      if (!r.ok)
        throw new Error("Failed to get authentication options");
      const s = await r.json(), i = ((t = s.data) == null ? void 0 : t.options) || s;
      o.debug("Received authentication options from backend", {
        component: "WebAuthn",
        challenge: ((n = i.challenge) == null ? void 0 : n.substring(0, 20)) + "..."
      });
      const c = await L({ optionsJSON: i });
      o.debug("Authentication response received", {
        component: "WebAuthn",
        credentialId: c.id.substring(0, 20) + "..."
      });
      const l = await fetch(`${this.backendUrl}/passkeys/auth/finish`, {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          credential: c
        })
      });
      if (!l.ok) {
        const u = await l.json().catch(() => ({}));
        throw new Error(u.message || "Failed to verify authentication");
      }
      const d = await l.json();
      return o.info("Authentication successful", {
        component: "WebAuthn",
        credentialId: c.id.substring(0, 20) + "..."
      }), {
        success: !0,
        credentialId: c.id,
        userId: d.userId
        // Authenticator data is handled by backend
      };
    } catch (r) {
      if (o.error("Authentication failed", r, {
        component: "WebAuthn",
        action: "authenticate"
      }), r.name === "NotAllowedError")
        throw new Error(
          "Authentication was cancelled. Please try again and verify your identity when prompted."
        );
      if (r.name === "InvalidStateError")
        throw new Error(
          "No passkey found for this wallet. Please create a new wallet or use a different device."
        );
      return {
        success: !1,
        credentialId: "",
        userId: "",
        error: r.message
      };
    }
  }
}
class ve {
  constructor() {
    h(this, "ALGORITHM", "AES-GCM");
    h(this, "KEY_LENGTH", 256);
    h(this, "IV_LENGTH", 12);
    h(this, "SALT_LENGTH", 16);
  }
  /**
   * Derive encryption key from passkey credential
   */
  async deriveEncryptionKey(e, t) {
    const n = new TextEncoder(), r = await crypto.subtle.importKey(
      "raw",
      n.encode(e),
      "PBKDF2",
      !1,
      ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: t,
        iterations: 1e5,
        hash: "SHA-256"
      },
      r,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      !1,
      ["encrypt", "decrypt"]
    );
  }
  /**
   * Store encrypted private key
   */
  async storeKey(e, t, n) {
    try {
      const r = await this.encrypt(t, n);
      await N(`wallet_key_${e}`, r), o.info("Private key encrypted and stored", { component: "SecureStorage" });
    } catch (r) {
      throw o.error("Failed to store key", r instanceof Error ? r : void 0, { component: "SecureStorage" }), new Error("Failed to store private key securely");
    }
  }
  /**
   * Store WebCrypto encrypted data (new format)
   */
  async storeWebCryptoData(e, t) {
    await N(`wallet:${e}`, t);
  }
  /**
   * Retrieve and decrypt private key
   */
  async getKey(e, t) {
    try {
      const n = await k(`wallet_key_${e}`);
      return n ? await this.decrypt(n, t) : null;
    } catch (n) {
      return o.error("Failed to retrieve key", n instanceof Error ? n : void 0, { component: "SecureStorage" }), null;
    }
  }
  /**
   * Delete stored key
   */
  async deleteKey(e) {
    await ce(`wallet_key_${e}`);
  }
  /**
   * Clear all stored keys
   */
  async clearAll() {
    await de();
  }
  /**
   * Encrypt data using AES-GCM
   */
  async encrypt(e, t) {
    const r = new TextEncoder().encode(e), s = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH)), i = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    return {
      ciphertext: await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: s
        },
        t,
        r
      ),
      iv: s,
      salt: i
    };
  }
  /**
   * Decrypt data using AES-GCM
   */
  async decrypt(e, t) {
    const n = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: e.iv
      },
      t,
      e.ciphertext
    );
    return new TextDecoder().decode(n);
  }
  /**
   * Get key data (supports both legacy and new formats)
   */
  async getKeyData(e) {
    return await k(`wallet:${e}`);
  }
  /**
   * Store metadata
   */
  async storeMetadata(e, t) {
    await N(`wallet:${e}:metadata`, t);
  }
  /**
   * Get wallet metadata
   */
  async getMetadata(e) {
    const t = await k(`wallet:${e}:metadata`);
    return t || await k(`wallet_meta_${e}`);
  }
  /**
   * Check if key exists
   */
  async hasKey(e) {
    return await k(`wallet_key_${e}`) !== void 0;
  }
}
const Pe = new Uint8Array([
  65,
  82,
  67,
  87,
  65,
  76,
  76,
  69,
  // "ARCWALLE"
  84,
  95,
  83,
  65,
  76,
  84,
  95,
  86
  // "T_SALT_V"
]);
class Te {
  constructor() {
    h(this, "masterKey", null);
    h(this, "keyId", null);
  }
  /**
   * Generate/derive non-extractable master key from credentialId
   * Uses PBKDF2 to ensure deterministic key derivation
   */
  async generateMasterKey(e) {
    try {
      console.log("[WebCrypto] Deriving non-extractable master key from credential...");
      const t = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(e),
        "PBKDF2",
        !1,
        ["deriveBits", "deriveKey"]
      );
      this.masterKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: Pe,
          iterations: 1e5,
          hash: "SHA-256"
        },
        t,
        {
          name: "AES-GCM",
          length: 256
        },
        !1,
        // NON-EXTRACTABLE - Key cannot be exported!
        ["encrypt", "decrypt"]
      ), this.keyId = e, console.log("[WebCrypto] Master key derived (non-extractable, deterministic)");
    } catch (t) {
      throw console.error("[WebCrypto] Master key derivation failed:", t), new Error(`Failed to derive master key: ${t.message}`);
    }
  }
  /**
   * Encrypt data with non-extractable master key
   */
  async encrypt(e) {
    if (!this.masterKey)
      throw new Error("Master key not initialized");
    try {
      const t = crypto.getRandomValues(new Uint8Array(12)), n = new TextEncoder().encode(e), r = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: t
        },
        this.masterKey,
        n
      );
      return {
        encrypted: new Uint8Array(r),
        iv: t
      };
    } catch (t) {
      throw console.error("[WebCrypto] Encryption failed:", t), new Error(`Encryption failed: ${t.message}`);
    }
  }
  /**
   * Decrypt data with non-extractable master key
   */
  async decrypt(e, t) {
    if (!this.masterKey)
      throw new Error("Master key not initialized");
    try {
      const n = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: t
        },
        this.masterKey,
        e
      );
      return new TextDecoder().decode(n);
    } catch (n) {
      throw console.error("[WebCrypto] Decryption failed:", n), new Error(`Decryption failed: ${n.message}`);
    }
  }
  /**
   * Check if master key is initialized
   */
  isInitialized() {
    return this.masterKey !== null;
  }
  /**
   * Get key ID
   */
  getKeyId() {
    return this.keyId;
  }
  /**
   * Clear master key from memory
   */
  clear() {
    this.masterKey = null, this.keyId = null, console.log("[WebCrypto] Master key cleared from memory");
  }
  /**
   * Derive key from passkey credential (for backward compatibility)
   */
  async deriveKeyFromPasskey(e, t) {
    const n = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(e),
      "PBKDF2",
      !1,
      ["deriveBits", "deriveKey"]
    );
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: t,
        iterations: 1e5,
        hash: "SHA-256"
      },
      n,
      {
        name: "AES-GCM",
        length: 256
      },
      !1,
      // Non-extractable
      ["encrypt", "decrypt"]
    );
  }
  /**
   * Encrypt with derived key (for backward compatibility)
   */
  async encryptWithDerivedKey(e, t, n) {
    const r = await this.deriveKeyFromPasskey(t, n), s = crypto.getRandomValues(new Uint8Array(12)), i = new TextEncoder().encode(e), c = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: s
      },
      r,
      i
    );
    return {
      encrypted: new Uint8Array(c),
      iv: s
    };
  }
  /**
   * Decrypt with derived key (for backward compatibility)
   */
  async decryptWithDerivedKey(e, t, n, r) {
    const s = await this.deriveKeyFromPasskey(n, r), i = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: t
      },
      s,
      e
    );
    return new TextDecoder().decode(i);
  }
}
class ke {
  constructor(e, t) {
    h(this, "webauthn");
    h(this, "storage");
    h(this, "webCrypto");
    h(this, "currentWallet", null);
    h(this, "currentCredentialId", null);
    this.webauthn = e, this.storage = t, this.webCrypto = new Te();
  }
  /**
   * Create new wallet with passkey
   */
  async createWallet(e, t) {
    try {
      o.info("Creating new wallet with passkey", { component: "KeyManager", action: "createWallet" });
      const n = await this.webauthn.createPasskey(e, t);
      await this.webCrypto.generateMasterKey(n.id), o.info("WebCrypto master key derived (non-extractable, deterministic)", { component: "KeyManager" });
      const r = U.createRandom(), s = r.privateKey, i = r.address;
      o.info("Wallet created", { component: "KeyManager", address: i });
      const { encrypted: c, iv: l } = await this.webCrypto.encrypt(s);
      return await this.storage.storeWebCryptoData(n.id, {
        encrypted: Array.from(c),
        iv: Array.from(l),
        address: i,
        keyType: "webcrypto-master"
        // Mark as WebCrypto protected
      }), await this.storage.storeMetadata(n.id, {
        address: i,
        publicKey: n.publicKey,
        userId: e,
        createdAt: n.createdAt.toISOString(),
        keyType: "webcrypto-master"
      }), console.log("[KeyManager] Wallet secured with WebCrypto deterministic master key"), this.currentWallet = r, this.currentCredentialId = n.id, {
        address: i,
        credentialId: n.id,
        publicKey: n.publicKey
      };
    } catch (n) {
      throw o.error("Wallet creation failed", n instanceof Error ? n : void 0, { component: "KeyManager" }), new Error(`Failed to create wallet: ${n.message}`);
    }
  }
  /**
   * Unlock wallet with passkey authentication
   */
  async unlockWallet(e) {
    try {
      o.info("Unlocking wallet with passkey", { component: "KeyManager", action: "unlockWallet" });
      const t = await this.webauthn.authenticate(e);
      if (!t.success)
        throw new Error(t.error || "Authentication failed");
      const n = t.credentialId, r = await this.storage.getMetadata(n);
      if (!r)
        throw new Error("Wallet metadata not found");
      const s = await this.storage.getKeyData(n);
      if (!s)
        throw new Error("Wallet key data not found");
      let i;
      if (s.keyType === "webcrypto-master") {
        console.log("[KeyManager] Deriving WebCrypto master key for decryption"), await this.webCrypto.generateMasterKey(n);
        const l = new Uint8Array(s.encrypted), d = new Uint8Array(s.iv);
        i = await this.webCrypto.decrypt(l, d);
      } else {
        console.log("[KeyManager] Using legacy decryption method");
        const l = new Uint8Array(r.salt || []), d = await this.storage.deriveEncryptionKey(
          n,
          l
        ), u = await this.storage.getKey(n, d);
        if (!u)
          throw new Error("Failed to decrypt private key");
        i = u;
      }
      if (!i)
        throw new Error("Failed to decrypt private key");
      const c = new U(i);
      if (c.address.toLowerCase() !== r.address.toLowerCase())
        throw new Error("Address mismatch - wallet may be corrupted");
      return o.info("Wallet unlocked", { component: "KeyManager", address: c.address }), this.currentWallet = c, this.currentCredentialId = n, {
        address: c.address,
        credentialId: n,
        publicKey: r.publicKey
      };
    } catch (t) {
      throw o.error("Wallet unlock failed", t instanceof Error ? t : void 0, { component: "KeyManager" }), new Error(`Failed to unlock wallet: ${t.message}`);
    }
  }
  /**
   * Sign transaction with current wallet
   */
  async signTransaction(e) {
    if (!this.currentWallet) {
      console.log("[KeyManager] Wallet not unlocked, prompting for passkey authentication...");
      try {
        await this.unlockWallet(this.currentCredentialId || void 0);
      } catch {
        throw new Error("Please authenticate with your passkey to sign this transaction.");
      }
    }
    if (!this.currentWallet)
      throw new Error("No wallet unlocked. Please authenticate first.");
    try {
      console.log("[KeyManager] Signing transaction...");
      const t = await this.currentWallet.signTransaction(e);
      return console.log("[KeyManager] Transaction signed"), t;
    } catch (t) {
      throw console.error("[KeyManager] Transaction signing failed:", t), new Error(`Failed to sign transaction: ${t.message}`);
    }
  }
  /**
   * Sign message with current wallet
   */
  async signMessage(e) {
    if (!this.currentWallet) {
      console.log("[KeyManager] Wallet not unlocked, prompting for passkey authentication...");
      try {
        await this.unlockWallet(this.currentCredentialId || void 0);
      } catch {
        throw new Error("Please authenticate with your passkey to sign this message.");
      }
    }
    if (!this.currentWallet)
      throw new Error("No wallet unlocked. Please authenticate first.");
    try {
      console.log("[KeyManager] Signing message...");
      const t = await this.currentWallet.signMessage(e);
      return console.log("[KeyManager] Message signed"), t;
    } catch (t) {
      throw o.error("Message signing failed", t instanceof Error ? t : void 0, { component: "KeyManager" }), new Error(`Failed to sign message: ${t.message}`);
    }
  }
  /**
   * Get current wallet address
   */
  getCurrentAddress() {
    var e;
    return ((e = this.currentWallet) == null ? void 0 : e.address) || null;
  }
  /**
   * Get current wallet's private key (only when unlocked)
   * WARNING: Handle with care - never log or expose this value
   */
  getPrivateKey() {
    var e;
    return ((e = this.currentWallet) == null ? void 0 : e.privateKey) || null;
  }
  /**
   * Get current credential ID
   */
  getCurrentCredentialId() {
    return this.currentCredentialId;
  }
  /**
   * Lock wallet (clear from memory)
   */
  lock() {
    this.currentWallet = null, this.currentCredentialId = null, o.info("Wallet locked", { component: "KeyManager" });
  }
  /**
   * Delete wallet permanently
   */
  async deleteWallet(e) {
    try {
      await this.storage.deleteKey(e), await this.storage.storeMetadata(e, null), this.currentCredentialId === e && this.lock(), console.log("[KeyManager] Wallet deleted");
    } catch (t) {
      throw console.error("[KeyManager] Wallet deletion failed:", t), new Error(`Failed to delete wallet: ${t.message}`);
    }
  }
  /**
   * Check if wallet exists
   */
  async hasWallet(e) {
    return await this.storage.hasKey(e);
  }
  /**
   * Recover wallet using existing passkey (when local data is lost)
   * This authenticates with existing passkey and creates a NEW wallet
   * NOTE: This creates a new wallet address since the original private key is lost
   */
  async recoverWithExistingPasskey() {
    try {
      o.info("Recovering wallet with existing passkey", { component: "KeyManager", action: "recoverWithExistingPasskey" });
      const e = await this.webauthn.authenticate();
      if (!e.success)
        throw new Error(e.error || "Authentication failed");
      const t = e.credentialId;
      o.info("Authenticated with existing passkey", { component: "KeyManager", credentialId: t.substring(0, 20) + "..." }), await this.webCrypto.generateMasterKey(t), o.info("WebCrypto master key derived for recovery", { component: "KeyManager" });
      const n = U.createRandom(), r = n.privateKey, s = n.address;
      o.info("New recovery wallet created", { component: "KeyManager", address: s });
      const { encrypted: i, iv: c } = await this.webCrypto.encrypt(r);
      return await this.storage.storeWebCryptoData(t, {
        encrypted: Array.from(i),
        iv: Array.from(c),
        address: s,
        keyType: "webcrypto-master"
      }), await this.storage.storeMetadata(t, {
        address: s,
        publicKey: t,
        // Using credentialId as public key reference
        userId: e.userId || "recovered",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        keyType: "webcrypto-master",
        recoveredAt: (/* @__PURE__ */ new Date()).toISOString()
        // Mark as recovered wallet
      }), console.log("[KeyManager] Wallet recovered with new address using existing passkey"), this.currentWallet = n, this.currentCredentialId = t, {
        address: s,
        credentialId: t,
        publicKey: t
      };
    } catch (e) {
      throw o.error("Wallet recovery failed", e instanceof Error ? e : void 0, { component: "KeyManager" }), new Error(`Failed to recover wallet: ${e.message}`);
    }
  }
  /**
   * Get all wallet metadata (without private keys)
   */
  async getAllWallets() {
    return [];
  }
}
const Ie = {
  // Token Messenger contract addresses by chain ID
  tokenMessengerAddresses: {
    // TESTNETS
    11155111: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    // Sepolia
    421614: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    // Arbitrum Sepolia
    11155420: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    // Optimism Sepolia
    84532: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    // Base Sepolia
    // MAINNETS
    1: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
    // Ethereum Mainnet
    43114: "0x6b25532e1060CE10cc3B0A99e5683b91BFDe6982",
    // Avalanche C-Chain
    10: "0x2B4069517957735bE00ceE0fadAE88a26365528f",
    // Optimism Mainnet
    42161: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
    // Arbitrum One
    // Base and Polygon TokenMessenger addresses TBD
    // ⚠️ CONFIGURATION REQUIRED
    // Arc Network TokenMessenger address must be obtained from Arc Network team
    // Current value is a placeholder and will cause transactions to fail
    412346: "0x0000000000000000000000000000000000000000"
    // Arc Testnet - PLACEHOLDER
  },
  // USDC contract addresses by chain ID
  usdcAddresses: {
    // TESTNETS
    11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    // Sepolia
    421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    // Arbitrum Sepolia
    11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    // Optimism Sepolia
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    // Base Sepolia
    // MAINNETS
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    // Ethereum Mainnet
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    // Polygon (Native USDC)
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    // Optimism Mainnet
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    // Arbitrum One
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    // Base Mainnet
    43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    // Avalanche C-Chain
    // ⚠️ CONFIGURATION REQUIRED
    // Arc Network USDC address must be obtained from Arc Network team
    // Current value is a placeholder and will cause transactions to fail
    412346: "0x0000000000000000000000000000000000000000"
    // Arc Testnet - PLACEHOLDER
  },
  domainIds: {
    // TESTNETS
    11155111: 0,
    // Sepolia
    421614: 3,
    // Arbitrum Sepolia
    11155420: 2,
    // Optimism Sepolia
    84532: 6,
    // Base Sepolia
    412346: 7,
    // Arc Testnet - NEEDS VERIFICATION
    // MAINNETS
    1: 0,
    // Ethereum
    43114: 1,
    // Avalanche
    10: 2,
    // Optimism
    42161: 3,
    // Arbitrum
    8453: 6,
    // Base
    137: 7
    // Polygon
  },
  attestationServiceUrl: "https://iris-api.circle.com"
}, xe = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      },
      {
        internalType: "uint32",
        name: "destinationDomain",
        type: "uint32"
      },
      {
        internalType: "bytes32",
        name: "mintRecipient",
        type: "bytes32"
      },
      {
        internalType: "address",
        name: "burnToken",
        type: "address"
      }
    ],
    name: "depositForBurn",
    outputs: [
      {
        internalType: "uint64",
        name: "_nonce",
        type: "uint64"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: !1,
    inputs: [
      {
        indexed: !0,
        internalType: "uint64",
        name: "nonce",
        type: "uint64"
      },
      {
        indexed: !0,
        internalType: "address",
        name: "burnToken",
        type: "address"
      },
      {
        indexed: !1,
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      },
      {
        indexed: !0,
        internalType: "address",
        name: "depositor",
        type: "address"
      },
      {
        indexed: !1,
        internalType: "bytes32",
        name: "mintRecipient",
        type: "bytes32"
      },
      {
        indexed: !1,
        internalType: "uint32",
        name: "destinationDomain",
        type: "uint32"
      },
      {
        indexed: !1,
        internalType: "bytes32",
        name: "destinationTokenMessenger",
        type: "bytes32"
      },
      {
        indexed: !1,
        internalType: "bytes32",
        name: "destinationCaller",
        type: "bytes32"
      }
    ],
    name: "DepositForBurn",
    type: "event"
  }
], j = [
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      }
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        internalType: "address",
        name: "spender",
        type: "address"
      }
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address"
      }
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
], $ = {
  // Ethereum
  1: {
    chainId: 1,
    name: "Ethereum Mainnet",
    isTestnet: !1,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  11155111: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    isTestnet: !0,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  // Polygon
  137: {
    chainId: 137,
    name: "Polygon PoS",
    isTestnet: !1,
    nativeUSDC: !0,
    // Native USDC, not USDC.e
    cctpSupported: !0
  },
  // Base
  8453: {
    chainId: 8453,
    name: "Base Mainnet",
    isTestnet: !1,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  84532: {
    chainId: 84532,
    name: "Base Sepolia",
    isTestnet: !0,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  // Arbitrum
  42161: {
    chainId: 42161,
    name: "Arbitrum One",
    isTestnet: !1,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  421614: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    isTestnet: !0,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  // Optimism
  10: {
    chainId: 10,
    name: "Optimism Mainnet",
    isTestnet: !1,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  11155420: {
    chainId: 11155420,
    name: "Optimism Sepolia",
    isTestnet: !0,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  // Avalanche
  43114: {
    chainId: 43114,
    name: "Avalanche C-Chain",
    isTestnet: !1,
    nativeUSDC: !0,
    cctpSupported: !0
  },
  // Arc Network (Testnet)
  412346: {
    chainId: 412346,
    name: "Arc Testnet",
    isTestnet: !0,
    nativeUSDC: !0,
    // Assuming native for now
    cctpSupported: !0
    // Planned support
  }
};
function Re(a) {
  return $[a];
}
function Oe(a) {
  var e;
  return ((e = $[a]) == null ? void 0 : e.cctpSupported) ?? !1;
}
function je(a) {
  var e;
  return ((e = $[a]) == null ? void 0 : e.nativeUSDC) ?? !1;
}
const J = "0x0000000000000000000000000000000000000000", z = /^0x\.\.\.$/;
function B(a, e) {
  var i, c, l;
  const t = {
    isValid: !0,
    errors: [],
    warnings: []
  };
  if (!Oe(e)) {
    const d = Re(e), u = d ? d.name : `Chain ID ${e}`;
    return t.errors.push(`${u} does not support Circle CCTP`), t.isValid = !1, t;
  }
  const n = (i = a.tokenMessengerAddresses) == null ? void 0 : i[e], r = (c = a.usdcAddresses) == null ? void 0 : c[e], s = (l = a.domainIds) == null ? void 0 : l[e];
  return n || (t.errors.push(
    `TokenMessenger address not configured for chain ID ${e}`
  ), t.isValid = !1), r || (t.errors.push(`USDC address not configured for chain ID ${e}`), t.isValid = !1), s === void 0 && (t.errors.push(`Domain ID not configured for chain ID ${e}`), t.isValid = !1), e === 412346 && ((n === J || z.test(n || "")) && (t.warnings.push(
    "⚠️  Arc Network TokenMessenger address is a PLACEHOLDER. Cross-chain transfers will FAIL. Please obtain the correct address from the Arc Network team."
  ), t.isValid = !1), (r === J || z.test(r || "")) && (t.warnings.push(
    "⚠️  Arc Network USDC address is a PLACEHOLDER. Cross-chain transfers will FAIL. Please obtain the correct address from the Arc Network team."
  ), t.isValid = !1), s === 7 && t.warnings.push(
    "ℹ️  Arc Network domain ID (7) should be verified with Circle team. Incorrect domain ID will cause transfer failures."
  )), t.warnings.length > 0 && t.warnings.forEach((d) => {
    o.warn(d, {
      component: "CCTPValidator",
      chainId: e
    });
  }), t.errors.length > 0 && t.errors.forEach((d) => {
    o.error(d, void 0, {
      component: "CCTPValidator",
      chainId: e
    });
  }), t;
}
function Je(a) {
  const e = B(a, 412346);
  return e.isValid && e.warnings.length === 0;
}
function Y(a) {
  return a === 412346 ? `Arc Network CCTP is not properly configured. Please update the following in your WalletSDK config:

\`\`\`typescript
const sdk = new WalletSDK({
  // ... other config
  cctp: {
    tokenMessengerAddresses: {
      412346: "0x..." // Get from Arc Network team
    },
    usdcAddresses: {
      412346: "0x..." // Get from Arc Network team
    },
    domainIds: {
      412346: 7 // Verify with Circle team
    }
  }
});
\`\`\`` : `CCTP configuration missing for chain ID ${a}`;
}
class Me {
  constructor(e, t) {
    h(this, "config");
    h(this, "provider");
    this.provider = e, this.config = { ...Ie, ...t };
  }
  /**
   * Transfer USDC cross-chain using CCTP
   */
  async transferUSDC(e, t) {
    const { amount: n, destinationAddress: r, destinationChainId: s } = t, i = await e.provider.getNetwork().then((d) => Number(d.chainId)), c = B(this.config, i);
    if (!c.isValid) {
      const d = Y(i);
      throw o.error("CCTP configuration invalid for source chain", void 0, {
        component: "CCTPManager",
        chainId: i,
        errors: c.errors
      }), new Error(d);
    }
    const l = B(this.config, s);
    if (!l.isValid) {
      const d = Y(s);
      throw o.error("CCTP configuration invalid for destination chain", void 0, {
        component: "CCTPManager",
        chainId: s,
        errors: l.errors
      }), new Error(d);
    }
    try {
      console.log("[CCTP] Starting cross-chain USDC transfer:", {
        from: i,
        to: s,
        amount: n
      });
      const d = this.config.tokenMessengerAddresses[i], u = this.config.usdcAddresses[i], g = this.config.domainIds[s];
      if (!d || !u || g === void 0)
        throw new Error(`CCTP not supported for chain ${i}`);
      const f = ie(n, 6), y = new S(u, j, e);
      await y.allowance(e.address, d) < f && (console.log("[CCTP] Approving USDC..."), await (await y.approve(
        d,
        f
      )).wait(), console.log("[CCTP] USDC approved"));
      const p = this.addressToBytes32(r);
      console.log("[CCTP] Calling depositForBurn...");
      const D = await (await new S(
        d,
        xe,
        e
      ).depositForBurn(
        f,
        g,
        p,
        u
      )).wait();
      console.log("[CCTP] Burn transaction confirmed:", D.hash);
      const V = this.extractMessageHash(D), I = {
        sourceTxHash: D.hash,
        messageHash: V,
        status: "pending"
      };
      return this.pollForAttestation(V).then((x) => {
        I.attestation = x, I.status = "attested", console.log("[CCTP] Attestation received");
      }).catch((x) => {
        console.error("[CCTP] Attestation failed:", x), I.status = "failed";
      }), I;
    } catch (d) {
      throw console.error("[CCTP] Transfer failed:", d), new Error(`CCTP transfer failed: ${d.message}`);
    }
  }
  /**
   * Get attestation from Circle's attestation service
   */
  async getAttestation(e) {
    const t = `${this.config.attestationServiceUrl}/v1/attestations/${e}`;
    try {
      const n = await fetch(t);
      if (!n.ok)
        throw n.status === 404 ? new Error("Attestation not ready yet") : new Error(`Attestation service error: ${n.statusText}`);
      const r = await n.json();
      if (r.status !== "complete")
        throw new Error("Attestation not complete");
      return r.attestation;
    } catch (n) {
      throw new Error(`Failed to get attestation: ${n.message}`);
    }
  }
  /**
   * Poll for attestation with retries
   */
  async pollForAttestation(e, t = 60, n = 5e3) {
    for (let r = 0; r < t; r++)
      try {
        return await this.getAttestation(e);
      } catch (s) {
        if (r === t - 1)
          throw s;
        await new Promise((i) => setTimeout(i, n));
      }
    throw new Error("Attestation timeout");
  }
  /**
   * Convert Ethereum address to bytes32 format
   */
  addressToBytes32(e) {
    return "0x" + e.toLowerCase().replace("0x", "").padStart(64, "0");
  }
  /**
   * Extract message hash from transaction receipt
   */
  extractMessageHash(e) {
    const t = m(
      P(
        "MessageSent(bytes)"
      )
    ), n = e.logs.find((s) => s.topics[0] === t);
    if (!n)
      throw new Error("MessageSent event not found in transaction");
    const r = n.data;
    return m(r);
  }
  /**
   * Get USDC balance
   */
  async getUSDCBalance(e, t) {
    const n = t || Number((await this.provider.getNetwork()).chainId), r = this.config.usdcAddresses[n];
    if (!r)
      throw new Error(`USDC not supported on chain ${n}`);
    const i = await new S(r, j, this.provider).balanceOf(e);
    return oe(i, 6);
  }
}
const Ue = {
  entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  // v0.6
  bundlerUrl: "",
  // Must be provided
  factoryAddress: "",
  // Must be provided
  accountImplementation: ""
  // Must be provided
};
class Ke {
  constructor(e) {
    h(this, "config");
    this.config = e;
  }
  /**
   * Get paymaster data for UserOperation
   */
  async getPaymasterData(e) {
    try {
      const t = await fetch(`${this.config.paymasterUrl}/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOp: e,
          chainId: this.config.chainId
        })
      });
      if (!t.ok)
        throw new Error("Paymaster request failed");
      const n = await t.json();
      return o.info("Circle Paymaster sponsored transaction", {
        component: "CirclePaymaster",
        chainId: this.config.chainId
      }), n;
    } catch (t) {
      throw o.error("Failed to get paymaster sponsorship", t, {
        component: "CirclePaymaster"
      }), t;
    }
  }
}
const R = new W(), O = [
  "function execute(address dest, uint256 value, bytes calldata func)",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func)",
  "function getNonce() view returns (uint256)"
];
class Ne {
  constructor(e, t, n) {
    h(this, "config");
    h(this, "provider");
    h(this, "paymasterConfig");
    h(this, "circlePaymaster");
    h(this, "accountAddress", null);
    this.provider = e, this.config = { ...Ue, ...t }, this.paymasterConfig = n, (n == null ? void 0 : n.type) === "circle" && n.chainId && (this.circlePaymaster = new Ke({
      paymasterUrl: n.url,
      chainId: n.chainId,
      bundlerUrl: t == null ? void 0 : t.bundlerUrl
    }));
  }
  /**
   * Get counterfactual Smart Account address
   */
  getAccountAddress(e) {
    const t = m(P(e)), n = m(
      R.encode(
        ["address", "address"],
        [this.config.accountImplementation, e]
      )
    );
    return "0x" + m(
      R.encode(
        ["bytes1", "address", "bytes32", "bytes32"],
        ["0xff", this.config.factoryAddress, t, n]
      )
    ).slice(-40);
  }
  /**
   * Check if Smart Account is deployed
   */
  async isDeployed(e) {
    return await this.provider.getCode(e) !== "0x";
  }
  /**
   * Build UserOperation for single transaction
   */
  async buildUserOperation(e, t) {
    var f;
    const n = this.accountAddress || this.getAccountAddress(e.address);
    this.accountAddress = n;
    const r = await this.isDeployed(n), i = new K(O).encodeFunctionData("execute", [
      t.to,
      BigInt(t.value || "0"),
      t.data || "0x"
    ]);
    let c = 0n;
    r && (c = await new S(n, O, this.provider).getNonce());
    const l = r ? "0x" : this.buildInitCode(e.address), d = await this.provider.getFeeData(), u = {
      sender: n,
      nonce: c,
      initCode: l,
      callData: i,
      callGasLimit: 100000n,
      // Estimate
      verificationGasLimit: 200000n,
      preVerificationGas: 50000n,
      maxFeePerGas: d.maxFeePerGas || 0n,
      maxPriorityFeePerGas: d.maxPriorityFeePerGas || 0n,
      paymasterAndData: "0x",
      signature: "0x"
    };
    if (t.sponsored && ((f = this.paymasterConfig) != null && f.enabled)) {
      const y = await this.getPaymasterData(u);
      y && (u.paymasterAndData = y.paymasterAndData, y.callGasLimit && (u.callGasLimit = y.callGasLimit), y.verificationGasLimit && (u.verificationGasLimit = y.verificationGasLimit), y.preVerificationGas && (u.preVerificationGas = y.preVerificationGas));
    }
    const g = await this.signUserOperation(e, u);
    return u.signature = g, u;
  }
  /**
   * Build UserOperation for batch transactions
   */
  async buildBatchUserOperation(e, t, n = !1) {
    var C;
    const r = this.accountAddress || this.getAccountAddress(e.address);
    this.accountAddress = r;
    const s = await this.isDeployed(r), i = new K(O), c = t.map((b) => b.to), l = t.map((b) => BigInt(b.value || "0")), d = t.map((b) => b.data || "0x"), u = i.encodeFunctionData("executeBatch", [
      c,
      l,
      d
    ]);
    let g = 0n;
    s && (g = await new S(r, O, this.provider).getNonce());
    const f = s ? "0x" : this.buildInitCode(e.address), y = await this.provider.getFeeData(), w = {
      sender: r,
      nonce: g,
      initCode: f,
      callData: u,
      callGasLimit: 150000n * BigInt(t.length),
      // Scale with batch size
      verificationGasLimit: 200000n,
      preVerificationGas: 50000n,
      maxFeePerGas: y.maxFeePerGas || 0n,
      maxPriorityFeePerGas: y.maxPriorityFeePerGas || 0n,
      paymasterAndData: "0x",
      signature: "0x"
    };
    if (n && ((C = this.paymasterConfig) != null && C.enabled)) {
      const b = await this.getPaymasterData(w);
      b && (w.paymasterAndData = b.paymasterAndData);
    }
    const p = await this.signUserOperation(e, w);
    return w.signature = p, w;
  }
  /**
   * Send UserOperation to bundler
   */
  async sendUserOperation(e) {
    try {
      o.info("Sending UserOperation to bundler", { component: "SmartAccount" });
      const n = await (await fetch(this.config.bundlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_sendUserOperation",
          params: [this.serializeUserOp(e), this.config.entryPoint]
        })
      })).json();
      if (n.error)
        throw new Error(n.error.message || "Bundler error");
      const r = n.result;
      return o.info("UserOperation sent", { component: "SmartAccount", userOpHash: r }), {
        userOpHash: r,
        status: "pending"
      };
    } catch (t) {
      throw console.error("[SmartAccount] Send UserOperation failed:", t), new Error(`Failed to send UserOperation: ${t.message}`);
    }
  }
  /**
   * Build initCode for account deployment
   */
  buildInitCode(e) {
    const r = new K([
      "function createAccount(address owner, uint256 salt) returns (address)"
    ]).encodeFunctionData("createAccount", [
      e,
      0
    ]);
    return this.config.factoryAddress + r.slice(2);
  }
  /**
   * Sign UserOperation
   */
  async signUserOperation(e, t) {
    const n = this.getUserOpHash(t);
    return await e.signMessage(P(n));
  }
  /**
   * Get UserOperation hash
   */
  getUserOpHash(e) {
    var s;
    const t = this.packUserOp(e), n = m(t), r = ((s = this.provider._network) == null ? void 0 : s.chainId) || 1n;
    return m(
      R.encode(
        ["bytes32", "address", "uint256"],
        [n, this.config.entryPoint, r]
      )
    );
  }
  /**
   * Pack UserOperation for hashing
   */
  packUserOp(e) {
    return R.encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes32"
      ],
      [
        e.sender,
        e.nonce,
        m(e.initCode === "0x" ? new Uint8Array() : P(e.initCode)),
        m(e.callData === "0x" ? new Uint8Array() : P(e.callData)),
        e.callGasLimit,
        e.verificationGasLimit,
        e.preVerificationGas,
        e.maxFeePerGas,
        e.maxPriorityFeePerGas,
        m(
          e.paymasterAndData === "0x" ? new Uint8Array() : P(e.paymasterAndData)
        )
      ]
    );
  }
  /**
   * Serialize UserOperation for JSON-RPC
   */
  serializeUserOp(e) {
    return {
      sender: e.sender,
      nonce: v(e.nonce),
      initCode: e.initCode,
      callData: e.callData,
      callGasLimit: v(e.callGasLimit),
      verificationGasLimit: v(e.verificationGasLimit),
      preVerificationGas: v(e.preVerificationGas),
      maxFeePerGas: v(e.maxFeePerGas),
      maxPriorityFeePerGas: v(e.maxPriorityFeePerGas),
      paymasterAndData: e.paymasterAndData,
      signature: e.signature
    };
  }
  /**
   * Get paymaster sponsorship data
   */
  async getPaymasterData(e) {
    var t;
    if (!((t = this.paymasterConfig) != null && t.url))
      return null;
    if (this.circlePaymaster)
      try {
        return await this.circlePaymaster.getPaymasterData(this.serializeUserOp(e));
      } catch (n) {
        return console.error("[Paymaster] Circle Paymaster failed:", n), null;
      }
    try {
      const r = await (await fetch(`${this.paymasterConfig.url}/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOperation: this.serializeUserOp(e),
          entryPoint: this.config.entryPoint
        })
      })).json();
      return r.success ? {
        paymasterAndData: r.paymasterAndData,
        callGasLimit: r.callGasLimit ? BigInt(r.callGasLimit) : void 0,
        verificationGasLimit: r.verificationGasLimit ? BigInt(r.verificationGasLimit) : void 0,
        preVerificationGas: r.preVerificationGas ? BigInt(r.preVerificationGas) : void 0
      } : (console.warn("[Paymaster] Sponsorship denied:", r.error), null);
    } catch (n) {
      return console.error("[Paymaster] Failed to get sponsorship:", n), null;
    }
  }
  /**
   * Create Circle-compatible smart account (MSCA)
   */
  async createCircleMSCA(e, t) {
    const n = "0x0000000000000000000000000000000000000000", r = new S(
      n,
      ["function createAccount(address owner, uint256 salt) returns (address)"],
      t
    ), s = 0;
    try {
      o.info("Creating Circle MSCA", {
        component: "SmartAccountManager",
        owner: e
      });
      const c = await (await r.createAccount(e, s)).wait();
      return o.info("Circle MSCA creation transaction confirmed", {
        component: "SmartAccountManager",
        txHash: c.hash
      }), "0x...";
    } catch (i) {
      throw o.error("Failed to create Circle MSCA", i, {
        component: "SmartAccountManager"
      }), i;
    }
  }
}
class ze {
  constructor(e) {
    h(this, "webauthn");
    h(this, "storage");
    h(this, "keyManager");
    h(this, "cctpManager");
    h(this, "smartAccountManager", null);
    h(this, "provider");
    h(this, "eventListeners");
    h(this, "currentAccount", null);
    h(this, "accountType");
    this.webauthn = new De({
      rpId: e.rpId,
      rpName: e.appName,
      backendUrl: e.backendUrl
    }), this.storage = new ve(), this.keyManager = new ke(this.webauthn, this.storage), this.provider = new q(e.rpcUrl), this.cctpManager = new Me(this.provider, e.cctp), this.accountType = e.accountType || "eoa", this.accountType === "smart-account" && (this.smartAccountManager = new Ne(
      this.provider,
      e.smartAccount,
      e.paymaster
    )), this.eventListeners = /* @__PURE__ */ new Map(), o.debug("Initialized with config", {
      appName: e.appName,
      rpId: e.rpId,
      rpcUrl: e.rpcUrl,
      accountType: this.accountType
    });
  }
  /**
   * Create new wallet with passkey
   */
  async createWallet(e, t) {
    try {
      o.info("Creating new wallet", { component: "WalletSDK", action: "createWallet" });
      const n = await this.keyManager.createWallet(e, t);
      return this.currentAccount = n, this.emit("connect", { address: n.address }), o.info("Wallet created", { component: "WalletSDK", address: n.address }), n;
    } catch (n) {
      throw this.emit("error", {
        message: n.message,
        code: "CREATE_WALLET_FAILED"
      }), n;
    }
  }
  /**
   * Connect to existing wallet (unlock with passkey)
   */
  async connect(e) {
    try {
      o.info("Connecting wallet", { component: "WalletSDK", action: "connect" });
      const t = await this.keyManager.unlockWallet(e);
      return this.currentAccount = t, this.emit("connect", { address: t.address }), o.info("Connected", { component: "WalletSDK", address: t.address }), t;
    } catch (t) {
      throw this.emit("error", {
        message: t.message,
        code: "CONNECT_FAILED"
      }), t;
    }
  }
  /**
   * Disconnect wallet (lock)
   */
  disconnect() {
    this.keyManager.lock(), this.currentAccount = null, this.emit("disconnect", { reason: "User disconnected" }), o.info("Disconnected", { component: "WalletSDK" });
  }
  /**
   * Sign and send transaction
   */
  async signTransaction(e) {
    if (!this.currentAccount)
      throw new Error("No wallet connected. Please connect first.");
    try {
      o.info("Signing transaction", { component: "WalletSDK" });
      const t = {
        to: e.to,
        value: e.value,
        data: e.data || "0x",
        gasLimit: e.gasLimit,
        maxFeePerGas: e.maxFeePerGas,
        maxPriorityFeePerGas: e.maxPriorityFeePerGas
      };
      if (!t.gasLimit) {
        const c = await this.provider.estimateGas({
          to: t.to,
          value: t.value,
          data: t.data
        });
        t.gasLimit = c;
      }
      if (!t.maxFeePerGas || !t.maxPriorityFeePerGas) {
        const c = await this.provider.getFeeData();
        t.maxFeePerGas = t.maxFeePerGas || c.maxFeePerGas || void 0, t.maxPriorityFeePerGas = t.maxPriorityFeePerGas || c.maxPriorityFeePerGas || void 0;
      }
      const n = await this.keyManager.signTransaction(t), s = await (await this.provider.broadcastTransaction(n)).wait(), i = {
        hash: s.hash,
        signedTx: n,
        from: this.currentAccount.address,
        to: e.to,
        value: e.value
      };
      return this.emit("transactionSigned", { hash: s.hash }), o.info("Transaction sent", { component: "WalletSDK", hash: s.hash }), i;
    } catch (t) {
      throw this.emit("error", {
        message: t.message,
        code: "TRANSACTION_FAILED"
      }), t;
    }
  }
  /**
   * Sign message
   */
  async signMessage(e) {
    if (!this.currentAccount)
      throw new Error("No wallet connected. Please connect first.");
    try {
      o.info("Signing message", { component: "WalletSDK" });
      const t = await this.keyManager.signMessage(e);
      return o.info("Message signed", { component: "WalletSDK" }), t;
    } catch (t) {
      throw this.emit("error", {
        message: t.message,
        code: "SIGN_MESSAGE_FAILED"
      }), t;
    }
  }
  /**
   * Get current account
   */
  getAccount() {
    return this.currentAccount;
  }
  /**
   * Get current address
   */
  getAddress() {
    var e;
    return ((e = this.currentAccount) == null ? void 0 : e.address) || null;
  }
  /**
   * Get private key (only when wallet is unlocked)
   * WARNING: Handle with care - never log or expose this value
   */
  getPrivateKey() {
    return this.currentAccount ? this.keyManager.getPrivateKey() : null;
  }
  /**
   * Check if wallet is connected
   */
  isConnected() {
    return this.currentAccount !== null;
  }
  /**
   * Get provider for advanced usage
   */
  getProvider() {
    return this.provider;
  }
  /**
   * Subscribe to events
   */
  on(e, t) {
    this.eventListeners.has(e) || this.eventListeners.set(e, /* @__PURE__ */ new Set()), this.eventListeners.get(e).add(t);
  }
  /**
   * Unsubscribe from events
   */
  off(e, t) {
    const n = this.eventListeners.get(e);
    n && n.delete(t);
  }
  /**
   * Emit event
   */
  emit(e, t) {
    const n = this.eventListeners.get(e);
    n && n.forEach((r) => r(t));
  }
  /**
   * Transfer USDC cross-chain using CCTP
   */
  async transferUSDC(e) {
    if (!this.currentAccount)
      throw new Error("No wallet connected. Please connect first.");
    if (!this.keyManager.currentWallet)
      throw new Error("Wallet not unlocked. Please authenticate first.");
    try {
      o.info("Initiating CCTP transfer", { component: "WalletSDK" });
      const t = this.keyManager.currentWallet, n = await this.cctpManager.transferUSDC(t, e);
      return this.emit("transactionSigned", { hash: n.sourceTxHash }), o.info("CCTP transfer initiated", { component: "WalletSDK", sourceTxHash: n.sourceTxHash }), n;
    } catch (t) {
      throw this.emit("error", {
        message: t.message,
        code: "CCTP_TRANSFER_FAILED"
      }), t;
    }
  }
  /**
   * Get USDC balance
   */
  async getUSDCBalance(e) {
    if (!this.currentAccount)
      throw new Error("No wallet connected");
    return await this.cctpManager.getUSDCBalance(this.currentAccount.address, e);
  }
  /**
   * Send UserOperation (Smart Account only)
   */
  async sendUserOperation(e) {
    if (this.accountType !== "smart-account" || !this.smartAccountManager)
      throw new Error('Smart Account mode not enabled. Set accountType to "smart-account"');
    if (!this.currentAccount)
      throw new Error("No wallet connected. Please connect first.");
    if (!this.keyManager.currentWallet)
      throw new Error("Wallet not unlocked. Please authenticate first.");
    try {
      o.debug("Building UserOperation", { component: "WalletSDK" });
      const t = this.keyManager.currentWallet, n = await this.smartAccountManager.buildUserOperation(t, e);
      o.info("Sending UserOperation", { component: "WalletSDK" });
      const r = await this.smartAccountManager.sendUserOperation(n);
      return this.emit("transactionSigned", { hash: r.userOpHash }), o.info("UserOperation sent", { component: "WalletSDK", userOpHash: r.userOpHash }), r;
    } catch (t) {
      throw this.emit("error", {
        message: t.message,
        code: "USER_OPERATION_FAILED"
      }), t;
    }
  }
  /**
   * Batch transactions (Smart Account only)
   */
  async batchTransactions(e, t = !1) {
    if (this.accountType !== "smart-account" || !this.smartAccountManager)
      throw new Error('Smart Account mode not enabled. Set accountType to "smart-account"');
    if (!this.currentAccount)
      throw new Error("No wallet connected. Please connect first.");
    if (!this.keyManager.currentWallet)
      throw new Error("Wallet not unlocked. Please authenticate first.");
    try {
      o.debug("Building batch UserOperation", { component: "WalletSDK" });
      const n = this.keyManager.currentWallet, r = await this.smartAccountManager.buildBatchUserOperation(
        n,
        e,
        t
      );
      o.info("Sending batch UserOperation", { component: "WalletSDK" });
      const s = await this.smartAccountManager.sendUserOperation(r);
      return this.emit("transactionSigned", { hash: s.userOpHash }), o.info("Batch UserOperation sent", { component: "WalletSDK", userOpHash: s.userOpHash }), s;
    } catch (n) {
      throw this.emit("error", {
        message: n.message,
        code: "BATCH_TRANSACTION_FAILED"
      }), n;
    }
  }
  /**
   * Get Smart Account address (counterfactual)
   */
  getSmartAccountAddress() {
    return this.accountType !== "smart-account" || !this.smartAccountManager || !this.currentAccount ? null : this.smartAccountManager.getAccountAddress(this.currentAccount.address);
  }
  /**
   * Check if Smart Account is deployed
   */
  async isSmartAccountDeployed() {
    if (this.accountType !== "smart-account" || !this.smartAccountManager)
      return !1;
    const e = this.getSmartAccountAddress();
    return e ? await this.smartAccountManager.isDeployed(e) : !1;
  }
  /**
   * Delete wallet permanently
   */
  async deleteWallet() {
    if (!this.currentAccount)
      throw new Error("No wallet connected");
    const e = this.currentAccount.credentialId;
    await this.keyManager.deleteWallet(e), this.disconnect(), o.info("Wallet deleted permanently", { component: "WalletSDK" });
  }
  /**
   * Recover wallet using existing passkey (when local data is lost)
   * This authenticates with the existing passkey and creates a NEW wallet
   * NOTE: This creates a new wallet address since the original private key is lost
   */
  async recoverWithExistingPasskey() {
    try {
      o.info("Recovering wallet with existing passkey", { component: "WalletSDK", action: "recoverWithExistingPasskey" });
      const e = await this.keyManager.recoverWithExistingPasskey();
      return this.currentAccount = e, this.emit("connect", { address: e.address }), o.info("Wallet recovered with new address", { component: "WalletSDK", address: e.address }), e;
    } catch (e) {
      throw this.emit("error", {
        message: e.message,
        code: "RECOVER_WALLET_FAILED"
      }), e;
    }
  }
}
class Ye {
  constructor(e) {
    h(this, "config");
    h(this, "baseUrl");
    this.config = e, this.baseUrl = e.baseUrl || "https://api.circle.com/v1";
  }
  /**
   * Monitor USDC transactions via Circle API
   */
  async getUSDCTransactions(e) {
    try {
      const t = await fetch(
        `${this.baseUrl}/wallets/${e}/transactions`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (!t.ok)
        throw new Error(`Circle API error: ${t.statusText}`);
      return (await t.json()).data || [];
    } catch (t) {
      throw o.error("Failed to fetch USDC transactions", t, {
        component: "CircleApiClient",
        address: e
      }), t;
    }
  }
  /**
   * Get real-time USDC balance from Circle API
   */
  async getUSDCBalance(e, t) {
    var n, r;
    try {
      const s = await fetch(
        `${this.baseUrl}/balances/${e}?chainId=${t}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (!s.ok)
        throw new Error(`Circle API error: ${s.statusText}`);
      return ((r = (n = (await s.json()).data) == null ? void 0 : n.usdc) == null ? void 0 : r.balance) || "0";
    } catch (s) {
      throw o.error("Failed to fetch USDC balance", s, {
        component: "CircleApiClient",
        address: e,
        chainId: t
      }), s;
    }
  }
}
const G = (a) => Array.from(a).map((e) => e.toString(16).padStart(2, "0")).join(""), Fe = (a) => {
  const e = a.startsWith("0x") ? a.slice(2) : a, t = new Uint8Array(e.length / 2);
  for (let n = 0; n < t.length; n++)
    t[n] = parseInt(e.substr(n * 2, 2), 16);
  return t;
}, _e = (a) => new TextDecoder().decode(a), Ge = [
  "function getAddress(uint256 x, uint256 y, uint256 salt) view returns (address)",
  "function createAccount(uint256 x, uint256 y, uint256 salt) returns (address)"
], X = [
  "function execute(address target, uint256 value, bytes data) returns (bytes)",
  "function executeBatch(address[] dest, uint256[] value, bytes[] func)",
  "function validateUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingFunds) returns (uint256)",
  "function getUserOpNonce() view returns (uint256)",
  "function getOwnerPublicKey() view returns (uint256 x, uint256 y)"
];
class Xe {
  constructor(e) {
    h(this, "provider");
    h(this, "factory");
    h(this, "config");
    h(this, "currentCredential", null);
    h(this, "accountAddress", null);
    this.config = e, this.provider = new q(e.rpcUrl), this.factory = new S(e.factoryAddress, Ge, this.provider);
  }
  /**
   * Create new passkey and get account address
   */
  async createAccount(e, t) {
    var C, b;
    o.info("Creating passkey account", { component: "PasskeyAccountManager", userId: e });
    const n = await fetch(`${this.config.backendUrl}/passkeys/register/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: e, displayName: t })
    });
    if (!n.ok)
      throw new Error("Failed to get registration options");
    const r = await n.json(), s = ((C = r.data) == null ? void 0 : C.options) || r, i = await ne({ optionsJSON: s }), c = await fetch(`${this.config.backendUrl}/passkeys/register/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: e, credential: i })
    });
    if (!c.ok)
      throw new Error("Failed to verify credential");
    const d = (b = (await c.json()).data) == null ? void 0 : b.publicKey;
    if (!(d != null && d.x) || !(d != null && d.y))
      throw new Error("Server did not return public key coordinates");
    const { x: u, y: g } = d, f = {
      credentialId: i.id,
      publicKeyX: u,
      publicKeyY: g,
      userId: e
    }, y = BigInt(m(new TextEncoder().encode(e))), p = await this.factory.getFunction("getAddress")(BigInt(u), BigInt(g), y);
    return this.currentCredential = f, this.accountAddress = p, this.storeCredential(f), o.info("Passkey account created", {
      component: "PasskeyAccountManager",
      address: p,
      credentialId: i.id.substring(0, 20) + "..."
    }), { address: p, credential: f };
  }
  /**
   * Connect with existing passkey
   * @param username Optional username/email to find specific credentials
   */
  async connect(e) {
    var f, y, w, p, C, b;
    o.info("Connecting with existing passkey", { component: "PasskeyAccountManager", username: e });
    const t = await fetch(`${this.config.backendUrl}/passkeys/auth/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: e })
    });
    if (!t.ok)
      throw new Error("Failed to get authentication options");
    const n = await t.json(), r = ((f = n.data) == null ? void 0 : f.options) || n, s = await L({ optionsJSON: r }), i = await fetch(`${this.config.backendUrl}/passkeys/auth/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ credential: s })
    });
    if (!i.ok)
      throw new Error("Failed to verify authentication");
    const c = await i.json(), l = (y = c.data) == null ? void 0 : y.publicKey, d = ((p = (w = c.data) == null ? void 0 : w.user) == null ? void 0 : p.username) || ((b = (C = c.data) == null ? void 0 : C.user) == null ? void 0 : b.id);
    if (!(l != null && l.x) || !(l != null && l.y)) {
      const D = this.loadCredential(s.id);
      if (!D)
        throw new Error("Credential not found. Server did not return public key coordinates.");
      this.currentCredential = D;
    } else {
      const D = {
        credentialId: s.id,
        publicKeyX: l.x,
        publicKeyY: l.y,
        userId: d
      };
      this.currentCredential = D, this.storeCredential(D);
    }
    const u = BigInt(m(new TextEncoder().encode(this.currentCredential.userId))), g = this.factory.getFunction("getAddress");
    return this.accountAddress = await g(
      BigInt(this.currentCredential.publicKeyX),
      BigInt(this.currentCredential.publicKeyY),
      u
    ), o.info("Connected with passkey", {
      component: "PasskeyAccountManager",
      address: this.accountAddress
    }), { address: this.accountAddress, credential: this.currentCredential };
  }
  /**
   * Sign UserOperation with passkey
   */
  async signUserOperation(e, t) {
    var p;
    if (!this.currentCredential)
      throw new Error("No passkey connected. Please connect first.");
    o.info("Signing UserOperation with passkey", { component: "PasskeyAccountManager" });
    const n = await fetch(`${this.config.backendUrl}/passkeys/auth/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        credentialId: this.currentCredential.credentialId,
        challenge: t
        // Use userOpHash as challenge
      })
    });
    if (!n.ok)
      throw new Error("Failed to get signing options");
    const r = await n.json(), s = ((p = r.data) == null ? void 0 : p.options) || r;
    s.challenge = this.toBase64Url(t);
    const i = await L({ optionsJSON: s }), { r: c, s: l, authenticatorData: d, clientDataJSON: u, challengeIndex: g, typeIndex: f } = await this.extractSignatureComponents(i), w = W.defaultAbiCoder().encode(
      ["bytes", "string", "uint256", "uint256", "uint256", "uint256"],
      [d, u, g, f, c, l]
    );
    return o.info("UserOperation signed", { component: "PasskeyAccountManager" }), w;
  }
  /**
   * Get current account address
   */
  getAccountAddress() {
    return this.accountAddress;
  }
  /**
   * Get current credential
   */
  getCurrentCredential() {
    return this.currentCredential;
  }
  /**
   * Restore state from a stored credential (without WebAuthn interaction)
   * Use this when restoring from localStorage
   */
  async restoreFromCredential(e) {
    const { keccak256: t } = await import("ethers");
    this.currentCredential = e;
    const n = BigInt(t(new TextEncoder().encode(e.userId))), r = this.factory.getFunction("getAddress");
    return this.accountAddress = await r(
      BigInt(e.publicKeyX),
      BigInt(e.publicKeyY),
      n
    ), o.info("Restored from credential", {
      component: "PasskeyAccountManager",
      address: this.accountAddress
    }), this.accountAddress;
  }
  /**
   * Check if account is deployed
   */
  async isAccountDeployed() {
    return this.accountAddress ? await this.provider.getCode(this.accountAddress) !== "0x" : !1;
  }
  /**
   * Get account nonce
   */
  async getAccountNonce() {
    if (!this.accountAddress) throw new Error("No account connected");
    return await this.isAccountDeployed() ? await new S(this.accountAddress, X, this.provider).getUserOpNonce() : 0n;
  }
  /**
   * Build init code for account deployment
   */
  getInitCode() {
    if (!this.currentCredential) throw new Error("No credential connected");
    const e = BigInt(m(new TextEncoder().encode(this.currentCredential.userId))), t = this.factory.interface.encodeFunctionData("createAccount", [
      BigInt(this.currentCredential.publicKeyX),
      BigInt(this.currentCredential.publicKeyY),
      e
    ]);
    return this.config.factoryAddress + t.slice(2);
  }
  /**
   * Execute a transaction via the smart account
   * This handles the full ERC-4337 UserOperation flow:
   * 1. Build UserOperation with callData
   * 2. Get gas estimates
   * 3. Sign with passkey
   * 4. Submit to bundler/RPC
   */
  async executeTransaction(e, t, n = "0x") {
    if (!this.accountAddress)
      throw new Error("No account connected. Please connect first.");
    o.info("Executing transaction via passkey account", {
      component: "PasskeyAccountManager",
      to: e,
      value: t.toString()
    });
    const r = await this.isAccountDeployed(), i = new S(this.accountAddress, X, this.provider).interface.encodeFunctionData("execute", [e, t, n]), c = await this.provider.getFeeData(), l = c.maxFeePerGas || c.gasPrice || 1000000000n, d = c.maxPriorityFeePerGas || 100000000n, u = await this.getAccountNonce(), g = {
      sender: this.accountAddress,
      nonce: u,
      initCode: r ? "0x" : this.getInitCode(),
      callData: i,
      callGasLimit: 500000n,
      // Conservative estimate
      verificationGasLimit: r ? 150000n : 500000n,
      // Higher for deployment
      preVerificationGas: 50000n,
      maxFeePerGas: l,
      maxPriorityFeePerGas: d,
      paymasterAndData: "0x"
      // No paymaster for now
    }, f = this.calculateUserOpHash(g), y = await this.signUserOperation(g, f), w = { ...g, signature: y };
    try {
      return { hash: (await this.submitViaRelay(w)).hash, userOpHash: f };
    } catch (p) {
      o.error("Relay submission failed", p instanceof Error ? p : void 0, {
        component: "PasskeyAccountManager"
      });
      try {
        const C = await this.submitUserOperation(w);
        return { hash: C.hash, userOpHash: C.userOpHash };
      } catch (C) {
        throw o.warn("Bundler submission also failed", {
          component: "PasskeyAccountManager",
          error: C
        }), new Error((p == null ? void 0 : p.message) || "Transaction submission failed. Please try again.");
      }
    }
  }
  /**
   * Submit UserOperation via backend relay service
   */
  async submitViaRelay(e) {
    const t = `${this.config.backendUrl}/api/relay/user-operation`;
    o.info("Submitting UserOperation via relay", {
      component: "PasskeyAccountManager",
      sender: e.sender
    });
    const r = await (await fetch(t, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        userOp: {
          sender: e.sender,
          nonce: "0x" + e.nonce.toString(16),
          initCode: e.initCode,
          callData: e.callData,
          callGasLimit: "0x" + e.callGasLimit.toString(16),
          verificationGasLimit: "0x" + e.verificationGasLimit.toString(16),
          preVerificationGas: "0x" + e.preVerificationGas.toString(16),
          maxFeePerGas: "0x" + e.maxFeePerGas.toString(16),
          maxPriorityFeePerGas: "0x" + e.maxPriorityFeePerGas.toString(16),
          paymasterAndData: e.paymasterAndData,
          signature: e.signature
        }
      })
    })).json();
    if (!r.success)
      throw new Error(r.error || "Relay failed");
    return o.info("Transaction relayed successfully", {
      component: "PasskeyAccountManager",
      hash: r.data.transactionHash
    }), { hash: r.data.transactionHash };
  }
  /**
   * Calculate UserOperation hash for signing
   */
  calculateUserOpHash(e) {
    const t = W.defaultAbiCoder(), n = t.encode(
      ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [
        e.sender,
        e.nonce,
        m(e.initCode),
        m(e.callData),
        e.callGasLimit,
        e.verificationGasLimit,
        e.preVerificationGas,
        e.maxFeePerGas,
        e.maxPriorityFeePerGas,
        m(e.paymasterAndData)
      ]
    ), r = m(n), i = t.encode(
      ["bytes32", "address", "uint256"],
      [r, this.config.entryPointAddress, 5042002n]
    );
    return m(i);
  }
  /**
   * Submit UserOperation to bundler or RPC
   */
  async submitUserOperation(e) {
    const t = {
      sender: e.sender,
      nonce: "0x" + e.nonce.toString(16),
      initCode: e.initCode,
      callData: e.callData,
      callGasLimit: "0x" + e.callGasLimit.toString(16),
      verificationGasLimit: "0x" + e.verificationGasLimit.toString(16),
      preVerificationGas: "0x" + e.preVerificationGas.toString(16),
      maxFeePerGas: "0x" + e.maxFeePerGas.toString(16),
      maxPriorityFeePerGas: "0x" + e.maxPriorityFeePerGas.toString(16),
      paymasterAndData: e.paymasterAndData,
      signature: e.signature
    };
    try {
      const r = await (await fetch(this.config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_sendUserOperation",
          params: [t, this.config.entryPointAddress],
          id: Date.now()
        })
      })).json();
      if (r.error)
        throw new Error(r.error.message || "Bundler rejected UserOperation");
      const s = r.result;
      return { hash: await this.waitForUserOperation(s), userOpHash: s };
    } catch (n) {
      throw o.error("Failed to submit UserOperation", n instanceof Error ? n : void 0, { component: "PasskeyAccountManager" }), n;
    }
  }
  /**
   * Wait for UserOperation to be included in a transaction
   */
  async waitForUserOperation(e, t = 6e4) {
    var r, s;
    const n = Date.now();
    for (; Date.now() - n < t; ) {
      try {
        const c = await (await fetch(this.config.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getUserOperationReceipt",
            params: [e],
            id: Date.now()
          })
        })).json();
        if ((s = (r = c.result) == null ? void 0 : r.receipt) != null && s.transactionHash)
          return c.result.receipt.transactionHash;
      } catch {
      }
      await new Promise((i) => setTimeout(i, 2e3));
    }
    return e;
  }
  // ============ Private Methods ============
  async extractSignatureComponents(e) {
    const t = "0x" + G(this.fromBase64Url(e.response.authenticatorData)), n = _e(this.fromBase64Url(e.response.clientDataJSON)), r = n.indexOf('"challenge"'), s = n.indexOf('"type"'), i = this.fromBase64Url(e.response.signature), { r: c, s: l } = this.parseDERSignature(i);
    return {
      r: BigInt("0x" + G(c)),
      s: BigInt("0x" + G(l)),
      authenticatorData: t,
      clientDataJSON: n,
      challengeIndex: r,
      typeIndex: s
    };
  }
  parseDERSignature(e) {
    let t = 0;
    if (e[t++] !== 48) throw new Error("Invalid DER signature");
    if (t++, e[t++] !== 2) throw new Error("Invalid DER signature");
    const n = e[t++], r = e.slice(t, t + n);
    if (t += n, e[t++] !== 2) throw new Error("Invalid DER signature");
    const s = e[t++], i = e.slice(t, t + s), c = r[0] === 0 ? r.slice(1) : r, l = i[0] === 0 ? i.slice(1) : i, d = new Uint8Array(32), u = new Uint8Array(32);
    return d.set(c, 32 - c.length), u.set(l, 32 - l.length), { r: d, s: u };
  }
  toBase64Url(e) {
    const t = Fe(e);
    return btoa(String.fromCharCode(...t)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  fromBase64Url(e) {
    const t = e.replace(/-/g, "+").replace(/_/g, "/"), n = "=".repeat((4 - t.length % 4) % 4), r = atob(t + n), s = new Uint8Array(r.length);
    for (let i = 0; i < r.length; i++)
      s[i] = r.charCodeAt(i);
    return s;
  }
  storeCredential(e) {
    const t = `arcwallet:passkey:${e.credentialId}`;
    localStorage.setItem(t, JSON.stringify(e)), localStorage.setItem("arcwallet:passkey:current", e.credentialId);
  }
  loadCredential(e) {
    const t = `arcwallet:passkey:${e}`, n = localStorage.getItem(t);
    return n ? JSON.parse(n) : null;
  }
}
const We = "0x00000000";
async function qe(a, e) {
  try {
    return await e.getCode(a) === "0x" ? !1 : await new S(a, [
      "function supportsInterface(bytes4) view returns (bool)"
    ], e).supportsInterface(We);
  } catch {
    return !1;
  }
}
const Qe = "1.0.0";
export {
  Me as CCTPManager,
  $ as CIRCLE_NETWORKS,
  Ye as CircleApiClient,
  Ke as CirclePaymasterClient,
  Ue as DEFAULT_AA_CONFIG,
  Ie as DEFAULT_CCTP_CONFIG,
  ke as KeyManager,
  ge as LogLevel,
  T as PASSKEY_DIAGNOSTIC_MESSAGES,
  Xe as PasskeyAccountManager,
  Ve as PasskeyDiagnosticError,
  ve as SecureStorage,
  Ne as SmartAccountManager,
  Qe as VERSION,
  ze as WalletSDK,
  De as WebAuthnManager,
  Ce as checkPlatformAuthenticatorSupport,
  $e as createLogger,
  Y as getCCTPConfigErrorMessage,
  Re as getCircleNetwork,
  be as getDeviceRiskLevel,
  Se as getDiagnosticErrorMessage,
  me as getPasskeyDiagnosticMode,
  Je as isArcNetworkConfigured,
  Oe as isCCTPSupported,
  qe as isCircleMSCA,
  Ae as isHighRiskDevice,
  je as isNativeUSDC,
  o as logger,
  Ee as runPasskeyDiagnostic,
  B as validateCCTPConfig
};
//# sourceMappingURL=index.mjs.map
