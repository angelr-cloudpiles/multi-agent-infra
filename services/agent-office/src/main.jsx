import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowUpRight, Bot, ChevronDown, LockKeyhole, Play, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const AGENTS = [
  { id: "orchestrator-agent", name: "Orchestrator", role: "Coordina el trabajo", glyph: "O", spot: "orchestrator", color: "violet" },
  { id: "research-agent", name: "Research", role: "Investiga y sintetiza", glyph: "R", spot: "research", color: "mint" },
  { id: "code-agent", name: "Code", role: "Implementa cambios", glyph: "C", spot: "code", color: "blue" },
  { id: "review-agent", name: "Review", role: "Revisa calidad", glyph: "V", spot: "review", color: "rose" },
  { id: "deploy-agent", name: "Deploy", role: "Entrega con control", glyph: "D", spot: "deploy", color: "amber" },
];

const STATE_LABEL = {
  idle: "Disponible", queued: "En cola", working: "Trabajando", waiting_for_tool: "Esperando herramienta",
  waiting_for_approval: "Esperando aprobación", reviewing: "Revisando", meeting: "En reunión", error: "Requiere atención", paused: "Pausado",
};
const STATE_EMOTE = { working: "⌨", reviewing: "⌕", meeting: "…", waiting_for_tool: "⌛", waiting_for_approval: "!", error: "×", queued: "↗" };

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "X-Requested-With": "AgentOffice", "Content-Type": "application/json", ...options.headers } });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación.");
  return payload;
}
function statusFor(agent, snapshot) { return snapshot?.agents?.find((entry) => entry.agent_id === agent)?.state || "idle"; }

