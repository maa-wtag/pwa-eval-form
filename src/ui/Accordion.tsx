import React, { useState } from "react";

export const Accordion: React.FC<{
  title: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, right, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div
        className="row"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: "pointer" }}
      >
        <div className="accordion-title">{title}</div>
        <div className="small">
          {right} <span style={{ marginLeft: 8 }}>{open ? "▴" : "▾"}</span>
        </div>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
};
