import React, { useEffect, useState, useCallback } from 'react';
import {
  Mail, MessageSquare, Bell, RefreshCw, Save,
  CheckCircle, AlertCircle, Info, Clock, Users,
  CalendarX, UserPlus, RotateCcw,
} from 'lucide-react';
import { communicationApi } from '@/features/setup/services/communication.api';
import type { CommunicationSettings } from '@/features/setup/services/communication.api';

// ── Types ────────────────────────────────────────────────────────────────────

type Channel = 'EMAIL' | 'SMS' | 'BOTH';

interface ReminderTypeConfig {
  key: keyof CommunicationSettings;           // enabled toggle field
  methodKey: keyof CommunicationSettings;     // channel field
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultChannel: Channel;
  timingKey?: keyof CommunicationSettings;    // optional numeric timing field
  timingLabel?: string;
  timingUnit?: string;
  bestPractice: Channel;
  bestPracticeReason: string;
}

const REMINDER_TYPES: ReminderTypeConfig[] = [
  {
    key: 'booking_confirmations_enabled',
    methodKey: 'booking_confirmation_method',
    label: 'Booking Confirmation',
    description: 'Sent immediately when an appointment is created or a recurring series is booked.',
    icon: <CheckCircle className="w-4 h-4" />,
    defaultChannel: 'EMAIL',
    bestPractice: 'BOTH',
    bestPracticeReason: 'Email provides a printable reference; SMS ensures the patient sees it quickly.',
  },
  {
    key: 'reminders_enabled',
    methodKey: 'reminder_method',
    label: 'Appointment Reminder',
    description: 'Sent ahead of the appointment to prompt a Y/N confirmation from the patient.',
    icon: <Bell className="w-4 h-4" />,
    defaultChannel: 'SMS',
    timingKey: 'reminder_hours_before',
    timingLabel: 'Hours before appointment',
    timingUnit: 'hours',
    bestPractice: 'SMS',
    bestPracticeReason: 'SMS reminders get significantly higher open rates closer to the appointment time.',
  },
  {
    key: 'cancellation_enabled',
    methodKey: 'cancellation_method',
    label: 'Appointment Cancellation',
    description: 'Notifies the patient when their appointment is cancelled.',
    icon: <CalendarX className="w-4 h-4" />,
    defaultChannel: 'SMS',
    bestPractice: 'SMS',
    bestPracticeReason: 'Cancellations require immediate awareness — SMS is the fastest channel.',
  },
  {
    key: 'dna_followup_enabled',
    methodKey: 'dna_followup_method',
    label: 'DNA / Did Not Attend Follow-up',
    description: 'Follow-up message with a secure rebooking link sent after the patient misses an appointment.',
    icon: <AlertCircle className="w-4 h-4" />,
    defaultChannel: 'SMS',
    bestPractice: 'SMS',
    bestPracticeReason: 'A brief SMS with a direct rebook link converts more missed appointments into reschedules.',
  },
  {
    key: 'rebook_followup_enabled',
    methodKey: 'rebook_followup_method',
    label: 'No-Rebook Follow-up',
    description: 'Delayed outreach if the patient hasn\'t rebooked after a DNA.',
    icon: <RotateCcw className="w-4 h-4" />,
    defaultChannel: 'EMAIL',
    timingKey: 'no_rebook_followup_days',
    timingLabel: 'Days after DNA',
    timingUnit: 'days',
    bestPractice: 'EMAIL',
    bestPracticeReason: 'A warm email with a personalised message works better for long-gap re-engagement.',
  },
  {
    key: 'inactive_checkin_enabled',
    methodKey: 'inactive_checkin_method',
    label: 'Inactive Patient Check-in',
    description: 'Wellness check-in for patients who haven\'t visited in a while.',
    icon: <Users className="w-4 h-4" />,
    defaultChannel: 'EMAIL',
    timingKey: 'inactive_patient_months',
    timingLabel: 'Months of inactivity',
    timingUnit: 'months',
    bestPractice: 'EMAIL',
    bestPracticeReason: 'Email allows richer personalised content for re-engagement after longer gaps.',
  },
  {
    key: 'profile_creation_enabled',
    methodKey: 'profile_creation_method',
    label: 'New Patient Profile',
    description: 'Notification sent when a new patient profile is created in the system.',
    icon: <UserPlus className="w-4 h-4" />,
    defaultChannel: 'EMAIL',
    bestPractice: 'EMAIL',
    bestPracticeReason: 'Welcome emails with clinic details and portal access instructions are best delivered via email.',
  },
];

// ── Channel selector ─────────────────────────────────────────────────────────

const CHANNEL_OPTIONS: { value: Channel; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'EMAIL',
    label: 'Email',
    icon: <Mail className="w-3.5 h-3.5" />,
    color: 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-400',
  },
  {
    value: 'SMS',
    label: 'SMS',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: 'bg-green-100 text-green-700 border-green-300 ring-green-400',
  },
  {
    value: 'BOTH',
    label: 'Both',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    color: 'bg-violet-100 text-violet-700 border-violet-300 ring-violet-400',
  },
];

interface ChannelPickerProps {
  value: Channel;
  onChange: (v: Channel) => void;
  disabled?: boolean;
}

