import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface DraggableEventButtonProps {
  onDragEnd?: (date: Date, hour: number, minute: number) => void;
  onClick?: () => void;
}

const HOLD_DURATION = 1000; // 2 seconds to initiate drag

export const DraggableEventButton: React.FC<DraggableEventButtonProps> = ({ onDragEnd, onClick }) => {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDraggingRef = useRef(false);
  const onDragEndRef = useRef(onDragEnd);

  // Keep ref updated
  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  const handleMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const handleMouseUpRef = useRef<((e: MouseEvent) => void) | null>(null);

  // Initialize refs for event handlers
  useEffect(() => {
    handleMouseMoveRef.current = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        setDragPosition({ x: e.clientX, y: e.clientY });
      }
    };

    handleMouseUpRef.current = (e: MouseEvent) => {
      if (isDraggingRef.current && onDragEndRef.current) {
        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (element) {
          const slotElement = element.closest('[data-slot-date]');
          if (slotElement) {
            const dateStr = slotElement.getAttribute('data-slot-date');
            const hour = parseInt(slotElement.getAttribute('data-slot-hour') || '9', 10);
            const minute = parseInt(slotElement.getAttribute('data-slot-minute') || '0', 10);
            
            if (dateStr) {
              const date = new Date(dateStr);
              onDragEndRef.current(date, hour, minute);
            }
          }
        }
      }
      
      isDraggingRef.current = false;
      setIsDragging(false);
      setDragPosition(null);
    };

    return () => {
      document.removeEventListener('mousemove', handleMouseMoveRef.current!);
      document.removeEventListener('mouseup', handleMouseUpRef.current!);
    };
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(() => {
    setIsHolding(true);
    
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);
      
      if (progress >= 100) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        setIsHolding(false);
        isDraggingRef.current = true;
        setIsDragging(true);
      }
    }, 50);

    holdTimerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setIsHolding(false);
      isDraggingRef.current = true;
      setIsDragging(true);
    }, HOLD_DURATION);
  }, []);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startHold();
    
    if (handleMouseMoveRef.current && handleMouseUpRef.current) {
      document.addEventListener('mousemove', handleMouseMoveRef.current);
      document.addEventListener('mouseup', handleMouseUpRef.current);
    }
  }, [startHold]);

  const handleMouseLeave = useCallback(() => {
    if (isHolding && !isDraggingRef.current) {
      cancelHold();
    }
  }, [isHolding, cancelHold]);

  return (
    <>
      <button
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        className={`
          relative flex items-center gap-2 px-4 py-2 text-sm font-medium 
          text-white rounded-lg transition-all
          ${isDragging ? 'opacity-50' : 'bg-indigo-600 hover:bg-indigo-700'}
        `}
      >
        <Plus className="w-4 h-4" />
        <span>Add Event</span>
        
        {isHolding && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-indigo-600">
            <svg className="w-full h-full absolute" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray={`${holdProgress * 1.0056} 100`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="relative z-10 text-xs font-bold text-white">
              {Math.round(holdProgress / 10)}
            </span>
          </div>
        )}
      </button>

      {isDragging && dragPosition && (
        <div
          className="fixed pointer-events-none z-[9999] opacity-90 shadow-2xl"
          style={{
            left: dragPosition.x - 80,
            top: dragPosition.y - 20,
            width: 160,
          }}
        >
          <div className="bg-indigo-500 text-white rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border-2 border-indigo-300">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Drop to create event
            </div>
          </div>
        </div>
      )}
    </>
  );
};