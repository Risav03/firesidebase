import React, { useState, useRef, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';
import { IoSearchOutline } from 'react-icons/io5';

export type SearchResult = {
  id: string;
  title: string;
  image?: string;
};

export interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  results?: SearchResult[];
  onResultClick?: (result: SearchResult) => void;
  className?: string;
  inputClassName?: string;
  resultsClassName?: string;
  resultItemClassName?: string;
  showResults?: boolean;
  loading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  value,
  onChange,
  onSearch,
  results = [],
  onResultClick,
  className,
  inputClassName,
  resultsClassName,
  resultItemClassName,
  showResults = true,
  loading = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showResultsList, setShowResultsList] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show results when there are any and the input is focused
    setShowResultsList(isFocused && results.length > 0 && showResults);

    // Handle clicks outside of the search component
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setShowResultsList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFocused, results, showResults]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <div
        className={twMerge(
          'flex items-center px-3 py-2 border border-white/30 bg-white/10 rounded-lg',
          isFocused ? 'ring-1 ring-white/50' : '',
          className
        )}
      >
        <IoSearchOutline className="text-white/70 mr-2" size={18} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className={twMerge(
            'w-full bg-transparent outline-none text-white placeholder-white/50',
            inputClassName
          )}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
        )}
      </div>

      {/* Search Results */}
      {showResultsList && (
        <div
          className={twMerge(
            'absolute z-10 mt-1 w-full bg-black/80 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto',
            resultsClassName
          )}
        >
          {results.map((result) => (
            <div
              key={result.id}
              className={twMerge(
                'flex items-center p-3 cursor-pointer hover:bg-white/10 transition-colors',
                resultItemClassName
              )}
              onClick={() => {
                if (onResultClick) {
                  onResultClick(result);
                  setShowResultsList(false);
                }
              }}
            >
              {result.image && (
                <div className="w-8 h-8 mr-3 rounded-full overflow-hidden flex-shrink-0">
                  <img src={result.image} alt={result.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="text-white text-sm font-medium truncate">{result.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
