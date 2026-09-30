import { useEffect, useRef, useState } from 'react';
import { decrypt } from '../utils/cryptoUtils';
import { apiUrl } from '../utils/api';

function CredentialCard({ credential, vaultKey, onStatusChange, onUnauthorized }) {
  const [decryptedPassword, setDecryptedPassword] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [message, setMessage] = useState('');
  const clearClipboardTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (clearClipboardTimer.current) {
        window.clearTimeout(clearClipboardTimer.current);
      }
    };
  }, []);

  async function getDecryptedPassword() {
    if (!vaultKey) {
      throw new Error('Your vault key is not available. Please log in again.');
    }

    return decrypt(credential.encryptedPassword, vaultKey, credential.iv);
  }

  async function handleReveal() {
    setMessage('');
    setIsDecrypting(true);

    try {
      setDecryptedPassword(await getDecryptedPassword());
    } catch {
      setMessage('Unable to decrypt this password.');
    } finally {
      setIsDecrypting(false);
    }
  }

  async function handleCopy() {
    setMessage('');

    try {
      const password = decryptedPassword || (await getDecryptedPassword());
      await navigator.clipboard.writeText(password);
      setDecryptedPassword(password);
      setMessage('Password copied. Clipboard will clear in 15 seconds.');

      if (clearClipboardTimer.current) {
        window.clearTimeout(clearClipboardTimer.current);
      }

      clearClipboardTimer.current = window.setTimeout(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch {
          // Clipboard permissions may change before the timer expires.
        }
        clearClipboardTimer.current = null;
      }, 15000);
    } catch {
      setMessage('Unable to decrypt or copy this password.');
    }
  }

  async function handleStatusChange() {
    setMessage('');
    setIsUpdatingStatus(true);

    try {
      const response = await fetch(apiUrl(`/api/credentials/${credential._id}/archive`), {
        method: 'PATCH',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || 'Unable to update credential status');
      }

      await onStatusChange?.();
    } catch (statusError) {
      setMessage(statusError.message || 'Unable to update credential status');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  return (
    <article className="credential-card">
      <div className="credential-card-topline">
        <span className="site-avatar" aria-hidden="true">{credential.website.charAt(0).toUpperCase()}</span>
        <div>
          <h2>{credential.website}</h2>
          <p className="credential-username">{credential.username || 'No username'}</p>
        </div>
        {credential.category && <span className="category-pill">{credential.category}</span>}
      </div>
      <p className="password-display" aria-label={decryptedPassword ? 'Password revealed' : 'Password masked'}>
        {decryptedPassword || '••••••••'}
      </p>
      {message && <p role="status">{message}</p>}
      <div className="card-actions">
      <button className="secondary-button" type="button" onClick={handleReveal} disabled={isDecrypting}>
        {isDecrypting ? 'Decrypting...' : 'Reveal'}
      </button>
      <button className="secondary-button" type="button" onClick={handleCopy}>
        Copy
      </button>
      <button
        className="secondary-button"
        type="button"
        onClick={handleStatusChange}
        disabled={isUpdatingStatus}
      >
        {isUpdatingStatus
          ? 'Updating...'
          : credential.isArchived
            ? 'Restore'
            : 'Archive'}
      </button>
          </div>
    </article>
  );
}

export default CredentialCard;