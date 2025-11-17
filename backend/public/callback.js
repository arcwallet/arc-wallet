(async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const messageEl = document.getElementById('callback-message');

  function setMessage(text, isError = false) {
    if (messageEl) {
      messageEl.textContent = text;
      messageEl.style.color = isError ? '#ff5252' : '#0f9d58';
    }
  }

  if (!token) {
    setMessage('Invalid link. Please request a new magic link.', true);
    return;
  }

  try {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload?.error ?? 'Verification failed.', true);
      return;
    }

    const target = window.__ARC_REDIRECT__ || '/';
    setMessage('Sign-in successful. Redirecting...');
    setTimeout(() => {
      const url = new URL(target, window.location.origin);
      if (!url.pathname.endsWith('/dashboard')) {
        url.pathname = '/dashboard';
      }
      window.location.href = url.toString();
    }, 800);
  } catch (error) {
    console.error('Magic link verification error:', error);
    setMessage('Unexpected error. Please try again.', true);
  }
})();
