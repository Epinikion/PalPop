import { store } from '../core/storage.js';
import { SOLAR, TRACK_IDS } from './catalog.js';
import { clamp } from '../core/math.js';
/** Where the bass setting starts (0-100). */
export const BASS_DEFAULT = 68;
/** Owns preferences, musical clock, voices, and the bounded chapter cache. */
export function createAudioState(storage = store) {
  const audio = {};
  audio.context = null;
  audio.master = undefined;
  audio.musG = undefined;
  audio.musIn = undefined;
  audio.noiseBuf = undefined;
  audio.analyser = null;
  audio.frequencyData = null;
  audio.bassShelf = undefined;
  audio.recordShelf = undefined;
  audio.savedTrack = Number(storage.get('musicTrack', SOLAR));
  audio.trackId = TRACK_IDS.includes(audio.savedTrack) ? audio.savedTrack : SOLAR;
  audio.enabled = storage.get('mus', true) !== false;
  audio.volume = clamp(Number(storage.get('musicVol', 78)) || 0, 0, 100);
  audio.bassAmount = clamp(Number(storage.get('bassAmt', BASS_DEFAULT)) || 0, 0, 100);
  audio.effectsVolume = clamp(Number(storage.get('effectsVol', 55)) || 0, 0, 100);
  audio.sfxG = null;
  audio.songStart = 0;
  audio.playing = null;
  audio.nextStepTime = 0;
  audio.step = 0;
  audio.section = 'READY';
  audio.onRecord = false;
  audio.bar = 0;
  audio.hype = 0;
  audio.seed = (Math.random() * 0xffffffff) >>> 0;
  audio.feverOn = false;
  audio.stemFlash = {
    kick: 0,
    bass: 0,
    drums: 0,
    synth: 0,
    vocal: 0,
  };
  audio.silentEl = null;
  audio.session = null;
  audio.graph = null;
  audio.dangerLevel = 0;
  audio.dangerActive = false;
  audio.previousFever = false;
  audio.pendingFx = [];
  audio.pendingHits = [];
  audio.look = 0;
  audio.lastTick = -1;
  audio.worker = null;
  audio.timer = null;
  audio.environmentKey = '';
  audio.liveVoices = 0;
  audio.lastRewardTime = -Infinity;
  return audio;
}
