import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SyncStats = {
  online: boolean;
  loggedIn: boolean;
  queueLength: number;
  syncing: boolean;
  replayed: number;
  failedPermanently: number;
};

const SyncCtx = createContext<SyncStats>({
  online: navigator.onLine,
  loggedIn: false,
  queueLength: 0,
  syncing: false,
  replayed: 0,
  failedPermanently: 0,
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<SyncStats>((s) => ({
    ...s,
    online: navigator.onLine,
  }));

  useEffect(() => {
    const bc = new BroadcastChannel("sync-updates");
    bc.onmessage = (evt) => {
      if (evt?.data?.type === "SYNC_STATUS") {
        setState((prev) => ({ ...prev, ...evt.data.payload }));
      }
      if (evt?.data?.type === "LOGIN_STATE") {
        setState((prev) => ({
          ...prev,
          loggedIn: !!evt.data.payload?.loggedIn,
        }));
      }
    };

    const goOnline = () => setState((s) => ({ ...s, online: true }));
    const goOffline = () => setState((s) => ({ ...s, online: false }));
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      bc.close();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return <SyncCtx.Provider value={state}>{children}</SyncCtx.Provider>;
};

export const useSyncStatus = () => useContext(SyncCtx);

export const SyncPanel: React.FC = () => {
  const s = useSyncStatus();
  return (
    <div className="card panel" style={{ marginTop: 16 }}>
      <div className="syncbar">
        <span className="tag">{s.online ? "Online" : "Offline"}</span>
        <span className="tag">{s.loggedIn ? "Logged in" : "Logged out"}</span>
        <span className="tag">Queue: {s.queueLength}</span>
        <span className="tag">{s.syncing ? "Syncing…" : "Idle"}</span>
        <span className="tag">Replayed: {s.replayed}</span>
        <span className="tag">Failed✖: {s.failedPermanently}</span>
      </div>
    </div>
  );
};
