import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Link2, Copy, Check, ExternalLink, Globe,
  Download, RefreshCw, AlertTriangle, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { axiosInstance as apiClient } from '@/lib/axios';

// ── Bundled logo (Vite resolves this at build time) ──────────────────────────
import malasakitLogo from '@/assets/malasakit/PrimaryLogo-Colored.svg';

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
  clinic_slug:    string;
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

// ─── Portal Branch Card ────────────────────────────────────────────────────────

interface PortalBranchCardProps {
  initialLink: PortalLink;
  onUpdate: (link: PortalLink) => void;
}

const PortalBranchCard: React.FC<PortalBranchCardProps> = ({ initialLink, onUpdate }) => {
  const [portalLink, setPortalLink] = useState<PortalLink>(initialLink);
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const bookingUrl = `${window.location.origin}/book/${portalLink.clinic_slug || portalLink.token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success('Booking link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  const handleToggleActive = async () => {
    try {
      const res = await apiClient.patch<PortalLink>(
        `/portal-links/${portalLink.id}/`,
        { is_active: !portalLink.is_active },
      );
      setPortalLink(res.data);
      onUpdate(res.data);
      toast.success(res.data.is_active ? 'Portal is now active.' : 'Portal has been deactivated.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to update portal status.');
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await apiClient.post<PortalLink>(
        `/portal-links/${portalLink.id}/regenerate/`,
      );
      setPortalLink(res.data);
      onUpdate(res.data);
      setShowModal(false);
      toast.success('New QR code generated. Old QR is now invalid.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to regenerate QR code.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!qrWrapperRef.current) return;
    setDownloading(true);

    try {
      const W = 1080;
      const H = 1350;

      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);

      const svgEl = qrWrapperRef.current.querySelector('svg');
      if (!svgEl) throw new Error('QR SVG not found');

      const QR_DISPLAY = Math.round(W * 0.74);
      const QR_X       = (W - QR_DISPLAY) / 2;
      const QR_Y       = 100;

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

      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl  = URL.createObjectURL(svgBlob);
      const qrImg   = await loadImage(svgUrl);
      URL.revokeObjectURL(svgUrl);
      ctx.drawImage(qrImg, QR_X, QR_Y, QR_DISPLAY, QR_DISPLAY);

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

      const clinicName = portalLink.clinic_name || portalLink.heading || 'Your Clinic';
      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = '#111827';
      ctx.font         = '600 52px -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif';
      let curY = drawWrappedText(ctx, clinicName, W / 2, textStartY, W * 0.78, 64);
      ctx.restore();

      const locationLine = (() => {
        const city = (portalLink.clinic_city || '').trim();
        const addr = (portalLink.clinic_address || '').trim();
        if (city) return city;
        if (addr) return addr.split(',')[0].trim();
        return 'Main Branch';
      })();

      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = '#6B7280';
      ctx.font         = '400 38px -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif';
      curY = drawWrappedText(ctx, locationLine, W / 2, curY + 12, W * 0.70, 50);
      ctx.restore();

      const footerAreaTop = H - 260;
      ctx.save();
      ctx.strokeStyle = '#F3F4F6';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(divX, footerAreaTop);
      ctx.lineTo(W - divX, footerAreaTop);
      ctx.stroke();
      ctx.restore();

      try {
        const logoImg = await loadImage(malasakitLogo);
        const LOGO_W = 280;
        const LOGO_H = Math.round((logoImg.naturalHeight / logoImg.naturalWidth) * LOGO_W);
        const logoX  = (W - LOGO_W) / 2;
        const logoY  = footerAreaTop + 30;
        ctx.drawImage(logoImg, logoX, logoY, LOGO_W, LOGO_H);

        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle    = '#9CA3AF';
        ctx.font         = '400 28px -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('QR Generated by Malasakit', W / 2, logoY + LOGO_H + 20);
        ctx.restore();
      } catch {
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle    = '#9CA3AF';
        ctx.font         = '400 28px -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('QR Generated by Malasakit', W / 2, footerAreaTop + 60);
        ctx.restore();
      }

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

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden flex flex-col h-full">
      {showModal && (
        <RegenerateModal
          onCancel={() => setShowModal(false)}
          onConfirm={handleRegenerate}
          loading={regenerating}
        />
      )}

      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{portalLink.clinic_name}</h3>
              <p className="text-sm text-gray-500 line-clamp-1">{portalLink.clinic_city || portalLink.clinic_address}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
            portalLink.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              portalLink.is_active ? 'bg-emerald-500' : 'bg-red-500'
            }`} />
            {portalLink.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col space-y-6">
        
        {/* URL Box */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Booking URL</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
            <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="flex-1 text-sm text-gray-700 font-mono break-all select-all line-clamp-1" title={bookingUrl}>
              {bookingUrl}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCopy}
              className="flex-1 inline-flex justify-center items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex justify-center items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open
            </a>
          </div>
        </div>

        {/* QR Code section */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-gray-100 p-6">
          <div
            ref={qrWrapperRef}
            className={`p-3 bg-white rounded-xl border border-gray-200 shadow-sm transition-opacity duration-200 ${
              !portalLink.is_active ? 'opacity-40 grayscale' : ''
            }`}
            style={{ lineHeight: 0 }}
          >
            <QRCodeSVG
              value={bookingUrl}
              size={140}
              level="H"
              bgColor="#ffffff"
              fgColor="#0f172a"
              includeMargin={false}
            />
          </div>
          <div className="mt-4 flex gap-2 w-full">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 inline-flex justify-center items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60 shadow-sm"
            >
              {downloading ? (
                <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Save PNG
            </button>
            <button
              onClick={() => setShowModal(true)}
              disabled={regenerating}
              className="inline-flex justify-center items-center px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-60"
              title="Regenerate QR Code"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer / Toggle */}
      <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">Public Access</span>
        <button
          onClick={handleToggleActive}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            portalLink.is_active ? 'bg-teal-500' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            portalLink.is_active ? 'translate-x-4.5' : 'translate-x-1'
          }`} style={{ transform: `translateX(${portalLink.is_active ? '1.125rem' : '0.25rem'})` }} />
        </button>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const ClinicalMenu1: React.FC = () => {
  const [portalLinks, setPortalLinks] = useState<PortalLink[]>([]);
  const [loading,     setLoading]     = useState(true);

  // ── Fetch existing portal links ───────────────────────────────────────────
  const fetchPortalLinks = useCallback(async () => {
    try {
      const res = await apiClient.get<PortalLink[]>('/portal-links/');
      setPortalLinks(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to load portal links.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPortalLinks(); }, [fetchPortalLinks]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border-2 border-gray-200 p-6 flex flex-col h-[500px]">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gray-100 rounded-xl animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-4 flex-1">
                <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-48 w-full bg-gray-100 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── No portal links (e.g. no branches assigned) ──────────────────────────
  if (portalLinks.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-12 text-center max-w-2xl mx-auto mt-10">
          <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Globe className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Branches Assigned</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            You currently do not have access to any clinic branches. Please contact your administrator to assign branches to your account.
          </p>
        </div>
      </div>
    );
  }

  // ── Portal links grid ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branch Portals</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage public booking links and QR codes for your assigned branches.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {portalLinks.map(link => (
          <PortalBranchCard 
            key={link.id} 
            initialLink={link} 
            onUpdate={(updatedLink) => {
              setPortalLinks(prev => prev.map(p => p.id === updatedLink.id ? updatedLink : p));
            }}
          />
        ))}
      </div>
    </div>
  );
};