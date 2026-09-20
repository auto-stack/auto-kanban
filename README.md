# auto-kanban

**AutoOS 首个真实 app**（[auto-os](../auto-os) 伞形登记，Plan 579 创建 /
PLAN-021 双模式）——配置驱动的通用看板，**双模式**：只读计划板 +
手动普通看板。

## 定位

- **通用看板**：看板类型由配置注册（`boards.json`），计划看板只是 v1 的
  首个类型；未来新看板类型 = 新 source 模块（`src/back/sources/`）+ 一条
  配置条目，核心零改动。
- **双模式（模式 = 板 = kind）**：`lang_plans` 只读板 + `manual` 手动板，
  header 一键切换；写操作**仅作用于 manual 板的独立数据文件**
  （`data/manual.json`，可被 `AUTO_KANBAN_DATA` 覆盖），lang_plans 源
  仍禁写——auto-lang 计划的状态翻转归 auto-plan 四技能所有。
- **手动普通看板**：卡片全生命周期——快速添加、编辑（标题/多行详情/
  P0-P2 优先级）、◀▶ 列移动 + ▲▼ 排序、两击删除确认、Vue 拖拽增强；
  三列 待办/进行中/完成，数据落盘重启即恢复。
- **v1 计划板（lang_plans）**：扫描 auto-lang `docs/plans/*.md` +
  `docs/plans/archive/*.md` 的 YAML frontmatter，按五态状态机
  （drafting → executing → execution_done → reviewed → archived）映射
  看板列；卡片显示 plan_id / 标题 / current_step 进度 / updated_at。

## 数据源解析序（与 auto-os AGENTS.md §2 一致，永不建链接）

每看板条目的 `root_env` 声明环境变量名（默认板为 `AUTO_LANG_ROOT`）：

```
1. $AUTO_LANG_ROOT（或该板 root_env 指定的变量）
2. ../auto-lang（相对运行目录的兄弟检出）
3. D:/autostack/auto-lang（主检出）
```

全段落空 → 界面显示空态引导文案。

## 运行

```bash
# Vue 轨（vite :17100 → proxy :17101）
auto run

# VM 轨（iced 桌面端）
auto run -r vm
```

## 看板注册（boards.json）

```json
{ "boards": [
  { "id": "lang-plans", "title": "计划", "kind": "lang_plans", "root_env": "AUTO_LANG_ROOT" },
  { "id": "manual", "title": "普通看板", "kind": "manual", "root_env": "" }
] }
```

配置路径可被 `AUTO_KANBAN_BOARDS` 环境变量覆盖（测试用它指向 fixture）。
manual 板数据文件默认 `data/manual.json`（相对运行 CWD），路径可被
`AUTO_KANBAN_DATA` 覆盖（测试用它注入 fixture 并隔离）。

## API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/boards` | 看板列表（读 boards.json） |
| GET | `/api/boards/:id/cards` | 该板卡片（泛化 Card[]）+ meta（source_root/scanned_at/计数） |
| POST | `/api/boards/:id/cards` | manual 板建卡（body: title/column；空标题拒创建） |
| PUT | `/api/boards/:id/cards/:cid` | manual 板编辑（body: title/detail/priority） |
| PUT | `/api/boards/:id/cards/:cid/move` | manual 板移动+排序（body: column/order，目标位插入+全列压紧） |
| DELETE | `/api/boards/:id/cards/:cid` | manual 板删卡 |

写端点仅对 kind=manual 的板生效（经 boards_registry 按 kind 分发，
lang_plans 板写请求落零卡/false）。

## VM / Vue 视觉一致（parity · PLAN-038）

普通看板与计划板 UI **单源**在 `src/front/*.at`。两端共用 AutoUI **核心**
语义 token：

`bg-background` `text-foreground` `bg-card` `bg-muted` `text-muted-foreground`
`border-border` `bg-primary` `text-primary` `text-primary-foreground`
`bg-secondary` `bg-destructive` `bg-accent` + 布局/字重 utility。

**Phase A 纪律（app 侧缺省）**：

- 本 app `.at` **缺省只用核心 token**（完成列 `text-muted-foreground` 降噪；
  P1 = `text-primary` + `bg-primary/10`；P0 仍 `destructive`）。
- `.at` **禁止** palette 硬编码（`bg-blue-500` 等）——VM 不翻色会与 Vue 分叉。
- **改 UI 只改 `.at`** → `auto build` 再生 Vue。`gen/front/vue` **不是长期源**
  （会被 codegen 覆载）。
- 根目录 `index.html` 为手机模拟器镜像：同一 token 结构 + 深浅主题 + 5 accent。

**Phase B（平台侧，PLAN-038 已落地）**：

auto-lang registry / auto-man 脚手架已补齐扩展功能色与 P657-D2 stub：

- `success` / `warning` / `info` / `error` 已进 scaffold/cli-vue/tauri 的
  `index.css` CSS 变量与 `tailwind.config.cjs` 映射（值与 VM stella 同源）。
- `auto build` 全路径写 `src/vite-env.d.ts` + `src/auto-select/overlay.ts`
  + `src/auto-sources.ts`（不再依赖手工 stub）。
- 此后 `.at` **可以**安全使用扩展 token（如 `text-success`）；本 app 缺省
  仍沿 Phase A 中性映射，直到产品侧决定恢复。

| 轨 | 入口 | 说明 |
|---|---|---|
| Vue | `auto run` → `gen/front/vue` | codegen 自 `.at` |
| VM | `auto run -r vm` | 同一 `.at` 经 Iced 解析同一 token 词表 |
| 手机模拟器 | 根目录 `index.html` | 镜像 `.at` 结构与核心 token |

## 测试

```bash
cd tests && npm install && npm test   # playwright，注入 fixture 数据源
```

## 结构

```
pac.at                    # app 清单（仓根 examples 形态）
boards.json               # 看板注册配置
src/front/                # app.at + boards_store.at + pages/board.at（双分支：
                          #   lang_plans 只读四列 / manual 手动三列）
src/back/                 # api.at（#[api] 端点）+ boards_registry.at（配置+kind 分发）
                          #   + lang_plans.at（只读适配器）+ manual_store.at（手动板
                          #   无状态文件后端：读 data/manual.json，变更全量重写）
tests/                    # playwright 套件 + testdata/ 合成语料
```

## 伞形归属

登记于 [auto-os](../auto-os) `apps.manifest`（id: kanban，ports 17100/17101）。
