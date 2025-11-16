<script>
import { onDestroy, onMount } from "svelte";

const { sides = 20, onRollComplete = () => {} } = $props();
const REPEATS = 5;

let isSpinning = $state(false);
let finalValue = $state(null);
let _activeSides = $state(20); // Track sides value during current roll
let container;
let viewportWidth = $state(0);
let itemWidth = $state(0);
let _centerOffsetPx = $state(0);
let rafId = null;
let startTime = 0;
let durationMs = 0;
let startPos = 0;
let endPos = 0;
let currentPos = $state(0);
let lastTickIndex = -1;
let audioCtx = null;

const clampSides = (n) => Math.max(2, Math.floor(n || 2));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const randomInt = (min, max) =>
	Math.floor(Math.random() * (max - min + 1)) + min;

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
	itemWidth = viewportWidth;
	_centerOffsetPx = (viewportWidth - itemWidth) / 2;
}

function ensureAudio() {
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

	const noise = ctx.createBufferSource();
	const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
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

onDestroy(() => cancelRaf());

export function roll() {
	if (isSpinning) return;
	const totalSides = clampSides(sides);
	_activeSides = totalSides; // Lock in the sides value for this roll
	measure();
	if (itemWidth === 0) return;

	finalValue = randomInt(1, totalSides);

	const startLoop = Math.floor(REPEATS / 2) * totalSides;
	const startIndex = startLoop + randomInt(0, totalSides - 1);
	const extraLoops = 2 + Math.floor(Math.random() * 2);
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
	durationMs = 2400 + Math.random() * 900;
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

	const ci = Math.floor(currentPos);
	if (ci !== lastTickIndex) {
		lastTickIndex = ci;
		playTick();
	}

	if (t < 1) {
		rafId = requestAnimationFrame(step);
		return;
	}

	// Snap to exact final position
	currentPos = Math.round(endPos);
	isSpinning = false;
	onRollComplete(finalValue);
}
</script>

<div bind:this={container} class="w-full h-full flex items-center justify-center overflow-hidden select-none">
	{#if isSpinning}
		<div class="relative w-full" style="height: clamp(6rem, 35vh, 24rem);">
			<div class="absolute inset-0 flex items-center">
				<div class="flex items-center" style="transform: translateX(-{currentPos * itemWidth - _centerOffsetPx}px); will-change: transform;">
					{#each Array(REPEATS * _activeSides) as _, idx}
						<div class="shrink-0 flex items-center justify-center" style="width: {itemWidth}px;">
							<div style="font-size: clamp(5rem, 26vw, 20rem); line-height: 1;">
								{(idx % _activeSides) + 1}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<div class="w-full" style="height: clamp(6rem, 35vh, 24rem); display: flex; align-items: center; justify-content: center;">
			<div style="font-size: clamp(5rem, 26vw, 20rem); line-height: 1;">
				{finalValue ?? 1}
			</div>
		</div>
	{/if}
</div>


