# 拾笺（dsh-slipnote）

DeepSeek Harness（DSH）的「备忘录 / 计划书」插件。

侧栏会新增一行「拾笺」，点开后是一个包含两个 Tab 的面板：

- **备忘录**：自由文本、图片、对话快照、搜索、标签、置顶、归档、导出 / 导入。
- **计划书**：阶段 → 步骤两级结构、步骤状态与备注、整体进度、拖拽排序、投递为新对话提示词。

## 功能

### 备忘录

| 能力 | 说明 |
|---|---|
| 新建 / 编辑 / 删除 | 标题、正文、图片、标签、置顶、归档 |
| 搜索 | 标题、正文、标签、图片名、来源会话标题 |
| 图片 | 选择、粘贴或拖入图片；支持纯图片备忘录；单图最大边 1600px，最多 6 张 |
| 自动标题 | 新建、快照和收藏时从正文首句生成标题；纯图片笔记使用「图片备忘录」 |
| 标签 | 小写、去重，单标签 ≤ 32 字符，最多 20 个 |
| 置顶 | 置顶条目排在前面 |
| 对话快照 | 从当前会话选择一条用户 / 助手消息，只保留正文文本，自动排除推理和工具调用 |
| 消息按钮 | 助手消息底部的「添加到备忘录」按钮，直接保存该条回复 |
| 选中文字 | 捕获当前页面选中的文字并创建备忘录 |
| 送回对话 | 插入当前输入框；没有可用会话时复制到剪贴板 |
| 跳回会话 | 快照条目可跳回来源会话 |
| 拖入 | 把文本拖进面板即可新建一条备忘录 |
| 导出 / 导入 | JSON 全量导出 / 导入；Markdown 导出 |

> 消息级滚动没有公开 API。快照里的 `messageIndex` 与 `messageSeq` 会尽量记录；点击条目时按会话级跳转（打开来源会话）。字段允许为 `null`，不影响使用。

### 计划书

| 能力 | 说明 |
|---|---|
| 阶段 → 步骤 | 每个计划可包含多个阶段，每个阶段可包含多个步骤 |
| 状态 | `todo` 未开始、`doing` 进行中、`done` 完成、`hold` 搁置 |
| 备注 | 每个步骤可写备注 |
| 进度 | 已完成步骤数 / 总步骤数，显示百分比 |
| 排序 | 步骤支持 HTML5 拖拽排序；阶段支持上移 / 下移 |
| 投递 | 把某一步连同计划、阶段上下文投递到新对话的输入框 |

## 安装

插件目录就是本仓库 / 解压后的目录（其中包含 `package.json`、`index.js`、`client.js`、`cordis.patch.yml`）。

### 方式一：`安装.cmd`（Windows）

1. 关闭正在运行的 DSH。
2. 双击 `安装.cmd`。
3. 脚本会优先调用 `dsh` CLI；如果 PATH 中没有 CLI，则自动：
   - 备份 profile 的 `package.json`；
   - 写入 `dsh-slipnote: link:<插件目录>`；
   - 把 `dsh-slipnote` 加入 `dsh.profile.bundles`；
   - 在 profile 的 `node_modules` 下创建 Junction；
   - 校验 JSON，失败自动回滚；
   - 打印手动步骤作为兜底。
4. **完全退出 DSH，再重新启动。刷新页面无效。**

### 方式二：DSH CLI

如果 `dsh` 在 PATH 中：

```bat
dsh plugin --profile desktop add link:<插件目录>
```

然后完全退出并重启 DSH。

### 方式三：手动

编辑：

```text
C:\Users\<你>\.dsh\profiles\desktop\package.json
```

在 `dependencies` 中加入：

```json
"dsh-slipnote": "link:D:/path/to/dsh-slipnote"
```

在 `dsh.profile.bundles` 中追加 `"dsh-slipnote"`，并在 `node_modules` 下创建指向插件目录的 Junction：

```bat
mklink /J "C:\Users\<你>\.dsh\profiles\desktop\node_modules\dsh-slipnote" "D:\path\to\dsh-slipnote"
```

最后完全退出并重启 DSH。

> **为什么必须完全退出？** 桌面壳在启动时一次性收集客户端注入表。晚于这次收集注册的插件不会进入注入表，界面不出现，也不会报错；刷新页面补不上。

## 卸载

