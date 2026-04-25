import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Calendar, Clock, User, FileText, Tag, MapPin,
  Receipt, Plus, Printer, AlertCircle,
  RefreshCw, ChevronDown, Building2, Edit3, Trash2,
  Save, XCircle, Search, UserCircle, ClipboardList,
  ExternalLink, Repeat, List, Stethoscope,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Appointment } from '@/types';
import { getPatient } from '@/features/patients/patient.api';
import { getNotes } from '@/features/clinical-template/clinical-templates.api';
import type { ClinicalNote } from '@/types/clinicalTemplate';
import { APPOINTMENT_STATUS_COLORS, APPOINTMENT_TYPE_LABELS } from '@/types';
import { billingApi } from '@/features/billing/billing.api';
import type { ClinicService } from '@/features/billing/billing.api';
import type { Invoice } from '@/types/billing';
import {
  getCaseNoteCount,
  getCaseNotes,
  listPatientCases,
  type PatientCase,
} from '@/features/patients/patientCases.storage';

import { AppointmentEditForm }    from './AppointmentEditForm';
import { CancelAppointmentModal } from './CancelAppointmentModal';
import { AddRecurringAppointments } from './AddRecurringAppointments';
import { createRecurringAppointments } from '../appointment.api';
import toast from 'react-hot-toast';
import { useAppointmentEdit }     from '../hooks/useAppointmentEdit';
import { usePractitioners }       from '@/features/clinics/hooks/usePractitioners';
import type { AppointmentEditPayload } from '../appointment.api';

// ── helpers ─────────────────────────────────────────────────────────────────
const fmt12 = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  DRAFT:          'bg-gray-100 text-gray-600 border-gray-200',
  PENDING:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  PAID:           'bg-green-50 text-green-700 border-green-200',
  PARTIALLY_PAID: 'bg-blue-50 text-blue-700 border-blue-200',
  OVERDUE:        'bg-red-50 text-red-700 border-red-200',
  CANCELLED:      'bg-gray-100 text-gray-400 border-gray-200',
};

type Tab = 'client' | 'appointment' | 'status' | 'clinical_notes' | 'invoice';

interface AppointmentViewProps {
  isOpen:      boolean;
  onClose:     () => void;
  appointment: Appointment | null;
  onUpdated?:  (appointment: Appointment) => void;
  onRecurringCreated?: () => void;
}

interface EditableItem {
  id?:         number;
  description: string;
  quantity:    number;   // always number
  unit_price:  number;
  service_id?: number;
  _key:        string;
}

const newBlankItem = (): EditableItem => ({
  description: '',
  quantity:    1,
  unit_price:  0,
  _key:        crypto.randomUUID(),
});

