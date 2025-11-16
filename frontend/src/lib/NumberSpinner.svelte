<script>
import { onDestroy, onMount } from "svelte";

const { sides = 20, onRollComplete = () => {} } = $props();

let isSpinning = $state(false);
let container;
let viewportWidth = $state(0);
let itemWidth = $state(0);
let offsetPx = $state(0);
let _centerTranslatePx = $state(0);
let startIndex = 0;
let targetIndex = 0;

let rafId = null;
let _track = $state([]);
const REPEATS = 6; // enough length to scroll multiple loops

function clampSides(n) {
	return Math.max(2, Math.floor(n || 2));
}

function easeOutCubic(t) {
	return 1 - (1 - t) ** 3;
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cancelAnim() {
	if (rafId != null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
}

function buildTrack(totalSides) {
	const arr = [];
	for (let r = 0; r < REPEATS; r++) {
		for (let i = 1; i <= totalSides; i++) {
			arr.push(i);
		}
	}
	return arr;
}

function measure() {
	if (!container) return;
	const rect = container.getBoundingClientRect();
	viewportWidth = rect.width || 0;
	itemWidth = viewportWidth; // one number fills the viewport
}

onMount(() => {
	measure();
	const ro = new ResizeObserver(() => measure());
	if (container) ro.observe(container);
	return () => ro.disconnect();
});

onDestroy(() => {
	cancelAnim();
});

export async function roll() {
	if (isSpinning) return;
	const totalSides = clampSides(sides);
	_track = buildTrack(totalSides);
	measure();
	if (itemWidth === 0) return;

	isSpinning = true;

	const finalValue = randomInt(1, totalSides);
	const durationMs = 2300 + Math.random() * 900; // 2.3s - 3.2s
	const startTime = performance.now();

	// Start somewhere not too close to the very beginning to allow backward/forward flexibility
	const middleLoopStart = totalSides * Math.floor(REPEATS / 2);
	startIndex = middleLoopStart + randomInt(0, totalSides - 1);
	// Spin forward several loops and land on the chosen value
	const extraLoops = 2 + Math.floor(Math.random() * 2); // 2-3 extra loops
	// Compute delta from startIndex to desired final value in the ring
	const startMod = startIndex % totalSides;
	const desired = (finalValue - 1 + totalSides) % totalSides;
	const delta = (((desired - startMod) % totalSides) + totalSides) % totalSides;
	targetIndex = startIndex + extraLoops * totalSides + delta;

	const startOffset = startIndex * itemWidth;
	const endOffset = targetIndex * itemWidth;

	function frame(now) {
		const elapsed = now - startTime;
		const t = Math.min(1, elapsed / durationMs);
		const eased = easeOutCubic(t);

		offsetPx = startOffset + (endOffset - startOffset) * eased;
		_centerTranslatePx = offsetPx - (viewportWidth - itemWidth) / 2;

		if (t < 1) {
			rafId = requestAnimationFrame(frame);
			return;
		}

		// Snap to exact alignment
		offsetPx = endOffset;
		_centerTranslatePx = offsetPx - (viewportWidth - itemWidth) / 2;
		isSpinning = false;
		onRollComplete(finalValue);
	}

	rafId = requestAnimationFrame(frame);
}
</script>

<div bind:this={container} class="w-full h-full flex items-center justify-center select-none overflow-hidden">
	<!-- Viewport -->
	<div class="relative w-full" style="height: clamp(6rem, 35vh, 24rem);">
		<!-- Track -->
		<div
			class="absolute inset-0 flex items-center overflow-hidden"
			style=""
		>
			<div
				class="flex items-center"
				style="transform: translateX(-{centerTranslatePx}px); transition: transform 0.02s linear; will-change: transform;"
			>
				{#each track as n, i}
					<div
						class="shrink-0 flex items-center justify-center"
						style="
							width: {itemWidth}px;
							font-size: clamp(5rem, 26vw, 20rem);
						"
						aria-hidden={i !== targetIndex}
					>
						{n}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	:global(.spinner-fullscreen) {
		min-height: 70vh;
	}
</style>


