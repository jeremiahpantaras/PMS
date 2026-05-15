import React from 'react';
import type { FieldOption } from '@/types/clinicalTemplate';

interface CheckboxGroupProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: FieldOption[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
  helpText?: string;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  label, value = [], onChange, options, error, required, disabled, helpText,
}) => {
  const toggle = (val: string) => {
    const current = Array.isArray(value) ? value : [];
    onChange(
      current.includes(val) ? current.filter((v) => v !== val) : [...current, val]
    );
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="space-y-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Array.isArray(value) && value.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              disabled={disabled}
              className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
      {helpText && <p className="text-xs text-gray-400 mt-1 italic">{helpText}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};