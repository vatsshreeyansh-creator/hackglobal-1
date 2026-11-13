import React from 'react';

export type NavSection = 'workbench' | 'vectors' | 'automations' | 'security';

interface TopBarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onResetSandbox: () => void;
  isResetting: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onSelectSection,
  onResetSandbox,
  isResetting,
}) => {
  const navItems: { id: NavSection; label: string }[] = [
    { id: 'workbench', label: 'Workbench' },
    { id: 'vectors', label: 'Vector Index' },
    { id: 'automations', label: 'Automations' },
    { id: 'security', label: 'Privacy Sandbox' },
  ];

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single text element wordmark */}
      <button
        type="button"
        onClick={() => onSelectSection('workbench')}
        className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
      >
        OmniAgent
      </button>

      {/* Zone 2: 4 single-line text navigation links */}
      <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-t ${
                isActive
                  ? 'border-blue-600 text-slate-900 dark:text-slate-100 dark:border-blue-500'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onResetSandbox}
          disabled={isResetting}
          className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {isResetting ? 'Sanitizing...' : 'Reset Sandbox'}
        </button>
      </div>
    </header>
  );
};
