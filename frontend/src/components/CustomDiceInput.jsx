import PropTypes from 'prop-types';

export default function CustomDiceInput({ value, onInput, onRoll, disabled }) {
  return (
    <div className="bg-stone-800 rounded-xl shadow-lg p-5 border border-stone-700 animate-fadeIn">
      <div className="flex items-center gap-4">
        <input
          type="number"
          min="1"
          max="1000000"
          value={value}
          onInput={onInput}
          placeholder="Enter sides..."
          className="flex-1 px-6 py-4 bg-stone-700 border-2 border-stone-600 rounded-xl text-center text-xl font-semibold text-stone-100 placeholder-stone-400 focus:outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-500/30 transition-all"
        />
        <button
          type="button"
          onClick={onRoll}
          disabled={disabled || !value}
          className="px-8 py-4 bg-gradient-to-br from-stone-700 to-stone-800 hover:from-stone-600 hover:to-stone-700 text-white rounded-xl font-bold text-xl shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap"
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
