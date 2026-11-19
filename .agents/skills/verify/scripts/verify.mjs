#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(SKILL_DIR, '../../..');
const STATE_DIR = join(REPO, '.verify');
const INSTANCE_DIR = join(STATE_DIR, 'instances');
const EVIDENCE_ROOT = join(STATE_DIR, 'evidence');
// Outside the repo, so Vitest, ESLint and tsc in this checkout never pick up the base's files.
const BASE_WORKTREE = join(
  realpathSync(tmpdir()),
  `split-verify-${createHash('sha1').update(REPO).digest('hex').slice(0, 8)}`,
  'base',
);

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// A wrong selector fails in 8s instead of Playwright's 30s.
const ACTION_TIMEOUT_MS = 8_000;

// `/` is the home screen; the receipt wizard every journey drives lives at /split.
const quickSplitUrl = (base) => new URL('split', base).href;

const VIEWPORTS = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: { viewport: { width: 1280, height: 900 } },
  wide: { viewport: { width: 1440, height: 900 } },
};

const USAGE = `usage:
  verify.mjs launch [--base [<ref>]]
  verify.mjs doctor
  verify.mjs run <journey> [--on head|base] [--viewport phone|desktop|wide|<W>x<H>] [--offline] [--headed]
  verify.mjs cleanup`;

const commands = { launch, doctor, run, cleanup };
const [command, ...rest] = process.argv.slice(2);

if (!commands[command]) {
  console.error(USAGE);
  process.exit(2);
}
await commands[command](rest);

function instanceFile(name) {
  return join(INSTANCE_DIR, `${name}.json`);
}

function readInstance(name) {
  const file = instanceFile(name);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readInstances() {
  if (!existsSync(INSTANCE_DIR)) return [];
  return readdirSync(INSTANCE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readInstance(f.replace(/\.json$/, '')));
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function git(args, cwd = REPO) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${label}`);
}

async function loadPlaywright() {
  try {
    return await import(pathToFileURL(join(REPO, 'node_modules/playwright/index.mjs')).href);
  } catch {
    console.error('playwright is not installed. Run `pnpm install` at the repo root.');
    process.exit(1);
  }
}

async function launchBrowser(headed = false) {
  const { chromium } = await loadPlaywright();
  try {
    return await chromium.launch({ headless: !headed });
  } catch (error) {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    console.error('Chromium is missing. Run `pnpm exec playwright install chromium`.');
    process.exit(1);
  }
}

function parseLaunchArgs(args) {
  const i = args.indexOf('--base');
  if (i === -1) return { name: 'head', ref: null };
  const ref = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
  return { name: 'base', ref };
}

// The "before" for a branch is where it left main on the remote: local main is often stale.
function resolveBaseRef(ref) {
  if (ref) return git(['rev-parse', '--verify', `${ref}^{commit}`]);
  try {
    git(['fetch', '--quiet', 'origin', 'main']);
  } catch {
    console.warn('could not fetch origin/main; using the last fetched copy');
  }
  return git(['merge-base', 'HEAD', 'origin/main']);
}

function prepareBaseWorktree(sha) {
  if (existsSync(BASE_WORKTREE)) git(['worktree', 'remove', '--force', BASE_WORKTREE]);
  mkdirSync(dirname(BASE_WORKTREE), { recursive: true });
  git(['worktree', 'add', '--detach', BASE_WORKTREE, sha]);
  console.log(`base worktree: ${BASE_WORKTREE} at ${sha.slice(0, 7)}; installing deps`);
  execFileSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], {
    cwd: BASE_WORKTREE,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

async function launch(args) {
  const { name, ref } = parseLaunchArgs(args);
  const existing = readInstance(name);
  if (existing && isAlive(existing.pid)) {
    console.log(
      `${name} already running: ${existing.url} (pid ${existing.pid}). Run doctor, or cleanup first.`,
    );
    return;
  }

  let root = REPO;
  let head = git(['rev-parse', '--short', 'HEAD']);
  if (name === 'base') {
    const sha = resolveBaseRef(ref);
    prepareBaseWorktree(sha);
    root = BASE_WORKTREE;
    head = sha.slice(0, 7);
  }
  if (!existsSync(join(root, 'node_modules/vite/bin/vite.js'))) {
    console.error(`node_modules is missing in ${root}. Run \`pnpm install\` there.`);
    process.exit(1);
  }

  mkdirSync(INSTANCE_DIR, { recursive: true });
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const logFile = join(STATE_DIR, `${name}.vite.log`);
  const log = openSync(logFile, 'w');
  const child = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: root, detached: true, stdio: ['ignore', log, log] },
  );
  child.unref();

  const instance = {
    name,
    pid: child.pid,
    port,
    url,
    root,
    head,
    logFile,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(instanceFile(name), JSON.stringify(instance, null, 2));

  await waitFor(
    async () => {
      if (!isAlive(child.pid)) throw new Error(`vite exited during launch, see ${logFile}`);
      try {
        return (await fetch(url)).ok;
      } catch {
        return false;
      }
    },
    30_000,
    'vite to answer',
  );

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(quickSplitUrl(url));
    await page.getByTestId('workspace').waitFor({ timeout: 30_000 });
  } finally {
    await browser.close();
  }

  console.log(`ready: ${name} ${url} (pid ${child.pid}, head ${head})`);
  console.log(`log: ${logFile}`);
}