const ChannelPicker: React.FC<ChannelPickerProps> = ({ value, onChange, disabled }) => (
  <div className="flex gap-1.5">
    {CHANNEL_OPTIONS.map(opt => (
      <button
        key={opt.value}
        type="button"
        disabled={disabled}
        onClick={() => onChange(opt.value)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}
          ${value === opt.value
            ? `${opt.color} ring-2 shadow-sm`
            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}
        `}
      >
        {opt.icon}
        {opt.label}
      </button>
    ))}
  </div>
);

// ── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-emerald-500' : 'bg-gray-200'}`}
    role="switch"
    aria-checked={checked}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}
    />
  </button>
);

// ── Main component ───────────────────────────────────────────────────────────

export const EmailReminder: React.FC = () => {
  const [settings, setSettings] = useState<CommunicationSettings | null>(null);
  const [draft, setDraft] = useState<Partial<CommunicationSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isDirty = Object.keys(draft).length > 0;

  useEffect(() => {
    setLoading(true);
    communicationApi.getSettings()
      .then(data => { setSettings(data); setDraft({}); })
      .finally(() => setLoading(false));
  }, []);

  const merged = { ...settings, ...draft } as CommunicationSettings;

  const patch = useCallback(<K extends keyof CommunicationSettings>(key: K, value: CommunicationSettings[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  }, []);

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const updated = await communicationApi.updateSettings(draft);
      setSettings(updated);
      setDraft({});
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setErrorMsg('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => { setDraft({}); setSaveStatus('idle'); };

  const applyBestPractices = () => {
    const bp: Partial<CommunicationSettings> = {};
    for (const rt of REMINDER_TYPES) {
      (bp as Record<string, unknown>)[rt.methodKey as string] = rt.bestPractice;
    }
    setDraft(prev => ({ ...prev, ...bp }));
    setSaveStatus('idle');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading communication settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Communication Channel Settings</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure which channel (Email, SMS, or Both) is used for each reminder type.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={applyBestPractices}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            Apply Best Practices
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              isDirty && !saving
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Save className="w-3.5 h-3.5" /> Save Changes</>
            }
          </button>
        </div>
      </div>

      {/* ── Status banner ── */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Settings saved successfully.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600">
        <span className="font-medium text-gray-700">Channel options:</span>
        {CHANNEL_OPTIONS.map(opt => (
          <span key={opt.value} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${opt.color}`}>
            {opt.icon} {opt.label}
          </span>
        ))}
        <span className="ml-auto text-gray-400">Toggle the switch to enable / disable each reminder type</span>
      </div>

      {/* ── Reminder type rows ── */}
      <div className="space-y-3">
        {REMINDER_TYPES.map(rt => {
          const enabled = !!merged[rt.key];
          const channel = (merged[rt.methodKey] ?? rt.defaultChannel) as Channel;
          const hasDraftChange = rt.key in draft || rt.methodKey in draft
            || (rt.timingKey && rt.timingKey in draft);

          return (
            <div
              key={rt.key as string}
              className={`rounded-xl border transition-all ${
                enabled
                  ? `bg-white border-gray-200 ${hasDraftChange ? 'ring-2 ring-orange-200' : ''}`
                  : 'bg-gray-50/70 border-gray-100 opacity-70'
              }`}
            >
              <div className="flex items-start gap-4 p-4">
                {/* Icon */}
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  enabled ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {rt.icon}
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{rt.label}</span>
                    {hasDraftChange && (
                      <span className="text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">unsaved</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rt.description}</p>

                  {/* Best practice hint */}
                  <p className="text-[11px] text-gray-400 mt-1 italic">
                    💡 Best practice: <span className="text-gray-500 not-italic font-medium">{rt.bestPractice === 'BOTH' ? 'Email & SMS' : rt.bestPractice}</span> — {rt.bestPracticeReason}
                  </p>
                </div>

                {/* Channel picker (only when enabled) */}
                <div className="shrink-0 flex flex-col items-end gap-2.5">
                  <Toggle
                    checked={enabled}
                    onChange={v => patch(rt.key, v as CommunicationSettings[typeof rt.key])}
                  />
                  <ChannelPicker
                    value={channel}
                    disabled={!enabled}
                    onChange={v => patch(rt.methodKey, v as CommunicationSettings[typeof rt.methodKey])}
                  />
                </div>
              </div>

              {/* Optional timing row */}
              {rt.timingKey && enabled && (
                <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-3 bg-gray-50/50 rounded-b-xl">
                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <label className="text-xs text-gray-600 font-medium">{rt.timingLabel}:</label>
                  <input
                    type="number"
                    min={1}
                    max={rt.timingUnit === 'hours' ? 168 : rt.timingUnit === 'months' ? 24 : 365}
                    value={(merged[rt.timingKey] as number) ?? 1}
                    onChange={e => patch(rt.timingKey!, Number(e.target.value) as CommunicationSettings[typeof rt.timingKey])}
                    className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                  />
                  <span className="text-xs text-gray-400">{rt.timingUnit}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer note ── */}
      <p className="text-xs text-gray-400 leading-relaxed px-1">
        Channel settings apply per clinic. Master SMS / Email switches in clinic settings take precedence.
        Individual patient preferences (opt-out) are also respected when dispatching messages.
      </p>
    </div>
  );
};
