import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Briefcase } from 'lucide-react';

export const Careers: React.FC = () => {
  const positions = [
    {
      title: 'Senior Full Stack Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time'
    },
    {
      title: 'Product Manager',
      department: 'Product',
      location: 'Bacolod City',
      type: 'Full-time'
    },
    {
      title: 'Healthcare Compliance Specialist',
      department: 'Operations',
      location: 'Remote',
      type: 'Full-time'
    },
    {
      title: 'Customer Success Manager',
      department: 'Sales & Support',
      location: 'Bacolod City',
      type: 'Full-time'
    },
    {
      title: 'UX/UI Designer',
      department: 'Design',
      location: 'Remote',
      type: 'Full-time'
    },
    {
      title: 'DevOps Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <div className="bg-primary-gradient py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center text-healing-mint hover:text-white transition-colors mb-6">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold">Careers</h1>
          <p className="text-xl text-white/70 mt-2">Join our team and help transform healthcare</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Why Join Us */}
        <div className="mb-16 bg-gray-800/50 rounded-lg p-12 border border-white/10">
          <h2 className="text-3xl font-bold mb-6">Why Join Malasakit?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-healing-mint text-lg mb-2">Mission-Driven</h3>
              <p className="text-white/70">
                Work on a product that positively impacts healthcare delivery and patient outcomes.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-healing-mint text-lg mb-2">Collaborative Culture</h3>
              <p className="text-white/70">
                Join a talented team that values innovation, creativity, and continuous learning.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-healing-mint text-lg mb-2">Growth Opportunities</h3>
              <p className="text-white/70">
                Develop your skills and advance your career with a rapidly growing company.
              </p>
            </div>
          </div>
        </div>

        {/* Open Positions */}
        <h2 className="text-3xl font-bold mb-8">Open Positions</h2>
        <div className="space-y-4 mb-16">
          {positions.map((position, index) => (
            <div
              key={index}
              className="bg-gray-800/50 rounded-lg p-6 border border-white/10 hover:border-healing-mint/50 transition-all hover:shadow-lg cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 hover:text-healing-mint transition-colors">
                    {position.title}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-white/70 text-sm">
                    <span className="flex items-center">
                      <Briefcase className="w-4 h-4 mr-2" />
                      {position.department}
                    </span>
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      {position.location}
                    </span>
                    <span className="bg-healing-mint/20 text-healing-mint px-3 py-1 rounded-full">
                      {position.type}
                    </span>
                  </div>
                </div>
                <button className="text-healing-mint hover:text-white transition-colors font-bold">
                  View →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <div className="bg-gray-800/50 rounded-lg p-12 border border-white/10 mb-16">
          <h2 className="text-3xl font-bold mb-8">Benefits & Perks</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex items-start">
              <span className="text-healing-mint text-2xl mr-4">✓</span>
              <div>
                <h3 className="font-bold mb-1">Competitive Salary</h3>
                <p className="text-white/70">Industry-competitive compensation packages</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-healing-mint text-2xl mr-4">✓</span>
              <div>
                <h3 className="font-bold mb-1">Health Insurance</h3>
                <p className="text-white/70">Comprehensive medical, dental, and vision coverage</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-healing-mint text-2xl mr-4">✓</span>
              <div>
                <h3 className="font-bold mb-1">Flexible Work</h3>
                <p className="text-white/70">Remote and flexible working arrangements</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-healing-mint text-2xl mr-4">✓</span>
              <div>
                <h3 className="font-bold mb-1">Professional Development</h3>
                <p className="text-white/70">Training budget and career development opportunities</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-healing-mint/20 to-blue-600/20 rounded-lg p-12 text-center border border-healing-mint/50">
          <h2 className="text-3xl font-bold mb-4">Ready to Make an Impact?</h2>
          <p className="text-xl text-white/70 mb-8">Send us your resume and let's talk about your future</p>
          <a
            href="mailto:careers@malasakit.com"
            className="inline-block bg-healing-mint text-gray-900 px-8 py-3 rounded-lg font-bold hover:bg-white transition-colors"
          >
            Apply Now
          </a>
        </div>
      </div>
    </div>
  );
};
