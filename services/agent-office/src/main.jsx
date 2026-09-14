import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowUpRight, Bot, ChevronDown, FileText, FolderKanban, Image as ImageIcon, ListTodo, LockKeyhole, MessageSquareText, PanelLeft, Paperclip, Play, Send, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./styles.css";
import "./login.css";
import "./pixel-agents.css";
import "./workspace-layout.css";

const AGENTS = [
  { id: "orchestrator-agent", name: "Orchestrator", role: "Coordina el trabajo", color: "violet", home: [350, 285], skin: "#d79b73", hair: "#392d37", outfit: "#7859ae" },
  { id: "research-agent", name: "Research", role: "Investiga y sintetiza", color: "mint", home: [541, 194], skin: "#b87859", hair: "#d3a15d", outfit: "#4b9f92" },
  { id: "code-agent", name: "Code", role: "Implementa cambios", color: "blue", home: [246, 429], skin: "#9f604b", hair: "#1e2535", outfit: "#426ca7" },
  { id: "review-agent", name: "Review", role: "Revisa calidad", color: "rose", home: [586, 382], skin: "#e2a07d", hair: "#703d54", outfit: "#b05f9d" },
  { id: "deploy-agent", name: "Deploy", role: "Entrega con control", color: "amber", home: [760, 424], skin: "#c17c58", hair: "#50352b", outfit: "#b87642" },
  { id: "ui-design-agent", name: "UI Design", role: "Diseña experiencia e interfaz", color: "cyan", home: [670, 430], skin: "#c48763", hair: "#263043", outfit: "#438bb0" },
];

const STATE_LABEL = {
  idle: "Disponible", queued: "En cola", working: "Trabajando", waiting_for_tool: "Esperando herramienta",
  waiting_for_approval: "Esperando aprobación", reviewing: "Revisando", meeting: "En reunión", error: "Requiere atención", paused: "Pausado",
};
const STATE_EMOTE = { working: "⌨", reviewing: "⌕", meeting: "…", waiting_for_tool: "⌛", waiting_for_approval: "!", error: "×", queued: "↗" };
const LANGFUSE_BASE_URL = "https://langfuse.aiops.cloudpiles.net";
// A station anchors the control box, while the sprite is drawn lower inside it.
// Keep both active and idle anchors on clear floor, away from desks and seating.
const IDLE_STATIONS = {
  "orchestrator-agent": [13, 52],
  "research-agent": [20, 53],
  "code-agent": [40, 53],
  "review-agent": [58, 52],
  "deploy-agent": [86, 50],
  "ui-design-agent": [72, 84],
};
const IDLE_PATROLS = {
  "orchestrator-agent": [[13, 52], [17, 55], [13, 49]],
  "research-agent": [[20, 53], [24, 51], [17, 55]],
  "code-agent": [[40, 53], [45, 53], [39, 56]],
  "review-agent": [[58, 52], [57, 45], [63, 53]],
  "deploy-agent": [[86, 50], [83, 52], [88, 46]],
  "ui-design-agent": [[72, 84], [65, 84], [76, 84]],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function useColumnLayout() {
  const [columns, setColumns] = useState(() => {
    try { return { projects: 244, inspector: 324, chat: 390, ...JSON.parse(localStorage.getItem("agent-office-columns") || "{}") }; } catch { return { projects: 244, inspector: 324, chat: 390 }; }
  });
  useEffect(() => { localStorage.setItem("agent-office-columns", JSON.stringify(columns)); }, [columns]);
  const startResize = useCallback((column, event) => {
    event.preventDefault(); const originX = event.clientX; const origin = columns;
    const move = (pointer) => {
      const delta = pointer.clientX - originX;
      setColumns((current) => ({ ...current, [column]: clamp(column === "projects" ? origin.projects + delta : origin[column] - delta, column === "projects" ? 190 : 250, column === "projects" ? 360 : 560) }));
    };
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end);
  }, [columns]);
  return { columns, startResize };
}

async function request(path, options = {}) {
  const fetchOptions = { ...options, headers: { "X-Requested-With": "AgentOffice", "Content-Type": "application/json", ...options.headers } };
  let response = await fetch(path, fetchOptions);
  if (response.status === 401 && path !== "/auth/refresh") {
    const refreshed = await fetch("/auth/refresh", { method: "POST", headers: { "X-Requested-With": "AgentOffice", "Content-Type": "application/json" } });
    if (refreshed.ok) response = await fetch(path, fetchOptions);
  }
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación.");
  return payload;
}
function statusFor(agent, snapshot) { return snapshot?.agents?.find((entry) => entry.agent_id === agent)?.state || "idle"; }

/* Replaced by the Pixel Agents composition below.
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
*/

// Pixel Agents assets are used under the MIT license. See THIRD_PARTY_NOTICES.md.
const PIXEL_AGENT_STATIONS = {
  "orchestrator-agent": [12.5, 55],
  "research-agent": [20, 50],
  "code-agent": [39, 50],
  "review-agent": [57, 46],
  "deploy-agent": [86, 46],
  "ui-design-agent": [70, 84],
};

const DELIVERY_ROUTES = {
  "research-agent": [[20, 50]],
  "code-agent": [[39, 50]],
  "review-agent": [[48, 50], [57, 46]],
  "ui-design-agent": [[48, 50], [53, 78], [70, 84]],
};

function pointAlong(points, progress) {
  const segments = points.length - 1, position = Math.min(segments - .0001, Math.max(0, progress * segments));
  const index = Math.floor(position), ratio = position - index, [fromX, fromY] = points[index], [toX, toY] = points[index + 1];
  return [fromX + (toX - fromX) * ratio, fromY + (toY - fromY) * ratio];
}

