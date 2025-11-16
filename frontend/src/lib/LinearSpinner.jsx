import PropTypes from "prop-types";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";

const clampSides = (n) => Math.max(2, Math.floor(n || 2));
const easeOutQuart = (t) => 1 - (1 - t) ** 4;
const randomInt = (min, max) =>
	Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * @typedef {Object} LinearSpinnerProps
 * @property {number} [sides=20] - Number of sides on the dice
 * @property {(result: number) => void} [onRollComplete] - Callback when roll completes
 */

/**
 * @type {import('react').ForwardRefRenderFunction<{roll: () => void}, LinearSpinnerProps>}
 */
const LinearSpinner = forwardRef(
	({ sides = 20, onRollComplete = () => {} }, ref) => {
		const [isSpinning, setIsSpinning] = useState(false);
		const [finalValue, setFinalValue] = useState(null);
		const [displayNumbers, setDisplayNumbers] = useState([]);

		const containerRef = useRef(null);
		const rafIdRef = useRef(null);
		const startTimeRef = useRef(0);
		const durationMsRef = useRef(0);
		const fullSequenceRef = useRef([]);
		const currentScrollRef = useRef(0);
		const targetScrollRef = useRef(0);
		const lastTickIndexRef = useRef(-1);
		const audioCtxRef = useRef(null);
		const itemWidthRef = useRef(200);

		const cancelRaf = useCallback(() => {
			if (rafIdRef.current != null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		}, []);

		const ensureAudio = () => {
			if (!audioCtxRef.current) {
				try {
					const AudioContextClass =
						window.AudioContext ||
						// @ts-ignore - webkitAudioContext for Safari support
						window.webkitAudioContext;
					audioCtxRef.current = new AudioContextClass();
				} catch {
					audioCtxRef.current = null;
				}
			}
			return audioCtxRef.current;
		};

		const playTick = () => {
			const ctx = ensureAudio();
			if (!ctx) return;
			const now = ctx.currentTime;

			const noise = ctx.createBufferSource();
			const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.025, ctx.sampleRate);
			const data = buffer.getChannelData(0);
			for (let i = 0; i < data.length; i++) {
				data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
			}
			noise.buffer = buffer;

			const filter = ctx.createBiquadFilter();
			filter.type = "highpass";
			filter.frequency.value = 1400;

			const gain = ctx.createGain();
			gain.gain.setValueAtTime(0.05, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

			noise.connect(filter);
			filter.connect(gain);
			gain.connect(ctx.destination);

			noise.start(now);
			noise.stop(now + 0.04);
		};

		// Generate a smart sequence that shows varied numbers and ends at target
		const generateSpinSequence = (totalSides, targetNumber) => {
			// Adaptive sequence length based on dice size
			// For small dice: show more numbers to make it exciting
			// For large dice: show fewer to keep it performant
			let sequenceLength;
			if (totalSides <= 20) {
				sequenceLength = 40;
			} else if (totalSides <= 100) {
				sequenceLength = 50;
			} else if (totalSides <= 1000) {
				sequenceLength = 60;
			} else {
				sequenceLength = 70;
			}

			const sequence = [];

			// Phase 1: Initial fast numbers (first 30%)
			const phase1Count = Math.floor(sequenceLength * 0.3);
			for (let i = 0; i < phase1Count; i++) {
				sequence.push(randomInt(1, totalSides));
			}

			// Phase 2: Slowing down, showing numbers closer to target (next 40%)
			const phase2Count = Math.floor(sequenceLength * 0.4);
			const range = Math.max(10, Math.floor(totalSides * 0.2));
			for (let i = 0; i < phase2Count; i++) {
				// Generate numbers in a range around the target
				const min = Math.max(1, targetNumber - range);
				const max = Math.min(totalSides, targetNumber + range);
				sequence.push(randomInt(min, max));
			}

			// Phase 3: Final approach - numbers very close to target (next 20%)
			const phase3Count = Math.floor(sequenceLength * 0.2);
			const narrowRange = Math.max(3, Math.floor(totalSides * 0.05));
			for (let i = 0; i < phase3Count; i++) {
				const min = Math.max(1, targetNumber - narrowRange);
				const max = Math.min(totalSides, targetNumber + narrowRange);
				sequence.push(randomInt(min, max));
			}

			// Phase 4: Final number (the actual result)
			sequence.push(targetNumber);

			return sequence;
		};

		// Update visible numbers based on scroll position
		const updateVisibleNumbers = useCallback((scrollPosition) => {
			const sequence = fullSequenceRef.current;
			if (sequence.length === 0) return;

			const itemWidth = itemWidthRef.current;
			const centerIndex = scrollPosition / itemWidth;

			// Show a window of numbers around the current position
			// This keeps DOM size manageable even for long sequences
			const windowSize = 15; // Show 15 numbers at a time
			const startIdx = Math.max(
				0,
				Math.floor(centerIndex) - Math.floor(windowSize / 2),
			);
			const endIdx = Math.min(
				sequence.length,
				startIdx + windowSize,
			);

			const visibleNums = [];
			for (let i = startIdx; i < endIdx; i++) {
				visibleNums.push({
					value: sequence[i],
					index: i,
					position: i * itemWidth,
				});
			}

			setDisplayNumbers(visibleNums);
		}, []);

		const step = (now) => {
			const elapsed = now - startTimeRef.current;
			const t = Math.min(1, elapsed / durationMsRef.current);
			const eased = easeOutQuart(t);

			const currentScroll = currentScrollRef.current +
				(targetScrollRef.current - currentScrollRef.current) * eased;

			// Update visible numbers window
			updateVisibleNumbers(currentScroll);

			// Play tick sound as we pass each number
			const itemWidth = itemWidthRef.current;
			const currentIndex = Math.floor(currentScroll / itemWidth);
			if (
				currentIndex !== lastTickIndexRef.current &&
				currentIndex < fullSequenceRef.current.length
			) {
				lastTickIndexRef.current = currentIndex;
				playTick();
			}

			if (t < 1) {
				rafIdRef.current = requestAnimationFrame(step);
				return;
			}

			// Animation complete
			setIsSpinning(false);
			onRollComplete(finalValue);
		};

		const roll = () => {
			if (isSpinning) return;

			const totalSides = clampSides(sides);
			const newFinalValue = randomInt(1, totalSides);
			setFinalValue(newFinalValue);

			// Generate the spin sequence
			const sequence = generateSpinSequence(totalSides, newFinalValue);
			fullSequenceRef.current = sequence;

			// Calculate scroll positions
			const itemWidth = itemWidthRef.current;
			currentScrollRef.current = 0;
			// Target is the final number's position
			targetScrollRef.current = (sequence.length - 1) * itemWidth;

			// Initialize visible numbers
			updateVisibleNumbers(0);

			// Animation parameters
			lastTickIndexRef.current = -1;
			durationMsRef.current = 2000 + Math.random() * 800;
			startTimeRef.current = performance.now();
			setIsSpinning(true);

			cancelRaf();
			rafIdRef.current = requestAnimationFrame(step);
		};

		// Expose roll method via ref
		useImperativeHandle(ref, () => ({
			roll,
		}));

		// Cleanup on unmount
		useEffect(() => {
			return () => cancelRaf();
		}, [cancelRaf]);

		return (
			<div
				ref={containerRef}
				className="w-full h-full flex items-center justify-center overflow-hidden select-none"
			>
				{isSpinning ? (
					<div
						className="relative w-full overflow-hidden"
						style={{ height: "clamp(6rem, 35vh, 24rem)" }}
					>
						{/* Center line indicator */}
						<div
							className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-blue-500 to-transparent opacity-30 pointer-events-none z-10"
							style={{ transform: "translateX(-50%)" }}
						/>

						{/* Gradient fade on edges */}
						<div
							className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none z-10"
						/>
						<div
							className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none z-10"
						/>

						<div className="absolute inset-0 flex items-center">
							<div className="relative w-full h-full flex items-center">
								{displayNumbers.map((item) => {
									// Calculate this item's position relative to current scroll
									const currentScroll = currentScrollRef.current;
									const targetScroll = targetScrollRef.current;
									const sequence = fullSequenceRef.current;
									const t = Math.min(
										1,
										(performance.now() - startTimeRef.current) /
											durationMsRef.current,
									);
									const eased = easeOutQuart(t);
									const interpolatedScroll =
										currentScroll + (targetScroll - currentScroll) * eased;

									// Position this number
									const offset = item.position - interpolatedScroll;

									// Calculate opacity based on distance from center
									const distanceFromCenter = Math.abs(offset);
									const maxDistance = 400;
									const opacity = Math.max(
										0.2,
										1 - distanceFromCenter / maxDistance,
									);

									// Calculate scale for perspective effect
									const scale = Math.max(
										0.6,
										1 - Math.abs(distanceFromCenter) / 800,
									);

									return (
										<div
											key={`${item.index}-${item.value}`}
											className="absolute flex items-center justify-center"
											style={{
												left: "50%",
												transform: `translateX(calc(-50% + ${offset}px)) scale(${scale})`,
												width: `${itemWidthRef.current}px`,
												fontSize: "clamp(4rem, 20vw, 16rem)",
												lineHeight: 1,
												fontWeight: 700,
												color: "#1e293b",
												opacity: opacity,
												transition:
													t >= 1 ? "transform 0.3s ease-out" : "none",
											}}
										>
											{item.value}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				) : (
					<div
						className="w-full"
						style={{
							height: "clamp(6rem, 35vh, 24rem)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<div
							style={{
								fontSize: "clamp(5rem, 26vw, 20rem)",
								lineHeight: 1,
								fontWeight: 700,
								color: "#1e293b",
							}}
						>
							{finalValue ?? "?"}
						</div>
					</div>
				)}
			</div>
		);
	},
);

LinearSpinner.displayName = "LinearSpinner";

LinearSpinner.propTypes = {
	sides: PropTypes.number,
	onRollComplete: PropTypes.func,
};

export default LinearSpinner;
