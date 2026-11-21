# 拾笺（dsh-slipnote）设计方案

> 状态：**已实现并安装（0.2.1）**。按交接材料 C9，本文先记录可行性、目录结构与数据模型，随后按此实现。
>
> 0.1.1 增补：侧栏/面板显示名改为「拾笺」；助手消息底部操作栏新增「添加到备忘录」按钮。
>
> 0.2.0 增补：为发布到 DSH Market，包名、ModuleLoader id、侧栏/面板 id 改为
> `dsh-slipnote`；数据目录仍保留 `$DSH_HOME/dsh-memo` 以兼容旧笔记。文中其余
> `dsh-memo` 字样是当时的设计记录。
>
> 0.2.1 安全修复：所有 `/api/memo` 请求先走 `ctx.connection.requestRejection`；
> 未登录 `401`、不可信来源 `403`、栅栏缺失 `503`，之后仍保留 loopback 检查。
>
> 目标宿主：DeepSeek Harness `0.2.2-rc.1`，Profile `C:\Users\24281\.dsh\profiles\desktop`。
>
> 本文所有结论均来自本机安装包 / 运行中宿主 Inspect 的实测，不依赖 `dsh-web-notes` 0.7.8 的旧 API 假设。

---

## 0. 三个未知的实测结论

### 未知 1：客户端产物格式 —— 已确认

必须使用宿主 ModuleLoader 的 factory 包装：

```js
window.__ModuleLoader__.load({
  id: 'dsh-memo',
  factory(require) {
    const React = require('react')
    // ...
    return {
      inject: ['slots', 'locale', 'layout', 'sessions', 'conversation', 'uiWorkspace'],
      apply(ctx) { /* ... */ },
    }
  },
})
```

关键点：

- `id` 必须等于包名 `dsh-memo`。
- `require('react')` 来自宿主冻结的 browser module table，不需要打包 React。
- 每个包只能有一个 `client.js` 入口；手写 bundle **不能同步 `require` 另一个相对 `client*.js`**，否则会抛 require cycle。
- 因此客户端采用**单文件 `client.js`**（纯 JS + `React.createElement`，无 JSX / TS / bundler），以满足 C5（不引入第三方运行时依赖）。
- 证据：`@deepseek-ai/dsh-agent-preset` 的 `templates/decoration/client.js`；`@deepseek-ai/dsh-client-modules` README“Lazy-CJS model / Sharing modules”。

### 未知 2：消息序号 —— 可拿到序号，但拿不到“滚动到某条消息”

当前宿主没有公开的 `messages[]` 数组，也没有 `scrollToMessage`。可行路径是：

1. 从 `ctx.sessions.list.getSnapshot().byId` 找到主会话：
   ```js
   const row = Object.values(ctx.sessions.list.getSnapshot().byId)
     .find((r) => (r.retainedBy?.mainView ?? 0) > 0)
   ```
   这是宿主自己在 `dsh-client-ui-workspace/lib/client.js` 中使用的“当前主会话”判定。
2. `ctx.sessions.retain(row.id, { source: 'dsh-memo' })`，`await reference.ready`。
3. `reference.binding.eventSource.getSnapshot().entries`，过滤 `event.type`：
   - `user/message`：`data.id`、`data.content`、`data.source`
   - `assistant/message`：`data.message.id`、`data.message.content`、`data.usage`、`data.interrupted?`
4. `messageIndex` = 过滤后消息的 1-based 序号；`messageSeq` = `event.seq`（精确锚点）；`messageRole` = `user` / `assistant`；`messageTime` = `event.time`。
5. `reference.release()`。

降级：

- 当前没有主会话（`mainView` 为空）时，快照选择器列出所有会话供选择；仍无法读取时，禁用快照入口，仅保留“选中文字 / 手写”。
- **A9 只能做到“跳回原会话”**：调用 `ctx.uiWorkspace.openSession(sessionId)`。消息级定位没有公开 API，不做 DOM hack；UI 上按钮文案是“打开原会话”，不承诺滚动到某条消息。
- `messageIndex` 允许为 `null`，符合交接材料 A7 / 红线 8。

### 未知 3：`sidebar.panellist` —— 已确认存在，并同时确认了主面板槽

- `sidebar.panellist`：root 作用域 list 插槽，注册项 `{ id, order, label }`，owner props `{ size, active }`。
- `main`：root 作用域 keyed 插槽，注册项 `{ key }`；宿主按“侧栏 id → main key”打开中央面板。
- 两个注册必须使用**同一个 id**：

