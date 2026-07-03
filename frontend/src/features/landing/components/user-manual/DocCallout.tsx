import React from 'react';
import { Info, Lightbulb, AlertTriangle, AlertOctagon } from 'lucide-react';

interface DocCalloutProps {
  type: 'info' | 'tip' | 'important' | 'warning';
  title?: string;
  children: React.ReactNode;
}

export const DocCallout: React.FC<DocCalloutProps> = ({ type, title, children }) => {
  const config = {
    info: {
      icon: Info,
      color: 'bg-blue-50 border-blue-200 text-blue-800',
      iconColor: 'text-blue-500',
      defaultTitle: 'Info',
    },
    tip: {
      icon: Lightbulb,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      iconColor: 'text-emerald-500',
      defaultTitle: 'Tip',
    },
    important: {
      icon: AlertTriangle,
      color: 'bg-purple-50 border-purple-200 text-purple-800',
      iconColor: 'text-purple-500',
      defaultTitle: 'Important',
    },
    warning: {
      icon: AlertOctagon,
      color: 'bg-amber-50 border-amber-200 text-amber-800',
      iconColor: 'text-amber-500',
      defaultTitle: 'Warning',
    },
  };

  const { icon: Icon, color, iconColor, defaultTitle } = config[type];

  return (
    <div className={`my-6 flex gap-4 p-4 rounded-xl border ${color} font-body shadow-sm`}>
      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h4 className="font-semibold mb-1 font-display">{title || defaultTitle}</h4>
        <div className="text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
};
