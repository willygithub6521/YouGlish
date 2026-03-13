import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">
              YouTube Pronunciation Search
            </h1>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Learn English Pronunciation with Real Videos
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Search for English words and phrases to hear their pronunciation in authentic YouTube videos
          </p>
          
          <div className="max-w-md mx-auto">
            <div className="flex rounded-lg shadow-sm">
              <input
                type="text"
                className="input-field rounded-r-none"
                placeholder="Enter a word or phrase..."
              />
              <button className="btn-primary rounded-l-none">
                Search
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;