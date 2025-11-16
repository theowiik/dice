<script>
import LinearSpinner from './lib/LinearSpinner.svelte';

let diceType = $state(20);
let diceComponent;
let lastResult = $state(null);
let isRolling = $state(false);
let customValue = $state('');
let showCustomInput = $state(false);

const MAX_SIDES = 1000000;
const MIN_SIDES = 1;

function handleRoll() {
	if (isRolling) return;
	isRolling = true;
	lastResult = null;
	diceComponent?.roll();
}

function handleRollComplete(result) {
	lastResult = result;
	isRolling = false;
}

function handleDiceClick(sides) {
	if (isRolling) return;
	diceType = sides;
	showCustomInput = false;
	handleRoll();
}

function handleCustomClick() {
	showCustomInput = !showCustomInput;
}

function handleCustomInput(event) {
	const value = parseInt(event.target.value, 10);
	if (!isNaN(value) && value >= MIN_SIDES && value <= MAX_SIDES) {
		customValue = value.toString();
		diceType = value;
	} else if (event.target.value === '') {
		customValue = '';
	}
}

function handleCustomRoll() {
	const value = parseInt(customValue, 10);
	if (!isNaN(value) && value >= MIN_SIDES && value <= MAX_SIDES) {
		diceType = value;
		handleRoll();
	}
}
</script>

<main class="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100">
	<div class="w-full max-w-5xl flex flex-col items-center gap-8">
		<div class="w-full spinner-fullscreen flex items-center justify-center">
			<LinearSpinner
				bind:this={diceComponent}
				sides={diceType}
				onRollComplete={handleRollComplete}
			/>
		</div>
		
		<div class="flex flex-col items-center gap-6 w-full max-w-2xl">
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full">
				<button
					onclick={() => handleDiceClick(6)}
					disabled={isRolling}
					class="group relative px-6 py-4 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
				>
					<span class="relative z-10">D6</span>
					<div class="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
				</button>
				
				<button
					onclick={() => handleDiceClick(8)}
					disabled={isRolling}
					class="group relative px-6 py-4 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
				>
					<span class="relative z-10">D8</span>
					<div class="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
				</button>
				
				<button
					onclick={() => handleDiceClick(20)}
					disabled={isRolling}
					class="group relative px-6 py-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
				>
					<span class="relative z-10">D20</span>
					<div class="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
				</button>
				
				<button
					onclick={handleCustomClick}
					disabled={isRolling}
					class="group relative px-6 py-4 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
				>
					<span class="relative z-10">Custom</span>
					<div class="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
				</button>
			</div>
			
			{#if showCustomInput}
				<div class="w-full bg-white rounded-xl shadow-lg p-6 border border-slate-200 animate-fadeIn">
					<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
						<input
							type="number"
							min="1"
							max="1000000"
							value={customValue}
							oninput={handleCustomInput}
							placeholder="Enter 1-1,000,000"
							class="flex-1 px-4 py-3 border-2 border-slate-300 rounded-lg text-center text-lg font-semibold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
						/>
						<button
							onclick={handleCustomRoll}
							disabled={isRolling || !customValue}
							class="px-6 py-3 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg font-bold text-lg shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
						>
							Roll
						</button>
					</div>
					<p class="text-xs text-slate-500 mt-2 text-center">Enter a number between 1 and 1,000,000</p>
				</div>
			{/if}
			
			{#if lastResult !== null}
				<div class="bg-white rounded-xl shadow-lg px-6 py-4 border border-slate-200 animate-fadeIn">
					<p class="text-lg text-slate-700">
						Result: <span class="font-bold text-2xl text-slate-900">D{diceType} = {lastResult}</span>
					</p>
				</div>
			{/if}
		</div>
	</div>
</main>

<style>
@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(-10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.animate-fadeIn {
	animation: fadeIn 0.3s ease-out;
}
</style>
