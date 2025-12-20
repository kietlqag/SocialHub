import type { HTMLAttributes } from "react";
import "../styles/toggle-switch.css";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function ToggleSwitch({ checked, onChange, disabled, id, ...aria }: ToggleSwitchProps & Pick<HTMLAttributes<HTMLButtonElement>, "aria-label">) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "toggle",
        checked ? "toggle--on" : "toggle--off",
        disabled ? "toggle--disabled" : "",
      ].join(" ")}
      {...aria}
    >
      <span className="toggle__thumb" />
    </button>
  );
}