function useDispatchCourier(events) {
  const [courier, setCourier] = useState(null), seen = useRef(new Set()), pending = useRef([]), ready = useRef(false), timer = useRef(null);
  useEffect(() => {
    const dispatches = (events || []).filter(event => event.type === "delegation.dispatched" && event.agent_id === "orchestrator-agent" && DELIVERY_ROUTES[event.target_agent]).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    if (!ready.current) { dispatches.forEach(event => seen.current.add(event.event_id)); ready.current = true; return; }
    const additions = dispatches.filter(event => !seen.current.has(event.event_id)); additions.forEach(event => seen.current.add(event.event_id)); pending.current.push(...additions);
    if (timer.current || !pending.current.length) return;
    const play = () => {
      const event = pending.current.shift();
      if (!event) { timer.current = null; return; }
      const from = PIXEL_AGENT_STATIONS["orchestrator-agent"], route = [from, ...(DELIVERY_ROUTES[event.target_agent] || [])], started = performance.now(), duration = 2800;
      const frame = (now) => {
        const elapsed = Math.min(1, (now - started) / duration);
        const outbound = elapsed < .44 ? elapsed / .44 : elapsed < .60 ? 1 : 1 - (elapsed - .60) / .40;
        const [x, y] = pointAlong(route, outbound);
        // The dispatch is performed by the Orchestrator itself. Keeping the
        // moving state on the agent avoids rendering a detached duplicate
        // character that can look like the sprite has split in two.
        setCourier({ agent_id: event.agent_id, x, y, carrying: elapsed < .54, target: event.target_agent });
        if (elapsed < 1) timer.current = requestAnimationFrame(frame);
        else { setCourier(null); timer.current = setTimeout(play, 180); }
      };
      timer.current = requestAnimationFrame(frame);
    };
    play();
  }, [events]);
  useEffect(() => () => { if (typeof timer.current === "number") { cancelAnimationFrame(timer.current); clearTimeout(timer.current); } }, []);
  return courier;
}

function useIdlePatrols(statuses) {
  const [stations, setStations] = useState(IDLE_STATIONS), step = useRef(0);
  const idleSignature = AGENTS.map(agent => `${agent.id}:${statuses[agent.id] === "idle"}`).join("|");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const advance = () => {
      step.current += 1;
      setStations(current => Object.fromEntries(AGENTS.map((agent, index) => [agent.id, statuses[agent.id] === "idle" ? IDLE_PATROLS[agent.id][(step.current + index) % IDLE_PATROLS[agent.id].length] : current[agent.id]])));
    };
    const timer = window.setInterval(advance, 6800);
    return () => window.clearInterval(timer);
  }, [idleSignature]);
  return stations;
}

function PixelAgentsOffice({ statuses, selected, onSelect, onConversation, onTask, onReviewAttention, courier }) {
  const idleStations = useIdlePatrols(statuses);
  return <>
    <div className="pixel-agents-office" role="group" aria-label="Oficina pixelada interactiva">
      <img className="pixel-agents-floorplan" src="/pixel-agents/office-empty.png" alt="Oficina pixelada vacía con escritorios, sala de reuniones y sala de descanso"/>
      <span className="office-ambient-pixels" aria-hidden="true"><i/><i/><i/><i/></span>
      {AGENTS.map((agent, index) => {
        const state = statuses[agent.id]; const active = state !== "idle"; const dispatching = courier?.agent_id === agent.id; const [x, y] = dispatching ? [courier.x, courier.y] : active ? PIXEL_AGENT_STATIONS[agent.id] : idleStations[agent.id]; const attention = ["error", "paused", "waiting_for_tool", "waiting_for_approval"].includes(state);
        return <div key={agent.id} className={`pixel-agent-control ${agent.color} ${active ? "active" : "idle"} ${dispatching ? "dispatching" : ""} ${attention ? "needs-attention" : ""} ${selected === agent.id ? "selected" : ""}`} style={{ "--station-x": `${x}%`, "--station-y": `${y}%`, "--portrait": `url(/pixel-agents/characters/char_${index}.png)` }}>
          <button type="button" className={`pixel-agent-marker ${dispatching && courier.carrying ? "carrying" : ""}`} onClick={() => onSelect(agent.id)} aria-pressed={selected === agent.id} aria-label={`${agent.name}: ${dispatching ? `Llevando una tarea a ${shortAgent(courier.target)}` : STATE_LABEL[state]}`}>
          <span className="pixel-agent-avatar"/>
          <span className="pixel-agent-ring"/>
          <span className={`pixel-agent-signal ${state}`}><i/>{attention ? "!" : active ? (STATE_EMOTE[state] || "•") : ""}</span>
          {dispatching && courier.carrying && <span className="pixel-agent-parcel" aria-hidden="true"/>}
          <span className="pixel-agent-name">{agent.name}</span>
          <span className="pixel-agent-state">{active ? STATE_LABEL[state] : "Disponible"}</span>
          </button>
          {selected === agent.id && <div className="pixel-agent-actions" aria-label={`Acciones para ${agent.name}`}><button type="button" onClick={() => onConversation(agent.id)}>Conversar</button>{attention ? <button type="button" onClick={() => onReviewAttention(agent.id)}>Revisar atención</button> : <button type="button" onClick={() => onTask(agent.id)}>Asignar tarea</button>}</div>}
        </div>;
      })}
      <span className="pixel-agents-caption">Oficina operativa · Pixel Agents</span>
    </div>
    <nav className="sr-only" aria-label="Seleccionar agente">{AGENTS.map((agent) => <button type="button" key={agent.id} onClick={() => onSelect(agent.id)} aria-pressed={selected === agent.id}>{agent.name}: {STATE_LABEL[statuses[agent.id]]}</button>)}</nav>
  </>;
}

