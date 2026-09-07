// run.mjs — Plan 579 T15 测试编排器：起服（fixture env）→ 双口就绪 →
// playwright → taskkill /T 杀整树（Windows 子进程树孤儿化对策）。
import { spawn, execSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const FRONT = 17100, BACK = 17101;

// vite 只绑 [::1]——host 用 localhost 让解析跟系统走；探测=主动 connect。
function portOpen(port) {
  return new Promise((res) => {
    const sock = connect({ port, host: 'localhost' }, () => { sock.destroy(); res(true); });
    sock.on('error', () => res(false));
  });
}

async function waitPort(port, label, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`端口 ${port}（${label}）在 ${ms}ms 内未就绪`);
}

async function main() {
  const env = {
    ...process.env,
    AUTO_LANG_ROOT: join(repoRoot, 'tests', 'testdata', 'fake-lang'),
    AUTO_KANBAN_BOARDS: join(repoRoot, 'tests', 'testdata', 'boards', 'boards.test.json'),
  };
  const child = spawn('auto', ['run', '--server', 'vm', '-B', String(BACK), '-F', String(FRONT)], {
    cwd: repoRoot,
    env,
    stdio: 'ignore',
    shell: true,
    detached: true,
  });
  child.unref();
  let code = 1;
  try {
    await waitPort(BACK, 'AutoVM API', 90000);
    await waitPort(FRONT, 'vite 前端', 90000);
    // API 语义就绪（端口通≠路由活）
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      try {
        const r = await fetch(`http://localhost:${BACK}/api/boards`);
        if (r.ok) break;
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log('[run.mjs] servers ready, launching playwright...');
    code = await new Promise((res) => {
      const pw = spawn('npx', ['playwright', 'test'], { cwd: __dirname, stdio: 'inherit', shell: true });
      pw.on('exit', (c) => res(c ?? 1));
    });
  } finally {
    try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch { /* already gone */ }
  }
  process.exit(code);
}

main().catch((e) => { console.error('[run.mjs]', e.message); process.exit(1); });
