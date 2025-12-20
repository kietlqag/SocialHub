import React from "react";
import "./toggle-switch.css";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
}) => {
  const handleClick = () => {
    if (disabled) return;
    onChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={handleClick}
      className={`toggle ${checked ? "toggle--on" : "toggle--off"} ${
        disabled ? "toggle--disabled" : ""
      }`}
    >
      <span className="toggle__thumb" />
    </button>
  );
};

export default ToggleSwitch;