const TASK_LABEL = { queued: "En cola", working: "En curso", completed: "Completada", waiting_for_approval: "Espera aprobación", approved: "Aprobada", rejected: "Rechazada", assisted: "Continuada", paused: "Pausada", error: "Requiere atención" };
const ASSISTABLE_TASK_STATUSES = new Set(["paused", "error", "waiting_for_approval"]);
const shortAgent = (id) => AGENTS.find((agent) => agent.id === id)?.name || id;
const taskLabel = (status) => TASK_LABEL[status] || status;
const langfuseProjectUrl = (project, section = "traces") => {
  const projectId = project?.integrations?.langfuse_project_id;
  return projectId ? `${LANGFUSE_BASE_URL}/project/${encodeURIComponent(projectId)}/${section}` : LANGFUSE_BASE_URL;
};
const traceResults = (run) => (run?.results || []).filter((result) => result?.trace_id);

function OfficeScene({ snapshot, selected, onSelect, onConversation, onTask, onReviewAttention, connected, project }) {
  const statuses = Object.fromEntries(AGENTS.map((agent) => [agent.id, statusFor(agent.id, snapshot)]));
  const courier = useDispatchCourier(snapshot.events);
  return <section className="office-panel">
    <div className="section-head"><div><span className="eyebrow">ESPACIO DE TRABAJO · {project?.environment || "PRODUCCIÓN"}</span><h1>{project?.display_name || "La oficina"}</h1><p>{project?.access_mode === "read_only_context" ? "Piloto con contexto de solo lectura." : "Los agentes se mueven cuando reciben trabajo."}</p></div><span className={`connection ${connected ? "online" : "locked"}`}><i/>{connected ? "En directo" : "Acceso requerido"}</span></div>
    <div className="office-scene"><PixelAgentsOffice statuses={statuses} selected={selected} onSelect={onSelect} onConversation={onConversation} onTask={onTask} onReviewAttention={onReviewAttention} courier={courier}/><div className="scene-key"><span><i className="key-working"/> Trabajando</span><span><i className="key-waiting"/> Espera</span><span><i className="key-idle"/> Disponible</span></div></div>
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

function ProjectRail({ projects, projectId, onChange, view, onView, onConversation }) {
  return <aside className="project-rail"><a className="brand" href="/"><span className="brand-mark"><Bot size={19}/></span><strong>Agent <em>Office</em></strong></a><nav className="main-nav" aria-label="Secciones"><button className={view === "office" ? "active" : ""} onClick={() => onView("office")}><PanelLeft size={18}/>Oficina</button><button className={view === "tasks" ? "active" : ""} onClick={() => onView("tasks")}><ListTodo size={18}/>Tareas</button><button onClick={onConversation}><MessageSquareText size={18}/>Conversación</button></nav><div className="project-list"><span className="eyebrow">PROYECTOS</span>{projects.map((item) => <button key={item.project_id} className={item.project_id === projectId ? "active" : ""} onClick={() => onChange(item.project_id)}><FolderKanban size={16}/><span><strong>{item.display_name}</strong><small>{item.access_mode === "read_only_context" ? "Solo lectura" : item.environment}</small></span></button>)}</div><div className="rail-footer"><span className="presence"/>Agent Office online</div></aside>;
}

function AgentInspector({ selectedAgent, selectedState, selectedRun, selectedEvent, events, activity, project, onConversation, onReviewAttention }) {
  const projects = activity?.projects || []; const attention=ASSISTABLE_TASK_STATUSES.has(selectedState) && activity?.active_run_id;
  const latestTrace = (events || []).find((item) => item.agent_id === selectedAgent.id && item.trace_id)?.trace_id || traceResults(selectedRun).find((item) => item.agent_id === selectedAgent.id)?.trace_id;
  return <section className="inspector"><span className="eyebrow">AGENTE SELECCIONADO</span><div className="inspector-identity"><span className={`pixel-portrait ${selectedAgent.color}`}><i/><b/></span><div><h2>{selectedAgent.name}</h2><p>{selectedAgent.role}</p></div></div><div className="state-line"><span className={`state-pip ${selectedState}`}/>{STATE_LABEL[selectedState]}</div><dl><div><dt>Tarea actual</dt><dd>{activity?.task || selectedRun?.prompt?.slice(0, 120) || "Sin tarea asignada"}</dd></div><div><dt>Último evento</dt><dd>{activity?.event || selectedEvent?.type || "—"}</dd></div><div><dt>Trazas</dt><dd>{latestTrace ? <span className="trace-reference"><a href={langfuseProjectUrl(project)} target="_blank" rel="noreferrer">Ver trazas <ArrowUpRight size={14}/></a><code>{latestTrace.slice(0, 12)}…</code></span> : "Sin trazas"}</dd></div></dl>{attention&&<button className="agent-conversation" type="button" onClick={onReviewAttention}><MessageSquareText size={15}/>Revisar tarea que requiere atención</button>}<div className="agent-projects"><span>ACTIVIDAD ENTRE PROYECTOS</span>{projects.length ? projects.map(item=><button key={item.project_id} type="button" onClick={onConversation}><i className={item.state}/>{item.project_name}<small>{STATE_LABEL[item.state] || item.state}</small></button>) : <p>Sin actividad reciente.</p>}</div><button className="agent-conversation" type="button" onClick={onConversation}><MessageSquareText size={15}/>Interactuar con {selectedAgent.name}</button></section>;
}

function ChatMarkdown({ content, streaming = false }) {
  return <div className="markdown-content">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noreferrer" : undefined}>{children}</a>,
      }}
    >
      {content}
    </ReactMarkdown>
    {streaming && <b className="typing-cursor" aria-label="El agente está escribiendo"/>}
  </div>;
}

