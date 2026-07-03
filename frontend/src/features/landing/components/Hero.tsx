import React from 'react';
import { Link } from 'react-router-dom';
import DoctorImage from '@/assets/doctors/muhammad-hicham-PYxK4LNGn6E-unsplash 1.webp';
import LeafSVG from '@/assets/malasakit/Leaf.svg';

export const Hero: React.FC = () => {
  return (
    <section className="relative min-h-screen bg-primary-gradient overflow-hidden flex flex-col justify-center lg:block">
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 sm:pt-40 lg:pt-48 pb-10 lg:pb-20 w-full">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-8">
          {/* Left - Text Content */}
          <div className="flex-1 text-center lg:text-left max-w-xl lg:max-w-2xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold text-white leading-[1.1] font-display">
              Empowering Filipino{' '}
              <span className="block lg:inline text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold text-white leading-[1.1] font-display">Health Providers</span>
            </h1>

            <p className="mt-6 sm:mt-8 text-base sm:text-lg text-white/80 max-w-md mx-auto lg:mx-0 leading-relaxed font-body">
              Streamline your clinic operations with our all-in-one platform. Manage appointments,
              patient records, and billing effortlessly.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-care-blue bg-white rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 font-body"
              >
                Start Trial
              </Link>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-trust-harbor border-2 border-white/20 rounded-xl hover:bg-trust-harbor/90 active:bg-trust-harbor/80 transition-all shadow-lg hover:shadow-xl font-body"
              >
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right - Doctor + Leaf composition */}
      <div className="flex relative lg:absolute mt-8 lg:mt-0 right-0 bottom-0 items-end justify-center lg:justify-end pointer-events-none z-10 w-full">
        {/* Doctor Image */}
        <img
          src={DoctorImage}
          alt="Filipino healthcare professional"
          className="h-[45vh] sm:h-[55vh] lg:h-[80vh] w-auto object-contain object-bottom drop-shadow-2xl"
          loading="eager"
        />
        {/* Leaf Shape */}
        <img
          src={LeafSVG}
          alt=""
          className="h-[38vh] sm:h-[45vh] lg:h-[68vh] w-auto -ml-3 sm:-ml-5 opacity-90"
          aria-hidden="true"
        />
      </div>

      {/* Subtle Floating Lights */}
      <div className="absolute top-20 right-20 w-64 h-64 lg:w-80 lg:h-80 bg-healing-mint rounded-full opacity-20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-40 left-10 w-48 h-48 lg:w-64 lg:h-64 bg-white rounded-full opacity-10 blur-3xl pointer-events-none" />

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Large slow particles */}
        <div className="animate-float-slow absolute top-[15%] left-[8%] w-28 h-28 rounded-full bg-white/10 backdrop-blur-sm" style={{ animationDelay: '0s' }} />
        <div className="animate-float-slow absolute top-[60%] left-[3%] w-36 h-36 rounded-full bg-healing-mint/15 backdrop-blur-sm" style={{ animationDelay: '3s' }} />
        <div className="animate-float-slow absolute top-[25%] right-[38%] w-24 h-24 rounded-full bg-white/10" style={{ animationDelay: '6s' }} />
        <div className="animate-float-slow absolute bottom-[10%] left-[30%] w-32 h-32 rounded-full bg-healing-mint/10" style={{ animationDelay: '1.5s' }} />

        {/* Medium particles */}
        <div className="animate-float-medium absolute top-[40%] left-[18%] w-16 h-16 rounded-full bg-white/15" style={{ animationDelay: '1s' }} />
        <div className="animate-float-medium absolute top-[10%] left-[45%] w-20 h-20 rounded-full bg-healing-mint/20" style={{ animationDelay: '4s' }} />
        <div className="animate-float-medium absolute top-[70%] left-[50%] w-14 h-14 rounded-full bg-white/10" style={{ animationDelay: '2s' }} />
        <div className="animate-float-medium absolute bottom-[20%] left-[20%] w-20 h-20 rounded-full bg-healing-mint/15" style={{ animationDelay: '5s' }} />

        {/* Small fast particles */}
        <div className="animate-float-fast absolute top-[30%] left-[35%] w-8 h-8 rounded-full bg-white/20" style={{ animationDelay: '0.5s' }} />
        <div className="animate-float-fast absolute top-[55%] left-[12%] w-10 h-10 rounded-full bg-healing-mint/25" style={{ animationDelay: '2.5s' }} />
        <div className="animate-float-fast absolute top-[20%] left-[60%] w-8 h-8 rounded-full bg-white/15" style={{ animationDelay: '3.5s' }} />
        <div className="animate-float-fast absolute bottom-[30%] left-[42%] w-6 h-6 rounded-full bg-white/20" style={{ animationDelay: '1s' }} />
      </div>
    </section>
  );
};
