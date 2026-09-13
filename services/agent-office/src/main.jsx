import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Bot, ChevronDown, ExternalLink, LockKeyhole, Play, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const AGENTS = [
  ["orchestrator-agent", "Orchestrator", "O"],
  ["research-agent", "Research", "R"],
  ["code-agent", "Code", "C"],
  ["review-agent", "Review", "V"],
  ["deploy-agent", "Deploy", "D"],
];
const STATE_LABEL = {
  idle: "Sin eventos", queued: "En cola", working: "Trabajando", waiting_for_tool: "Esperando una herramienta",
  waiting_for_approval: "Esperando aprobación", reviewing: "Revisando", meeting: "En reunión", error: "Error", paused: "Pausado",
};

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "X-Requested-With": "AgentOffice", "Content-Type": "application/json", ...options.headers } });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación.");
  return payload;
}

function statusFor(agent, snapshot) {
  return snapshot.agents.find((entry) => entry.agent_id === agent)?.state || "idle";
}

function App() {
  const [snapshot, setSnapshot] = useState({ agents: [], events: [], runs: [] });
  const [me, setMe] = useState(null);
  const [selected, setSelected] = useState("research-agent");
  const [prompt, setPrompt] = useState("");
  const [agent, setAgent] = useState("research-agent");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      const [identity, latest] = await Promise.all([request("/api/me"), request("/api/snapshot")]);
      setMe(identity); setSnapshot(latest); setMessage("");
    } catch (error) {
      if (error.message === "AUTH_REQUIRED") setMe(null); else setMessage(error.message);
    }
  };
  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id); }, []);
  const selectedState = statusFor(selected, snapshot);
  const selectedEvent = snapshot.events.find((item) => item.agent_id === selected);
  const selectedRun = snapshot.runs.find((item) => item.agent_id === selected && ["queued", "working", "waiting_for_approval"].includes(item.status));
  const visibleEvents = useMemo(() => snapshot.events.slice(0, 10), [snapshot.events]);

  async function createRun(event) {
    event.preventDefault(); if (!prompt.trim()) return;
    setBusy(true); setMessage("");
    try {
      const run = await request("/api/runs", { method: "POST", body: JSON.stringify({ prompt, agent_id: agent }) });
      setPrompt(""); setMessage(`Tarea ${run.run_id.slice(0, 8)} encolada.`); await refresh();
    } catch (error) { setMessage(error.message === "AUTH_REQUIRED" ? "Inicia sesión antes de ejecutar una tarea." : error.message); }
    finally { setBusy(false); }
  }
  async function approve(runId, decision) {
    setBusy(true); try { const result = await request(`/api/runs/${runId}/approval`, { method: "POST", body: JSON.stringify({ decision }) }); setMessage(result.message); await refresh(); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="/"><span className="brand-mark"><Bot size={22} /></span><span><strong>Agent Office</strong><small>Cloudpiles multi-agent operations platform</small></span></a>
      <div className="top-controls"><label>Proyecto<select defaultValue="multi-agent"><option value="multi-agent">Multi Agent</option></select></label><label>Entorno<select defaultValue="production"><option value="production">Producción</option></select></label>{me ? <button className="plain-button" onClick={async () => { const r = await request("/auth/logout", { method: "POST", body: "{}" }); location.assign(r.url); }}>Salir</button> : <a className="login" href="/auth/login">Entrar con Microsoft</a>}</div>
    </header>
    <section className="workspace">
      <div className="office-column">
        <section className="office panel"><div className="section-head"><div><h1>La oficina</h1><p>Un equipo de agentes para convertir ideas en resultados.</p></div><span className="live-dot">{me ? "Conectado" : "Acceso requerido"}</span></div>
          <div className="floor"><div className="wall wall-top"/><div className="wall wall-left"/><div className="wall wall-bottom"/>
            <div className="desks">{AGENTS.map(([id, name, letter]) => <button key={id} className={`desk ${selected === id ? "selected" : ""}`} onClick={() => setSelected(id)}><span className={`avatar ${statusFor(id, snapshot)}`}>{letter}</span><strong>{name}</strong><small>{STATE_LABEL[statusFor(id, snapshot)]}</small></button>)}</div>
            <div className="meeting"><Users size={28}/><strong>Sala de reuniones</strong><span>{snapshot.runs.filter((run) => run.mode === "meeting" && run.status === "working").length ? "En curso" : "Disponible"}</span></div>
          </div>
        </section>
        <section className="activity panel"><div className="section-head"><div><h2>Actividad reciente</h2></div><span className="filter">Todos los agentes <ChevronDown size={16}/></span></div>{me && visibleEvents.length ? <ol className="event-list">{visibleEvents.map((item) => <li key={item.event_id}><span className={`event-dot ${item.state || "idle"}`}/><div><strong>{item.agent_id === "platform" ? "Plataforma" : AGENTS.find(([id]) => id === item.agent_id)?.[1] || item.agent_id}</strong><p>{item.type}</p></div><time>{new Date(item.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol> : <div className="empty"><LockKeyhole size={28}/><h3>{me ? "Aún no hay actividad" : "Inicia sesión para ver la actividad"}</h3><p>Los eventos aparecerán aquí cuando comience la actividad.</p></div>}</section>
      </div>
      <aside className="side-column">
        <section className="panel detail"><h2>Detalle del agente</h2><div className="agent-title"><span className={`avatar large ${selectedState}`}>{AGENTS.find(([id]) => id === selected)?.[2]}</span><div><h3>{AGENTS.find(([id]) => id === selected)?.[1]}</h3><p>{selected === "research-agent" ? "Agente de investigación" : "Agente especializado"}</p></div></div>
          <dl><div><dt>Estado</dt><dd><span className={`status-dot ${selectedState}`}/>{STATE_LABEL[selectedState]}</dd></div><div><dt>Tarea actual</dt><dd>{selectedRun ? selectedRun.prompt.slice(0, 80) : "—"}</dd></div><div><dt>Último evento</dt><dd>{selectedEvent?.type || "—"}</dd></div><div><dt>Tokens</dt><dd>{selectedEvent?.usage?.totalTokens ?? "—"}</dd></div><div><dt>Coste estimado</dt><dd>—</dd></div><div><dt>Trazas</dt><dd>{selectedEvent?.trace_id ? <a href="https://langfuse.aiops.cloudpiles.net" target="_blank" rel="noreferrer">Abrir Langfuse <ExternalLink size={14}/></a> : "Sin trazas"}</dd></div></dl>
        </section>
        <section className="panel task"><h2>Nueva tarea</h2><form onSubmit={createRun}><label>Instrucciones / Prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength="12000" placeholder="Describe la tarea que quieres que realice el agente…" disabled={!me || busy}/></label><label>Asignar a un agente<select value={agent} onChange={(event) => setAgent(event.target.value)} disabled={!me || busy}>{AGENTS.map(([id,name]) => <option value={id} key={id}>{name}</option>)}</select></label><button className="run" type="submit" disabled={!me || busy}><Play size={16}/>{busy ? "Enviando…" : "Ejecutar"}</button></form>
          <div className="approval"><h3>Aprobaciones</h3>{snapshot.runs.filter((run) => run.status === "waiting_for_approval").map((run) => <div className="approval-row" key={run.run_id}><span>Plan de despliegue</span>{me?.canApprove ? <span><button onClick={() => approve(run.run_id, "approve")} disabled={busy}>Aprobar</button><button onClick={() => approve(run.run_id, "reject")} disabled={busy}>Rechazar</button></span> : <small>Requiere aiops-approvers</small>}</div>) || <p>Sin aprobaciones pendientes.</p>}</div>
          {message && <p className="message"><Activity size={15}/>{message}</p>}
        </section>
      </aside>
    </section>
  </main>;
}
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
