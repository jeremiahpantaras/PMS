import React, { useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

export const DemoPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-primary-gradient pt-40 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[150%] bg-white/5 rotate-12 blur-3xl rounded-full pointer-events-none"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[120%] bg-healing-mint/20 rotate-[-15deg] blur-3xl rounded-full pointer-events-none"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 font-display">
            Malasakit System Demo
          </h1>
          <p className="text-xl text-white/90 font-body max-w-2xl mx-auto leading-relaxed">
            Discover how easy it is to manage your clinic. Follow our step-by-step video guides to get started and master the platform.
          </p>
        </div>
      </div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        
        {/* Video Guide 1 */}
        <div className="mb-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-block px-4 py-1.5 bg-blue-50 text-care-blue font-semibold rounded-full text-sm mb-4 border border-blue-100">Video Guide #1</div>
              <h2 className="text-3xl md:text-4xl font-bold text-trust-harbor font-heading tracking-tight">Getting Started: Sign Up to Clinic Setup</h2>
            </div>
          </div>
          
          <div className="bg-white rounded-[2rem] p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.12)]">
            <div className="aspect-video bg-gray-900 rounded-3xl overflow-hidden relative group">
              {/* Placeholder for Video - Replace src with actual video URL when ready */}
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white flex-col z-0">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm cursor-pointer">
                  <svg className="w-10 h-10 text-white translate-x-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-gray-400 font-medium">Video Guide Upload Placeholder</p>
              </div>
              {/* Hidden Video Tag to show structure. It will overlay the placeholder when a src is added and opacity is adjusted */}
              <video className="w-full h-full object-cover relative z-10 opacity-0" controls>
                <source src="" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            
            <div className="mt-10 px-2 sm:px-8 pb-4">
              <h3 className="text-2xl font-bold text-gray-800 mb-10 text-center md:text-left">Step-by-Step Process</h3>
              
              <div className="relative">
                {/* Connecting Line (Desktop) */}
                <div className="hidden md:block absolute top-[28px] left-[50px] right-[50px] h-1 bg-gray-100 z-0 rounded-full">
                  <div className="h-full bg-care-blue/20 rounded-full" style={{ width: '100%' }}></div>
                </div>
                
                {/* Connecting Line (Mobile) */}
                <div className="md:hidden absolute top-[50px] bottom-[50px] left-[28px] w-1 bg-gray-100 z-0 rounded-full">
                   <div className="w-full bg-care-blue/20 rounded-full" style={{ height: '100%' }}></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 relative z-10">
                  {/* Step 1 */}
                  <div className="flex flex-row md:flex-col items-start md:items-center text-left md:text-center relative">
                    <div className="w-14 h-14 rounded-full bg-care-blue text-white flex items-center justify-center font-bold text-xl mb-0 md:mb-5 border-4 border-white shadow-md shrink-0 mr-5 md:mr-0 z-10">1</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg mb-2">Signing Up</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">Register your new account on the platform and verify your credentials.</p>
                    </div>
                  </div>
                  
                  {/* Step 2 */}
                  <div className="flex flex-row md:flex-col items-start md:items-center text-left md:text-center relative">
                    <div className="w-14 h-14 rounded-full bg-white text-care-blue flex items-center justify-center font-bold text-xl mb-0 md:mb-5 border-4 border-care-blue shadow-md shrink-0 mr-5 md:mr-0 z-10">2</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg mb-2">Creating Owner/Admin Account</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">Set up your administrative roles, security settings, and access control.</p>
                    </div>
                  </div>
                  
                  {/* Step 3 */}
                  <div className="flex flex-row md:flex-col items-start md:items-center text-left md:text-center relative">
                    <div className="w-14 h-14 rounded-full bg-white text-care-blue flex items-center justify-center font-bold text-xl mb-0 md:mb-5 border-4 border-gray-200 shadow-sm shrink-0 mr-5 md:mr-0 z-10">3</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg mb-2">Clinic Setup</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">Configure your clinic details, establish services, and operational standards.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Video Guide 2 */}
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-block px-4 py-1.5 bg-green-50 text-emerald-600 font-semibold rounded-full text-sm mb-4 border border-green-100">Video Guide #2</div>
              <h2 className="text-3xl md:text-4xl font-bold text-trust-harbor font-heading tracking-tight">Creating Appointments</h2>
            </div>
          </div>
          
          <div className="bg-white rounded-[2rem] p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.12)]">
            <div className="aspect-video bg-gray-900 rounded-3xl overflow-hidden relative group">
              {/* Placeholder for Video - Replace src with actual video URL when ready */}
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white flex-col z-0">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm cursor-pointer">
                  <svg className="w-10 h-10 text-white translate-x-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-gray-400 font-medium">Video Guide Upload Placeholder</p>
              </div>
              <video className="w-full h-full object-cover relative z-10 opacity-0" controls>
                <source src="" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            
            <div className="mt-8 px-2 sm:px-8 pb-4">
              <p className="text-gray-600 text-lg leading-relaxed max-w-3xl">
                Learn how to effortlessly schedule, manage, and track patient appointments using our intuitive calendar system. This guide covers adding new patients, setting appointment types, and managing clinic schedules.
              </p>
            </div>
          </div>
        </div>

      </main>
      
      <Footer />
    </div>
  );
};
