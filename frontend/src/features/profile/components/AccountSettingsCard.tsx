import React, { useState, useEffect } from 'react';
import {
  Settings2, Loader2, Eye, EyeOff, RefreshCw, CheckCircle2,
  AlertTriangle, RotateCcw, KeyRound,
} from 'lucide-react';
import type { PasswordRotation } from '../services/profile.api';

const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{10,}$/;

const ROTATION_OPTIONS: { value: PasswordRotation; label: string }[] = [
  { value: 'none',    label: 'Disabled'  },
  { value: 'weekly',  label: 'Weekly'    },
  { value: 'monthly', label: 'Monthly'   },
  { value: 'yearly',  label: 'Yearly'    },
];

interface AccountSettingsCardProps {
  currentRotation: PasswordRotation;
  isUpdating:      boolean;
  onUpdate:        (
    type:     'auto' | 'manual',
    password: string | undefined,
    rotation: PasswordRotation,
  ) => Promise<boolean>;
}

export const AccountSettingsCard: React.FC<AccountSettingsCardProps> = ({
  currentRotation,
  isUpdating,
  onUpdate,
}) => {
  const [type,        setType]        = useState<'auto' | 'manual'>('auto');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showCf,      setShowCf]      = useState(false);
  const [rotation,    setRotation]    = useState<PasswordRotation>(currentRotation);
  const [done,        setDone]        = useState(false);
  const [countdown,   setCountdown]   = useState(5);

  // ── Countdown timer for auto-logout ───────────────────────────────────────
  useEffect(() => {
    if (!done || type !== 'auto') return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [done, type]);

  // ── Validation ────────────────────────────────────────────────────────────
  const pwValid    = STRONG_PW.test(password);
  const pwMatch    = password === confirm && confirm.length > 0;
  const canSubmit  = isUpdating
    ? false
    : type === 'auto'
    ? true
    : pwValid && pwMatch;

  // ── Strength indicator ────────────────────────────────────────────────────
  const strengthChecks = {
    length:  password.length >= 10,
    upper:   /[A-Z]/.test(password),
    lower:   /[a-z]/.test(password),
    digit:   /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };
  const strengthScore = Object.values(strengthChecks).filter(Boolean).length;
  const strengthColor =
    strengthScore <= 2 ? 'bg-red-400'
    : strengthScore <= 3 ? 'bg-amber-400'
    : strengthScore <= 4 ? 'bg-sky-400'
    : 'bg-emerald-500';

  const handleSubmit = async () => {
    const ok = await onUpdate(
      type,
      type === 'manual' ? password : undefined,
      rotation,
    );
    if (ok) {
      if (type === 'auto') setCountdown(5);
      setDone(true);
      setPassword('');
      setConfirm('');
      if (type === 'manual') {
        setTimeout(() => setDone(false), 5000);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ── Card header ── */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-800">Account Settings</h3>
          <p className="text-xs text-gray-400 mt-0.5">Manage your password and rotation schedule</p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-6 space-y-6">

        {/* ── Auto-logout countdown banner ── */}
        {done && type === 'auto' && (
          <div className="flex gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800 mb-1">
                Password generated &amp; sent to your email!
              </p>
              <p className="text-sm text-emerald-700">
                Logging you out in{' '}
                <span className="font-bold">{countdown}s</span>…
                Use the new password from your email to log back in.
              </p>
            </div>
          </div>
        )}

        {/* ── Manual success banner ── */}
        {done && type === 'manual' && (
          <div className="flex gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-emerald-800">
              Password updated successfully.
            </p>
          </div>
        )}

        {/* ── Password type selector ── */}
        {!done && (
          <>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Password type</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {(['auto', 'manual'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setType(opt); setDone(false); }}
                    className={`flex-1 flex items-center gap-3 px-4 py-3.5 rounded-xl border-2
                                text-sm font-semibold transition-colors
                                ${type === opt
                                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center
                      ${type === opt ? 'border-sky-500' : 'border-gray-400'}`}>
                      {type === opt && (
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                      )}
                    </span>
                    {opt === 'auto' ? (
                      <><RefreshCw className="w-4 h-4" /> Auto-generate password</>
                    ) : (
                      <><KeyRound className="w-4 h-4" /> Create my own password</>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Manual password fields ── */}
            {type === 'manual' && (
              <div className="space-y-4">
                {/* New password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-600">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 10 characters"
                      autoComplete="new-password"
                      className={`w-full border-2 rounded-xl px-4 py-3 pr-11 text-sm
                        focus:outline-none focus:ring-2 focus:border-transparent transition
                        ${password.length > 0 && !pwValid
                          ? 'border-red-300 bg-red-50 focus:ring-red-300'
                          : password.length > 0 && pwValid
                          ? 'border-emerald-400 bg-emerald-50 focus:ring-emerald-300'
                          : 'border-gray-200 bg-gray-50 focus:ring-sky-300'
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                                 hover:text-gray-600 transition"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors
                              ${i <= strengthScore ? strengthColor : 'bg-gray-200'}`}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {[
                          ['length',  'Min 10 characters'],
                          ['upper',   'Uppercase letter'],
                          ['lower',   'Lowercase letter'],
                          ['digit',   'Number'],
                          ['special', 'Special character (@$!%*?&)'],
                        ].map(([key, label]) => (
                          <span
                            key={key}
                            className={`text-xs flex items-center gap-1
                              ${strengthChecks[key as keyof typeof strengthChecks]
                                ? 'text-emerald-600' : 'text-gray-400'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0
                              ${strengthChecks[key as keyof typeof strengthChecks]
                                ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            />
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-600">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showCf ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className={`w-full border-2 rounded-xl px-4 py-3 pr-11 text-sm
                        focus:outline-none focus:ring-2 focus:border-transparent transition
                        ${confirm.length > 0 && !pwMatch
                          ? 'border-red-300 bg-red-50 focus:ring-red-300'
                          : confirm.length > 0 && pwMatch
                          ? 'border-emerald-400 bg-emerald-50 focus:ring-emerald-300'
                          : 'border-gray-200 bg-gray-50 focus:ring-sky-300'
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCf(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                                 hover:text-gray-600 transition"
                    >
                      {showCf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm.length > 0 && !pwMatch && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Passwords do not match
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Rotation schedule ── */}
            <div>
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                <RotateCcw className="w-4 h-4 text-gray-400" />
                Auto-change password
              </label>
              <select
                value={rotation}
                onChange={e => setRotation(e.target.value as PasswordRotation)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm
                           bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-300
                           focus:border-transparent transition"
              >
                {ROTATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {rotation !== 'none' && (
                <p className="mt-1.5 text-xs text-sky-600 font-medium">
                  Your password will be automatically rotated {rotation}.
                </p>
              )}
            </div>

            {/* ── Submit ── */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isUpdating}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6
                         bg-primary-gradient text-white rounded-xl
                         text-sm font-semibold shadow-sm
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:opacity-90 transition-opacity"
            >
              {isUpdating ? (
                <><Loader2 className="w-5 h-5 animate-spin" />Updating…</>
              ) : type === 'auto' ? (
                <><RefreshCw className="w-5 h-5" />Generate &amp; Apply Password</>
              ) : (
                <><KeyRound className="w-5 h-5" />Save Password</>
              )}
            </button>
          </>
        )}

      </div>
    </div>
  );
};