```js
const PANEL_ID = 'dsh-memo'

ctx.slots.register({
  name: 'main',
  key: PANEL_ID,
  locale: 'dsh-memo',
}, () => React.createElement(Panel, { ctx }))

ctx.slots.register({
  name: 'sidebar.panellist',
  id: PANEL_ID,
  order: 12,
  label: () => t('nav'),
  locale: 'dsh-memo',
}, (owner = {}) => React.createElement(MemoIcon, { size: owner.size ?? 16, active: owner.active }))
```

`order` 现状：`tk/plugins=0`、`dsh-market=1`、`tk/schedules=10`；本插件用 `12`，排在“自动化任务”之后。

关闭面板：`if (ctx.layout.panelInfo.getSnapshot().activePanelId === PANEL_ID) ctx.layout.selectPanel(null)`。

---

## 1. 总体架构

```text
┌──────────────────────────── DSH Web GUI ────────────────────────────┐
│  sidebar.panellist (id=dsh-memo)                                    │
│        │ click                                                      │
│        ▼                                                            │
│  main[key=dsh-memo] ──► client.js                                  │
│                         ├─ 备忘录 Tab（列表 / 编辑 / 搜索 / 标签 / 置顶）│
│                         ├─ 计划书 Tab（阶段 / 步骤 / 进度 / 拖拽）       │
│                         ├─ 快照选择器（sessions + eventSource）         │
│                         ├─ 送入输入框（conversation.input）            │
│                         └─ 新对话投递（uiWorkspace.startSession）       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ fetch /api/memo/*
┌───────────────────────────────▼─────────────────────────────────────┐
│  index.js（Host half，Cordis plugin）                               │
│  ├─ MemoStore：notes.json / plans.json / prefs.json                 │
│  ├─ schema 校验 + schemaVersion 迁移                                │
│  ├─ 原子写（.tmp → rename） + 损坏文件备份                            │
│  ├─ /api/memo 路由（DSH 访问栅栏 + loopback + 24MB body + 方法校验）   │
│  └─ mount-once 全局守卫（npm/link 双装时防止重复注册路由）              │
└─────────────────────────────────────────────────────────────────────┘
```

不使用 `host.call`：它是 `dsh-cordis-client-runner` 给**动态包**的 RPC，普通安装包的 `client.js` 不经过那个 runner。普通插件走 `webServer` HTTP 路由，与 `dsh-web-notes` 同一路线。

---

## 2. 目录结构

```text
dsh-memo/
├─ package.json
├─ cordis.patch.yml
├─ index.js                      # Host 入口：apply / webServer 路由
├─ client.js                     # 浏览器唯一 bundle：侧栏 + main + 两个 Tab
├─ icon.svg
├─ locale/
│  ├─ zh.json                    # 侧栏 label 等最小文案（同时内联在 client.js）
│  └─ en.json
├─ src/
│  ├─ store.js                   # MemoStore：notes/plans/prefs 的内存模型与 CRUD
│  ├─ persist.js                 # 原子写、容错读、损坏备份、写队列
│  ├─ schema.js                  # 字段校验 / 规范化 / 上限 / 迁移
│  ├─ routes.js                  # /api/memo 路由与 HTTP 语义
│  ├─ dsh-home.js                # DSH_HOME 解析（~ 展开）
│  ├─ loopback.js                # 仅允许 127.0.0.1 / ::1
│  └─ mount-once.js              # Symbol.for('dsh-memo.mounted') 守卫
├─ tests/
│  ├─ store.test.js
│  ├─ routes.test.js
│  ├─ mount.test.js              # vm 加载 client.js，断言侧栏/main 注册不抛异常
│  ├─ schema.test.js
│  └─ hygiene.test.js            # 无 .py、无第三方运行时依赖、清单一致
├─ scripts/
│  ├─ install.ps1
│  └─ uninstall.ps1
├─ 安装.cmd
├─ 卸载.cmd
├─ DESIGN.md
├─ README.md
└─ THIRD-PARTY-NOTICES.md
```

`client.js` 内部按区块组织（仍是单文件）：

```text
§0 模块头 + PANEL_ID + CSS
§1 常量、类型注释、纯工具函数
§2 i18n 字典 + t()
§3 API 客户端 + localStorage 缓存 / 降级
§4 会话桥：找主会话、读消息、送输入框、开原会话、新对话投递
§5 通用 UI：Icon、Button、Modal、Toast、TagInput、Progress
§6 NotesTab
§7 PlansTab
§8 Panel 外壳 + apply() 注册
```

