import PropTypes from 'prop-types';

export default function CustomDiceInput({ value, onInput, onRoll, disabled }) {
  return (
    <form
      className="pointer-events-auto glass rounded-2xl p-2 animate-fadeIn"
      onSubmit={(event) => {
        event.preventDefault();
        onRoll();
      }}
    >
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="1"
          max="1000000"
          value={value}
          onInput={onInput}
          placeholder="Sides"
          className="w-32 sm:w-40 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-center text-lg font-semibold text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20 transition-all"
        />
        <button
          type="submit"
          disabled={disabled || !value}
          className="dice-button dice-button-active"
          style={{ '--glow': '#fcd34d' }}
        >
          Roll
        </button>
      </div>
    </form>
  );
}

CustomDiceInput.propTypes = {
  value: PropTypes.string.isRequired,
  onInput: PropTypes.func.isRequired,
  onRoll: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
