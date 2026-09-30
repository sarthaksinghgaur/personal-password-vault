import { useState } from 'react';
import AuthForm from './components/AuthForm';
import VaultDashboard from './components/VaultDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [vaultKey, setVaultKey] = useState(null);

  function handleAuthSuccess({ user: authenticatedUser, vaultKey: derivedVaultKey }) {
    setUser(authenticatedUser);
    setVaultKey(derivedVaultKey);
  }

  function handleLogout() {
    setUser(null);
    setVaultKey(null);
  }

  if (user && vaultKey) {
    return <VaultDashboard vaultKey={vaultKey} onLogout={handleLogout} />;
  }

  return <AuthForm onAuthSuccess={handleAuthSuccess} />;
}

export default App;