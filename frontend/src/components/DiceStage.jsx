import PropTypes from 'prop-types';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { DiceEngine } from '../dice/engine';
import { THEMES, themeForSides } from '../dice/themes';

const DiceStage = forwardRef(
  ({ onRollComplete, onNukeEnd, onStageGrab }, ref) => {
    const containerRef = useRef(null);
    const engineRef = useRef(null);
    const onCompleteRef = useRef(onRollComplete);
    const onNukeEndRef = useRef(onNukeEnd);
    const [result, setResult] = useState(null);
    const [flashId, setFlashId] = useState(null);
    const [muted, setMuted] = useState(false);
    const [failed, setFailed] = useState(false);

    onCompleteRef.current = onRollComplete;
    onNukeEndRef.current = onNukeEnd;

    useEffect(() => {
      let engine;
      try {
        engine = new DiceEngine(containerRef.current, {
          onResult: (r) => {
            setResult({ ...r, id: performance.now() });
            onCompleteRef.current?.(r);
          },
          onFlash: () => {
            setResult(null);
            setFlashId(performance.now());
          },
          onNukeEnd: () => onNukeEndRef.current?.(),
        });
      } catch (error) {
        console.error('Could not start 3D dice:', error);
        setFailed(true);
        return undefined;
      }
      engineRef.current = engine;
      setMuted(engine.audio.muted);
      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    }, []);

    useImperativeHandle(ref, () => ({
      roll(sides, options) {
        const started = engineRef.current?.roll(sides, options) ?? false;
        if (started) setResult(null);
        return started;
      },
    }));

    const toggleMute = () => {
      const next = !muted;
      setMuted(next);
      engineRef.current?.setMuted(next);
    };

    const glow = result ? THEMES[themeForSides(result.sides)].glow : '#fff';

    return (
      <div className="fixed inset-0">
        <div
          ref={containerRef}
          className="absolute inset-0 cursor-grab touch-none select-none"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            onStageGrab?.({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerId: event.pointerId,
            });
          }}
        />
        <div className="vignette pointer-events-none absolute inset-0" />

        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-300 text-xl">
            Your browser can't show 3D dice (WebGL unavailable).
          </div>
        )}

        {result && (
          <div
            key={result.id}
            className="pointer-events-none absolute inset-x-0 top-[6vh] flex flex-col items-center result-pop"
            style={{ '--glow': glow }}
          >
            <div
              className={`result-number ${result.max ? 'result-max' : ''} ${result.min ? 'result-min' : ''}`}
            >
              {result.value.toLocaleString()}
            </div>
          </div>
        )}

        {flashId && (
          <div
            key={flashId}
            className="nuke-flash pointer-events-none absolute inset-0 z-20"
            onAnimationEnd={() => setFlashId(null)}
          />
        )}

        <button
          type="button"
          onClick={toggleMute}
          className="absolute top-4 right-4 z-10 h-11 w-11 rounded-full glass text-xl flex items-center justify-center text-stone-200 hover:text-white transition"
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    );
  },
);

DiceStage.displayName = 'DiceStage';

DiceStage.propTypes = {
  onRollComplete: PropTypes.func,
  onNukeEnd: PropTypes.func,
  onStageGrab: PropTypes.func,
};

export default DiceStage;
