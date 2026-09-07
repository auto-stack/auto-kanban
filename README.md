# auto-kanban

**AutoOS 首个真实 app**（[auto-os](../auto-os) 伞形登记，Plan 579）——
配置驱动的通用**只读**看板。

## 定位

- **通用看板**：看板类型由配置注册（`boards.json`），计划看板只是 v1 的
  首个类型；未来新看板类型 = 新 source 模块（`src/back/sources/`）+ 一条
  配置条目，核心零改动。
- **只读仪表盘**：不做写回——auto-lang 计划的状态翻转归 auto-plan 四技能
  所有，本 app 只是把"人工 git grep 盘点状态"这个动作产品化。
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
  { "id": "lang-plans", "title": "计划", "kind": "lang_plans", "root_env": "AUTO_LANG_ROOT" }
] }
```

配置路径可被 `AUTO_KANBAN_BOARDS` 环境变量覆盖（测试用它指向 fixture）。

## API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/boards` | 看板列表（读 boards.json） |
| GET | `/api/boards/:id/cards` | 该板卡片（泛化 Card[]）+ meta（source_root/scanned_at/计数） |

## 测试

```bash
cd tests && npm install && npm test   # playwright，注入 fixture 数据源
```

## 结构

```
pac.at                    # app 清单（仓根 examples 形态）
boards.json               # 看板注册配置
src/front/                # app.at + boards_store.at + pages/board.at
src/back/                 # api.at（#[api] 端点）+ boards_registry.at（配置+kind 分发）
                          #   + sources/lang_plans.at（首个看板类型适配器）
tests/                    # playwright 套件 + testdata/ 合成语料
```

## 伞形归属

登记于 [auto-os](../auto-os) `apps.manifest`（id: kanban，ports 17100/17101）。
