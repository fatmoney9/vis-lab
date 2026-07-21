# 参与协作

本项目采用轻量 GitHub Flow：`main` 始终保持可发布，每项任务从最新 `main` 建独立分支，通过 Pull Request 合并。
架构、分层和规范权威位置以 [WORKFLOW.md](WORKFLOW.md) 为准，本文件只说明协作流程。

## 开始前

本地需要 Git、Node.js 和 Python 3。首次克隆后启用仓库自带的提交门禁：

```bash
git config core.hooksPath hooks
```

启动 Preview：

```bash
python3 -m http.server 8123
```

访问 `http://localhost:8123/playground/cartesian-preview.html`。

## 领取任务与建分支

1. 先创建或领取一个 Issue，写清对应的规范 ID 和验收标准。
2. 一个分支只处理一个明确能力或一组不可拆分的规范 ID。
3. 从最新 `main` 建分支：

```bash
git switch main
git pull --ff-only
git switch -c feat/tooltip-12-touch
```

分支前缀统一使用：

- `feat/`：新增能力
- `fix/`：缺陷修复
- `docs/`：仅文档
- `chore/`：工程和仓库维护

## 修改边界

- 规范定义写在 `specs/`，实现注释通过稳定 ID 回引。
- token 权威源是 `tokens/*.json`；不要手改生成文件 `tokens/tokens.css`。
- 通用构件放 `charts/core/`，图表编排放 `charts/charts/`，Preview 不临场拼装生产图表。
- 任何规则变化都要同步检查 PC / 移动端、亮色 / 深色以及三个主题。

## 提交前验证

修改 token 后先重建：

```bash
node tokens/build.mjs
```

所有提交至少运行：

```bash
sh hooks/lint-layers.sh
node hooks/lint-spec-ids.mjs
```

Git 提交信息使用中文，标题说明结果，例如：

```text
修复滚动时 Tooltip 未隐藏的问题
```

不要绕过 `pre-commit`。如果门禁修改了 `tokens/tokens.css`，应把生成结果与源 token 放在同一提交。

## Pull Request

- 禁止直接向 `main` 推送功能代码；从个人分支创建 PR。
- PR 标题和说明使用中文，并关联对应 Issue / Spec ID。
- 填完 PR 模板中的验证项；视觉变化附 Preview 截图。
- 合并前保持改动聚焦，解决审查意见，并确保“质量门禁”通过。
- 优先使用 Squash merge，让一个 PR 在 `main` 上形成一个清晰提交。

`main` 会发布 GitHub Pages，因此合并即进入发布链路；未完成或未验证的能力不要提前合并。
