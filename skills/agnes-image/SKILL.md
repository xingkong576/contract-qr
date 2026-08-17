# Agnes Image & Video Generation Skill

Use when generating images or videos via Agnes AI API.

## Models Available

| Model ID | Type | Alias |
|----------|------|-------|
| `agnes-image-2.0-flash` | Text-to-Image / Image-to-Image | Agnes Image |
| `agnes-image-2.1-flash` | Text-to-Image (newer) | - |
| `agnes-video-v2.0` | Video Generation (async) | - |

## API Endpoints

Base URL: `https://apihub.agnes-ai.com/v1`

### Image Generation (Synchronous)

**Endpoint**: `POST /v1/images/generations`

**Required**: `prompt`
**Optional**: `model`, `quality`, `size`, `response_format`

**Body format (JSON)**:
```json
{"prompt": "a cat", "model": "agnes-image-2.0-flash"}
```

**Response**: Returns JSON with `data[].url` - the generated image URL

### Video Generation (Async)

**Endpoint**: `POST /v1/videos`

**Required**: `prompt`
**Optional**: `model`, `seconds`, `size`

**Body format (JSON)**:
```json
{"prompt": "a cat running", "model": "agnes-video-v2.0", "seconds": "5.0"}
```

**Response**: Returns `task_id`. Poll `GET /v1/tasks/{task_id}` to check status.

## How to Use

Use `exec` to call the API directly (since the built-in tools are tuned for OpenAI):

```powershell
# Image generation
$body = @'{"prompt": "a cute cat", "model": "agnes-image-2.0-flash"}'@
[byte[]]$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
[System.IO.File]::WriteAllBytes("C:\Users\Administrator\Desktop\img_body.json", $bytes)
curl.exe -s "https://apihub.agnes-ai.com/v1/images/generations" -H "Authorization: Bearer sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI" -H "Content-Type: application/json" --data-binary @"C:\Users\Administrator\Desktop\img_body.json"
```

## Tips

- Both image and video APIs are **100% free**
- Use English prompts for best results
- Image generation is synchronous (returns immediately)
- Video generation is async (returns task_id, need to poll)
- For image analysis (not generation), use the built-in `image` tool
