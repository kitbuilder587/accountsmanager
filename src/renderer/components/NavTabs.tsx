interface NavTabsProps {
  activeTab: 'profiles' | 'reels';
  onTabChange: (tab: 'profiles' | 'reels') => void;
}

export function NavTabs({ activeTab, onTabChange }: NavTabsProps) {
  return (
    <nav className="nav-tabs">
      <button
        type="button"
        className={`nav-tab ${activeTab === 'profiles' ? 'nav-tab--active' : ''}`}
        onClick={() => onTabChange('profiles')}
      >
        Profiles
      </button>
      <button
        type="button"
        className={`nav-tab ${activeTab === 'reels' ? 'nav-tab--active' : ''}`}
        onClick={() => onTabChange('reels')}
      >
        Reels
      </button>
    </nav>
  );
}
