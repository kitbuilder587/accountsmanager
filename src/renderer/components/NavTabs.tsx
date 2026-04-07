type TabId = 'accounts' | 'pipeline' | 'ready' | 'published' | 'settings';

interface NavTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'ready', label: 'Ready' },
  { id: 'published', label: 'Published' },
  { id: 'settings', label: 'Settings' },
];

export function NavTabs({ activeTab, onTabChange }: NavTabsProps) {
  return (
    <nav className="nav-tabs">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`nav-tab ${activeTab === tab.id ? 'nav-tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
