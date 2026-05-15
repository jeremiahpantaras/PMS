import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarDays, Clock, Building2, User,
  CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import axios from 'axios';

type PageState = 'loading' | 'success' | 'expired' | 'used' | 'error';

interface ConfirmResponse {
  detail: string;
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  clinic_name: string;
  patient_name: string;
}

export function AppointmentConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [data, setData] = useState<ConfirmResponse | null>(null);

  useEffect(() => {
    if (!token) { setPageState('error'); return; }

    const controller = new AbortController();

    axios
      .post(`/api/appointments/confirm-email/${token}/`, {}, { signal: controller.signal })
      .then(res => {
        setData(res.data as ConfirmResponse);
        setPageState('success');
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        if (axios.isAxiosError(err) && err.response?.status === 410) {
          const code = err.response.data?.code;
          setPageState(code === 'used' ? 'used' : 'expired');
        } else {
          setPageState('error');
        }
      });

    return () => controller.abort();
  }, [token]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Confirming your appointment…</p>
        </div>
      </div>
    );
  }

  // ── Terminal states: expired / used / error ────────────────────────────────
  if (pageState === 'expired' || pageState === 'used' || pageState === 'error') {
    const configs = {
      expired: {
        icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
        title: 'Link Expired',
        message: 'This confirmation link has expired (links are valid for 48 hours). Please contact the clinic to confirm your appointment.',
      },
      used: {
        icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
        title: 'Already Confirmed',
        message: 'Your appointment has already been confirmed. See you then!',
      },
      error: {
        icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
        title: 'Invalid Link',
        message: 'This confirmation link is invalid or could not be found. Please contact the clinic.',
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
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Appointment Confirmed!</h1>
        <p className="text-sm text-gray-500 mb-6">
          Thanks{data?.patient_name ? `, ${data.patient_name.split(' ')[0]}` : ''}! We look forward to seeing you.
        </p>

        {data && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{data.appointment_date}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{data.appointment_time}</span>
            </div>
            {data.patient_name && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{data.patient_name}</span>
              </div>
            )}
            {data.clinic_name && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{data.clinic_name}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400">
          If you need to reschedule, please contact the clinic directly.
        </p>
      </div>
    </div>
  );
}
