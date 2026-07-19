import { useState, useEffect } from 'react';
import { Download, FileText, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePatientProfileContext } from '@/features/patients/context/PatientProfileContext';
import { getLetters, deleteLetter, type Letter } from '../api/letters.api';
import { GenerateLetterModal } from '../components/GenerateLetterModal';
import { formatDate } from '@/features/patients/patientProfile.utils.tsx';

export const LettersTab = () => {
  const { patient, cases: patientCases = [] } = usePatientProfileContext();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<number | 'ALL'>('ALL');
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const fetchLetters = async () => {
    if (!patient?.id) return;
    try {
      setIsLoading(true);
      const data = await getLetters(patient.id);
      setLetters(data);
    } catch (error) {
      toast.error('Failed to load letters');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, [patient?.id]);

  const handleDelete = async (id: number, subject: string) => {
    if (!window.confirm(`Are you sure you want to delete "${subject}"?`)) return;
    try {
      await deleteLetter(id);
      toast.success('Letter deleted');
      fetchLetters();
    } catch (error) {
      toast.error('Failed to delete letter');
    }
  };

  const filteredLetters = letters.filter(letter => {
    const matchesSearch = letter.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCase = selectedCaseId === 'ALL' || letter.patient_case === selectedCaseId;
    return matchesSearch && matchesCase;
  });

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Generated Letters</h2>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Generate Letter
          </button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search letters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px]"
          >
            <option value="ALL">All Cases</option>
            {patientCases.map((c: any) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredLetters.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-slate-900">No letters found</h3>
            <p className="text-sm text-slate-500 mt-1">
              {searchQuery || selectedCaseId !== 'ALL' 
                ? 'Try adjusting your filters.' 
                : 'Generate a letter from a template to get started.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Subject</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Practitioner</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredLetters.map(letter => (
                  <tr key={letter.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="flex-shrink-0 h-5 w-5 text-slate-400" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-slate-900">{letter.subject}</p>
                          <p className="text-xs text-slate-500">Letter #{letter.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        letter.status === 'DRAFT' ? 'bg-amber-100 text-amber-800' :
                        letter.status === 'FINAL' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {letter.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDate(letter.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {letter.practitioner_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {letter.rendered_pdf && (
                          <a 
                            href={letter.rendered_pdf} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(letter.id, letter.subject)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isGenerateModalOpen && (
        <GenerateLetterModal
          patientId={patient?.id!}
          cases={patientCases}
          onClose={() => setIsGenerateModalOpen(false)}
          onSuccess={() => {
            setIsGenerateModalOpen(false);
            fetchLetters();
          }}
        />
      )}
    </div>
  );
};
