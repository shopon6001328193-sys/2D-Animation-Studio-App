# Daily AI YouTube Shorts

This automation runs once per day at 09:00 India time (03:30 UTC) and can be started manually from GitHub Actions.

## What it does

1. Uses OpenAI web search to find a current trend.
2. Turns that trend into an original Bengali animal-comedy concept.
3. Generates five original vertical images with GPT Image 2.
4. Generates Bengali narration with TTS-1.
5. Builds a 720x1280 MP4 with FFmpeg.
6. Uploads it to the connected YouTube channel using OAuth 2.0.
7. Marks the upload as containing synthetic media.

The workflow defaults to **private** uploads so the first runs can be reviewed safely. Change the `YOUTUBE_PRIVACY` workflow environment value to `public` only after testing.

## Required GitHub Actions secrets

Add these repository secrets under **Settings → Secrets and variables → Actions**:

- `OPENAI_API_KEY` — OpenAI API key with API billing/usage enabled.
- `YOUTUBE_CLIENT_ID` — Google OAuth client ID for a Web application.
- `YOUTUBE_CLIENT_SECRET` — matching Google OAuth client secret.
- `YOUTUBE_REFRESH_TOKEN` — refresh token obtained after authorizing the YouTube channel.

The OAuth scope used by the uploader is only:

`https://www.googleapis.com/auth/youtube.upload`

Never commit API keys, OAuth client secrets, refresh tokens, or `client_secret.json` to the repository.

## YouTube OAuth setup

Create a Google Cloud project, enable **YouTube Data API v3**, create OAuth credentials, and authorize the account that owns the channel. The refresh token is then stored as the GitHub secret above.

Google documents that OAuth 2.0 can authorize an application to upload videos while keeping the user's Google password private, and the `youtube.upload` scope is specifically for managing YouTube videos.

## Cost note

OpenAI image generation and speech generation are paid API services. GitHub Actions may also have usage limits depending on the account. The workflow is intentionally one video per day.

## Important

This creates original AI media; it does not download or re-upload other creators' videos. Viral research is used only for topic inspiration. Copyrighted footage, logos, celebrity likenesses, and existing characters are excluded by the content prompt.
