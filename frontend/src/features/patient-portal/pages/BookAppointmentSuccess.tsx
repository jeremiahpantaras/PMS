import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, User, Stethoscope, MapPin } from 'lucide-react';
import type { BookingConfirmation } from '../types/portal';

const fmt12 = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export const BookAppointmentSuccess: React.FC = () => {
  const { token }    = useParams<{ token: string }>();
  const { state }    = useLocation();
  const navigate     = useNavigate();
  const confirmation = state?.confirmation as BookingConfirmation | undefined;

  const closePage = () => navigate(`/portal/${token}`);

  const [countdown, setCountdown] = useState(8);

  // Auto-close after 8 seconds with visible countdown
  useEffect(() => {
    if (!confirmation) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); navigate(`/portal/${token}`); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!confirmation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-500">No booking information found.</p>
          <button onClick={closePage} className="mt-4 inline-block text-sky-500 underline text-sm">
            Go back to booking portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">

        {/* Brand Logo */}
        <div className="bg-white px-6 pt-6 pb-4 flex justify-center">
          <img
            src="/assets/malasakit/Primary Logo - Colored.svg"
            alt="Malasakit Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Header */}
        <div className="bg-primary-gradient px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Booking Confirmed!</h1>
          <p className="text-white/80 text-sm mt-1">
            Your appointment has been successfully booked.
          </p>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-4">

          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Patient</p>
              <p className="text-sm font-semibold text-gray-900">
                {confirmation.patient_first_name} {confirmation.patient_last_name}
              </p>
              <p className="text-xs text-gray-500">{confirmation.patient_email}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Stethoscope className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Service</p>
              <p className="text-sm font-semibold text-gray-900">{confirmation.service_name}</p>
              <p className="text-xs text-gray-500">{confirmation.service_duration} minutes</p>
              {confirmation.practitioner_name && (
                <p className="text-xs text-gray-500">with {confirmation.practitioner_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Date & Time</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(confirmation.appointment_date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
              <p className="text-xs text-gray-500">{fmt12(confirmation.appointment_time)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Clinic</p>
              <p className="text-sm font-semibold text-gray-900">{confirmation.clinic_name}</p>
            </div>
          </div>
        </div>

        {/* Notice */}
        <div className="mx-6 mb-5 bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs text-green-700 text-center">
            A confirmation email has been sent to <strong>{confirmation.patient_email}</strong>.
            Please arrive a few minutes early for your appointment.
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={closePage}
            className="btn-primary block w-full text-center py-2.5 text-sm font-semibold rounded-xl"
          >
            Close Page ({countdown}s)
          </button>
        </div>
      </div>
    </div>
  );
};