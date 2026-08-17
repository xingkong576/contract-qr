# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

### Agnès AI 视频生成（2026-06-06 新增）

- **脚本**: `agnes-video.mjs`（workspace 根目录）
- **创建任务**: `POST https://apihub.agnes-ai.com/v1/videos`
- **查询任务**: `GET https://apihub.agnes-ai.com/agnesapi?video_id=<ID>`
- **模型**: `agnes-video-v2.0`
- **Auth**: Bearer Token
- **用法**: `node agnes-video.mjs <图片URL> "提示词" [输出文件名]`
- **说明**: 图生视频，提交后自动轮询等待完成并下载
- **约束**: 图片需公网 URL(PNG/JPEG,≤5MB)，宽高 64 的倍数，提示词 100-300 字
- **输出字段**: 视频 URL 可能在 `remixed_from_video_id` 字段（非标准字段名）

### Agnès AI 图片生成（2026-06-05 新增）

- **脚本**: `agnes-image.mjs`（workspace 根目录）
- **API**: `POST https://apihub.agnes-ai.com/v1/images/generations`
- **模型**: `agnes-image-2.0-flash`
- **Auth**: Bearer Token (API key 内置于脚本中)
- **用法**: `node agnes-image.mjs "提示词" [输出文件名]`
- **说明**: 由于 OpenClaw 的 `image_generate` 工具只支持注册的插件 provider（openai、fal、deepinfra 等），Agnès 没有对应插件，所以需要通过脚本直接调用 API
- **兼容性**: Agnès 的 `/v1/images/generations` 是标准 OpenAI 兼容接口

### ⚠️ 浏览器登录态注意事项（2026-06-04 新增）

- **登录态不稳定**：豆包/头条号/小红书 三个平台的登录态文件可能在加载后仍然显示未登录
- **排查步骤**：
  1. `state load <file>` → `screenshot` 确认是否登录
  2. 如果未登录：`open URL` + `state load <file>` → `screenshot` 再确认
  3. 仍不行：手动打开浏览器重新登录，然后 `state save <file>`
- **每次操作成功后**：务必 `state save` 保存最新登录态
- 如果连续两次自动登录失败，考虑用 agent-browser 技能做自动化登录流程

### 豆包 (Doubao) - 自动化操作

- **URL**: https://www.doubao.com/chat/
- **浏览器**: agent-browser 内置 Chromium（与 Edge 同内核）
- **登录状态文件**: `C:\Users\Administrator\.openclaw\workspace\doubao_auth.json`
- **工作流程**:
  1. `agent-browser open "https://www.doubao.com/chat/"`
  2. `agent-browser state load doubao_auth.json`（加载登录态）
  3. 刷新/打开页面后即可直接使用，无需手动登录
  4. 用 `agent-browser type textarea "指令内容"` 输入文本
  5. `agent-browser press Enter` 发送
  6. 等待响应后，从 iframe 获取文档内容：`document.querySelectorAll('iframe')[0].contentDocument.body.innerText`
- **说明**: 创作内容会渲染在飞书文档 iframe 中，需通过 contentDocument 提取
- **注意**: 刷新页面后需要重新 load state，否则登录态会丢失

### 头条号 (Toutiao) - 文章发布

- **URL**: https://mp.toutiao.com/
- **浏览器**: agent-browser 内置 Chromium（与 Edge 同内核）
- **登录状态文件**: `C:\Users\Administrator\.openclaw\workspace\toutiao_auth.json`
- **发布页面**: `https://mp.toutiao.com/profile_v4/graphic/publish`
- **文章管理页面**: `https://mp.toutiao.com/profile_v4/graphic/manage`
- **工作流程**:
  1. `agent-browser open "https://mp.toutiao.com/"`
  2. `agent-browser state load toutiao_auth.json`（加载登录态）
  3. 导航到发布页：`agent-browser open "https://mp.toutiao.com/profile_v4/graphic/publish"`
  4. 填入标题：`agent-browser type textbox[placeholder*="标题"] "标题内容"`
  5. 填入正文：找到 `div[contenteditable]`，用 eval 设置 innerHTML 为 `<p>段落</p>` 格式
  6. 选择无封面：找 text 包含「无封面」的元素 click()
  7. 勾选「引用AI」：找到 `checkbox[text*="引用AI"]` 并 click()
  8. 点击「预览并发布」按钮：`agent-browser eval "document.querySelector('button.publish-btn-last')?.click()"`
- **说明**:
  - ⚠️ **头条号已取消「存草稿」按钮**，只有「预览」「定时发布」「预览并发布」三个按钮，页面提示「草稿将自动保存」只是浏览器端缓存，关闭页面即丢失
  - 发布后页面清空重置即为成功
  - 发布 API：POST /mp/agw/article/publish 返回 200
  - 可能弹出滑块验证码，需人工处理

### 小红书 (Xiaohongshu) - 笔记发布

- **URL**: https://creator.xiaohongshu.com/
- **浏览器**: agent-browser 内置 Chromium
- **登录状态文件**: `C:\Users\Administrator\.openclaw\workspace\xiaohongshu_auth.json`
- **工作流程**:
  1. 打开小红书创作平台：`agent-browser open "https://creator.xiaohongshu.com/"`
  2. 加载登录态：`agent-browser state load xiaohongshu_auth.json`
  3. 导航到写长文：`agent-browser open "https://creator.xiaohongshu.com/publish/publish?from=menu&target=article"`
  4. 点击「新的创作」：`agent-browser eval 找到按钮并 click()`
  5. 填写标题：`agent-browser type textarea[placeholder*="标题"] "标题内容"`
  6. 填写正文：`agent-browser eval 设置 .ProseMirror.innerHTML`
  7. 点击「一键排版」：通过 JS 找到按钮 click()
  8. 等待5秒
  9. 点击「下一步」：通过 JS 找到按钮 click()
  10. 等待5秒
  11. 发布：`agent-browser eval "document.querySelector('xhs-publish-btn')._onPublish()"`
- **说明**:
  - 标题有字数限制（截图显示 26/64，即最多约64字符）
  - 正文通过 ProseMirror 富文本编辑器写入，需用 `.innerHTML = '<p>...</p>'` 或 `.innerText`
  - ⚠️ **必须先点「一键排版」→「下一步」**，发布按钮才会出现在页面上
  - 发布按钮是 Vue 自定义组件 `<xhs-publish-btn>`，`submit-text="发布"`，通过调用其内部方法 `_onPublish()` 触发
  - 发布成功后页面跳转，笔记出现在笔记管理列表的「审核中」状态
  - 状态文件：每次成功操作后 `agent-browser state save xiaohongshu_auth.json` 保存

### A股实时监控

- **脚本**: `scripts/astock-monitor.mjs`
- **数据源**: 东方财富免费API（无需API Key）
- **用法**:
  - `node astock-monitor.mjs pool` — 生成优质股票池（盘前）
  - `node astock-monitor.mjs update` — 盘中行情更新
  - `node astock-monitor.mjs snapshot` — 板块热点
  - `node astock-monitor.mjs watch 1.600519` — 查询个股
  - `node astock-monitor.mjs all` — 全市场日报
- **数据存储**: `astock-data/` 目录
- **策略**: 涨幅榜TOP + 成交额TOP + 概念板块
- **状态**: ⚠️ cron定时任务模块有bug，需等gateway修复后创建

## Related

- [Agent workspace](/concepts/agent-workspace)