> 为什么不是交接材料里的 `src/client/*.tsx`：那套结构默认有 bundler。当前 ModuleLoader 只接受单入口 bundle，而 C5 不允许引入打包器依赖。单文件是约束下的最简可靠解；测试用 `vm` 直接加载它。

---

## 3. 数据模型

### 3.1 落盘位置

```text
$DSH_HOME/dsh-memo/
├─ notes.json
├─ plans.json
├─ prefs.json
└─ backups/                 # 损坏文件备份：<name>.corrupt-<timestamp>.json
```

`DSH_HOME` 解析顺序：

1. 环境变量 `DSH_HOME`
2. `~/.dsh`
3. `~` 展开为 `os.homedir()`

所有文件含 `schemaVersion: 1`。首次读不到文件 → 返回空数据并创建目录；JSON 损坏 → 备份原文件后返回空数据，不阻塞启动。

### 3.2 `notes.json` JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "dsh-memo/notes.schema.json",
  "type": "object",
  "required": ["schemaVersion", "notes"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "notes": {
      "type": "array",
      "maxItems": 5000,
      "items": { "$ref": "#/$defs/note" }
    }
  },
  "$defs": {
    "note": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id", "title", "content", "tags", "source",
        "pinned", "archived", "createdAt", "updatedAt"
      ],
      "properties": {
        "id": { "type": "string", "pattern": "^n_[A-Za-z0-9-]{8,64}$" },
        "title": { "type": "string", "maxLength": 200 },
        "content": { "type": "string", "maxLength": 200000 },
        "images": {
          "type": "array",
          "maxItems": 6,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["id", "name", "mime", "dataUrl", "width", "height", "size"],
            "properties": {
              "id": { "type": "string", "pattern": "^img_[A-Za-z0-9-]{8,64}$" },
              "name": { "type": "string", "maxLength": 120 },
              "mime": { "type": "string", "enum": ["image/png", "image/jpeg", "image/webp", "image/gif"] },
              "dataUrl": { "type": "string", "maxLength": 3000000 },
              "width": { "type": "integer", "minimum": 0 },
              "height": { "type": "integer", "minimum": 0 },
              "size": { "type": "integer", "minimum": 0 }
            }
          }
        },
        "tags": {
          "type": "array",
          "maxItems": 20,
          "uniqueItems": true,
          "items": { "type": "string", "minLength": 1, "maxLength": 32 }
        },
        "source": {
          "type": "string",
          "enum": ["manual", "selection", "composer", "snapshot"]
        },
        "sessionId": { "type": ["string", "null"], "maxLength": 128 },
        "sessionTitle": { "type": ["string", "null"], "maxLength": 200 },
        "messageIndex": { "type": ["integer", "null"], "minimum": 1 },
        "messageSeq": { "type": ["integer", "null"], "minimum": 0 },
        "messageRole": {
          "type": ["string", "null"],
          "enum": ["user", "assistant", null]
        },
        "messageTime": { "type": ["integer", "null"], "minimum": 0 },
        "pinned": { "type": "boolean" },
        "archived": { "type": "boolean" },
        "createdAt": { "type": "integer", "minimum": 0 },
        "updatedAt": { "type": "integer", "minimum": 0 }
      }
    }
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | `n_` + UUID 去连字符；服务端生成，客户端不可改 |
| `title` | string | 上限 200；空标题由正文首个有效行自动生成（最多 40 字符 + `…`；纯图片为「图片备忘录」） |
| `content` | string | 上限 200000；纯文本 / Markdown 原文 |
| `images` | array | **新增**：内嵌图片，最多 6 张，每张 `{id,name,mime,dataUrl,width,height,size}`；纯图片笔记允许 `content` 为空 |
| `tags` | string[] | 小写、trim、去重；单标签 ≤32；最多 20 |
| `source` | enum | `manual` 手写；`selection` 选中文字；`composer` 从输入框；`snapshot` 整条消息 |
| `sessionId` | string? | 来源会话；全局条目为 `null` |
| `sessionTitle` | string? | **新增**：快照时的会话标题，避免会话改名后丢失上下文 |
| `messageIndex` | int? | **新增**：过滤 user/assistant 后的 1-based 序号；失败为 `null` |
| `messageSeq` | int? | **新增**：事件 seq，精确锚点；失败为 `null` |
| `messageRole` | enum? | **新增**：`user` / `assistant` / `null` |
| `messageTime` | int? | **新增**：源消息时间；与笔记 `createdAt` 区分 |
| `pinned` | boolean | **新增**：置顶；默认 `false` |
| `archived` | boolean | **新增**：归档；默认 `false` |
| `createdAt` | int | epoch ms；服务端创建时写入 |
| `updatedAt` | int | epoch ms；服务端每次更新写入 |

