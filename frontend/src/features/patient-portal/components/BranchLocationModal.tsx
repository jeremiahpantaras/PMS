import React, { useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Download, MapPin, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

import type { PortalBranch } from '../types/portal';

// ── Fix Leaflet default icon paths (Vite bundling) ────────────────────────────
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

(L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl = undefined;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

interface Props {
  branch:  PortalBranch | null;
  isOpen:  boolean;
  onClose: () => void;
}

export const BranchLocationModal: React.FC<Props> = ({ branch, isOpen, onClose }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen || !branch) return null;

  const lat = branch.latitude  ? parseFloat(branch.latitude)  : null;
  const lng = branch.longitude ? parseFloat(branch.longitude) : null;
  const hasPin = lat != null && lng != null;

  const handleSavePNG = async () => {
    if (!mapContainerRef.current) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS:    true,
        allowTaint: false,
        logging:    false,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `${branch.name.replace(/[^a-z0-9]/gi, '_')}_location.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch {
      // silent fail — tile CORS may block on some networks
    } finally {
      setSaving(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-gradient flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">{branch.name}</p>
              {(branch.city || branch.province) && (
                <p className="text-xs text-gray-400 leading-tight">
                  {[branch.city, branch.province].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0 ml-3"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Map area */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 380 }}>
          {hasPin ? (
            <div ref={mapContainerRef} style={{ height: 380 }}>
              <MapContainer
                center={[lat!, lng!]}
                zoom={15}
                zoomAnimation={false}
                style={{ height: '100%', width: '100%' }}
                zoomControl
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat!, lng!]} />
              </MapContainer>
            </div>
          ) : (
            /* No coordinates saved */
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-center px-8 bg-gray-50">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <MapPin className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No pinned location yet</p>
              <p className="text-xs text-gray-400">
                {branch.custom_location
                  ? `Address: ${branch.custom_location}`
                  : 'This branch has not set a map pin yet.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          {/* Address display */}
          <div className="min-w-0 flex-1">
            {branch.address && (
              <p className="text-xs text-gray-500 leading-snug truncate">
                <span className="font-medium text-gray-700">Address: </span>
                {branch.address}
                {branch.city ? `, ${branch.city}` : ''}
                {branch.province ? `, ${branch.province}` : ''}
              </p>
            )}
            {branch.custom_location && !branch.address && (
              <p className="text-xs text-gray-500 leading-snug truncate">
                <span className="font-medium text-gray-700">Location: </span>
                {branch.custom_location}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            {hasPin && (
              <button
                onClick={handleSavePNG}
                disabled={saving}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-60"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Download className="w-4 h-4" /> Save as PNG</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
