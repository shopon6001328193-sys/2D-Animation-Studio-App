import base64
import json
import os
import subprocess
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from openai import OpenAI

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
WORK.mkdir(parents=True, exist_ok=True)

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
YOUTUBE_CLIENT_ID = os.environ["YOUTUBE_CLIENT_ID"]
YOUTUBE_CLIENT_SECRET = os.environ["YOUTUBE_CLIENT_SECRET"]
YOUTUBE_REFRESH_TOKEN = os.environ["YOUTUBE_REFRESH_TOKEN"]
YOUTUBE_PRIVACY = os.getenv("YOUTUBE_PRIVACY", "private")

client = OpenAI(api_key=OPENAI_API_KEY)


def ask_for_content():
    prompt = """
You are the content director for a Bengali YouTube Shorts channel.
Use web search to find current viral/trending themes from the last 24-72 hours, but do NOT copy any existing video's script, footage, title, thumbnail, characters, or copyrighted material.
Choose one trend that can be transformed into a completely original AI animal-comedy short.
Prefer simple, visual, family-safe stories that work without context.
Return ONLY valid JSON with this exact shape:
{
  "title": "...",
  "description": "...",
  "hashtags": ["#..."],
  "tags": ["..."],
  "narration": "Bangla narration, 55-80 words",
  "scenes": [
    {"prompt": "vertical 9:16 visual prompt", "duration": 4},
    {"prompt": "vertical 9:16 visual prompt", "duration": 4},
    {"prompt": "vertical 9:16 visual prompt", "duration": 4},
    {"prompt": "vertical 9:16 visual prompt", "duration": 4},
    {"prompt": "vertical 9:16 visual prompt", "duration": 4}
  ]
}
Keep the same main animal and visual identity across all scenes. Make the story original and comedic. Do not mention real people, copyrighted characters, movie/game characters, or existing brands.
"""
    response = client.responses.create(
        model="gpt-5.6-luna",
        tools=[{"type": "web_search_preview"}],
        input=prompt,
    )
    text = response.output_text.strip()
    if text.startswith("```"):
        text = text.strip("`").replace("json\n", "", 1).strip()
    return json.loads(text)


def generate_image(prompt: str, path: Path):
    result = client.images.generate(
        model="gpt-image-2",
        prompt=(
            "Create an original vertical 9:16 cinematic AI illustration for a YouTube Short. "
            "No text, no logos, no watermark, no real person, no copyrighted character. "
            "Consistent orange street cat protagonist, expressive face, realistic but playful Indian roadside setting. "
            + prompt
        ),
        size="1024x1536",
        quality="low",
    )
    data = result.data[0].b64_json
    path.write_bytes(base64.b64decode(data))


def generate_voice(text: str, path: Path):
    speech = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text,
        response_format="mp3",
    )
    speech.write_to_file(path)


def run_ffmpeg(args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def render_video(scene_paths, audio_path, output_path):
    clips = []
    for i, image_path in enumerate(scene_paths):
        clip = WORK / f"scene_{i}.mp4"
        clips.append(clip)
        run_ffmpeg([
            "-loop", "1", "-i", str(image_path),
            "-t", "4",
            "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,format=yuv420p",
            "-r", "30",
            "-an", str(clip),
        ])

    concat_file = WORK / "concat.txt"
    concat_file.write_text("\n".join(f"file '{p.as_posix()}'" for p in clips), encoding="utf-8")
    silent_video = WORK / "silent.mp4"
    run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", str(silent_video)])
    run_ffmpeg([
        "-i", str(silent_video),
        "-i", str(audio_path),
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        str(output_path),
    ])


def youtube_service():
    scopes = ["https://www.googleapis.com/auth/youtube.upload"]
    creds = Credentials(
        token=None,
        refresh_token=YOUTUBE_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=YOUTUBE_CLIENT_ID,
        client_secret=YOUTUBE_CLIENT_SECRET,
        scopes=scopes,
    )
    return build("youtube", "v3", credentials=creds)


def upload_video(path: Path, content):
    youtube = youtube_service()
    body = {
        "snippet": {
            "title": content["title"][:100],
            "description": content["description"] + "\n\n" + " ".join(content["hashtags"]),
            "tags": content["tags"][:500],
            "categoryId": "24",
        },
        "status": {
            "privacyStatus": YOUTUBE_PRIVACY,
            "selfDeclaredMadeForKids": False,
            "containsSyntheticMedia": True,
        },
    }
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=MediaFileUpload(str(path), mimetype="video/mp4", resumable=True),
    )
    response = None
    while response is None:
        _, response = request.next_chunk()
    print("Uploaded video:", response.get("id"))


def main():
    content = ask_for_content()
    (WORK / "content.json").write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")

    scene_paths = []
    for i, scene in enumerate(content["scenes"]):
        image_path = WORK / f"image_{i}.png"
        generate_image(scene["prompt"], image_path)
        scene_paths.append(image_path)

    audio_path = WORK / "narration.mp3"
    generate_voice(content["narration"], audio_path)

    output_path = WORK / "output.mp4"
    render_video(scene_paths, audio_path, output_path)
    upload_video(output_path, content)


if __name__ == "__main__":
    main()
