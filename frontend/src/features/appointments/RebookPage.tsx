import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, Clock, User, Building2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  getRebookingDetails,
  submitRebooking,
  type RebookingDetails,
} from '@/services/rebook.api';
import axios from 'axios';

type PageState = 'loading' | 'form' | 'success' | 'expired' | 'used' | 'error';

export function RebookPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [details, setDetails]     = useState<RebookingDetails | null>(null);
  const [date, setDate]           = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');

  // Auto-compute end time when date or start time changes (60 min default)
  useEffect(() => {
    if (!startTime) return;
    const [h, m] = startTime.split(':').map(Number);
    const total = h * 60 + m + 60;
    const eh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const em = String(total % 60).padStart(2, '0');
    setEndTime(`${eh}:${em}`);
  }, [startTime]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!date || !startTime || !endTime) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      await submitRebooking(token, { date, start_time: startTime, end_time: endTime });
      setPageState('success');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        const code   = err.response?.data?.code;
        if (code === 'used')    { setPageState('used');    return; }
        if (code === 'expired') { setPageState('expired'); return; }
        setErrorMsg(detail || 'Something went wrong. Please try again.');
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // ── Error states ──────────────────────────────────────────────────────────
  if (pageState === 'expired' || pageState === 'used' || pageState === 'error') {
    const configs = {
      expired: {
        icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
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
    };
    const cfg = configs[pageState];
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">{cfg.icon}</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{cfg.title}</h1>
          <p className="text-gray-500 text-sm leading-relaxed">{cfg.message}</p>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Appointment Booked!</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your appointment has been successfully scheduled. The clinic will be in touch to confirm.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-8 py-6">
          <p className="text-indigo-200 text-sm">Rebooking for</p>
          <h1 className="text-white text-2xl font-bold mt-1">
            {details?.patient_first_name}
          </h1>
          <p className="text-indigo-200 text-sm mt-0.5">{details?.clinic_name}</p>
        </div>

        {/* Details card */}
        <div className="px-8 py-6 border-b border-gray-100 space-y-3">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <User className="w-4 h-4 text-indigo-400 shrink-0" />
            <span><span className="text-gray-400">Practitioner:</span> {details?.practitioner_name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span><span className="text-gray-400">Service:</span> {details?.service_name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <CalendarDays className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <span className="text-gray-400">Original appointment:</span>{' '}
              {details?.original_date} at {details?.original_start_time}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          <p className="text-sm text-gray-500">
            Please select a new date and time for your appointment.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <CalendarDays className="inline w-4 h-4 mr-1 text-gray-400" />
              New Date
            </label>
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="inline w-4 h-4 mr-1 text-gray-400" />
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="inline w-4 h-4 mr-1 text-gray-400" />
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Booking…' : 'Confirm Appointment'}
          </button>
        </form>
      </div>
    </div>
  );
}
