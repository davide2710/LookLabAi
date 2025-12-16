import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';
import { BatchItem } from '../types';

interface Props {
  item: BatchItem;
  onClose: () => void;
}

export const ImageCompareModal: React.FC<Props> = ({ item, onClose }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Handle Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleMove = (clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
    }
  };

  const onMouseDown = () => { isDragging.current = true; };
  const onMouseUp = () => { isDragging.current = false; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) handleMove(e.clientX);
  };
  
  // Support clicking anywhere on the image to jump comparison
  const onContainerClick = (e: React.MouseEvent) => {
      handleMove(e.clientX);
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!item.processedUrl) return;

    const link = document.createElement('a');
    link.href = item.processedUrl;
    link.download = `looklab-${item.id}-processed.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasProcessed = !!item.processedUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
      
      {/* Header / Controls */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 pointer-events-none">
        <div className="pointer-events-auto">
             <h3 className="text-white font-bold text-lg">{item.id}</h3>
             <p className="text-gray-400 text-sm">
                {hasProcessed ? 'Trascina per confrontare' : 'Sorgente Originale'}
             </p>
        </div>
        
        <div className="flex gap-2 pointer-events-auto">
            {hasProcessed && (
                <button 
                  onClick={handleDownload}
                  className="bg-anthracite-800 text-white p-2 rounded-full hover:bg-neon-banana hover:text-black transition-colors"
                  title="Scarica Immagine Processata"
                >
                  <Icons.Download size={24} />
                </button>
            )}
            <button 
              onClick={onClose}
              className="bg-anthracite-800 text-white p-2 rounded-full hover:bg-neon-banana hover:text-black transition-colors"
            >
              <Icons.Plus className="rotate-45" size={24} />
            </button>
        </div>
      </div>

      {/* Image Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center select-none overflow-hidden rounded-lg shadow-2xl border border-anthracite-700 bg-anthracite-900"
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseMove={hasProcessed ? onMouseMove : undefined}
        onClick={hasProcessed ? onContainerClick : undefined}
      >
        {/* Base Image (Original / Before) */}
        {/* We use object-contain to ensure the whole image fits without cropping logic issues */}
        <img 
            src={item.originalUrl} 
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            alt="Original"
        />

        {hasProcessed && (
            <>
                {/* Overlay Image (Processed / After) */}
                <div 
                    className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
                    style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                >
                    <img 
                        src={item.processedUrl} 
                        className="absolute inset-0 w-full h-full object-contain"
                        alt="Processed"
                    />
                </div>

                {/* Slider Handle */}
                <div 
                    className="absolute inset-y-0 w-1 bg-neon-banana cursor-ew-resize hover:shadow-[0_0_15px_#D4FF00]"
                    style={{ left: `${sliderPosition}%` }}
                    onMouseDown={onMouseDown}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-neon-banana rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                        <Icons.Sliders size={14} className="text-black rotate-90" />
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};