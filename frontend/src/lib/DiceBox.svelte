<script>
import DiceBox from "@3d-dice/dice-box";
import { onDestroy, onMount, tick } from "svelte";

const { sides = 20, onRollComplete = () => {} } = $props();
let container;
let box;
let initialized = false;

async function ensureInitialized() {
	await tick();
	if (initialized) return;
	if (!container) return;
	// Guarantee container sizing for the WebGL canvas
	if (container.clientWidth === 0 || container.clientHeight === 0) {
		container.style.width = "100%";
		container.style.height = "384px";
	}
	box = new DiceBox(container, {
		// visual tuning
		scale: 6,
		gravity: 9.8,
		ambientLight: 0.9,
		shadowTransparency: 0.2,
		enableShadows: true,
		// assetPath can be omitted for modern bundlers; left undefined intentionally
		assetPath: undefined,
		theme: {
			texture: "plain",
			material: {
				color: "#eae7ff",
				emissive: "#2a1f4a",
				metalness: 0.2,
				roughness: 0.6,
			},
			labels: { color: "#321e60" },
		},
	});
	await box.init();
	initialized = true;
}

onMount(() => {
	ensureInitialized();
});

onDestroy(() => {
	try {
		box?.destroy?.();
	} catch {}
});

export async function roll() {
	await ensureInitialized();
	const notation = `1d${Math.max(2, sides)}`;
	const result = await box.roll(notation, {
		drawResults: true,
	});
	// dice-box may return different shapes across versions. Normalize:
	let total;
	if (result?.resultTotal != null) {
		total = result.resultTotal;
	} else if (Array.isArray(result?.results) && result.results.length > 0) {
		total = result.results.reduce((sum, d) => sum + (d.value ?? 0), 0);
	} else if (Array.isArray(result) && result.length > 0) {
		total = result.reduce((sum, d) => sum + (d.value ?? 0), 0);
	}
	if (typeof total !== "number" || Number.isNaN(total)) {
		// fallback: generate a fair random if the lib didn't produce a value
		total = Math.floor(Math.random() * Math.max(2, sides)) + 1;
	}
	onRollComplete(total);
	return total;
}
</script>

<div bind:this={container} class="w-full h-full min-h-[384px]"></div>
