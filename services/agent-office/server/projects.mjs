import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync(new URL('../projects.json', import.meta.url)));
const idPattern = /^[a-z0-9-]{2,64}$/;
const contextPattern = /^[a-z0-9-]+\.md$/;

function invalid(message) { throw Object.assign(new Error(message), { name: 'ProjectRegistryError' }); }

function validateProject(project) {
  if (!project || !idPattern.test(project.project_id)) invalid('Invalid project identifier');
  if (!contextPattern.test(project.context_file || '')) invalid('Invalid project context file');
  if (!Array.isArray(project.allowed_agents) || !project.allowed_agents.length) invalid('Project must allow an agent');
  if (!Array.isArray(project.allowed_modes) || !project.allowed_modes.length) invalid('Project must allow a mode');
  if (!['platform', 'read_only_context'].includes(project.access_mode)) invalid('Invalid project access mode');
  if (typeof project.environment !== 'string' || !project.environment) invalid('Invalid project environment');
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
  return configured.map(({ context_file, ...project }) => project);
}

export function contextFor(projectOrId) {
  const project = typeof projectOrId === 'string' ? projectFor(projectOrId) : projectOrId;
  return fs.readFileSync(new URL(`../project-contexts/${project.context_file}`, import.meta.url), 'utf8').slice(0, 24000);
}
