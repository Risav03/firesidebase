import React, { useState } from 'react';
import SearchBar, { SearchResult } from './SearchBar';

// Example usage of the SearchBar component
const SearchExample: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Simulating a search function
  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      // Mock results
      const results: SearchResult[] = [
        { id: '1', title: 'Result 1 for ' + query, image: '/pfp.png' },
        { id: '2', title: 'Result 2 for ' + query },
        { id: '3', title: 'Result 3 for ' + query, image: '/pfp.png' },
      ];
      
      setSearchResults(results);
      setIsLoading(false);
    }, 500);
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    console.log('Selected result:', result);
    // You can navigate or perform actions based on the selected result
  };

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <SearchBar
        placeholder="Search rooms..."
        value={searchQuery}
        onChange={(value) => {
          setSearchQuery(value);
          handleSearch(value);
        }}
        onSearch={handleSearch}
        results={searchResults}
        onResultClick={handleResultClick}
        loading={isLoading}
        className="w-full"
      />
    </div>
  );
};

export default SearchExample;
