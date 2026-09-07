# VM 引擎 bug 复现器（Plan 579 T9 执行期发现，2026-09-07）

`auto` 二进制基线：`v0.4.1-4128-gecc27c81e-dirty`（auto-lang target/debug，
engine.rs 自该基线至当时 HEAD 零变更，Plan 567 的 string-concat read-after-FREE
修复 83ae4e9a6 已含在基线内——即以下为 master 现存问题）。

## Bug A：字符串池 heap_rc 失衡（体量触发型 tombstone panic）

**现象**：`[RC canary] string tombstone access: pool index NNNN was freed`
（engine.rs:1744，Plan 419 heap_rc 毒化 canary 捕获）。

**触发形状**：文件循环内 read_text → split → 逐行 trim/find/sub + 字符串
赋值向上（var/struct 字段/模块级 var 均试过）+ push 累积。**~55 文件/15 万+
池操作必炸；6 文件 fixture 幸存**——体量/池压触发，非特定语法。

**已排除**（对应探针）：struct 字段写（b1）、to_int（b2）、Card ctor/push
（b3）、break（a8）、fn 返回 struct（a5 反证：param/字面量源字段存活）、
模块级 var（repro4）、sub 语义误用（bfix2 修正后仍炸）。通过的退化形状：
纯计数/内联比较不向上赋值（a2，55 文件）。

| 复现器 | 内容 | 结果 |
|---|---|---|
| repro1-real-corpus-panic.at | 全保真扫描真实 auto-lang 55 文件 | ❌ tombstone panic |
| repro2-fixture6-pass.at | 同形状 6 文件 fixture | ✅ 6 卡全出 |
| repro4-modvar-panic.at | 模块级 var 形态（db.at 同型） | ❌ tombstone panic |

## Bug B：`sub` 语义文档/实现不符

master `stdlib/auto/str.at` 注记 (start, **LEN**)（Plan 446 F4），运行时实测
**(start, END 排他)**：`"hello".sub(1,3)` → 文档称 "ell"，实测 "el"（repro3）。
本 app 解析器按实测语义编写。

## Bug C：JsonValue 元素上的 str 方法分派异常

`name.sub(...)`/`name.len()` 在 json 数组元素上返回 None 语义（探针 a6a）；
元素先物化 `let f str = "" + name` 后操作正常（探针 mat）。boards_registry.at
已按物化形态编写。

## 附带发现 D：仓外 a2r rust-server 路径双阻断

`auto run`（默认 rust-server）为仓外 app 生成后端 crate 落 **auto-lang 仓内**
`examples/rust-workspace/<app>-back/`（污染框架仓：+产物目录 +改 workspace
Cargo.toml/.cargo/config），且 features=["ui","image-pipeline"] 撞
`ui/terminal/mod.rs:42` 未门控的 `pub use iced::…`（default 无 ui-iced，Plan 330）
→ E0432 编译必炸。修法=1 行 cfg 门控 + 落点外移，属框架侧。

## 对本 app 的影响

- vue 轨 `--server vm`（vite + AutoVM HTTP）：**fixture 可用，真实 55 文件
  语料必炸**（Bug A）。
- vue 轨默认 rust-server（a2r，可绕开 Bug A——转译为安全 Rust）：被 Bug D
  阻断。
- VM 轨（`-r vm` iced 桌面）：back 同走 VM，同受 Bug A。

**建议**：Bug A 提独立 VM 修复计划（heap_rc 计数审计，repro1 即最小复现）；
Bug D 的 1 行门控随该计划顺修；两者落地后本 app 后端无需改动即可全量跑通。