示例：

```json
{
  "schemaVersion": 1,
  "notes": [
    {
      "id": "n_9f1c2d3e4a5b6c7d",
      "title": "会话快照：侧栏插槽",
      "content": "侧栏入口必须同时注册 sidebar.panellist 与 main，id 相同。",
      "images": [],
      "tags": ["dsh", "插件"],
      "source": "snapshot",
      "sessionId": "s_01J8Z9K3",
      "sessionTitle": "DSH 插件开发",
      "messageIndex": 12,
      "messageSeq": 48,
      "messageRole": "assistant",
      "messageTime": 1762500000000,
      "pinned": true,
      "archived": false,
      "createdAt": 1762500100000,
      "updatedAt": 1762500100000
    }
  ]
}
```

### 3.3 `plans.json` JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "dsh-memo/plans.schema.json",
  "type": "object",
  "required": ["schemaVersion", "plans"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "plans": {
      "type": "array",
      "maxItems": 200,
      "items": { "$ref": "#/$defs/plan" }
    }
  },
  "$defs": {
    "plan": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "title", "archived", "createdAt", "updatedAt", "stages"],
      "properties": {
        "id": { "type": "string", "pattern": "^p_[A-Za-z0-9-]{8,64}$" },
        "title": { "type": "string", "maxLength": 200 },
        "archived": { "type": "boolean" },
        "createdAt": { "type": "integer", "minimum": 0 },
        "updatedAt": { "type": "integer", "minimum": 0 },
        "stages": {
          "type": "array",
          "maxItems": 50,
          "items": { "$ref": "#/$defs/stage" }
        }
      }
    },
    "stage": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "title", "order", "steps"],
      "properties": {
        "id": { "type": "string", "pattern": "^st_[A-Za-z0-9-]{8,64}$" },
        "title": { "type": "string", "maxLength": 200 },
        "order": { "type": "integer", "minimum": 0 },
        "steps": {
          "type": "array",
          "maxItems": 200,
          "items": { "$ref": "#/$defs/step" }
        }
      }
    },
    "step": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "text", "status", "note", "order", "doneAt"],
      "properties": {
        "id": { "type": "string", "pattern": "^sp_[A-Za-z0-9-]{8,64}$" },
        "text": { "type": "string", "minLength": 1, "maxLength": 1000 },
        "status": {
          "type": "string",
          "enum": ["todo", "doing", "done", "hold"]
        },
        "note": { "type": "string", "maxLength": 5000 },
        "order": { "type": "integer", "minimum": 0 },
        "doneAt": { "type": ["integer", "null"], "minimum": 0 }
      }
    }
  }
}
```

规则：

- 整体进度 = `done` 步骤数 / 总步骤数；没有步骤时显示 `0%`，不除零。
- 阶段和步骤都用显式 `order` 整数；拖拽后统一重排为 `0..n-1`，不依赖数组下标。
- 状态改为 `done` 时写 `doneAt = Date.now()`；改回其他状态时清空 `doneAt`。
- 删除阶段/步骤前二次确认；删除后重排 `order`。

示例：

```json
{
  "schemaVersion": 1,
  "plans": [
    {
      "id": "p_a1b2c3d4e5f6",
      "title": "DSH 备忘录插件",
      "archived": false,
      "createdAt": 1762500000000,
      "updatedAt": 1762500000000,
      "stages": [
        {
          "id": "st_11111111",
          "title": "阶段一：跑通侧栏入口",
          "order": 0,
          "steps": [
            {
              "id": "sp_22222222",
              "text": "写最小客户端，验证侧栏注册",
              "status": "done",
              "note": "",
              "order": 0,
              "doneAt": 1762500000000
            },
            {
              "id": "sp_33333333",
              "text": "验证 main[key=dsh-memo] 与 sidebar.id 联动",
              "status": "doing",
              "note": "id 必须完全一致",
              "order": 1,
              "doneAt": null
            }
          ]
        }
      ]
    }
  ]
}
```

### 3.4 `prefs.json` JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "dsh-memo/prefs.schema.json",
  "type": "object",
  "required": ["schemaVersion", "theme", "activeTab", "lastPlanId", "lastNoteId"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "theme": { "type": "string", "enum": ["auto", "light", "dark"] },
    "activeTab": { "type": "string", "enum": ["notes", "plans"] },
    "lastPlanId": { "type": ["string", "null"], "maxLength": 64 },
    "lastNoteId": { "type": ["string", "null"], "maxLength": 64 }
  }
}
```

