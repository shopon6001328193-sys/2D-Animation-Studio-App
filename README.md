# Motion Studio

A browser-only, mobile-friendly 2D frame animation editor. It has no build step,
backend, tracking, or third-party assets.

## Run it

Open `index.html` in a modern browser, or serve the folder for the most reliable
file import/export behavior:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## What it does

- Draw, erase, and create lines, rectangles, and circles on independent layers.
- Add, duplicate, delete, and reorder frames; control playback FPS and enable
  onion skinning.
- Resize or recolor the brush, zoom the drawing surface, undo/redo, save the
  editable project as JSON, reopen a saved project, place image or character
  assets on their own layers, and export every animation frame as a PNG.
- Works with mouse, pen, and touch input.

## Project structure

- `index.html` — accessible editor layout and controls.
- `styles.css` — responsive dark editor interface.
- `app.js` — modular state, renderer, drawing interaction, timeline, persistence,
  and export modules.

## Extending it

The frame model stores each layer as a PNG data URL, so it can be extended with
vector paths/character rigs, imported images, audio tracks, text and stickers.
The compositing function in `app.js` is also the natural integration point for a
WebCodecs/MediaRecorder MP4 or GIF encoder and Android WebView packaging.