function PixelAgent({ agent, state, selected, onSelect }) {
  const emote = STATE_EMOTE[state];
  return <button className={`scene-agent ${agent.spot} ${state} ${selected ? "selected" : ""}`} onClick={onSelect} aria-pressed={selected} aria-label={`${agent.name}: ${STATE_LABEL[state]}`}>
    <span className="agent-shadow" />{emote && <span className={`emote ${state}`} aria-hidden="true">{emote}</span>}
    <span className={`pixel-person ${agent.color}`} aria-hidden="true"><i/><b/></span>
    <span className="agent-tag"><strong>{agent.name}</strong><small><i className={`state-pip ${state}`}/>{STATE_LABEL[state]}</small></span>
  </button>;
}
function OfficeScene({ snapshot, selected, onSelect, connected }) {
  const activeMeetings = (snapshot.runs || []).filter((run) => run.mode === "meeting" && run.status === "working").length;
  return <section className="office-panel">
    <div className="office-heading"><div><span className="eyebrow">OPERACIONES · PRODUCCIÓN</span><h1>La oficina</h1><p>El trabajo se muestra cuando sucede.</p></div><span className={`connection ${connected ? "online" : "locked"}`}><i/>{connected ? "En directo" : "Acceso requerido"}</span></div>
    <div className="office-scene" aria-label="Oficina virtual de agentes">
      <div className="city-window"><span/><span/><span/></div><div className="wall-sign">IDEAS<br/>A CÓDIGO</div><div className="plant plant-one"/><div className="plant plant-two"/><div className="coffee"><i/><b/><span/></div><div className="server-rack"><i/><i/><i/></div>
      <div className="desk-furniture desk-one"><span/><i/></div><div className="desk-furniture desk-two"><span/><i/></div><div className="desk-furniture desk-three"><span/><i/></div><div className="research-board"><span>PLAN</span><i/><b/></div>
      <div className="meeting-room"><div className="meeting-table"><i/><i/><i/><i/></div><span><Users size={13}/>{activeMeetings ? "Reunión activa" : "Sala libre"}</span></div>
      {AGENTS.map((agent) => <PixelAgent key={agent.id} agent={agent} state={statusFor(agent.id, snapshot)} selected={selected === agent.id} onSelect={() => onSelect(agent.id)} />)}
      <div className="scene-key"><span><i className="key-working"/> En ejecución</span><span><i className="key-waiting"/> Espera</span><span><i className="key-idle"/> Disponible</span></div>
    </div>
  </section>;
}
function ActivityFeed({ snapshot, me }) {
  const visibleEvents = useMemo(() => (snapshot.events || []).slice(0, 5), [snapshot.events]);
  return <section className="activity-panel"><div className="activity-head"><div><span className="eyebrow">SEÑALES DEL SISTEMA</span><h2>Actividad reciente</h2></div><button className="filter" type="button">Todos <ChevronDown size={15}/></button></div>
    {me && visibleEvents.length ? <ol className="event-list">{visibleEvents.map((item) => <li key={item.event_id}><span className={`event-dot ${item.state || "idle"}`}/><div><strong>{item.agent_id === "platform" ? "Plataforma" : AGENTS.find((agent) => agent.id === item.agent_id)?.name || item.agent_id}</strong><p>{item.type}</p></div><time>{new Date(item.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol> : <div className="empty-activity"><LockKeyhole size={21}/><p>{me ? "Aún no llegaron señales del equipo." : "Inicia sesión para consultar las señales del equipo."}</p></div>}
  </section>;
}
function App() {
  const [snapshot, setSnapshot] = useState({ agents: [], events: [], runs: [] }); const [me, setMe] = useState(null); const [selected, setSelected] = useState("research-agent"); const [prompt, setPrompt] = useState(""); const [agent, setAgent] = useState("research-agent"); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const refresh = async () => { try { const [identity, latest] = await Promise.all([request("/api/me"), request("/api/snapshot")]); setMe(identity?.sub ? identity : null); setSnapshot({ agents: latest.agents || [], events: latest.events || [], runs: latest.runs || [] }); setMessage(""); } catch (error) { if (error.message === "AUTH_REQUIRED") setMe(null); else setMessage(error.message); } };
  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id); }, []);
  const selectedAgent = AGENTS.find((item) => item.id === selected) || AGENTS[0]; const selectedState = statusFor(selected, snapshot); const selectedEvent = snapshot.events.find((item) => item.agent_id === selected); const selectedRun = snapshot.runs.find((item) => item.agent_id === selected && ["queued", "working", "waiting_for_approval"].includes(item.status));
  async function createRun(event) { event.preventDefault(); if (!prompt.trim()) return; setBusy(true); setMessage(""); try { const run = await request("/api/runs", { method: "POST", body: JSON.stringify({ prompt, agent_id: agent }) }); setPrompt(""); setMessage(`Tarea ${run.run_id.slice(0, 8)} encolada.`); await refresh(); } catch (error) { setMessage(error.message === "AUTH_REQUIRED" ? "Inicia sesión antes de ejecutar una tarea." : error.message); } finally { setBusy(false); } }
  async function approve(runId, decision) { setBusy(true); try { const result = await request(`/api/runs/${runId}/approval`, { method: "POST", body: JSON.stringify({ decision }) }); setMessage(result.message); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  return <main className="shell"><header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Bot size={20}/></span><strong>Agent <em>Office</em></strong></a><div className="top-meta"><span>Multi Agent</span><span className="environment">PRODUCCIÓN</span>{me ? <button className="logout" onClick={async () => { const result = await request("/auth/logout", { method: "POST", body: "{}" }); location.assign(result.url); }}>Salir</button> : <a className="login" href="/auth/login">Entrar con Microsoft <ArrowUpRight size={15}/></a>}</div></header>
    <section className="workspace"><div className="office-column"><OfficeScene snapshot={snapshot} selected={selected} onSelect={setSelected} connected={Boolean(me)}/><ActivityFeed snapshot={snapshot} me={me}/></div><aside className="side-column"><section className="inspector"><span className="eyebrow">AGENTE SELECCIONADO</span><div className="inspector-identity"><span className={`pixel-portrait ${selectedAgent.color}`}><i/><b/></span><div><h2>{selectedAgent.name}</h2><p>{selectedAgent.role}</p></div></div><div className="state-line"><span className={`state-pip ${selectedState}`}/>{STATE_LABEL[selectedState]}</div><dl><div><dt>Tarea actual</dt><dd>{selectedRun ? selectedRun.prompt.slice(0, 100) : "Sin tarea asignada"}</dd></div><div><dt>Último evento</dt><dd>{selectedEvent?.type || "—"}</dd></div><div><dt>Trazas</dt><dd>{selectedEvent?.trace_id ? <a href="https://langfuse.aiops.cloudpiles.net" target="_blank" rel="noreferrer">Abrir Langfuse <ArrowUpRight size={14}/></a> : "Sin trazas"}</dd></div></dl></section>
      <section className="task-panel"><div><span className="eyebrow">NUEVA TAREA</span><h2>Encarga trabajo</h2></div><form onSubmit={createRun}><label>Instrucciones<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength="12000" placeholder="Describe el resultado que necesitas…" disabled={!me || busy}/></label><label>Asignar a<select value={agent} onChange={(event) => setAgent(event.target.value)} disabled={!me || busy}>{AGENTS.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button className="run" type="submit" disabled={!me || busy}><Play size={15}/>{busy ? "Enviando…" : "Ejecutar tarea"}</button></form><div className="approval"><h3>Aprobaciones</h3>{snapshot.runs.filter((run) => run.status === "waiting_for_approval").map((run) => <div className="approval-row" key={run.run_id}><span>Plan de despliegue</span>{me?.canApprove ? <span><button onClick={() => approve(run.run_id, "approve")} disabled={busy}>Aprobar</button><button onClick={() => approve(run.run_id, "reject")} disabled={busy}>Rechazar</button></span> : <small>Requiere aiops-approvers</small>}</div>) || <p>Sin aprobaciones pendientes.</p>}</div>{message && <p className="message"><Activity size={15}/>{message}</p>}</section></aside></section>
  </main>;
}
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
