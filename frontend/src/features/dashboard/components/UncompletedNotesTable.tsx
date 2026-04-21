import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface UncompletedNote {
  id: number;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  practitioner: string;
  caseType: string;
  daysPending: number;
}

interface UncompletedNotesTableProps {
  notes: UncompletedNote[];
  isLoading?: boolean;
}

export const UncompletedNotesTable: React.FC<UncompletedNotesTableProps> = ({ notes, isLoading }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPriorityBadge = (days: number) => {
    if (days >= 7) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">Critical</span>;
    } else if (days >= 4) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">High</span>;
    } else {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Normal</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 h-full flex flex-col">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 hover:shadow-xl transition-all duration-300 h-full flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Uncompleted Notes
            </h2>
            <p className="text-sm text-gray-600">
              Appointments requiring clinical documentation
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-bold text-red-600">{notes.length} Pending</span>
          </div>
        </div>
      </div>

      {/* Table - Scrollable */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Patient
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Practitioner
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Case Type
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Days Pending
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Priority
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {notes.map((note) => (
              <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xs">
                        {note.patientName.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900 text-sm">{note.patientName}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-xs">
                    <div className="font-medium text-gray-900">{formatDate(note.appointmentDate)}</div>
                    <div className="text-gray-500">{note.appointmentTime}</div>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-900">
                  {note.practitioner}
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-gray-700">{note.caseType}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-900">{note.daysPending}d</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {getPriorityBadge(note.daysPending)}
                </td>
                <td className="py-3 px-4 text-right">
                  <button className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-medium hover:bg-sky-600 transition-colors">
                    Complete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty State */}
        {notes.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">No pending clinical notes at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
};