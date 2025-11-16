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
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const randomInt = (min, max) =>
	Math.floor(Math.random() * (max - min + 1)) + min;

const LinearSpinner = forwardRef(
	({ sides = 20, onRollComplete = () => {} }, ref) => {
		const [isSpinning, setIsSpinning] = useState(false);
		const [finalValue, setFinalValue] = useState(null);
		const [translateX, setTranslateX] = useState(0);
		const [numberList, setNumberList] = useState([]);
		const [_lockedSides, setLockedSides] = useState(20);

		const containerRef = useRef(null);
		const rafIdRef = useRef(null);
		const startTimeRef = useRef(0);
		const durationMsRef = useRef(0);
		const startTranslateRef = useRef(0);
		const endTranslateRef = useRef(0);
		const lastTickIndexRef = useRef(-1);
		const audioCtxRef = useRef(null);

		const cancelRaf = useCallback(() => {
			if (rafIdRef.current != null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		}, []);

		const ensureAudio = () => {
			if (!audioCtxRef.current) {
				try {
					audioCtxRef.current = new (
						window.AudioContext || window.webkitAudioContext
					)();
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
		};

		const step = (now) => {
			const elapsed = now - startTimeRef.current;
			const t = Math.min(1, elapsed / durationMsRef.current);
			const eased = easeOutCubic(t);
			const newTranslateX =
				startTranslateRef.current +
				(endTranslateRef.current - startTranslateRef.current) * eased;
			setTranslateX(newTranslateX);

			// Play tick sound as we pass each number
			const currentIndex = Math.floor(newTranslateX / 200);
			if (
				currentIndex !== lastTickIndexRef.current &&
				currentIndex < numberList.length
			) {
				lastTickIndexRef.current = currentIndex;
				playTick();
			}

			if (t < 1) {
				rafIdRef.current = requestAnimationFrame(step);
				return;
			}

			// Animation complete
			setTranslateX(endTranslateRef.current);
			setIsSpinning(false);
			onRollComplete(finalValue);
		};

		const roll = () => {
			if (isSpinning) return;

			const totalSides = clampSides(sides);
			setLockedSides(totalSides);
			const newFinalValue = randomInt(1, totalSides);
			setFinalValue(newFinalValue);

			// Create a list of numbers to spin through
			// We want enough numbers to create a smooth, exciting spin
			const totalNumbers = Math.max(30, totalSides * 3);
			const numbers = [];

			// Fill with repeating patterns
			for (let i = 0; i < totalNumbers; i++) {
				numbers.push((i % totalSides) + 1);
			}

			// Make sure the last number is our final value
			numbers.push(newFinalValue);

			setNumberList(numbers);

			// Animation parameters
			// Item width is 200px (defined in the template)
			const itemWidth = 200;

			// Start from the first few numbers visible
			startTranslateRef.current = 0;

			// End at the final number, centered
			// We want to move so that the last item (our result) is centered
			endTranslateRef.current = (numbers.length - 1) * itemWidth;

			setTranslateX(startTranslateRef.current);
			lastTickIndexRef.current = 0;
			durationMsRef.current = 2500 + Math.random() * 1000;
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
						{/* Center line indicator (optional visual guide) */}
						<div
							className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-blue-500 to-transparent opacity-30 pointer-events-none"
							style={{ transform: "translateX(-50%)" }}
						/>

						<div className="absolute inset-0 flex items-center justify-start">
							<div
								className="flex items-center gap-0"
								style={{
									transform: `translateX(calc(50% - ${translateX}px))`,
									willChange: "transform",
								}}
							>
								{numberList.map((num, idx) => (
									<div
										key={`${idx}-${num}`}
										className="flex items-center justify-center shrink-0"
										style={{
											width: "200px",
											fontSize: "clamp(4rem, 20vw, 16rem)",
											lineHeight: 1,
											fontWeight: 700,
											color: "#1e293b",
										}}
									>
										{num}
									</div>
								))}
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