async function checkInstance(instance) {
  const checks = [];
  const record = (name, ok, detail) => checks.push({ name, ok, detail });
  record('process alive', isAlive(instance.pid), `pid ${instance.pid}`);

  try {
    // Vite's /@fs/ route only serves files inside its own root, so a Vite started in
    // another checkout answers 403 here. Launch used --strictPort, so while our pid is
    // alive nothing else can hold the port.
    const own = await fetch(new URL(`@fs${join(instance.root, 'package.json')}`, instance.url));
    record('serving its checkout', own.ok, `/@fs${instance.root}/package.json -> ${own.status}`);
    const html = await (await fetch(instance.url)).text();
    record('index served', html.includes('id="root"'), instance.url);
    const entry = await fetch(new URL('src/main.tsx', instance.url));
    record('app entry compiles', entry.ok, `src/main.tsx -> ${entry.status}`);
  } catch (error) {
    record('server answers', false, `port ${instance.port}: ${error.cause?.code ?? error}`);
  }

  const now = git(['rev-parse', '--short', 'HEAD'], instance.root);
  record(
    'same commit as launch',
    now.startsWith(instance.head) || instance.head.startsWith(now),
    `launched ${instance.head}, now ${now} (vite serves the working tree either way)`,
  );
  return checks;
}

