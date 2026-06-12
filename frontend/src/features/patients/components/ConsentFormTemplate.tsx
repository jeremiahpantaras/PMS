import React from 'react';
import { DocumentFooter } from '@/components/DocumentFooter';

export interface ConsentFormTemplateData {
  clinicName: string;
  clinicLogo?: string;
  patientName: string;
  patientEmail: string;
  dateSigned: string;
  consentText: string;
  signature: string; // base64 PNG
  /** Optional document title — defaults to 'Patient Data Privacy Consent Form' */
  title?: string;
  /** Optional header content (HTML) rendered above the consent body — used by Clinic Consent Forms */
  headerContent?: string;
  /** Label for the 'Document Type' field in the patient info grid */
  documentType?: string;
}

/**
 * Pure rendering component for consent form documents (Data Privacy & Clinic Consent).
 * Used by ViewConsentFormModal (display) and SendConsentFormModal (PDF generation via html2canvas).
 * Matches US Letter size: 816 × 1056 px at 96 dpi.
 */
export const ConsentFormTemplate: React.FC<ConsentFormTemplateData> = ({
  clinicName,
  clinicLogo,
  patientName,
  patientEmail,
  dateSigned,
  consentText,
  signature,
  title = 'Patient Data Privacy Consent Form',
  headerContent,
  documentType = 'Data Privacy Consent Form',
}) => {
  return (
    <div
      style={{
        width: '816px',
        minHeight: '1056px',
        background: '#ffffff',
        padding: '64px 72px',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        color: '#111827',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          borderBottom: '2px solid #0284c7',
          paddingBottom: '16px',
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          {clinicLogo ? (
            <img
              src={clinicLogo}
              alt={clinicName}
              style={{ height: '48px', maxWidth: '180px', objectFit: 'contain', display: 'block', marginBottom: '4px' }}
            />
          ) : (
            <p
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#0369a1',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {clinicName}
            </p>
          )}
          <p
            style={{
              fontSize: '11px',
              color: '#6b7280',
              margin: '4px 0 0',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Clinic Compliance Document
          </p>
        </div>
        <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{dateSigned}</p>
      </div>

      {/* ── TITLE ── */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h1>
      </div>

      {/* ── PATIENT INFO ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px 24px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '20px 24px',
          marginBottom: '32px',
        }}
      >
        {[
          { label: 'Patient Full Name', value: patientName || '—' },
          { label: 'Email Address',     value: patientEmail || '—' },
          { label: 'Date Signed',       value: dateSigned },
          { label: 'Document Type',     value: documentType },
        ].map(({ label, value }) => (
          <div key={label}>
            <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {label}
            </p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── HEADER CONTENT (Clinic Consent Forms only) ── */}
      {headerContent && (
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '0 0 10px',
            }}
          >
            Introduction
          </p>
          <div
            style={{
              fontSize: '14px',
              lineHeight: 1.8,
              color: '#374151',
            }}
            dangerouslySetInnerHTML={{ __html: headerContent }}
          />
        </div>
      )}

      {/* ── CONSENT TEXT ── */}
      <div style={{ marginBottom: '40px' }}>
        <p
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 10px',
          }}
        >
          Consent Statement
        </p>
        <div
          style={{
            fontSize: '14px',
            lineHeight: 1.8,
            color: '#374151',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            padding: '20px 24px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {consentText}
        </div>
      </div>

      {/* ── SIGNATURE ── */}
      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '28px',
          paddingBottom: '80px',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 10px',
          }}
        >
          Patient Signature
        </p>
        <div
          style={{
            border: '1px solid #d1d5db',
            borderRadius: '10px',
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            display: 'inline-block',
            minWidth: '280px',
          }}
        >
          <img
            src={signature}
            alt={`Signature of ${patientName}`}
            style={{ height: '80px', maxWidth: '360px', objectFit: 'contain', display: 'block' }}
          />
        </div>
        <p
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#374151',
            margin: '10px 0 0',
          }}
        >
          {patientName}
        </p>
        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
          Signed electronically on {dateSigned}
        </p>

        {/* ── FOOTER + MALASAKIT BRANDING ── */}
        <div
          style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '24px',
          }}
        >
          <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>
            This document is a legally binding consent form generated by the clinic management system.
          </p>
          <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>{clinicName}</p>
        </div>

        {/* Malasakit branding */}
        <DocumentFooter />
      </div>
    </div>
  );
};
