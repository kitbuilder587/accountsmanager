import { useEffect, useState } from 'react';

import { LoginPage } from './components/LoginPage.js';
import { NavTabs } from './components/NavTabs.js';
import { ProfilesPage } from './pages/ProfilesPage.js';
import { ReelsPage } from './pages/ReelsPage.js';

type TabId = 'accounts' | 'pipeline' | 'ready' | 'published' | 'settings';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('pipeline');

  useEffect(() => {
    // Verify token is still valid
    if (token) {
      fetch('/api/auth/check', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (!data.authenticated) {
            localStorage.removeItem('auth_token');
            setToken(null);
          }
          setAuthChecked(true);
        })
        .catch(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, [token]);

  function handleLogin(newToken: string) {
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem('auth_token');
    setToken(null);
  }

  if (!authChecked) {
    return <main className="app-shell"><p>Loading...</p></main>;
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <div className="workspace-header">
        <div className="workspace-header__row">
          <div>
            <p className="eyebrow">Content Factory</p>
            <h1>Accounts Manager</h1>
          </div>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
        <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 'accounts' && <ProfilesPage />}
      {activeTab === 'pipeline' && <ReelsPage />}
      {activeTab === 'ready' && <div className="empty-state"><h2>Ready to Post</h2><p>Coming soon — select reels and accounts for publishing.</p></div>}
      {activeTab === 'published' && <div className="empty-state"><h2>Published</h2><p>Coming soon — publishing history.</p></div>}
      {activeTab === 'settings' && <div className="empty-state"><h2>Settings</h2><p>Coming soon — Telegram, AI, OCR, posting rules.</p></div>}
    </main>
  );
}

export default App;
