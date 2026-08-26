/* Motion Studio: browser-only, canvas-first frame animation editor. */
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const W = 800, H = 500, MAX_HISTORY = 40;
const makeCanvas = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
const blank = () => makeCanvas().toDataURL('image/png');
const freshLayer = (name = 'Layer 1') => ({ name, visible: true, image: blank() });
const newFrame = () => ({ layers: [freshLayer()] });
const state = { name: 'Untitled animation', fps: 12, frames: [newFrame()], frame: 0, layer: 0, tool: 'brush', color: '#7868ff', size: 8, zoom: 1, onion: false, playing: false, history: [], future: [] };
const draw = $('#drawCanvas'), below = $('#belowCanvas'), above = $('#aboveCanvas'), onion = $('#onionCanvas');
const ctx = draw.getContext('2d'), bctx = below.getContext('2d'), actx = above.getContext('2d'), octx = onion.getContext('2d');
[draw, below, above, onion].forEach(canvas => { canvas.width = W; canvas.height = H; });

const active = () => state.frames[state.frame];
const layer = () => active().layers[state.layer];
const imageCache = new Map();
function image(src) {
  if (!src) return Promise.resolve(null);
  if (!imageCache.has(src)) imageCache.set(src, new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src; }));
  return imageCache.get(src);
}
async function paintImage(target, src, ...args) { const img = await image(src); if (img) target.drawImage(img, ...args); }
const cloneFrames = () => JSON.stringify(state.frames);
function snapshot() { state.history.push(cloneFrames()); if (state.history.length > MAX_HISTORY) state.history.shift(); state.future = []; updateHistoryButtons(); }
function updateHistoryButtons() { $('#undo').disabled = !state.history.length; $('#redo').disabled = !state.future.length; }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 1800); }