function ChatRecoveryActions({ run, partialCount, isRootFailure, busy, onRetry, onAssist, onShowActivity }) {
  if (!run || !ASSISTABLE_TASK_STATUSES.has(run.status)) return null;
  const canRetry = isRootFailure && run.agent_id === "orchestrator-agent" && partialCount > 0;
  return <div className="chat-recovery-actions"><p>{partialCount ? `Se conservaron ${partialCount} resultados de especialistas. Elegí cómo continuar esta tarea.` : "El agente necesita una indicación, un archivo o una decisión para continuar esta tarea."}</p><div>{canRetry && <button type="button" onClick={() => onRetry(run)} disabled={busy}>Reintentar síntesis</button>}{partialCount > 0 && <button type="button" onClick={onShowActivity}>Ver resultados disponibles</button>}<button type="button" onClick={() => onAssist(run)} disabled={busy}>Aportar información</button></div></div>;
}

function ChatPanel({ messages, runs, agents, me, busy, onSend, onUpload, onFeedback, onRetry, onAssist, project, inputRef, preferredAgent, assistanceFor, onCancelAssistance, conversationTasks, onNewTask, compact = false }) {
  const [draft, setDraft] = useState(""); const [agent, setAgent] = useState("orchestrator-agent"); const [attachments, setAttachments] = useState([]); const [showActivity, setShowActivity] = useState(false);
  const fileInputRef = useRef(null), historyRef = useRef(null), followTailRef = useRef(true);
  const assistedAgent = assistanceFor?.agent_id || agent;
  const taskId = conversationTasks[`${project?.project_id}:${assistedAgent}`] || null;
  useEffect(() => { if (!agents.some((item) => item.id === agent)) setAgent(agents.find(item=>item.id === "orchestrator-agent")?.id || agents[0]?.id || "orchestrator-agent"); }, [agents, agent]);
  useEffect(() => { if (preferredAgent && agents.some((item) => item.id === preferredAgent)) setAgent(preferredAgent); }, [preferredAgent, agents]);
  useEffect(() => { setDraft(""); setAttachments([]); setShowActivity(false); }, [project?.project_id]);
  useEffect(() => { setShowActivity(false); followTailRef.current = true; }, [assistanceFor?.run_id, assistedAgent]);
  const activeTaskId = assistanceFor?.run_id || taskId;
  const taskMessages = useMemo(() => activeTaskId ? messages.filter(item => item.task_id === activeTaskId || item.run_id === activeTaskId) : messages, [messages, activeTaskId]);
  const threadMessages = useMemo(() => showActivity ? taskMessages : taskMessages.filter((item) => item.role !== "system" && item.agent_id === assistedAgent), [taskMessages, assistedAgent, showActivity]);
  const runsById = useMemo(() => new Map(runs.map(run => [run.run_id, run])), [runs]);
  const partialCountByRun = useMemo(() => messages.reduce((counts, item) => {
    if (item.run_id && item.role === "agent" && !item.failed && !item.streaming && item.content && item.content !== "Redactando…") counts.set(item.run_id, (counts.get(item.run_id) || 0) + 1);
    return counts;
  }, new Map()), [messages]);
  const messageRevision = useMemo(() => threadMessages.map((item) => `${item.message_id}:${item.content.length}:${item.streaming}`).join("|"), [threadMessages]);
  useEffect(() => { const element=historyRef.current; if (element && followTailRef.current) element.scrollTop=element.scrollHeight; }, [messageRevision]);
  const onHistoryScroll = () => { const element=historyRef.current; if (element) followTailRef.current=element.scrollHeight-element.scrollTop-element.clientHeight<36; };
  async function addFiles(files) { if (!files?.length) return; const selected=[...files].slice(0,10-attachments.length); if(!selected.length)return; const pending=selected.map(file=>({file,id:crypto.randomUUID(),name:file.name,size:file.size,uploading:true}));setAttachments(current=>[...current,...pending]); try{const uploaded=await Promise.all(pending.map(async item=>({...await onUpload(item.file),localId:item.id})));setAttachments(current=>current.map(item=>uploaded.find(result=>result.localId===item.id)||item));}catch(error){setAttachments(current=>current.map(item=>pending.some(next=>next.id===item.id)?{...item,error:error.message,uploading:false}:item));} }
  async function submit(event) { event.preventDefault(); if ((!draft.trim()&&!attachments.length)||attachments.some(item=>item.uploading||item.error)) return; followTailRef.current=true; await onSend(draft, assistedAgent, attachments.map(item=>item.attachment_id), { assistanceRunId: assistanceFor?.run_id, taskId: assistanceFor ? null : taskId }); setDraft(""); setAttachments([]); }
  const onKeyDown = (event) => { if(event.key === "Enter" && !event.shiftKey){event.preventDefault();event.currentTarget.form?.requestSubmit();} };
  return <section className={`chat-panel ${compact ? "chat-panel-rail" : ""}`}><div className="section-head"><div><span className="eyebrow">CONVERSACIÓN · {project?.display_name || "PROYECTO"}</span><h2>{assistanceFor ? `Asistiendo a ${shortAgent(assistanceFor.agent_id)}` : `Conversación con ${shortAgent(assistedAgent)}`}</h2>{!assistanceFor && <small className="task-context">{taskId ? `Seguimiento de tarea ${taskId.slice(0,8)}` : "El próximo mensaje inicia una tarea"}</small>}</div><div className="chat-head-actions"><button className="text-action chat-activity-toggle" type="button" onClick={()=>setShowActivity(value=>!value)}>{showActivity ? "Ocultar actividad" : "Ver actividad"}</button>{!assistanceFor && taskId && <button className="text-action chat-new-task" type="button" onClick={()=>onNewTask(assistedAgent)} disabled={busy}>Nueva tarea</button>}<MessageSquareText size={19}/></div></div>{assistanceFor&&<div className="assistance-banner"><span>Continuación de la tarea {assistanceFor.run_id.slice(0,8)} · {taskLabel(assistanceFor.status)}</span><button type="button" onClick={onCancelAssistance} disabled={busy}>Cancelar</button></div>}<div className="chat-history" ref={historyRef} onScroll={onHistoryScroll} aria-live="polite">{threadMessages.length ? threadMessages.map((item) => { const failedRun = item.failed ? runsById.get(item.run_id) || runsById.get(item.parent_task_id) : null; return <article className={`chat-message ${item.role} ${item.streaming ? "streaming" : ""} ${item.failed ? "failed" : ""}`} key={item.message_id}><span className="message-author">{item.role === "user" ? "Tú" : item.role === "agent" ? shortAgent(item.agent_id) : "Sistema"}</span><ChatMarkdown content={item.content} streaming={item.streaming}/>{failedRun && <ChatRecoveryActions run={failedRun} partialCount={partialCountByRun.get(item.run_id) || (failedRun?.results || []).length || 0} isRootFailure={failedRun?.run_id === item.run_id} busy={busy} onRetry={onRetry} onAssist={onAssist} onShowActivity={() => setShowActivity(true)}/>} {item.attachments?.length>0&&<div className="message-attachments">{item.attachments.map(file=><a key={file.attachment_id} href={`/api/attachments/${file.attachment_id}?project_id=${encodeURIComponent(project?.project_id || "")}`} target="_blank" rel="noreferrer">{file.content_type?.startsWith("image/")?<ImageIcon size={14}/>:<FileText size={14}/>}<span>{file.name}</span></a>)}</div>}{item.role === "agent" && !item.streaming && item.trace_id && <div className="message-feedback" aria-label="Valorar respuesta">{item.feedback === undefined ? <><span>¿Fue útil?</span><button type="button" onClick={()=>onFeedback(item.message_id,true)} disabled={busy} aria-label="Respuesta útil"><ThumbsUp size={14}/></button><button type="button" onClick={()=>onFeedback(item.message_id,false)} disabled={busy} aria-label="Respuesta no útil"><ThumbsDown size={14}/></button></> : <span className={item.feedback ? "positive" : "negative"}>{item.feedback ? "Marcada como útil" : "Marcada para mejorar"}</span>}</div>}</article>;}) : <div className="empty-state"><Sparkles size={20}/><p>{showActivity ? "Aún no hay actividad del proyecto." : `No hay mensajes con ${shortAgent(assistedAgent)} en este proyecto.`}</p></div>}</div><form className="chat-composer" onSubmit={submit}><input className="file-picker" type="file" multiple ref={fileInputRef} onChange={event=>{addFiles(event.target.files);event.target.value="";}}/><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onPaste={event=>{const files=[...event.clipboardData.files];if(files.length){event.preventDefault();addFiles(files);}}} disabled={!me || busy} placeholder={assistanceFor ? "Describe la información o decisión que necesita el agente…" : taskId ? "Continúa la tarea… Enter envía · Shift+Enter agrega una línea" : "Describe una nueva tarea… Enter envía · Shift+Enter agrega una línea"}/>{attachments.length>0&&<div className="attachment-queue">{attachments.map(item=><span className={item.error?"error":""} key={item.localId}>{item.uploading?"Subiendo ":""}{item.name}<button type="button" aria-label={`Quitar ${item.name}`} onClick={()=>setAttachments(current=>current.filter(file=>file.localId!==item.localId))}><X size={12}/></button></span>)}</div>}<div><button className="attach-button" type="button" onClick={()=>fileInputRef.current?.click()} disabled={!me||busy||attachments.length>=10}><Paperclip size={16}/>Adjuntar</button><select value={assistedAgent} onChange={(event) => setAgent(event.target.value)} disabled={!me || busy || Boolean(assistanceFor)}>{agents.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="primary" type="submit" disabled={!me || busy || attachments.some(item=>item.uploading||item.error)}><Send size={16}/>{busy ? "Enviando…" : assistanceFor ? "Continuar" : taskId ? "Continuar" : "Crear tarea"}</button></div>{!me && <p className="access-note"><LockKeyhole size={14}/>Inicia sesión para enviar pedidos.</p>}</form></section>;
}
function TaskDetail({ run, project, onApprove, onAssist, canApprove, canAssist, busy }) {
  if (!run) return <section className="task-detail"><span className="eyebrow">DETALLE DE TAREA</span><div className="empty-state"><ListTodo size={20}/><p>Selecciona una tarea para ver su progreso y resultados.</p></div></section>;
  const result = run.results?.at(-1); const traces=traceResults(run); const requiresAssistance=ASSISTABLE_TASK_STATUSES.has(run.status);
  return <section className="task-detail"><span className="eyebrow">DETALLE DE TAREA</span><h2>{taskLabel(run.status)}</h2><p className="detail-prompt">{run.prompt}</p><dl><div><dt>Asignada a</dt><dd>{shortAgent(run.agent_id)}</dd></div><div><dt>Creada</dt><dd>{new Date(run.created_at).toLocaleString("es-ES")}</dd></div>{run.error_code&&<div><dt>Motivo</dt><dd>{run.error_code}</dd></div>}</dl>{traces.length>0&&<section className="task-observability"><div><span className="eyebrow">OBSERVABILIDAD</span><strong>{traces.length} trazas registradas</strong></div><a href={langfuseProjectUrl(project)} target="_blank" rel="noreferrer">Abrir trazas del proyecto <ArrowUpRight size={14}/></a><ul>{traces.map((item)=><li key={`${item.agent_id}-${item.trace_id}`}><span>{shortAgent(item.agent_id)}</span><code title={item.trace_id}>{item.trace_id}</code></li>)}</ul></section>}{result && <div className="agent-result"><span>{shortAgent(result.agent_id)}</span><p>{result.output}</p></div>}{requiresAssistance&&canAssist&&<div className="assistance-actions"><p>El agente necesita una decisión, un dato o una corrección para continuar.</p><button className="primary" onClick={() => onAssist(run)} disabled={busy}><MessageSquareText size={15}/>Asistir al agente</button></div>}{run.status === "waiting_for_approval" && canApprove && <div className="approval-actions"><button onClick={() => onApprove(run.run_id, "reject")} disabled={busy}>Rechazar</button><button className="primary" onClick={() => onApprove(run.run_id, "approve")} disabled={busy}>Aprobar</button></div>}</section>;
}
function LoginScreen({ checking = false }) {
  return <main className="login-screen"><section className="login-card"><div className="login-brand"><span className="brand-mark"><Bot size={21}/></span><strong>Agent <em>Office</em></strong></div><span className="eyebrow">ACCESO PRIVADO</span><h1>Tu oficina de agentes.</h1><p>Inicia sesión con tu cuenta corporativa para acceder a los proyectos, tareas y conversaciones.</p><a className="login-action" href="/auth/login">Entrar con Microsoft <ArrowUpRight size={17}/></a>{checking && <span className="login-check">Verificando sesión segura…</span>}<small><LockKeyhole size={13}/> Acceso protegido por Entra ID</small></section></main>;
}

function App() {
  const [snapshot, setSnapshot] = useState({ agents: [], events: [], runs: [] }); const [messages, setMessages] = useState([]); const [focusedTaskMessages, setFocusedTaskMessages] = useState([]); const [assistanceFor, setAssistanceFor] = useState(null); const [conversationTasks, setConversationTasks] = useState(() => { try { return JSON.parse(sessionStorage.getItem("agent-office-conversation-tasks") || "{}"); } catch { return {}; } }); const [config, setConfig] = useState({ projects: [], default_project_id: "multi-agent" }); const [projectId, setProjectId] = useState("multi-agent"); const [me, setMe] = useState(null); const [authState, setAuthState] = useState("checking"); const [selected, setSelected] = useState("orchestrator-agent"); const [agentActivity, setAgentActivity] = useState({}); const [selectedTask, setSelectedTask] = useState(null); const [view, setView] = useState("office"); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const chatInputRef = useRef(null); const { columns, startResize } = useColumnLayout();
  const configuredProjects = Array.isArray(config?.projects) ? config.projects : [];
  const project = configuredProjects.find((item) => item.project_id === projectId); const availableAgents = AGENTS.filter((item) => !project || (Array.isArray(project.allowed_agents) && project.allowed_agents.includes(item.id))); const runs = snapshot.runs || [];
  const refresh = async () => { try { const [latest, chat, activity] = await Promise.all([request(`/api/snapshot?project_id=${encodeURIComponent(projectId)}`), request(`/api/chat?project_id=${encodeURIComponent(projectId)}`), request("/api/agents/activity")]); setSnapshot({ agents: latest.agents || [], events: latest.events || [], runs: latest.runs || [] }); setMessages(chat.messages || []); if(assistanceFor?.run_id)setFocusedTaskMessages(current=>{const merged=new Map(current.map(item=>[item.message_id,item]));for(const item of chat.messages||[])if(item.task_id===assistanceFor.run_id)merged.set(item.message_id,item);return [...merged.values()].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));}); setAgentActivity(activity.agents || {}); } catch (error) { if (error.message === "AUTH_REQUIRED") { setMe(null); setSnapshot({ agents: [], events: [], runs: [] }); setMessages([]); setFocusedTaskMessages([]); setAuthState("anonymous"); } else setMessage(error.message); } };
  useEffect(() => { let current = true; (async () => { try { const identity = await request("/api/me"), next = await request("/api/config"); if (!current) return; const projects = Array.isArray(next?.projects) ? next.projects : []; if (!projects.length) throw new Error("La configuración de proyectos no está disponible."); const defaultProjectId = projects.some((item) => item.project_id === next.default_project_id) ? next.default_project_id : projects[0].project_id; setMe(identity); setConfig({ ...next, projects, default_project_id: defaultProjectId }); setProjectId(defaultProjectId); setAuthState("authenticated"); } catch (error) { if (!current) return; setMe(null); setSnapshot({ agents: [], events: [], runs: [] }); setMessages([]); setAuthState("anonymous"); if (error.message !== "AUTH_REQUIRED") setMessage(error.message); } })(); return () => { current = false; }; }, []);
  useEffect(() => { if (authState !== "authenticated") return undefined; refresh(); const id = setInterval(refresh, 1500); return () => clearInterval(id); }, [projectId, authState, assistanceFor?.run_id]);
  useEffect(() => { sessionStorage.setItem("agent-office-conversation-tasks", JSON.stringify(conversationTasks)); }, [conversationTasks]);
  if (authState !== "authenticated" || !me) return <LoginScreen checking={authState === "checking"}/>;
  const selectedAgent = AGENTS.find((item) => item.id === selected) || AGENTS[0]; const selectedActivity=agentActivity[selected]; const selectedState = selectedActivity?.state || statusFor(selected, snapshot); const selectedEvent = snapshot.events.find((item) => item.agent_id === selected); const selectedRun = runs.find((item) => item.agent_id === selected && ["queued", "working", "waiting_for_approval", "paused", "error"].includes(item.status)); const activeTask = runs.find((item) => item.run_id === selectedTask?.run_id) || selectedTask; const officeStates=Object.fromEntries(AGENTS.map(agent=>[agent.id,agentActivity[agent.id]?.state||statusFor(agent.id,snapshot)]));
  async function uploadAttachment(file) { const response=await fetch(`/api/uploads?project_id=${encodeURIComponent(projectId)}`,{method:"PUT",headers:{"X-Requested-With":"AgentOffice","X-File-Name":encodeURIComponent(file.name),"Content-Type":file.type||"application/octet-stream"},body:file});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||"No se pudo adjuntar el archivo.");return payload.attachment; }
  async function sendMessage(content, agentId, attachments=[], options={}) { const {assistanceRunId=null,taskId=null}=options; setBusy(true); setMessage(""); try { const route=assistanceRunId?`/api/runs/${assistanceRunId}/assist?project_id=${encodeURIComponent(projectId)}`:taskId?`/api/tasks/${taskId}/messages?project_id=${encodeURIComponent(projectId)}`:"/api/chat"; const body=assistanceRunId?{message:content,attachments}:taskId?{message:content,attachments}:{message:content,agent_id:agentId,project_id:projectId,attachments}; const run = await request(route, { method: "POST", body: JSON.stringify(body) }); const activeTaskId=run.task_id || taskId || run.run_id; setConversationTasks(current=>({...current,[`${projectId}:${agentId}`]:activeTaskId})); setAssistanceFor(null); setMessage(assistanceRunId?`Continuación ${run.run_id.slice(0, 8)} encolada.`:taskId?`Seguimiento de la tarea ${activeTaskId.slice(0, 8)} encolado.`:`Tarea ${activeTaskId.slice(0, 8)} creada.`); await refresh(); } catch (error) { setMessage(error.message === "AUTH_REQUIRED" ? "Inicia sesión antes de enviar un pedido." : error.message); } finally { setBusy(false); } }
  async function retrySynthesis(run) { setBusy(true); setMessage(""); try { const result=await request(`/api/runs/${run.run_id}/retry-synthesis?project_id=${encodeURIComponent(projectId)}`,{method:"POST",body:"{}"}); setConversationTasks(current=>({...current,[`${projectId}:${run.agent_id}`]:result.task_id||run.run_id})); setMessage("Síntesis reencolada con los resultados preservados."); await refresh(); } catch(error) { setMessage(error.message); } finally { setBusy(false); } }
  function startNewTask(agentId) { setConversationTasks(current=>{const next={...current};delete next[`${projectId}:${agentId}`];return next;}); setAssistanceFor(null); setMessage("El próximo mensaje creará una tarea nueva."); requestAnimationFrame(() => chatInputRef.current?.focus()); }
  async function approve(runId, decision) { setBusy(true); try { const result = await request(`/api/runs/${runId}/approval?project_id=${encodeURIComponent(projectId)}`, { method: "POST", body: JSON.stringify({ decision }) }); setMessage(result.message); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  async function submitFeedback(messageId, positive) { setBusy(true); setMessage(""); try { await request(`/api/chat/${messageId}/feedback?project_id=${encodeURIComponent(projectId)}`, { method: "POST", body: JSON.stringify({ positive }) }); setMessage(positive ? "Feedback positivo registrado." : "Feedback registrado para revisión."); await refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  function changeProject(nextProject) { setProjectId(nextProject); setSnapshot({ agents: [], events: [], runs: [] }); setMessages([]); setFocusedTaskMessages([]); setSelectedTask(null); setAssistanceFor(null); }
  function openConversation(agentId = selected) { if (agentId) { setSelected(agentId); const targetProject=Array.isArray(project?.allowed_agents)&&project.allowed_agents.includes(agentId)?projectId:agentActivity[agentId]?.active_project_id||configuredProjects.find(item=>Array.isArray(item.allowed_agents)&&item.allowed_agents.includes(agentId))?.project_id;if(targetProject&&targetProject!==projectId)changeProject(targetProject); } requestAnimationFrame(() => chatInputRef.current?.focus()); }
  function startTaskFor(agentId) { openConversation(agentId); setMessage(`${shortAgent(agentId)} está seleccionado para el próximo pedido.`); }
  async function startAssistance(run) { setSelected(run.agent_id); setSelectedTask(run); setAssistanceFor(run); try { const taskChat=await request(`/api/tasks/${run.run_id}/chat?project_id=${encodeURIComponent(projectId)}`); setFocusedTaskMessages(taskChat.messages||[]); } catch(error) { setMessage(error.message); } requestAnimationFrame(() => chatInputRef.current?.focus()); }
  async function reviewAttention(agentId) { const activity=agentActivity[agentId]; if(!activity?.active_task_id || !activity.active_project_id)return openConversation(agentId); setBusy(true); setMessage(""); try { const targetProject=activity.active_project_id; const [latest,chat,updatedActivity,taskChat]=await Promise.all([request(`/api/snapshot?project_id=${encodeURIComponent(targetProject)}`),request(`/api/chat?project_id=${encodeURIComponent(targetProject)}`),request("/api/agents/activity"),request(`/api/tasks/${activity.active_task_id}/chat?project_id=${encodeURIComponent(targetProject)}`)]); const run=(latest.runs||[]).find(item=>item.run_id===activity.active_task_id); setProjectId(targetProject); setSnapshot({agents:latest.agents||[],events:latest.events||[],runs:latest.runs||[]}); setMessages(chat.messages||[]); setFocusedTaskMessages(taskChat.messages||[]); setAgentActivity(updatedActivity.agents||{}); setSelected(agentId); setSelectedTask(run||null); setAssistanceFor(run||null); if(run)requestAnimationFrame(() => chatInputRef.current?.focus()); else setMessage("La tarea ya no requiere atención."); } catch(error) { setMessage(error.message); } finally { setBusy(false); } }
  const gridStyle = { gridTemplateColumns: `${columns.projects}px 8px minmax(420px, 1fr) 8px ${columns.inspector}px 8px ${columns.chat}px` };
  return <main className="app-shell resizable-shell" style={gridStyle}>
    <ProjectRail projects={configuredProjects} projectId={projectId} onChange={changeProject} view={view} onView={setView} onConversation={() => openConversation()}/>
    <div className="column-resizer" role="separator" aria-orientation="vertical" aria-label="Cambiar ancho de proyectos" onPointerDown={(event) => startResize("projects", event)}/>
    <section className="workbench"><header className="topbar"><div><span className="eyebrow">OPERACIONES</span><strong>{view === "office" ? "La oficina" : "Tareas del proyecto"}</strong></div><div className="top-meta"><span className="environment">{project?.environment || "PRODUCCIÓN"}</span><button className="logout" onClick={async () => { const result = await request("/auth/logout", { method: "POST", body: "{}" }); location.assign(result.url); }}>Salir</button></div></header><div className="main-content">{view === "office" && <><OfficeScene snapshot={{...snapshot,agents:AGENTS.map(agent=>({agent_id:agent.id,state:officeStates[agent.id]}))}} selected={selected} onSelect={setSelected} onConversation={openConversation} onTask={startTaskFor} onReviewAttention={reviewAttention} connected={Boolean(me)} project={project}/><section className="tasks-preview"><div className="section-head compact-head"><div><span className="eyebrow">LISTA DE TAREAS</span><h2>En seguimiento</h2></div><button className="text-action" onClick={() => setView("tasks")}>Ver tareas <ArrowUpRight size={15}/></button></div><TaskList runs={runs} selectedRun={activeTask} onSelect={setSelectedTask} compact/></section><ActivityFeed snapshot={snapshot} me={me}/></>}{view === "tasks" && <section className="tasks-page"><div className="section-head"><div><span className="eyebrow">LISTA DE TAREAS</span><h1>Trabajo del proyecto</h1><p>Selecciona una tarea para seguir sus resultados.</p></div><button className="primary" onClick={() => openConversation()}><Play size={16}/>Nuevo pedido</button></div><TaskList runs={runs} selectedRun={activeTask} onSelect={setSelectedTask}/></section>}</div>{message && <p className="toast"><Activity size={15}/>{message}</p>}</section>
    <div className="column-resizer" role="separator" aria-orientation="vertical" aria-label="Cambiar ancho del detalle" onPointerDown={(event) => startResize("inspector", event)}/>
    <aside className="detail-column"><AgentInspector selectedAgent={selectedAgent} selectedState={selectedState} selectedRun={selectedRun} selectedEvent={selectedEvent} events={snapshot.events} activity={selectedActivity} project={project} onConversation={()=>openConversation(selected)} onReviewAttention={()=>reviewAttention(selected)}/><TaskDetail run={activeTask} project={project} onApprove={approve} onAssist={startAssistance} canApprove={me?.canApprove} canAssist={Boolean(me?.sub)} busy={busy}/>{project?.access_mode === "read_only_context" && <section className="scope-card"><LockKeyhole size={17}/><div><strong>Contexto de solo lectura</strong><p>Este piloto no puede cambiar AWS, CI/CD ni el repositorio.</p></div></section>}</aside>
    <div className="column-resizer" role="separator" aria-orientation="vertical" aria-label="Cambiar ancho de conversación" onPointerDown={(event) => startResize("chat", event)}/>
    <aside className="conversation-column"><ChatPanel messages={assistanceFor ? focusedTaskMessages : messages} runs={runs} agents={availableAgents} me={me} busy={busy} onSend={sendMessage} onUpload={uploadAttachment} onFeedback={submitFeedback} onRetry={retrySynthesis} onAssist={startAssistance} project={project} inputRef={chatInputRef} preferredAgent={selected} assistanceFor={assistanceFor} onCancelAssistance={() => { setAssistanceFor(null); setFocusedTaskMessages([]); }} conversationTasks={conversationTasks} onNewTask={startNewTask} compact/></aside>
  </main>;
}
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
