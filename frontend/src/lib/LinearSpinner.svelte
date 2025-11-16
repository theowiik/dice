<script>
import { onDestroy, onMount } from "svelte";

const { sides = 20, onRollComplete = () => {} } = $props();

// State
let isSpinning = $state(false);
let finalValue = $state(null);

// Layout
let container;
let viewportWidth = $state(0);
let itemWidth = $state(0);
let centerOffsetPx = $state(0);

// Animation
let rafId = null;
let startTime = 0;
let durationMs = 0;
let startPos = 0; // in item units
let endPos = 0; // in item units
let currentPos = $state(0); // in item units
let lastTickIndex = -1;

const REPEATS = 5; // repeat the ring a few times to scroll through

function clampSides(n) {
	return Math.max(2, Math.floor(n || 2));
}

function easeOutCubic(t) {
	return 1 - (1 - t) ** 3;
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cancelRaf() {
	if (rafId != null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
}

function measure() {
	if (!container) return;
	const rect = container.getBoundingClientRect();
	viewportWidth = rect.width || 0;
	itemWidth = viewportWidth; // single number fills viewport
	centerOffsetPx = (viewportWidth - itemWidth) / 2; // likely 0, but explicit
}

// --- Tick sound (WebAudio) ---
let audioCtx = null;
function ensureAudio() {
	// Create on first need (after a user gesture)
	if (!audioCtx) {
		try {
			audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		} catch {
			audioCtx = null;
		}
	}
	return audioCtx;
}

function playTick() {
	const ctx = ensureAudio();
	if (!ctx) return;
	const now = ctx.currentTime;

	// Short percussive click using filtered noise
	const noise = ctx.createBufferSource();
	const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate); // ~30ms
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
		// slight decay
		data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
	}
	noise.buffer = buffer;

	const filter = ctx.createBiquadFilter();
	filter.type = "highpass";
	filter.frequency.value = 1200;

	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.06, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

	noise.connect(filter);
	filter.connect(gain);
	gain.connect(ctx.destination);

	noise.start(now);
	noise.stop(now + 0.05);
}

onMount(() => {
	measure();
	const ro = new ResizeObserver(() => measure());
	if (container) ro.observe(container);
	return () => ro.disconnect();
});

onDestroy(() => {
	cancelRaf();
});

export function roll() {
	if (isSpinning) return;
	const totalSides = clampSides(sides);
	measure();
	if (itemWidth === 0) return;

	// Choose final result
	finalValue = randomInt(1, totalSides);

	// Define positions on an infinitely repeated ring
	const startLoop = Math.floor(REPEATS / 2) * totalSides;
	const startIndex = startLoop + randomInt(0, totalSides - 1);
	const extraLoops = 2 + Math.floor(Math.random() * 2); // 2-3 loops
	const desiredIndexMod = (finalValue - 1 + totalSides) % totalSides;
	const delta =
		(((desiredIndexMod - (startIndex % totalSides)) % totalSides) +
			totalSides) %
		totalSides;
	const targetIndex = startIndex + extraLoops * totalSides + delta;

	startPos = startIndex;
	endPos = targetIndex;
	currentPos = startPos;
	lastTickIndex = Math.floor(currentPos);

	durationMs = 2400 + Math.random() * 900; // 2.4 - 3.3s
	startTime = performance.now();
	isSpinning = true;

	cancelRaf();
	rafId = requestAnimationFrame(step);
}

function step(now) {
	const elapsed = now - startTime;
	const t = Math.min(1, elapsed / durationMs);
	const eased = easeOutCubic(t);
	currentPos = startPos + (endPos - startPos) * eased;

	// Tick when crossing integer boundaries
	const ci = Math.floor(currentPos);
	if (ci !== lastTickIndex) {
		lastTickIndex = ci;
		playTick();
	}

	if (t < 1) {
		rafId = requestAnimationFrame(step);
		return;
	}

	// Settle to exact final state and show only final, centered
	currentPos = endPos;
	isSpinning = false;
	onRollComplete(finalValue);
}
</script>

<!-- Container -->
<div bind:this={container} class="w-full h-full flex items-center justify-center overflow-hidden select-none">
	{#if isSpinning}
		<!-- Scrolling track while spinning -->
		<div class="relative w-full" style="height: clamp(6rem, 35vh, 24rem);">
			<div class="absolute inset-0 flex items-center">
				<div
					class="flex items-center"
					style="transform: translateX(-{currentPos * itemWidth - centerOffsetPx}px); transition: transform 0.02s linear; will-change: transform;"
				>
					{#each Array(REPEATS * clampSides(sides)) as _, idx}
						<div class="shrink-0 flex items-center justify-center" style="width: {itemWidth}px;">
							<div style="font-size: clamp(5rem, 26vw, 20rem); line-height: 1;">
								{(idx % clampSides(sides)) + 1}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<!-- Final centered value (cannot disappear) -->
		<div class="w-full" style="height: clamp(6rem, 35vh, 24rem); display: flex; align-items: center; justify-content: center;">
			<div style="font-size: clamp(5rem, 26vw, 20rem); line-height: 1;">
				{finalValue ?? 1}
			</div>
		</div>
	{/if}
</div>


