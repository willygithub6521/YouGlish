import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSuggestions } from '../hooks/useSearch.js';
import type { SearchBarProps } from '../types/index.js';

const SearchBar: React.FC<SearchBarProps> = ({
  initialQuery = '',
  onSearch,
  isLoading,
  placeholder = 'Enter a word or phrase…',
}) => {
  const [inputValue, setInputValue] = useState(initialQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // Fetch suggestions when input has ≥2 chars
  const { data: suggestionsData } = useSuggestions(
    inputValue.trim().length >= 2 ? inputValue.trim() : '',
    8
  );
  const suggestions = suggestionsData?.suggestions ?? [];

  // ── Close dropdown on outside click ──────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !suggestionsRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Input change ──────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setActiveSuggestion(-1);
    setShowSuggestions(true);
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setShowSuggestions(false);
      onSearch(trimmed);
    },
    [onSearch]
  );

  // ── Keyboard navigation ───────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') handleSubmit(inputValue);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestion >= 0) {
        const chosen = suggestions[activeSuggestion];
        setInputValue(chosen);
        handleSubmit(chosen);
      } else {
        handleSubmit(inputValue);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
  };

  // ── Suggestion click ──────────────────────────────────────────
  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    handleSubmit(suggestion);
    inputRef.current?.focus();
  };

  const isValid = inputValue.trim().length >= 1;

  return (
    <div className="relative w-full" role="search">
      <div className="flex gap-2">
        {/* Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id="search-input"
            type="text"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            aria-label="Search for a word or phrase"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-haspopup="listbox"
            aria-activedescendant={
              activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
            disabled={isLoading}
            className={[
              'w-full px-4 py-3 pr-10 text-gray-900 placeholder-gray-400 text-lg',
              'border rounded-xl transition-all',
              isLoading
                ? 'border-gray-200 bg-gray-50 cursor-wait'
                : 'border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent',
            ].join(' ')}
          />
          {/* Spinner when loading */}
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search button */}
        <button
          id="search-submit-btn"
          type="button"
          onClick={() => handleSubmit(inputValue)}
          disabled={isLoading || !isValid}
          aria-label="Search"
          className={[
            'px-6 py-3 rounded-xl font-semibold text-lg transition-colors shadow-sm',
            isLoading || !isValid
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-red-500 hover:bg-red-600 text-white',
          ].join(' ')}
        >
          {isLoading ? '…' : 'Search'}
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul
          ref={suggestionsRef}
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden"
        >
          {suggestions.map((suggestion, i) => (
            <li
              key={suggestion}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === activeSuggestion}
              onMouseDown={() => handleSuggestionClick(suggestion)}
              className={[
                'px-4 py-2.5 cursor-pointer text-gray-800 transition-colors text-sm',
                i === activeSuggestion
                  ? 'bg-red-50 text-red-700'
                  : 'hover:bg-gray-50',
              ].join(' ')}
            >
              <span className="mr-2 text-gray-400">🔍</span>
              {suggestion}
            </li>
          ))}
        </ul>
      )}

      {/* Validation hint */}
      {!isLoading && inputValue.trim().length === 1 && (
        <p className="mt-1.5 text-xs text-gray-400 pl-1">
          Enter at least 2 characters to search
        </p>
      )}
    </div>
  );
};

export default SearchBar;
