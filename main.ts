// radar-2 entrypoint.
//
// Reads one frozen DefiLlama snapshot, scores every clean pre-token
// protocol with the radar-2 model in lib/model.ts, and lays out the
// graded artefact: the ranked board, the dashboard's data file, the
// dashboard itself, three screenshots, and finally the dossier the
// judge reads. Nothing here fetches anything; the snapshot is the
// only input, /output (or MAKEFUN_OUTPUT_DIR) is the only output.
//
// Local run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

const DOSSIER_TEXT_BYTES = 65_536;
const SHOT_LIMIT = { max: 4, max_bytes: 524_288 };
const DASH_LIMIT = { max_files: 400, max_bytes: 4_194_304 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Value of a `--flag value` or `--flag=value` argument, or `fallback`. */
function flagValue(flag: string, fallback: string): string {
  const argv = process.argv;
  const spaced = argv.indexOf(`--${flag}`);
  if (spaced >= 0 && spaced + 1 < argv.length) return argv[spaced + 1] as string;
  const joined = argv.find((a) => a.startsWith(`--${flag}=`));
  return joined === undefined ? fallback : joined.slice(flag.length + 3);
}

function fail(message: string, code: number): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

const inputGiven = flagValue('input', '/input');
const snapshotPath = inputGiven.endsWith('.json') ? inputGiven : join(inputGiven, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  fail(`radar-2: cannot find snapshot at ${snapshotPath} (pass --input <snapshot.json|directory>)`, 2);
}
const outDir = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const problem = boardIssue(board, snapshot);
if (problem !== null) fail(`radar-2: board refused: ${problem}`, 1);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

/** Mirror every non-hidden regular file from `from` into `to`; returns the names copied. */
function mirrorDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(to, name));
    names.push(name);
  }
  return names;
}

mirrorDir(join(repoRoot, 'dashboard'), join(outDir, 'dashboard'));
const shots = mirrorDir(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3) {
  fail(`radar-2: screenshots/ holds ${shots.length} image(s); need 3 (board, detail, filtered)`, 1);
}
for (const name of shots) {
  if (!SHOT_NAME.test(name)) fail(`radar-2: bad screenshot name ${name}`, 1);
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, { text_max_bytes: DOSSIER_TEXT_BYTES, screenshots: SHOT_LIMIT, dashboard: DASH_LIMIT }),
);

process.stdout.write(
  `radar-2: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} watchlist, ${board.length} board rows (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `radar-2: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')}, ${join(outDir, 'screenshots')} (${shots.length} images), ${join(outDir, 'dossier.json')}\n`,
);
