---
name: "agnes-video"
description: "使用 Agnes Video V2.0 API 进行图生视频，支持自定义提示词、图片、分辨率等参数。"
---

# Agnes Video V2.0 技能

## 概述

通过 OpenClaw 的 `video_generate` 工具调用 Agnes Video V2.0 API 进行图生视频。

## API 信息

- **文档**：https://agnes-ai.com/doc/agnes-video-v20
- **端点**：
  - 创建视频任务：`POST https://apihub.agnes-ai.com/v1/videos`
  - 查询结果：`GET https://apihub.agnes-ai.com/agnesapi?video_id=<VIDEO_ID>`（每 5 秒查询）

## 认证

- **Header**：`Authorization: Bearer sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI`

## 使用方式

### 方法一：使用 `video_generate` 工具（推荐）

这是最简化的方式，直接调用 OpenClaw 内置的 `video_generate` 工具即可。

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | `agnes/agnes-video-2.0` |
| image | string | 是 | 图片 URL（公网可访问，PNG/JPEG，≤5MB） |
| prompt | string | 是 | 中文/英文，100-300字，描述主体动作+场景+风格 |
| resolution | string | 否 | 分辨率：360P/480P/540P/720P/1080P/4K |
| durationSeconds | integer | 否 | 视频时长（秒），默认10 |
| aspectRatio | string | 否 | 宽高比：1:1/16:9/9:16 |
| audio | boolean | 否 | 是否生成音频 |
| timeoutMs | integer | 否 | 超时时间（毫秒） |

#### 示例

```
video_generate(
  model="agnes/agnes-video-2.0",
  image="https://example.com/photo.png",
  prompt="一只可爱的黑猫，绿色眼睛看镜头，缓慢眨眼，尾巴轻摆，温馨氛围",
  resolution="720P",
  durationSeconds=10
)
```

### 方法二：直接调用 API（高级）

当需要更精细控制时使用。

#### 创建任务

```bash
curl -X POST https://apihub.agnes-ai.com/v1/videos \
  -H "Authorization: Bearer sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-video-v2.0",
    "prompt": "描述...",
    "image": "https://...",
    "num_frames": 121,
    "frame_rate": 24
  }'
```

#### 查询结果

```bash
curl -H "Authorization: Bearer sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI" \
  "https://apihub.agnes-ai.com/agnesapi?video_id=<VIDEO_ID>"
```

## 关键约束

1. 图片必须是公网 URL（HTTP/HTTPS），仅支持 PNG 和 JPEG
2. 单张图片大小不超过 5MB
3. 宽度和高度必须是 64 的倍数（如 1024x576, 1280x768）
4. 总帧数必须满足 `8n + 1` 公式，且 ≥ 121
5. 推荐帧率：24 或 30 FPS
6. 提示词：中文或英文，100-300字
7. 输出：MP4 格式，H.264 编码
8. 视频链接有效期：24-48小时，请及时下载

## 生成时间

10秒视频约 1-3 分钟

## 常见问题

### 视频排队时间长

- 之前遇到任务卡在 `queued` 状态，可能是 API 端排队
- 如果长时间未返回，可重新提交任务

### 图片格式问题

- 只支持 PNG/JPEG，其他格式会失败
- 图片必须是公网 URL（http/https）

## 注意事项

- 使用 `video_generate` 工具时，不要重复调用（已有后台任务在运行时）
- 等待 completion event 后报告结果
- 视频链接有效期短，建议及时保存