let renderVersion = 0;
async function render() {
  const version = ++renderVersion;
  if (!active() || !layer()) return;
  bctx.clearRect(0, 0, W, H); actx.clearRect(0, 0, W, H); octx.clearRect(0, 0, W, H); ctx.clearRect(0, 0, W, H);
  const currentLayers = active().layers;
  for (let index = 0; index < currentLayers.length; index++) {
    const item = currentLayers[index];
    if (!item.visible || index === state.layer) continue;
    await paintImage(index < state.layer ? bctx : actx, item.image, 0, 0);
    if (version !== renderVersion) return;
  }
  if (state.onion && state.frame > 0) {
    octx.save(); octx.globalAlpha = .23;
    for (const item of state.frames[state.frame - 1].layers) { if (item.visible) { await paintImage(octx, item.image, 0, 0); if (version !== renderVersion) return; } }
    octx.restore();
  }
  if (layer().visible) await paintImage(ctx, layer().image, 0, 0);
  if (version !== renderVersion) return;
  renderLayers(); await renderFrames(version); if (version !== renderVersion) return;
  updateReadout(); updateHistoryButtons(); $('#frameLabel').textContent = `Frame ${String(state.frame + 1).padStart(2, '0')}`;
}
function updateReadout() { const duration = state.frames.length / state.fps; $('#timeReadout').textContent = `0:00 / 0:${String(Math.floor(duration)).padStart(2, '0')}`; }
function renderLayers() {
  $('#layerList').innerHTML = active().layers.map((item, index) => `<div class="layer-row ${index === state.layer ? 'active' : ''}" data-layer="${index}">
    <button class="eye" data-eye="${index}" aria-label="Toggle ${escapeHtml(item.name)} visibility">${item.visible ? '◉' : '○'}</button><input value="${escapeHtml(item.name)}" aria-label="Layer name"><span class="layer-actions"><button data-move="up" title="Move layer up" aria-label="Move layer up">↑</button><button data-move="down" title="Move layer down" aria-label="Move layer down">↓</button><button data-remove="${index}" title="Delete layer" aria-label="Delete layer">×</button></span></div>`).join('');
  $$('.layer-row').forEach(row => row.onclick = event => { if (!event.target.closest('input,button')) { state.layer = +row.dataset.layer; render(); } });
  $$('.eye').forEach(button => button.onclick = event => { event.stopPropagation(); snapshot(); active().layers[+button.dataset.eye].visible = !active().layers[+button.dataset.eye].visible; render(); });
  $$('.layer-row input').forEach((input, index) => input.onchange = () => { const name = input.value.trim() || `Layer ${index + 1}`; if (name !== active().layers[index].name) { snapshot(); active().layers[index].name = name; } renderLayers(); });
  $$('[data-move]').forEach(button => button.onclick = event => { event.stopPropagation(); const from = +button.closest('.layer-row').dataset.layer, to = from + (button.dataset.move === 'up' ? 1 : -1); if (to < 0 || to >= active().layers.length) return; snapshot(); [active().layers[from], active().layers[to]] = [active().layers[to], active().layers[from]]; state.layer = to; render(); });
  $$('[data-remove]').forEach(button => button.onclick = event => { event.stopPropagation(); if (active().layers.length === 1) return toast('Keep at least one layer'); snapshot(); active().layers.splice(+button.dataset.remove, 1); state.layer = Math.min(state.layer, active().layers.length - 1); render(); });
}
function escapeHtml(value) { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
async function renderFrames(version) {
  const strip = $('#frameStrip'); strip.innerHTML = '';
  for (let index = 0; index < state.frames.length; index++) {
    const button = document.createElement('button'); button.className = `frame ${index === state.frame ? 'active' : ''}`; button.innerHTML = `<canvas width="72" height="65"></canvas><small>Frame ${index + 1}</small>`; button.onclick = () => { state.frame = index; state.layer = 0; render(); }; strip.append(button);
    const preview = button.querySelector('canvas').getContext('2d');
    for (const item of state.frames[index].layers) { if (item.visible) { await paintImage(preview, item.image, 0, 0, 72, 65); if (version !== renderVersion) return; } }
  }
}

let drawing = false, start, base, pointerId;
function point(event) { const rect = draw.getBoundingClientRect(); return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height }; }
function setupStroke(at) { ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = state.size; ctx.strokeStyle = state.color; ctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : 'source-over'; ctx.beginPath(); ctx.moveTo(at.x, at.y); }
function drawShape(at) { ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0); setupStroke(start); if (state.tool === 'line') ctx.lineTo(at.x, at.y); else if (state.tool === 'rect') ctx.strokeRect(start.x, start.y, at.x - start.x, at.y - start.y); else if (state.tool === 'circle') ctx.ellipse(start.x, start.y, Math.abs(at.x - start.x), Math.abs(at.y - start.y), 0, 0, Math.PI * 2); ctx.stroke(); }
function begin(event) { if (!layer().visible) return toast('Show the selected layer before drawing'); event.preventDefault(); snapshot(); drawing = true; pointerId = event.pointerId; draw.setPointerCapture?.(pointerId); start = point(event); base = makeCanvas(); base.getContext('2d').drawImage(draw, 0, 0); setupStroke(start); if (state.tool === 'brush' || state.tool === 'eraser') { ctx.lineTo(start.x + .01, start.y + .01); ctx.stroke(); } }
function paint(event) { if (!drawing || event.pointerId !== pointerId) return; event.preventDefault(); const at = point(event); if (state.tool === 'brush' || state.tool === 'eraser') { ctx.lineTo(at.x, at.y); ctx.stroke(); } else drawShape(at); }
function finish(event) { if (!drawing || (event && event.pointerId !== pointerId)) return; drawing = false; if (draw.hasPointerCapture?.(pointerId)) draw.releasePointerCapture(pointerId); ctx.globalCompositeOperation = 'source-over'; layer().image = draw.toDataURL('image/png'); render(); }
draw.addEventListener('pointerdown', begin); draw.addEventListener('pointermove', paint); draw.addEventListener('pointerup', finish); draw.addEventListener('pointercancel', finish); draw.addEventListener('lostpointercapture', finish);

