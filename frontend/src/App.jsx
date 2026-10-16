import { useCallback, useEffect, useRef, useState } from 'react';
import CustomDiceInput from './components/CustomDiceInput';
import DiceButton from './components/DiceButton';
import DiceStage from './components/DiceStage';
import { THEMES, themeForSides } from './dice/themes';

const MAX_SIDES = 1000000;
const MIN_SIDES = 1;
const NUKE_TRIGGER = 500;
const HISTORY_SIZE = 10;

const DICE_CONFIGS = [
  { sides: 6, label: 'D6' },
  { sides: 8, label: 'D8' },
  { sides: 10, label: 'D10' },
  { sides: 12, label: 'D12' },
  { sides: 20, label: 'D20' },
  { sides: 500, label: '☢️ D500' },
];

export default function App() {
  const [diceType, setDiceType] = useState(20);
  const [isRolling, setIsRolling] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [history, setHistory] = useState([]);
  const stageRef = useRef(null);

  const startRoll = useCallback((sides, options) => {
    if (stageRef.current?.roll(sides, options)) {
      setIsRolling(true);
    }
  }, []);

  const handleRollComplete = (result) => {
    // A 500 detonates; controls stay locked until the cloud clears.
    if (!result.nuke) setIsRolling(false);
    setHistory((h) =>
      [{ ...result, id: performance.now() }, ...h].slice(0, HISTORY_SIZE),
    );
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Secret keyboard shortcut: Ctrl+Alt+N or Cmd+Alt+N throws a rigged D500
      if (
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        event.key.toLowerCase() === 'n'
      ) {
        event.preventDefault();
        setDiceType(NUKE_TRIGGER);
        setShowCustomInput(false);
        startRoll(NUKE_TRIGGER, { force: NUKE_TRIGGER });
        return;
      }
      const tag = event.target?.tagName;
      if (
        (event.key === ' ' || event.key === 'Enter') &&
        tag !== 'INPUT' &&
        tag !== 'BUTTON'
      ) {
        event.preventDefault();
        startRoll(diceType);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [diceType, startRoll]);

  const handleDiceClick = (sides) => {
    if (isRolling) return;
    setDiceType(sides);
    setShowCustomInput(false);
    startRoll(sides);
  };

  const handleCustomClick = () => {
    setShowCustomInput(!showCustomInput);
  };

  const handleCustomInput = (event) => {
    const value = parseInt(event.target.value, 10);
    if (!Number.isNaN(value) && value >= MIN_SIDES && value <= MAX_SIDES) {
      setCustomValue(value.toString());
    } else if (event.target.value === '') {
      setCustomValue('');
    }
  };

  const handleCustomRoll = () => {
    const value = parseInt(customValue, 10);
    if (!Number.isNaN(value) && value >= MIN_SIDES && value <= MAX_SIDES) {
      setDiceType(value);
      startRoll(value);
    }
  };

  const isCustom = !DICE_CONFIGS.some((c) => c.sides === diceType);

  return (
    <main className="min-h-screen overflow-hidden bg-stone-950 text-stone-100">
      <DiceStage
        ref={stageRef}
        onRollComplete={handleRollComplete}
        onNukeEnd={() => setIsRolling(false)}
        onStageGrab={(pointer) => startRoll(diceType, { pointer })}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-4 pb-5 sm:pb-8">
        {history.length > 0 && (
          <div className="flex max-w-full gap-2 overflow-hidden">
            {history.map((h, i) => (
              <span
                key={h.id}
                className="history-chip"
                style={{
                  '--glow': THEMES[themeForSides(h.sides)].glow,
                  opacity: 1 - i * 0.08,
                }}
                title={`d${h.sides}`}
              >
                {h.value.toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {showCustomInput && (
          <CustomDiceInput
            value={customValue}
            onInput={handleCustomInput}
            onRoll={handleCustomRoll}
            disabled={isRolling}
          />
        )}

        <div className="pointer-events-auto glass flex flex-wrap justify-center gap-2 rounded-2xl p-2 sm:gap-3 sm:p-3">
          {DICE_CONFIGS.map((config) => (
            <DiceButton
              key={config.sides}
              label={config.label}
              onClick={() => handleDiceClick(config.sides)}
              disabled={isRolling}
              active={diceType === config.sides}
              glow={THEMES[themeForSides(config.sides)].glow}
            />
          ))}
          <DiceButton
            label="Custom"
            onClick={handleCustomClick}
            disabled={isRolling}
            active={isCustom || showCustomInput}
            glow={THEMES.custom.glow}
          />
        </div>
      </div>
    </main>
  );
}
