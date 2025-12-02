(async () => {
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: 'app.arcwallet.network',
        timeout: 60000,
        userVerification: 'preferred',
        allowCredentials: []
      }
    });

    console.log('SUCCESS! Credential ID:', cred.id);
    console.log('Raw ID (base64):', btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
    alert('Credential ID:\n' + cred.id);
  } catch (e) {
    console.error('Error:', e.message);
    alert('Error: ' + e.message);
  }
})();
