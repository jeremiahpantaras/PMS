export type FieldType =
  | 'section_header'
  | 'heading'
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'checkbox'
  | 'checkbox_group'
  | 'radio'
  | 'scale'
  | 'chart'
  | 'rich_text'
  | 'tags';

export type ChartType = 'body' | 'head' | 'hand' | 'feet';

export interface FieldOption {
  value: string;
  label: string;
}

export interface ClinicalTemplate {
  id: number;
  clinic: number;
  created_by: number;
  created_by_name: string;
  name: string;
  description: string;
  category: 'INITIAL' | 'FOLLOW_UP' | 'PROGRESS' | 'DISCHARGE' | 'SOAP' | 'CUSTOM';
  discipline: string;
  clinic_branch: number | null;
  clinic_branch_name: string | null;
  structure: TemplateStructure;
  version: number;
  parent_template: number | null;
  is_active: boolean;
  is_archived: boolean;
  is_latest_version: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  min?: number;
  max?: number;
  rows?: number;
  options?: FieldOption[];
  fields?: TemplateField[];
  defaultValue?: any;
  chartType?: ChartType;
  mirrored?: boolean;
}

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: TemplateField[];
}

export interface TemplateStructure {
  version: string;
  sections: TemplateSection[];
}

export interface ClinicalNote {
  id: number;
  patient: number;
  patient_name: string;
  practitioner: number;
  practitioner_name: string;
  practitioner_avatar: string | null;
  appointment: number | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  appointment_service?: string | null;
  appointment_practitioner?: string | null;
  patient_case?: number | null;
  patient_case_id?: number | null;
  clinic: number;
  template: number | null;
  template_name: string | null;
  template_version: number | null;
  date: string;
  note_type: string;
  is_signed: boolean;
  signed_at: string | null;
  is_draft: boolean;
  last_autosave: string | null;
  decrypted_content: Record<string, any> | null;
  /** Stroke JSON for each chart field: { [fieldId]: { chart_type, doodle_data } } */
  chart_annotation_data: Record<string, { chart_type: string; doodle_data: Record<string, unknown>[] }> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClinicalNoteData {
  patient: number;
  practitioner?: number;
  appointment: number;
  template: number;
  date: string;
  content: Record<string, any>;
}