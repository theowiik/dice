import PropTypes from 'prop-types';

export default function DiceButton({ label, onClick, disabled, active, glow }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ '--glow': glow }}
      className={`dice-button ${active ? 'dice-button-active' : ''}`}
    >
      {label}
    </button>
  );
}

DiceButton.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  active: PropTypes.bool,
  glow: PropTypes.string,
};
