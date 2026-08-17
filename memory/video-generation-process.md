# 视频生成过程记录 — 2026-06-06

## 目标
使用 Agnes Video V2.0 API 完成图生视频全流程，并固化成可复用技能。

## 素材
- **图片**：黑猫（`https://i.ibb.co/TxH5YnJF/assistant-media.png`，1.4MB, PNG, 1024x576）
- **提示词**："一只可爱的黑猫，绿色的眼睛看着镜头，缓慢眨眼，耳朵偶尔抖动，尾巴轻轻摇摆，温馨舒适的氛围，电影级灯光，缓慢平静的动作"
- **输出**：`cat_video.mp4`（1280x768, 5 秒, 876KB）

## 过程

### Step 1: 创建 Agnes Video 技能提案
- 通过 `skill_workshop action=create` 创建 `agnes-video` 技能
- 写入完整 API 文档、参数说明、约束条件
- 状态：pending → 最终通过

### Step 2: 编写 Python 脚本
- 路径：`agnes-video.mjs`（workspace 根目录）
- 基于 `agnes-image.mjs` 模板，改为图生视频流程
- 功能：
  - 调用 `POST /v1/videos` 创建任务
  - 调用 `GET /agnesapi?video_id=<ID>` 轮询结果（5秒间隔）
  - 自动下载视频并保存到本地
- 遇到的问题：
  - `.mjs` 文件需用 `import` 不能用 `require`，已修复
  - 视频 URL 在 `remixed_from_video_id` 字段（非标准 `video_url`），已修复

### Step 3: 执行生成
- 命令：`node agnes-video.mjs <图片URL> <提示词> output.mp4`
- 任务 ID：`video_bGl0ZWxsbTpjdXN0b21fbGxtX3Byb3ZpZGVyOm9wZW5haTttb2RlbF9pZDphZ25lcy12aWRlby12Mi4wO3ZpZGVvX2lkOnZpZGVvXzdlODMwZDI2ZmEzZGZlNjA2MTA5YzA5OWE3NTczNzc0OWRmM2NkNzM1N2RmZjYyZA==`
- 状态变化：queued → in_progress(10%) → in_progress(30%) → 等待约 2 分钟 → in_progress(80%) → completed(100%)
- 耗时：约 3 分钟

### Step 4: 验证
- 下载成功，文件大小 876KB
- 分辨率：1280x768
- 时长：5 秒（请求 10 秒，API 实际返回 5 秒）

## 关键发现

### 1. API 字段命名不规范
- 视频 URL 在 `remixed_from_video_id` 字段，而非标准 `video_url`
- 脚本需兼容多个可能的字段名

### 2. 排队时间长
- 30% 进度处常卡 1-2 分钟
- 建议在等待时提示用户"正在排队/生成中"

### 3. 视频时长
- 请求 10 秒，实际返回 5 秒
- 可能跟图片分辨率或模型设置有关

### 4. 模型配置
- `video_generate` 工具不支持注册的 Agnes provider
- 通过脚本直接调 API 是最可靠的方式

## 文件清单
| 文件 | 说明 |
|------|------|
| `agnes-video.mjs` | 视频生成脚本 |
| `agnes-image.mjs` | 图片生成脚本（同步修了 import） |
| `memory/video-generation-process.md` | 本文件 |
| `TOOLS.md` | 更新了 Agnes Video 说明 |
| `MEMORY.md` | 更新了能力记录 |

## 后续优化
- [ ] 增加重试机制（API 超时/失败时自动重试）
- [ ] 支持更多分辨率（1080P, 4K）
- [ ] 批量生成（传多张图批量生成）
- [ ] 添加进度条展示
