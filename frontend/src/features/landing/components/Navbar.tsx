import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import MESLogo from '@/assets/malasakit/PrimaryLogo-Colored.svg';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { label: 'About', id: 'about' },
    { label: 'Features', id: 'features' },
    { label: 'Pricing', id: 'plans' },
    { label: 'FAQ', id: 'faq' }
  ];

  return (
    <nav
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/70 backdrop-blur-md shadow-lg' : 'bg-white'
      } rounded-2xl`}
      style={{ width: 'calc(100% - 48px)', maxWidth: '1200px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <img 
              src={MESLogo} 
              alt="Malasakit Logo" 
              className="h-8 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className="px-4 py-2 text-base font-medium text-trust-harbor hover:text-care-blue hover:bg-clinical-cloud rounded-lg transition-all flex items-center font-body"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
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
            className="md:hidden p-3 rounded-lg text-trust-harbor hover:bg-gray-100 transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-7 h-7" />
            ) : (
              <Menu className="w-7 h-7" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-xl rounded-b-md">
          <div className="px-4 py-6 space-y-4">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className="block w-full text-left px-4 py-3 text-base font-medium text-trust-harbor hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between font-body"
              >
                {link.label}
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            ))}
            <div className="pt-4 space-y-3 border-t border-gray-200">
              <Link
                to="/login"
                className="block w-full px-4 py-3 text-base font-medium text-trust-harbor hover:bg-gray-50 rounded-lg text-center transition-colors font-body"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="block w-full px-4 py-3 text-base font-semibold text-white bg-trust-harbor rounded-lg hover:bg-trust-harbor/90 text-center shadow-lg transition-all font-body"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
