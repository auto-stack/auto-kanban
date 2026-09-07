import { test, expect } from '@playwright/test';

// Plan 579 T15——P2 八测（fixture 语料：101 executing/102 drafting/
// 103 legacy parked/104 无步数 + 091/092 archived；双板配置）。

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // 等 store Init 完成（首卡出现或空态）
  await expect
    .poll(async () => page.getByText('PLAN-101').count(), { timeout: 15000 })
    .toBeGreaterThan(0);
});

test('T1 四列标题渲染', async ({ page }) => {
  await expect(page.getByText('Drafting', { exact: true })).toBeVisible();
  await expect(page.getByText('Executing', { exact: true })).toBeVisible();
  await expect(page.getByText('Execution Done', { exact: true })).toBeVisible();
  await expect(page.getByText('Reviewed', { exact: true })).toBeVisible();
});

test('T2 fixture 卡片计数', async ({ page }) => {
  // drafting 3（102/103/104）、executing 1（101）、reviewed 0、archived 2
  await expect(page.getByText('PLAN-101')).toBeVisible();
  await expect(page.getByText('PLAN-102')).toBeVisible();
  await expect(page.getByText('PLAN-103')).toBeVisible();
  await expect(page.getByText('PLAN-104')).toBeVisible();
  await expect(page.getByText('PLAN-091')).toHaveCount(0); // 折叠未展开
  await expect(page.getByText(/Archived · 2/)).toBeVisible();
});

test('T3 进度文本与空态 —', async ({ page }) => {
  await expect(page.getByText('3/7')).toBeVisible();   // PLAN-101
  await expect(page.getByText('0/5')).toBeVisible();   // PLAN-102
  await expect(page.getByText('—', { exact: true }).first()).toBeVisible(); // 103/104/091
});

test('T4 parked 徽章（legacy draft）', async ({ page }) => {
  const card103 = page.locator('div,button', { hasText: 'PLAN-103' }).last();
  await expect(page.getByText('parked', { exact: true })).toBeVisible();
});

test('T5 archived 折叠展开', async ({ page }) => {
  await page.getByRole('button', { name: '▸' }).click();
  await expect(page.getByText('PLAN-091')).toBeVisible();
  await expect(page.getByText('PLAN-092')).toBeVisible();
});

test('T6 刷新按钮重载', async ({ page }) => {
  await page.getByRole('button', { name: '↻ 刷新' }).click();
  await expect
    .poll(async () => page.getByText('PLAN-101').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
});

test('T7 零 console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.reload();
  await expect
    .poll(async () => page.getByText('PLAN-101').count(), { timeout: 15000 })
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('T8 配置驱动：双板切换', async ({ page }) => {
  // boards.test.json 两板 → 两按钮
  const b1 = page.getByRole('button', { name: '计划', exact: true });
  const b2 = page.getByRole('button', { name: '计划二号', exact: true });
  await expect(b1).toBeVisible();
  await expect(b2).toBeVisible();
  // 切到二号板：同 kind 同 root，卡片可拉、头部标题更新
  await b2.click();
  await expect
    .poll(async () => page.getByText('PLAN-101').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
  await expect(page.getByText('计划二号', { exact: true }).first()).toBeVisible();
});
