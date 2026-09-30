import { useEffect, useState } from 'react';
import CredentialCard from './CredentialCard';
import CredentialForm from './CredentialForm';

function VaultDashboard({ vaultKey, onLogout }) {
  const [showArchived, setShowArchived] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  function handleUnauthorized() {
    setCredentials([]);
    onLogout?.();
  }

  useEffect(() => {
    let isCurrent = true;

    async function fetchCredentials() {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(
          `/api/credentials?archived=${showArchived}`,
          { credentials: 'include' }
        );
        const result = await response.json().catch(() => ({}));

        if (response.status === 401) {
          setCredentials([]);
          onLogout?.();
          return;
        }

        if (!response.ok) {
          throw new Error(result.message || 'Unable to load credentials');
        }

        if (isCurrent) {
          setCredentials(result.credentials || []);
        }
      } catch (fetchError) {
        if (isCurrent) {
          setError(fetchError.message || 'Unable to load credentials');
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    fetchCredentials();

    return () => {
      isCurrent = false;
    };
  }, [showArchived, onLogout]);

  async function refreshCredentials() {
    const response = await fetch(
      `/api/credentials?archived=${showArchived}`,
      { credentials: 'include' }
    );
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      throw new Error(result.message || 'Unable to load credentials');
    }

    setCredentials(result.credentials || []);
  }

  async function handleCredentialSaved() {
    try {
      await refreshCredentials();
    } catch (refreshError) {
      setError(refreshError.message || 'Unable to refresh credentials');
    }
  }

  async function handleLogout() {
    setError('');

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to log out');
      }

      onLogout?.();
    } catch (logoutError) {
      setError(logoutError.message || 'Unable to log out');
    }
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PERSONAL PASSWORD VAULT</p>
          <h1>My Vault</h1>
          <p className="dashboard-subtitle">A private home for the accounts you rely on.</p>
        </div>
        <button className="ghost-button" type="button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className="form-panel">
        <CredentialForm
          vaultKey={vaultKey}
          onSaved={handleCredentialSaved}
          onUnauthorized={handleUnauthorized}
        />
      </section>

      <div className="vault-toolbar">
        <div>
          <p className="eyebrow">YOUR ACCOUNTS</p>
          <h2>{showArchived ? 'Archived credentials' : 'Active credentials'}</h2>
        </div>
        <div className="tab-switch" role="group" aria-label="Credential view">
        <button
          type="button"
          onClick={() => setShowArchived(false)}
          disabled={!showArchived}
          className={!showArchived ? 'selected' : ''}
          aria-selected={!showArchived}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setShowArchived(true)}
          disabled={showArchived}
          className={showArchived ? 'selected' : ''}
          aria-selected={showArchived}
        >
          Archived
        </button>
        </div>
      </div>

      <section className="credential-list">
        {isLoading && <p className="state-message" role="status">Loading credentials...</p>}
        {error && <p className="state-message error-message" role="alert">{error}</p>}
        {!isLoading && !error && credentials.length === 0 && (
          <p className="state-message">No {showArchived ? 'archived' : 'active'} credentials yet.</p>
        )}
        {!isLoading &&
          credentials.map((credential) => (
            <CredentialCard
              key={credential._id}
              credential={credential}
              vaultKey={vaultKey}
              onStatusChange={refreshCredentials}
              onUnauthorized={handleUnauthorized}
            />
          ))}
      </section>
    </main>
  );
}

export default VaultDashboard;