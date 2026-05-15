import React, { useState, useRef } from 'react';
import type { TemplateSection, TemplateField, FieldType, ChartType } from '@/types/clinicalTemplate';
import {
  Plus,
  Trash2,
  GripVertical,
  HelpCircle,
} from 'lucide-react';

interface TemplateBuilderProps {
  sections: TemplateSection[];
  onChange: (sections: TemplateSection[]) => void;
}

// ─── Field type options matching Nookal ────────────────────────────────────────
const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'section_header', label: 'Section Header' },
  { value: 'heading', label: 'Heading' },
  { value: 'datetime', label: 'Date/Time' },
  { value: 'chart', label: 'Chart' },
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'radio', label: 'Multiple Choice' },
  { value: 'checkbox_group', label: 'Check Boxes' },
  { value: 'select', label: 'Dropdown' },
  { value: 'number', label: 'Number' },
  { value: 'scale', label: 'Scale' },
];

// 'spine' is intentionally excluded — deprecated for new templates (existing data preserved)
const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'body', label: 'Body Chart' },
  { value: 'head', label: 'Head Chart' },
  { value: 'hand', label: 'Hand Chart' },
  { value: 'feet', label: 'Feet Chart' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

// ─── Helpers to flatten sections ↔ field list ────────────────────────────────
const sectionsToFields = (sections: TemplateSection[]): TemplateField[] => {
  const fields: TemplateField[] = [];
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  for (const section of sorted) {
    if (section.title && section.title !== 'General') {
      fields.push({
        id: section.id,
        type: 'section_header',
        label: section.title,
        helpText: section.description,
      });
    }
    fields.push(...section.fields);
  }
  return fields;
};

const fieldsToSections = (fields: TemplateField[]): TemplateSection[] => {
  const sections: TemplateSection[] = [];
  let currentSection: TemplateSection = {
    id: 'section_default',
    title: 'General',
    order: 1,
    fields: [],
  };

  for (const field of fields) {
    if (field.type === 'section_header') {
      if (currentSection.fields.length > 0 || currentSection.title !== 'General') {
        sections.push(currentSection);
      }
      currentSection = {
        id: field.id,
        title: field.label,
        description: field.helpText,
        order: sections.length + 1,
        fields: [],
      };
    } else {
      currentSection.fields.push(field);
    }
  }
  if (currentSection.fields.length > 0 || sections.length === 0) {
    currentSection.order = sections.length + 1;
    sections.push(currentSection);
  }
  return sections;
};

// ─── Field Row (collapsed state) ─────────────────────────────────────────────
interface FieldRowProps {
  field: TemplateField;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (index: number) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({
  field,
  isSelected,
  onSelect,
  index,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}) => {
  const isSectionHeader = field.type === 'section_header';
  const isHeading = field.type === 'heading';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={() => onDrop(index)}
      className={`flex items-center border-b transition-colors ${
        isDragOver
          ? 'border-t-2 border-t-sky-400'
          : 'border-gray-200'
      } ${
        isSelected
          ? 'bg-sky-50 border-l-4 border-l-sky-500'
          : isSectionHeader
          ? 'bg-gray-100 border-l-4 border-l-sky-600'
          : isHeading
          ? 'bg-gray-50 border-l-4 border-l-gray-300'
          : 'bg-white border-l-4 border-l-transparent hover:bg-gray-50'
      }`}
    >
      {/* Drag handle */}
      <div
        className="flex items-center px-1.5 py-2.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 px-2 py-2.5 min-w-0 cursor-pointer" onClick={onSelect}>
        <div className={`truncate ${
          isSectionHeader
            ? 'text-sm font-bold text-sky-800 uppercase tracking-wide'
            : isHeading
            ? 'text-sm font-semibold text-gray-700'
            : 'text-sm font-medium text-gray-900'
        }`}>
          {field.label || 'Untitled'}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {TYPE_LABELS[field.type] || field.type}
          {field.type === 'chart' && field.chartType && (
            <span> — {CHART_TYPE_OPTIONS.find((c) => c.value === field.chartType)?.label}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Field Settings Panel (expanded when selected) ───────────────────────────
interface FieldSettingsProps {
  field: TemplateField;
  onChange: (field: TemplateField) => void;
  onDelete: () => void;
}

const FieldSettings: React.FC<FieldSettingsProps> = ({ field, onChange, onDelete }) => {
  const update = (key: keyof TemplateField, value: any) => {
    onChange({ ...field, [key]: value });
  };

  const hasOptions = ['select', 'checkbox_group', 'radio'].includes(field.type);
  const hasMinMax = ['number', 'scale'].includes(field.type);
  const isScale = field.type === 'scale';
  const isChart = field.type === 'chart';
  const isTextArea = field.type === 'textarea';
  const showDefault = !['section_header', 'heading', 'checkbox', 'checkbox_group', 'radio', 'chart', 'scale'].includes(field.type);
  const showHelpText = !['section_header', 'heading'].includes(field.type);
  const showRequired = !['section_header', 'heading', 'chart'].includes(field.type);

  const addOption = () => {
    const options = field.options || [];
    onChange({
      ...field,
      options: [...options, { value: `option_${options.length + 1}`, label: `Option ${options.length + 1}` }],
    });
  };

  // const updateOption = (index: number, key: 'value' | 'label', value: string) => {
  //   const options = [...(field.options || [])];
  //   options[index] = { ...options[index], [key]: value };
  //   onChange({ ...field, options });
  // };

  const removeOption = (index: number) => {
    const options = [...(field.options || [])];
    options.splice(index, 1);
    onChange({ ...field, options });
  };

  return (
    <div className="border-t border-b border-sky-200 bg-sky-50/30">
      <div className="divide-y divide-gray-100">
        {/* Label */}
        <div className="flex items-center px-4 py-3">
          <label className="w-28 text-sm text-gray-600 shrink-0">Label:</label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => update('label', e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="Field label"
          />
        </div>

        {/* Type */}
        <div className="flex items-center px-4 py-3">
          <label className="w-28 text-sm text-gray-600 shrink-0">Type:</label>
          <select
            value={field.type}
            onChange={(e) => update('type', e.target.value as FieldType)}
            className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
          >
            {FIELD_TYPE_OPTIONS.map((ft) => (
              <option key={ft.value} value={ft.value}>
                {ft.label}
              </option>
            ))}
          </select>
        </div>

        {/* Chart Type */}
        {isChart && (
          <div className="flex items-center px-4 py-3">
            <label className="w-28 text-sm text-gray-600 shrink-0">Chart Type:</label>
            <select
              value={field.chartType || 'body'}
              onChange={(e) => update('chartType', e.target.value as ChartType)}
              className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
            >
              {CHART_TYPE_OPTIONS.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Min / Max for number and scale */}
        {hasMinMax && (
          <>
            <div className="flex items-center px-4 py-3">
              <label className="w-28 text-sm text-gray-600 shrink-0">Minimum:</label>
              <input
                type="number"
                value={field.min ?? (isScale ? 0 : '')}
                onChange={(e) => update('min', e.target.value ? Number(e.target.value) : undefined)}
                className="w-24 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="flex items-center px-4 py-3">
              <label className="w-28 text-sm text-gray-600 shrink-0">Maximum:</label>
              <input
                type="number"
                value={field.max ?? (isScale ? 10 : '')}
                onChange={(e) => update('max', e.target.value ? Number(e.target.value) : undefined)}
                className="w-24 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </>
        )}

        {/* Default value for scale/number */}
        {(isScale || field.type === 'number') && (
          <div className="flex items-center px-4 py-3">
            <label className="w-28 text-sm text-gray-600 shrink-0">Default:</label>
            <input
              type="number"
              value={field.defaultValue ?? ''}
              onChange={(e) => update('defaultValue', e.target.value ? Number(e.target.value) : undefined)}
              className="w-24 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        )}

        {/* Rows for textarea */}
        {isTextArea && (
          <div className="flex items-center px-4 py-3">
            <label className="w-28 text-sm text-gray-600 shrink-0">Rows:</label>
            <input
              type="number"
              value={field.rows || 4}
              onChange={(e) => update('rows', Number(e.target.value))}
              min={1}
              max={20}
              className="w-24 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        )}

        {/* Default value */}
        {showDefault && (
          <div className="flex items-start px-4 py-3">
            <label className="w-28 text-sm text-gray-600 shrink-0 pt-1.5">Default:</label>
            <textarea
              value={field.defaultValue ?? ''}
              onChange={(e) => update('defaultValue', e.target.value)}
              rows={3}
              className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-y"
              placeholder="Default Values"
            />
          </div>
        )}

        {/* Options (for select, checkbox_group, radio) */}
        {hasOptions && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600">Options:</label>
              <button
                onClick={addOption}
                className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Option
              </button>
            </div>
            <div className="space-y-1.5">
              {(field.options || []).map((opt, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      const newValue = newLabel.toLowerCase().replace(/\s+/g, '_') || `option_${index + 1}`;
                      const options = (field.options || []).map((o, i) =>
                        i === index ? { ...o, label: newLabel, value: newValue } : o
                      );
                      onChange({ ...field, options });
                    }}
                    className="flex-1 text-sm border border-gray-200 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder={`Option ${index + 1}`}
                  />
                  <button
                    onClick={() => removeOption(index)}
                    className="text-red-400 hover:text-red-600 p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {(field.options || []).length === 0 && (
                <p className="text-xs text-gray-400 italic">No options added yet</p>
              )}
            </div>
          </div>
        )}

        {/* Help / Info text */}
        {showHelpText && (
          <div className="flex items-start px-4 py-3">
            <label className="w-28 text-sm text-gray-600 shrink-0 pt-1.5">Help / Info:</label>
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={field.helpText || ''}
                  onChange={(e) => update('helpText', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder=""
                />
                <HelpCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              </div>
              <p className="text-xs text-gray-400 italic mt-1">Text to be shown under the field like this.</p>
            </div>
          </div>
        )}

        {/* Mirrored (for charts & scale) */}
        {(isChart || isScale) && (
          <div className="flex items-center px-4 py-3">
            <label className="w-28 text-sm text-gray-600 shrink-0">Mirrored:</label>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={field.mirrored || false}
                  onChange={(e) => update('mirrored', e.target.checked)}
                  className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                />
                Show Mirrored
              </label>
              <p className="text-xs text-gray-400 italic mt-1">For left/right or front/back type comparison.</p>
            </div>
          </div>
        )}

        {/* Required */}
        {showRequired && (
          <div className="flex items-center px-4 py-3">
            <label className="w-28 text-sm text-gray-600 shrink-0">Required:</label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={field.required || false}
                onChange={(e) => update('required', e.target.checked)}
                className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
              />
              Required field
            </label>
          </div>
        )}

        {/* Delete */}
        <div className="px-4 py-3">
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove Field
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main TemplateBuilder ────────────────────────────────────────────────────
export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({ sections, onChange }) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fields = sectionsToFields(sections);

  const updateFields = (newFields: TemplateField[]) => {
    onChange(fieldsToSections(newFields));
  };

  const addField = () => {
    const newField: TemplateField = {
      id: generateId(),
      type: 'text',
      label: 'New Field',
    };
    const updated = [...fields, newField];
    updateFields(updated);
    setSelectedFieldId(newField.id);
  };

  const updateField = (index: number, updated: TemplateField) => {
    const newFields = [...fields];
    newFields[index] = updated;
    updateFields(newFields);
  };

  const deleteField = (index: number) => {
    const newFields = [...fields];
    const deletedId = newFields[index].id;
    newFields.splice(index, 1);
    updateFields(newFields);
    if (selectedFieldId === deletedId) setSelectedFieldId(null);
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newFields = [...fields];
    const [moved] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, moved);
    updateFields(newFields);
  };

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      moveField(dragIndexRef.current, index);
    }
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Field List */}
      <div className="flex-1 overflow-y-auto">
        {fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <p className="text-sm text-gray-500">No fields yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Add Field" to start building your template</p>
          </div>
        ) : (
          <div>
            {fields.map((field, index) => (
              <React.Fragment key={field.id}>
                <FieldRow
                  field={field}
                  isSelected={selectedFieldId === field.id}
                  onSelect={() =>
                    setSelectedFieldId(selectedFieldId === field.id ? null : field.id)
                  }
                  index={index}
                  isDragOver={dragOverIndex === index}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                />
                {selectedFieldId === field.id && (
                  <FieldSettings
                    field={field}
                    onChange={(updated) => updateField(index, updated)}
                    onDelete={() => deleteField(index)}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Add Field Button */}
      <div className="shrink-0 p-3 border-t border-gray-200">
        <button
          onClick={addField}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-sky-600 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>
    </div>
  );
};
