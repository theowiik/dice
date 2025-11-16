import PropTypes from 'prop-types';

export default function CustomDiceInput({ value, onInput, onRoll, disabled }) {
  return (
    <div className="w-full bg-stone-800 rounded-xl shadow-lg p-6 border border-stone-700 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          type="number"
          min="1"
          max="1000000"
          value={value}
          onInput={onInput}
          placeholder="Sides"
          className="flex-1 px-4 py-3 bg-stone-700 border-2 border-stone-600 rounded-lg text-center text-lg font-semibold text-stone-100 placeholder-stone-400 focus:outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-500/30 transition-all"
        />
        <button
          type="button"
          onClick={onRoll}
          disabled={disabled || !value}
          className="px-6 py-3 bg-gradient-to-br from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700 text-white rounded-lg font-bold text-lg shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Roll
        </button>
      </div>
    </div>
  );
}

CustomDiceInput.propTypes = {
  value: PropTypes.string.isRequired,
  onInput: PropTypes.func.isRequired,
  onRoll: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
