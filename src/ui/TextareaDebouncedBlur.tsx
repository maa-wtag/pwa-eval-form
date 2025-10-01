import React, { useEffect, useRef, useState } from "react";

export const TextareaDebouncedBlur: React.FC<{
  defaultValue?: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}> = ({ defaultValue = "", placeholder, onCommit }) => {
  const [val, setVal] = useState(defaultValue);
  const lastCommitted = useRef(defaultValue);
  const dirtyRef = useRef(false);
  const focusedRef = useRef(false);

  // Keep internal value in sync with prop when we are NOT editing
  useEffect(() => {
    if (!focusedRef.current) {
      setVal(defaultValue);
      lastCommitted.current = defaultValue;
      dirtyRef.current = false;
    }
  }, [defaultValue]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setVal(e.target.value);
    dirtyRef.current = true;
  }

  function handleBlur() {
    focusedRef.current = false;
    // Commit only if user actually changed something since last commit
    if (dirtyRef.current && val !== lastCommitted.current) {
      lastCommitted.current = val;
      dirtyRef.current = false;
      onCommit(val);
    }
  }

  function handleFocus() {
    focusedRef.current = true;
  }

  return (
    <textarea
      className="textarea input"
      value={val}
      placeholder={placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );
};
