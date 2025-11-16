import PropTypes from 'prop-types';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

const clampSides = (n) => Math.max(2, Math.floor(n || 2));
const easeOutQuart = (t) => 1 - (1 - t) ** 4;
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const LinearSpinner = forwardRef(
  ({ sides = 20, onRollComplete = () => {} }, ref) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [finalValue, setFinalValue] = useState(null);
    const [displayNumbers, setDisplayNumbers] = useState([]);

    const containerRef = useRef(null);
    const rafIdRef = useRef(null);
    const startTimeRef = useRef(0);
    const durationMsRef = useRef(0);
    const fullSequenceRef = useRef([]);
    const currentScrollRef = useRef(0);
    const targetScrollRef = useRef(0);
    const lastTickIndexRef = useRef(-1);
    const audioCtxRef = useRef(null);
    const itemWidthRef = useRef(200);

    const cancelRaf = useCallback(() => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }, []);

    const ensureAudio = () => {
      if (!audioCtxRef.current) {
        try {
          const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;
          audioCtxRef.current = new AudioContextClass();
        } catch {
          audioCtxRef.current = null;
        }
      }
      return audioCtxRef.current;
    };

    const playTick = () => {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;

      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(
        1,
        ctx.sampleRate * 0.025,
        ctx.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1400;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.04);
    };

    const generateSpinSequence = (totalSides, targetNumber) => {
      let sequenceLength;
      if (totalSides <= 20) {
        sequenceLength = 40;
      } else if (totalSides <= 100) {
        sequenceLength = 50;
      } else if (totalSides <= 1000) {
        sequenceLength = 60;
      } else {
        sequenceLength = 70;
      }

      const sequence = [];

      const phase1Count = Math.floor(sequenceLength * 0.3);
      for (let i = 0; i < phase1Count; i++) {
        sequence.push(randomInt(1, totalSides));
      }

      const phase2Count = Math.floor(sequenceLength * 0.4);
      const range = Math.max(10, Math.floor(totalSides * 0.2));
      for (let i = 0; i < phase2Count; i++) {
        const min = Math.max(1, targetNumber - range);
        const max = Math.min(totalSides, targetNumber + range);
        sequence.push(randomInt(min, max));
      }

      const phase3Count = Math.floor(sequenceLength * 0.2);
      const narrowRange = Math.max(3, Math.floor(totalSides * 0.05));
      for (let i = 0; i < phase3Count; i++) {
        const min = Math.max(1, targetNumber - narrowRange);
        const max = Math.min(totalSides, targetNumber + narrowRange);
        sequence.push(randomInt(min, max));
      }

      sequence.push(targetNumber);

      // Add extra numbers after target to create infinite illusion
      const extraCount = 10;
      for (let i = 0; i < extraCount; i++) {
        sequence.push(randomInt(1, totalSides));
      }

      return sequence;
    };

    const updateVisibleNumbers = useCallback((scrollPosition) => {
      const sequence = fullSequenceRef.current;
      if (sequence.length === 0) return;

      const itemWidth = itemWidthRef.current;
      const centerIndex = scrollPosition / itemWidth;

      const windowSize = 15;
      const startIdx = Math.max(
        0,
        Math.floor(centerIndex) - Math.floor(windowSize / 2),
      );
      const endIdx = Math.min(sequence.length, startIdx + windowSize);

      const visibleNums = [];
      for (let i = startIdx; i < endIdx; i++) {
        visibleNums.push({
          value: sequence[i],
          index: i,
          position: i * itemWidth,
        });
      }

      setDisplayNumbers(visibleNums);
    }, []);

    const step = (now) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(1, elapsed / durationMsRef.current);
      const eased = easeOutQuart(t);

      const currentScroll =
        currentScrollRef.current +
        (targetScrollRef.current - currentScrollRef.current) * eased;

      updateVisibleNumbers(currentScroll);

      const itemWidth = itemWidthRef.current;
      const currentIndex = Math.floor(currentScroll / itemWidth);
      if (
        currentIndex !== lastTickIndexRef.current &&
        currentIndex < fullSequenceRef.current.length
      ) {
        lastTickIndexRef.current = currentIndex;
        playTick();
      }

      if (t < 1) {
        rafIdRef.current = requestAnimationFrame(step);
        return;
      }

      setIsSpinning(false);
      onRollComplete(finalValue);
    };

    const roll = () => {
      if (isSpinning) return;

      const totalSides = clampSides(sides);
      const newFinalValue = randomInt(1, totalSides);
      setFinalValue(newFinalValue);

      // Calculate item width based on number of digits
      const maxDigits = totalSides.toString().length;
      const baseWidth = 200;
      const widthPerDigit = 80;
      itemWidthRef.current = baseWidth + (maxDigits - 1) * widthPerDigit;

      const sequence = generateSpinSequence(totalSides, newFinalValue);
      fullSequenceRef.current = sequence;

      const itemWidth = itemWidthRef.current;
      currentScrollRef.current = 0;
      // Stop at target number position (before extra numbers)
      const targetIndex = sequence.findIndex((num, idx) => 
        num === newFinalValue && idx > sequence.length - 15
      );
      targetScrollRef.current = (targetIndex !== -1 ? targetIndex : sequence.length - 11) * itemWidth;

      updateVisibleNumbers(0);

      lastTickIndexRef.current = -1;
      durationMsRef.current = 2000 + Math.random() * 800;
      startTimeRef.current = performance.now();
      setIsSpinning(true);

      cancelRaf();
      rafIdRef.current = requestAnimationFrame(step);
    };

    useImperativeHandle(ref, () => ({
      roll,
    }));

    useEffect(() => {
      return () => cancelRaf();
    }, [cancelRaf]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden select-none"
      >
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 'clamp(6rem, 35vh, 24rem)' }}
        >
          <div
            className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-blue-500 to-transparent opacity-30 pointer-events-none z-10"
            style={{ transform: 'translateX(-50%)' }}
          />

          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none z-10" />

          <div className="absolute inset-0 flex items-center">
            <div className="relative w-full h-full flex items-center">
              {displayNumbers.length > 0 ? (
                displayNumbers.map((item) => {
                  const currentScroll = currentScrollRef.current;
                  const targetScroll = targetScrollRef.current;
                  const t = isSpinning
                    ? Math.min(
                        1,
                        (performance.now() - startTimeRef.current) /
                          durationMsRef.current,
                      )
                    : 1;
                  const eased = easeOutQuart(t);
                  const interpolatedScroll =
                    currentScroll + (targetScroll - currentScroll) * eased;

                  const offset = item.position - interpolatedScroll;

                  const distanceFromCenter = Math.abs(offset);
                  const maxDistance = 400;
                  const opacity = Math.max(
                    0.2,
                    1 - distanceFromCenter / maxDistance,
                  );

                  const scale = Math.max(
                    0.6,
                    1 - Math.abs(distanceFromCenter) / 800,
                  );

                  return (
                    <div
                      key={`${item.index}-${item.value}`}
                      className="absolute flex items-center justify-center"
                      style={{
                        left: '50%',
                        transform: `translateX(calc(-50% + ${offset}px)) scale(${scale})`,
                        width: `${itemWidthRef.current}px`,
                        fontSize: 'clamp(4rem, 20vw, 16rem)',
                        lineHeight: 1,
                        fontWeight: 700,
                        fontFamily: '"Reddit Mono", ui-monospace, monospace',
                        color: '#1e293b',
                        opacity: opacity,
                        transition: t >= 1 ? 'transform 0.3s ease-out' : 'none',
                      }}
                    >
                      {item.value}
                    </div>
                  );
                })
              ) : (
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 'clamp(5rem, 26vw, 20rem)',
                    lineHeight: 1,
                    fontWeight: 700,
                    fontFamily: '"Reddit Mono", ui-monospace, monospace',
                    color: '#1e293b',
                  }}
                >
                  ?
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

LinearSpinner.displayName = 'LinearSpinner';

LinearSpinner.propTypes = {
  sides: PropTypes.number,
  onRollComplete: PropTypes.func,
};

export default LinearSpinner;
