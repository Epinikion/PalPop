import { TRACKS, TRACK_IDS, SOLAR } from '../src/audio/catalog.js';
import { renderOffline, encodeWav } from './audio-render.js';
const button = document.querySelector('#run'),
  result = document.querySelector('#result'),
  previewTrack = document.querySelector('#previewTrack');
for (const id of TRACK_IDS) {
  const option = document.createElement('option');
  option.value = TRACKS[id].style;
  option.textContent = TRACKS[id].name;
  previewTrack.append(option);
}
previewTrack.value = TRACKS[SOLAR].style;
async function render(style, bar, bars = 4, preview = false, { seed = 42, gameplay = false } = {}) {
  // Previews are rendered at 44.1 kHz so the top octaves can be judged; checks stay fast.
  const rendered = await renderOffline(style, bar, bars, {
    seed,
    gameplay,
    sampleRate: preview ? 44100 : 24000,
  });
  if (preview) {
    const wave = new Blob([encodeWav(rendered.buffer)], { type: 'audio/wav' });
    const url = URL.createObjectURL(wave),
      player = document.querySelector('#previewAudio'),
      download = document.querySelector('#download');
    if (player.src.startsWith('blob:')) URL.revokeObjectURL(player.src);
    player.src = url;
    player.hidden = false;
    download.href = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(wave);
    });
    download.hidden = false;
    const name = TRACKS[rendered.audio.trackId].name.toLowerCase().replaceAll(' ', '-');
    download.download = name + (gameplay ? '-gameplay.wav' : '.wav');
  }
  return rendered.summary;
}
document.querySelector('#preview').addEventListener('click', async (event) => {
  event.target.disabled = true;
  const style = previewTrack.value;
  result.textContent = 'Rendering a generated ' + style + '…';
  try {
    result.textContent =
      (await render(style, 0, 32, true)) +
      '\nPreview ready: a generated song with builds and drops.';
  } catch (error) {
    result.textContent = 'FAIL: ' + error.message;
  } finally {
    event.target.disabled = false;
  }
});
document.querySelector('#gameplay').addEventListener('click', async (event) => {
  event.target.disabled = true;
  result.textContent = 'Rendering music and gameplay feedback…';
  try {
    const style = previewTrack.value;
    result.textContent = await render(style, 0, 32, true, {
      gameplay: true,
    });
    result.textContent +=
      '\nPreview ready: drops, landings, rapid chains, shake, goals, fever and specials over the live track.';
  } catch (error) {
    result.textContent = 'FAIL: ' + error.message;
  } finally {
    event.target.disabled = false;
  }
});
button.addEventListener('click', async () => {
  button.disabled = true;
  result.textContent = 'Rendering…';
  try {
    const lines = [];
    const styles = [...new Set(TRACK_IDS.map((id) => TRACKS[id].style))];
    for (const style of styles)
      for (const bar of [0, 16, 36, 64, 192]) {
        lines.push(await render(style, bar));
        result.textContent = lines.join('\n');
      }
    for (const style of styles)
      for (const seed of [7, 123456789]) lines.push(await render(style, 16, 8, false, { seed }));
    for (const style of styles) lines.push(await render(style, 16, 16, false, { gameplay: true }));
    result.textContent = lines.join('\n');
    result.textContent +=
      '\nPASS: all soundtracks, all rendered sections, finite audio, no clipping, zero remaining voices.';
  } catch (error) {
    result.textContent += '\nFAIL: ' + error.message;
  } finally {
    button.disabled = false;
  }
});
