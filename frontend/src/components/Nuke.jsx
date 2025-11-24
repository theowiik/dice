import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Nuke() {
  const [countdown, setCountdown] = useState(10);
  const [isExploding, setIsExploding] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const audioContextRef = useRef(null);
  const tickSoundRef = useRef(null);

  // Create tick sound using Web Audio API
  useEffect(() => {
    // @ts-ignore - webkitAudioContext is for older browsers
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContextClass();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playTickSound = () => {
    if (!audioContextRef.current) return;
    
    const audioContext = audioContextRef.current;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const playExplosionSound = () => {
    if (!audioContextRef.current) return;
    
    const audioContext = audioContextRef.current;
    
    // Create multiple oscillators for a complex explosion sound
    const frequencies = [50, 80, 120, 200, 300];
    frequencies.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = 'sawtooth';
      
      const startTime = audioContext.currentTime + index * 0.01;
      gainNode.gain.setValueAtTime(0.5, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 2);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 2);
    });

    // Add white noise for the explosion
    const bufferSize = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = audioContext.createGain();
    noise.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    
    noiseGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
    
    noise.start(audioContext.currentTime);
  };

  const startCountdown = () => {
    setHasStarted(true);
    setCountdown(10);
    setIsExploding(false);
  };

  useEffect(() => {
    if (!hasStarted) return;
    
    if (countdown > 0) {
      playTickSound();
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !isExploding) {
      setIsExploding(true);
      playExplosionSound();
    }
  }, [countdown, isExploding, hasStarted]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-900 overflow-hidden relative">
      {/* Navigation */}
      <Link
        to="/"
        className="absolute top-8 left-8 px-6 py-3 bg-gradient-to-br from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 z-50"
      >
        ← Back to Dice
      </Link>

      {/* Countdown Display */}
      {!hasStarted && (
        <div className="flex flex-col items-center gap-8">
          <h1 className="text-6xl font-bold text-stone-100 mb-8">☢️ NUKE ☢️</h1>
          <button
            type="button"
            onClick={startCountdown}
            className="px-12 py-6 bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white rounded-xl font-bold text-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200"
          >
            LAUNCH
          </button>
        </div>
      )}

      {hasStarted && !isExploding && (
        <div className="flex flex-col items-center gap-8">
          <div className="text-stone-400 text-2xl font-bold mb-4 animate-pulse">
            DETONATION IMMINENT
          </div>
          <div
            className="text-[20rem] font-bold text-red-500 animate-pulse"
            style={{
              textShadow: '0 0 40px rgba(239, 68, 68, 0.8), 0 0 80px rgba(239, 68, 68, 0.4)',
              animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {isExploding && (
        <>
          {/* Multiple expanding explosion circles */}
          <div className="absolute inset-0 flex items-center justify-center">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: '100px',
                  height: '100px',
                  background: `radial-gradient(circle, 
                    rgba(255, 255, 255, ${1 - i * 0.15}) 0%, 
                    rgba(255, 200, 0, ${0.9 - i * 0.15}) 20%, 
                    rgba(255, 100, 0, ${0.7 - i * 0.1}) 40%, 
                    rgba(255, 0, 0, ${0.5 - i * 0.1}) 60%, 
                    rgba(139, 0, 0, ${0.3 - i * 0.05}) 80%, 
                    transparent 100%)`,
                  animation: `explode ${2 + i * 0.3}s ease-out forwards`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>

          {/* Flash effect */}
          <div
            className="absolute inset-0 bg-white"
            style={{
              animation: 'flash 0.5s ease-out forwards',
            }}
          />

          {/* Particles */}
          {[...Array(50)].map((_, i) => {
            const angle = (Math.PI * 2 * i) / 50;
            const distance = 50 + Math.random() * 50;
            const particleStyle = {
              left: '50%',
              top: '50%',
              background: `hsl(${Math.random() * 60}, 100%, 50%)`,
              animation: `particle ${1 + Math.random()}s ease-out forwards`,
            };
            // @ts-ignore - CSS custom properties
            particleStyle['--angle'] = `${angle}rad`;
            particleStyle['--distance'] = `${distance}vw`;
            return (
              <div
                key={i}
                className="absolute w-4 h-4 rounded-full"
                style={particleStyle}
              />
            );
          })}

          {/* Explosion text */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              animation: 'fadeInScale 0.5s ease-out 0.5s forwards',
              opacity: 0,
            }}
          >
            <div className="text-9xl font-bold text-orange-500">
              💥 BOOM! 💥
            </div>
          </div>

          {/* Restart button */}
          <button
            type="button"
            onClick={startCountdown}
            className="absolute bottom-16 px-12 py-6 bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white rounded-xl font-bold text-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 z-50"
            style={{
              animation: 'fadeInScale 0.5s ease-out 2s forwards',
              opacity: 0,
            }}
          >
            LAUNCH AGAIN
          </button>
        </>
      )}

      <style>{`
        @keyframes explode {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(50);
            opacity: 0;
          }
        }

        @keyframes flash {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes particle {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance)) scale(0);
            opacity: 0;
          }
        }

        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(0.95);
          }
        }
      `}</style>
    </main>
  );
}

