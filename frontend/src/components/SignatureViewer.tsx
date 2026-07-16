import React, { useEffect, useState } from 'react';

interface SignatureViewerProps {
  src: string | null;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export const SignatureViewer: React.FC<SignatureViewerProps> = ({ src, className, style, alt = "Signature" }) => {
  const [trimmedSrc, setTrimmedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setTrimmedSrc(null);
      return;
    }

    // Try to trim existing signatures that might have massive whitespace
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        setTrimmedSrc(src);
        return;
      }
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }

      if (!found) {
        setTrimmedSrc(src);
        return;
      }

      const padding = 10;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(canvas.width - 1, maxX + padding);
      maxY = Math.min(canvas.height - 1, maxY + padding);

      const width = maxX - minX + 1;
      const height = maxY - minY + 1;

      // If it's practically the same size, no need to trim
      if (width >= canvas.width - 20 && height >= canvas.height - 20) {
        setTrimmedSrc(src);
        return;
      }

      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = width;
      trimmedCanvas.height = height;
      const trimmedCtx = trimmedCanvas.getContext('2d');
      if (trimmedCtx) {
        trimmedCtx.putImageData(ctx.getImageData(minX, minY, width, height), 0, 0);
        setTrimmedSrc(trimmedCanvas.toDataURL('image/png'));
      } else {
        setTrimmedSrc(src);
      }
    };
    img.onerror = () => {
      setTrimmedSrc(src);
    };
    img.src = src;
  }, [src]);

  if (!src) return null;

  return (
    <img 
      src={trimmedSrc || src} 
      className={className} 
      style={{ objectFit: 'contain', ...style }} 
      alt={alt} 
    />
  );
};
