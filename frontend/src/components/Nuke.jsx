import { useEffect, useRef } from 'react';

export default function Nuke({ onComplete }) {
  const audioRef = useRef(null);

  // Load audio file
  useEffect(() => {
    audioRef.current = new Audio('/nuke.mp3');
    audioRef.current.volume = 1;

    // Delay the sound - light travels faster than sound (like a real nuke)
    const soundDelay = 1500; // 1.5 second delay after the flash
    const soundTimeout = setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((error) => {
          console.error('Error playing audio:', error);
        });
      }
    }, soundDelay);

    return () => {
      clearTimeout(soundTimeout);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* White screen - fades in then out */}
      <div
        className="absolute inset-0 bg-white"
        style={{
          animation: 'whiteFlash 8s ease-in-out forwards',
        }}
        onAnimationEnd={onComplete}
      />

      <style>{`
        @keyframes whiteFlash {
          0% {
            opacity: 1;
          }
          2% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