`theme` 在 v1 固定为 `"auto"`，仅作未来字段保留；C3 的主题跟随由 CSS 变量完成，不靠这个字段。`lastPlanId` / `lastNoteId` 只用于恢复上次选中项。

### 3.5 上限与迁移

| 常量 | 值 |
|---|---|
| `NOTES_MAX` | 5000 |
| `NOTE_TITLE_MAX` | 200 |
| `NOTE_CONTENT_MAX` | 200000 |
| `NOTE_IMAGES_MAX` | 6 |
| `NOTE_IMAGE_CHARS_MAX` | 3000000 |
| `NOTE_IMAGES_TOTAL_CHARS_MAX` | 12000000 |
| `NOTE_IMAGE_NAME_MAX` | 120 |
| `NOTE_TAGS_MAX` | 20 |
| `NOTE_TAG_MAX` | 32 |
| `PLANS_MAX` | 200 |
| `STAGES_MAX` | 50 |
| `STEPS_MAX` | 200 |
| `STEP_TEXT_MAX` | 1000 |
| `STEP_NOTE_MAX` | 5000 |

迁移：

- 读到无 `schemaVersion` 的旧结构（例如只有 `notes` / `plans` 数组）时，按 v0 → v1 补默认字段（`pinned:false`、`archived:false`、`source:'manual'` 等），写回前不丢原数据。
- 高版本 `schemaVersion`：不猜、不覆盖；只读展示并在 UI 顶部提示“数据版本高于插件版本”，禁止写入，避免降级破坏。
- 写文件统一走“串行队列 + `.tmp` + `rename`”；Windows 上 `rename` 覆盖目标文件是原子替换语义。

---

## 4. HTTP API

前缀：`/api/memo`。每个请求先经过 `ctx.connection.requestRejection(req)`：
未登录 `401`、不可信来源 `403`、栅栏异常 `403`、栅栏缺失 `503`（0.2.1 安全修复）。
通过后再要求 loopback；非 loopback 直接 `403`。响应统一：

