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
      'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
  },
  {
    sides: 8,
    label: 'D8',
    colorClass:
      'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
  },
  {
    sides: 20,
    label: 'D20',
    colorClass:
      'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
  },
];

export default function App() {
  const [diceType, setDiceType] = useState(20);
  const [lastResult, setLastResult] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const diceComponentRef = useRef(null);

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);
    setLastResult(null);
    diceComponentRef.current?.roll();
  };

  const handleRollComplete = (result) => {
    setLastResult(result);
    setIsRolling(false);
  };

  const handleDiceClick = (sides) => {
    if (isRolling) return;
    setDiceType(sides);
    setShowCustomInput(false);
    setTimeout(() => {
      if (!isRolling) {
        setIsRolling(true);
        setLastResult(null);
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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-5xl flex flex-col items-center gap-8">
        <div className="w-full spinner-fullscreen flex items-center justify-center">
          <LinearSpinner
            ref={diceComponentRef}
            sides={diceType}
            onRollComplete={handleRollComplete}
          />
        </div>

        <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full">
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
              colorClass="from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
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

          {lastResult !== null && (
            <div className="bg-white rounded-xl shadow-lg px-6 py-4 border border-slate-200 animate-fadeIn">
              <p className="text-lg text-slate-700">
                Result:{' '}
                <span className="font-bold text-2xl text-slate-900">
                  D{diceType} = {lastResult}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
