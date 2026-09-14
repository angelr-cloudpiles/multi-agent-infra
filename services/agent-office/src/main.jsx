import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowUpRight, Bot, ChevronDown, FolderKanban, ListTodo, LockKeyhole, MessageSquareText, PanelLeft, Play, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import officeFloor from "./assets/office-floor.webp";
import "./styles.css";

const AGENTS = [
  { id: "orchestrator-agent", name: "Orchestrator", role: "Coordina el trabajo", color: "violet", home: [350, 285], skin: "#d79b73", hair: "#392d37", outfit: "#7859ae" },
  { id: "research-agent", name: "Research", role: "Investiga y sintetiza", color: "mint", home: [541, 194], skin: "#b87859", hair: "#d3a15d", outfit: "#4b9f92" },
  { id: "code-agent", name: "Code", role: "Implementa cambios", color: "blue", home: [246, 429], skin: "#9f604b", hair: "#1e2535", outfit: "#426ca7" },
  { id: "review-agent", name: "Review", role: "Revisa calidad", color: "rose", home: [586, 382], skin: "#e2a07d", hair: "#703d54", outfit: "#b05f9d" },
  { id: "deploy-agent", name: "Deploy", role: "Entrega con control", color: "amber", home: [760, 424], skin: "#c17c58", hair: "#50352b", outfit: "#b87642" },
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
    const label = (text, x, y, width, color = "#08152e") => { paintRect(x, y, width, 13, color); context.strokeStyle = "#4a6da1"; context.strokeRect(x + .5, y + .5, width - 1, 12); context.fillStyle = "#eaf1ff"; context.font = "7px ui-monospace, monospace"; context.fillText(text, x + 4, y + 9); };
    const drawFurniture = () => {
      context.fillStyle = "#171924"; context.fillRect(0, 0, 960, 540);
      context.strokeStyle = "rgba(227,181,117,.12)"; context.lineWidth = 1; for (let x = 0; x < 960; x += 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 540); context.stroke(); } for (let y = 0; y < 540; y += 24) { context.beginPath(); context.moveTo(0, y); context.lineTo(960, y); context.stroke(); }
      paintRect(24, 24, 912, 492, "#343033"); context.strokeStyle = "#b9865d"; context.lineWidth = 4; context.strokeRect(26, 26, 908, 488);
      paintRect(45, 44, 220, 80, "#2a2730"); paintRect(51, 50, 208, 68, "#4e4540"); for (let x = 70; x < 240; x += 42) { paintRect(x, 62, 14, 9, "#e5b965"); paintRect(x, 79, 14, 9, "#e5b965"); }
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
      const active = ["working", "reviewing", "meeting", "queued", "waiting_for_tool", "waiting_for_approval", "error"].includes(state);
      const walk = !reducedMotion && active && state !== "waiting_for_approval" ? Math.round(Math.sin(now / 125)) : 0;
      const breathe = !reducedMotion ? Math.round(Math.sin(now / 420) * 1) : 0;
      const [x, y] = point; const color = PALETTE[agent.color]; const base = y + breathe;

      // Small, floor-aware human sprites: the scene remains the protagonist.
      context.fillStyle = "rgba(3, 7, 16, .42)"; context.beginPath(); context.ellipse(x, base + 15, 9, 3, 0, 0, Math.PI * 2); context.fill();
      if (selected === agent.id) { context.strokeStyle = "rgba(149,255,229,.92)"; context.lineWidth = 1.5; context.beginPath(); context.ellipse(x, base + 14, 13, 5, 0, 0, Math.PI * 2); context.stroke(); }

      // Feet, legs, torso, arms, head and hair are deliberately built on a 2px grid.
      paintRect(x - 5, base + 8, 4, 7 + walk, "#26304a"); paintRect(x + 2, base + 8, 4, 7 - walk, "#26304a");
      paintRect(x - 6, base + 4, 13, 7, agent.outfit); paintRect(x - 7, base + 6, 2, 5, agent.outfit); paintRect(x + 6, base + 6, 2, 5, agent.outfit);
      paintRect(x - 5, base - 5, 11, 10, agent.skin); paintRect(x - 6, base - 7, 13, 4, agent.hair); paintRect(x - 6, base - 3, 2, 4, agent.hair);
      paintRect(x - 3, base - 1, 1, 1, "#171c29"); paintRect(x + 3, base - 1, 1, 1, "#171c29"); paintRect(x - 1, base + 2, 3, 1, "rgba(96,50,45,.75)");
      paintRect(x - 4, base + 11, 3, 2, "#171c29"); paintRect(x + 2, base + 11, 3, 2, "#171c29");

      if (state === "working" || state === "reviewing") {
        paintRect(x + 7, base + 6, 4, 2, agent.skin); paintRect(x + 10, base + 4, 5, 4, "#27334d"); paintRect(x + 11, base + 5, 3, 1, color);
      }
      if (state === "meeting") { paintRect(x - 11, base - 9, 2, 2, color); paintRect(x - 8, base - 12, 2, 2, color); paintRect(x - 5, base - 15, 2, 2, color); }
      if (state === "error") { paintRect(x - 1, base - 15, 3, 5, "#ed7183"); paintRect(x - 1, base - 8, 3, 2, "#ed7183"); }

      if (STATE_EMOTE[state]) { label(`${STATE_EMOTE[state]} ${STATE_LABEL[state]}`, x - 24, base - 32, Math.max(52, STATE_LABEL[state].length * 5 + 20), state === "error" ? "#752d43" : state.includes("waiting") ? "#6d5424" : "#12345a"); }
      label(agent.name, x - 24, base + 21, 56, "rgba(7,18,38,.92)");
    };
    const render = (now) => {
      const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) { canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); }
      context.setTransform(ratio * rect.width / 960, 0, 0, ratio * rect.height / 540, 0, 0); context.clearRect(0, 0, 960, 540); const delta = reducedMotion ? 1000 : Math.min(48, now - previous); previous = now;
      AGENTS.forEach((agent) => { const state = statuses[agent.id]; const target = targetFor(agent, state); const item = motion.current[agent.id] || { x: target[0], y: target[1] }; item.x += (target[0] - item.x) * Math.min(1, delta / 420); item.y += (target[1] - item.y) * Math.min(1, delta / 420); motion.current[agent.id] = item; drawAgent(agent, state, [item.x, item.y], now); });
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };
    const chooseAgent = (event) => { const rect = canvas.getBoundingClientRect(); const x = (event.clientX - rect.left) * 960 / rect.width; const y = (event.clientY - rect.top) * 540 / rect.height; const nearest = AGENTS.map((agent) => ({ agent, point: motion.current[agent.id] || { x: agent.home[0], y: agent.home[1] } })).sort((a,b) => Math.hypot(x-a.point.x,y-a.point.y)-Math.hypot(x-b.point.x,y-b.point.y))[0]; if (nearest && Math.hypot(x-nearest.point.x,y-nearest.point.y) < 70) onSelect(nearest.agent.id); };
    frame = requestAnimationFrame(render); canvas.addEventListener("click", chooseAgent); return () => { cancelAnimationFrame(frame); canvas.removeEventListener("click", chooseAgent); };
  }, [statuses, selected, onSelect]);
  return <><canvas ref={canvasRef} className="pixel-canvas" style={{backgroundImage:`url(${officeFloor})`,backgroundPosition:"center",backgroundRepeat:"no-repeat",backgroundSize:"cover"}} aria-label="Oficina pixelada interactiva"/><nav className="sr-only" aria-label="Seleccionar agente">{AGENTS.map((agent) => <button type="button" key={agent.id} onClick={() => onSelect(agent.id)} aria-pressed={selected === agent.id}>{agent.name}: {STATE_LABEL[statuses[agent.id]]}</button>)}</nav></>;
}
const TASK_LABEL = { queued: "En cola", working: "En curso", completed: "Completada", waiting_for_approval: "Espera aprobación", approved: "Aprobada", rejected: "Rechazada", paused: "Pausada", error: "Requiere atención" };
const shortAgent = (id) => AGENTS.find((agent) => agent.id === id)?.name || id;
const taskLabel = (status) => TASK_LABEL[status] || status;

