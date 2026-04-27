import { forwardRef } from 'react';
import type { PrintNoteResponse } from '../clinical-templates.api';
import { DocumentFooter as DocumentBrandingFooter } from '@/components/DocumentFooter';

export interface ClinicalNoteTemplateProps {
  data: PrintNoteResponse;
  className?: string;
}

// ─── Small reusable info cell ─────────────────────────────────────────────────
const InfoCell = ({ label, value }: { label: string; value: string }) => (
  <div style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6' }}>
    <p style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
      {label}
    </p>
    <p style={{ fontSize: '11px', color: '#111827', fontWeight: 500 }}>{value || '—'}</p>
  </div>
);

// ─── Main A4 Clinical Note Template ──────────────────────────────────────────
export const ClinicalNoteTemplate = forwardRef<HTMLDivElement, ClinicalNoteTemplateProps>(
  ({ data, className = '' }, ref) => {
    const formattedDate = data.date
      ? new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'N/A';

    const generatedOn = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div
        ref={ref}
        className={className}
        style={{
          width: '210mm',
          minHeight: '297mm',
          background: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#1f2937',
          padding: '14mm 16mm 12mm',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          fontSize: '12px',
        }}
      >
        {/* ── CLINIC HEADER ──────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: '10px',
            marginBottom: '10px',
            borderBottom: '2px solid #0284c7',
          }}
        >
          <div>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#0369a1', margin: 0 }}>
              {data.clinic_name}
            </p>
            {data.clinic_address && (
              <p style={{ fontSize: '10px', color: '#6b7280', margin: '2px 0 0' }}>{data.clinic_address}</p>
            )}
            <p style={{ fontSize: '10px', color: '#6b7280', margin: '2px 0 0' }}>
              {[data.clinic_phone, data.clinic_email].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Generated
            </p>
            <p style={{ fontSize: '10px', color: '#374151', margin: '2px 0 0' }}>{generatedOn}</p>
          </div>
        </div>

        {/* ── DOCUMENT TITLE ─────────────────────────────────────────────── */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#374151',
            margin: '0 0 12px',
          }}
        >
          Clinical Note Report
        </p>

        {/* ── PRACTITIONER CARD ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            background: '#f9fafb',
            marginBottom: '10px',
          }}
        >
          {/* Avatar */}
          {data.practitioner_avatar ? (
            <img
              src={data.practitioner_avatar}
              alt={data.practitioner_name}
              crossOrigin="anonymous"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #0284c7',
              }}
            />
          ) : (
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#e0f2fe',
                border: '2px solid #0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 700,
                color: '#0284c7',
                flexShrink: 0,
              }}
            >
              {data.practitioner_initials || data.practitioner_name?.substring(0, 2).toUpperCase() || '??'}
            </div>
          )}

          {/* Practitioner info */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>
              {data.practitioner_name}
            </p>
            {data.practitioner_title && (
              <p style={{ fontSize: '10px', color: '#6b7280', margin: '1px 0 0' }}>{data.practitioner_title}</p>
            )}
            <p style={{ fontSize: '10px', color: '#6b7280', margin: '1px 0 0' }}>{data.template_name}</p>
          </div>

          {/* Date */}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Date
            </p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#111827', margin: '2px 0 0' }}>
              {formattedDate}
            </p>
          </div>
        </div>

        {/* ── PATIENT INFORMATION ────────────────────────────────────────── */}
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              background: '#f3f4f6',
              padding: '6px 12px',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#4b5563',
                margin: 0,
              }}
            >
              Patient Information
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: 0 }}>
            <InfoCell label="Patient Name" value={data.patient_name} />
            <InfoCell label="Patient ID" value={data.patient_number} />
            <InfoCell
              label="Session Date"
              value={
                data.date
                  ? new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
            <InfoCell label="Session Time" value={data.time} />
          </div>
        </div>

        {/* ── NOTE SECTIONS ──────────────────────────────────────────────── */}
        <div style={{ flex: 1 }}>
          {data.sections.map((section, si) => (
            <div
              key={si}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '8px',
              }}
            >
              {/* Section header */}
              <div
                style={{
                  background: '#f3f4f6',
                  borderLeft: '4px solid #0284c7',
                  padding: '6px 12px',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#374151',
                    margin: 0,
                  }}
                >
                  {section.title}
                </p>
                {section.description && (
                  <p style={{ fontSize: '9px', color: '#6b7280', margin: '2px 0 0' }}>{section.description}</p>
                )}
              </div>

              {/* Fields */}
              {section.fields.map((field, fi) => (
                <div
                  key={fi}
                  style={{
                    padding: '7px 12px',
                    borderBottom: fi < section.fields.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  <p
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#9ca3af',
                      margin: '0 0 3px',
                    }}
                  >
                    {field.label}
                  </p>
                  {field.image ? (
                    /* Chart annotation — render composited image */
                    <img
                      src={field.image}
                      alt={field.label}
                      crossOrigin="anonymous"
                      style={{
                        display: 'block',
                        width: '100%',
                        borderRadius: '4px',
                        border: '1px solid #f3f4f6',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#111827',
                        background: '#f9fafb',
                        border: '1px solid #f3f4f6',
                        borderRadius: '4px',
                        padding: '5px 8px',
                        minHeight: '24px',
                      }}
                    >
                      {field.value || <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>Not filled</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── SIGNATURE / FOOTER ─────────────────────────────────────────── */}
        <div
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            {data.is_signed && (
              <>
                <p style={{ fontSize: '10px', color: '#374151', margin: 0 }}>
                  Signed by:{' '}
                  <span style={{ fontWeight: 600 }}>{data.practitioner_name}</span>
                </p>
                {data.signed_at && (
                  <p style={{ fontSize: '9px', color: '#6b7280', margin: '2px 0 0' }}>
                    {new Date(data.signed_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>
              Prepared by: {data.practitioner_name}
            </p>
            <p style={{ fontSize: '9px', color: '#9ca3af', margin: '2px 0 0' }}>
              Generated: {generatedOn}
            </p>
          </div>
        </div>

        {/* ── Malasakit Branding ─────────────────────────────────────────── */}
        <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
          <DocumentBrandingFooter />
        </div>
      </div>
    );
  }
);

ClinicalNoteTemplate.displayName = 'ClinicalNoteTemplate';
