document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('magic-login-form');
  const statusEl = document.getElementById('login-status');

  if (!form || !(form instanceof HTMLFormElement)) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = formData.get('email');

    if (typeof email !== 'string' || !email.trim()) {
      updateStatus('Please enter a valid email address.', true);
      return;
    }

    try {
      updateStatus('Preparing magic link…', false);
      const response = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to send magic link.');
      }
      updateStatus(payload?.message || 'Magic link sent. Check the server console.');
      form.reset();
    } catch (error) {
      console.error('Magic link request failed:', error);
      updateStatus(error instanceof Error ? error.message : 'Unexpected error.', true);
    }
  });

  function updateStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = isError ? 'muted error' : 'muted success';
  }
});
