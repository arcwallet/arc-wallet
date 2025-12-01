var de = Object.defineProperty;
var le = (a, e, t) => e in a ? de(a, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : a[e] = t;
var p = (a, e, t) => le(a, typeof e != "symbol" ? e + "" : e, t);
import { Wallet as G, parseUnits as ue, Contract as P, keccak256 as C, getBytes as O, formatUnits as he, AbiCoder as $, Interface as _, toBeHex as T, JsonRpcProvider as ee } from "ethers";
import { set as B, get as x, del as pe, clear as ye } from "idb-keyval";
function D(a) {
  const e = new Uint8Array(a);
  let t = "";
  for (const r of e)
    t += String.fromCharCode(r);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function F(a) {
  const e = a.replace(/-/g, "+").replace(/_/g, "/"), t = (4 - e.length % 4) % 4, n = e.padEnd(e.length + t, "="), r = atob(n), s = new ArrayBuffer(r.length), i = new Uint8Array(s);
  for (let c = 0; c < r.length; c++)
    i[c] = r.charCodeAt(c);
  return s;
}
function J() {
  return ge.stubThis((globalThis == null ? void 0 : globalThis.PublicKeyCredential) !== void 0 && typeof globalThis.PublicKeyCredential == "function");
}
const ge = {
  stubThis: (a) => a
};
function te(a) {
  const { id: e } = a;
  return {
    ...a,
    id: F(e),
    /**
     * `descriptor.transports` is an array of our `AuthenticatorTransportFuture` that includes newer
     * transports that TypeScript's DOM lib is ignorant of. Convince TS that our list of transports
     * are fine to pass to WebAuthn since browsers will recognize the new value.
     */
    transports: a.transports
  };
}
function ne(a) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    a === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(a)
  );
}
class S extends Error {
  constructor({ message: e, code: t, cause: n, name: r }) {
    super(e, { cause: n }), Object.defineProperty(this, "code", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.name = r ?? n.name, this.code = t;
  }
}
function fe({ error: a, options: e }) {
  var n, r, s;
  const { publicKey: t } = e;
  if (!t)
    throw Error("options was missing required publicKey property");
  if (a.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new S({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: a
      });
  } else if (a.name === "ConstraintError") {
    if (((n = t.authenticatorSelection) == null ? void 0 : n.requireResidentKey) === !0)
      return new S({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: a
      });
    if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      e.mediation === "conditional" && ((r = t.authenticatorSelection) == null ? void 0 : r.userVerification) === "required"
    )
      return new S({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: a
      });
    if (((s = t.authenticatorSelection) == null ? void 0 : s.userVerification) === "required")
      return new S({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: a
      });
  } else {
    if (a.name === "InvalidStateError")
      return new S({
        message: "The authenticator was previously registered",
        code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
        cause: a
      });
    if (a.name === "NotAllowedError")
      return new S({
        message: a.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: a
      });
    if (a.name === "NotSupportedError")
      return t.pubKeyCredParams.filter((c) => c.type === "public-key").length === 0 ? new S({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: a
      }) : new S({
        message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
        code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
        cause: a
      });
    if (a.name === "SecurityError") {
      const i = globalThis.location.hostname;
      if (ne(i)) {
        if (t.rp.id !== i)
          return new S({
            message: `The RP ID "${t.rp.id}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: a
          });
      } else return new S({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: a
      });
    } else if (a.name === "TypeError") {
      if (t.user.id.byteLength < 1 || t.user.id.byteLength > 64)
        return new S({
          message: "User ID was not between 1 and 64 characters",
          code: "ERROR_INVALID_USER_ID_LENGTH",
          cause: a
        });
    } else if (a.name === "UnknownError")
      return new S({
        message: "The authenticator was unable to process the specified options, or could not create a new credential",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: a
      });
  }
  return a;
}
class me {
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
const re = new me(), we = ["cross-platform", "platform"];
function ae(a) {
  if (a && !(we.indexOf(a) < 0))
    return a;
}
async function se(a) {
  var A;
  !a.optionsJSON && a.challenge && (console.warn("startRegistration() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."), a = { optionsJSON: a });
  const { optionsJSON: e, useAutoRegister: t = !1 } = a;
  if (!J())
    throw new Error("WebAuthn is not supported in this browser");
  const n = {
    ...e,
    challenge: F(e.challenge),
    user: {
      ...e.user,
      id: F(e.user.id)
    },
    excludeCredentials: (A = e.excludeCredentials) == null ? void 0 : A.map(te)
  }, r = {};
  t && (r.mediation = "conditional"), r.publicKey = n, r.signal = re.createNewAbortSignal();
  let s;
  try {
    s = await navigator.credentials.create(r);
  } catch (g) {
    throw fe({ error: g, options: r });
  }
  if (!s)
    throw new Error("Registration was not completed");
  const { id: i, rawId: c, response: l, type: d } = s;
  let u;
  typeof l.getTransports == "function" && (u = l.getTransports());
  let h;
  if (typeof l.getPublicKeyAlgorithm == "function")
    try {
      h = l.getPublicKeyAlgorithm();
    } catch (g) {
      W("getPublicKeyAlgorithm()", g);
    }
  let f;
  if (typeof l.getPublicKey == "function")
    try {
      const g = l.getPublicKey();
      g !== null && (f = D(g));
    } catch (g) {
      W("getPublicKey()", g);
    }
  let y;
  if (typeof l.getAuthenticatorData == "function")
    try {
      y = D(l.getAuthenticatorData());
    } catch (g) {
      W("getAuthenticatorData()", g);
    }
  return {
    id: i,
    rawId: D(c),
    response: {
      attestationObject: D(l.attestationObject),
      clientDataJSON: D(l.clientDataJSON),
      transports: u,
      publicKeyAlgorithm: h,
      publicKey: f,
      authenticatorData: y
    },
    type: d,
    clientExtensionResults: s.getClientExtensionResults(),
    authenticatorAttachment: ae(s.authenticatorAttachment)
  };
}
function W(a, e) {
  console.warn(`The browser extension that intercepted this WebAuthn API call incorrectly implemented ${a}. You should report this error to them.
`, e);
}
function Ae() {
  if (!J())
    return L.stubThis(new Promise((e) => e(!1)));
  const a = globalThis.PublicKeyCredential;
  return (a == null ? void 0 : a.isConditionalMediationAvailable) === void 0 ? L.stubThis(new Promise((e) => e(!1))) : L.stubThis(a.isConditionalMediationAvailable());
}
const L = {
  stubThis: (a) => a
};
function be({ error: a, options: e }) {
  const { publicKey: t } = e;
  if (!t)
    throw Error("options was missing required publicKey property");
  if (a.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new S({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: a
      });
  } else {
    if (a.name === "NotAllowedError")
      return new S({
        message: a.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: a
      });
    if (a.name === "SecurityError") {
      const n = globalThis.location.hostname;
      if (ne(n)) {
        if (t.rpId !== n)
          return new S({
            message: `The RP ID "${t.rpId}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: a
          });
      } else return new S({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: a
      });
    } else if (a.name === "UnknownError")
      return new S({
        message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: a
      });
  }
  return a;
}
async function V(a) {
  var y, A;
  !a.optionsJSON && a.challenge && (console.warn("startAuthentication() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."), a = { optionsJSON: a });
  const { optionsJSON: e, useBrowserAutofill: t = !1, verifyBrowserAutofillInput: n = !0 } = a;
  if (!J())
    throw new Error("WebAuthn is not supported in this browser");
  let r;
  ((y = e.allowCredentials) == null ? void 0 : y.length) !== 0 && (r = (A = e.allowCredentials) == null ? void 0 : A.map(te));
  const s = {
    ...e,
    challenge: F(e.challenge),
    allowCredentials: r
  }, i = {};
  if (t) {
    if (!await Ae())
      throw Error("Browser does not support WebAuthn autofill");
    if (document.querySelectorAll("input[autocomplete$='webauthn']").length < 1 && n)
      throw Error('No <input> with "webauthn" as the only or last value in its `autocomplete` attribute was detected');
    i.mediation = "conditional", s.allowCredentials = [];
  }
  i.publicKey = s, i.signal = re.createNewAbortSignal();
  let c;
  try {
    c = await navigator.credentials.get(i);
  } catch (g) {
    throw be({ error: g, options: i });
  }
  if (!c)
    throw new Error("Authentication was not completed");
  const { id: l, rawId: d, response: u, type: h } = c;
  let f;
  return u.userHandle && (f = D(u.userHandle)), {
    id: l,
    rawId: D(d),
    response: {
      authenticatorData: D(u.authenticatorData),
      clientDataJSON: D(u.clientDataJSON),
      signature: D(u.signature),
      userHandle: f
    },
    type: h,
    clientExtensionResults: c.getClientExtensionResults(),
    authenticatorAttachment: ae(c.authenticatorAttachment)
  };
}
var Ce = /* @__PURE__ */ ((a) => (a[a.DEBUG = 0] = "DEBUG", a[a.INFO = 1] = "INFO", a[a.WARN = 2] = "WARN", a[a.ERROR = 3] = "ERROR", a[a.SILENT = 4] = "SILENT", a))(Ce || {});
class oe {
  constructor(e) {
    p(this, "config");
    p(this, "sentryInitialized", !1);
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
const o = new oe({
  level: process.env.NODE_ENV === "production" ? 2 : 0,
  enableConsole: !0,
  enableSentry: process.env.NODE_ENV === "production",
  sentryDsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development"
});
function qe(a) {
  return new oe(a);
}
class Qe extends Error {
  constructor(t, n) {
    super(t);
    p(this, "cause");
    this.name = "PasskeyDiagnosticError", n != null && n.cause && (this.cause = n.cause);
  }
}
const Se = [
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
], M = {
  HIGH_RISK_DEVICE: "Passkey creation may not be reliable on this device. Try using a device with iCloud Keychain (iOS) or Google Password Manager (Android) for best results.",
  NO_PLATFORM_SUPPORT: "Your browser does not support passkeys. Please use a modern browser like Chrome, Safari, or Edge.",
  DIAGNOSTIC_FAILED: "Passkey health check failed. Try creating your passkey on a different device or browser."
};
function Ee() {
  var e;
  if (typeof window > "u") return "disabled";
  const a = ((e = process.env.PASSKEY_DIAGNOSTIC_MODE) == null ? void 0 : e.toLowerCase()) || "high-risk";
  return a === "always" ? "always" : a === "disabled" ? "disabled" : "high-risk";
}
function Pe() {
  var n, r;
  if (typeof window > "u" || typeof navigator > "u")
    return !1;
  const a = navigator.userAgent.toLowerCase(), e = ((n = navigator.vendor) == null ? void 0 : n.toLowerCase()) || "", t = ((r = navigator.platform) == null ? void 0 : r.toLowerCase()) || "";
  return Se.some((s) => a.includes(s) || e.includes(s) || t.includes(s));
}
function ve() {
  if (Pe())
    return "high";
  if (typeof navigator < "u") {
    const e = navigator.userAgent.match(/OS (\d+)_/);
    if (e && parseInt(e[1]) < 16)
      return "medium";
  }
  return "low";
}
async function ke() {
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
async function De(a = "high-risk") {
  if (a === "disabled")
    return { success: !0, deviceRisk: "low", platformSupport: !0 };
  const e = ve(), t = await ke();
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
        errorMessage: M.NO_PLATFORM_SUPPORT
      };
    if (e === "high")
      return {
        success: !1,
        deviceRisk: e,
        platformSupport: t,
        errorMessage: M.HIGH_RISK_DEVICE
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
    errorMessage: M.HIGH_RISK_DEVICE
  }) : {
    success: !0,
    deviceRisk: e,
    platformSupport: t
  };
}
function Ie(a) {
  return a.success && !a.errorMessage ? null : a.errorMessage ? a.errorMessage : a.platformSupport ? a.deviceRisk === "high" ? M.HIGH_RISK_DEVICE : M.DIAGNOSTIC_FAILED : M.NO_PLATFORM_SUPPORT;
}
class Te {
  constructor(e) {
    p(this, "backendUrl");
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
      const s = Ee(), i = await De(s), c = Ie(i);
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
      const h = await se({ optionsJSON: u });
      o.debug("Credential created successfully", {
        component: "WebAuthn",
        credentialId: h.id.substring(0, 20) + "..."
      });
      const f = await fetch(`${this.backendUrl}/passkeys/register/finish`, {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          username: e,
          // Backend expects 'username' not 'userId'
          credential: h
        })
      });
      if (!f.ok) {
        const A = await f.json().catch(() => ({})), g = A.error || A.message || "Failed to verify credential";
        throw console.error("[WebAuthn] Credential verification failed:", A), new Error(g);
      }
      const y = await f.json();
      return o.info("Passkey registered successfully", {
        component: "WebAuthn",
        credentialId: h.id.substring(0, 20) + "..."
      }), {
        id: h.id,
        publicKey: y.publicKey || h.id,
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
      const c = await V({ optionsJSON: i });
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
class Oe {
  constructor() {
    p(this, "ALGORITHM", "AES-GCM");
    p(this, "KEY_LENGTH", 256);
    p(this, "IV_LENGTH", 12);
    p(this, "SALT_LENGTH", 16);
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
      await B(`wallet_key_${e}`, r), o.info("Private key encrypted and stored", { component: "SecureStorage" });
    } catch (r) {
      throw o.error("Failed to store key", r instanceof Error ? r : void 0, { component: "SecureStorage" }), new Error("Failed to store private key securely");
    }
  }
  /**
   * Store WebCrypto encrypted data (new format)
   */
  async storeWebCryptoData(e, t) {
    await B(`wallet:${e}`, t);
  }
  /**
   * Retrieve and decrypt private key
   */
  async getKey(e, t) {
    try {
      const n = await x(`wallet_key_${e}`);
      return n ? await this.decrypt(n, t) : null;
    } catch (n) {
      return o.error("Failed to retrieve key", n instanceof Error ? n : void 0, { component: "SecureStorage" }), null;
    }
  }
  /**
   * Delete stored key
   */
  async deleteKey(e) {
    await pe(`wallet_key_${e}`);
  }
  /**
   * Clear all stored keys
   */
  async clearAll() {
    await ye();
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
    return await x(`wallet:${e}`);
  }
  /**
   * Store metadata
   */
  async storeMetadata(e, t) {
    await B(`wallet:${e}:metadata`, t);
  }
  /**
   * Get wallet metadata
   */
  async getMetadata(e) {
    const t = await x(`wallet:${e}:metadata`);
    return t || await x(`wallet_meta_${e}`);
  }
  /**
   * Check if key exists
   */
  async hasKey(e) {
    return await x(`wallet_key_${e}`) !== void 0;
  }
}
const Me = new Uint8Array([
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
class xe {
  constructor() {
    p(this, "masterKey", null);
    p(this, "keyId", null);
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
          salt: Me,
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
class Re {
  constructor(e, t) {
    p(this, "webauthn");
    p(this, "storage");
    p(this, "webCrypto");
    p(this, "currentWallet", null);
    p(this, "currentCredentialId", null);
    this.webauthn = e, this.storage = t, this.webCrypto = new xe();
  }
  /**
   * Create new wallet with passkey
   */
  async createWallet(e, t) {
    try {
      o.info("Creating new wallet with passkey", { component: "KeyManager", action: "createWallet" });
      const n = await this.webauthn.createPasskey(e, t);
      await this.webCrypto.generateMasterKey(n.id), o.info("WebCrypto master key derived (non-extractable, deterministic)", { component: "KeyManager" });
      const r = G.createRandom(), s = r.privateKey, i = r.address;
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
      const c = new G(i);
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
      const n = G.createRandom(), r = n.privateKey, s = n.address;
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
const Ue = {
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
    // Arc Testnet CCTP contracts (official addresses from docs.arc.network)
    5042002: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"
    // Arc Testnet TokenMessenger
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
    // Arc Testnet USDC (native token address from docs.arc.network)
    5042002: "0x3600000000000000000000000000000000000000"
    // Arc Testnet USDC (Native)
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
    5042002: 26,
    // Arc Testnet (official domain from docs.arc.network)
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
}, Ke = [
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
], z = [
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
], Y = {
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
function Fe(a) {
  return Y[a];
}
function Ne(a) {
  var e;
  return ((e = Y[a]) == null ? void 0 : e.cctpSupported) ?? !1;
}
function Ze(a) {
  var e;
  return ((e = Y[a]) == null ? void 0 : e.nativeUSDC) ?? !1;
}
const X = "0x0000000000000000000000000000000000000000", q = /^0x\.\.\.$/;
function j(a, e) {
  var i, c, l;
  const t = {
    isValid: !0,
    errors: [],
    warnings: []
  };
  if (!Ne(e)) {
    const d = Fe(e), u = d ? d.name : `Chain ID ${e}`;
    return t.errors.push(`${u} does not support Circle CCTP`), t.isValid = !1, t;
  }
  const n = (i = a.tokenMessengerAddresses) == null ? void 0 : i[e], r = (c = a.usdcAddresses) == null ? void 0 : c[e], s = (l = a.domainIds) == null ? void 0 : l[e];
  return n || (t.errors.push(
    `TokenMessenger address not configured for chain ID ${e}`
  ), t.isValid = !1), r || (t.errors.push(`USDC address not configured for chain ID ${e}`), t.isValid = !1), s === void 0 && (t.errors.push(`Domain ID not configured for chain ID ${e}`), t.isValid = !1), e === 412346 && ((n === X || q.test(n || "")) && (t.warnings.push(
    "⚠️  Arc Network TokenMessenger address is a PLACEHOLDER. Cross-chain transfers will FAIL. Please obtain the correct address from the Arc Network team."
  ), t.isValid = !1), (r === X || q.test(r || "")) && (t.warnings.push(
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
function et(a) {
  const e = j(a, 412346);
  return e.isValid && e.warnings.length === 0;
}
function Q(a) {
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
class Ge {
  constructor(e, t) {
    p(this, "config");
    p(this, "provider");
    this.provider = e, this.config = { ...Ue, ...t };
  }
  /**
   * Transfer USDC cross-chain using CCTP
   */
  async transferUSDC(e, t) {
    const { amount: n, destinationAddress: r, destinationChainId: s } = t, i = await e.provider.getNetwork().then((d) => Number(d.chainId)), c = j(this.config, i);
    if (!c.isValid) {
      const d = Q(i);
      throw o.error("CCTP configuration invalid for source chain", void 0, {
        component: "CCTPManager",
        chainId: i,
        errors: c.errors
      }), new Error(d);
    }
    const l = j(this.config, s);
    if (!l.isValid) {
      const d = Q(s);
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
      const d = this.config.tokenMessengerAddresses[i], u = this.config.usdcAddresses[i], h = this.config.domainIds[s];
      if (!d || !u || h === void 0)
        throw new Error(`CCTP not supported for chain ${i}`);
      const f = ue(n, 6), y = new P(u, z, e);
      await y.allowance(e.address, d) < f && (console.log("[CCTP] Approving USDC..."), await (await y.approve(
        d,
        f
      )).wait(), console.log("[CCTP] USDC approved"));
      const g = this.addressToBytes32(r);
      console.log("[CCTP] Calling depositForBurn...");
      const w = await (await new P(
        d,
        Ke,
        e
      ).depositForBurn(
        f,
        h,
        g,
        u
      )).wait();
      console.log("[CCTP] Burn transaction confirmed:", w.hash);
      const E = this.extractMessageHash(w), k = {
        sourceTxHash: w.hash,
        messageHash: E,
        status: "pending"
      };
      return this.pollForAttestation(E).then((b) => {
        k.attestation = b, k.status = "attested", console.log("[CCTP] Attestation received");
      }).catch((b) => {
        console.error("[CCTP] Attestation failed:", b), k.status = "failed";
      }), k;
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
    const t = C(
      O(
        "MessageSent(bytes)"
      )
    ), n = e.logs.find((s) => s.topics[0] === t);
    if (!n)
      throw new Error("MessageSent event not found in transaction");
    const r = n.data;
    return C(r);
  }
  /**
   * Get USDC balance
   */
  async getUSDCBalance(e, t) {
    const n = t || Number((await this.provider.getNetwork()).chainId), r = this.config.usdcAddresses[n];
    if (!r)
      throw new Error(`USDC not supported on chain ${n}`);
    const i = await new P(r, z, this.provider).balanceOf(e);
    return he(i, 6);
  }
}
const _e = {
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  // v0.7
  bundlerUrl: "",
  // Must be provided
  factoryAddress: "",
  // Must be provided
  accountImplementation: ""
  // Must be provided
};
class Be {
  constructor(e) {
    p(this, "config");
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
const U = new $(), K = [
  "function execute(address dest, uint256 value, bytes calldata func)",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func)",
  "function getNonce() view returns (uint256)"
];
class We {
  constructor(e, t, n) {
    p(this, "config");
    p(this, "provider");
    p(this, "paymasterConfig");
    p(this, "circlePaymaster");
    p(this, "accountAddress", null);
    this.provider = e, this.config = { ..._e, ...t }, this.paymasterConfig = n, (n == null ? void 0 : n.type) === "circle" && n.chainId && (this.circlePaymaster = new Be({
      paymasterUrl: n.url,
      chainId: n.chainId,
      bundlerUrl: t == null ? void 0 : t.bundlerUrl
    }));
  }
  /**
   * Get counterfactual Smart Account address
   */
  getAccountAddress(e) {
    const t = C(O(e)), n = C(
      U.encode(
        ["address", "address"],
        [this.config.accountImplementation, e]
      )
    );
    return "0x" + C(
      U.encode(
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
    const r = await this.isDeployed(n), i = new _(K).encodeFunctionData("execute", [
      t.to,
      BigInt(t.value || "0"),
      t.data || "0x"
    ]);
    let c = 0n;
    r && (c = await new P(n, K, this.provider).getNonce());
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
    const h = await this.signUserOperation(e, u);
    return u.signature = h, u;
  }
  /**
   * Build UserOperation for batch transactions
   */
  async buildBatchUserOperation(e, t, n = !1) {
    var v;
    const r = this.accountAddress || this.getAccountAddress(e.address);
    this.accountAddress = r;
    const s = await this.isDeployed(r), i = new _(K), c = t.map((m) => m.to), l = t.map((m) => BigInt(m.value || "0")), d = t.map((m) => m.data || "0x"), u = i.encodeFunctionData("executeBatch", [
      c,
      l,
      d
    ]);
    let h = 0n;
    s && (h = await new P(r, K, this.provider).getNonce());
    const f = s ? "0x" : this.buildInitCode(e.address), y = await this.provider.getFeeData(), A = {
      sender: r,
      nonce: h,
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
    if (n && ((v = this.paymasterConfig) != null && v.enabled)) {
      const m = await this.getPaymasterData(A);
      m && (A.paymasterAndData = m.paymasterAndData);
    }
    const g = await this.signUserOperation(e, A);
    return A.signature = g, A;
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
    const r = new _([
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
    return await e.signMessage(O(n));
  }
  /**
   * Get UserOperation hash
   */
  getUserOpHash(e) {
    var s;
    const t = this.packUserOp(e), n = C(t), r = ((s = this.provider._network) == null ? void 0 : s.chainId) || 1n;
    return C(
      U.encode(
        ["bytes32", "address", "uint256"],
        [n, this.config.entryPoint, r]
      )
    );
  }
  /**
   * Pack UserOperation for hashing
   */
  packUserOp(e) {
    return U.encode(
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
        C(e.initCode === "0x" ? new Uint8Array() : O(e.initCode)),
        C(e.callData === "0x" ? new Uint8Array() : O(e.callData)),
        e.callGasLimit,
        e.verificationGasLimit,
        e.preVerificationGas,
        e.maxFeePerGas,
        e.maxPriorityFeePerGas,
        C(
          e.paymasterAndData === "0x" ? new Uint8Array() : O(e.paymasterAndData)
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
      nonce: T(e.nonce),
      initCode: e.initCode,
      callData: e.callData,
      callGasLimit: T(e.callGasLimit),
      verificationGasLimit: T(e.verificationGasLimit),
      preVerificationGas: T(e.preVerificationGas),
      maxFeePerGas: T(e.maxFeePerGas),
      maxPriorityFeePerGas: T(e.maxPriorityFeePerGas),
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
    const n = "0x0000000000000000000000000000000000000000", r = new P(
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
class tt {
  constructor(e) {
    p(this, "webauthn");
    p(this, "storage");
    p(this, "keyManager");
    p(this, "cctpManager");
    p(this, "smartAccountManager", null);
    p(this, "provider");
    p(this, "eventListeners");
    p(this, "currentAccount", null);
    p(this, "accountType");
    this.webauthn = new Te({
      rpId: e.rpId,
      rpName: e.appName,
      backendUrl: e.backendUrl
    }), this.storage = new Oe(), this.keyManager = new Re(this.webauthn, this.storage), this.provider = new ee(e.rpcUrl), this.cctpManager = new Ge(this.provider, e.cctp), this.accountType = e.accountType || "eoa", this.accountType === "smart-account" && (this.smartAccountManager = new We(
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
class nt {
  constructor(e) {
    p(this, "config");
    p(this, "baseUrl");
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
const Le = 2, He = 2e3;
async function Z(a, e, t = Le) {
  let n = null;
  for (let r = 0; r <= t; r++)
    try {
      const s = new AbortController(), i = setTimeout(() => s.abort(), 3e4), c = await fetch(a, {
        ...e,
        signal: s.signal
      });
      return clearTimeout(i), c;
    } catch (s) {
      if (n = s, s.name === "AbortError" || r === t)
        break;
      const i = He * Math.pow(2, r);
      o.warn("Request failed, retrying...", {
        component: "PasskeyAccountManager",
        attempt: r + 1,
        maxRetries: t,
        delay: i,
        error: s.message
      }), await new Promise((c) => setTimeout(c, i));
    }
  throw n || new Error("Request failed after retries");
}
const H = (a) => Array.from(a).map((e) => e.toString(16).padStart(2, "0")).join(""), $e = (a) => {
  const e = a.startsWith("0x") ? a.slice(2) : a, t = new Uint8Array(e.length / 2);
  for (let n = 0; n < t.length; n++)
    t[n] = parseInt(e.substr(n * 2, 2), 16);
  return t;
}, Ve = (a) => new TextDecoder().decode(a), je = [
  "function getAddress(uint256 x, uint256 y, uint256 salt) view returns (address)",
  "function createAccount(uint256 x, uint256 y, uint256 salt) returns (address)"
], R = [
  "function execute(address target, uint256 value, bytes data) returns (bytes)",
  "function executeBatch(address[] dest, uint256[] value, bytes[] func)",
  "function validateUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingFunds) returns (uint256)",
  "function getUserOpNonce() view returns (uint256)",
  "function getOwnerPublicKey() view returns (uint256 x, uint256 y)"
];
class rt {
  constructor(e) {
    p(this, "provider");
    p(this, "factory");
    p(this, "config");
    p(this, "currentCredential", null);
    p(this, "accountAddress", null);
    this.config = e, this.provider = new ee(e.rpcUrl), this.factory = new P(e.factoryAddress, je, this.provider);
  }
  /**
   * Create new passkey and get account address
   */
  async createAccount(e, t) {
    var v, m;
    o.info("Creating passkey account", { component: "PasskeyAccountManager", userId: e });
    const n = await fetch(`${this.config.backendUrl}/passkeys/register/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: e, displayName: t })
    }), r = await n.json();
    if (!n.ok)
      throw r.code === "PASSKEY_ALREADY_EXISTS" ? new Error('You already have a passkey registered for this email. Please use "Connect with Passkey" instead of creating a new one. Creating a new passkey would generate a different wallet address.') : new Error(r.error || r.message || "Failed to get registration options");
    const s = ((v = r.data) == null ? void 0 : v.options) || r, i = await se({ optionsJSON: s }), c = await fetch(`${this.config.backendUrl}/passkeys/register/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: e, credential: i })
    });
    if (!c.ok)
      throw new Error("Failed to verify credential");
    const d = (m = (await c.json()).data) == null ? void 0 : m.publicKey;
    if (!(d != null && d.x) || !(d != null && d.y))
      throw new Error("Server did not return public key coordinates");
    const { x: u, y: h } = d, f = {
      credentialId: i.id,
      publicKeyX: u,
      publicKeyY: h,
      userId: e
    }, y = BigInt(C(new TextEncoder().encode(e))), g = await this.factory.getFunction("getAddress")(BigInt(u), BigInt(h), y);
    return this.currentCredential = f, this.accountAddress = g, this.storeCredential(f), o.info("Passkey account created", {
      component: "PasskeyAccountManager",
      address: g,
      credentialId: i.id.substring(0, 20) + "..."
    }), { address: g, credential: f };
  }
  /**
   * Connect with existing passkey
   * @param username Optional username/email to find specific credentials
   */
  async connect(e) {
    var g, v, m, w, E, k;
    o.info("Connecting with existing passkey", { component: "PasskeyAccountManager", username: e });
    const t = localStorage.getItem("arcwallet:passkey:current"), n = {};
    t ? (n.credentialId = t, o.info("Using stored credential ID for authentication", {
      component: "PasskeyAccountManager",
      credentialId: t.substring(0, 20) + "..."
    })) : e && (n.username = e);
    const r = await Z(`${this.config.backendUrl}/passkeys/auth/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(n)
    });
    if (!r.ok) {
      let b = `Status: ${r.status}`;
      try {
        const I = await r.json();
        b = I.error || I.message || b;
      } catch {
      }
      throw new Error(`Failed to get authentication options: ${b}`);
    }
    const s = await r.json(), i = ((g = s.data) == null ? void 0 : g.options) || s;
    t && (!i.allowCredentials || i.allowCredentials.length === 0) && (i.allowCredentials = [{
      id: t,
      type: "public-key",
      transports: ["internal", "hybrid"]
    }], o.info("Added stored credential to allowCredentials", {
      component: "PasskeyAccountManager",
      credentialId: t.substring(0, 20) + "..."
    }));
    const c = await V({ optionsJSON: i });
    let l = null;
    try {
      const b = await Z(`${this.config.backendUrl}/passkeys/auth/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential: c })
      });
      b.ok ? l = await b.json() : o.warn("Backend verification failed, will try localStorage fallback", {
        component: "PasskeyAccountManager",
        status: b.status
      });
    } catch {
      o.warn("Backend verification request failed, will try localStorage fallback", {
        component: "PasskeyAccountManager"
      });
    }
    const d = (v = l == null ? void 0 : l.data) == null ? void 0 : v.publicKey, u = ((w = (m = l == null ? void 0 : l.data) == null ? void 0 : m.user) == null ? void 0 : w.username) || ((k = (E = l == null ? void 0 : l.data) == null ? void 0 : E.user) == null ? void 0 : k.id);
    if (d != null && d.x && (d != null && d.y)) {
      const b = {
        credentialId: c.id,
        publicKeyX: d.x,
        publicKeyY: d.y,
        userId: u
      };
      this.currentCredential = b, this.storeCredential(b);
    } else {
      const b = this.loadCredential(c.id);
      if (b)
        o.info("Using localStorage credential (server did not have it)", {
          component: "PasskeyAccountManager",
          credentialId: c.id.substring(0, 20) + "..."
        }), this.currentCredential = b, this.syncCredentialToBackend(b).catch((I) => {
          o.warn("Failed to sync credential to backend (non-critical)", {
            component: "PasskeyAccountManager",
            error: I.message
          });
        });
      else {
        o.info("Attempting to recover credential from deployed contract...", {
          component: "PasskeyAccountManager"
        });
        const I = await this.recoverCredentialFromChain(c.id, e || "");
        if (I)
          this.currentCredential = I, this.storeCredential(I), o.info("Successfully recovered credential from deployed contract", {
            component: "PasskeyAccountManager",
            address: this.accountAddress
          });
        else
          throw new Error('Credential not found. Please use "Recover Wallet" option if you have a deployed wallet.');
      }
    }
    const h = BigInt(C(new TextEncoder().encode(this.currentCredential.userId))), y = await this.factory.getFunction("getAddress")(
      BigInt(this.currentCredential.publicKeyX),
      BigInt(this.currentCredential.publicKeyY),
      h
    );
    if (await this.provider.getCode(y) !== "0x")
      this.accountAddress = y, o.info("Connected with passkey - computed address is deployed", {
        component: "PasskeyAccountManager",
        address: this.accountAddress
      });
    else {
      const b = localStorage.getItem(`arcwallet:address:${this.currentCredential.userId}`);
      if (b && await this.provider.getCode(b) !== "0x")
        try {
          const N = new P(b, R, this.provider), [ie, ce] = await N.getOwnerPublicKey();
          if (ie.toString() === this.currentCredential.publicKeyX && ce.toString() === this.currentCredential.publicKeyY)
            return this.accountAddress = b, o.info("Connected with passkey - using stored deployed wallet", {
              component: "PasskeyAccountManager",
              address: this.accountAddress
            }), localStorage.setItem(`arcwallet:address:${this.currentCredential.userId}`, b), { address: this.accountAddress, credential: this.currentCredential };
        } catch (N) {
          o.warn("Failed to verify stored wallet", { component: "PasskeyAccountManager", error: N });
        }
      this.accountAddress = y, o.info("Connected with passkey - using counterfactual address", {
        component: "PasskeyAccountManager",
        address: this.accountAddress
      });
    }
    return this.accountAddress && localStorage.setItem(`arcwallet:address:${this.currentCredential.userId}`, this.accountAddress), { address: this.accountAddress, credential: this.currentCredential };
  }
  /**
   * Sign UserOperation with passkey
   */
  async signUserOperation(e, t) {
    var g;
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
    const r = await n.json(), s = ((g = r.data) == null ? void 0 : g.options) || r;
    s.challenge = this.toBase64Url(t);
    const i = await V({ optionsJSON: s }), { r: c, s: l, authenticatorData: d, clientDataJSON: u, challengeIndex: h, typeIndex: f } = await this.extractSignatureComponents(i), A = $.defaultAbiCoder().encode(
      ["bytes", "string", "uint256", "uint256", "uint256", "uint256"],
      [d, u, h, f, c, l]
    );
    return o.info("UserOperation signed", { component: "PasskeyAccountManager" }), A;
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
    const n = BigInt(t(new TextEncoder().encode(e.userId))), s = await this.factory.getFunction("getAddress")(
      BigInt(e.publicKeyX),
      BigInt(e.publicKeyY),
      n
    );
    if (await this.provider.getCode(s) !== "0x")
      this.accountAddress = s, o.info("Restored from credential - computed address is deployed", {
        component: "PasskeyAccountManager",
        address: this.accountAddress
      });
    else {
      const c = localStorage.getItem(`arcwallet:address:${e.userId}`);
      if (c && await this.provider.getCode(c) !== "0x")
        try {
          const d = new P(c, R, this.provider), [u, h] = await d.getOwnerPublicKey();
          if (u.toString() === e.publicKeyX && h.toString() === e.publicKeyY)
            return this.accountAddress = c, o.info("Restored from stored deployed wallet", {
              component: "PasskeyAccountManager",
              address: this.accountAddress
            }), this.accountAddress;
        } catch (d) {
          o.warn("Failed to verify stored wallet", { component: "PasskeyAccountManager", error: d });
        }
      this.accountAddress = s, o.info("Restored from credential - using counterfactual address", {
        component: "PasskeyAccountManager",
        address: this.accountAddress
      });
    }
    return this.accountAddress;
  }
  /**
   * Check if account is deployed
   */
  async isAccountDeployed() {
    return this.accountAddress ? await this.provider.getCode(this.accountAddress) !== "0x" : !1;
  }
  /**
   * Get account nonce from EntryPoint
   * IMPORTANT: Nonce must be retrieved from EntryPoint, not from smart wallet
   * Each EntryPoint tracks nonces independently
   */
  async getAccountNonce() {
    if (!this.accountAddress) throw new Error("No account connected");
    const e = [
      "function getNonce(address sender, uint192 key) view returns (uint256)"
    ], t = new P(this.config.entryPointAddress, e, this.provider);
    try {
      const n = await t.getNonce(this.accountAddress, 0);
      return o.info("Got nonce from EntryPoint", {
        component: "PasskeyAccountManager",
        nonce: n.toString(),
        entryPoint: this.config.entryPointAddress
      }), n;
    } catch {
      return o.warn("Failed to get nonce from EntryPoint, using 0", {
        component: "PasskeyAccountManager"
      }), 0n;
    }
  }
  /**
   * Build init code for account deployment
   */
  getInitCode() {
    if (!this.currentCredential) throw new Error("No credential connected");
    const e = BigInt(C(new TextEncoder().encode(this.currentCredential.userId))), t = this.factory.interface.encodeFunctionData("createAccount", [
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
    const r = await this.isAccountDeployed(), i = new P(this.accountAddress, R, this.provider).interface.encodeFunctionData("execute", [e, t, n]), c = await this.provider.getFeeData(), l = c.maxFeePerGas || c.gasPrice || 1000000000n, d = c.maxPriorityFeePerGas || 100000000n, u = await this.getAccountNonce(), h = r ? "0x" : this.getInitCode();
    let f = {
      preVerificationGas: 100000n,
      // Deployment needs ~1.4M for initCode + ~300K for P256 verify
      // EntryPoint reserves ~10%, so we need more buffer
      verificationGasLimit: r ? 500000n : 3000000n,
      // callGasLimit is for the actual execution AFTER verification
      // For deployment + transfer, we need enough for both
      callGasLimit: r ? 500000n : 1000000n
    };
    try {
      const m = this.config.bundlerUrl || this.config.rpcUrl, E = await (await fetch(m, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_estimateUserOperationGas",
          params: [{
            sender: this.accountAddress,
            nonce: "0x" + u.toString(16),
            initCode: h,
            callData: i,
            paymasterAndData: "0x"
          }, this.config.entryPointAddress],
          id: Date.now()
        })
      })).json();
      E.result && (f = {
        preVerificationGas: BigInt(E.result.preVerificationGas),
        verificationGasLimit: BigInt(E.result.verificationGasLimit),
        callGasLimit: BigInt(E.result.callGasLimit)
      }, o.info("Got gas estimates from bundler", {
        component: "PasskeyAccountManager",
        estimates: E.result
      }));
    } catch {
      o.warn("Could not get gas estimates from bundler, using defaults", {
        component: "PasskeyAccountManager"
      });
    }
    const y = {
      sender: this.accountAddress,
      nonce: u,
      initCode: h,
      callData: i,
      ...f,
      maxFeePerGas: l,
      maxPriorityFeePerGas: d,
      paymasterAndData: "0x"
      // No paymaster for now
    }, A = this.calculateUserOpHash(y), g = await this.signUserOperation(y, A), v = { ...y, signature: g };
    try {
      const m = await this.submitUserOperation(v);
      return { hash: m.hash, userOpHash: m.userOpHash };
    } catch (m) {
      o.error("Bundler submission failed", m instanceof Error ? m : void 0, {
        component: "PasskeyAccountManager",
        error: (m == null ? void 0 : m.message) || "Unknown error"
      });
      const w = (m == null ? void 0 : m.message) || "Bundler submission failed";
      throw new Error(`Transaction failed: ${w}`);
    }
  }
  /**
   * Execute multiple transactions in a single UserOperation (batch)
   * This allows approve + transfer in one passkey signature
   */
  async executeBatchTransaction(e) {
    if (!this.accountAddress)
      throw new Error("No account connected. Please connect first.");
    if (e.length === 0)
      throw new Error("No transactions provided");
    o.info("Executing batch transaction via passkey account", {
      component: "PasskeyAccountManager",
      count: e.length
    });
    const t = await this.isAccountDeployed(), n = new P(this.accountAddress, R, this.provider).interface, r = e.map((w) => w.to), s = e.map((w) => w.value), i = e.map((w) => w.data), c = n.encodeFunctionData("executeBatch", [r, s, i]), l = await this.provider.getFeeData(), d = l.maxFeePerGas || l.gasPrice || 1000000000n, u = l.maxPriorityFeePerGas || 100000000n, h = await this.getAccountNonce(), f = t ? "0x" : this.getInitCode();
    let y = {
      preVerificationGas: 150000n,
      verificationGasLimit: t ? 500000n : 3000000n,
      // More gas for batch execution
      callGasLimit: t ? 800000n : 1500000n
    };
    try {
      const w = this.config.bundlerUrl || this.config.rpcUrl, k = await (await fetch(w, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_estimateUserOperationGas",
          params: [{
            sender: this.accountAddress,
            nonce: "0x" + h.toString(16),
            initCode: f,
            callData: c,
            paymasterAndData: "0x"
          }, this.config.entryPointAddress],
          id: Date.now()
        })
      })).json();
      k.result && (y = {
        preVerificationGas: BigInt(k.result.preVerificationGas),
        verificationGasLimit: BigInt(k.result.verificationGasLimit),
        callGasLimit: BigInt(k.result.callGasLimit)
      }, o.info("Got batch gas estimates from bundler", {
        component: "PasskeyAccountManager",
        estimates: k.result
      }));
    } catch {
      o.warn("Could not get batch gas estimates from bundler, using defaults", {
        component: "PasskeyAccountManager"
      });
    }
    const A = {
      sender: this.accountAddress,
      nonce: h,
      initCode: f,
      callData: c,
      ...y,
      maxFeePerGas: d,
      maxPriorityFeePerGas: u,
      paymasterAndData: "0x"
    }, g = this.calculateUserOpHash(A), v = await this.signUserOperation(A, g), m = { ...A, signature: v };
    try {
      const w = await this.submitUserOperation(m);
      return { hash: w.hash, userOpHash: w.userOpHash };
    } catch (w) {
      o.error("Batch bundler submission failed", w instanceof Error ? w : void 0, {
        component: "PasskeyAccountManager",
        error: (w == null ? void 0 : w.message) || "Unknown error"
      });
      const E = (w == null ? void 0 : w.message) || "Bundler submission failed";
      throw new Error(`Batch transaction failed: ${E}`);
    }
  }
  /**
   * Calculate UserOperation hash for signing
   */
  calculateUserOpHash(e) {
    const t = $.defaultAbiCoder(), n = t.encode(
      ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [
        e.sender,
        e.nonce,
        C(e.initCode),
        C(e.callData),
        e.callGasLimit,
        e.verificationGasLimit,
        e.preVerificationGas,
        e.maxFeePerGas,
        e.maxPriorityFeePerGas,
        C(e.paymasterAndData)
      ]
    ), r = C(n), s = BigInt(this.config.chainId || 5042002), i = t.encode(
      ["bytes32", "address", "uint256"],
      [r, this.config.entryPointAddress, s]
    );
    return C(i);
  }
  /**
   * Submit UserOperation to Pimlico bundler
   */
  async submitUserOperation(e) {
    const t = this.config.bundlerUrl || this.config.rpcUrl, n = {
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
    o.info("Submitting UserOperation to bundler", {
      component: "PasskeyAccountManager",
      bundlerUrl: t.replace(/apikey=.*/, "apikey=***"),
      sender: e.sender
    });
    try {
      const s = await (await fetch(t, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_sendUserOperation",
          params: [n, this.config.entryPointAddress],
          id: Date.now()
        })
      })).json();
      if (s.error) {
        const l = s.error.data ? `${s.error.message}: ${s.error.data}` : s.error.message;
        throw o.error("Bundler rejected UserOperation", void 0, {
          component: "PasskeyAccountManager",
          error: s.error,
          errorCode: s.error.code,
          errorData: s.error.data
        }), new Error(l || "Bundler rejected UserOperation");
      }
      const i = s.result;
      return o.info("UserOperation submitted successfully", {
        component: "PasskeyAccountManager",
        userOpHash: i
      }), { hash: await this.waitForUserOperation(i, t), userOpHash: i };
    } catch (r) {
      throw o.error("Failed to submit UserOperation", r instanceof Error ? r : void 0, {
        component: "PasskeyAccountManager"
      }), r;
    }
  }
  /**
   * Wait for UserOperation to be included in a transaction
   */
  async waitForUserOperation(e, t, n = 12e4) {
    var l, d;
    const r = t || this.config.bundlerUrl || this.config.rpcUrl, s = Date.now();
    let i = 5e3;
    const c = 15e3;
    for (; Date.now() - s < n; ) {
      try {
        const u = await fetch(r, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getUserOperationReceipt",
            params: [e],
            id: Date.now()
          })
        });
        if (u.status === 429) {
          i = Math.min(i * 1.5, c), o.warn("Rate limited, backing off", {
            component: "PasskeyAccountManager",
            nextPollIn: i
          }), await new Promise((f) => setTimeout(f, i));
          continue;
        }
        const h = await u.json();
        if ((d = (l = h.result) == null ? void 0 : l.receipt) != null && d.transactionHash)
          return o.info("UserOperation confirmed", {
            component: "PasskeyAccountManager",
            txHash: h.result.receipt.transactionHash
          }), h.result.receipt.transactionHash;
      } catch {
      }
      await new Promise((u) => setTimeout(u, i));
    }
    return o.warn("UserOperation polling timeout, returning userOpHash", {
      component: "PasskeyAccountManager",
      userOpHash: e
    }), e;
  }
  // ============ Private Methods ============
  async extractSignatureComponents(e) {
    const t = "0x" + H(this.fromBase64Url(e.response.authenticatorData)), n = Ve(this.fromBase64Url(e.response.clientDataJSON)), r = n.indexOf('"challenge"'), s = n.indexOf('"type"'), i = this.fromBase64Url(e.response.signature), { r: c, s: l } = this.parseDERSignature(i);
    return {
      r: BigInt("0x" + H(c)),
      s: BigInt("0x" + H(l)),
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
    const t = $e(e);
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
  /**
   * Recover credential from deployed smart contract on chain
   * When localStorage and backend both lost the credential, but wallet is deployed,
   * we can read the public key directly from the smart contract
   */
  async recoverCredentialFromChain(e, t) {
    if (!t)
      return o.warn("Cannot recover from chain without userId", {
        component: "PasskeyAccountManager"
      }), null;
    try {
      const n = BigInt(C(new TextEncoder().encode(t))), r = [], s = localStorage.getItem(`arcwallet:address:${t}`);
      s && r.push(s);
      const i = [
        "0x72c90791145C55966903D661Fc286eBbbB47f151"
        // Founder wallet - sehereroglu786@gmail.com
      ];
      r.push(...i);
      for (const c of r)
        try {
          if (await this.provider.getCode(c) === "0x")
            continue;
          const d = new P(c, R, this.provider), [u, h] = await d.getOwnerPublicKey();
          if (o.info("Found public key on chain", {
            component: "PasskeyAccountManager",
            walletAddress: c,
            x: u.toString().substring(0, 20) + "...",
            y: h.toString().substring(0, 20) + "..."
          }), (await this.factory.getFunction("getAddress")(u, h, n)).toLowerCase() === c.toLowerCase()) {
            const A = {
              credentialId: e,
              publicKeyX: u.toString(),
              publicKeyY: h.toString(),
              userId: t
            };
            return this.accountAddress = c, localStorage.setItem(`arcwallet:address:${t}`, c), o.info("Successfully recovered credential from chain", {
              component: "PasskeyAccountManager",
              walletAddress: c,
              userId: t
            }), this.syncCredentialToBackend(A).catch((g) => {
              o.warn("Failed to sync recovered credential to backend", {
                component: "PasskeyAccountManager",
                error: g.message
              });
            }), A;
          }
        } catch (l) {
          o.warn("Error checking wallet address", {
            component: "PasskeyAccountManager",
            walletAddress: c,
            error: l instanceof Error ? l.message : "Unknown error"
          });
          continue;
        }
      return o.warn("Could not recover credential from any known address", {
        component: "PasskeyAccountManager",
        userId: t
      }), null;
    } catch (n) {
      return o.error("Failed to recover credential from chain", n instanceof Error ? n : void 0, {
        component: "PasskeyAccountManager"
      }), null;
    }
  }
  /**
   * Sync credential to backend for future protection
   * This registers the credential in backend DB so user can't accidentally create a new passkey
   */
  async syncCredentialToBackend(e) {
    var c;
    const t = BigInt(C(new TextEncoder().encode(e.userId))), r = await this.factory.getFunction("getAddress")(
      BigInt(e.publicKeyX),
      BigInt(e.publicKeyY),
      t
    );
    o.info("Syncing credential to backend", {
      component: "PasskeyAccountManager",
      credentialId: e.credentialId.substring(0, 20) + "...",
      email: e.userId
    });
    const s = await fetch(`${this.config.backendUrl}/passkeys/admin/register-credential`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        adminSecret: "arc-admin-2024-secret",
        // This is the default secret
        email: e.userId,
        credentialId: e.credentialId,
        publicKeyX: e.publicKeyX,
        publicKeyY: e.publicKeyY,
        walletAddress: r
      })
    });
    if (!s.ok) {
      const l = await s.json().catch(() => ({}));
      throw new Error(l.error || "Failed to sync credential");
    }
    const i = await s.json();
    o.info("Credential synced to backend", {
      component: "PasskeyAccountManager",
      result: (c = i.data) == null ? void 0 : c.message
    });
  }
}
const Je = "0x00000000";
async function at(a, e) {
  try {
    return await e.getCode(a) === "0x" ? !1 : await new P(a, [
      "function supportsInterface(bytes4) view returns (bool)"
    ], e).supportsInterface(Je);
  } catch {
    return !1;
  }
}
const st = "1.0.0";
export {
  Ge as CCTPManager,
  Y as CIRCLE_NETWORKS,
  nt as CircleApiClient,
  Be as CirclePaymasterClient,
  _e as DEFAULT_AA_CONFIG,
  Ue as DEFAULT_CCTP_CONFIG,
  Re as KeyManager,
  Ce as LogLevel,
  M as PASSKEY_DIAGNOSTIC_MESSAGES,
  rt as PasskeyAccountManager,
  Qe as PasskeyDiagnosticError,
  Oe as SecureStorage,
  We as SmartAccountManager,
  st as VERSION,
  tt as WalletSDK,
  Te as WebAuthnManager,
  ke as checkPlatformAuthenticatorSupport,
  qe as createLogger,
  Q as getCCTPConfigErrorMessage,
  Fe as getCircleNetwork,
  ve as getDeviceRiskLevel,
  Ie as getDiagnosticErrorMessage,
  Ee as getPasskeyDiagnosticMode,
  et as isArcNetworkConfigured,
  Ne as isCCTPSupported,
  at as isCircleMSCA,
  Pe as isHighRiskDevice,
  Ze as isNativeUSDC,
  o as logger,
  De as runPasskeyDiagnostic,
  j as validateCCTPConfig
};
//# sourceMappingURL=index.mjs.map
