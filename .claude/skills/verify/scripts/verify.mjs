#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(SKILL_DIR, '../../..');
const STATE_DIR = join(REPO, '.verify');
const INSTANCE_FILE = join(STATE_DIR, 'instance.json');
const LOG_FILE = join(STATE_DIR, 'vite.log');
const EVIDENCE_ROOT = join(STATE_DIR, 'evidence');

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 900 },
};

const commands = { launch, doctor, run, cleanup };
const [command, ...rest] = process.argv.slice(2);

if (!commands[command]) {
  console.error(
    'usage: verify.mjs launch | doctor | run <journey> [--viewport phone|desktop] [--headed] | cleanup',
  );
  process.exit(2);
}
await commands[command](rest);

function readInstance() {
  if (!existsSync(INSTANCE_FILE)) return null;
  return JSON.parse(readFileSync(INSTANCE_FILE, 'utf8'));
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

function gitHead() {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO }).toString().trim();
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

async function launch() {
  const existing = readInstance();
  if (existing && isAlive(existing.pid)) {
    console.log(
      `already running: ${existing.url} (pid ${existing.pid}). Run doctor, or cleanup first.`,
    );
    return;
  }
  if (!existsSync(join(REPO, 'node_modules/vite/bin/vite.js'))) {
    console.error('node_modules is missing. Run `pnpm install` at the repo root.');
    process.exit(1);
  }

  mkdirSync(STATE_DIR, { recursive: true });
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const log = openSync(LOG_FILE, 'w');
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
    { cwd: REPO, detached: true, stdio: ['ignore', log, log] },
  );
  child.unref();

  const instance = {
    pid: child.pid,
    port,
    url,
    repo: REPO,
    head: gitHead(),
    startedAt: new Date().toISOString(),
  };
  writeFileSync(INSTANCE_FILE, JSON.stringify(instance, null, 2));

  await waitFor(
    async () => {
      if (!isAlive(child.pid)) throw new Error(`vite exited during launch, see ${LOG_FILE}`);
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
    await page.goto(url);
    await page.getByTestId('workspace').waitFor({ timeout: 30_000 });
  } finally {
    await browser.close();
  }

  console.log(`ready: ${url} (pid ${child.pid}, head ${instance.head})`);
  console.log(`log: ${LOG_FILE}`);
}

async function doctor() {
  const instance = readInstance();
  const checks = [];
  const record = (name, ok, detail) => checks.push({ name, ok, detail });

  if (!instance) {
    console.log('FAIL instance: no .verify/instance.json. Run launch.');
    process.exit(1);
  }

  record('process alive', isAlive(instance.pid), `pid ${instance.pid}`);

  let listener = '';
  try {
    listener = execFileSync('lsof', ['-nP', `-iTCP:${instance.port}`, '-sTCP:LISTEN', '-t'])
      .toString()
      .trim();
  } catch {
    listener = '';
  }
  record(
    'port owned by our vite',
    listener.split('\n').includes(String(instance.pid)),
    `port ${instance.port} -> ${listener || 'nobody'}`,
  );

  let cwd = '';
  try {
    cwd =
      execFileSync('lsof', ['-a', '-p', String(instance.pid), '-d', 'cwd', '-Fn'])
        .toString()
        .split('\n')
        .find((line) => line.startsWith('n'))
        ?.slice(1) ?? '';
  } catch {
    cwd = '';
  }
  record('serving this checkout', cwd === REPO, cwd || 'unknown cwd');

  try {
    const html = await (await fetch(instance.url)).text();
    record('index served', html.includes('id="root"'), instance.url);
    const entry = await fetch(new URL('src/main.tsx', instance.url));
    record('app entry compiles', entry.ok, `src/main.tsx -> ${entry.status}`);
  } catch (error) {
    record('index served', false, String(error));
  }

  const head = gitHead();
  record(
    'same commit as launch',
    head === instance.head,
    `launched ${instance.head}, now ${head} (vite serves the working tree either way)`,
  );

  for (const { name, ok, detail } of checks)
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`);
  const blocking = checks.filter((c) => !c.ok && c.name !== 'same commit as launch');
  process.exit(blocking.length ? 1 : 0);
}

function parseRunArgs(args) {
  const options = { viewport: 'phone', headed: false, journey: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--viewport') options.viewport = args[++i];
    else if (args[i] === '--headed') options.headed = true;
    else options.journey = args[i];
  }
  if (!options.journey)
    throw new Error('run needs a journey: a name in journeys/ or a path to a .mjs file');
  if (!VIEWPORTS[options.viewport]) throw new Error(`unknown viewport ${options.viewport}`);
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
  const instance = readInstance();
  if (!instance || !isAlive(instance.pid)) {
    console.error('no live instance. Run launch first.');
    process.exit(1);
  }

  const journeyPath = resolveJourney(options.journey);
  const journeyName = journeyPath
    .split('/')
    .pop()
    .replace(/\.mjs$/, '');
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${journeyName}-${options.viewport}`;
  const dir = join(EVIDENCE_ROOT, runId);
  mkdirSync(dir, { recursive: true });

  const browser = await launchBrowser(options.headed);
  const context = await browser.newContext({
    viewport: VIEWPORTS[options.viewport],
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];
  page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('request', (req) => {
    const host = new URL(req.url()).host;
    if (host !== `127.0.0.1:${instance.port}` && !req.url().startsWith('data:'))
      externalRequests.push(`${req.method()} ${req.url()}`);
  });

  const steps = [];
  let shotIndex = 0;
  const shot = async (name) => {
    const file = `${String(++shotIndex).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: join(dir, file), fullPage: true });
    return file;
  };
  const aria = async (name, locator = page.locator('body')) => {
    const file = `${name}.aria.yml`;
    writeFileSync(join(dir, file), await locator.ariaSnapshot());
    return file;
  };
  const save = (name, contents) => writeFileSync(join(dir, name), contents);
  const storage = () =>
    page.evaluate(() =>
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
    await page.goto(instance.url);
    await page.getByTestId('workspace').waitFor();
    const { default: journey } = await import(pathToFileURL(journeyPath).href);
    await journey({
      page,
      step,
      shot,
      aria,
      save,
      storage,
      assert,
      evidenceDir: dir,
      url: instance.url,
    });
    assert.deepEqual(pageErrors, [], 'no uncaught page errors');
  } catch (error) {
    status = 'failed';
    failure = String(error.stack ?? error);
  } finally {
    await context.tracing.stop({ path: join(dir, 'trace.zip') });
    await browser.close();
  }

  const report = {
    journey: journeyName,
    viewport: options.viewport,
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
  console.log(`${status.toUpperCase()} ${journeyName} (${options.viewport})`);
  if (failure) console.log(failure);
  console.log(`evidence: ${dir}`);
  process.exit(status === 'passed' ? 0 : 1);
}

async function cleanup() {
  const instance = readInstance();
  if (instance && isAlive(instance.pid)) {
    process.kill(-instance.pid, 'SIGTERM');
    await waitFor(async () => !isAlive(instance.pid), 10_000, `pid ${instance.pid} to exit`).catch(
      () => process.kill(-instance.pid, 'SIGKILL'),
    );
    console.log(`stopped vite pid ${instance.pid}`);
  } else {
    console.log('no live instance');
  }
  rmSync(INSTANCE_FILE, { force: true });
  rmSync(LOG_FILE, { force: true });
  console.log(`evidence kept in ${EVIDENCE_ROOT}`);
}
