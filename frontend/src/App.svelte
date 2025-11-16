<script>
let _diceType = $state(20);
let diceComponent;
let _lastResult = $state(null);
let isRolling = $state(false);

function _handleRoll() {
	if (isRolling) return;
	isRolling = true;
	_lastResult = null;
	if (diceComponent) {
		diceComponent.roll();
	}
}

function _handleRollComplete(result) {
	_lastResult = result;
	isRolling = false;
}

function _handleDiceTypeChange(event) {
	const value = parseInt(event.target.value, 10);
	if (value >= 2 && value <= 100) {
		_diceType = value;
	}
}
</script>

<main class="min-h-screen flex flex-col items-center justify-center p-8">
	<div class="w-full max-w-5xl flex flex-col items-center gap-8">
		<div class="w-full spinner-fullscreen flex items-center justify-center">
			<LinearSpinner
				bind:this={diceComponent}
				sides={diceType}
				onRollComplete={handleRollComplete}
			/>
		</div>
		<div class="flex flex-col items-center gap-3 w-full max-w-md">
			<div class="flex items-center gap-2 w-full">
				<input
					id="dice-type"
					type="number"
					min="2"
					max="100"
					value={diceType}
					oninput={handleDiceTypeChange}
					class="flex-1 px-4 py-3 border text-center text-2xl font-bold focus:outline-none"
					placeholder="Dice sides (e.g., 6, 20, 100)"
				/>
				<button
					onclick={handleRoll}
					disabled={isRolling}
					class="px-6 py-3 border font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isRolling ? 'Rolling…' : `Roll D${diceType}`}
				</button>
			</div>
			{#if lastResult !== null}
				<p class="text-sm">Result: <span class="font-bold">D{diceType} = {lastResult}</span></p>
			{/if}
		</div>
	</div>
</main>
