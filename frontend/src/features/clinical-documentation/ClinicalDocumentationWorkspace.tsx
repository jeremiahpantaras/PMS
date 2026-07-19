import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FileText, Mail, History, Files } from 'lucide-react';

export const ClinicalDocumentationWorkspace = () => {
  const location = useLocation();

  const tabs = [
    {
      id: 'notes',
      label: 'Clinical Notes',
      icon: <FileText className="w-4 h-4" />,
      path: 'notes',
    },
    {
      id: 'letters',
      label: 'Letters',
      icon: <Mail className="w-4 h-4" />,
      path: 'letters',
    },
    {
      id: 'history',
      label: 'History',
      icon: <History className="w-4 h-4" />,
      path: 'history',
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: <Files className="w-4 h-4" />,
      path: 'documents',
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Clinical Documentation</h1>
        <div className="flex space-x-1 border-b border-slate-200">
          {tabs.map((tab) => {
            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive || location.pathname.includes(`/clinical/${tab.path}`)
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`
                }
              >
                {tab.icon}
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default ClinicalDocumentationWorkspace;