$$('.tool[data-tool]').forEach(button => button.onclick = () => { state.tool = button.dataset.tool; $$('.tool[data-tool]').forEach(item => item.classList.toggle('active', item === button)); });
$('#color').oninput = event => { state.color = event.target.value; $('#brushDot').style.background = state.color; };
$('#brushSize').oninput = event => { state.size = +event.target.value; $('#sizeOutput').value = `${state.size} px`; $('#brushDot').style.width = $('#brushDot').style.height = `${Math.max(5, state.size)}px`; };
function restore(frames) { state.frames = JSON.parse(frames); state.frame = Math.min(state.frame, state.frames.length - 1); state.layer = Math.min(state.layer, active().layers.length - 1); render(); }
$('#undo').onclick = () => { if (state.history.length) { state.future.push(cloneFrames()); restore(state.history.pop()); } };
$('#redo').onclick = () => { if (state.future.length) { state.history.push(cloneFrames()); restore(state.future.pop()); } };
$('#clearCanvas').onclick = () => { snapshot(); layer().image = blank(); render(); };
$('#addLayer').onclick = () => { snapshot(); active().layers.push(freshLayer(`Layer ${active().layers.length + 1}`)); state.layer = active().layers.length - 1; render(); };
function addFrame(copy = false) { snapshot(); state.frames.splice(state.frame + 1, 0, copy ? JSON.parse(JSON.stringify(active())) : newFrame()); state.frame++; state.layer = 0; render(); }
$('#addFrame').onclick = () => addFrame(); $('#duplicateFrame').onclick = () => addFrame(true);
$('#deleteFrame').onclick = () => { if (state.frames.length === 1) return toast('Keep at least one frame'); snapshot(); state.frames.splice(state.frame, 1); state.frame = Math.max(0, state.frame - 1); state.layer = 0; render(); };
$('#prevFrame').onclick = () => { state.frame = (state.frame - 1 + state.frames.length) % state.frames.length; state.layer = 0; render(); };
$('#nextFrame').onclick = () => { state.frame = (state.frame + 1) % state.frames.length; state.layer = 0; render(); };
$('#fps').onchange = event => { state.fps = Math.max(1, Math.min(30, +event.target.value || 12)); event.target.value = state.fps; updateReadout(); if (state.playing) startPlayback(); };
$('#onion').onchange = event => { state.onion = event.target.checked; render(); };
function zoom(value) { state.zoom = Math.max(.35, Math.min(1.6, value)); $('#stage').style.transform = `scale(${state.zoom})`; $('#zoomValue').textContent = `${Math.round(state.zoom * 100)}%`; }
$('#zoomIn').onclick = () => zoom(state.zoom + .15); $('#zoomOut').onclick = () => zoom(state.zoom - .15); $('#zoomReset').onclick = () => zoom(1);
let timer;
function stopPlayback() { state.playing = false; clearInterval(timer); $('#play').textContent = '▶'; $('#play').setAttribute('aria-label', 'Play animation'); }
function startPlayback() { clearInterval(timer); state.playing = true; $('#play').textContent = '❚❚'; $('#play').setAttribute('aria-label', 'Pause animation'); timer = setInterval(() => { state.frame = (state.frame + 1) % state.frames.length; state.layer = 0; render(); }, 1000 / state.fps); }
$('#play').onclick = () => state.playing ? stopPlayback() : startPlayback();
function download(blob, name) { const anchor = document.createElement('a'), url = URL.createObjectURL(blob); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function filename() { return ($('#projectName').value || 'animation').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'animation'; }
$('#newProject').onclick = () => { if (confirm('Start a new project? Unsaved edits will be lost.')) { stopPlayback(); state.frames = [newFrame()]; state.frame = state.layer = 0; state.history = []; state.future = []; state.name = 'Untitled animation'; $('#projectName').value = state.name; render(); } };
$('#projectName').oninput = event => { state.name = event.target.value; };
$('#saveProject').onclick = () => { const project = { version: 1, name: $('#projectName').value, fps: state.fps, frames: state.frames }; download(new Blob([JSON.stringify(project)], { type: 'application/json' }), `${filename()}.json`); toast('Project saved'); };
function validProject(project) { return project && Array.isArray(project.frames) && project.frames.length && project.frames.every(frame => Array.isArray(frame.layers) && frame.layers.length && frame.layers.every(item => item && typeof item.image === 'string' && typeof item.name === 'string' && typeof item.visible === 'boolean')); }
$('#importProject').onchange = event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const project = JSON.parse(reader.result); if (!validProject(project)) throw new Error('Invalid project'); stopPlayback(); state.frames = project.frames; state.fps = Math.max(1, Math.min(30, +project.fps || 12)); state.frame = state.layer = 0; state.history = []; state.future = []; $('#fps').value = state.fps; $('#projectName').value = project.name || 'Imported animation'; state.name = $('#projectName').value; render(); toast('Project imported'); } catch { toast('That is not a valid Motion Studio project'); } finally { event.target.value = ''; } }; reader.readAsText(file); };
$('#importImage').onchange = event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { const img = await image(reader.result); if (!img) return toast('Could not open that image'); snapshot(); const asset = makeCanvas(), assetCtx = asset.getContext('2d'), scale = Math.min(1, W / img.width, H / img.height); assetCtx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale); active().layers.push({ name: file.name.replace(/\.[^.]+$/, '') || 'Image', visible: true, image: asset.toDataURL('image/png') }); state.layer = active().layers.length - 1; render(); toast('Image placed on a new layer'); }; reader.readAsDataURL(file); event.target.value = ''; };
$('#exportFrames').onclick = async () => { const button = $('#exportFrames'), previous = button.textContent; button.disabled = true; button.textContent = 'Exporting…'; try { for (let index = 0; index < state.frames.length; index++) { const canvas = makeCanvas(), exportCtx = canvas.getContext('2d'); for (const item of state.frames[index].layers) if (item.visible) await paintImage(exportCtx, item.image, 0, 0); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('PNG unavailable'); download(blob, `${filename()}-frame-${String(index + 1).padStart(2, '0')}.png`); } toast(`${state.frames.length} PNG frame${state.frames.length === 1 ? '' : 's'} exported`); } catch { toast('Could not export this project'); } finally { button.disabled = false; button.textContent = previous; } };
window.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? $('#redo').click() : $('#undo').click(); } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); $('#redo').click(); } });
render();
