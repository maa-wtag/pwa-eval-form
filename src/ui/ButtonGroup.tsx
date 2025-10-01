import React from "react";
import type { Assessment } from "../types";

export const ButtonGroup: React.FC<{
  value: Assessment;
  onChange: (v: Assessment) => void;
}> = ({ value, onChange }) => {
  const items: Array<[Assessment, string, string]> = [
    ["PASS", "✔", "Pass"],
    ["NEUTRAL", "–", "Neutral"],
    ["FAIL", "✕", "Fail"],
  ];
  return (
    <div className="btn-group">
      {items.map(([val, icon, label]) => (
        <button
          key={val ?? "null"}
          className={"btn-pill" + (value === val ? " active" : "")}
          onClick={() => onChange(val)}
          type="button"
        >
          <span style={{ marginRight: 6 }}>{icon}</span> {label}
        </button>
      ))}
    </div>
  );
};
