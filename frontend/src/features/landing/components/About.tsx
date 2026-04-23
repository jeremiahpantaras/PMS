import React from 'react';
import { Target, Award, Users } from 'lucide-react';

export const About: React.FC = () => {
  const values = [
    {
      icon: Target,
      title: 'Mission-Driven',
      description: 'Empowering healthcare providers with technology that simplifies practice management.',
      color: 'cyan'
    },
    {
      icon: Award,
      title: 'Quality First',
      description: 'Built with best practices, security, and compliance at the core of everything we do.',
      color: 'purple'
    },
    {
      icon: Users,
      title: 'Customer-Centric',
      description: 'Your success is our priority. We listen, adapt, and continuously improve.',
      color: 'green'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'cyan':
        return 'bg-care-blue/10 text-care-blue';
      case 'purple':
        return 'bg-purple-50 text-purple-600';
      case 'green':
        return 'bg-healing-mint/20 text-healing-mint';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <section id="about" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 font-display">
            Built for Healthcare Professionals
          </h2>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed font-body">
            We understand the challenges of running a modern practice. That's why we created 
            a platform that combines simplicity with powerful features.
          </p>
        </div>

        {/* Values Grid - 3 Cards iOS-like design with color accents */}
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300"
              >
                <div className={`w-14 h-14 ${getColorClasses(value.color)} rounded-2xl flex items-center justify-center mb-6`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 font-display">
                  {value.title}
                </h3>
                <p className="text-base text-gray-600 leading-relaxed font-body">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom Container */}
        <div className="mt-16 bg-gradient-to-r from-clinical-cloud to-care-blue/5 rounded-3xl p-10 sm:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed font-body">
              Founded by healthcare professionals and technologists, Malasakit EMR Solution was born from 
              firsthand experience with outdated practice management systems. We believe 
              that technology should enhance patient care, not complicate it.
            </p>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed font-body">
              Today, we serve over 10,000 practitioners across multiple specialties, 
              helping them save time, reduce errors, and focus on what matters most—their patients.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
