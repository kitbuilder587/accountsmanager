import { useState } from 'react';

import { NavTabs } from './components/NavTabs.js';
import { ProfilesPage } from './pages/ProfilesPage.js';
import { ReelsPage } from './pages/ReelsPage.js';

function App() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'reels'>('reels');

  return (
    <main className="app-shell">
      <div className="workspace-header">
        <p className="eyebrow">Accounts Manager</p>
        <h1>Dashboard</h1>
        <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 'profiles' && <ProfilesPage />}
      {activeTab === 'reels' && <ReelsPage />}
    </main>
  );
}

export default App;
