import React, { useState } from 'react';
import type { ClinicalTemplate } from '@/types/clinicalTemplate';
import {
  FileText,
  Edit2,
  Archive,
  MoreVertical,
  CheckCircle,
  XCircle,
  Search,
  Filter,
} from 'lucide-react';

interface TemplateListProps {
  templates: ClinicalTemplate[];
  loading?: boolean;
  onEdit: (template: ClinicalTemplate) => void;
  onArchive: (template: ClinicalTemplate) => void;
  onCreateVersion: (template: ClinicalTemplate) => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  loading,
  onEdit,
  onArchive,
}) => {
  const [search, setSearch] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Get unique disciplines from templates
  const uniqueDisciplines = Array.from(new Set(templates.map((t) => t.discipline).filter(Boolean)));

  const filtered = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.discipline?.toLowerCase().includes(search.toLowerCase());
    const matchesDiscipline = !disciplineFilter || t.discipline === disciplineFilter;
    const matchesArchived = showArchived || !t.is_archived;
    return matchesSearch && matchesDiscipline && matchesArchived;
  });

  const sectionCount = (t: ClinicalTemplate) => t.structure?.sections?.length || 0;
  const fieldCount = (t: ClinicalTemplate) =>
    t.structure?.sections?.reduce((acc, s) => acc + s.fields.length, 0) || 0;

  // Group filtered templates: no discipline → "General", otherwise by discipline name
  const groupedTemplates = filtered.reduce<Record<string, ClinicalTemplate[]>>((acc, t) => {
    const group = t.discipline?.trim() || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(t);
    return acc;
  }, {});

  // Sort groups: "General" first, then alphabetically
  const sortedGroups = Object.keys(groupedTemplates).sort((a, b) => {
    if (a === 'General') return -1;
    if (b === 'General') return 1;
    return a.localeCompare(b);
  });

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
        >
          <option value="">All Disciplines</option>
          {uniqueDisciplines.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
            showArchived
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          {showArchived ? 'Hiding Active' : 'Show Archived'}
        </button>
      </div>

      {/* Grouped List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No templates found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search || disciplineFilter ? 'Try adjusting your filters' : 'Create your first template to get started'}
            </p>
          </div>
        )}

        {sortedGroups.map((group) => (
          <div key={group}>
            {/* Section Header */}
            <div className="border-b border-gray-200 pb-2 mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group}</h2>
            </div>

            {/* Templates in group */}
            <div className="space-y-2">
              {groupedTemplates[group].map((template) => (
          <div
            key={template.id}
            className={`bg-white rounded-xl border transition-all hover:shadow-sm ${
              template.is_archived
                ? 'border-gray-200 opacity-60'
                : 'border-gray-200 hover:border-sky-200'
            }`}
          >
            <div className="p-4 flex items-start gap-3">
              {/* Icon */}
              <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-sky-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{template.name}</span>
                  <span className="text-xs text-gray-400 font-mono">v{template.version}</span>
                  {template.discipline && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-100 text-sky-700">
                      {template.discipline}
                    </span>
                  )}
                  {template.is_archived && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      Archived
                    </span>
                  )}
                  {template.is_latest_version && !template.is_archived && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      Latest
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{template.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-gray-400">
                    {sectionCount(template)} section{sectionCount(template) !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-200">•</span>
                  <span className="text-xs text-gray-400">
                    {fieldCount(template)} field{fieldCount(template) !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-200">•</span>
                  <span className="text-xs text-gray-400">
                    by {template.created_by_name}
                  </span>
                  <span className="text-gray-200">•</span>
                  <div className="flex items-center gap-1">
                    {template.is_active ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-400">
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setOpenMenuId(openMenuId === template.id ? null : template.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {openMenuId === template.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px]">
                      {!template.is_archived && (
                        <>
                          <button
                            onClick={() => { onEdit(template); setOpenMenuId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit Template
                          </button>
                          <hr className="my-1 border-gray-100" />
                          <button
                            onClick={() => { onArchive(template); setOpenMenuId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            Archive
                          </button>
                        </>
                      )}
                      {template.is_archived && (
                        <div className="px-3 py-2 text-xs text-gray-400">
                          Archived templates are read-only
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};