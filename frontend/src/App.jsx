import { useRef, useState } from 'react';
import CustomDiceInput from './components/CustomDiceInput';
import DiceButton from './components/DiceButton';
import LinearSpinner from './components/LinearSpinner';

const MAX_SIDES = 1000000;
const MIN_SIDES = 1;

const DICE_CONFIGS = [
  {
    sides: 6,
    label: 'D6',
    colorClass:
      'from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700',
  },
  {
    sides: 8,
    label: 'D8',
    colorClass:
      'from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700',
  },
  {
    sides: 20,
    label: 'D20',
    colorClass:
      'from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700',
  },
  {
    sides: 500,
    label: '☢️ D500',
    colorClass:
      'from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700',
  },
];

export default function App() {
  const [diceType, setDiceType] = useState(20);
  const [isRolling, setIsRolling] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const diceComponentRef = useRef(null);

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);
    diceComponentRef.current?.roll();
  };

  const handleRollComplete = () => {
    setIsRolling(false);
  };

  const handleDiceClick = (sides) => {
    if (isRolling) return;
    setDiceType(sides);
    setShowCustomInput(false);
    setTimeout(() => {
      if (!isRolling) {
        setIsRolling(true);
        diceComponentRef.current?.roll();
      }
    }, 0);
  };

  const handleCustomClick = () => {
    setShowCustomInput(!showCustomInput);
  };

  const handleCustomInput = (event) => {
    const value = parseInt(event.target.value, 10);
    if (!Number.isNaN(value) && value >= MIN_SIDES && value <= MAX_SIDES) {
      setCustomValue(value.toString());
      setDiceType(value);
    } else if (event.target.value === '') {
      setCustomValue('');
    }
  };

  const handleCustomRoll = () => {
    const value = parseInt(customValue, 10);
    if (!Number.isNaN(value) && value >= MIN_SIDES && value <= MAX_SIDES) {
      setDiceType(value);
      handleRoll();
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-900">
      <div className="w-full flex flex-col items-center gap-8">
        <div className="w-full spinner-fullscreen flex items-center justify-center">
          <LinearSpinner
            ref={diceComponentRef}
            sides={diceType}
            onRollComplete={handleRollComplete}
          />
        </div>

        <div className="flex flex-col items-center gap-6 px-4 sm:px-8">
          <div className="inline-flex flex-col items-stretch gap-6">
            <div className="flex flex-wrap justify-center gap-3">
              {DICE_CONFIGS.map((config) => (
                <DiceButton
                  key={config.sides}
                  label={config.label}
                  onClick={() => handleDiceClick(config.sides)}
                  disabled={isRolling}
                  colorClass={config.colorClass}
                />
              ))}
              <DiceButton
                label="Custom"
                onClick={handleCustomClick}
                disabled={isRolling}
                colorClass="from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700"
              />
            </div>

            {showCustomInput && (
              <CustomDiceInput
                value={customValue}
                onInput={handleCustomInput}
                onRoll={handleCustomRoll}
                disabled={isRolling}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
