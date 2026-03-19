import React from 'react';
import type { AccentFilterProps, Accent } from '../types/index.js';

const ACCENT_OPTIONS: {
  value: Accent;
  label: string;
  flag: string;
}[] = [
  { value: 'ALL', label: 'All',        flag: '🌍' },
  { value: 'US',  label: 'American',   flag: '🇺🇸' },
  { value: 'UK',  label: 'British',    flag: '🇬🇧' },
  { value: 'AU',  label: 'Australian', flag: '🇦🇺' },
  { value: 'CA',  label: 'Canadian',   flag: '🇨🇦' },
  { value: 'OTHER', label: 'Other',    flag: '🌐' },
];

const AccentFilter: React.FC<AccentFilterProps> = ({
  selectedAccent,
  onAccentChange,
  resultCounts,
  disabled = false,
}) => {
  const totalCount = Object.entries(resultCounts)
    .filter(([key]) => key !== 'ALL')
    .reduce((sum, [, cnt]) => sum + cnt, 0);

  return (
    /*
     * Mobile: horizontally scrollable strip (no wrap).
     * Desktop: wraps naturally.
     * -webkit-overflow-scrolling: touch for inertia on iOS.
     */
    <div
      className={[
        'flex gap-2',
        // Mobile: single row, horizontal scroll
        'overflow-x-auto pb-1',
        // Hide scrollbar while keeping functionality
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        // Desktop: allow wrap
        'sm:flex-wrap sm:overflow-x-visible sm:pb-0',
      ].join(' ')}
      role="radiogroup"
      aria-label="Filter by accent"
      aria-disabled={disabled}
      // Snap scrolling for a native-like feel on touch
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {ACCENT_OPTIONS.map(({ value, label, flag }) => {
        const count = value === 'ALL' ? totalCount : (resultCounts[value] ?? 0);
        const isSelected = selectedAccent === value;
        const hasResults = count > 0 || value === 'ALL';

        return (
          <button
            key={value}
            id={`accent-btn-${value.toLowerCase()}`}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${label} accent – ${count} result${count !== 1 ? 's' : ''}`}
            type="button"
            onClick={() => !disabled && onAccentChange(value)}
            disabled={disabled}
            // 44px min-height ensures WCAG touch target size
            className={[
              'flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium',
              'transition-all duration-150 select-none shrink-0',
              'min-h-[44px]',          // touch-friendly height
              'min-w-[4rem]',          // prevent squeezing on narrow screens
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              isSelected
                ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-300 ring-offset-1'
                : hasResults
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100',
            ].join(' ')}
          >
            <span aria-hidden="true">{flag}</span>
            {/* Hide long label on very small screens, show on sm+ */}
            <span className="hidden xs:inline sm:inline">{label}</span>
            <span className="inline xs:hidden sm:hidden">{value}</span>
            {/* Result count badge */}
            <span
              className={[
                'inline-flex items-center justify-center min-w-[1.25rem] h-5',
                'px-1 rounded-full text-xs font-semibold',
                isSelected
                  ? 'bg-red-400 text-white'
                  : 'bg-gray-200 text-gray-600',
              ].join(' ')}
            >
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(AccentFilter);
export { ACCENT_OPTIONS };

