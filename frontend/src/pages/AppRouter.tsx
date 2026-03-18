import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout.js';

// Lazy-load pages
const SearchPage = lazy(() => import('./SearchPage.tsx'));
const AboutPage = lazy(() => import('./AboutPage.tsx'));
const NotFoundPage = lazy(() => import('./NotFoundPage.tsx'));

// ─── Loading fallback ────────────────────────────────────────────
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Loading…</p>
    </div>
  </div>
);

// ─── Router ──────────────────────────────────────────────────────
const AppRouter: React.FC = () => (
  <Layout>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/search" element={<Navigate to="/" replace />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </Layout>
);

export default AppRouter;
