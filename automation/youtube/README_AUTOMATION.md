# Daily YouTube Shorts automation

This workflow can generate up to 5 original AI Shorts per daily run and upload them to YouTube. It uses GitHub Actions as the runner, OpenAI APIs for content/image/voice generation, FFmpeg for rendering, and YouTube OAuth for upload.

Required GitHub Actions secrets:
- OPENAI_API_KEY
- YOUTUBE_CLIENT_ID
- YOUTUBE_CLIENT_SECRET
- YOUTUBE_REFRESH_TOKEN

Uploads default to private until the workflow is tested successfully.
