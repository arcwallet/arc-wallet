const base64UrlToBuffer = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = base64 + (pad ? '='.repeat(4 - pad) : '');

  let binary: string;
  if (typeof atob === 'function') {
    binary = atob(padded);
  } else {
    const bufferCtor = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer;
    if (!bufferCtor) {
      throw new Error('Base64 decoding is not supported in this environment.');
    }
    binary = bufferCtor.from(padded, 'base64').toString('binary');
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bufferToBase64Url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  let base64: string;
  if (typeof btoa === 'function') {
    base64 = btoa(binary);
  } else {
    const bufferCtor = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer;
    if (!bufferCtor) {
      throw new Error('Base64 encoding is not supported in this environment.');
    }
    base64 = bufferCtor.from(binary, 'binary').toString('base64');
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
};

type PublicKeyCredentialCreationOptionsJSON = Omit<PublicKeyCredentialCreationOptions, 'challenge' | 'user' | 'excludeCredentials'> & {
  challenge: string;
  user: {
    id: string;
    name: string;
    displayName?: string;
  };
  excludeCredentials?: Array<{
    id: string;
    type: PublicKeyCredentialType;
    transports?: AuthenticatorTransport[];
  }>;
};

type PublicKeyCredentialRequestOptionsJSON = Omit<PublicKeyCredentialRequestOptions, 'challenge' | 'allowCredentials'> & {
  challenge: string;
  allowCredentials?: Array<{
    id: string;
    type: PublicKeyCredentialType;
    transports?: AuthenticatorTransport[];
  }>;
};

export async function createRegistrationCredential(options: PublicKeyCredentialCreationOptionsJSON) {
  if (!('credentials' in navigator)) {
    throw new Error('WebAuthn is not supported in this environment.');
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64UrlToBuffer(options.user.id),
    },
    excludeCredentials: options.excludeCredentials?.map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) {
    throw new DOMException('Passkey creation was cancelled', 'AbortError');
  }

  const { response } = credential;
  const attestation = response as AuthenticatorAttestationResponse;
  const transports = (credential as any).getTransports?.() ?? [];

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(attestation.attestationObject),
      transports,
    },
  };
}

export async function createAuthenticationCredential(options: PublicKeyCredentialRequestOptionsJSON) {
  if (!('credentials' in navigator)) {
    throw new Error('WebAuthn is not supported in this environment.');
  }

  console.log('🔐 [webauthn] createAuthenticationCredential starting', {
    challenge: options.challenge?.substring(0, 20) + '...',
    allowCredentials: options.allowCredentials?.length || 'discoverable',
    timeout: options.timeout
  });

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    allowCredentials: options.allowCredentials?.map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };

  console.log('🔐 [webauthn] Calling navigator.credentials.get() - Browser prompt should appear now...');
  const startTime = Date.now();

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;

  const elapsed = Date.now() - startTime;
  console.log(`✅ [webauthn] Browser prompt completed in ${elapsed}ms`);

  if (!assertion) {
    throw new DOMException('Passkey authentication was cancelled', 'AbortError');
  }

  const { response } = assertion;
  const authResponse = response as AuthenticatorAssertionResponse;

  return {
    id: assertion.id,
    rawId: bufferToBase64Url(assertion.rawId),
    type: assertion.type,
    clientExtensionResults: assertion.getClientExtensionResults?.() ?? {},
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(authResponse.authenticatorData),
      signature: bufferToBase64Url(authResponse.signature),
      userHandle: authResponse.userHandle ? bufferToBase64Url(authResponse.userHandle) : null,
    },
  };
}