```json
{ "ok": true, "data": {} }
{ "ok": false, "error": { "code": "NOTE_NOT_FOUND", "message": "..." } }
```

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/memo/bootstrap` | 一次返回 notes / plans / prefs / storage 状态 |
| GET | `/api/memo/notes?q=&tag=&includeArchived=1` | 列表 / 搜索 |
| POST | `/api/memo/notes` | 新建；`id`、时间戳由服务端生成 |
| PATCH | `/api/memo/notes/{id}` | 部分更新 |
| DELETE | `/api/memo/notes/{id}` | 删除 |
| GET | `/api/memo/plans` | 计划列表 |
| POST | `/api/memo/plans` | 新建计划 |
| PATCH | `/api/memo/plans/{id}` | 更新标题 / 归档 / 整棵 `stages` |
| DELETE | `/api/memo/plans/{id}` | 删除计划 |
| GET | `/api/memo/prefs` | 读取偏好 |
| PUT | `/api/memo/prefs` | 更新偏好 |
| GET | `/api/memo/export?format=json\|md` | 导出 |
| POST | `/api/memo/import` | 导入 `{ mode: 'merge'\|'replace', data }` |

HTTP 语义：

- body 上限 24 MB（图片以 data URL 随笔记保存）；超限 `413`。
- JSON 解析失败 `400`。
- 路径存在但方法不对 `405`。
- 未知路径 `404`。
- 字段校验失败 `422`，`error.code` 为 `VALIDATION`，`error.details` 列出字段。
- 重复 `(kind, path)` 注册直接抛错；由 `mount-once` 防止 npm/link 双装时触发。
- 导出 Markdown 结构：
  ```md
  # DSH 备忘录导出（2026-11-08）
  
  ## 备忘录
  ### 标题（标签：a, b）
  - 来源：snapshot / 会话标题 / 消息 #12
  - 时间：...
  
  正文…
  
  ## 计划书
  ### 计划标题（3/8 完成）
  #### 阶段一
  - [x] 步骤（done）— 备注
  - [ ] 步骤（todo）
  ```
- 导入 `merge`：为所有导入条目重新生成 id，追加；`replace`：整体替换（先备份原文件）。

---

## 5. 客户端行为

### 5.1 备忘录 Tab（A1–A10）

| 需求 | 实现 |
|---|---|
| A1 新建/编辑/删除 | 列表 + 右侧编辑区；新建空笔记；删除二次确认 |
| A2 搜索 | 标题/正文/标签，输入即过滤（150ms debounce）；`q` 同时传 API |
| A3 标签 | 逗号分隔输入；规范化小写/去重；标签 chips 过滤 |
| A4 置顶 | `pinned`；置顶区排在最前，组内按 `updatedAt desc` |
| A5 两种条目 | 自由文本（`manual` / `composer`）与对话快照（`snapshot`） |
| A6 存入当前消息/选中文字 | 快照选择器 + `selectionchange` 缓存选中文字 |
| A7 快照元数据 | `sessionId`、`sessionTitle`、`messageIndex`、`messageSeq`、`messageRole`、`messageTime`、`createdAt` |
| A8 送回对话 | 当前主会话 → `conversation.input` 追加到草稿；无会话 → 剪贴板 |
| A9 点击跳回原会话 | `uiWorkspace.openSession(sessionId)`；消息级定位降级为会话级 |
| A10 拖拽 | 原生 HTML5：拖入面板 drop 区存为笔记；笔记卡拖到输入框由浏览器原生插入文本。不做 DOM hack，不作为主路径 |

#### 快照选择器流程

1. 打开时找主会话：
   ```js
   function findMainSessionRow(sessions) {
     const list = sessions.list.getSnapshot()
     return Object.values(list.byId)
       .find((row) => (row.retainedBy?.mainView ?? 0) > 0) ?? null
   }
   ```
2. 有主会话 → 直接列消息；无主会话 → 显示会话下拉框（`list.ids` + `byId[id].title`），选一个再读。
3. `ctx.sessions.retain(sessionId, { source: 'dsh-memo' })`；`await reference.ready`；读 `binding.eventSource.getSnapshot().entries`。
4. 过滤 `user/message` / `assistant/message`；`content` 统一转文本：
   - string → 原样；
   - block[] → 只拼接 `type === 'text'` 的 `text`；`reasoning`、`tool-call`、`image` 块忽略。
5. 列表展示 role、时间、摘要；点击预览；确认后 `POST /notes`，`source:'snapshot'`。
6. `reference.release()` 放在 `finally`。

#### 选中文字

- `apply` 时注册 `document.addEventListener('selectionchange', ...)`，缓存最近一次非空选区 `{ text, at, sessionId }`；`sessionId` 用当次 `findMainSessionRow()` 尽力获取。
- 面板顶部“保存选中文字”按钮可用时，直接存 `source:'selection'`。
- 清空选区不立即清除缓存（避免点击面板后丢失），保存后清空。

#### 送回对话（A8）

```js
function sendTextToComposer(ctx, text) {
  const row = findMainSessionRow(ctx.sessions)
  if (row) {
    const shell = ctx.conversation.input.shell(row.id) // 已有 binding 时可用
    if (shell) {
      const draft = shell.state.getSnapshot().draft ?? ''
      shell.setDraft(draft.trim() === '' ? text : draft + '\n\n' + text)
      return 'inserted'
    }
    ctx.uiWorkspace.openSession(row.id)
    // 切回会话后下一帧再尝试；失败则剪贴板
    setTimeout(() => {
      const late = ctx.conversation.input.shell(row.id)
      if (late) {
        const draft = late.state.getSnapshot().draft ?? ''
        late.setDraft(draft.trim() === '' ? text : draft + '\n\n' + text)
      } else {
        void navigator.clipboard?.writeText(text)
      }
    }, 50)
    return 'opened'
  }
  void navigator.clipboard?.writeText(text)
  return 'clipboard'
}
```

- 不覆盖已有草稿：空则赋值，非空则 `\n\n` 追加。
- 长文本（> 50k）仍走 `setDraft`；如果 composer 拒绝，回退剪贴板并提示。
- 引用 chip 属于后续增强（`insertReference` + `inputTriggers`），v1 先纯文本，符合交接材料第 5 步。

### 5.2 计划书 Tab（B1–B6）

| 需求 | 实现 |
|---|---|
| B1 阶段→步骤 | `plans[].stages[].steps[]`，两级；阶段可折叠 |
| B2 勾选完成 | checkbox ↔ `status='done'`；写/清 `doneAt` |
| B3 步骤拖拽排序 | HTML5 drag；同阶段内重排，落点后重写 `order`；阶段头也支持拖拽重排（增强） |
| B4 状态 + 备注 | 下拉 `todo/doing/done/hold`；备注 textarea，失焦保存 |
| B5 整体进度 | 顶部进度条 + `done/total` + 百分比 |
| B6 投递成新对话 | 每步“投递”按钮 → `uiWorkspace.startSession(undefined, { prompt, whenDraftExists: 'append' })` |

投递提示词：

```text
请按以下计划步骤继续工作：

