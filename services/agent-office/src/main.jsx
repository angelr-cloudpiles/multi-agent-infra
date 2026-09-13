import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowUpRight, Bot, ChevronDown, LockKeyhole, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

const AGENTS = [
  { id: "orchestrator-agent", name: "Orchestrator", role: "Coordina el trabajo", color: "violet", home: [355, 290] },
  { id: "research-agent", name: "Research", role: "Investiga y sintetiza", color: "mint", home: [545, 185] },
  { id: "code-agent", name: "Code", role: "Implementa cambios", color: "blue", home: [250, 430] },
  { id: "review-agent", name: "Review", role: "Revisa calidad", color: "rose", home: [580, 390] },
  { id: "deploy-agent", name: "Deploy", role: "Entrega con control", color: "amber", home: [760, 430] },
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

const PALETTE = { violet: "#8c7cff", mint: "#60e0c0", blue: "#5ca5f5", rose: "#dc85d6", amber: "#f0b25e" };
function targetFor(agent, state) {
  if (state === "meeting") return [746, 183];
  if (state === "queued") return [86, 470];
  if (state === "waiting_for_tool") return [agent.home[0] + 16, agent.home[1]];
  return agent.home;
}
function PixelOfficeCanvas({ statuses, selected, onSelect }) {
  const canvasRef = useRef(null); const motion = useRef({});
  useEffect(() => {
    const canvas = canvasRef.current; const context = canvas.getContext("2d"); const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; let frame; let previous = performance.now();
    const paintRect = (x, y, width, height, color) => { context.fillStyle = color; context.fillRect(x, y, width, height); };
    const label = (text, x, y, width, color = "#08152e") => { paintRect(x, y, width, 21, color); context.strokeStyle = "#4a6da1"; context.strokeRect(x + .5, y + .5, width - 1, 20); context.fillStyle = "#eaf1ff"; context.font = "9px ui-monospace, monospace"; context.fillText(text, x + 6, y + 13); };
    const drawFurniture = () => {
      context.fillStyle = "#0d2044"; context.fillRect(0, 0, 960, 540);
      context.strokeStyle = "rgba(119,162,224,.13)"; context.lineWidth = 1; for (let x = 0; x < 960; x += 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 540); context.stroke(); } for (let y = 0; y < 540; y += 24) { context.beginPath(); context.moveTo(0, y); context.lineTo(960, y); context.stroke(); }
      paintRect(24, 24, 912, 492, "#102b57"); context.strokeStyle = "#567ab4"; context.lineWidth = 4; context.strokeRect(26, 26, 908, 488);
      paintRect(45, 44, 220, 80, "#132040"); paintRect(51, 50, 208, 68, "#1d3463"); for (let x = 70; x < 240; x += 42) { paintRect(x, 62, 14, 9, "#e5b965"); paintRect(x, 79, 14, 9, "#e5b965"); }
      paintRect(68, 158, 104, 40, "#18294d"); context.fillStyle = "#9ba9e7"; context.font = "12px ui-monospace, monospace"; context.fillText("IDEAS", 82, 177); context.fillText("A CÓDIGO", 76, 192);
      [[190,268,174,74],[162,430,166,74],[505,374,178,74]].forEach(([x,y,w,h]) => { paintRect(x,y,w,h,"#563d32"); paintRect(x+5,y+5,w-10,11,"#9b704b"); paintRect(x+28,y-31,w-56,29,"#173258"); context.strokeStyle="#6e9eda"; context.lineWidth=3; context.strokeRect(x+28,y-31,w-56,29); paintRect(x+12,y+h,9,20,"#26374f"); paintRect(x+w-21,y+h,9,20,"#26374f"); });
      paintRect(450,72,148,99,"#d9d0ad"); context.strokeStyle="#765840"; context.lineWidth=5; context.strokeRect(450,72,148,99); context.fillStyle="#23395e"; context.font="11px ui-monospace, monospace"; context.fillText("RESEARCH",464,91); [[470,106,"#dd7f78"],[513,116,"#6ca2dc"],[553,106,"#e1bd5e"]].forEach(([x,y,c])=>paintRect(x,y,16,16,c));
      paintRect(675,56,210,126,"#12254d"); context.strokeStyle="#58739c"; context.lineWidth=4; context.strokeRect(675,56,210,126); paintRect(725,99,104,45,"#694a37"); context.strokeStyle="#b18a5e"; context.lineWidth=5; context.beginPath(); context.ellipse(777,121,52,22,0,0,Math.PI*2); context.stroke(); [[730,83],[814,83],[730,151],[814,151]].forEach(([x,y])=>{paintRect(x,y,17,14,"#53687f");context.strokeStyle="#7f99b9";context.strokeRect(x,y,17,14);});
      paintRect(816,270,51,119,"#0a162c"); context.strokeStyle="#3f608a"; context.lineWidth=4; context.strokeRect(816,270,51,119); for(let y=284;y<372;y+=19){paintRect(829,y,26,7,"#5be4c0");}
      [[77,386],[874,410],[65,455]].forEach(([x,y])=>{paintRect(x+10,y,19,25,"#71553e");paintRect(x,y-8,38,22,"#267a5c");paintRect(x+8,y-17,20,15,"#43a878");});
      paintRect(61,269,72,52,"#523b31"); paintRect(75,251,22,18,"#d7c28c"); paintRect(86,285,13,18,"#dfe9ef"); paintRect(106,285,13,18,"#dfe9ef");
      context.strokeStyle="#7f9fc9"; context.setLineDash([7,7]); context.beginPath(); context.moveTo(108,464);context.lineTo(170,464);context.lineTo(170,310);context.lineTo(435,310);context.lineTo(435,210);context.lineTo(675,210);context.stroke(); context.setLineDash([]);
    };
    const drawAgent = (agent, state, point, now) => {
      const active = ["working","reviewing","meeting","queued","waiting_for_tool","waiting_for_approval","error"].includes(state); const bob = !reducedMotion && active && state !== "waiting_for_approval" ? Math.round(Math.sin(now / 160) * 2) : 0; const [x,y] = point; const color = PALETTE[agent.color];
      paintRect(x - 13, y + 22, 29, 6, "rgba(2,8,22,.62)"); paintRect(x - 10, y + bob, 22, 25, color); paintRect(x - 13, y - 18 + bob, 28, 23, "#f0c19b"); paintRect(x - 14, y - 23 + bob, 30, 8, "#1a2340"); paintRect(x - 7, y - 8 + bob, 4, 4, "#18223e"); paintRect(x + 6, y - 8 + bob, 4, 4, "#18223e");
      if (state === "working" || state === "reviewing") { paintRect(x + 13, y + 9 + bob, 8, 4, "#f0c19b"); paintRect(x + 17, y + 12 + bob, 4, 8, "#f0c19b"); }
      if (selected === agent.id) { context.strokeStyle="#95ffe5"; context.lineWidth=2; context.strokeRect(x-19,y-29,42,59); }
      if (STATE_EMOTE[state]) { label(`${STATE_EMOTE[state]} ${STATE_LABEL[state]}`, x - 20, y - 53 + bob, Math.max(58, STATE_LABEL[state].length * 6 + 23), state === "error" ? "#752d43" : state.includes("waiting") ? "#6d5424" : "#12345a"); }
      label(agent.name, x - 31, y + 31, 74);
    };
    const render = (now) => {
      const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) { canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); }
      context.setTransform(ratio * rect.width / 960, 0, 0, ratio * rect.height / 540, 0, 0); context.clearRect(0, 0, 960, 540); drawFurniture(); const delta = reducedMotion ? 1000 : Math.min(48, now - previous); previous = now;
      AGENTS.forEach((agent) => { const state = statuses[agent.id]; const target = targetFor(agent, state); const item = motion.current[agent.id] || { x: target[0], y: target[1] }; item.x += (target[0] - item.x) * Math.min(1, delta / 420); item.y += (target[1] - item.y) * Math.min(1, delta / 420); motion.current[agent.id] = item; drawAgent(agent, state, [item.x, item.y], now); });
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };
    const chooseAgent = (event) => { const rect = canvas.getBoundingClientRect(); const x = (event.clientX - rect.left) * 960 / rect.width; const y = (event.clientY - rect.top) * 540 / rect.height; const nearest = AGENTS.map((agent) => ({ agent, point: motion.current[agent.id] || { x: agent.home[0], y: agent.home[1] } })).sort((a,b) => Math.hypot(x-a.point.x,y-a.point.y)-Math.hypot(x-b.point.x,y-b.point.y))[0]; if (nearest && Math.hypot(x-nearest.point.x,y-nearest.point.y) < 70) onSelect(nearest.agent.id); };
    frame = requestAnimationFrame(render); canvas.addEventListener("click", chooseAgent); return () => { cancelAnimationFrame(frame); canvas.removeEventListener("click", chooseAgent); };
  }, [statuses, selected, onSelect]);
  return <><canvas ref={canvasRef} className="pixel-canvas" aria-label="Oficina pixelada interactiva"/><nav className="sr-only" aria-label="Seleccionar agente">{AGENTS.map((agent) => <button type="button" key={agent.id} onClick={() => onSelect(agent.id)} aria-pressed={selected === agent.id}>{agent.name}: {STATE_LABEL[statuses[agent.id]]}</button>)}</nav></>;
}
function OfficeScene({ snapshot, selected, onSelect, connected }) {
  const statuses = Object.fromEntries(AGENTS.map((agent) => [agent.id, statusFor(agent.id, snapshot)]));
  return <section className="office-panel">
    <div className="office-heading"><div><span className="eyebrow">OPERACIONES · PRODUCCIÓN</span><h1>La oficina</h1><p>El trabajo se muestra cuando sucede.</p></div><span className={`connection ${connected ? "online" : "locked"}`}><i/>{connected ? "En directo" : "Acceso requerido"}</span></div>
    <div className="office-scene"><PixelOfficeCanvas statuses={statuses} selected={selected} onSelect={onSelect}/><div className="scene-key"><span><i className="key-working"/> En ejecución</span><span><i className="key-waiting"/> Espera</span><span><i className="key-idle"/> Disponible</span></div></div>
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
