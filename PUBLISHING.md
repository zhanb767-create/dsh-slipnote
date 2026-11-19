# 发布到 DSH Market

> 结论先说：**dshmarket 本身不收投稿**。它读取的是
> [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
> 的目录；投稿就是往那个仓库提一个 `data/plugins/<owner>__<repo>.yml` 文件。
> dshmarket、awesome-dsh-plugin.com、dshmarket.com 都从这份目录同步。

参考：

- [贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)
- [dshmarket README](https://github.com/dsh-market/dsh-market#readme)
- [dsh-plugin-doctor](https://github.com/Tim-ReJet/dsh-plugin-doctor)：提交前自检工具

## 1. 正式命名

`dsh-memo` 不能直接发布：npm 上的 `dsh-memo` 已被另一个插件占用
（`lesliechowsh/dsh-memo`，最新 0.13.2，已标记 unmaintained），GitHub 也有同名仓库。
继续用这个名字会让 `dsh plugin add dsh-memo` 装到另一个项目。

**已确认的正式发布名：**

| 项 | 值 |
|---|---|
| 产品名 | 拾笺 / Shijian |
| npm 包名 | `dsh-slipnote` |
| GitHub 仓库 | [`zhanb767-create/dsh-slipnote`](https://github.com/zhanb767-create/dsh-slipnote) |
| 侧栏 / 模块 id | `dsh-slipnote` |
| 数据目录 | 继续用 `$DSH_HOME/dsh-memo`，升级时保留已有笔记 |

`dsh-slipnote` 在 npm 上当前未被占用（2026-11-19 查询返回 404），GitHub 仓库
`zhanb767-create/dsh-slipnote` 也还没有创建（404）。

## 2. 发布前必须补齐

### 2.1 仓库

- 公开 GitHub 仓库，README、LICENSE 齐全。
- 仓库加 topic：`dsh-plugin`（再加 `dsh`、`deepseek-harness` 更好）。
- 仓库创建满 **1 天**后才能过目录 CI；可以今天建仓，明天提 PR。
- 仓库根目录就是插件包（`package.json`、`index.js`、`client.js`、`cordis.patch.yml`）。

> 不要求先发布 npm。目录条目按 `github:owner/repo` 安装；npm 只是可选的下载量展示。
> 如果之后发布 npm，包的 `repository` 必须回指这个 GitHub 仓库，否则两者不会关联。

### 2.2 `package.json`

当前已经改为：

```jsonc
{
  "name": "dsh-slipnote",
  "version": "0.2.0",
  "type": "module",
  "license": "MIT",
  "displayName": "拾笺",
  "description": "拾笺：DeepSeek Harness 的备忘录与分阶段计划面板，支持对话快照、图片、标签、搜索与送入输入框。",
  "author": "zhanb767-create",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/zhanb767-create/dsh-slipnote.git"
  },
  "homepage": "https://github.com/zhanb767-create/dsh-slipnote#readme",
  "bugs": {
    "url": "https://github.com/zhanb767-create/dsh-slipnote/issues"
  },
  "engines": {
    "dsh": ">=0.2.2-0 <0.3.0-0"
  }
}
```

`private` 已移除。`engines.dsh` 让 dshmarket 显示兼容性；本插件在 DSH
`0.2.2-rc.1` 上开发和测试，上面的范围覆盖该版本。

### 2.3 代码内改名

已同步：

- `client.js` 顶部 `window.__ModuleLoader__.load({ id: 'dsh-slipnote', ... })`
- `cordis.patch.yml`：`id: dsh-slipnote`、`name: 'dsh-slipnote'`
- `index.js`：`export const name = 'dsh-slipnote'`
- `tests/client.test.js`、`tests/hygiene.test.js`、`tests/mount.test.js`
- `scripts/install.ps1` / `scripts/uninstall.ps1`
- `README.md` 的安装命令
- 侧栏/面板 id 与消息动作 id 都是 `dsh-slipnote`

数据目录仍是 `$DSH_HOME/dsh-memo`；这是有意保留的兼容路径，不是漏改。

### 2.4 图标与截图

- 目录条目的 `icon` 必须是 **GitHub 托管的位图**（png/jpg/webp），不能是 SVG。
  本仓库已有 `assets/icon-180.png`，可直接用。
- 详情页截图可选，但建议放。在仓库根目录（`package.json` 旁）新建 `screenshots.json`，
  列出 1-8 张仓库内图片的相对路径：

```json
[
  "assets/screenshot-notes.png",
  "assets/screenshot-plans.png"
]
```

也支持命名形式 `{"screenshots": ["assets/screenshot-notes.png"]}`。
路径相对 `screenshots.json`，不能以 `/` 开头或含 `..`；图片必须已经提交到 GitHub。

也可以写 GitHub 托管的 https 绝对 URL，但只接受 `raw.githubusercontent.com`、
`user-images.githubusercontent.com`、`camo.githubusercontent.com`、`github.com` 附件。

截图必须是真实界面，不要用示意图冒充实机截图。没有截图就省略 `screenshots.json`；
市场会回退到 README 里的图片，再回退到图标/作者头像。

## 3. 提交到目录

Fork `awesome-dsh-plugin/awesome-dsh-plugin`，只新增一个文件：

`data/plugins/zhanb767-create__dsh-slipnote.yml`

```yaml
url: https://github.com/zhanb767-create/dsh-slipnote
name: zhanb767-create/dsh-slipnote
category: ui
description:
  en: "Shijian: sidebar memoranda and staged plans with tags, search, conversation snapshots, image notes, and hand-off to the composer."
  zh: "拾笺：在侧栏管理备忘录与分阶段计划，支持标签、搜索、对话快照、图片备忘录与送入输入框。"
icon: https://raw.githubusercontent.com/zhanb767-create/dsh-slipnote/main/assets/icon-180.png
```

说明：

- `description.en` 必填，以英文句号结尾。
- 含 `: ` 的 YAML 值要加引号（上面已加）。
- `category` 可选值见贡献指南；本插件建议 `ui`，如果维护者认为更偏任务管理，也可能归到 `workflow`。
- `name` 是列表里的链接文字，不是产品名。
- `icon` 可选；不写会回退到 GitHub 头像。
- 不要手工改两个 README；它们由 `data/plugins/*.yml` 生成。

PR 标题示例：

```text
Add zhanb767-create/dsh-slipnote (ui)
```

PR 描述里写清楚：

- 仓库已满 1 天、已加 `dsh-plugin` topic；
- `dsh plugin add github:zhanb767-create/dsh-slipnote` 可安装；
- 插件做什么、依赖什么、数据写到哪里；
- 已跑过的测试命令和结果。

## 4. 发布前自检

### 4.1 干净安装

在一个干净 profile 或另一台机器上：

```sh
dsh plugin --profile desktop add github:zhanb767-create/dsh-slipnote
```

然后**完全退出 DSH 再重启**，确认：

- 侧栏出现「拾笺」；
- 备忘录 CRUD、图片、快照、送入输入框都正常；
- 卸载后不残留 bundle 行。

### 4.2 用 doctor 自检

`dsh-plugin-doctor` 覆盖目录的机械规则（manifest、patch 行、peer range、repo age、topic 等）：

```sh
dsh plugin --profile desktop add github:Tim-ReJet/dsh-plugin-doctor
```

然后让 agent 调 `plugin_doctor`，或在仓库里跑它的 CLI。它不能替代真机 UI 验证。

### 4.3 让 dshmarket 识别

目录 PR 合并后，dshmarket 从 registry 同步；在市场里搜索「拾笺」或 `dsh-slipnote`。
如果刚合并还没出现，通常是同步缓存，不是安装失败。

## 5. 当前状态清单

| 项 | 状态 |
|---|---|
| `dsh.bundle.patch` | ✅ 已有 |
| `cordis.patch.yml` 可安装 | ✅ 已有 |
| 客户端单文件 bundle | ✅ 已有 |
| 无构建脚本 / 无第三方运行时依赖 | ✅ 已有 |
| README / LICENSE / 测试 | ✅ 已有 |
| 180px 位图图标 | ✅ 已生成 `assets/icon-180.png` |
| 包名去冲突（`dsh-slipnote`） | ✅ 已改 |
| `repository` / `homepage` / `bugs` | ✅ 已填 |
| `engines.dsh` | ✅ 已加 |
| GitHub 仓库 + `dsh-plugin` topic | ❌ 待创建 |
| 目录 YAML + PR | ❌ 待提交 |
| 实机截图 | ⚠️ 可选，当前没有 |

最后一项“实机截图”需要重启 DSH 后从真实面板截取；不要用测试 fixture 代替。
