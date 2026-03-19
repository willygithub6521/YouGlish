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
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="Filter by accent"
      aria-disabled={disabled}
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
            className={[
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
              'transition-all duration-150 select-none',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              isSelected
                ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-300 ring-offset-1'
                : hasResults
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100',
            ].join(' ')}
          >
            <span aria-hidden="true">{flag}</span>
            <span>{label}</span>
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