计划：{plan.title}
阶段：{stage.title}
步骤：{step.text}
状态：{statusLabel}
备注：{step.note || '（无）'}

请先确认你的理解，然后开始执行；完成后说明结果。
```

投递成功后：若步骤是 `todo`，自动改为 `doing`；`startSession` 失败则复制提示词到剪贴板并提示。

### 5.3 面板外壳

- 顶部：标题“备忘录 / 计划书”、Tab 切换、搜索（备忘录 Tab 时）、新建、导出/导入菜单、连接状态。
- 两个 Tab 用 `role="tablist"` / `role="tab"` / `aria-selected`；键盘左右切换。
- 关闭：面板内“关闭”按钮调用 `layout.selectPanel(null)`；侧栏行再次点击由宿主处理。
- 空状态、加载态、错误态、降级态都有独立文案。
- 所有时间用 `Intl.DateTimeFormat`；相对时间“刚刚 / N 分钟前 / 昨天 / N 天前”。

---

## 6. 主题、i18n、样式

### 主题（C3）

只用宿主 token，不写死颜色：

```css
background: var(--dsw-alias-bg-base);
color: var(--dsw-alias-label-primary);
border: 1px solid var(--dsw-alias-border-l1);
background: var(--dsw-alias-bg-layer-1);
color: var(--dsw-alias-label-secondary);
accent-color: var(--dsw-alias-brand-primary);
```

可用 token 全集：

`--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1`、`--dsw-alias-bg-layer-2`、`--dsw-alias-bg-overlay`、`--dsw-alias-border-l1`、`--dsw-alias-border-l2`、`--dsw-alias-brand-primary`、`--dsw-alias-label-primary`、`--dsw-alias-label-secondary`、`--dsw-alias-state-error-primary`、`--dsw-alias-state-idle-primary`、`--dsw-alias-state-success-primary`、`--dsw-alias-state-warn-primary`、`--dsw-specific-sidebar-fill`。

CSS 作为 Panel 内部的 `<style>` React 元素渲染；卸载即移除，不污染全局。类名统一 `dsh-memo-*` 前缀。

### i18n

```js
const NS = 'dsh-memo'
const offZh = ctx.locale.register(NS, 'zh', ZH)
const offEn = ctx.locale.register(NS, 'en', EN)
const t = ctx.locale.bind(NS)
```

- 侧栏 label：`label: () => t('nav')`，宿主每次投影重新读取。
- 可见文案全部走 `t()`；日期用 `Intl`，不拼中文。
- `locale/zh.json`、`locale/en.json` 作为包资源一并提供，内容与内联字典保持一致。

---

## 7. 持久化与降级（C1 / C7）

### 正常模式

`bootstrap` 成功 → 使用磁盘数据；每次变更先写内存，再 `fetch`，成功后更新缓存。写失败显示错误，不静默吞掉。

### 降级模式

`bootstrap` 失败（宿主路由未挂载 / 网络错误）→：

1. 从 `localStorage['dsh-memo.cache.v1']` 读缓存；没有则空数据。
2. 顶部显示“本地缓存模式”徽标 + “重试连接”按钮。
3. 所有增删改只写内存 + localStorage；导出 JSON/Markdown 在客户端生成，仍可用。
4. 重试成功后用磁盘数据刷新；**不自动合并**本地改动，避免覆盖磁盘。若本地有改动，提示先导出，再重载。README 明确说明这一点。

缓存结构：

```json
{
  "schemaVersion": 1,
  "savedAt": 1762500000000,
  "notes": [],
  "plans": [],
  "prefs": {}
}
```

`localStorage` 只作降级，不承担跨会话持久化主路径（C7）。

---

## 8. 测试计划（C8）

使用 Node 内置 `node:test`，零第三方测试依赖。

| 文件 | 覆盖 |
|---|---|
| `tests/store.test.js` | 新建/读取/更新/删除；原子写后文件可解析；损坏 JSON → 备份 + 空 store；无 `schemaVersion` 迁移；标签规范化/上限；计划 order 重排与进度 |
| `tests/routes.test.js` | 重复路由注册抛错；DSH 访问栅栏 401/403/异常/缺失；loopback；405；404；400 非法 JSON；413 超 body；CRUD；导出 JSON/Markdown；导入 merge/replace |
| `tests/schema.test.js` | 合法/非法 Note、Plan、Prefs；边界值（200000 字符、20 标签、空步骤） |
| `tests/mount.test.js` | `vm` 加载 `client.js`，fake `window.__ModuleLoader__` / `React` / `ctx`；断言 `factory` 返回 `inject/apply`；`apply` 不抛异常；注册 `main[key=dsh-memo]` 与 `sidebar.panellist[id=dsh-memo]`；label thunk 返回字符串；main 渲染函数返回元素；执行 Panel 初始渲染（fake hooks）不抛异常 |
| `tests/hygiene.test.js` | 包内无 `.py`；`dependencies` 为空；`peerDependencies` 仅 react/react-dom；`client.js` 有 `__ModuleLoader__.load` 且 id 为 `dsh-memo`；`cordis.patch.yml` id/name 一致 |

运行：`node --test tests/`（Node 24 内置；开发机用 DSH 自带 Node）。

---

## 9. 安装与卸载（C4 / C10）

### 开发期（本机）

优先用宿主提供的 `plugin_manager` `install_bundle`（绝对路径 `D:\文档\deepseek-harness\default-workspace\dsh-memo`）。它会写 profile 清单、链接目录并启用 bundle；避免手工改 profile。

### 交付脚本

当前机器 `where dsh` 找不到 CLI，因此 `安装.cmd` 采用“CLI 优先、PowerShell 兜底”：

1. 若 `dsh` 命令存在：`dsh plugin --profile desktop add link:"<插件绝对路径>"`。
2. 否则 PowerShell：
   - 检查 DSH 进程未运行；运行中则中止并提示完全退出。
   - 备份 `%DSH_HOME%\profiles\desktop\package.json`。
   - 在 `dependencies` 写入 `"dsh-memo": "link:<POSIX 路径>"`。
   - 在 `dsh.profile.bundles` 追加 `"dsh-memo"`（去重）。
   - 在 `node_modules\dsh-memo` 建 Junction 指向插件目录（已存在则跳过/报错）。
   - 写回 UTF-8 无 BOM。
3. `卸载.cmd` 反向操作：移除 dependency、bundle、Junction；只删除指向本插件目录的 Junction。

脚本最后都会打印：

> 安装/卸载已完成。请**完全退出 DSH（托盘也退出）再重新打开**；刷新页面无效。

原因：桌面壳的注入表是宿主启动时一次性收集的，晚订阅的侧栏行不会出现，且没有报错（交接材料 3.6）。

---

## 10. 与交接材料的偏差 / 降级说明

1. **单文件 `client.js`，不是 `src/client/*.tsx`**
   - 原因：ModuleLoader 单入口 + 手写 bundle 不能同步 require 相对 chunk；C5 不允许 bundler 依赖。
   - 影响：客户端源码可读性靠分区和注释；测试用 `vm` 加载。
2. **HTTP 路由，不用 `host.call`**
   - 原因：`host.call` 只对 `dsh-cordis-client-runner` 的动态包可用；普通安装包不走那条路径。
3. **A9 只到会话级**
   - 原因：没有公开的 `scrollToMessage`；不做 DOM hack。
   - 仍满足“快照条目点击可跳回原会话”；`messageIndex/messageSeq` 已落盘，未来有公开 API 可升级。
4. **A10 用原生拖拽，不做 DOM 注入**
   - 拖入面板：drop 读取 `text/plain` 存为笔记。
   - 拖回输入框：笔记卡设置 `text/plain`，由浏览器原生插入；不作为主路径，失败仍有按钮 + 剪贴板。
5. **选中文字依赖 `selectionchange` 缓存**
   - 打开面板后焦点变化可能清空实时选区，因此缓存最近一次非空选区。
6. **本地缓存模式不自动合并**
   - 避免静默覆盖磁盘数据；重试成功后以磁盘为准，提示先导出本地改动。

---

## 11. 请确认的点

1. 是否接受**单文件 `client.js`（纯 JS，无 bundler）**？这是 C5 + ModuleLoader 约束下的推荐解。
2. 是否接受 **A9 降级为“跳回原会话”**（不定位到具体消息）？数据里仍保存 `messageIndex/messageSeq`。
3. 数据模型新增 `sessionTitle`、`messageSeq`、`messageTime`，并把 `pinned/archived` 规范为必填 boolean；是否同意？
4. 侧栏顺序用 `order: 12`（在“自动化任务”之后）；是否同意？
5. 安装脚本在找不到 `dsh` CLI 时**直接改 profile 的 `package.json` + 建 Junction**；是否接受？还是只保留 `plugin_manager` 安装、`.cmd` 仅打印手动步骤？

确认后按第 1→7 步实现：侧栏空白面板 → 备忘录 CRUD/落盘 → 计划书 → 快照 → 送回输入框 → 搜索/标签/置顶/导出/拖拽 → 安装脚本 + 测试 + README。
