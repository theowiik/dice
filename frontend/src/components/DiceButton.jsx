import PropTypes from 'prop-types';

export default function DiceButton({ label, onClick, disabled, colorClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative px-6 py-4 bg-gradient-to-br ${colorClass} text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`}
    >
      <span className="relative z-10">{label}</span>
      <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
    </button>
  );
}

DiceButton.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  colorClass: PropTypes.string.isRequired,
};
