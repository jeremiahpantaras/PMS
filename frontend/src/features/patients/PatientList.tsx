import React from 'react';
import { Eye, Edit, ChevronLeft, ChevronRight, ExternalLink, Archive, ArchiveRestore } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Patient } from '@/types';

interface PatientListProps {
  patients:    Patient[];
  currentPage: number;
  totalPages:  number;
  isArchived?: boolean;   // ← true when showing the archived list
  onPageChange: (page: number) => void;
  onView:       (patient: Patient) => void;
  onEdit:       (patient: Patient) => void;
  onArchive?:   (patient: Patient) => void;
  onRestore?:   (patient: Patient) => void;
}

export const PatientList: React.FC<PatientListProps> = ({
  patients,
  currentPage,
  totalPages,
  isArchived = false,
  onPageChange,
  onView,
  onEdit,
  onArchive,
  onRestore,
}) => {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePrevPage = () => { if (currentPage > 1) onPageChange(currentPage - 1); };
  const handleNextPage = () => { if (currentPage < totalPages) onPageChange(currentPage + 1); };

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisiblePages = 3;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 2)                     pages.push(1, 2, 3);
      else if (currentPage >= totalPages - 1)   pages.push(totalPages - 2, totalPages - 1, totalPages);
      else                                      pages.push(currentPage - 1, currentPage, currentPage + 1);
    }
    return pages;
  };

  if (patients.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            {isArchived
              ? <Archive className="w-10 h-10 text-gray-400" />
              : <Eye className="w-10 h-10 text-gray-400" />
            }
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {isArchived ? 'No archived clients' : 'No clients found'}
          </h3>
          <p className="text-gray-600">
            {isArchived ? 'No clients have been archived yet.' : 'Try adjusting your search or filters'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white rounded-xl border border-gray-200 m-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Client ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Full Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Birthday</th>
                  {isArchived && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Archived</th>
                  )}
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className={`transition-colors ${isArchived ? 'bg-amber-50/30 hover:bg-amber-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-600">{patient.patient_number}</td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${
                          isArchived
                            ? 'bg-linear-to-r from-amber-400 to-amber-500'
                            : 'bg-linear-to-r from-green-500 to-green-600'
                        }`}>
                          {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{patient.full_name}</span>
                            {isArchived && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                                <Archive className="w-3 h-3" />
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{patient.phone}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">{patient.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(patient.date_of_birth)}</td>

                    {isArchived && (
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {patient.archived_at ? formatDate(patient.archived_at) : '—'}
                        {patient.archived_by_name && (
                          <div className="text-gray-400">by {patient.archived_by_name}</div>
                        )}
                      </td>
                    )}

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {!isArchived && (
                          <button
                            onClick={() => navigate(`/patients/${patient.id}/profile`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Profile
                          </button>
                        )}
                        <button
                          onClick={() => onView(patient)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        {!isArchived && (
                          <button
                            onClick={() => onEdit(patient)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                        )}

                        {/* ── Archive / Restore ── */}
                        {isArchived ? (
                          <button
                            onClick={() => onRestore?.(patient)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => onArchive?.(patient)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            <Archive className="w-4 h-4" />
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-green-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center text-sm text-gray-600 mt-2">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}
    </div>
  );
};