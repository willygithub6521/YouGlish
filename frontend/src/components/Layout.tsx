import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// ─── Header ─────────────────────────────────────────────────────
const Header: React.FC = () => {
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Search' },
    { to: '/about', label: 'About' },
  ];

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🎙️</span>
            <span className="text-xl font-bold text-gray-900 group-hover:text-red-600 transition-colors">
              YouGlish
            </span>
            <span className="text-xs text-gray-400 font-medium hidden sm:inline-block ml-1">
              Pronunciation Search
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={[
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === link.to
                    ? 'bg-red-50 text-red-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                ].join(' ')}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

// ─── Footer ─────────────────────────────────────────────────────
const Footer: React.FC = () => (
  <footer className="bg-white border-t border-gray-100 mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} YouGlish · Pronunciation with authentic YouTube videos
        </p>
        <div className="flex items-center gap-4">
          <Link to="/about" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            About
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  </footer>
);

// ─── Main Layout ─────────────────────────────────────────────────
interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <Header />
    <main className="flex-1">
      {children}
    </main>
    <Footer />
  </div>
);

export default Layout;
export { Header, Footer };
