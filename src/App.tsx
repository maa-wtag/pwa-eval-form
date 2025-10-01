import React, { useEffect, useMemo, useState } from "react";
import "./assets/styles.css";
import type { FormModel, ElementModel } from "./types";
import { fetchForm, submitForm, deleteForm } from "./api";
import { SyncPanel, SyncProvider } from "./sync/SyncStatus";
import { saveToken, getToken } from "./db";
import { Accordion } from "./ui/Accordion";
import { ElementPanel } from "./ui/ElementPanel";

export default function App() {
  return (
    <SyncProvider>
      <Shell />
    </SyncProvider>
  );
}

const Shell: React.FC = () => {
  const [form, setForm] = useState<FormModel | null>(null);
  const [active, setActive] = useState<ElementModel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    fetchForm().then((f) => {
      setForm(f);
      setActive(f.sections[0].elements[0]);
    });
    getToken().then(setToken);

    const bc = new BroadcastChannel("form-updates");
    bc.onmessage = (evt) => {
      if (evt?.data?.type === "FORM_UPDATED" && evt.data.form) {
        const updated: FormModel = evt.data.form;
        setForm(updated);
        // keep the same active element selected, if possible
        if (active) {
          const next = updated.sections
            .flatMap((s) => s.elements)
            .find((e) => e.id === active.id);
          if (next) setActive(next);
        }
      }
    };
    return () => bc.close();
  }, []);

  const elementsCount = (secId: string) =>
    form?.sections.find((s) => s.id === secId)?.elements.length ?? 0;

  async function login() {
    const next = token ? null : "demo"; // demo token acknowledged by server
    await saveToken(next);
    setToken(next);
    // Let SW know (so it can add Authorization on replays)
    new BroadcastChannel("sync-updates").postMessage({
      type: "LOGIN_STATE",
      payload: { loggedIn: !!next },
    });
  }

  if (!form) return null;

  return (
    <>
      <header>
        <div
          style={{
            width: 12,
            height: 12,
            background: "#16a34a",
            borderRadius: 999,
          }}
        />
        <div>Online</div>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn-pill" onClick={login}>
            {token ? "Logout" : "Login"}
          </button>
        </div>
      </header>

      <div className="container">
        <div className="h1">Evaluation form</div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 440px", gap: 16 }}
        >
          <div>
            <Accordion
              title={
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="badge">1</div>{" "}
                  <div>Section 1: Basic Information</div>
                </div>
              }
              right={<span>{elementsCount("S1")} evaluation elements</span>}
            >
              {form.sections[0].elements.map((el) => (
                <div
                  className="row"
                  key={el.id}
                  onClick={() => setActive(el)}
                  style={{ cursor: "pointer" }}
                >
                  <div>Element {el.id.replace("E", "").replace("-", ".")}</div>
                  <div>›</div>
                </div>
              ))}
            </Accordion>

            <Accordion
              title={
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="badge">2</div>{" "}
                  <div>Section 2: Detailed Assessment</div>
                </div>
              }
              right={<span>{elementsCount("S2")} evaluation elements</span>}
            >
              {form.sections[1].elements.map((el) => (
                <div
                  className="row"
                  key={el.id}
                  onClick={() => setActive(el)}
                  style={{ cursor: "pointer" }}
                >
                  <div>Element {el.id.replace("E", "").replace("-", ".")}</div>
                  <div>›</div>
                </div>
              ))}
            </Accordion>

            <button
              className="button"
              onClick={() => submitForm(form.id)}
              style={{ width: "100%", marginTop: 16 }}
            >
              Post a review
            </button>

            <button
              className="btn-pill"
              style={{ marginTop: 10 }}
              onClick={() => deleteForm(form.id)}
              type="button"
            >
              Delete whole form
            </button>

            <SyncPanel />
          </div>

          {active && <ElementPanel element={active} />}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
};
