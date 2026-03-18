import React from 'react';
import { Link } from 'react-router-dom';

const AboutPage: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
    <h1 className="text-4xl font-extrabold text-gray-900 mb-6">About YouGlish</h1>
    <div className="prose prose-gray max-w-none space-y-4 text-gray-600">
      <p className="text-lg">
        <strong className="text-gray-900">YouGlish</strong> helps English learners improve
        pronunciation by finding real-world examples of words and phrases in YouTube videos —
        filtered by accent.
      </p>
      <h2 className="text-2xl font-bold text-gray-900 mt-8">How it works</h2>
      <ol className="list-decimal list-inside space-y-2">
        <li>Enter a word or phrase in the search bar</li>
        <li>Choose your preferred accent (American, British, Australian, Canadian, or Other)</li>
        <li>Browse subtitle matches from authentic YouTube videos</li>
        <li>Click a result to hear the word spoken in context</li>
      </ol>
      <h2 className="text-2xl font-bold text-gray-900 mt-8">Supported accents</h2>
      <ul className="list-disc list-inside space-y-1">
        <li>🇺🇸 American English (US)</li>
        <li>🇬🇧 British English (UK)</li>
        <li>🇦🇺 Australian English (AU)</li>
        <li>🇨🇦 Canadian English (CA)</li>
        <li>🌐 Other English accents</li>
      </ul>
    </div>
    <Link
      to="/"
      className="inline-block mt-10 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
    >
      Start searching →
    </Link>
  </div>
);

export default AboutPage;