function OfficeScene({ snapshot, selected, onSelect, connected, project }) {
  const statuses = Object.fromEntries(AGENTS.map((agent) => [agent.id, statusFor(agent.id, snapshot)]));
  return <section className="office-panel">
    <div className="section-head"><div><span className="eyebrow">ESPACIO DE TRABAJO · {project?.environment || "PRODUCCIÓN"}</span><h1>{project?.display_name || "La oficina"}</h1><p>{project?.access_mode === "read_only_context" ? "Piloto con contexto de solo lectura." : "Los agentes se mueven cuando reciben trabajo."}</p></div><span className={`connection ${connected ? "online" : "locked"}`}><i/>{connected ? "En directo" : "Acceso requerido"}</span></div>
    <div className="office-scene"><PixelOfficeCanvas statuses={statuses} selected={selected} onSelect={onSelect}/><div className="scene-key"><span><i className="key-working"/> Trabajando</span><span><i className="key-waiting"/> Espera</span><span><i className="key-idle"/> Disponible</span></div></div>
  </section>;
}

function TaskList({ runs, selectedRun, onSelect, compact = false }) {
  const visible = compact ? runs.slice(0, 4) : runs;
  if (!visible.length) return <div className="empty-state"><ListTodo size={20}/><p>Aún no hay tareas en este proyecto.</p></div>;
  return <div className={`task-list ${compact ? "compact" : ""}`}>{visible.map((run) => <button className={`task-row ${selectedRun?.run_id === run.run_id ? "selected" : ""}`} key={run.run_id} type="button" onClick={() => onSelect(run)}><span className={`task-status ${run.status}`}/><span className="task-copy"><strong>{run.prompt}</strong><small>{shortAgent(run.agent_id)} · {new Date(run.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</small></span><span className={`task-badge ${run.status}`}>{taskLabel(run.status)}</span></button>)}</div>;
}

function ActivityFeed({ snapshot, me }) {
  const visibleEvents = useMemo(() => (snapshot.events || []).slice(0, 6), [snapshot.events]);
  return <section className="activity-panel"><div className="section-head compact-head"><div><span className="eyebrow">SEÑALES DEL PROYECTO</span><h2>Actividad reciente</h2></div><span className="text-action">Ver todo <ChevronDown size={15}/></span></div>
    {me && visibleEvents.length ? <ol className="event-list">{visibleEvents.map((item) => <li key={item.event_id}><span className={`event-dot ${item.state || "idle"}`}/><strong>{shortAgent(item.agent_id)}</strong><p>{item.type}</p><time>{new Date(item.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol> : <div className="empty-state"><LockKeyhole size={20}/><p>{me ? "Aún no llegaron señales." : "Inicia sesión para consultar las señales."}</p></div>}
  </section>;
}

function ProjectRail({ projects, projectId, onChange, view, onView }) {
  return <aside className="project-rail"><a className="brand" href="/"><span className="brand-mark"><Bot size={19}/></span><strong>Agent <em>Office</em></strong></a><nav className="main-nav" aria-label="Secciones"><button className={view === "office" ? "active" : ""} onClick={() => onView("office")}><PanelLeft size={18}/>Oficina</button><button className={view === "tasks" ? "active" : ""} onClick={() => onView("tasks")}><ListTodo size={18}/>Tareas</button><button className={view === "chat" ? "active" : ""} onClick={() => onView("chat")}><MessageSquareText size={18}/>Conversación</button></nav><div className="project-list"><span className="eyebrow">PROYECTOS</span>{projects.map((item) => <button key={item.project_id} className={item.project_id === projectId ? "active" : ""} onClick={() => onChange(item.project_id)}><FolderKanban size={16}/><span><strong>{item.display_name}</strong><small>{item.access_mode === "read_only_context" ? "Solo lectura" : item.environment}</small></span></button>)}</div><div className="rail-footer"><span className="presence"/>Agent Office online</div></aside>;
}

function AgentInspector({ selectedAgent, selectedState, selectedRun, selectedEvent }) {
  return <section className="inspector"><span className="eyebrow">AGENTE SELECCIONADO</span><div className="inspector-identity"><span className={`pixel-portrait ${selectedAgent.color}`}><i/><b/></span><div><h2>{selectedAgent.name}</h2><p>{selectedAgent.role}</p></div></div><div className="state-line"><span className={`state-pip ${selectedState}`}/>{STATE_LABEL[selectedState]}</div><dl><div><dt>Tarea actual</dt><dd>{selectedRun ? selectedRun.prompt.slice(0, 120) : "Sin tarea asignada"}</dd></div><div><dt>Último evento</dt><dd>{selectedEvent?.type || "—"}</dd></div><div><dt>Trazas</dt><dd>{selectedEvent?.trace_id ? <a href="https://langfuse.aiops.cloudpiles.net" target="_blank" rel="noreferrer">Abrir Langfuse <ArrowUpRight size={14}/></a> : "Sin trazas"}</dd></div></dl></section>;
}

function ChatPanel({ messages, agents, me, busy, onSend }) {
  const [draft, setDraft] = useState(""); const [agent, setAgent] = useState(agents[0]?.id || "research-agent");
  useEffect(() => { if (!agents.some((item) => item.id === agent)) setAgent(agents[0]?.id || "research-agent"); }, [agents, agent]);
  async function submit(event) { event.preventDefault(); if (!draft.trim()) return; await onSend(draft, agent); setDraft(""); }
  return <section className="chat-panel"><div className="section-head"><div><span className="eyebrow">CONVERSACIÓN DEL PROYECTO</span><h2>Pide y sigue el trabajo</h2></div><MessageSquareText size={19}/></div><div className="chat-history">{messages.length ? messages.map((item) => <article className={`chat-message ${item.role}`} key={item.message_id}><span>{item.role === "user" ? "Tú" : item.role === "agent" ? shortAgent(item.agent_id) : "Sistema"}</span><p>{item.content}</p></article>) : <div className="empty-state"><Sparkles size={20}/><p>Escribe el primer pedido para iniciar el hilo.</p></div>}</div><form className="chat-composer" onSubmit={submit}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!me || busy} placeholder="Ej.: revisa los riesgos de operación y crea un plan de validación…"/><div><select value={agent} onChange={(event) => setAgent(event.target.value)} disabled={!me || busy}>{agents.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="primary" type="submit" disabled={!me || busy}><Send size={16}/>{busy ? "Enviando…" : "Enviar pedido"}</button></div>{!me && <p className="access-note"><LockKeyhole size={14}/>Inicia sesión para enviar pedidos.</p>}</form></section>;
}

function TaskDetail({ run, onApprove, canApprove, busy }) {
  if (!run) return <section className="task-detail"><span className="eyebrow">DETALLE DE TAREA</span><div className="empty-state"><ListTodo size={20}/><p>Selecciona una tarea para ver su progreso y resultados.</p></div></section>;
  const result = run.results?.at(-1);
  return <section className="task-detail"><span className="eyebrow">DETALLE DE TAREA</span><h2>{taskLabel(run.status)}</h2><p className="detail-prompt">{run.prompt}</p><dl><div><dt>Asignada a</dt><dd>{shortAgent(run.agent_id)}</dd></div><div><dt>Creada</dt><dd>{new Date(run.created_at).toLocaleString("es-ES")}</dd></div></dl>{result && <div className="agent-result"><span>{shortAgent(result.agent_id)}</span><p>{result.output}</p></div>}{run.status === "waiting_for_approval" && canApprove && <div className="approval-actions"><button onClick={() => onApprove(run.run_id, "reject")} disabled={busy}>Rechazar</button><button className="primary" onClick={() => onApprove(run.run_id, "approve")} disabled={busy}>Aprobar</button></div>}</section>;
}

function App() {
  const [snapshot, setSnapshot] = useState({ agents: [], events: [], runs: [] }); const [messages, setMessages] = useState([]); const [config, setConfig] = useState({ projects: [], default_project_id: "multi-agent" }); const [projectId, setProjectId] = useState("multi-agent"); const [me, setMe] = useState(null); const [selected, setSelected] = useState("research-agent"); const [selectedTask, setSelectedTask] = useState(null); const [view, setView] = useState("office"); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const project = config.projects.find((item) => item.project_id === projectId); const availableAgents = AGENTS.filter((item) => !project || project.allowed_agents.includes(item.id)); const runs = snapshot.runs || [];
  const refresh = async () => { try { const identity = await request("/api/me"); const [latest, chat] = await Promise.all([request(`/api/snapshot?project_id=${encodeURIComponent(projectId)}`), request(`/api/chat?project_id=${encodeURIComponent(projectId)}`)]); setMe(identity?.sub ? identity : null); setSnapshot({ agents: latest.agents || [], events: latest.events || [], runs: latest.runs || [] }); setMessages(chat.messages || []); } catch (error) { if (error.message === "AUTH_REQUIRED") { setMe(null); setSnapshot({ agents: [], events: [], runs: [] }); setMessages([]); } else setMessage(error.message); } };
  useEffect(() => { request("/api/config").then((next) => { setConfig(next); setProjectId(next.default_project_id); }).catch((error) => setMessage(error.message)); }, []);
  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [projectId]);
  useEffect(() => { if (availableAgents.length && !availableAgents.some((item) => item.id === selected)) setSelected(availableAgents[0].id); }, [projectId, config]);
  const selectedAgent = AGENTS.find((item) => item.id === selected) || AGENTS[0]; const selectedState = statusFor(selected, snapshot); const selectedEvent = snapshot.events.find((item) => item.agent_id === selected); const selectedRun = runs.find((item) => item.agent_id === selected && ["queued", "working", "waiting_for_approval"].includes(item.status)); const activeTask = runs.find((item) => item.run_id === selectedTask?.run_id) || selectedTask;
  async function sendMessage(content, agentId) { setBusy(true); setMessage(""); try { const run = await request("/api/chat", { method: "POST", body: JSON.stringify({ message: content, agent_id: agentId, project_id: projectId }) }); setMessage(`Tarea ${run.run_id.slice(0, 8)} encolada.`); setView("tasks"); await refresh(); } catch (error) { setMessage(error.message === "AUTH_REQUIRED" ? "Inicia sesión antes de enviar un pedido." : error.message); } finally { setBusy(false); } }
  async function approve(runId, decision) { setBusy(true); try { const result = await request(`/api/runs/${runId}/approval?project_id=${encodeURIComponent(projectId)}`, { method: "POST", body: JSON.stringify({ decision }) }); setMessage(result.message); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  function changeProject(nextProject) { setProjectId(nextProject); setSnapshot({ agents: [], events: [], runs: [] }); setMessages([]); setSelectedTask(null); }
  return <main className="app-shell"><ProjectRail projects={config.projects} projectId={projectId} onChange={changeProject} view={view} onView={setView}/><section className="workbench"><header className="topbar"><div><span className="eyebrow">OPERACIONES</span><strong>{view === "office" ? "La oficina" : view === "tasks" ? "Tareas del proyecto" : "Conversación"}</strong></div><div className="top-meta"><span className="environment">{project?.environment || "PRODUCCIÓN"}</span>{me ? <button className="logout" onClick={async () => { const result = await request("/auth/logout", { method: "POST", body: "{}" }); location.assign(result.url); }}>Salir</button> : <a className="login" href="/auth/login">Entrar con Microsoft <ArrowUpRight size={15}/></a>}</div></header><div className="main-content">{view === "office" && <><OfficeScene snapshot={snapshot} selected={selected} onSelect={setSelected} connected={Boolean(me)} project={project}/><section className="tasks-preview"><div className="section-head compact-head"><div><span className="eyebrow">LISTA DE TAREAS</span><h2>En seguimiento</h2></div><button className="text-action" onClick={() => setView("tasks")}>Ver tareas <ArrowUpRight size={15}/></button></div><TaskList runs={runs} selectedRun={activeTask} onSelect={setSelectedTask} compact/></section><ActivityFeed snapshot={snapshot} me={me}/></>}{view === "tasks" && <section className="tasks-page"><div className="section-head"><div><span className="eyebrow">LISTA DE TAREAS</span><h1>Trabajo del proyecto</h1><p>Selecciona una tarea para seguir sus resultados.</p></div><button className="primary" onClick={() => setView("chat")}><Play size={16}/>Nuevo pedido</button></div><TaskList runs={runs} selectedRun={activeTask} onSelect={setSelectedTask}/></section>}{view === "chat" && <ChatPanel messages={messages} agents={availableAgents} me={me} busy={busy} onSend={sendMessage}/>}</div>{message && <p className="toast"><Activity size={15}/>{message}</p>}</section><aside className="detail-column"><AgentInspector selectedAgent={selectedAgent} selectedState={selectedState} selectedRun={selectedRun} selectedEvent={selectedEvent}/><TaskDetail run={activeTask} onApprove={approve} canApprove={me?.canApprove} busy={busy}/>{project?.access_mode === "read_only_context" && <section className="scope-card"><LockKeyhole size={17}/><div><strong>Contexto de solo lectura</strong><p>Este piloto no puede cambiar AWS, CI/CD ni el repositorio.</p></div></section>}</aside></main>;
}
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
