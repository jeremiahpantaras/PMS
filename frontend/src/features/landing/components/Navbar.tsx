import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronRight } from 'lucide-react';
import MESLogo from '@/assets/malasakit/PrimaryLogo-Colored.svg';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Prevent body scroll
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { label: 'About', id: 'about' },
    { label: 'Features', id: 'features' },
    { label: 'Pricing', id: 'plans' },
    { label: 'FAQ', id: 'faq' }
  ];

  const handleNavLinkClick = (link: { label: string; id?: string; path?: string }) => {
    setIsMobileMenuOpen(false);
    
    if (link.path) {
      navigate(link.path);
    } else if (link.id) {
      if (location.pathname !== '/') {
        navigate('/');
        // Small delay to ensure the DOM updates before scrolling
        setTimeout(() => {
          scrollToSection(link.id as string);
        }, 100);
      } else {
        scrollToSection(link.id);
      }
    }
  };

  return (
    <>
      <nav
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ${
          isScrolled ? 'bg-white/70 backdrop-blur-md shadow-lg' : 'bg-white'
        } rounded-2xl`}
        style={{ width: 'calc(100% - 48px)', maxWidth: '1200px' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 z-50">
              <img 
                src={MESLogo} 
                alt="Malasakit Logo" 
                className="h-8 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleNavLinkClick(link)}
                  className="px-4 py-2 text-base font-medium text-trust-harbor hover:text-care-blue hover:bg-clinical-cloud rounded-lg transition-all flex items-center font-body"
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center space-x-4">
              <Link
                to="/login"
                className="px-5 py-2.5 text-base font-medium text-trust-harbor hover:text-care-blue transition-colors font-body"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-6 py-2.5 text-base font-semibold text-white bg-trust-harbor rounded-lg hover:bg-trust-harbor/90 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-body"
              >
                Sign Up
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-3 -mr-3 rounded-lg text-trust-harbor hover:bg-gray-100 transition-colors z-50 relative"
              aria-label="Toggle Menu"
            >
              <Menu className="w-7 h-7" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Backdrop */}
      <div 
        className={`fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 transition-opacity duration-300 lg:hidden ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-4/5 max-w-sm bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-8 border-b border-gray-100">
          <span className="text-xl font-bold text-trust-harbor font-heading">Menu</span>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 -mr-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close Menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNavLinkClick(link)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-base font-medium text-trust-harbor hover:bg-gray-50 rounded-xl transition-colors font-body group"
            >
              {link.label}
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-care-blue transition-colors" />
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 space-y-3">
          <Link
            to="/login"
            className="flex items-center justify-center w-full px-4 py-3.5 text-base font-medium text-trust-harbor bg-white border border-gray-200 hover:bg-gray-50 hover:text-care-blue rounded-xl transition-colors font-body shadow-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="flex items-center justify-center w-full px-4 py-3.5 text-base font-semibold text-white bg-trust-harbor hover:bg-trust-harbor/90 rounded-xl transition-all shadow-md hover:shadow-lg font-body"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Sign Up
          </Link>
        </div>
      </div>
    </>
  );
};
