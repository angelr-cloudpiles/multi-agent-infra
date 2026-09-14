import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repository = process.env.TATTOO_STUDIO_REPOSITORY;
const output = process.env.TATTOO_STUDIO_CONTEXT_OUTPUT || path.resolve('services/agent-office/project-contexts/tattoo-studio.md');
if (!repository) throw new Error('Set TATTOO_STUDIO_REPOSITORY to a clean checkout.');

const git = (...args) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD');
const origin = git('remote', 'get-url', 'origin');
const branch = git('branch', '--show-current');
const readAtRevision = (file) => execFileSync('git', ['-C', repository, 'show', `${revision}:${file}`], { encoding: 'utf8' });
const excerpt = (file, limit, fromLine = 1, toLine = Infinity) => {
  const text = readAtRevision(file).split('\n').slice(fromLine - 1, toLine).join('\n').trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}\n…[excerpt truncated]` : text;
};
const files = [
  ['README.md', 3200],
  ['package.json', 1200],
  ['src/config.ts', 900],
  ['src/api.ts', 5500, 160, 350],
  ['main.tf', 5200, 1, 145],
  ['tests/test_async_image_jobs.py', 2200],
  ['docs/operacion-produccion.md', 1600]
];
const sections = files.map(([file, limit, fromLine, toLine]) => ({
  file,
  content: excerpt(file, limit, fromLine, toLine),
  sha256: createHash('sha256').update(readAtRevision(file)).digest('hex')
}));
const digest = createHash('sha256').update(sections.map(({ file, sha256 }) => `${file}:${sha256}`).join('\n')).digest('hex');
const content = [
  '# Contexto de Tattoo Studio',
  '',
  'Este paquete es una instantánea de código fuente de solo lectura para Agent Office. No concede acceso al checkout, credenciales, AWS, CI/CD ni datos de clientes.',
  '',
  '## Procedencia verificable',
  `- Repositorio: ${origin}`,
  `- Revisión: ${revision}`,
  `- Rama de origen: ${branch || 'detached'}`,
  '- Fuente: contenido versionado en Git; los cambios locales sin commit se excluyen.',
  `- Integridad del paquete: sha256:${digest}`,
  '',
  '## Límites obligatorios',
  '- Analiza sólo estas fuentes y declara cualquier dato no disponible.',
  '- No ejecutes mutaciones, despliegues, operaciones sobre AWS, CI/CD ni datos de clientes.',
  '- No afirmes que cambiaste archivos. Para una modificación, entrega una propuesta o diff revisable que otro flujo aplique en un worktree.',
  '',
  ...sections.flatMap(({ file, sha256, content }) => [`## ${file}`, `SHA-256: ${sha256}`, '```text', content, '```', ''])
].join('\n').trimEnd();
if (content.length > 23500) throw new Error(`Context exceeds Agent Office limit: ${content.length} characters.`);
fs.writeFileSync(output, `${content}\n`);
console.log(JSON.stringify({ output, repository: origin, revision, digest, characters: content.length }));
