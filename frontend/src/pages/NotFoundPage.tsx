import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <p className="text-8xl mb-6">🔇</p>
    <h1 className="text-4xl font-extrabold text-gray-900 mb-3">404</h1>
    <p className="text-xl text-gray-500 mb-8">
      This page doesn't exist. Maybe it never did.
    </p>
    <Link
      to="/"
      className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
    >
      Back to search
    </Link>
  </div>
);

export default NotFoundPage;
