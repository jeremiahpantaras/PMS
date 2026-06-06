import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Link2, Copy, Check, ExternalLink, Globe,
  Download, RefreshCw, AlertTriangle, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { axiosInstance as apiClient } from '@/lib/axios';

// ── Bundled logo (Vite resolves this at build time) ──────────────────────────
import malasakitLogo from '@/assets/malasakit/Primary Logo - Colored.png';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalLink {
  id:             number;
  clinic:         number;
  token:          string;
  heading:        string;
  description:    string;
  is_active:      boolean;
  portal_url:     string;
  clinic_name:    string;
  clinic_city:    string;
  clinic_address: string;
  created_at:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Load an image URL into an HTMLImageElement (handles CORS gracefully). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
}

/**
 * Draw wrapped text on a canvas context.
 * Returns the y-position after the last line drawn.
 */
function drawWrappedText(
  ctx:       CanvasRenderingContext2D,
  text:      string,
  x:         number,
  y:         number,
  maxWidth:  number,
  lineHeight:number,
): number {
  const words = text.split(' ');
  let line = '';
  let curY  = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
  return curY + lineHeight;
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

interface RegenerateModalProps {
  onCancel:  () => void;
  onConfirm: () => void;
  loading:   boolean;
}

const RegenerateModal: React.FC<RegenerateModalProps> = ({ onCancel, onConfirm, loading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
      <button
        onClick={onCancel}
        disabled={loading}
        className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
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
  const [portalLink,   setPortalLink]   = useState<PortalLink | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [creating,     setCreating]     = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading,  setDownloading]  = useState(false);

  // QR wrapper ref — used to extract the SVG for PNG export
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  // ── Derived booking URL ──────────────────────────────────────────────────
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

  useEffect(() => { fetchPortalLink(); }, [fetchPortalLink]);

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

  // ── Download branded QR card as PNG ─────────────────────────────────────
  //
  // Layout (1080 × 1350 px — portrait, social + print friendly):
  //
  //   ┌───────────────────────────┐
  //   │        TOP PADDING        │
  //   │       [ QR CODE ]         │  ~78% card width
  //   │                           │
  //   │     Clinic Name           │  semi-bold, dark
  //   │     City / Address        │  regular, medium gray
  //   │                           │
  //   │  [Malasakit Logo]         │  centered
  //   │  QR Generated by…         │  small caption
  //   └───────────────────────────┘
  //
  const handleDownload = async () => {
    if (!qrWrapperRef.current || !portalLink || !bookingUrl) return;
    setDownloading(true);

    try {
      // ── 1. Card dimensions (portrait, Instagram 4:5) ──────────────────
      const W = 1080;
      const H = 1350;

      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // ── 2. Background — clean white with very subtle warm tint ────────
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);

      // ── 3. Render QR code onto an offscreen canvas via SVG ────────────
      const svgEl = qrWrapperRef.current.querySelector('svg');
      if (!svgEl) throw new Error('QR SVG not found');

      const QR_DISPLAY = Math.round(W * 0.74);   // 74% of card width ≈ 800px
      const QR_X       = (W - QR_DISPLAY) / 2;
      const QR_Y       = 100;                     // top padding

      // Stamp a white rounded background behind the QR
      const QR_PAD = 24;
      ctx.save();
      ctx.beginPath();
      const rx = QR_X - QR_PAD;
      const ry = QR_Y - QR_PAD;
      const rw = QR_DISPLAY + QR_PAD * 2;
      const rh = QR_DISPLAY + QR_PAD * 2;
      const radius = 24;
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + rw - radius, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
      ctx.lineTo(rx + rw, ry + rh - radius);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
      ctx.lineTo(rx + radius, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor   = 'rgba(0,0,0,0.06)';
      ctx.shadowBlur    = 30;
      ctx.shadowOffsetY = 8;
      ctx.fill();
      ctx.restore();

      // Rasterize SVG at the target QR size
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl  = URL.createObjectURL(svgBlob);
      const qrImg   = await loadImage(svgUrl);
      URL.revokeObjectURL(svgUrl);
      ctx.drawImage(qrImg, QR_X, QR_Y, QR_DISPLAY, QR_DISPLAY);

      // ── 4. Divider line ───────────────────────────────────────────────
      const textStartY = QR_Y + QR_DISPLAY + 60;

      ctx.save();
      ctx.strokeStyle = '#F3F4F6';
      ctx.lineWidth   = 1.5;
      const divX = W * 0.12;
      ctx.beginPath();
      ctx.moveTo(divX, textStartY - 30);
      ctx.lineTo(W - divX, textStartY - 30);
      ctx.stroke();
      ctx.restore();

      // ── 5. Clinic name ────────────────────────────────────────────────
      const clinicName = portalLink.clinic_name || portalLink.heading || 'Your Clinic';
      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = '#111827';  // gray-900
      ctx.font         = '600 52px -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif';
      let curY = drawWrappedText(ctx, clinicName, W / 2, textStartY, W * 0.78, 64);
      ctx.restore();

      // ── 6. Branch / city line ─────────────────────────────────────────
      const locationLine = (() => {
        const city = (portalLink.clinic_city || '').trim();
        const addr = (portalLink.clinic_address || '').trim();
        // Prefer city; fall back to first segment of address; fall back to 'Main Branch'
        if (city) return city;
        if (addr) return addr.split(',')[0].trim();
        return 'Main Branch';
      })();

      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = '#6B7280';  // gray-500
      ctx.font         = '400 38px -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif';
      curY = drawWrappedText(ctx, locationLine, W / 2, curY + 12, W * 0.70, 50);
      ctx.restore();

      // ── 7. Footer divider ─────────────────────────────────────────────
      const footerAreaTop = H - 260;

      ctx.save();
      ctx.strokeStyle = '#F3F4F6';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(divX, footerAreaTop);
      ctx.lineTo(W - divX, footerAreaTop);
      ctx.stroke();
      ctx.restore();

      // ── 8. Malasakit logo ─────────────────────────────────────────────
      try {
        const logoImg = await loadImage(malasakitLogo);
        // Scale logo to a comfortable width, preserving aspect ratio
        const LOGO_W = 280;
        const LOGO_H = Math.round((logoImg.naturalHeight / logoImg.naturalWidth) * LOGO_W);
        const logoX  = (W - LOGO_W) / 2;
        const logoY  = footerAreaTop + 30;
        ctx.drawImage(logoImg, logoX, logoY, LOGO_W, LOGO_H);

        // ── 9. "QR Generated by Malasakit" caption ────────────────────
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle    = '#9CA3AF';  // gray-400
        ctx.font         = '400 28px -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('QR Generated by Malasakit', W / 2, logoY + LOGO_H + 20);
        ctx.restore();
      } catch {
        // Logo failed to load — still draw the caption
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle    = '#9CA3AF';
        ctx.font         = '400 28px -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('QR Generated by Malasakit', W / 2, footerAreaTop + 60);
        ctx.restore();
      }

      // ── 10. Trigger PNG download ──────────────────────────────────────
      const safeName   = (portalLink.clinic_name || 'clinic').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const link       = document.createElement('a');
      link.download    = `${safeName}-qr-code.png`;
      link.href        = canvas.toDataURL('image/png');
      link.click();

      toast.success('QR card downloaded as PNG!');
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
            <div className="ml-auto">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                portalLink.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
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
            <button
              id="btn-copy-booking-link"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
            </button>
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

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Patient Portal QR Code
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Scan to open the online booking page
              </p>
            </div>
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

          {/* QR preview */}
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

            {/* Branded card preview hint */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Download className="w-3 h-3" />
              <span>Download includes clinic name, location & Malasakit branding</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
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

          <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
            🔐 QR token: <span className="font-mono">{portalLink.token.slice(0, 8)}…</span>
            &nbsp;·&nbsp; Regenerating immediately invalidates all previously shared QR codes.
          </p>
        </div>

        {/* ── Portal Visibility toggle ──────────────────────────────────────── */}
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
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                portalLink.is_active ? 'translate-x-6' : 'translate-x-1'
              }`} />
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