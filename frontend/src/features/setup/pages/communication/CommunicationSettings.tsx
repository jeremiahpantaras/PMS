import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Mail, Clock,
  ChevronDown, ChevronRight, AlertCircle, Check, Loader2,
  Phone, Send, UserX, CalendarX, Heart,
} from 'lucide-react';
import { communicationApi, type CommunicationSettings } from '../../services/communication.api';

// ── Toggle Switch ──────────────────────────────────────────────────────────
function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2
        ${enabled ? 'bg-sky-500' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full
          bg-white shadow ring-0 transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// ── Channel Select ─────────────────────────────────────────────────────────
function ChannelSelect({
  value,
  onChange,
}: {
  value: 'EMAIL' | 'SMS' | 'BOTH';
  onChange: (val: 'EMAIL' | 'SMS' | 'BOTH') => void;
}) {
  const options: { value: 'EMAIL' | 'SMS' | 'BOTH'; label: string; icon: React.ReactNode }[] = [
    { value: 'EMAIL', label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
    { value: 'SMS', label: 'SMS', icon: <Phone className="w-3.5 h-3.5" /> },
    { value: 'BOTH', label: 'Both', icon: <Send className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
            ${value === opt.value
              ? 'bg-sky-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'}
            ${opt.value !== 'EMAIL' ? 'border-l border-gray-200' : ''}
          `}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Section Component ──────────────────────────────────────────────────────
function SettingsSection({
  title,
  description,
  icon: Icon,
  iconColor,
  children,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  enabled: boolean;
  onToggle: (val: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 bg-white cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle enabled={enabled} onChange={onToggle} />
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>
      {expanded && enabled && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/30 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Number Input ───────────────────────────────────────────────────────────
function NumberSetting({
  label,
  description,
  value,
  onChange,
  min = 1,
  max = 365,
  suffix,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  suffix: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-medium text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n >= min && n <= max) onChange(n);
          }}
          min={min}
          max={max}
          className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
        />
        <span className="text-xs text-gray-500 w-12">{suffix}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CommunicationSettingsPage() {
  const [settings, setSettings] = useState<CommunicationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await communicationApi.getSettings();
      setSettings(data);
      setError(null);
    } catch {
      setError('Failed to load communication settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateField = async <K extends keyof CommunicationSettings>(
    field: K,
    value: CommunicationSettings[K],
  ) => {
    if (!settings) return;

    const prev = { ...settings };
    setSettings({ ...settings, [field]: value });
    setSuccessMsg(null);

    try {
      setSaving(true);
      const updated = await communicationApi.updateSettings({ [field]: value });
      setSettings(updated);
      setSuccessMsg('Settings saved');
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch {
      setSettings(prev);
      setError('Failed to save setting.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        <span className="ml-2 text-sm text-gray-500">Loading settings...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <span className="ml-2 text-sm text-red-600">{error || 'Failed to load settings.'}</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Bell className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-bold text-gray-900">Automated Communication Settings</h2>
          {saving && (
            <div className="flex items-center gap-1 text-xs text-sky-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <Check className="w-3 h-3" />
              {successMsg}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Configure automated patient communications including booking confirmations,
          reminders, follow-ups, and wellness check-ins.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* 1. Booking Confirmations */}
        <SettingsSection
          title="Booking Confirmations"
          description="Send confirmation when an appointment is booked"
          icon={Check}
          iconColor="bg-emerald-50 text-emerald-600"
          enabled={settings.booking_confirmations_enabled}
          onToggle={(val) => updateField('booking_confirmations_enabled', val)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-gray-700">Delivery Channel</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                How patients receive booking confirmations
              </p>
            </div>
            <ChannelSelect
              value={settings.booking_confirmation_method}
              onChange={(val) => updateField('booking_confirmation_method', val)}
            />
          </div>
        </SettingsSection>

        {/* 2. Appointment Reminders */}
        <SettingsSection
          title="Appointment Reminders"
          description="Remind patients before their appointment (Y/N reply)"
          icon={Clock}
          iconColor="bg-amber-50 text-amber-600"
          enabled={settings.reminders_enabled}
          onToggle={(val) => updateField('reminders_enabled', val)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-gray-700">Delivery Channel</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                How patients receive reminders
              </p>
            </div>
            <ChannelSelect
              value={settings.reminder_method}
              onChange={(val) => updateField('reminder_method', val)}
            />
          </div>
          <NumberSetting
            label="Reminder Timing"
            description="Hours before the appointment"
            value={settings.reminder_hours_before}
            onChange={(val) => updateField('reminder_hours_before', val)}
            min={1}
            max={168}
            suffix="hours"
          />
          <div className="bg-sky-50 rounded-lg px-4 py-3">
            <p className="text-[11px] text-sky-700">
              <strong>How it works:</strong> Patients receive a message asking them to reply
              <span className="font-mono mx-1 bg-sky-100 px-1 rounded">Y</span> to confirm
              or <span className="font-mono mx-1 bg-sky-100 px-1 rounded">N</span> if unable to attend.
              Declined appointments automatically trigger a rescheduling follow-up.
            </p>
          </div>
        </SettingsSection>

        {/* 3. DNA / Decline Follow-up */}
        <SettingsSection
          title="DNA / Decline Follow-up"
          description="Auto-send reschedule link for missed or declined appointments"
          icon={UserX}
          iconColor="bg-red-50 text-red-600"
          enabled={settings.dna_followup_enabled}
          onToggle={(val) => updateField('dna_followup_enabled', val)}
        >
          <div className="bg-red-50 rounded-lg px-4 py-3">
            <p className="text-[11px] text-red-700">
              <strong>Triggered when:</strong> A patient is marked as DNA/No-Show, or replies
              <span className="font-mono mx-1 bg-red-100 px-1 rounded">N</span> to a reminder.
              Opens the branch-specific booking portal for easy rescheduling.
            </p>
          </div>
        </SettingsSection>

        {/* 4. No-Rebook Follow-up */}
        <SettingsSection
          title="No-Rebook Follow-up"
          description="Follow up if patient doesn't rebook after missing an appointment"
          icon={CalendarX}
          iconColor="bg-violet-50 text-violet-600"
          enabled={settings.rebook_followup_enabled}
          onToggle={(val) => updateField('rebook_followup_enabled', val)}
        >
          <NumberSetting
            label="Follow-up Delay"
            description="Days to wait before sending a follow-up"
            value={settings.no_rebook_followup_days}
            onChange={(val) => updateField('no_rebook_followup_days', val)}
            min={1}
            max={180}
            suffix="days"
          />
        </SettingsSection>

        {/* 5. Inactive Patient Check-in */}
        <SettingsSection
          title="Inactive Patient Wellness Check-in"
          description="Reach out to patients who haven't visited in a while"
          icon={Heart}
          iconColor="bg-pink-50 text-pink-600"
          enabled={settings.inactive_checkin_enabled}
          onToggle={(val) => updateField('inactive_checkin_enabled', val)}
        >
          <NumberSetting
            label="Inactivity Threshold"
            description="Months since last visit before sending a check-in"
            value={settings.inactive_patient_months}
            onChange={(val) => updateField('inactive_patient_months', val)}
            min={1}
            max={24}
            suffix="months"
          />
          <div className="bg-pink-50 rounded-lg px-4 py-3">
            <p className="text-[11px] text-pink-700">
              <strong>How it works:</strong> Patients who haven't visited in
              {' '}{settings.inactive_patient_months} months receive a wellness check-in
              with a link to book a visit. Only sent once every 30 days.
            </p>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
