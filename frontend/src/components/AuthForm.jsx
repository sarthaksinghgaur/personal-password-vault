import { useState } from 'react';
import { decrypt, deriveKey, encrypt } from '../utils/cryptoUtils';
import { apiUrl } from '../utils/api';

const VAULT_VERIFICATION_STRING = 'vault-verification-string';

function createVaultSalt() {
  const salt = window.crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...salt));
}

function AuthForm({ onAuthSuccess }) {
  const [mode, setMode] = useState('Login');
  const [form, setForm] = useState({
    email: '',
    appPassword: '',
    masterPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === 'Login';

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!form.masterPassword) {
      setError('Master password is required to unlock your vault.');
      return;
    }

    setIsSubmitting(true);

    try {
      let authData = {
        email: form.email,
        password: form.appPassword,
      };

      if (!isLogin) {
        const vaultKeySalt = createVaultSalt();
        const vaultKey = await deriveKey(form.masterPassword, vaultKeySalt);
        const keyCheck = await encrypt(VAULT_VERIFICATION_STRING, vaultKey);

        authData = {
          ...authData,
          vaultKeySalt,
          keyCheckValue: keyCheck.ciphertext,
          keyCheckIv: keyCheck.iv,
        };
      }

      const response = await fetch(apiUrl(`/api/auth/${isLogin ? 'login' : 'register'}`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Unable to authenticate');
      }

      if (!isLogin) {
        setMode('Login');
        setMessage('Registration successful. Log in to unlock your vault.');
        setForm((currentForm) => ({
          ...currentForm,
          appPassword: '',
          masterPassword: '',
        }));
        return;
      }

      const vaultKey = await deriveKey(
        form.masterPassword,
        result.user.vaultKeySalt
      );

      try {
        const verification = await decrypt(
          result.user.keyCheckValue,
          vaultKey,
          result.user.keyCheckIv
        );

        if (verification !== VAULT_VERIFICATION_STRING) {
          throw new Error('Verification string mismatch');
        }
      } catch {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {});
        window.alert('Incorrect Master Password');
        setError('Incorrect Master Password');
        return;
      }

      onAuthSuccess?.({ user: result.user, vaultKey });
      setForm((currentForm) => ({ ...currentForm, appPassword: '', masterPassword: '' }));
    } catch (submitError) {
      setError(submitError.message || 'Unable to authenticate');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">PV</div>
        <p className="eyebrow">PERSONAL PASSWORD VAULT</p>
        <h1>Keep every login<br />in one quiet place.</h1>
        <p className="auth-copy">
          Your app password signs you in. Your master password unlocks your vault locally.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
        <div className="mode-switch" role="group" aria-label="Authentication mode">
        <button type="button" onClick={() => switchMode('Login')} disabled={isLogin}>
          Login
        </button>
        <button
          type="button"
          onClick={() => switchMode('Register')}
          disabled={!isLogin}
        >
          Register
        </button>
      </div>

      <label className="field">
        Email
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />
      </label>

      <label className="field">
        App password
        <input
          name="appPassword"
          type="password"
          value={form.appPassword}
          onChange={handleChange}
          required
        />
      </label>

      <label className="field">
        Master password
        <input
          name="masterPassword"
          type="password"
          value={form.masterPassword}
          onChange={handleChange}
          required
        />
      </label>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <button className="primary-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : mode}
      </button>
        </form>
      </section>
      <p className="auth-footnote">AES-GCM encryption · Your master password never leaves this device</p>
    </main>
  );
}

export default AuthForm;