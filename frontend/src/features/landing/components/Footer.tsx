import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin } from 'lucide-react';
import MESLogo from '@/assets/malasakit/Primary Logo - White.svg';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Security', href: '/security' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'User Manual', href: '/user-manual' }
    ],
    company: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' }
    ],
    legal: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms of Service', href: '/terms-of-service' },
      { label: 'OWASP Compliance', href: '/owasp-compliance' },
      { label: 'Cookie Policy', href: '/cookie-policy' }
    ]
  };

  return (
    <footer className="relative bg-primary-gradient text-gray-300 overflow-hidden">

      {/* Floating Particles — mirrors Hero */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="animate-float-slow absolute top-[10%] left-[5%] w-28 h-28 rounded-full bg-white/10" style={{ animationDelay: '0s' }} />
        <div className="animate-float-slow absolute top-[55%] left-[2%] w-36 h-36 rounded-full bg-healing-mint/15" style={{ animationDelay: '3s' }} />
        <div className="animate-float-slow absolute top-[20%] right-[38%] w-24 h-24 rounded-full bg-white/10" style={{ animationDelay: '6s' }} />
        <div className="animate-float-slow absolute bottom-[8%] left-[28%] w-32 h-32 rounded-full bg-healing-mint/10" style={{ animationDelay: '1.5s' }} />

        <div className="animate-float-medium absolute top-[35%] left-[16%] w-16 h-16 rounded-full bg-white/15" style={{ animationDelay: '1s' }} />
        <div className="animate-float-medium absolute top-[8%] left-[48%] w-20 h-20 rounded-full bg-healing-mint/20" style={{ animationDelay: '4s' }} />
        <div className="animate-float-medium absolute top-[65%] left-[52%] w-14 h-14 rounded-full bg-white/10" style={{ animationDelay: '2s' }} />
        <div className="animate-float-medium absolute bottom-[18%] left-[22%] w-20 h-20 rounded-full bg-healing-mint/15" style={{ animationDelay: '5s' }} />

        <div className="animate-float-fast absolute top-[28%] left-[33%] w-8 h-8 rounded-full bg-white/20" style={{ animationDelay: '0.5s' }} />
        <div className="animate-float-fast absolute top-[50%] left-[10%] w-10 h-10 rounded-full bg-healing-mint/25" style={{ animationDelay: '2.5s' }} />
        <div className="animate-float-fast absolute top-[18%] left-[62%] w-8 h-8 rounded-full bg-white/15" style={{ animationDelay: '3.5s' }} />
        <div className="animate-float-fast absolute bottom-[28%] left-[40%] w-6 h-6 rounded-full bg-white/20" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center space-x-3">
              <img
                src={MESLogo}
                alt="Malasakit Logo"
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-6 text-base text-white/70 max-w-sm leading-relaxed font-body">
              Modern practice management software designed for healthcare professionals 
              who want to focus on patient care.
            </p>

            {/* Contact Info */}
            <div className="mt-8 space-y-4">
              <a href="mailto:malasakitsolutions@gmail.com" className="flex items-center text-base text-white/70 hover:text-white transition-colors font-body">
                <Mail className="w-5 h-5 mr-3 text-healing-mint" />
                malasakitsolutions@gmail.com
              </a>
              <a href="tel:+639457123456" className="flex items-center text-base text-white/70 hover:text-white transition-colors font-body">
                <Phone className="w-5 h-5 mr-3 text-healing-mint" />
                +63 9457 123 456
              </a>
              <div className="flex items-start text-base">
                <MapPin className="w-5 h-5 mr-3 mt-0.5 shrink-0 text-healing-mint" />
                <span className="text-white/70 font-body">Bacolod City, Negros Occidental, Philippines, 6100</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="mt-8 flex items-center space-x-4">
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-white">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-white">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-white">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h3 className="text-base font-bold text-white mb-6 font-display">Product</h3>
            <ul className="space-y-4">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-base text-white/70 hover:text-white transition-colors font-body">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-base font-bold text-white mb-6 font-display">Company</h3>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-base text-white/70 hover:text-white transition-colors font-body">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-base font-bold text-white mb-6 font-display">Legal</h3>
            <ul className="space-y-4">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-base text-white/70 hover:text-white transition-colors font-body">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-10 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-base text-white/60 font-body">
              © {currentYear} Malasakit. All rights reserved.
            </p>
            <div className="flex items-center space-x-8">
              <a href="#" className="text-base text-white/60 hover:text-white transition-colors font-body">Twitter</a>
              <a href="#" className="text-base text-white/60 hover:text-white transition-colors font-body">LinkedIn</a>
              <a href="#" className="text-base text-white/60 hover:text-white transition-colors font-body">Facebook</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
