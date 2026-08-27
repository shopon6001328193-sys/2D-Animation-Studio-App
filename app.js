/* Motion Studio: a touch-first, browser-only frame animation editor. */
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const W = 800, H = 500;
const blank = () => { const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; return canvas.toDataURL('image/png'); };
const freshLayer = (name = 'Layer 1', image = blank()) => ({ name, visible: true, image });
const newFrame = () => ({ layers: [freshLayer()] });
const state = { name: 'Untitled animation', fps: 12, frames: [newFrame()], assets: [], frame: 0, layer: 0, tool: 'brush', color: '#7868ff', size: 8, zoom: 1, onion: false, playing: false, history: [], future: [] };
const draw = $('#drawCanvas'), onion = $('#onionCanvas'), ctx = draw.getContext('2d'), octx = onion.getContext('2d');
draw.width = onion.width = W; draw.height = onion.height = H;
const active = () => state.frames[state.frame];
const layer = () => active().layers[state.layer];
const image = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
const cloneFrames = () => JSON.stringify(state.frames);
function snapshot() { state.history.push(cloneFrames()); if (state.history.length > 40) state.history.shift(); state.future = []; updateHistoryButtons(); }
function updateHistoryButtons() { $('#undo').disabled = !state.history.length; $('#redo').disabled = !state.future.length; }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 1800); }
async function drawSource(target, source, alpha = 1) { if (!source) return; target.save(); target.globalAlpha = alpha; target.drawImage(await image(source), 0, 0); target.restore(); }
async function renderOnion() { octx.clearRect(0, 0, W, H); if (!state.onion || !state.frame) return; for (const item of state.frames[state.frame - 1].layers) if (item.visible) await drawSource(octx, item.image, .23); }
async function render() {
  if (!active() || !layer()) return;
  ctx.clearRect(0, 0, W, H);
  for (let index = 0; index < active().layers.length; index++) if (index !== state.layer && active().layers[index].visible) await drawSource(ctx, active().layers[index].image);
  await renderOnion();
  if (layer().visible) await drawSource(ctx, layer().image);
  renderLayers(); await renderFrames(); renderAssets(); updateReadout(); updateHistoryButtons();
  $('#frameLabel').textContent = `Frame ${String(state.frame + 1).padStart(2, '0')}`;
}
function updateReadout() { const duration = state.frames.length / state.fps; $('#timeReadout').textContent = `${state.frame + 1}/${state.frames.length} · ${duration.toFixed(1)}s`; }
function renderLayers() {
  $('#layerList').innerHTML = active().layers.map((item, index) => `<div class="layer-row ${index === state.layer ? 'active' : ''}" data-layer="${index}"><button class="eye" data-eye="${index}" aria-label="Toggle ${escapeHtml(item.name)} visibility">${item.visible ? '◉' : '○'}</button><input value="${escapeHtml(item.name)}" aria-label="Layer name"><span class="layer-actions"><button data-move="up" title="Move layer up">↑</button><button data-move="down" title="Move layer down">↓</button><button data-remove="${index}" title="Delete layer">×</button></span></div>`).join('');
  $$('.layer-row').forEach(row => row.onclick = event => { if (!event.target.closest('input,button')) { state.layer = +row.dataset.layer; render(); } });
  $$('.eye').forEach(button => button.onclick = event => { event.stopPropagation(); snapshot(); active().layers[+button.dataset.eye].visible = !active().layers[+button.dataset.eye].visible; render(); });
  $$('.layer-row input').forEach((input, index) => input.onchange = () => { const name = input.value.trim() || `Layer ${index + 1}`; if (name !== active().layers[index].name) { snapshot(); active().layers[index].name = name; } renderLayers(); });
  $$('[data-move]').forEach(button => button.onclick = event => { event.stopPropagation(); const from = +button.closest('.layer-row').dataset.layer, to = from + (button.dataset.move === 'up' ? 1 : -1); if (to < 0 || to >= active().layers.length) return; snapshot(); [active().layers[from], active().layers[to]] = [active().layers[to], active().layers[from]]; state.layer = to; render(); });
  $$('[data-remove]').forEach(button => button.onclick = event => { event.stopPropagation(); if (active().layers.length === 1) return toast('Keep at least one layer'); snapshot(); active().layers.splice(+button.dataset.remove, 1); state.layer = Math.min(state.layer, active().layers.length - 1); render(); });
}
function escapeHtml(value) { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
async function renderFrames() {
  const strip = $('#frameStrip'); strip.innerHTML = '';
  for (let index = 0; index < state.frames.length; index++) {
    const button = document.createElement('button'); button.className = `frame ${index === state.frame ? 'active' : ''}`; button.setAttribute('aria-label', `Select frame ${index + 1}`); button.innerHTML = `<span class="frame-number">${index + 1}</span><canvas width="72" height="65"></canvas><small>Frame ${index + 1}</small>`;
    button.onclick = () => selectFrame(index); strip.append(button);
    const preview = button.querySelector('canvas').getContext('2d');
    for (const item of state.frames[index].layers) if (item.visible) preview.drawImage(await image(item.image), 0, 0, 72, 65);
  }
  strip.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}
function renderAssets() {
  const list = $('#assetList'); list.innerHTML = state.assets.map((asset, index) => `<div class="asset" data-asset="${index}"><button class="asset-use" title="Add ${escapeHtml(asset.name)} to current frame"><img src="${asset.src}" alt=""><span>${escapeHtml(asset.name)}</span></button><button class="asset-remove" data-remove-asset="${index}" title="Remove ${escapeHtml(asset.name)}">×</button></div>`).join('');
  $('#assetEmpty').hidden = state.assets.length > 0;
  $$('.asset-use').forEach(button => button.onclick = () => placeAsset(state.assets[+button.closest('.asset').dataset.asset]));
  $$('[data-remove-asset]').forEach(button => button.onclick = () => { const asset = state.assets.splice(+button.dataset.removeAsset, 1)[0]; renderAssets(); toast(`${asset.name} removed from assets`); });
}
function selectFrame(index) { state.frame = index; state.layer = 0; render(); }
async function placeAsset(asset) {
  snapshot(); const canvas = document.createElement('canvas'), assetCtx = canvas.getContext('2d'); canvas.width = W; canvas.height = H;
  try { const img = await image(asset.src), scale = Math.min((W * .7) / img.width, (H * .7) / img.height, 1); assetCtx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale); active().layers.push(freshLayer(asset.name, canvas.toDataURL('image/png'))); state.layer = active().layers.length - 1; render(); toast(`${asset.name} added to Frame ${state.frame + 1}`); } catch { toast('Could not add that asset'); }
}
let drawing = false, start, base, pointerId;
function point(event) { const rect = draw.getBoundingClientRect(); return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height }; }
function setupStroke(at) { ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = state.size; ctx.strokeStyle = state.color; ctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : 'source-over'; ctx.beginPath(); ctx.moveTo(at.x, at.y); }
function drawShape(at) { ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0); setupStroke(start); if (state.tool === 'line') ctx.lineTo(at.x, at.y); if (state.tool === 'rect') ctx.strokeRect(start.x, start.y, at.x - start.x, at.y - start.y); if (state.tool === 'circle') ctx.ellipse(start.x, start.y, Math.abs(at.x - start.x), Math.abs(at.y - start.y), 0, 0, Math.PI * 2); ctx.stroke(); }
function begin(event) { if (!layer().visible) return toast('Show the selected layer before drawing'); event.preventDefault(); stopPlayback(); snapshot(); drawing = true; pointerId = event.pointerId; draw.setPointerCapture(pointerId); start = point(event); base = document.createElement('canvas'); base.width = W; base.height = H; base.getContext('2d').drawImage(draw, 0, 0); setupStroke(start); if (state.tool === 'brush' || state.tool === 'eraser') { ctx.lineTo(start.x + .01, start.y + .01); ctx.stroke(); } }
function paint(event) { if (!drawing || event.pointerId !== pointerId) return; event.preventDefault(); const at = point(event); if (state.tool === 'brush' || state.tool === 'eraser') { ctx.lineTo(at.x, at.y); ctx.stroke(); } else drawShape(at); }
function finish(event) { if (!drawing || (event && event.pointerId !== pointerId)) return; drawing = false; ctx.globalCompositeOperation = 'source-over'; layer().image = draw.toDataURL('image/png'); renderFrames(); updateHistoryButtons(); }
draw.addEventListener('pointerdown', begin); draw.addEventListener('pointermove', paint); draw.addEventListener('pointerup', finish); draw.addEventListener('pointercancel', finish);
$$('.tool[data-tool]').forEach(button => button.onclick = () => { state.tool = button.dataset.tool; $$('.tool[data-tool]').forEach(item => item.classList.toggle('active', item === button)); });
$('#color').oninput = event => { state.color = event.target.value; $('#brushDot').style.background = state.color; };
$('#brushSize').oninput = event => { state.size = +event.target.value; $('#sizeOutput').value = `${state.size} px`; $('#brushDot').style.width = $('#brushDot').style.height = `${Math.max(5, state.size)}px`; };
$('#undo').onclick = () => { if (!state.history.length) return; state.future.push(cloneFrames()); state.frames = JSON.parse(state.history.pop()); state.frame = Math.min(state.frame, state.frames.length - 1); state.layer = Math.min(state.layer, active().layers.length - 1); render(); };
$('#redo').onclick = () => { if (!state.future.length) return; state.history.push(cloneFrames()); state.frames = JSON.parse(state.future.pop()); state.frame = Math.min(state.frame, state.frames.length - 1); state.layer = Math.min(state.layer, active().layers.length - 1); render(); };
$('#clearCanvas').onclick = () => { snapshot(); layer().image = blank(); render(); };
$('#addLayer').onclick = () => { snapshot(); active().layers.push(freshLayer(`Layer ${active().layers.length + 1}`)); state.layer = active().layers.length - 1; render(); };
function addFrame(copy = false) { snapshot(); state.frames.splice(state.frame + 1, 0, copy ? JSON.parse(JSON.stringify(active())) : newFrame()); selectFrame(state.frame + 1); }
$('#addFrame').onclick = () => addFrame(); $('#duplicateFrame').onclick = () => addFrame(true);
$('#clearFrame').onclick = () => { snapshot(); active().layers = [freshLayer()]; state.layer = 0; render(); toast('Frame cleared'); };
$('#deleteFrame').onclick = () => { if (state.frames.length === 1) return toast('Keep at least one frame'); snapshot(); state.frames.splice(state.frame, 1); selectFrame(Math.max(0, state.frame - 1)); };
$('#prevFrame').onclick = () => selectFrame((state.frame - 1 + state.frames.length) % state.frames.length); $('#nextFrame').onclick = () => selectFrame((state.frame + 1) % state.frames.length);
$('#fps').onchange = event => { state.fps = +event.target.value; updateReadout(); };
$('#onion').onchange = event => { state.onion = event.target.checked; render(); };
function zoom(value) { state.zoom = Math.max(.35, Math.min(1.6, value)); $('#stage').style.transform = `scale(${state.zoom})`; $('#zoomValue').textContent = `${Math.round(state.zoom * 100)}%`; }
$('#zoomIn').onclick = () => zoom(state.zoom + .15); $('#zoomOut').onclick = () => zoom(state.zoom - .15); $('#zoomReset').onclick = () => zoom(1);
let animationId, lastTick = 0, carry = 0;
function stopPlayback() { state.playing = false; cancelAnimationFrame(animationId); $('#play').textContent = '▶'; $('#play').setAttribute('aria-label', 'Play animation'); }
function playbackTick(now) { if (!state.playing) return; if (!lastTick) lastTick = now; carry += now - lastTick; lastTick = now; const duration = 1000 / state.fps; if (carry >= duration) { const steps = Math.floor(carry / duration); carry -= steps * duration; selectFrame((state.frame + steps) % state.frames.length); } animationId = requestAnimationFrame(playbackTick); }
function startPlayback() { state.playing = true; lastTick = carry = 0; $('#play').textContent = '❚❚'; $('#play').setAttribute('aria-label', 'Pause animation'); animationId = requestAnimationFrame(playbackTick); }
$('#play').onclick = () => state.playing ? stopPlayback() : startPlayback();
function download(blob, name) { const anchor = document.createElement('a'), url = URL.createObjectURL(blob); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function filename() { return ($('#projectName').value || 'animation').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'animation'; }
$('#newProject').onclick = () => { if (confirm('Start a new project? Unsaved edits will be lost.')) { stopPlayback(); state.frames = [newFrame()]; state.assets = []; state.frame = state.layer = 0; state.history = []; state.future = []; state.name = 'Untitled animation'; $('#projectName').value = state.name; render(); } };
$('#projectName').oninput = event => { state.name = event.target.value; };
$('#assetsToggle').onclick = () => { $('#rightbar').classList.toggle('mobile-open'); };
$('#saveProject').onclick = () => { const project = { version: 2, name: $('#projectName').value, fps: state.fps, frames: state.frames, assets: state.assets }; download(new Blob([JSON.stringify(project)], { type: 'application/json' }), `${filename()}.json`); toast('Project saved'); };
function validProject(project) { return project && Array.isArray(project.frames) && project.frames.length && project.frames.every(frame => Array.isArray(frame.layers) && frame.layers.length && frame.layers.every(item => typeof item.image === 'string' && typeof item.name === 'string')); }
$('#importProject').onchange = event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const project = JSON.parse(reader.result); if (!validProject(project)) throw new Error('Invalid project'); stopPlayback(); state.frames = project.frames; state.assets = Array.isArray(project.assets) ? project.assets.filter(item => item && typeof item.name === 'string' && typeof item.src === 'string') : []; state.fps = [6, 8, 12, 24, 30].includes(+project.fps) ? +project.fps : 12; state.frame = state.layer = 0; state.history = []; state.future = []; $('#fps').value = state.fps; $('#projectName').value = project.name || 'Imported animation'; state.name = $('#projectName').value; render(); toast('Project imported'); } catch { toast('That is not a valid Motion Studio project'); } finally { event.target.value = ''; } }; reader.readAsText(file); };
$('#importAsset').onchange = event => { const files = [...event.target.files]; if (!files.length) return; let remaining = files.length; files.forEach(file => { if (!file.type.startsWith('image/')) { remaining--; return; } const reader = new FileReader(); reader.onload = () => { state.assets.push({ name: file.name.replace(/\.[^.]+$/, '') || 'Image', src: reader.result }); if (!--remaining) { renderAssets(); toast(`${files.length} asset${files.length === 1 ? '' : 's'} imported`); } }; reader.readAsDataURL(file); }); event.target.value = ''; };
$('#exportFrames').onclick = async () => { const button = $('#exportFrames'); button.disabled = true; const previous = button.textContent; button.textContent = 'Exporting…'; try { for (let index = 0; index < state.frames.length; index++) { const canvas = document.createElement('canvas'), exportCtx = canvas.getContext('2d'); canvas.width = W; canvas.height = H; for (const item of state.frames[index].layers) if (item.visible) await drawSource(exportCtx, item.image); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (blob) download(blob, `${filename()}-frame-${String(index + 1).padStart(2, '0')}.png`); } toast(`${state.frames.length} PNG frame${state.frames.length === 1 ? '' : 's'} exported`); } catch { toast('Could not export this project'); } finally { button.disabled = false; button.textContent = previous; } };
window.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? $('#redo').click() : $('#undo').click(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); $('#redo').click(); } if (event.code === 'Space' && !event.target.matches('input,select')) { event.preventDefault(); $('#play').click(); } });
render();