1. 关闭 DSH。
2. 双击 `卸载.cmd`，或手动从 profile 的 `dependencies` / `dsh.profile.bundles` 中移除 `dsh-slipnote`，并删除 `node_modules\dsh-slipnote` 链接。
3. 完全退出并重启 DSH。

数据不会被删除。若要彻底清理，删除：

```text
C:\Users\<你>\.dsh\dsh-memo\
```

## 数据位置

宿主可用时，数据落在：

```text
$DSH_HOME/dsh-memo/notes.json
$DSH_HOME/dsh-memo/plans.json
$DSH_HOME/dsh-memo/prefs.json
$DSH_HOME/dsh-memo/backups/
```

`DSH_HOME` 未设置时回退 `~/.dsh`。

> 数据目录沿用旧的 `dsh-memo` 名字，是为了升级时保留已有笔记；插件包名已经是 `dsh-slipnote`。

- 写入使用临时文件 + `rename` 的原子替换。
- 损坏的 JSON 会先复制到 `backups/`，再以空集合启动，避免启动失败。
- 每个文件都有 `schemaVersion`。遇到更高版本时进入只读模式，不会覆盖新数据。
- `localStorage` 只作为离线缓存（`dsh-slipnote.cache.v1`），不是唯一持久化位置。

## 主题与语言

- 面板使用 DSH 的 `--dsw-alias-*` 主题变量，自动跟随明暗主题。
- 界面语言跟随 DSH 的客户端 locale；提供 `zh` / `en` 字典。

## HTTP API

宿主半边注册一个 `/api/memo` prefix 路由。每个请求先经过 DSH 的
`ctx.connection.requestRejection`（Host/Origin 栅栏 + 浏览器登录），再要求
来源地址是 loopback：

```text
GET    /api/memo/bootstrap
GET    /api/memo/notes
POST   /api/memo/notes
GET    /api/memo/notes/:id
PATCH  /api/memo/notes/:id
DELETE /api/memo/notes/:id
GET    /api/memo/plans
POST   /api/memo/plans
GET    /api/memo/plans/:id
PATCH  /api/memo/plans/:id
DELETE /api/memo/plans/:id
GET    /api/memo/prefs
PUT    /api/memo/prefs
GET    /api/memo/export?format=json|md
POST   /api/memo/import
```

- 未登录 DSH 的请求返回 `401`；Host/Origin 不可信、非 loopback 或栅栏抛异常的请求返回 `403`。
- 栅栏不可用时 fail-closed，返回 `503`。
- 请求体上限 24 MB（图片以 data URL 随笔记保存）。
- 统一响应：`{ "ok": true, "data": ... }` 或 `{ "ok": false, "error": { "code", "message" } }`。

## 开发

要求 Node.js 22+（本机 DSH 自带运行时也可）。

```bat
cd dsh-slipnote
npm test
```

测试使用 Node 内置 `node:test`，不依赖任何第三方包：

- `tests/store.test.js`：持久化读写、损坏恢复、只读版本、导入导出。
- `tests/schema.test.js`：字段校验、图片与上限。
- `tests/routes.test.js`：路由、DSH 访问栅栏、loopback、图片、状态码。
- `tests/mount.test.js`：防重复挂载。
- `tests/client.test.js`：模块 id、三个插槽注册、面板空数据渲染、文本提取、图片本地笔记。
- `tests/hygiene.test.js`：无第三方运行时依赖、无 Python、安装脚本存在。

浏览器半边是单文件 `client.js`，不需要 bundler；宿主通过 `window.__ModuleLoader__` 加载，`require('react')` 由宿主提供。

## 目录

```text
dsh-slipnote/
├─ package.json
├─ cordis.patch.yml
├─ index.js                 # 宿主半边
├─ client.js                # 浏览器半边（单文件）
├─ src/
│  ├─ dsh-home.js
│  ├─ persist.js
│  ├─ schema.js
│  ├─ store.js
│  ├─ loopback.js
│  ├─ mount-once.js
│  └─ routes.js
├─ locale/
├─ tests/
├─ scripts/
├─ 安装.cmd
└─ 卸载.cmd
```

## 限制

- 消息级定位依赖 DSH 未来公开 API；当前只做会话级跳转。
- 拖拽是增强路径；按钮和剪贴板才是可靠路径。
- 插件不引入 npm 第三方运行时依赖，也不使用 Python。

## 许可证

MIT。第三方说明见 `THIRD-PARTY-NOTICES.md`。