async function doctor() {
  const instances = readInstances();
  if (!instances.length) {
    console.log('FAIL instance: nothing launched from this checkout. Run launch.');
    process.exit(1);
  }
  let blocking = 0;
  for (const instance of instances) {
    for (const { name, ok, detail } of await checkInstance(instance)) {
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${instance.name}: ${name}: ${detail}`);
      if (!ok && name !== 'same commit as launch') blocking++;
    }
  }
  process.exit(blocking ? 1 : 0);
}

function parseViewport(name) {
  if (VIEWPORTS[name]) return VIEWPORTS[name];
  const custom = /^(\d+)x(\d+)$/.exec(name);
  if (custom) return { viewport: { width: Number(custom[1]), height: Number(custom[2]) } };
  throw new Error(`unknown viewport ${name}: use phone, desktop, wide or <W>x<H>`);
}

function parseRunArgs(args) {
  const options = { viewport: 'phone', on: 'head', headed: false, offline: false, journey: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--viewport') options.viewport = args[++i];
    else if (args[i] === '--on') options.on = args[++i];
    else if (args[i] === '--headed') options.headed = true;
    else if (args[i] === '--offline') options.offline = true;
    else options.journey = args[i];
  }
  if (!options.journey)
    throw new Error('run needs a journey: a name in journeys/ or a path to a .mjs file');
  parseViewport(options.viewport);
  return options;
}

function resolveJourney(name) {
  const candidates = [
    isAbsolute(name) ? name : resolve(process.cwd(), name),
    join(SKILL_DIR, 'journeys', name),
    join(SKILL_DIR, 'journeys', `${name}.mjs`),
  ];
  const found = candidates.find((path) => existsSync(path) && path.endsWith('.mjs'));
  if (!found) throw new Error(`journey not found: ${name}`);
  return found;
}

async function run(args) {
  const options = parseRunArgs(args);
  const instance = readInstance(options.on);
  if (!instance || !isAlive(instance.pid)) {
    console.error(
      `no live ${options.on} instance. Run launch${options.on === 'base' ? ' --base' : ''} first.`,
    );
    process.exit(1);
  }

  const journeyPath = resolveJourney(options.journey);
  const journeyName = journeyPath
    .split('/')
    .pop()
    .replace(/\.mjs$/, '');
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${journeyName}-${options.viewport}-${options.on}`;
  const dir = join(EVIDENCE_ROOT, runId);
  mkdirSync(dir, { recursive: true });

  const appHost = `127.0.0.1:${instance.port}`;
  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];
  const browser = await launchBrowser(options.headed);

  const contextOptions = {
    ...parseViewport(options.viewport),
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  };
  const openContext = async (label) => {
    const context = await browser.newContext(contextOptions);
    context.setDefaultTimeout(ACTION_TIMEOUT_MS);
    context.setDefaultNavigationTimeout(30_000);
    if (options.offline)
      await context.route(
        // Icons are a Google Fonts ligature font; without it they render as words.
        (url) => ![appHost, ...FONT_HOSTS].includes(url.host),
        (route) => route.abort('internetdisconnected'),
      );
    const page = await context.newPage();
    page.on(
      'console',
      (msg) => msg.type() === 'error' && consoleErrors.push(`${label}: ${msg.text()}`),
    );
    page.on('pageerror', (error) => pageErrors.push(`${label}: ${error}`));
    page.on('request', (req) => {
      const host = new URL(req.url()).host;
      if (host !== appHost && !req.url().startsWith('data:'))
        externalRequests.push(`${label}: ${req.method()} ${req.url()}`);
    });
    return { context, page };
  };

  const main = await openContext('main');
  const { page } = main;
  await main.context.tracing.start({ screenshots: true, snapshots: true });

  const profiles = [];
  // A second person: a separate browser profile with its own localStorage, on the same app.
  const profile = async () => {
    const opened = await openContext(`profile${profiles.length + 2}`);
    profiles.push(opened);
    await opened.page.goto(quickSplitUrl(instance.url));
    await opened.page.getByTestId('workspace').waitFor();
    return opened.page;
  };

  const steps = [];
  let shotIndex = 0;
  const shot = async (name, target = page) => {
    const file = `${String(++shotIndex).padStart(2, '0')}-${name}.png`;
    // The pointer rests on the last thing clicked; its hover style is not part of the result.
    await target.mouse.move(0, 0).catch(() => {});
    await target.evaluate(() => document.fonts.ready);
    await target.screenshot({ path: join(dir, file), fullPage: true, animations: 'disabled' });
    return file;
  };
  const aria = async (name, locator = page.locator('body')) => {
    const file = `${name}.aria.yml`;
    writeFileSync(join(dir, file), await locator.ariaSnapshot());
    return file;
  };
  const save = (name, contents) => writeFileSync(join(dir, name), contents);
  const storage = (target = page) =>
    target.evaluate(() =>
      Object.fromEntries(
        Object.keys(localStorage).map((k) => [k, JSON.parse(localStorage.getItem(k))]),
      ),
    );
  const step = async (label, fn) => {
    const startedAt = Date.now();
    try {
      const result = await fn();
      steps.push({
        label,
        ok: true,
        ms: Date.now() - startedAt,
        shot: await shot(label.replace(/\W+/g, '-').toLowerCase()),
      });
      console.log(`ok   ${label}`);
      return result;
    } catch (error) {
      steps.push({
        label,
        ok: false,
        ms: Date.now() - startedAt,
        error: String(error),
        shot: await shot('failure').catch(() => null),
      });
      console.log(`FAIL ${label}: ${error.message}`);
      throw error;
    }
  };

  let status = 'passed';
  let failure = null;
  try {
    await page.goto(quickSplitUrl(instance.url));
    await page.getByTestId('workspace').waitFor();
    const { default: journey } = await import(pathToFileURL(journeyPath).href);
    await journey({
      page,
      step,
      shot,
      aria,
      save,
      storage,
      profile,
      assert,
      evidenceDir: dir,
      url: instance.url,
    });
    assert.deepEqual(pageErrors, [], 'no uncaught page errors');
  } catch (error) {
    status = 'failed';
    failure = String(error.stack ?? error);
  } finally {
    await main.context.tracing.stop({ path: join(dir, 'trace.zip') });
    await browser.close();
  }

  const report = {
    journey: journeyName,
    on: options.on,
    viewport: options.viewport,
    offline: options.offline,
    status,
    failure,
    url: instance.url,
    head: instance.head,
    steps,
    consoleErrors,
    pageErrors,
    externalRequests,
  };
  writeFileSync(join(dir, 'run.json'), JSON.stringify(report, null, 2));
  console.log(
    `${status.toUpperCase()} ${journeyName} (${options.viewport}, ${options.on} ${instance.head})`,
  );
  if (failure) console.log(failure);
  console.log(`evidence: ${dir}`);
  process.exit(status === 'passed' ? 0 : 1);
}

async function stop(instance) {
  if (!isAlive(instance.pid)) return console.log(`${instance.name}: not running`);
  process.kill(-instance.pid, 'SIGTERM');
  await waitFor(async () => !isAlive(instance.pid), 10_000, `pid ${instance.pid} to exit`).catch(
    () => process.kill(-instance.pid, 'SIGKILL'),
  );
  console.log(`${instance.name}: stopped vite pid ${instance.pid}`);
}

async function cleanup() {
  const instances = readInstances();
  if (!instances.length) console.log('no instances');
  for (const instance of instances) {
    await stop(instance);
    rmSync(instanceFile(instance.name), { force: true });
    rmSync(instance.logFile, { force: true });
  }
  if (existsSync(BASE_WORKTREE)) {
    git(['worktree', 'remove', '--force', BASE_WORKTREE]);
    console.log(`removed base worktree ${BASE_WORKTREE}`);
  }
  console.log(`evidence kept in ${EVIDENCE_ROOT}`);
}
