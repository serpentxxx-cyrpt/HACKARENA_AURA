import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export default function SliderSOS({ onTrigger }) {
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0);
  const trackRef = useRef(null);
  const thumbRef = useRef(null);

  const handleStart = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging) return;
      
      const track = trackRef.current;
      const thumb = thumbRef.current;
      if (!track || !thumb) return;

      const trackRect = track.getBoundingClientRect();
      const thumbWidth = thumb.offsetWidth;
      const maxSlide = trackRect.width - thumbWidth - 8; // 8px total horizontal padding

      // Get pageX for mouse or touch
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      let relativeX = clientX - trackRect.left - thumbWidth / 2;

      // Restrict boundaries
      if (relativeX < 4) relativeX = 4;
      if (relativeX > maxSlide) relativeX = maxSlide;

      setSliderPosition(relativeX);

      // Check if trigger threshold reached (92% of maximum slide)
      if (relativeX >= maxSlide * 0.95) {
        setIsDragging(false);
        setSliderPosition(0);
        onTrigger();
      }
    };

    const handleEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      
      // Bounce back to start with a smooth CSS transition
      let pos = sliderPosition;
      const bounce = setInterval(() => {
        if (pos <= 4) {
          setSliderPosition(0);
          clearInterval(bounce);
        } else {
          pos -= Math.max(10, pos * 0.25);
          setSliderPosition(pos < 4 ? 0 : pos);
        }
      }, 16);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, sliderPosition, onTrigger]);

  return (
    <div className="w-full max-w-md mx-auto px-4 mt-6">
      <div 
        ref={trackRef} 
        className="sos-slider-track select-none relative bg-aura-card border-2 border-aura-ink rounded-full"
      >
        {/* Placeholder instruction text behind button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none font-sans font-bold text-xs uppercase tracking-widest text-aura-ink/40 pl-12 pr-4">
          Slide to Trigger Critical SOS
        </div>

        {/* Drag handle thumb */}
        <button
          ref={thumbRef}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          style={{ transform: `translateX(${sliderPosition}px)` }}
          className="absolute left-1 w-14 h-14 rounded-full bg-aura-sos flex items-center justify-center cursor-grab active:cursor-grabbing border border-aura-ink shadow-sm transition-transform duration-75 text-white active:bg-opacity-90 hover:scale-105 active:scale-95"
        >
          <ArrowRight className="w-6 h-6 animate-pulse" />
        </button>

        {/* Dynamic track color overlay */}
        <div 
          style={{ width: `${sliderPosition + 32}px` }}
          className="absolute left-0 top-0 bottom-0 bg-aura-sos/10 rounded-l-full border-r border-aura-sos/20 pointer-events-none transition-all duration-75"
        />
      </div>
    </div>
  );
}
