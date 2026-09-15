#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'config/codex-pinned-projects.json'), 'utf8'));
const args = new Set(process.argv.slice(2));
const selectedId = [...args].find((arg) => arg.startsWith('--project='))?.slice('--project='.length);
if ([...args].some((arg) => arg !== '--all' && !arg.startsWith('--project='))) throw new Error('Usage: sync-pinned-project-contexts.mjs --all | --project=<id>');
if (!selectedId && !args.has('--all')) throw new Error('Choose --all or --project=<id>');
const selected = catalogue.projects.filter((project) => project.status === 'selected' && (!selectedId || project.project_id === selectedId));
if (!selected.length) throw new Error('No selected project matched');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (checkout, ...gitArgs) => execFileSync('git', ['-C', checkout, ...gitArgs], { encoding: 'utf8' }).trim();
const asHttps = (origin) => origin.startsWith('https://') ? origin.replace(/\.git$/, '.git') : origin.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '.git');
const candidateFiles = ['README.md', 'package.json', 'pyproject.toml', 'requirements.txt', 'main.tf', 'cdk.json', 'server.mjs', 'backend/agent.mjs', 'backend/integrations.mjs', 'docs/integraciones.md', 'docs/automatizacion-revision.md', 'docs/operacion-produccion.md', 'docs/manual-usuario.md'];

function gitSnapshot(project) {
  const checkout = project.source.checkout;
  if (!checkout || !fs.existsSync(checkout)) throw new Error(`${project.project_id}: Git checkout is unavailable`);
  const revision = git(checkout, 'rev-parse', 'HEAD');
  const repository = asHttps(git(checkout, 'remote', 'get-url', 'origin'));
  const dirtyFiles = git(checkout, 'status', '--porcelain').split('\n').filter(Boolean).length;
  const tracked = new Set(git(checkout, 'ls-tree', '-r', '--name-only', revision).split('\n').filter(Boolean));
  const files = candidateFiles.filter((file) => tracked.has(file)).slice(0, 12);
  if (!files.length) files.push(...[...tracked].filter((file) => /(^|\/)(README|package|main|server)\./i.test(file)).slice(0, 8));
  const sections = files.map((file) => {
    const raw = execFileSync('git', ['-C', checkout, 'show', `${revision}:${file}`], { encoding: 'utf8' });
    const text = raw.length > 2400 ? `${raw.slice(0, 2400).trimEnd()}\n…[extracto truncado]` : raw.trimEnd();
    return { file, text, sha256: sha256(raw) };
  });
  return { kind: 'git_snapshot', repository, revision, dirtyFiles, sections };
}
function referenceSnapshot(project) {
  return { kind: 'git_reference', repository: project.source.repository, revision: project.source.revision, dirtyFiles: null, sections: [] };
}
function documentSnapshot(project) {
  const sections = [];
  for (const document of project.source.documents || []) {
    if (!fs.existsSync(document)) continue;
    const buffer = fs.readFileSync(document);
    sections.push({ file: path.basename(document), text: `Documento registrado: ${path.basename(document)}\nExtracción de contenido no incluida automáticamente; aporte el archivo mediante el IDE para su análisis.`, sha256: sha256(buffer) });
  }
  return { kind: 'document_snapshot', repository: null, revision: null, dirtyFiles: null, sections };
}
function build(project, snapshot) {
  const source = snapshot.kind === 'git_snapshot' ? [`- Repositorio: ${snapshot.repository}`, `- Revisión: ${snapshot.revision}`, `- Cambios locales detectados y excluidos: ${snapshot.dirtyFiles}`] : snapshot.kind === 'git_reference' ? [`- Repositorio: ${snapshot.repository}`, `- Revisión declarada: ${snapshot.revision}`, '- El checkout no estaba disponible durante la migración; no se incluye contenido de código.'] : ['- Fuente: documentos de operación registrados en el inventario.', `- Documentos incluidos: ${snapshot.sections.length}`, '- No existe un checkout Git verificable asociado a este proyecto.'];
  const digest = sha256(snapshot.sections.map((section) => `${section.file}:${section.sha256}`).join('\n'));
  const contents = [
    `# Contexto de ${project.display_name}`,
    '',
    'Paquete de contexto aislado para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.',
    '',
    '## Procedencia verificable',
    ...source,
    `- Integridad del paquete: sha256:${digest}`,
    '',
    '## Límites obligatorios',
    '- Analiza sólo las fuentes incluidas y declara cualquier dato no disponible.',
    '- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.',
    '- No afirmes que cambiaste archivos. Entrega una propuesta o diff revisable para que otro flujo lo aplique en un worktree.',
    '',
    ...(snapshot.sections.length ? snapshot.sections.flatMap((section) => [`## ${section.file}`, `SHA-256: ${section.sha256}`, '```text', section.text, '```', '']) : ['## Cobertura pendiente', 'No se pudo incluir un archivo fuente verificable. Solicita al usuario o al IDE un checkout o documento concreto antes de afirmar hallazgos técnicos.', ''])
  ].join('\n').trimEnd();
  if (contents.length > 23500) throw new Error(`${project.project_id}: context exceeds 23500 characters`);
  return { contents, digest, snapshot };
}
for (const project of selected) {
  const snapshot = project.source.kind === 'git_snapshot' ? gitSnapshot(project) : project.source.kind === 'git_reference' ? referenceSnapshot(project) : documentSnapshot(project);
  const context = build(project, snapshot);
  const output = path.join(root, 'services/agent-office/project-contexts', `${project.project_id}.md`);
  fs.writeFileSync(output, `${context.contents}\n`);
  console.log(JSON.stringify({ project_id: project.project_id, output, kind: snapshot.kind, repository: snapshot.repository, revision: snapshot.revision, files: snapshot.sections.length, digest: context.digest, characters: context.contents.length }));
}
