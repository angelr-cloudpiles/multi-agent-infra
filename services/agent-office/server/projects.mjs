import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync(new URL('../projects.json', import.meta.url)));
const idPattern = /^[a-z0-9-]{2,64}$/;
const contextPattern = /^[a-z0-9-]+\.md$/;
const secretPattern = /^multi-agent-[a-z0-9-]{2,128}$/;

function invalid(message) { throw Object.assign(new Error(message), { name: 'ProjectRegistryError' }); }

function validateProject(project) {
  if (!project || !idPattern.test(project.project_id)) invalid('Invalid project identifier');
  if (!contextPattern.test(project.context_file || '')) invalid('Invalid project context file');
  if (!Array.isArray(project.allowed_agents) || !project.allowed_agents.length) invalid('Project must allow an agent');
  if (!Array.isArray(project.allowed_modes) || !project.allowed_modes.length) invalid('Project must allow a mode');
  if (!['platform', 'read_only_context'].includes(project.access_mode)) invalid('Invalid project access mode');
  if (typeof project.environment !== 'string' || !project.environment) invalid('Invalid project environment');
  if (!project.langfuse || project.langfuse.project_id !== project.project_id || !secretPattern.test(project.langfuse.keys_secret_id || '')) invalid('Project must define dedicated Langfuse credentials');
  if (!project.bedrock || project.bedrock.region !== 'us-east-1') invalid('Project must define the managed Bedrock region');
  if (project.context_source) {
    const source = project.context_source;
    if (source.kind === 'document_snapshot' && Number.isInteger(source.document_count) && source.document_count >= 0) return Object.freeze({ ...project, allowed_agents: Object.freeze([...project.allowed_agents]), allowed_modes: Object.freeze([...project.allowed_modes]) });
    if (!['git_snapshot', 'git_reference'].includes(source.kind) || !String(source.repository || '').startsWith('https://') || !/^[a-f0-9]{40}$/.test(source.revision || '')) invalid('Invalid project context source');
  }
  return Object.freeze({ ...project, allowed_agents: Object.freeze([...project.allowed_agents]), allowed_modes: Object.freeze([...project.allowed_modes]) });
}

const configured = registry.projects?.map(validateProject) || [];
export const projects = new Map(configured.map((project) => [project.project_id, project]));
export const defaultProjectId = registry.default_project_id;
if (!projects.has(defaultProjectId)) invalid('Default project is not registered');

export function projectFor(projectId = defaultProjectId) {
  const project = projects.get(projectId);
  if (!project) throw Object.assign(new Error('Unknown project'), { name: 'UnknownProjectError' });
  return project;
}

export function scopeFor(projectOrId) {
  const project = typeof projectOrId === 'string' ? projectFor(projectOrId) : projectOrId;
  return { project_id: project.project_id, environment: project.environment };
}

export function publicProjects() {
  return configured.map(({ context_file, langfuse, bedrock, ...project }) => ({ ...project, integrations: { langfuse_project_id: langfuse.project_id, model_runtime: 'bedrock-agentcore', region: bedrock.region } }));
}

export function contextFor(projectOrId) {
  const project = typeof projectOrId === 'string' ? projectFor(projectOrId) : projectOrId;
  return fs.readFileSync(new URL(`../project-contexts/${project.context_file}`, import.meta.url), 'utf8').slice(0, 24000);
}
