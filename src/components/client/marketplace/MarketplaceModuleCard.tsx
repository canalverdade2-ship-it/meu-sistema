import React from 'react';
import * as Icons from 'lucide-react';

interface MarketplaceModuleCardProps {
  title: string;
  description: string;
  buttonText: string;
  badgeText: string;
  badgeType: 'available' | 'coming_soon';
  iconName: keyof typeof Icons;
  colorTheme: 'indigo' | 'sky' | 'amber';
  onClick: () => void;
}

export function MarketplaceModuleCard({
  title,
  description,
  buttonText,
  badgeText,
  badgeType,
  iconName,
  colorTheme,
  onClick
}: MarketplaceModuleCardProps) {
  const Icon = Icons[iconName] as React.ComponentType<{ className?: string }>;

  const themes = {
    indigo: {
      bg: 'hover:border-indigo-500/30 hover:shadow-indigo-500/5',
      iconBg: 'bg-indigo-50 text-indigo-600',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/50',
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10 focus:ring-indigo-500',
    },
    sky: {
      bg: 'hover:border-sky-500/30 hover:shadow-sky-500/5',
      iconBg: 'bg-sky-50 text-sky-600',
      badge: 'bg-sky-50 text-sky-700 border-sky-200/50',
      btn: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/10 focus:ring-sky-500',
    },
    amber: {
      bg: 'hover:border-amber-500/30 hover:shadow-amber-500/5',
      iconBg: 'bg-amber-50 text-amber-600',
      badge: 'bg-amber-50 text-amber-700 border-amber-200/50',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/10 focus:ring-amber-500',
    }
  };

  const currentTheme = themes[colorTheme] || themes.indigo;

  return (
    <div 
      className={`group flex flex-col justify-between rounded-3xl border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 ${currentTheme.bg} hover:shadow-xl hover:-translate-y-0.5`}
    >
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${currentTheme.iconBg} transition-transform duration-300 group-hover:scale-110`}>
            {Icon && <Icon className="h-6 w-6" />}
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase ${
            badgeType === 'available' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
              : currentTheme.badge
          }`}>
            {badgeText}
          </span>
        </div>

        <h3 className="text-xl font-bold text-neutral-900 mb-2 tracking-tight group-hover:text-neutral-950">
          {title}
        </h3>
        
        <p className="text-sm text-neutral-500 leading-relaxed mb-6">
          {description}
        </p>
      </div>

      <button
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentTheme.btn}`}
      >
        <span>{buttonText}</span>
        <Icons.ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </button>
    </div>
  );
}
