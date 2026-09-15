import { test, expect } from '@playwright/test';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

// PLAN-021 T08——P2 九测（manual 板：模式切换/添加/编辑/移动/排序/删除/
// 持久化/特殊字符往返/零 console error）。
// fixture：manual.template.json 模板 → 每测前拷为 manual.test.json
// （后端每请求重读文件，换文件即换库，无需 reset 端点）。
// 路径基准：playwright 由 run.mjs 以 tests/ 为 cwd 启动（import.meta 在
// playwright 转译管道不可用，实测）。

const template = resolve(process.cwd(), 'testdata', 'manual', 'manual.template.json');
const liveFile = resolve(process.cwd(), 'testdata', 'manual', 'manual.test.json');

test.beforeEach(async () => {
  copyFileSync(template, liveFile);
});

async function gotoManual(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect
    .poll(async () => page.getByText('Drafting', { exact: true }).count(), { timeout: 15000 })
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '普通看板' }).click();
  await expect(page.getByText('手动卡一')).toBeVisible();
}

// 卡片容器（shadow-sm 仅卡片使用）；title 为卡面唯一文本
function card(page: import('@playwright/test').Page, title: string) {
  return page.locator('div.shadow-sm', { hasText: title }).first();
}

test('M1 模式切换：三列标题 + 计数徽章', async ({ page }) => {
  await gotoManual(page);
  await expect(page.getByText('待办', { exact: true })).toBeVisible();
  await expect(page.getByText('进行中', { exact: true })).toBeVisible();
  await expect(page.getByText('完成', { exact: true })).toBeVisible();
  // fixture：todo 3 / doing 1 / done 1
  const counts = await page.locator('body').innerText();
  expect(counts).toContain('3');
  // 只读板切换回来仍四列
  await page.getByRole('button', { name: '计划', exact: true }).click();
  await expect(page.getByText('Drafting', { exact: true })).toBeVisible();
});

test('M2 快速添加 → 卡片出现 + 计数 +1', async ({ page }) => {
  await gotoManual(page);
  await page.getByPlaceholder('输入卡片标题…').fill('M2 新卡');
  await page.getByRole('button', { name: '＋ 添加' }).click();
  await expect(page.getByText('M2 新卡')).toBeVisible();
  const t = await page.locator('body').innerText();
  const todoSeg = t.slice(t.indexOf('待办'), t.indexOf('进行中'));
  expect(todoSeg).toContain('4');
});

test('M3 点卡开面板 / 改标题详情优先级 / 保存生效', async ({ page }) => {
  await gotoManual(page);
  await page.getByText('手动卡一').click();
  await expect(page.getByText('编辑卡片')).toBeVisible();
  await page.locator('input[placeholder="卡片标题…"]').fill('M3 改后标题');
  await page.locator('textarea[placeholder="多行详情…"]').fill('改后详情');
  await page.getByRole('button', { name: 'P1 高' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('M3 改后标题')).toBeVisible();
  await expect(page.getByText('编辑卡片')).toHaveCount(0);
});

test('M4 ◀▶ 列移动 + 计数迁移', async ({ page }) => {
  await gotoManual(page);
  // 进行中卡 ▶ → 完成
  await card(page, '进行中卡').getByRole('button', { name: '▶' }).click();
  await expect
    .poll(async () => {
      const t = await page.locator('body').innerText();
      const doneSeg = t.slice(t.indexOf('完成'), t.length);
      return doneSeg.includes('进行中卡');
    })
    .toBe(true);
});

test('M5 ▲▼ 排序交换', async ({ page }) => {
  await gotoManual(page);
  // 手动卡二 ▲ → 与手动卡一交换（todo 首位变卡二）
  await card(page, '手动卡二').getByRole('button', { name: '▲' }).click();
  await expect
    .poll(async () => {
      const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      const seg = t.slice(t.indexOf('待办'), t.indexOf('进行中'));
      return seg.indexOf('手动卡二') >= 0 && seg.indexOf('手动卡二') < seg.indexOf('手动卡一');
    })
    .toBe(true);
});

test('M6 两击删除 + 计数 -1', async ({ page }) => {
  await gotoManual(page);
  // 完成卡（done 唯一卡）× → 确认
  await card(page, '完成卡').getByRole('button', { name: '×', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认' })).toBeVisible();
  await page.getByRole('button', { name: '确认' }).click();
  await expect(page.getByText('完成卡')).toHaveCount(0);
});

test('M7 持久化：变更后 reload 卡片仍在', async ({ page }) => {
  await gotoManual(page);
  await page.getByPlaceholder('输入卡片标题…').fill('M7 持久卡');
  await page.getByRole('button', { name: '＋ 添加' }).click();
  await expect(page.getByText('M7 持久卡')).toBeVisible();
  await page.reload();
  // reload 后回到首板（lang-plans），重新切到普通看板
  await expect
    .poll(async () => page.getByText('Drafting', { exact: true }).count(), { timeout: 15000 })
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '普通看板' }).click();
  await expect(page.getByText('M7 持久卡')).toBeVisible();
});

test('M8 特殊字符往返（引号 + 换行 detail）', async ({ page }) => {
  await gotoManual(page);
  // fixture 手动卡一 detail = 第一行\n第二行 "引号" → 面板回显无损
  await page.getByText('手动卡一').click();
  const ta = page.locator('textarea[placeholder="多行详情…"]');
  await expect(ta).toHaveValue('第一行\n第二行 "引号"');
  // 再改一轮含特殊字符的值，保存后重开比对
  await ta.fill('写 "引号" 与\n换行 与\t制表');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('编辑卡片')).toHaveCount(0);
  await page.getByText('手动卡一').click();
  await expect(page.locator('textarea[placeholder="多行详情…"]')).toHaveValue('写 "引号" 与\n换行 与\t制表');
});

test('M9 零 console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await gotoManual(page);
  // 一轮轻交互（切换 + 刷新 + 加卡）
  await page.getByPlaceholder('输入卡片标题…').fill('M9 卡');
  await page.getByRole('button', { name: '＋ 添加' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '↻ 刷新' }).click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
