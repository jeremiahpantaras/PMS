import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import type Konva from 'konva';
import { chartImageMap, chartLabel } from '../utils/chartMapping';
import type { ChartType } from '@/types/clinicalTemplate';
import { Undo2, Trash2 } from 'lucide-react';

// ─── Stroke & Annotation Data Types ─────────────────────────────────────────

export interface ChartStroke {
  tool: 'pen';
  color: string;
  strokeWidth: number;
  points: number[];
}

export interface ChartAnnotation {
  canvas_image: string | null;
  doodle_data: ChartStroke[];
  chart_type?: string;
}

// ─── Color Palette ───────────────────────────────────────────────────────────

const BRUSH_COLORS: { label: string; color: string }[] = [
  { label: 'Blue', color: '#0575E6' },
  { label: 'Green', color: '#5CDB95' },
  { label: 'Red', color: '#EF4444' },
  { label: 'Orange', color: '#F59E0B' },
  { label: 'Purple', color: '#8B5CF6' },
  { label: 'Black', color: '#000000' },
];

const DEFAULT_STROKE_WIDTH = 3;

// ─── Props ───────────────────────────────────────────────────────────────────

interface ChartDrawingCanvasProps {
  chartType: ChartType;
  /** Existing saved annotation (canvas_image + doodle_data). */
  value?: ChartAnnotation | null;
  onChange?: (annotation: ChartAnnotation) => void;
  /** When true, shows the saved canvas image read-only (no drawing). */
  disabled?: boolean;
  label?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ChartDrawingCanvas: React.FC<ChartDrawingCanvasProps> = ({
  chartType,
  value,
  onChange,
  disabled = false,
  label,
  required,
  error,
  helpText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const [chartImage, setChartImage] = useState<HTMLImageElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(700);
  const [canvasHeight, setCanvasHeight] = useState(300);

  const [strokes, setStrokes] = useState<ChartStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<ChartStroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [selectedColor, setSelectedColor] = useState(BRUSH_COLORS[0].color);

  // ── Load chart image ──────────────────────────────────────────────────────
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = chartImageMap[chartType];
    img.onload = () => setChartImage(img);
  }, [chartType]);

  // ── Size canvas to container ──────────────────────────────────────────────
  useEffect(() => {
    if (!chartImage || !containerRef.current) return;

    const updateSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || 700;
      const ratio = chartImage.naturalHeight / chartImage.naturalWidth;
      setCanvasWidth(w);
      setCanvasHeight(Math.max(Math.round(w * ratio), 120));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [chartImage]);

  // ── Populate strokes from saved value ─────────────────────────────────────
  useEffect(() => {
    setStrokes(value?.doodle_data ?? []);
  }, [value]);

  // ── Export composite PNG and notify parent ─────────────────────────────────
  const exportAndNotify = useCallback(
    (latestStrokes: ChartStroke[]) => {
      if (!onChange) return;
      // Defer so Konva has rendered the new stroke
      setTimeout(() => {
        try {
          const dataURL = stageRef.current?.toDataURL({ pixelRatio: 1.5 }) ?? null;
          onChange({ canvas_image: dataURL, doodle_data: latestStrokes, chart_type: chartType });
        } catch (err) {
          console.error('Failed to generate canvas image:', err);
        }
      }, 60);
    },
    [onChange, chartType],
  );

  // ── Drawing handlers ──────────────────────────────────────────────────────
  const getPos = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    return stage?.getPointerPosition() ?? null;
  };

  const handlePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (disabled) return;
    e.evt.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setIsDrawing(true);
    setCurrentStroke({
      tool: 'pen',
      color: selectedColor,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      points: [pos.x, pos.y],
    });
  };

  const handlePointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing || !currentStroke || disabled) return;
    e.evt.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setCurrentStroke((prev) =>
      prev ? { ...prev, points: [...prev.points, pos.x, pos.y] } : prev,
    );
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    const next = [...strokes, currentStroke];
    setStrokes(next);
    setCurrentStroke(null);
    exportAndNotify(next);
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke(null);
    onChange?.({ canvas_image: null, doodle_data: [] });
  };

  const handleUndo = () => {
    const next = strokes.slice(0, -1);
    setStrokes(next);
    exportAndNotify(next);
  };

  const name = chartLabel[chartType];



  // ── Disabled / Read-only mode ─────────────────────────────────────────────
  if (disabled) {
    const savedImg = value?.canvas_image;
    const finalImg = savedImg || chartImageMap[chartType];
    return (
      <div>
        {label && (
          <p className="text-xs font-medium text-gray-600 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </p>
        )}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <img src={finalImg} alt={name || 'Chart Annotation'} className="max-w-full h-auto block" />
        </div>
        {helpText && <p className="text-xs text-gray-400 mt-1 italic">{helpText}</p>}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  // ── Edit / Draw mode ──────────────────────────────────────────────────────
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Color swatches */}
        {BRUSH_COLORS.map(({ label: colorLabel, color }) => (
          <button
            key={color}
            type="button"
            title={colorLabel}
            onClick={() => setSelectedColor(color)}
            className={`w-6 h-6 rounded-full border-2 transition-transform focus:outline-none ${
              selectedColor === color
                ? 'border-gray-700 ring-2 ring-offset-1 ring-gray-400 scale-110'
                : 'border-gray-300 hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}

        <span className="ml-1 text-xs text-gray-400 hidden sm:inline">Pen</span>

        <div className="flex-1" />

        {/* Undo */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={strokes.length === 0}
          title="Undo last stroke"
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={handleClear}
          disabled={strokes.length === 0}
          title="Clear all annotations"
          className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="rounded-xl border border-gray-200 overflow-hidden bg-white select-none"
        style={{ cursor: 'crosshair' }}
      >
        {chartImage && canvasWidth > 0 && canvasHeight > 0 ? (
          <Stage
            ref={stageRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            {/* Layer 1: Chart image */}
            <Layer>
              <KonvaImage image={chartImage} width={canvasWidth} height={canvasHeight} />
            </Layer>

            {/* Layer 2: Saved strokes + current in-progress stroke */}
            <Layer>
              {strokes.map((stroke, i) => (
                <Line
                  key={i}
                  points={stroke.points}
                  stroke={stroke.color}
                  strokeWidth={stroke.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              ))}
              {currentStroke && (
                <Line
                  points={currentStroke.points}
                  stroke={currentStroke.color}
                  strokeWidth={currentStroke.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
            </Layer>
          </Stage>
        ) : (
          <div
            className="flex items-center justify-center bg-gray-50"
            style={{ height: `${canvasHeight}px` }}
          >
            <p className="text-sm text-gray-400">Loading {name}…</p>
          </div>
        )}
      </div>

      {helpText && <p className="text-xs text-gray-400 mt-1 italic">{helpText}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};
