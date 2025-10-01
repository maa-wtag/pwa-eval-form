// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const rootEl = document.getElementById("root") as HTMLElement;
ReactDOM.createRoot(rootEl).render(<App />);

// Register SW only in prod or when explicitly enabled in dev
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  (async () => {
    const enableDevSW = import.meta.env.VITE_ENABLE_DEV_SW === "true";
    if (import.meta.env.PROD || enableDevSW) {
      const { registerSW } = await import("virtual:pwa-register");
      let updateSW: () => void = () => {};
      registerSW({
        immediate: true,
        onNeedRefresh() {
          if (confirm("A new version is available. Update now?")) updateSW();
        },
        onRegistered(r) {
          updateSW = () => r?.update();
        },
      });
    }
  })();
}
