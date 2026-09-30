import { useState } from 'react';
import { encrypt } from '../utils/cryptoUtils';
import { apiUrl } from '../utils/api';

function CredentialForm({ vaultKey, onSaved, onUnauthorized }) {
  const [form, setForm] = useState({
    website: '',
    username: '',
    password: '',
    category: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!vaultKey) {
      setError('Your vault key is not available. Please log in again.');
      return;
    }

    setIsSaving(true);

    try {
      const { ciphertext, iv } = await encrypt(form.password, vaultKey);
      const response = await fetch(apiUrl('/api/credentials'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: form.website,
          username: form.username,
          encryptedPassword: ciphertext,
          iv,
          category: form.category,
        }),
      });
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'Unable to save credential');
      }

      setForm({ website: '', username: '', password: '', category: '' });
      onSaved?.();
    } catch (submitError) {
      setError(submitError.message || 'Unable to save credential');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="credential-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <div>
          <p className="eyebrow">NEW ENTRY</p>
          <h2>Add a credential</h2>
        </div>
        <span className="secure-pill">Encrypted locally</span>
      </div>
      <div className="form-grid">
      <label className="field">
        Website
        <input
          name="website"
          type="text"
          value={form.website}
          onChange={handleChange}
          required
        />
      </label>

      <label className="field">
        Username
        <input
          name="username"
          type="text"
          value={form.username}
          onChange={handleChange}
        />
      </label>

      <label className="field">
        Password
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
        />
      </label>

      <label className="field">
        Category
        <input
          name="category"
          type="text"
          value={form.category}
          onChange={handleChange}
          placeholder="Finance, Work, Social Media"
        />
      </label>
      </div>

      {error && <p role="alert">{error}</p>}

      <button className="primary-button compact-button" type="submit" disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save credential'}
      </button>
    </form>
  );
}

export default CredentialForm;