// ── Appointment Summary Card ──────────────────────────────────────────────────
const AppointmentSummary: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
  const formattedDate = format(new Date(appointment.date), 'MMM d, yyyy');

  const typeLabel = appointment.service_name
    ?? APPOINTMENT_TYPE_LABELS[appointment.appointment_type]
    ?? appointment.appointment_type;

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide">
        Appointment Summary
      </p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Patient</p>
            <p className="font-semibold text-gray-800">{appointment.patient_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Practitioner</p>
            <p className="font-semibold text-gray-800">
              {appointment.practitioner_name ?? 'Unassigned'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Date &amp; Time</p>
            <p className="font-semibold text-gray-800">
              {formattedDate} · {fmt12(appointment.start_time)} – {fmt12(appointment.end_time)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Service</p>
            {appointment.service_color ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white mt-0.5"
                style={{ backgroundColor: appointment.service_color }}
              >
                {typeLabel}
              </span>
            ) : (
              <p className="font-semibold text-gray-800">{typeLabel}</p>
            )}
          </div>
        </div>
        {appointment.location_name && (
          <div className="flex items-center gap-2 col-span-2">
            <Building2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Clinic / Location</p>
              <p className="font-semibold text-gray-800">{appointment.location_name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Service Picker Dropdown ───────────────────────────────────────────────────
const ServicePicker: React.FC<{
  services: ClinicService[];
  onSelect: (svc: ClinicService) => void;
  onClose:  () => void;
}> = ({ services, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="absolute z-20 top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-gray-400" />
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search services…"
          className="flex-1 text-sm outline-none bg-transparent"
        />
        <button onClick={onClose} className="p-0.5 hover:bg-gray-100 rounded">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-4 text-center">No services found</p>
        )}
        {filtered.map(svc => (
          <button
            key={svc.id}
            onClick={() => { onSelect(svc); onClose(); }}
            className="w-full text-left px-3 py-2 hover:bg-sky-50 transition-colors flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{svc.name}</p>
              {svc.description && (
                <p className="text-xs text-gray-400 truncate">{svc.description}</p>
              )}
            </div>
            <span className="text-sm font-semibold text-sky-700 flex-shrink-0">
              ₱{parseFloat(svc.price).toLocaleString()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Invoice Tab ───────────────────────────────────────────────────────────────
const InvoiceTab: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [isEditing,   setIsEditing]   = useState(false);
  const [editItems,   setEditItems]   = useState<EditableItem[]>([]);
  const [editNotes,   setEditNotes]   = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [pickerIdx,   setPickerIdx]   = useState<number | null>(null);
  const [saveError,   setSaveError]   = useState<string | null>(null);

  const { data: invoice, isLoading, error: fetchError, refetch } = useQuery<Invoice | null>({
    queryKey: ['appointment-invoice', appointment.id],
    queryFn:  () => billingApi.getByAppointment(appointment.id),
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 2;
    },
  });

  const { data: clinicServices = [] } = useQuery<ClinicService[]>({
    queryKey: ['clinic-services'],
    queryFn:  () => billingApi.getClinicServices(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (items?: EditableItem[]) =>
      billingApi.createFromAppointment({
        appointment:  appointment.id,
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        items: items?.map(i => ({
          description: i.description,
          quantity:    i.quantity,
          unit_price:  i.unit_price,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment-invoice', appointment.id] });
      qc.invalidateQueries({ queryKey: ['appointment-invoice-exists', appointment.id] });
    },
    onError: (error: any) => {
      console.error('❌ Invoice creation error:', error?.response?.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error('No invoice');
      const keepIds  = new Set(editItems.filter(i => i.id).map(i => i.id!));
      const toDelete = invoice.items.filter(i => !keepIds.has(i.id));
      for (const item of toDelete) await billingApi.deleteItem(item.id);
      for (const item of editItems.filter(i => i.id)) {
        await billingApi.updateItem(item.id!, {
          description: item.description,
          quantity:    String(item.quantity) as any,
          unit_price:  String(item.unit_price) as any,
        });
      }
      for (const item of editItems.filter(i => !i.id)) {
        if (!item.description.trim()) continue;
        await billingApi.addItem(invoice.id, {
          invoice:     invoice.id,
          description: item.description,
          quantity:    item.quantity,
          unit_price:  item.unit_price,
        });
      }
      await billingApi.updateInvoice(invoice.id, {
        notes:    editNotes,
        due_date: editDueDate || null,
      } as any);
    },
    onSuccess: () => {
      setSaveError(null);
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ['appointment-invoice', appointment.id] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data;
      if (typeof detail === 'string') setSaveError(detail);
      else if (detail?.detail) setSaveError(detail.detail);
      else setSaveError('Failed to save changes. Please try again.');
    },
  });
  
  const startEditing = useCallback(() => {
    if (!invoice) return;
    setEditItems(invoice.items.map(item => ({
      id:          item.id,
      description: item.description,
      // FIX: Parse string to number
      quantity:    parseInt(String(item.quantity), 10) || 1,
      // FIX: Parse string to number
      unit_price:  parseFloat(String(item.unit_price)) || 0,
      _key:        String(item.id),
    })));
    setEditNotes(invoice.notes || '');
    setEditDueDate(invoice.due_date || '');
    setSaveError(null);
    setIsEditing(true);
  }, [invoice]);


  const cancelEditing = () => { setIsEditing(false); setPickerIdx(null); setSaveError(null); };
  const updateItem    = (key: string, patch: Partial<EditableItem>) =>
    setEditItems(prev => prev.map(i => i._key === key ? { ...i, ...patch } : i));
  const removeItem    = (key: string) =>
    setEditItems(prev => prev.filter(i => i._key !== key));
  const addServiceItem = (svc: ClinicService, idx: number) =>
    setEditItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, description: svc.name, unit_price: parseFloat(svc.price), service_id: svc.id } : item
    ));
  const computeSubtotal = () =>
    editItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading invoice…
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <AppointmentSummary appointment={appointment} />
        <div className="flex flex-col items-center justify-center py-8">
          {fetchError && (fetchError as any)?.response?.status !== 404 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 w-full mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Failed to check existing invoice. Please try refreshing.</span>
            </div>
          )}
          {createMutation.isError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 w-full mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {(() => {
                  const err = createMutation.error as any;
                  const detail = err?.response?.data;
                  if (typeof detail === 'string') return detail;
                  if (detail?.detail) return detail.detail;
                  if (detail?.appointment && Array.isArray(detail.appointment)) return detail.appointment.join(' ');
                  if (typeof detail === 'object') return JSON.stringify(detail);
                  return 'Failed to create invoice. Please try again.';
                })()}
              </span>
            </div>
          )}
          <button 
            onClick={() => navigate(`/billing/generate-invoice/${appointment.id}`)}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium">
            {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {createMutation.isPending ? 'Generating…' : 'Generate Invoice'}
          </button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <AppointmentSummary appointment={appointment} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Editing Invoice</p>
            <p className="text-base font-bold text-gray-900 font-mono">{invoice.invoice_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cancelEditing} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <XCircle className="w-3.5 h-3.5" />Cancel
            </button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors">
              {saveMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
        {saveError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{saveError}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-500">Invoice Date</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <label className="text-xs text-gray-500 block">Due Date</label>
            <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="mt-0.5 text-sm font-semibold text-gray-800 bg-transparent outline-none w-full" />
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl overflow-visible">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Line Items</p>
            <button onClick={() => setEditItems(prev => [...prev, newBlankItem()])} className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700">
              <Plus className="w-3.5 h-3.5" />Add Item
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {editItems.map((item, idx) => (
              <div key={item._key} className="px-4 py-3 space-y-2 relative">
                <div className="flex items-start gap-2">
                  <div className="flex-1 relative">
                    <label className="text-xs text-gray-400 block mb-0.5">Description</label>
                    <div className="flex gap-1">
                      <input value={item.description} onChange={e => updateItem(item._key, { description: e.target.value })} placeholder="Item description" className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200" />
                      <button onClick={() => setPickerIdx(pickerIdx === idx ? null : idx)} className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-sky-50 hover:text-sky-600 transition-colors flex-shrink-0" type="button">
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {pickerIdx === idx && <ServicePicker services={clinicServices} onSelect={svc => addServiceItem(svc, idx)} onClose={() => setPickerIdx(null)} />}
                  </div>
                  <button onClick={() => removeItem(item._key)} className="mt-5 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Qty</label>
                    <input type="number" min={1} value={item.quantity} onChange={e => updateItem(item._key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Unit Price (₱)</label>
                    <input type="number" min={0} step="0.01" value={item.unit_price} onChange={e => updateItem(item._key, { unit_price: parseFloat(e.target.value) || 0 })} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Line Total</label>
                    <p className="text-sm font-semibold text-gray-800 px-2.5 py-1.5">₱{(item.quantity * item.unit_price).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
            {editItems.length === 0 && <div className="px-4 py-8 text-center"><p className="text-xs text-gray-400">No items. Click "Add Item" above.</p></div>}
          </div>
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Subtotal</span>
            <span className="text-sm font-bold text-gray-900">₱{computeSubtotal().toLocaleString()}</span>
          </div>
        </div>
        {clinicServices.length > 0 && (
          <div className="border border-dashed border-sky-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-sky-700 mb-2 uppercase tracking-wide">Quick Add from Services</p>
            <div className="flex flex-wrap gap-1.5">
              {clinicServices.map(svc => {
                const alreadyAdded = editItems.some(i => i.service_id === svc.id);
                return (
                  <button key={svc.id} disabled={alreadyAdded}
                    onClick={() => setEditItems(prev => [...prev, { description: svc.name, quantity: 1, unit_price: parseFloat(svc.price), service_id: svc.id, _key: crypto.randomUUID() }])}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${alreadyAdded ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'}`}>
                    {svc.name} · ₱{parseFloat(svc.price).toLocaleString()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes</label>
          <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200 resize-none" placeholder="Optional notes…" />
        </div>
      </div>
    );
  }

  const canEdit = invoice.status === 'DRAFT' || invoice.status === 'PENDING';

  return (
    <div className="space-y-4">
      <AppointmentSummary appointment={appointment} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-500">Invoice Number</p>
          <p className="text-base font-bold text-gray-900 font-mono">{invoice.invoice_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${INVOICE_STATUS_STYLES[invoice.status] ?? ''}`}>{invoice.status_display}</span>
          {canEdit && <button onClick={startEditing} className="flex items-center gap-1.5 px-3 py-1.5 border border-sky-200 rounded-lg text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors"><Edit3 className="w-3.5 h-3.5" />Edit</button>}
          <button onClick={() => navigate(`/clients/${appointment.patient}`)} className="flex items-center gap-1.5 px-3 py-1.5 border border-sky-200 rounded-lg text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors"><FileText className="w-3.5 h-3.5" />View Full Invoice</button>
          <button onClick={() => billingApi.print(invoice.id)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={() => refetch()} className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-500">Invoice Date</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-500">Due Date</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : <span className="text-gray-400">—</span>}</p>
        </div>
      </div>
      {invoice.items.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Items</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Description</th>
                <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Qty</th>
                <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Price</th>
                <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-800">{item.description}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₱{parseFloat(item.unit_price).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-800">₱{parseFloat(item.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
        {[
          { label: 'Subtotal', value: invoice.subtotal },
          { label: 'Discount', value: invoice.discount_amount },
          { label: 'Tax',      value: invoice.tax_amount },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="text-gray-700">₱{parseFloat(value).toLocaleString()}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">Total</span>
          <span className="text-base font-bold text-gray-900">₱{parseFloat(invoice.total_amount).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Amount Paid</span>
          <span className="text-green-600 font-medium">₱{parseFloat(invoice.amount_paid).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">Balance Due</span>
          <span className={`font-bold ${parseFloat(invoice.balance_due) > 0 ? 'text-red-600' : 'text-green-600'}`}>₱{parseFloat(invoice.balance_due).toLocaleString()}</span>
        </div>
      </div>
      {invoice.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
};

// ── Main AppointmentView Component ────────────────────────────────────────────
export const AppointmentView: React.FC<AppointmentViewProps> = ({
  isOpen,
  onClose,
  appointment: initialAppointment,
  onUpdated,
  onRecurringCreated,
}) => {
  const [activeTab,             setActiveTab]             = useState<Tab>('client');
  const [showCancelModal,       setShowCancelModal]       = useState(false);
  const [showAppointmentDropdown, setShowAppointmentDropdown] = useState(false);
  const [showRecurringModal,     setShowRecurringModal]     = useState(false);
  const appointmentDropdownRef = useRef<HTMLDivElement>(null);

  // Query client for invalidation
  const queryClient = useQueryClient();

  // Query to check if invoice exists for this appointment
  const { data: hasInvoice } = useQuery({
    queryKey: ['appointment-invoice-exists', initialAppointment?.id],
    queryFn: async () => {
      if (!initialAppointment?.id) return false;
      try {
        const invoice = await billingApi.getByAppointment(initialAppointment.id);
        return !!invoice;
      } catch {
        return false;
      }
    },
    enabled: !!initialAppointment,
    initialData: false,
  });

  // Close appointment dropdown when clicking outside
  useEffect(() => {
    if (!showAppointmentDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (appointmentDropdownRef.current && !appointmentDropdownRef.current.contains(event.target as Node)) {
        setShowAppointmentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAppointmentDropdown]);

  const lastAppointmentIdRef = useRef<number | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(initialAppointment);

  useEffect(() => {
    if (!initialAppointment) {
      setAppointment(null);
      lastAppointmentIdRef.current = null;
      return;
    }
    if (initialAppointment.id !== lastAppointmentIdRef.current) {
      setAppointment(initialAppointment);
      lastAppointmentIdRef.current = initialAppointment.id;
    }
  }, [initialAppointment]);

  const {
    isEditing, isSaving, isDirty, editError,
    isCancelling, cancelError,
    startEdit, cancelEdit, saveEdit,
    cancelAppointmentAction, markDirty,
  } = useAppointmentEdit();

  const { practitioners, loading: loadingPractitioners } = usePractitioners();

  // ── Patient data ───────────────────────────────────────────────────────────────
  const navigate = useNavigate();
  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', appointment?.patient],
    queryFn: () => getPatient(appointment!.patient),
    enabled: !!appointment?.patient,
  });

  const { data: patientNotes = [] } = useQuery<ClinicalNote[]>({
    queryKey: ['appointment-patient-notes', appointment?.patient],
    queryFn: () => getNotes({ patient: appointment!.patient }),
    enabled: !!appointment?.patient,
    staleTime: 60 * 1000,
  });

  const handleViewFullProfile = () => {
    if (patient) {
      onClose();
      navigate(`/clients/${patient.id}`);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cancelEdit();
      setShowCancelModal(false);
      setActiveTab('client');
      lastAppointmentIdRef.current = null;
    }
  }, [isOpen, cancelEdit]);

  if (!isOpen || !appointment) return null;

  const statusColors  = APPOINTMENT_STATUS_COLORS[appointment.status];

  const typeLabel = appointment.service_name
    ?? APPOINTMENT_TYPE_LABELS[appointment.appointment_type]
    ?? appointment.appointment_type;

  const serviceColor = appointment.service_color;

  const formattedDate = format(new Date(appointment.date), 'EEEE, MMMM d, yyyy');
  const formattedTime = `${fmt12(appointment.start_time)} - ${fmt12(appointment.end_time)}`;
  const isCancelled   = appointment.status === 'CANCELLED';
  const isCompleted   = appointment.status === 'COMPLETED';
  const isTerminal    = isCancelled || isCompleted;

  const patientCases = listPatientCases(appointment.patient);

  const caseMetrics: Record<string, { noteCount: number; lastUpdated: string }> = {};
  patientCases.forEach((caseItem: PatientCase) => {
    const notes = getCaseNotes(appointment.patient, caseItem.id, patientNotes);
    const noteCount = getCaseNoteCount(appointment.patient, caseItem.id, patientNotes);
    const latestNoteDate = notes
      .map((note) => note.updated_at || note.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    caseMetrics[caseItem.id] = {
      noteCount,
      lastUpdated: latestNoteDate || caseItem.createdAt,
    };
  });

  const primaryCase: PatientCase | null = patientCases[0] ?? null;
  const primaryCaseMetrics = primaryCase ? caseMetrics[primaryCase.id] : null;

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins  = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  };

  const handleSaveEdit = async (payload: AppointmentEditPayload) => {
    const updated = await saveEdit(appointment.id, payload);
    if (updated) {
      setAppointment(updated);
      lastAppointmentIdRef.current = updated.id;
      onUpdated?.(updated);
    }
  };

  const handleCancelAppointment = async (reason: string) => {
    const updated = await cancelAppointmentAction(appointment.id, {
      cancellation_reason: reason,
    });
    if (updated) {
      setAppointment(updated);
      lastAppointmentIdRef.current = updated.id;
      onUpdated?.(updated);
      setShowCancelModal(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-md transition-opacity duration-300"
        onClick={isEditing ? undefined : onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isCancelled ? 'bg-red-100' : 'bg-sky-600'
              }`}>
                <Calendar className={`w-5 h-5 ${isCancelled ? 'text-red-500' : 'text-white'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900">Appointment Details</h2>
                  {isEditing && (
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-semibold rounded-full">
                      Editing
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{appointment.patient_name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-200 flex-shrink-0 overflow-visible relative">
            {([
              { key: 'client', label: 'Client Information', icon: UserCircle },
              { key: 'appointment', label: 'Appointment', icon: Calendar, isDropdown: true },
              { key: 'status', label: 'Status', icon: ClipboardList },
              { key: 'clinical_notes', label: 'Clinical Notes', icon: FileText },
              { key: 'invoice', label: hasInvoice ? 'View Invoice' : 'Generate Invoice', icon: Receipt },
            ] as { key: Tab; label: string; icon: React.ElementType; isDropdown?: boolean }[]).map(tab => (
              <div key={tab.key} className="relative" ref={tab.isDropdown ? appointmentDropdownRef : null}>
                <button
                  key={tab.key}
                  onClick={() => {
                    if (tab.isDropdown) {
                      setShowAppointmentDropdown(!showAppointmentDropdown);
                    } else if (tab.key === 'clinical_notes') {
                      // Redirect to PatientCasesNotesPage
                      onClose();
                      navigate(`/patients/${appointment.patient}/cases`);
                    } else {
                      setActiveTab(tab.key);
                      if (isEditing) cancelEdit();
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.isDropdown && <ChevronDown className={`w-3 h-3 transition-transform ${showAppointmentDropdown ? 'rotate-180' : ''}`} />}
                </button>
                {/* Appointment Dropdown Menu */}
                {tab.isDropdown && showAppointmentDropdown && (
                  <div className="absolute left-0 top-full mt-1 w-66 bg-white border border-gray-200 rounded-xl shadow-lg z-9999 py-1">
                    <button
                      onClick={() => {
                        setShowAppointmentDropdown(false);
                        setActiveTab('appointment');
                        if (isEditing) cancelEdit();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-sky-500" />
                      View Appointment Details
                    </button>
                    {!isTerminal && (
                      <button
                        onClick={() => {
                          setShowAppointmentDropdown(false);
                          setActiveTab('appointment');
                          startEdit();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-sky-500" />
                        Edit Appointment
                      </button>
                    )}
                    {!isTerminal && (
                      <button
                        onClick={() => {
                          setShowAppointmentDropdown(false);
                          setShowCancelModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel Appointment
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowAppointmentDropdown(false);
                        setShowRecurringModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                    >
                      <Repeat className="w-4 h-4 text-sky-500" />
                      Add Recurring Appointments
                    </button>
                    <button
                      onClick={() => {
                        setShowAppointmentDropdown(false);
                        onClose();
                        navigate(`/clients/${appointment.patient}`);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                    >
                      <List className="w-4 h-4 text-sky-500" />
                      View Appointment List
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === 'client' && (
              <div className="space-y-5">
                {/* 3-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* ── Column 1: Client Information ── */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-4 h-4 text-sky-600 shrink-0" />
                      <h3 className="text-lg font-semibold text-gray-900">Client Information</h3>
                    </div>

                    {loadingPatient ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500 py-5">
                        <div className="w-4 h-4 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
                        Loading...
                      </div>
                    ) : patient ? (
                      <div className="space-y-2.5">
                        {/* Full Name */}
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Full Name</p>
                          <p className="text-sm font-medium text-gray-900">{patient.full_name}</p>
                        </div>

                        <div className="pt-1 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-0.5">Patient ID</p>
                          <p className="text-sm font-medium text-gray-900 font-mono">{patient.patient_number}</p>
                        </div>

                        {/* Email */}
                        {patient.email && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Email</p>
                            <p className="text-sm font-medium text-gray-900 truncate">{patient.email}</p>
                          </div>
                        )}

                        {/* Phone */}
                        {patient.phone && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                            <p className="text-sm font-medium text-gray-900">{patient.phone}</p>
                          </div>
                        )}

                        {/* Gender */}
                        {patient.gender && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Gender</p>
                            <p className="text-sm font-medium text-gray-900">{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}</p>
                          </div>
                        )}

                        {/* Date of Birth */}
                        {patient.date_of_birth && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Date of Birth</p>
                            <p className="text-sm font-medium text-gray-900">
                              {format(new Date(patient.date_of_birth), 'MMM d, yyyy')} ({patient.age} yrs)
                            </p>
                          </div>
                        )}

                        {/* Address */}
                        {patient.address && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Address</p>
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {patient.city && patient.province
                                ? `${patient.address}, ${patient.city}, ${patient.province}`
                                : patient.address}
                            </p>
                          </div>
                        )}

                        {patient.philhealth_number && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">PhilHealth</p>
                            <p className="text-sm font-medium text-gray-900">{patient.philhealth_number}</p>
                          </div>
                        )}

                        {patient.medical_conditions && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Medical Conditions</p>
                            <p className="text-sm font-medium text-gray-900 line-clamp-3">{patient.medical_conditions}</p>
                          </div>
                        )}

                        {patient.allergies && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Allergies</p>
                            <p className="text-sm font-medium text-gray-900 line-clamp-3">{patient.allergies}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Fallback to appointment.patient_name */}
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Patient Name</p>
                          <p className="text-sm font-medium text-gray-900">{appointment.patient_name}</p>
                        </div>
                        <div className="pt-4 text-xs text-gray-400 italic">
                          Additional details unavailable
                        </div>
                      </div>
                    )}

                    {patient && (
                      <div className="pt-4 mt-4 border-t border-gray-100">
                        <button
                          onClick={handleViewFullProfile}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Full Profile
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Column 2: Appointment Details ── */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                      <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>
                    </div>

                    <div className="space-y-2.5">
                      {/* Date */}
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Date</p>
                        <p className="text-sm font-medium text-gray-900">{format(new Date(appointment.date), 'MMM d, yyyy')}</p>
                      </div>

                      {/* Time */}
                      <div className="pt-1 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">Time</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <p className="text-sm font-medium text-gray-900">{fmt12(appointment.start_time)} – {fmt12(appointment.end_time)}</p>
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="pt-1 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                        <p className="text-sm font-medium text-gray-900">{formatDuration(appointment.duration_minutes)}</p>
                      </div>

                      {/* Service / Type */}
                      <div className="pt-1 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">Service</p>
                        {appointment.service_color ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: appointment.service_color }}
                          >
                            {typeLabel}
                          </span>
                        ) : (
                          <p className="text-sm font-medium text-gray-900">{typeLabel}</p>
                        )}
                      </div>

                      {/* Practitioner */}
                      <div className="pt-1 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">Practitioner</p>
                        <p className="text-sm font-medium text-gray-900">
                          {appointment.practitioner_name || <span className="text-gray-400 font-normal italic">Unassigned</span>}
                        </p>
                      </div>

                      {/* Location / Clinic */}
                      {appointment.location_name && (
                        <div className="pt-1 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-0.5">Location</p>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <p className="text-sm font-medium text-gray-900">{appointment.location_name}</p>
                          </div>
                        </div>
                      )}

                      <div className="pt-1 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">Arrival Status</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          appointment.arrival_status === 'ARRIVED'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : appointment.arrival_status === 'DNA'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {appointment.arrival_status === 'ARRIVED'
                            ? 'Arrived'
                            : appointment.arrival_status === 'DNA'
                              ? 'Did Not Arrive'
                              : 'No Status'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Column 3: Case Details ── */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <Stethoscope className="w-4 h-4 text-sky-600 shrink-0" />
                      <h3 className="text-lg font-semibold text-gray-900">Case Details</h3>
                    </div>

                    {primaryCase ? (
                      <div className="space-y-2.5">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Case Name</p>
                          <p className="text-sm font-medium text-gray-900">{primaryCase.title}</p>
                        </div>

                        <div className="pt-1 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-0.5">Case Description</p>
                          <p className="text-sm font-medium text-gray-900 line-clamp-3">
                            {primaryCase.description || 'No description'}
                          </p>
                        </div>

                        <div className="pt-1 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-0.5">Linked Clinical Notes</p>
                          <p className="text-sm font-medium text-gray-900">{primaryCaseMetrics?.noteCount ?? 0}</p>
                        </div>

                        <div className="pt-1 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-0.5">Latest Clinical Note</p>
                          <p className="text-sm font-medium text-gray-900">
                            {primaryCaseMetrics?.lastUpdated
                              ? format(new Date(primaryCaseMetrics.lastUpdated), 'MMM d, yyyy')
                              : '—'}
                          </p>
                        </div>

                        <div className="pt-1 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-0.5">Status</p>
                          <p className="text-sm font-medium text-gray-900">{primaryCase.status}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 mb-1">No case assigned</p>
                        <p className="text-xs text-gray-400">No case found in patient case records.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Appointment Tab ── */}
            {activeTab === 'appointment' && (
              <div className="space-y-4">

                {isCancelled && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-red-700">This appointment has been cancelled.</p>
                    </div>
                    {appointment.cancellation_reason && (
                      <p className="text-xs text-red-600 pl-6">
                        Reason: {appointment.cancellation_reason}
                      </p>
                    )}
                    {appointment.cancelled_at && (
                      <p className="text-xs text-red-500 pl-6">
                        Cancelled on {format(new Date(appointment.cancelled_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                )}

                {isEditing ? (
                  <AppointmentEditForm
                    appointment={appointment}
                    practitioners={practitioners}
                    loadingPractitioners={loadingPractitioners}
                    isSaving={isSaving}
                    isDirty={isDirty}
                    editError={editError}
                    onSave={handleSaveEdit}
                    onCancel={cancelEdit}
                    onMarkDirty={markDirty}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                        {appointment.status.replace('_', ' ')}
                      </span>
                      <span className="text-gray-300 text-sm">·</span>
                      {serviceColor ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: serviceColor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                          {typeLabel}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-gray-600">{typeLabel}</span>
                      )}
                    </div>

                    <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-sky-600 font-medium">Date</p>
                            <p className="text-sm font-semibold text-gray-900">{formattedDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-sky-600 font-medium">Time</p>
                            <p className="text-sm font-semibold text-gray-900">{formattedTime}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-sky-600 font-medium">Duration</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDuration(appointment.duration_minutes)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <User className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{appointment.patient_name}</p>
                      </div>
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <User className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Practitioner</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          {appointment.practitioner_name ?? (
                            <span className="text-gray-400 font-normal italic">Unassigned</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {appointment.location_name && (
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MapPin className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</span>
                        </div>
                        <p className="text-sm text-gray-900">{appointment.location_name}</p>
                      </div>
                    )}

                    {appointment.chief_complaint ? (
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chief Complaint</span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{appointment.chief_complaint}</p>
                      </div>
                    ) : (
                      !isTerminal && (
                        <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center">
                          <p className="text-xs text-gray-400">No chief complaint recorded.</p>
                        </div>
                      )
                    )}

                    {appointment.notes ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Internal Notes</span>
                          <span className="text-xs text-amber-500">(Staff Only)</span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{appointment.notes}</p>
                      </div>
                    ) : null}

                    {appointment.patient_notes ? (
                      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Patient Notes</span>
                          <span className="text-xs text-sky-500">(Visible to Patient)</span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{appointment.patient_notes}</p>
                      </div>
                    ) : null}

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                      {[
                        { label: 'Created by', value: appointment.created_by_name || 'Unknown' },
                        { label: 'Created at', value: format(new Date(appointment.created_at), 'MMM d, yyyy h:mm a') },
                        ...(appointment.updated_by_name ? [
                          { label: 'Last updated by', value: appointment.updated_by_name },
                          { label: 'Updated at',      value: format(new Date(appointment.updated_at), 'MMM d, yyyy h:mm a') },
                        ] : []),
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{label}</span>
                          <span className="text-xs font-medium text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>

                  </>
                )}
              </div>
            )}

            {/* ── Status Tab ── */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-3">
                    Appointment Status
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Current Status</span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                        {appointment.status.replace('_', ' ')}
                      </span>
                    </div>
                    {/* Arrival Status Dropdown */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Arrival Status</span>
                      <select
                        value={appointment.arrival_status || 'NO_STATUS'}
                        onChange={async (e) => {
                          const newStatus = e.target.value as 'NO_STATUS' | 'ARRIVED' | 'DNA';
                          try {
                            const { editAppointment } = await import('@/features/appointments/appointment.api');
                            const updated = await editAppointment(appointment.id, { arrival_status: newStatus });
                            setAppointment(updated);
                            onUpdated?.(updated);
                            // Invalidate today's arrivals to refresh the list in real-time
                            // Use exact key matching to ensure proper invalidation
                            queryClient.invalidateQueries({ queryKey: ['today-arrivals'] });
                            
                            // Show success notification
                            const statusLabel = newStatus === 'ARRIVED' ? 'Arrived' : newStatus === 'DNA' ? 'Did Not Arrive' : 'No Status';
                            toast.success(`Appointment status successfully changed to ${statusLabel}`);
                          } catch (err) {
                            console.error('Failed to update arrival status:', err);
                            toast.error('Failed to update arrival status');
                          }
                        }}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="NO_STATUS">No Status</option>
                        <option value="ARRIVED">Arrived</option>
                        <option value="DNA">Did Not Arrive (DNA)</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Created By</span>
                      <span className="text-sm font-medium text-gray-800">{appointment.created_by_name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Created At</span>
                      <span className="text-sm font-medium text-gray-800">{format(new Date(appointment.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    {appointment.updated_by_name && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Last Updated By</span>
                          <span className="text-sm font-medium text-gray-800">{appointment.updated_by_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Updated At</span>
                          <span className="text-sm font-medium text-gray-800">{format(new Date(appointment.updated_at), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {isCancelled && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-red-700">This appointment has been cancelled.</p>
                    </div>
                    {appointment.cancellation_reason && (
                      <p className="text-xs text-red-600 pl-6">
                        Reason: {appointment.cancellation_reason}
                      </p>
                    )}
                    {appointment.cancelled_at && (
                      <p className="text-xs text-red-500 pl-6">
                        Cancelled on {format(new Date(appointment.cancelled_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Invoice Tab ── */}
            {activeTab === 'invoice' && (
              <InvoiceTab appointment={appointment} />
            )}

            {/* ── Clinical Notes Tab ── */}
            {activeTab === 'clinical_notes' && (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-500">Redirecting to Clinical Notes...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CancelAppointmentModal
        isOpen={showCancelModal}
        appointment={appointment}
        isCancelling={isCancelling}
        cancelError={cancelError}
        onConfirm={handleCancelAppointment}
        onClose={() => setShowCancelModal(false)}
      />

      <AddRecurringAppointments
        isOpen={showRecurringModal}
        appointment={appointment}
        onClose={() => setShowRecurringModal(false)}
        onSave={async (data) => {
          try {
            const result = await createRecurringAppointments({
              service_id: data.service_id,
              duration_minutes: data.duration_minutes,
              frequency: data.frequency,
              repetitions: data.repetitions,
              selected_days: data.selected_days,
              start_date: data.start_date,
              practitioner_id: data.practitioner_id,
              start_time: data.start_time,
              patient_id: appointment!.patient,
              clinic_id: appointment!.clinic,
            });
            toast.success(`${result.created} recurring appointment(s) created!`);
            onRecurringCreated?.();
            setShowRecurringModal(false);
          } catch (error: any) {
            console.error('Failed to create recurring appointments:', error);
            toast.error(error.response?.data?.error || 'Failed to create recurring appointments');
          }
        }}
      />
    </>
  );
};
