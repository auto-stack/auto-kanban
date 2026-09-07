import { defineConfig } from '@playwright/test';

// Plan 579 T15: 服务生命周期由 run.mjs 编排（spawn+双口轮询+taskkill /T 杀树）
// ——不用 playwright webServer：Windows 下其 teardown 只杀外壳，auto run
// 的子进程树（vite/VM 服务）会孤儿化挂死（实测）。
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:17100',
  },
});
