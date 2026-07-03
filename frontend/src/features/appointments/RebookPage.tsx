import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, XCircle, CalendarDays, User, Building2 } from 'lucide-react';
import {
  getRebookingDetails,
  submitRebooking,
  cancelRebooking,
  type RebookingDetails,
} from '@/services/rebook.api';
import { RebookCalendar } from '@/features/appointments/components/RebookCalendar';
import axios from 'axios';

type PageState = 'loading' | 'form' | 'success' | 'cancelled' | 'expired' | 'used' | 'error';

export function RebookPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [details, setDetails] = useState<RebookingDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setPageState('error'); return; }
    getRebookingDetails(token)
      .then(d => { setDetails(d); setPageState('form'); })
      .catch(err => {
        if (axios.isAxiosError(err) && err.response?.status === 410) {
          const code = err.response.data?.code;
          setPageState(code === 'used' ? 'used' : 'expired');
        } else {
          setPageState('error');
        }
      });
  }, [token]);

  const handleConfirm = async (date: string, startTime: string, endTime: string) => {
    if (!token) return;
    setErrorMsg('');
    try {
      await submitRebooking(token, { date, start_time: startTime, end_time: endTime });
      setPageState('success');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        const code = err.response?.data?.code;
        if (code === 'used') { setPageState('used'); return; }
        if (code === 'expired') { setPageState('expired'); return; }
        setErrorMsg(detail || 'Something went wrong. Please try again.');
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
    }
  };

  const handleCancel = async () => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to cancel your appointment?')) {
      return;
    }
    setErrorMsg('');
    try {
      await cancelRebooking(token);
      setPageState('cancelled');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        const code = err.response?.data?.code;
        if (code === 'used') { setPageState('used'); return; }
        if (code === 'expired') { setPageState('expired'); return; }
        setErrorMsg(detail || 'Something went wrong. Please try again.');
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-[#0575E6] animate-spin" />
      </div>
    );
  }

  if (pageState === 'expired' || pageState === 'used' || pageState === 'error' || pageState === 'cancelled') {
    const configs = {
      expired: {
        icon: <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500" />,
        title: 'Link Expired',
        message: 'This rebooking link has expired. Please contact the clinic to request a new one.',
        color: 'amber',
      },
      used: {
        icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
        title: 'Already Used',
        message: 'This rebooking link has already been used. Your appointment was successfully booked.',
        color: 'green',
      },
      error: {
        icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
        title: 'Invalid Link',
        message: 'This rebooking link is invalid or could not be found. Please contact the clinic.',
        color: 'red',
      },
      cancelled: {
        icon: <XCircle className="w-12 h-12 text-gray-500" />,
        title: 'Appointment Cancelled',
        message: 'Your appointment has been cancelled. Please contact the clinic if you need to reschedule.',
        color: 'gray',
      },
    };
    const cfg = configs[pageState];
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-2 sm:px-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-md p-6 sm:p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">{cfg.icon}</div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{cfg.title}</h1>
          <p className="text-gray-500 text-xs sm:text-sm leading-relaxed">{cfg.message}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-primary-gradient flex items-center justify-center px-2 sm:px-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-500" />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">Appointment Booked!</h1>
          <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
            Your appointment has been successfully scheduled. The clinic will be in touch to confirm.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'form' && details) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-2 sm:px-4 py-4 sm:py-8">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-md w-full max-w-2xl overflow-hidden">
          <div className="bg-primary-gradient px-4 sm:px-8 py-4 sm:py-6">
            <p className="text-white/80 text-xs sm:text-sm">Reschedule for</p>
            <h1 className="text-white text-xl sm:text-2xl font-bold mt-1">
              {details.patient_first_name}
            </h1>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5">{details.clinic_name}</p>
          </div>

          <div className="px-3 sm:px-8 py-3 sm:py-4 border-b border-gray-100 space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0575E6] shrink-0" />
              <span className="truncate"><span className="text-gray-400">Practitioner:</span> {details.practitioner_name}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0575E6] shrink-0" />
              <span className="truncate"><span className="text-gray-400">Service:</span> {details.service_name}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0575E6] shrink-0" />
              <span className="truncate">
                <span className="text-gray-400">Original:</span>{' '}
                {details.original_date} at {details.original_start_time}
              </span>
            </div>
          </div>

          <div className="p-2 sm:p-4">
            {errorMsg && (
              <p className="text-red-600 text-xs sm:text-sm bg-red-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 mb-2 sm:mb-3">{errorMsg}</p>
            )}
            <RebookCalendar
              token={token!}
              details={details}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}