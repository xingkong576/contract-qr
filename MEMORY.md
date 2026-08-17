# MEMORY.md

## 🧠 能力记录

### Agnès Video V2.0 API — 完整记录

**2026-06-05 建立** — 图生视频 API，使用黑猫照片生成视频。

**文档**：https://agnes-ai.com/doc/agnes-video-v20

**API 端点**：
- **创建视频任务**: `POST https://apihub.agnes-ai.com/v1/videos`
- **查询视频结果**: `GET https://apihub.agnes-ai.com/agnesapi?video_id=<VIDEO_ID>`（每 5 秒查询一次）

**认证**：
- Header: `Authorization: Bearer <API_KEY>`
- API Key: `sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI`

**图生视频参数（重要）**：
```json
{
  "model": "agnes-video-v2.0",
  "prompt": "一只可爱的黑猫，绿色的眼睛看着镜头，缓慢眨眼，耳朵偶尔抖动，尾巴轻轻摇摆，温馨舒适的氛围，电影级灯光，缓慢平静的动作",
  "image": "https://i.ibb.co/TxH5YnJF/assistant-media.png",  // 必须是公网可访问的 URL
  "num_frames": 121,
  "frame_rate": 24
}
```

**关键约束**：
1. **图片必须是公网 URL**（HTTP/HTTPS），仅支持 PNG 和 JPEG
2. **单张图片大小不超过 5MB**
3. **宽度和高度必须是 64 的倍数**（例如 1024x576, 1280x768）
4. **总帧数必须满足 `8n + 1` 公式，且 >= 121**
5. **推荐帧率**：24 或 30 FPS
6. **提示词**：中文或英文，100-300 字，描述主体动作+场景背景+风格
7. **输出**：MP4 格式，H.264 编码
8. **视频链接有效期**：24-48 小时，请及时下载

**生成时间**：10 秒视频约 1-3 分钟

**⚠️ 当前状态**：
- API Key 已验证有效
- 黑猫照片 URL：`https://i.ibb.co/TxH5YnJF/assistant-media.png`（1.4MB, PNG）
- 视频任务已提交：`task_6sxCUT3DajQHT3Tp2N9HXcvpoSaQdgiZ`
- 任务状态：`queued`，进度 0
- **问题**：Agnes API 排队时间过长（30% 处卡了约 2 分钟），但最终还是能生成
- **最新结果**：2026-06-06 成功生成黑猫视频
  - 视频 URL：`video_7e830d26fa3dfe606109c099a75737749df3cd7357dff62d`
  - 大小：1280x768
  - 时长：5 秒（比请求的 10 秒短）
  - 状态：`completed`
  - **注意**：视频 URL 在响应字段 `remixed_from_video_id` 中（非标准字段名）
  - 脚本：`agnes-video.mjs`（原理同 `agnes-image.mjs`）

### 写作素材库

**2026-06-04 建立** — 用于头条号和小红书的每日写作素材。

- 素材来源：`memory/YYYY-MM-DD-daily.md`（每日热点汇总）
- 头条号：民生热点类，早 8 点、下午 5 点发布
- 小红书：AI工具、职场效率、自我提升、打工人日常
- 使用过的话题：AI效率工具合集、成本微习惯
- 详见 `TOOLS.md`

## 📝 经验教训

### 2026-06-04 浏览器登录态问题
- **问题**：agent-browser 加载登录态文件后，豆包/头条号/小红书可能仍然显示未登录状态
- **原因**：可能是页面刷新导致 session 失效，或 Chromium profile 与登录态文件不同步
- **对策**：
  1. 每次操作前用 screenshot 确认登录状态
  2. 如果未登录，重新 `state load` + 刷新
  3. 极端情况需要手动重新登录
  4. **重要**：操作成功后立即 `state save` 保存登录态
  5. 如果连续两次无法自动登录，考虑用 agent-browser 技能（browser-automation）做自动化登录流程

### 2026-06-04 定时任务缺失
- **问题**：USER.md 中提到每天早9点/下午4点发小红书、早8点/下午5点发头条号，但 cron 中无任何定时任务
- **对策**：已创建4个 cron 定时任务（见下方记录）

### 文件编码问题
- 某些 daily notes 文件可能存在 GBK/UTF-8 编码不一致问题
- 写文件时统一用 UTF-8
