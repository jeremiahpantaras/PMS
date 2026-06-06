import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Link2, Copy, Check, ExternalLink, Globe,
  Download, RefreshCw, AlertTriangle, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { axiosInstance as apiClient } from '@/lib/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalLink {
  id:          number;
  clinic:      number;
  token:       string;
  heading:     string;
  description: string;
  is_active:   boolean;
  portal_url:  string;
  created_at:  string;
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

interface RegenerateModalProps {
  onCancel:  () => void;
  onConfirm: () => void;
  loading:   boolean;
}

const RegenerateModal: React.FC<RegenerateModalProps> = ({ onCancel, onConfirm, loading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    />

    {/* Dialog */}
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">

      {/* Close button */}
      <button
        onClick={onCancel}
        disabled={loading}
        className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Icon + heading */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Regenerate QR Code?</h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            This will <strong className="text-gray-700">immediately invalidate</strong> all
            previously distributed QR codes and booking links. Patients who scan the old
            QR will no longer be able to access your portal.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Generate New QR
        </button>
      </div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const ClinicalMenu1: React.FC = () => {
  const [portalLink,  setPortalLink]  = useState<PortalLink | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [showModal,   setShowModal]   = useState(false);
  const [regenerating,setRegenerating]= useState(false);
  const [downloading, setDownloading] = useState(false);

  // QR wrapper ref — used to snapshot the SVG for PNG download
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  // ── Derived booking URL (always relative to frontend origin) ─────────────
  const bookingUrl = portalLink
    ? `${window.location.origin}/portal/${portalLink.token}`
    : null;

  // ── Fetch existing portal link ───────────────────────────────────────────
  const fetchPortalLink = useCallback(async () => {
    try {
      const res = await apiClient.get<PortalLink[]>('/portal-links/');
      setPortalLink(res.data.length > 0 ? res.data[0] : null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to load portal link.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortalLink();
  }, [fetchPortalLink]);

  // ── Create portal link (first-time) ─────────────────────────────────────
  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await apiClient.post<PortalLink>('/portal-links/', {});
      setPortalLink(res.data);
      toast.success('Patient portal link created!');
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail ??
        JSON.stringify(err.response?.data) ??
        'Failed to create portal link.',
      );
    } finally {
      setCreating(false);
    }
  };

  // ── Copy to clipboard ────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success('Booking link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  // ── Toggle portal active/inactive ────────────────────────────────────────
  const handleToggleActive = async () => {
    if (!portalLink) return;
    try {
      const res = await apiClient.patch<PortalLink>(
        `/portal-links/${portalLink.id}/`,
        { is_active: !portalLink.is_active },
      );
      setPortalLink(res.data);
      toast.success(res.data.is_active ? 'Portal is now active.' : 'Portal has been deactivated.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to update portal status.');
    }
  };

  // ── Regenerate QR (rotate token) ─────────────────────────────────────────
  const handleRegenerate = async () => {
    if (!portalLink) return;
    setRegenerating(true);
    try {
      const res = await apiClient.post<PortalLink>(
        `/portal-links/${portalLink.id}/regenerate/`,
      );
      setPortalLink(res.data);
      setShowModal(false);
      toast.success('New QR code generated. Old QR is now invalid.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to regenerate QR code.');
    } finally {
      setRegenerating(false);
    }
  };

  // ── Download QR as PNG ───────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!qrWrapperRef.current || !portalLink) return;
    setDownloading(true);
    try {
      // Locate the <svg> rendered by QRCodeSVG
      const svgEl = qrWrapperRef.current.querySelector('svg');
      if (!svgEl) throw new Error('QR SVG not found');

      const SCALE  = 4;                           // 4× for print quality
      const SIZE   = 256;                         // logical size used in the SVG
      const CANVAS_SIZE = SIZE * SCALE;           // 1024 px → crisp on paper

      const canvas  = document.createElement('canvas');
      canvas.width  = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx     = canvas.getContext('2d')!;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Serialize SVG → data URL → Image
      const svgData  = new XMLSerializer().serializeToString(svgEl);
      const svgBlob  = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl   = URL.createObjectURL(svgBlob);
      const img      = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
          URL.revokeObjectURL(svgUrl);
          resolve();
        };
        img.onerror = reject;
        img.src     = svgUrl;
      });

      // Trigger download
      const link       = document.createElement('a');
      link.download    = `patient-portal-qr-${portalLink.token.slice(0, 8)}.png`;
      link.href        = canvas.toDataURL('image/png');
      link.click();

      toast.success('QR code downloaded as PNG!');
    } catch (err) {
      console.error('QR download failed:', err);
      toast.error('Failed to download QR code. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-56 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse ml-auto" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-4">
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-12 w-full bg-gray-100 rounded-xl animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-9 w-28 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
        {/* QR skeleton */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-4">
          <div className="h-3 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse mx-auto" />
          <div className="flex gap-2 justify-center">
            <div className="h-9 w-32 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── No portal link yet ───────────────────────────────────────────────────
  if (!portalLink) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Patient Portal</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            No booking portal has been set up yet. Generate a permanent link to
            let patients book appointments online.
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {creating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            Generate Portal Link
          </button>
        </div>
      </div>
    );
  }

  // ── Portal link exists ───────────────────────────────────────────────────
  return (
    <>
      {/* ── Regenerate confirmation modal ─────────────────────────────────── */}
      {showModal && (
        <RegenerateModal
          onCancel={() => setShowModal(false)}
          onConfirm={handleRegenerate}
          loading={regenerating}
        />
      )}

      <div className="p-6 space-y-4">

        {/* ── Header card ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Patient Portal</h2>
              <p className="text-sm text-gray-500">
                Share this link so patients can book appointments online.
              </p>
            </div>

            {/* Active badge */}
            <div className="ml-auto">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  portalLink.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  portalLink.is_active ? 'bg-green-500' : 'bg-red-500'
                }`} />
                {portalLink.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Booking URL card ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-4">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Booking URL
          </p>

          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="flex-1 text-sm text-gray-700 font-mono break-all select-all">
              {bookingUrl}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Copy */}
            <button
              id="btn-copy-booking-link"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              {copied ? (
                <><Check className="w-4 h-4" /> Copied!</>
              ) : (
                <><Copy className="w-4 h-4" /> Copy Link</>
              )}
            </button>

            {/* Open */}
            <a
              href={bookingUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Portal
            </a>
          </div>

          <p className="text-xs text-gray-400">
            🔒 This link is permanent. Share it with patients to let them book appointments.
          </p>
        </div>

        {/* ── QR Code card ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-5">

          {/* Card title */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Patient Portal QR Code
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Scan to open the online booking page
              </p>
            </div>
            {/* Status pill */}
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${
              portalLink.is_active
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                portalLink.is_active ? 'bg-emerald-500' : 'bg-red-500'
              }`} />
              {portalLink.is_active ? 'Scannable' : 'Portal Inactive'}
            </span>
          </div>

          {/* QR image area */}
          <div className="flex flex-col items-center gap-3">
            <div
              ref={qrWrapperRef}
              className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-inner inline-block"
              style={{ lineHeight: 0 }}
            >
              <QRCodeSVG
                id="portal-qr-code"
                value={bookingUrl!}
                size={192}
                level="H"
                bgColor="#ffffff"
                fgColor="#0f172a"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-gray-500 text-center max-w-xs leading-relaxed">
              Place this QR at your reception desk, on posters, business cards, or
              social media. Patients scan it to book directly.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">

            {/* Download PNG */}
            <button
              id="btn-download-qr-png"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60"
            >
              {downloading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download PNG
            </button>

            {/* Copy booking link (duplicate for QR card convenience) */}
            <button
              id="btn-copy-booking-link-qr"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5 text-teal-600" /> Copied!</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copy Booking Link</>
              )}
            </button>

            {/* Regenerate */}
            <button
              id="btn-regenerate-qr"
              onClick={() => setShowModal(true)}
              disabled={regenerating}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors disabled:opacity-60 ml-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate QR
            </button>
          </div>

          {/* Security note */}
          <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
            🔐 QR token: <span className="font-mono">{portalLink.token.slice(0, 8)}…</span>
            &nbsp;·&nbsp; Regenerating immediately invalidates all previously shared QR codes.
          </p>
        </div>

        {/* ── Portal Visibility toggle card ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">Portal Visibility</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {portalLink.is_active
                  ? 'The portal is publicly accessible. Patients can book appointments.'
                  : 'The portal is hidden. Patients cannot access the booking page.'}
              </p>
            </div>
            <button
              id="btn-toggle-portal-visibility"
              onClick={handleToggleActive}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                portalLink.is_active ? 'bg-teal-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  portalLink.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* ── Meta ─────────────────────────────────────────────────────────── */}
        <p className="text-xs text-gray-400 px-1">
          Created {new Date(portalLink.created_at).toLocaleDateString('en-PH', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>

      </div>
    </>
  );
};