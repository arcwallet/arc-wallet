var Q = Object.defineProperty;
var Z = (r, e, t) => e in r ? Q(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var u = (r, e, t) => Z(r, typeof e != "symbol" ? e + "" : e, t);
import { Wallet as B, parseUnits as ee, Contract as E, keccak256 as b, getBytes as D, formatUnits as te, AbiCoder as ne, Interface as U, toBeHex as S, JsonRpcProvider as re } from "ethers";
import { set as x, get as I, del as ae, clear as se } from "idb-keyval";
function C(r) {
  const e = new Uint8Array(r);
  let t = "";
  for (const a of e)
    t += String.fromCharCode(a);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function O(r) {
  const e = r.replace(/-/g, "+").replace(/_/g, "/"), t = (4 - e.length % 4) % 4, n = e.padEnd(e.length + t, "="), a = atob(n), s = new ArrayBuffer(a.length), i = new Uint8Array(s);
  for (let c = 0; c < a.length; c++)
    i[c] = a.charCodeAt(c);
  return s;
}
function W() {
  return ie.stubThis((globalThis == null ? void 0 : globalThis.PublicKeyCredential) !== void 0 && typeof globalThis.PublicKeyCredential == "function");
}
const ie = {
  stubThis: (r) => r
};
function j(r) {
  const { id: e } = r;
  return {
    ...r,
    id: O(e),
    /**
     * `descriptor.transports` is an array of our `AuthenticatorTransportFuture` that includes newer
     * transports that TypeScript's DOM lib is ignorant of. Convince TS that our list of transports
     * are fine to pass to WebAuthn since browsers will recognize the new value.
     */
    transports: r.transports
  };
}
function J(r) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    r === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(r)
  );
}
class m extends Error {
  constructor({ message: e, code: t, cause: n, name: a }) {
    super(e, { cause: n }), Object.defineProperty(this, "code", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.name = a ?? n.name, this.code = t;
  }
}
function oe({ error: r, options: e }) {
  var n, a, s;
  const { publicKey: t } = e;
  if (!t)
    throw Error("options was missing required publicKey property");
  if (r.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new m({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: r
      });
  } else if (r.name === "ConstraintError") {
    if (((n = t.authenticatorSelection) == null ? void 0 : n.requireResidentKey) === !0)
      return new m({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: r
      });
    if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      e.mediation === "conditional" && ((a = t.authenticatorSelection) == null ? void 0 : a.userVerification) === "required"
    )
      return new m({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: r
      });
    if (((s = t.authenticatorSelection) == null ? void 0 : s.userVerification) === "required")
      return new m({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: r
      });
  } else {
    if (r.name === "InvalidStateError")
      return new m({
        message: "The authenticator was previously registered",
        code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
        cause: r
      });
    if (r.name === "NotAllowedError")
      return new m({
        message: r.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: r
      });
    if (r.name === "NotSupportedError")
      return t.pubKeyCredParams.filter((c) => c.type === "public-key").length === 0 ? new m({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: r
      }) : new m({
        message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
        code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
        cause: r
      });
    if (r.name === "SecurityError") {
      const i = globalThis.location.hostname;
      if (J(i)) {
        if (t.rp.id !== i)
          return new m({
            message: `The RP ID "${t.rp.id}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: r
          });
      } else return new m({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: r
      });
    } else if (r.name === "TypeError") {
      if (t.user.id.byteLength < 1 || t.user.id.byteLength > 64)
        return new m({
          message: "User ID was not between 1 and 64 characters",
          code: "ERROR_INVALID_USER_ID_LENGTH",
          cause: r
        });
    } else if (r.name === "UnknownError")
      return new m({
        message: "The authenticator was unable to process the specified options, or could not create a new credential",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: r
      });
  }
  return r;
}
class ce {
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
const Y = new ce(), le = ["cross-platform", "platform"];
function q(r) {
  if (r && !(le.indexOf(r) < 0))
    return r;
}
async function de(r) {
  var w;
  !r.optionsJSON && r.challenge && (console.warn("startRegistration() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."), r = { optionsJSON: r });
  const { optionsJSON: e, useAutoRegister: t = !1 } = r;
  if (!W())
    throw new Error("WebAuthn is not supported in this browser");
  const n = {
    ...e,
    challenge: O(e.challenge),
    user: {
      ...e.user,
      id: O(e.user.id)
    },
    excludeCredentials: (w = e.excludeCredentials) == null ? void 0 : w.map(j)
  }, a = {};
  t && (a.mediation = "conditional"), a.publicKey = n, a.signal = Y.createNewAbortSignal();
  let s;
  try {
    s = await navigator.credentials.create(a);
  } catch (g) {
    throw oe({ error: g, options: a });
  }
  if (!s)
    throw new Error("Registration was not completed");
  const { id: i, rawId: c, response: d, type: l } = s;
  let h;
  typeof d.getTransports == "function" && (h = d.getTransports());
  let y;
  if (typeof d.getPublicKeyAlgorithm == "function")
    try {
      y = d.getPublicKeyAlgorithm();
    } catch (g) {
      _("getPublicKeyAlgorithm()", g);
    }
  let f;
  if (typeof d.getPublicKey == "function")
    try {
      const g = d.getPublicKey();
      g !== null && (f = C(g));
    } catch (g) {
      _("getPublicKey()", g);
    }
  let p;
  if (typeof d.getAuthenticatorData == "function")
    try {
      p = C(d.getAuthenticatorData());
    } catch (g) {
      _("getAuthenticatorData()", g);
    }
  return {
    id: i,
    rawId: C(c),
    response: {
      attestationObject: C(d.attestationObject),
      clientDataJSON: C(d.clientDataJSON),
      transports: h,
      publicKeyAlgorithm: y,
      publicKey: f,
      authenticatorData: p
    },
    type: l,
    clientExtensionResults: s.getClientExtensionResults(),
    authenticatorAttachment: q(s.authenticatorAttachment)
  };
}
function _(r, e) {
  console.warn(`The browser extension that intercepted this WebAuthn API call incorrectly implemented ${r}. You should report this error to them.
`, e);
}
function ue() {
  if (!W())
    return N.stubThis(new Promise((e) => e(!1)));
  const r = globalThis.PublicKeyCredential;
  return (r == null ? void 0 : r.isConditionalMediationAvailable) === void 0 ? N.stubThis(new Promise((e) => e(!1))) : N.stubThis(r.isConditionalMediationAvailable());
}
const N = {
  stubThis: (r) => r
};
function he({ error: r, options: e }) {
  const { publicKey: t } = e;
  if (!t)
    throw Error("options was missing required publicKey property");
  if (r.name === "AbortError") {
    if (e.signal instanceof AbortSignal)
      return new m({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: r
      });
  } else {
    if (r.name === "NotAllowedError")
      return new m({
        message: r.message,
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: r
      });
    if (r.name === "SecurityError") {
      const n = globalThis.location.hostname;
      if (J(n)) {
        if (t.rpId !== n)
          return new m({
            message: `The RP ID "${t.rpId}" is invalid for this domain`,
            code: "ERROR_INVALID_RP_ID",
            cause: r
          });
      } else return new m({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: r
      });
    } else if (r.name === "UnknownError")
      return new m({
        message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
        code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
        cause: r
      });
  }
  return r;
}
async function pe(r) {
  var p, w;
  !r.optionsJSON && r.challenge && (console.warn("startAuthentication() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."), r = { optionsJSON: r });
  const { optionsJSON: e, useBrowserAutofill: t = !1, verifyBrowserAutofillInput: n = !0 } = r;
  if (!W())
    throw new Error("WebAuthn is not supported in this browser");
  let a;
  ((p = e.allowCredentials) == null ? void 0 : p.length) !== 0 && (a = (w = e.allowCredentials) == null ? void 0 : w.map(j));
  const s = {
    ...e,
    challenge: O(e.challenge),
    allowCredentials: a
  }, i = {};
  if (t) {
    if (!await ue())
      throw Error("Browser does not support WebAuthn autofill");
    if (document.querySelectorAll("input[autocomplete$='webauthn']").length < 1 && n)
      throw Error('No <input> with "webauthn" as the only or last value in its `autocomplete` attribute was detected');
    i.mediation = "conditional", s.allowCredentials = [];
  }
  i.publicKey = s, i.signal = Y.createNewAbortSignal();
  let c;
  try {
    c = await navigator.credentials.get(i);
  } catch (g) {
    throw he({ error: g, options: i });
  }
  if (!c)
    throw new Error("Authentication was not completed");
  const { id: d, rawId: l, response: h, type: y } = c;
  let f;
  return h.userHandle && (f = C(h.userHandle)), {
    id: d,
    rawId: C(l),
    response: {
      authenticatorData: C(h.authenticatorData),
      clientDataJSON: C(h.clientDataJSON),
      signature: C(h.signature),
      userHandle: f
    },
    type: y,
    clientExtensionResults: c.getClientExtensionResults(),
    authenticatorAttachment: q(c.authenticatorAttachment)
  };
}
var ye = /* @__PURE__ */ ((r) => (r[r.DEBUG = 0] = "DEBUG", r[r.INFO = 1] = "INFO", r[r.WARN = 2] = "WARN", r[r.ERROR = 3] = "ERROR", r[r.SILENT = 4] = "SILENT", r))(ye || {});
class X {
  constructor(e) {
    u(this, "config");
    u(this, "sentryInitialized", !1);
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
    const a = (/* @__PURE__ */ new Date()).toISOString(), s = (n == null ? void 0 : n.component) || "SDK";
    return `[${a}] [${e}] [${s}] ${t}`;
  }
  sanitizeContext(e) {
    if (!e) return;
    const t = { ...e };
    return ["privateKey", "mnemonic", "seed", "password", "secret"].forEach((a) => {
      a in t && delete t[a];
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
    this.config.enableConsole && console.warn(this.formatMessage("WARN", e, n), n || ""), this.config.enableSentry && this.sentryInitialized && import("@sentry/browser").then((a) => {
      a.captureMessage(e, {
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
    const a = this.sanitizeContext(n);
    this.config.enableConsole && console.error(this.formatMessage("ERROR", e, a), t || "", a || ""), this.config.enableSentry && this.sentryInitialized && import("@sentry/browser").then((s) => {
      t ? s.captureException(t, {
        extra: { message: e, ...a }
      }) : s.captureMessage(e, {
        level: "error",
        extra: a
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
const o = new X({
  level: process.env.NODE_ENV === "production" ? 2 : 0,
  enableConsole: !0,
  enableSentry: process.env.NODE_ENV === "production",
  sentryDsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development"
});
function Fe(r) {
  return new X(r);
}
class We extends Error {
  constructor(t, n) {
    super(t);
    u(this, "cause");
    this.name = "PasskeyDiagnosticError", n != null && n.cause && (this.cause = n.cause);
  }
}
const fe = [
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
function ge() {
  var e;
  if (typeof window > "u") return "disabled";
  const r = ((e = process.env.PASSKEY_DIAGNOSTIC_MODE) == null ? void 0 : e.toLowerCase()) || "high-risk";
  return r === "always" ? "always" : r === "disabled" ? "disabled" : "high-risk";
}
function me() {
  var n, a;
  if (typeof window > "u" || typeof navigator > "u")
    return !1;
  const r = navigator.userAgent.toLowerCase(), e = ((n = navigator.vendor) == null ? void 0 : n.toLowerCase()) || "", t = ((a = navigator.platform) == null ? void 0 : a.toLowerCase()) || "";
  return fe.some((s) => r.includes(s) || e.includes(s) || t.includes(s));
}
function we() {
  if (me())
    return "high";
  if (typeof navigator < "u") {
    const e = navigator.userAgent.match(/OS (\d+)_/);
    if (e && parseInt(e[1]) < 16)
      return "medium";
  }
  return "low";
}
async function Ae() {
  if (typeof window > "u" || !window.PublicKeyCredential)
    return !1;
  try {
    const r = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return o.debug("Platform authenticator check", {
      component: "PasskeyDiagnostic",
      available: r
    }), r;
  } catch (r) {
    return o.warn("Failed to check platform authenticator", {
      component: "PasskeyDiagnostic",
      error: r instanceof Error ? r.message : String(r)
    }), !1;
  }
}
async function be(r = "high-risk") {
  if (r === "disabled")
    return { success: !0, deviceRisk: "low", platformSupport: !0 };
  const e = we(), t = await Ae();
  if (o.info("Running passkey diagnostic", {
    component: "PasskeyDiagnostic",
    mode: r,
    deviceRisk: e,
    platformSupport: t
  }), r === "always") {
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
  return r === "high-risk" && e === "high" ? (o.warn("High-risk device detected", {
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
function Ce(r) {
  return r.success && !r.errorMessage ? null : r.errorMessage ? r.errorMessage : r.platformSupport ? r.deviceRisk === "high" ? T.HIGH_RISK_DEVICE : T.DIAGNOSTIC_FAILED : T.NO_PLATFORM_SUPPORT;
}
class Ee {
  constructor(e) {
    u(this, "backendUrl");
    if (this.backendUrl = e.backendUrl || "http://localhost:4000", !this.isSupported())
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
    var n, a;
    try {
      o.info("Starting passkey registration", {
        component: "WebAuthn",
        action: "createPasskey",
        userId: e
      });
      const s = ge(), i = await be(s), c = Ce(i);
      c && o.warn("Passkey diagnostic warning", {
        component: "WebAuthn",
        deviceRisk: i.deviceRisk,
        platformSupport: i.platformSupport,
        message: c
      });
      const d = await fetch(`${this.backendUrl}/passkeys/register/start`, {
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
      if (!d.ok)
        throw new Error("Failed to get registration options");
      const l = await d.json(), h = ((n = l.data) == null ? void 0 : n.options) || l;
      o.debug("Received registration options from backend", {
        component: "WebAuthn",
        challenge: ((a = h.challenge) == null ? void 0 : a.substring(0, 20)) + "..."
      });
      const y = await de({ optionsJSON: h });
      o.debug("Credential created successfully", {
        component: "WebAuthn",
        credentialId: y.id.substring(0, 20) + "..."
      });
      const f = await fetch(`${this.backendUrl}/passkeys/register/finish`, {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          username: e,
          // Backend expects 'username' not 'userId'
          credential: y
        })
      });
      if (!f.ok) {
        const w = await f.json().catch(() => ({}));
        throw new Error(w.message || "Failed to verify credential");
      }
      const p = await f.json();
      return o.info("Passkey registered successfully", {
        component: "WebAuthn",
        credentialId: y.id.substring(0, 20) + "..."
      }), {
        id: y.id,
        publicKey: p.publicKey || y.id,
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
      const a = await fetch(`${this.backendUrl}/passkeys/auth/start`, {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify({ credentialId: e })
      });
      if (!a.ok)
        throw new Error("Failed to get authentication options");
      const s = await a.json(), i = ((t = s.data) == null ? void 0 : t.options) || s;
      o.debug("Received authentication options from backend", {
        component: "WebAuthn",
        challenge: ((n = i.challenge) == null ? void 0 : n.substring(0, 20)) + "..."
      });
      const c = await pe({ optionsJSON: i });
      o.debug("Authentication response received", {
        component: "WebAuthn",
        credentialId: c.id.substring(0, 20) + "..."
      });
      const d = await fetch(`${this.backendUrl}/passkeys/auth/finish`, {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          credential: c
        })
      });
      if (!d.ok) {
        const h = await d.json().catch(() => ({}));
        throw new Error(h.message || "Failed to verify authentication");
      }
      const l = await d.json();
      return o.info("Authentication successful", {
        component: "WebAuthn",
        credentialId: c.id.substring(0, 20) + "..."
      }), {
        success: !0,
        credentialId: c.id,
        userId: l.userId
        // Authenticator data is handled by backend
      };
    } catch (a) {
      if (o.error("Authentication failed", a, {
        component: "WebAuthn",
        action: "authenticate"
      }), a.name === "NotAllowedError")
        throw new Error(
          "Authentication was cancelled. Please try again and verify your identity when prompted."
        );
      if (a.name === "InvalidStateError")
        throw new Error(
          "No passkey found for this wallet. Please create a new wallet or use a different device."
        );
      return {
        success: !1,
        credentialId: "",
        userId: "",
        error: a.message
      };
    }
  }
}
class Se {
  constructor() {
    u(this, "ALGORITHM", "AES-GCM");
    u(this, "KEY_LENGTH", 256);
    u(this, "IV_LENGTH", 12);
    u(this, "SALT_LENGTH", 16);
  }
  /**
   * Derive encryption key from passkey credential
   */
  async deriveEncryptionKey(e, t) {
    const n = new TextEncoder(), a = await crypto.subtle.importKey(
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
      a,
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
      const a = await this.encrypt(t, n);
      await x(`wallet_key_${e}`, a), o.info("Private key encrypted and stored", { component: "SecureStorage" });
    } catch (a) {
      throw o.error("Failed to store key", a instanceof Error ? a : void 0, { component: "SecureStorage" }), new Error("Failed to store private key securely");
    }
  }
  /**
   * Store WebCrypto encrypted data (new format)
   */
  async storeWebCryptoData(e, t) {
    await x(`wallet:${e}`, t);
  }
  /**
   * Retrieve and decrypt private key
   */
  async getKey(e, t) {
    try {
      const n = await I(`wallet_key_${e}`);
      return n ? await this.decrypt(n, t) : null;
    } catch (n) {
      return o.error("Failed to retrieve key", n instanceof Error ? n : void 0, { component: "SecureStorage" }), null;
    }
  }
  /**
   * Delete stored key
   */
  async deleteKey(e) {
    await ae(`wallet_key_${e}`);
  }
  /**
   * Clear all stored keys
   */
  async clearAll() {
    await se();
  }
  /**
   * Encrypt data using AES-GCM
   */
  async encrypt(e, t) {
    const a = new TextEncoder().encode(e), s = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH)), i = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    return {
      ciphertext: await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: s
        },
        t,
        a
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
    return await I(`wallet:${e}`);
  }
  /**
   * Store metadata
   */
  async storeMetadata(e, t) {
    await x(`wallet:${e}:metadata`, t);
  }
  /**
   * Get wallet metadata
   */
  async getMetadata(e) {
    return await I(`wallet_meta_${e}`);
  }
  /**
   * Check if key exists
   */
  async hasKey(e) {
    return await I(`wallet_key_${e}`) !== void 0;
  }
}
class De {
  constructor() {
    u(this, "masterKey", null);
    u(this, "keyId", null);
  }
  /**
   * Generate non-extractable master key
   */
  async generateMasterKey(e) {
    try {
      console.log("[WebCrypto] Generating non-extractable master key..."), this.masterKey = await crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256
        },
        !1,
        // NON-EXTRACTABLE - Key cannot be exported!
        ["encrypt", "decrypt"]
      ), this.keyId = e, console.log("[WebCrypto] Master key generated (non-extractable)");
    } catch (t) {
      throw console.error("[WebCrypto] Master key generation failed:", t), new Error(`Failed to generate master key: ${t.message}`);
    }
  }
  /**
   * Encrypt data with non-extractable master key
   */
  async encrypt(e) {
    if (!this.masterKey)
      throw new Error("Master key not initialized");
    try {
      const t = crypto.getRandomValues(new Uint8Array(12)), n = new TextEncoder().encode(e), a = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: t
        },
        this.masterKey,
        n
      );
      return {
        encrypted: new Uint8Array(a),
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
    const a = await this.deriveKeyFromPasskey(t, n), s = crypto.getRandomValues(new Uint8Array(12)), i = new TextEncoder().encode(e), c = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: s
      },
      a,
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
  async decryptWithDerivedKey(e, t, n, a) {
    const s = await this.deriveKeyFromPasskey(n, a), i = await crypto.subtle.decrypt(
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
class Te {
  constructor(e, t) {
    u(this, "webauthn");
    u(this, "storage");
    u(this, "webCrypto");
    u(this, "currentWallet", null);
    u(this, "currentCredentialId", null);
    this.webauthn = e, this.storage = t, this.webCrypto = new De();
  }
  /**
   * Create new wallet with passkey
   */
  async createWallet(e, t) {
    try {
      o.info("Creating new wallet with passkey", { component: "KeyManager", action: "createWallet" });
      const n = await this.webauthn.createPasskey(e, t);
      await this.webCrypto.generateMasterKey(n.id), o.info("WebCrypto master key generated (non-extractable)", { component: "KeyManager" });
      const a = B.createRandom(), s = a.privateKey, i = a.address;
      o.info("Wallet created", { component: "KeyManager", address: i });
      const { encrypted: c, iv: d } = await this.webCrypto.encrypt(s);
      return await this.storage.storeWebCryptoData(n.id, {
        encrypted: Array.from(c),
        iv: Array.from(d),
        address: i,
        keyType: "webcrypto-master"
        // Mark as WebCrypto protected
      }), await this.storage.storeMetadata(n.id, {
        address: i,
        publicKey: n.publicKey,
        userId: e,
        createdAt: n.createdAt.toISOString(),
        keyType: "webcrypto-master"
      }), console.log("[KeyManager] Wallet secured with WebCrypto non-extractable master key"), this.currentWallet = a, this.currentCredentialId = n.id, {
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
      const n = t.credentialId, a = await this.storage.getMetadata(n);
      if (!a)
        throw new Error("Wallet metadata not found");
      const s = await this.storage.getKeyData(n);
      if (!s)
        throw new Error("Wallet key data not found");
      let i;
      if (s.keyType === "webcrypto-master") {
        console.log("[KeyManager] Using WebCrypto master key for decryption"), await this.webCrypto.generateMasterKey(n);
        const d = new Uint8Array(s.encrypted), l = new Uint8Array(s.iv);
        i = await this.webCrypto.decrypt(d, l);
      } else {
        console.log("[KeyManager] Using legacy decryption method");
        const d = new Uint8Array(a.salt || []), l = await this.storage.deriveEncryptionKey(
          n,
          d
        ), h = await this.storage.getKey(n, l);
        if (!h)
          throw new Error("Failed to decrypt private key");
        i = h;
      }
      if (!i)
        throw new Error("Failed to decrypt private key");
      const c = new B(i);
      if (c.address.toLowerCase() !== a.address.toLowerCase())
        throw new Error("Address mismatch - wallet may be corrupted");
      return o.info("Wallet unlocked", { component: "KeyManager", address: c.address }), this.currentWallet = c, this.currentCredentialId = n, {
        address: c.address,
        credentialId: n,
        publicKey: a.publicKey
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
   * Get all wallet metadata (without private keys)
   */
  async getAllWallets() {
    return [];
  }
}
const ve = {
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
}, Pe = [
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
], H = [
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
], G = {
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
function Ie(r) {
  return G[r];
}
function ke(r) {
  var e;
  return ((e = G[r]) == null ? void 0 : e.cctpSupported) ?? !1;
}
function Ge(r) {
  var e;
  return ((e = G[r]) == null ? void 0 : e.nativeUSDC) ?? !1;
}
const $ = "0x0000000000000000000000000000000000000000", V = /^0x\.\.\.$/;
function F(r, e) {
  var i, c, d;
  const t = {
    isValid: !0,
    errors: [],
    warnings: []
  };
  if (!ke(e)) {
    const l = Ie(e), h = l ? l.name : `Chain ID ${e}`;
    return t.errors.push(`${h} does not support Circle CCTP`), t.isValid = !1, t;
  }
  const n = (i = r.tokenMessengerAddresses) == null ? void 0 : i[e], a = (c = r.usdcAddresses) == null ? void 0 : c[e], s = (d = r.domainIds) == null ? void 0 : d[e];
  return n || (t.errors.push(
    `TokenMessenger address not configured for chain ID ${e}`
  ), t.isValid = !1), a || (t.errors.push(`USDC address not configured for chain ID ${e}`), t.isValid = !1), s === void 0 && (t.errors.push(`Domain ID not configured for chain ID ${e}`), t.isValid = !1), e === 412346 && ((n === $ || V.test(n || "")) && (t.warnings.push(
    "⚠️  Arc Network TokenMessenger address is a PLACEHOLDER. Cross-chain transfers will FAIL. Please obtain the correct address from the Arc Network team."
  ), t.isValid = !1), (a === $ || V.test(a || "")) && (t.warnings.push(
    "⚠️  Arc Network USDC address is a PLACEHOLDER. Cross-chain transfers will FAIL. Please obtain the correct address from the Arc Network team."
  ), t.isValid = !1), s === 7 && t.warnings.push(
    "ℹ️  Arc Network domain ID (7) should be verified with Circle team. Incorrect domain ID will cause transfer failures."
  )), t.warnings.length > 0 && t.warnings.forEach((l) => {
    o.warn(l, {
      component: "CCTPValidator",
      chainId: e
    });
  }), t.errors.length > 0 && t.errors.forEach((l) => {
    o.error(l, void 0, {
      component: "CCTPValidator",
      chainId: e
    });
  }), t;
}
function Le(r) {
  const e = F(r, 412346);
  return e.isValid && e.warnings.length === 0;
}
function z(r) {
  return r === 412346 ? `Arc Network CCTP is not properly configured. Please update the following in your WalletSDK config:

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
\`\`\`` : `CCTP configuration missing for chain ID ${r}`;
}
class Re {
  constructor(e, t) {
    u(this, "config");
    u(this, "provider");
    this.provider = e, this.config = { ...ve, ...t };
  }
  /**
   * Transfer USDC cross-chain using CCTP
   */
  async transferUSDC(e, t) {
    const { amount: n, destinationAddress: a, destinationChainId: s } = t, i = await e.provider.getNetwork().then((l) => Number(l.chainId)), c = F(this.config, i);
    if (!c.isValid) {
      const l = z(i);
      throw o.error("CCTP configuration invalid for source chain", void 0, {
        component: "CCTPManager",
        chainId: i,
        errors: c.errors
      }), new Error(l);
    }
    const d = F(this.config, s);
    if (!d.isValid) {
      const l = z(s);
      throw o.error("CCTP configuration invalid for destination chain", void 0, {
        component: "CCTPManager",
        chainId: s,
        errors: d.errors
      }), new Error(l);
    }
    try {
      console.log("[CCTP] Starting cross-chain USDC transfer:", {
        from: i,
        to: s,
        amount: n
      });
      const l = this.config.tokenMessengerAddresses[i], h = this.config.usdcAddresses[i], y = this.config.domainIds[s];
      if (!l || !h || y === void 0)
        throw new Error(`CCTP not supported for chain ${i}`);
      const f = ee(n, 6), p = new E(h, H, e);
      await p.allowance(e.address, l) < f && (console.log("[CCTP] Approving USDC..."), await (await p.approve(
        l,
        f
      )).wait(), console.log("[CCTP] USDC approved"));
      const g = this.addressToBytes32(a);
      console.log("[CCTP] Calling depositForBurn...");
      const K = await (await new E(
        l,
        Pe,
        e
      ).depositForBurn(
        f,
        y,
        g,
        h
      )).wait();
      console.log("[CCTP] Burn transaction confirmed:", K.hash);
      const L = this.extractMessageHash(K), v = {
        sourceTxHash: K.hash,
        messageHash: L,
        status: "pending"
      };
      return this.pollForAttestation(L).then((P) => {
        v.attestation = P, v.status = "attested", console.log("[CCTP] Attestation received");
      }).catch((P) => {
        console.error("[CCTP] Attestation failed:", P), v.status = "failed";
      }), v;
    } catch (l) {
      throw console.error("[CCTP] Transfer failed:", l), new Error(`CCTP transfer failed: ${l.message}`);
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
      const a = await n.json();
      if (a.status !== "complete")
        throw new Error("Attestation not complete");
      return a.attestation;
    } catch (n) {
      throw new Error(`Failed to get attestation: ${n.message}`);
    }
  }
  /**
   * Poll for attestation with retries
   */
  async pollForAttestation(e, t = 60, n = 5e3) {
    for (let a = 0; a < t; a++)
      try {
        return await this.getAttestation(e);
      } catch (s) {
        if (a === t - 1)
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
    const t = b(
      D(
        "MessageSent(bytes)"
      )
    ), n = e.logs.find((s) => s.topics[0] === t);
    if (!n)
      throw new Error("MessageSent event not found in transaction");
    const a = n.data;
    return b(a);
  }
  /**
   * Get USDC balance
   */
  async getUSDCBalance(e, t) {
    const n = t || Number((await this.provider.getNetwork()).chainId), a = this.config.usdcAddresses[n];
    if (!a)
      throw new Error(`USDC not supported on chain ${n}`);
    const i = await new E(a, H, this.provider).balanceOf(e);
    return te(i, 6);
  }
}
const Oe = {
  entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  // v0.6
  bundlerUrl: "",
  // Must be provided
  factoryAddress: "",
  // Must be provided
  accountImplementation: ""
  // Must be provided
};
class Me {
  constructor(e) {
    u(this, "config");
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
const k = new ne(), R = [
  "function execute(address dest, uint256 value, bytes calldata func)",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func)",
  "function getNonce() view returns (uint256)"
];
class Ke {
  constructor(e, t, n) {
    u(this, "config");
    u(this, "provider");
    u(this, "paymasterConfig");
    u(this, "circlePaymaster");
    u(this, "accountAddress", null);
    this.provider = e, this.config = { ...Oe, ...t }, this.paymasterConfig = n, (n == null ? void 0 : n.type) === "circle" && n.chainId && (this.circlePaymaster = new Me({
      paymasterUrl: n.url,
      chainId: n.chainId,
      bundlerUrl: t == null ? void 0 : t.bundlerUrl
    }));
  }
  /**
   * Get counterfactual Smart Account address
   */
  getAccountAddress(e) {
    const t = b(D(e)), n = b(
      k.encode(
        ["address", "address"],
        [this.config.accountImplementation, e]
      )
    );
    return "0x" + b(
      k.encode(
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
    const a = await this.isDeployed(n), i = new U(R).encodeFunctionData("execute", [
      t.to,
      BigInt(t.value || "0"),
      t.data || "0x"
    ]);
    let c = 0n;
    a && (c = await new E(n, R, this.provider).getNonce());
    const d = a ? "0x" : this.buildInitCode(e.address), l = await this.provider.getFeeData(), h = {
      sender: n,
      nonce: c,
      initCode: d,
      callData: i,
      callGasLimit: 100000n,
      // Estimate
      verificationGasLimit: 200000n,
      preVerificationGas: 50000n,
      maxFeePerGas: l.maxFeePerGas || 0n,
      maxPriorityFeePerGas: l.maxPriorityFeePerGas || 0n,
      paymasterAndData: "0x",
      signature: "0x"
    };
    if (t.sponsored && ((f = this.paymasterConfig) != null && f.enabled)) {
      const p = await this.getPaymasterData(h);
      p && (h.paymasterAndData = p.paymasterAndData, p.callGasLimit && (h.callGasLimit = p.callGasLimit), p.verificationGasLimit && (h.verificationGasLimit = p.verificationGasLimit), p.preVerificationGas && (h.preVerificationGas = p.preVerificationGas));
    }
    const y = await this.signUserOperation(e, h);
    return h.signature = y, h;
  }
  /**
   * Build UserOperation for batch transactions
   */
  async buildBatchUserOperation(e, t, n = !1) {
    var M;
    const a = this.accountAddress || this.getAccountAddress(e.address);
    this.accountAddress = a;
    const s = await this.isDeployed(a), i = new U(R), c = t.map((A) => A.to), d = t.map((A) => BigInt(A.value || "0")), l = t.map((A) => A.data || "0x"), h = i.encodeFunctionData("executeBatch", [
      c,
      d,
      l
    ]);
    let y = 0n;
    s && (y = await new E(a, R, this.provider).getNonce());
    const f = s ? "0x" : this.buildInitCode(e.address), p = await this.provider.getFeeData(), w = {
      sender: a,
      nonce: y,
      initCode: f,
      callData: h,
      callGasLimit: 150000n * BigInt(t.length),
      // Scale with batch size
      verificationGasLimit: 200000n,
      preVerificationGas: 50000n,
      maxFeePerGas: p.maxFeePerGas || 0n,
      maxPriorityFeePerGas: p.maxPriorityFeePerGas || 0n,
      paymasterAndData: "0x",
      signature: "0x"
    };
    if (n && ((M = this.paymasterConfig) != null && M.enabled)) {
      const A = await this.getPaymasterData(w);
      A && (w.paymasterAndData = A.paymasterAndData);
    }
    const g = await this.signUserOperation(e, w);
    return w.signature = g, w;
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
      const a = n.result;
      return o.info("UserOperation sent", { component: "SmartAccount", userOpHash: a }), {
        userOpHash: a,
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
    const a = new U([
      "function createAccount(address owner, uint256 salt) returns (address)"
    ]).encodeFunctionData("createAccount", [
      e,
      0
    ]);
    return this.config.factoryAddress + a.slice(2);
  }
  /**
   * Sign UserOperation
   */
  async signUserOperation(e, t) {
    const n = this.getUserOpHash(t);
    return await e.signMessage(D(n));
  }
  /**
   * Get UserOperation hash
   */
  getUserOpHash(e) {
    var s;
    const t = this.packUserOp(e), n = b(t), a = ((s = this.provider._network) == null ? void 0 : s.chainId) || 1n;
    return b(
      k.encode(
        ["bytes32", "address", "uint256"],
        [n, this.config.entryPoint, a]
      )
    );
  }
  /**
   * Pack UserOperation for hashing
   */
  packUserOp(e) {
    return k.encode(
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
        b(e.initCode === "0x" ? new Uint8Array() : D(e.initCode)),
        b(e.callData === "0x" ? new Uint8Array() : D(e.callData)),
        e.callGasLimit,
        e.verificationGasLimit,
        e.preVerificationGas,
        e.maxFeePerGas,
        e.maxPriorityFeePerGas,
        b(
          e.paymasterAndData === "0x" ? new Uint8Array() : D(e.paymasterAndData)
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
      nonce: S(e.nonce),
      initCode: e.initCode,
      callData: e.callData,
      callGasLimit: S(e.callGasLimit),
      verificationGasLimit: S(e.verificationGasLimit),
      preVerificationGas: S(e.preVerificationGas),
      maxFeePerGas: S(e.maxFeePerGas),
      maxPriorityFeePerGas: S(e.maxPriorityFeePerGas),
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
      const a = await (await fetch(`${this.paymasterConfig.url}/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOperation: this.serializeUserOp(e),
          entryPoint: this.config.entryPoint
        })
      })).json();
      return a.success ? {
        paymasterAndData: a.paymasterAndData,
        callGasLimit: a.callGasLimit ? BigInt(a.callGasLimit) : void 0,
        verificationGasLimit: a.verificationGasLimit ? BigInt(a.verificationGasLimit) : void 0,
        preVerificationGas: a.preVerificationGas ? BigInt(a.preVerificationGas) : void 0
      } : (console.warn("[Paymaster] Sponsorship denied:", a.error), null);
    } catch (n) {
      return console.error("[Paymaster] Failed to get sponsorship:", n), null;
    }
  }
  /**
   * Create Circle-compatible smart account (MSCA)
   */
  async createCircleMSCA(e, t) {
    const n = "0x0000000000000000000000000000000000000000", a = new E(
      n,
      ["function createAccount(address owner, uint256 salt) returns (address)"],
      t
    ), s = 0;
    try {
      o.info("Creating Circle MSCA", {
        component: "SmartAccountManager",
        owner: e
      });
      const c = await (await a.createAccount(e, s)).wait();
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
class Be {
  constructor(e) {
    u(this, "webauthn");
    u(this, "storage");
    u(this, "keyManager");
    u(this, "cctpManager");
    u(this, "smartAccountManager", null);
    u(this, "provider");
    u(this, "eventListeners");
    u(this, "currentAccount", null);
    u(this, "accountType");
    this.webauthn = new Ee({
      rpId: e.rpId,
      rpName: e.appName,
      backendUrl: e.backendUrl
    }), this.storage = new Se(), this.keyManager = new Te(this.webauthn, this.storage), this.provider = new re(e.rpcUrl), this.cctpManager = new Re(this.provider, e.cctp), this.accountType = e.accountType || "eoa", this.accountType === "smart-account" && (this.smartAccountManager = new Ke(
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
    n && n.forEach((a) => a(t));
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
      const a = await this.smartAccountManager.sendUserOperation(n);
      return this.emit("transactionSigned", { hash: a.userOpHash }), o.info("UserOperation sent", { component: "WalletSDK", userOpHash: a.userOpHash }), a;
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
      const n = this.keyManager.currentWallet, a = await this.smartAccountManager.buildBatchUserOperation(
        n,
        e,
        t
      );
      o.info("Sending batch UserOperation", { component: "WalletSDK" });
      const s = await this.smartAccountManager.sendUserOperation(a);
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
}
class He {
  constructor(e) {
    u(this, "config");
    u(this, "baseUrl");
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
    var n, a;
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
      return ((a = (n = (await s.json()).data) == null ? void 0 : n.usdc) == null ? void 0 : a.balance) || "0";
    } catch (s) {
      throw o.error("Failed to fetch USDC balance", s, {
        component: "CircleApiClient",
        address: e,
        chainId: t
      }), s;
    }
  }
}
const Ue = "0x00000000";
async function $e(r, e) {
  try {
    return await e.getCode(r) === "0x" ? !1 : await new E(r, [
      "function supportsInterface(bytes4) view returns (bool)"
    ], e).supportsInterface(Ue);
  } catch {
    return !1;
  }
}
const Ve = "1.0.0";
export {
  Re as CCTPManager,
  G as CIRCLE_NETWORKS,
  He as CircleApiClient,
  Me as CirclePaymasterClient,
  Oe as DEFAULT_AA_CONFIG,
  ve as DEFAULT_CCTP_CONFIG,
  Te as KeyManager,
  ye as LogLevel,
  T as PASSKEY_DIAGNOSTIC_MESSAGES,
  We as PasskeyDiagnosticError,
  Se as SecureStorage,
  Ke as SmartAccountManager,
  Ve as VERSION,
  Be as WalletSDK,
  Ee as WebAuthnManager,
  Ae as checkPlatformAuthenticatorSupport,
  Fe as createLogger,
  z as getCCTPConfigErrorMessage,
  Ie as getCircleNetwork,
  we as getDeviceRiskLevel,
  Ce as getDiagnosticErrorMessage,
  ge as getPasskeyDiagnosticMode,
  Le as isArcNetworkConfigured,
  ke as isCCTPSupported,
  $e as isCircleMSCA,
  me as isHighRiskDevice,
  Ge as isNativeUSDC,
  o as logger,
  be as runPasskeyDiagnostic,
  F as validateCCTPConfig
};
//# sourceMappingURL=index.mjs.map
