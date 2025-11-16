import { useRef, useState } from "react";
import LinearSpinner from "./lib/LinearSpinner";
import "./app.css";

const MAX_SIDES = 1000000;
const MIN_SIDES = 1;

function App() {
	const [diceType, setDiceType] = useState(20);
	const [lastResult, setLastResult] = useState(null);
	const [isRolling, setIsRolling] = useState(false);
	const [customValue, setCustomValue] = useState("");
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
		// Trigger roll after state update
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
		} else if (event.target.value === "") {
			setCustomValue("");
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
						<button
							type="button"
							onClick={() => handleDiceClick(6)}
							disabled={isRolling}
							className="group relative px-6 py-4 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
						>
							<span className="relative z-10">D6</span>
							<div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
						</button>

						<button
							type="button"
							onClick={() => handleDiceClick(8)}
							disabled={isRolling}
							className="group relative px-6 py-4 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
						>
							<span className="relative z-10">D8</span>
							<div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
						</button>

						<button
							type="button"
							onClick={() => handleDiceClick(20)}
							disabled={isRolling}
							className="group relative px-6 py-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
						>
							<span className="relative z-10">D20</span>
							<div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
						</button>

						<button
							type="button"
							onClick={handleCustomClick}
							disabled={isRolling}
							className="group relative px-6 py-4 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
						>
							<span className="relative z-10">Custom</span>
							<div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
						</button>
					</div>

					{showCustomInput && (
						<div className="w-full bg-white rounded-xl shadow-lg p-6 border border-slate-200 animate-fadeIn">
							<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
								<input
									type="number"
									min="1"
									max="1000000"
									value={customValue}
									onInput={handleCustomInput}
									placeholder="Enter 1-1,000,000"
									className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-lg text-center text-lg font-semibold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
								/>
								<button
									type="button"
									onClick={handleCustomRoll}
									disabled={isRolling || !customValue}
									className="px-6 py-3 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg font-bold text-lg shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
								>
									Roll
								</button>
							</div>
							<p className="text-xs text-slate-500 mt-2 text-center">
								Enter a number between 1 and 1,000,000
							</p>
						</div>
					)}

					{lastResult !== null && (
						<div className="bg-white rounded-xl shadow-lg px-6 py-4 border border-slate-200 animate-fadeIn">
							<p className="text-lg text-slate-700">
								Result:{" "}
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

export default App;
