#!/usr/bin/env python3
"""
Sings the vocal phrases of a song file (see all-my-pals.json).

A neural speaking voice (Piper, trained on LibriTTS, CC BY 4.0) says every word; the WORLD vocoder
splits each word into its syllables and moves them onto the melody: consonants keep their natural
length and fall just before the beat, vowels are stretched to the length of their note, and the pitch
follows the notes with glides between them, a scoop at the start of phrases, vibrato on held notes and
a slow drift. Breaths come before the lines. The result is one dry WAV per phrase; the game adds the
doubling, echo and reverb.

    pip install piper-tts pyworld soundfile scipy
    python3 tools/vocals/sing.py --model en-us-libritts-high.onnx

The voice model is not part of the repository: it is the "en-us-libritts-high" voice of Piper's
v0.0.2 release (https://github.com/rhasspy/piper/releases/tag/v0.0.2).
"""
import argparse
import json
import pathlib

import numpy as np
import pyworld as pw
import soundfile as sf
from piper import PiperVoice, SynthesisConfig
from scipy.signal import butter, find_peaks, sosfilt

SR = 22050
FP = 5.0  # WORLD frame period, ms
FRAME = FP / 1000
TAIL = 1.2  # seconds after the phrase, for the last note's release
CONSONANT_DB = 4  # how much louder consonants are than in the spoken word
ONSET = 0.09  # the longest a consonant before a vowel may last, seconds
CODA = 0.12  # the longest a consonant after a vowel may last, seconds
# Words a speaking voice says differently on their own than in a sung line.
SPOKEN = {'a': 'uh', 'the': 'thuh', 'to': 'tuh', "we're": 'weer', "you're": 'yore'}
MINOR = [0, 2, 3, 5, 7, 8, 10]  # the natural minor scale, in semitones


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def trim(x, floor_db=-42):
    env = np.convolve(np.abs(x), np.ones(220) / 220, mode='same')
    above = np.where(env > env.max() * 10 ** (floor_db / 20))[0]
    if not len(above):
        return x
    return x[max(0, above[0] - 400) : min(len(x), above[-1] + 600)]


class Speaker:
    def __init__(self, model, speaker):
        self.voice = PiperVoice.load(model, config_path=model + '.json')
        self.speaker = speaker

    def say(self, text, length=1.05):
        config = SynthesisConfig(
            speaker_id=self.speaker, length_scale=length, noise_scale=0.45, noise_w_scale=0.5
        )
        audio = np.concatenate([c.audio_float_array for c in self.voice.synthesize(text, config)])
        return trim(audio.astype(np.float64))


def analyse(x):
    f0, t = pw.harvest(x, SR, f0_floor=70, f0_ceil=650, frame_period=FP)
    f0 = pw.stonemask(x, f0, t, SR)
    sp = pw.cheaptrick(x, f0, t, SR)
    ap = pw.d4c(x, f0, t, SR)
    return f0, sp, ap


def band_energy(sp):
    bins = sp.shape[1]
    lo, hi = int(300 / (SR / 2) * bins), int(3500 / (SR / 2) * bins)
    e = 10 * np.log10(sp[:, lo:hi].sum(axis=1) + 1e-12)
    return np.convolve(e, np.ones(5) / 5, mode='same')


def harmonic(f0, ap):
    """Frames that are really voiced: a pitch, and mostly periodic below 2.5 kHz. Breathy onsets
    such as the aspiration after a p or an h stay noise, so they are not given a note."""
    bins = ap.shape[1]
    low = ap[:, int(100 / (SR / 2) * bins) : int(2500 / (SR / 2) * bins)].mean(axis=1)
    return (f0 > 0) & (low < 0.45)


def syllables(f0, sp, ap, count):
    """Splits a spoken word into `count` syllables at the dips between its loudest voiced frames."""
    e = band_energy(sp)
    voiced = harmonic(f0, ap)
    scored = np.where(voiced, e, e - 40)
    peaks, props = find_peaks(scored, distance=8, prominence=0.5)
    peaks = [p for p in peaks if voiced[p]]
    if len(peaks) < count:
        # Too few dips: split the voiced stretch evenly.
        v = np.where(voiced)[0]
        if not len(v):
            return None
        peaks = [int(v[0] + (k + 0.5) * (v[-1] - v[0]) / count) for k in range(count)]
    else:
        prominence = {p: scored[p] - min(scored[max(0, p - 30) : p + 30]) for p in peaks}
        peaks = sorted(sorted(peaks, key=lambda p: -prominence[p])[:count])
    bounds = [0]
    for a, b in zip(peaks[:-1], peaks[1:]):
        bounds.append(a + int(np.argmin(e[a:b])))
    bounds.append(len(f0))
    parts = []
    for k, peak in enumerate(peaks):
        start, end = bounds[k], bounds[k + 1]
        # The vowel: voiced frames within 12 dB of the syllable's peak, around it.
        c = peak
        while c > start and voiced[c - 1] and e[c - 1] > e[peak] - 12:
            c -= 1
        d = peak + 1
        while d < end and voiced[d] and e[d] > e[peak] - 12:
            d += 1
        parts.append(
            {'onset': (start, c), 'vowel': (c, d), 'coda': (d, end), 'level': float(e[peak]), 'peak': int(peak)}
        )
    return parts


def stable_window(sp, c, d, peak):
    """The part of a syllable a singer holds: the vowel's core around its loudest frame, not a
    steady consonant such as the l of 'pals'."""
    n = d - c
    if n < 6:
        return c, d
    w = max(3, int(n * 0.35))
    s0 = min(max(c, peak - w // 2), d - w)
    return s0, s0 + w


def frame_map(c, d, frames, stable):
    """Source frame (fractional) for each of `frames` output frames covering source [c, d)."""
    n = d - c
    if frames <= n or not stable:
        return np.linspace(c, d - 1, max(frames, 1))
    s0, s1 = stable
    head, tail = s0 - c, d - s1
    middle = frames - head - tail
    if middle < 2:
        return np.linspace(c, d - 1, frames)
    return np.concatenate(
        [np.arange(c, s0, dtype=float), np.linspace(s0, s1 - 1, middle), np.arange(s1, d, dtype=float)]
    )


def sample(sp, ap, index):
    i = np.clip(np.floor(index).astype(int), 0, len(sp) - 1)
    j = np.clip(i + 1, 0, len(sp) - 1)
    w = (index - np.floor(index))[:, None]
    spec = np.exp((1 - w) * np.log(sp[i] + 1e-12) + w * np.log(sp[j] + 1e-12))
    aper = (1 - w) * ap[i] + w * ap[j]
    return spec, aper


def harmony(midi, steps, root):
    """The note `steps` degrees away in the minor key on `root` (a third below is -2)."""
    pc = (midi - root) % 12
    degree = min(range(7), key=lambda k: abs(MINOR[k] - pc))
    octave = (midi - root) // 12
    target = degree + steps
    return root + 12 * (octave + target // 7) + MINOR[target % 7]


def sing(speaker, phrase, bpm, pre, seed, shift=0, words_cache=None, options=None, root=4):
    options = options or {}
    rng = np.random.default_rng(seed)
    s16 = 60 / bpm / 4
    total = int((pre + phrase['bars'] * 16 * s16 + TAIL) / FRAME)
    bins = None
    notes = []  # every syllable: when, how long, which note, and its word's analysis
    for li, line in enumerate(phrase['lines']):
        line_start = li * 32
        for word, syl_notes in line['words']:
            notes.append({'word': word, 'notes': syl_notes, 'line': li, 'start': line_start})
    # Analyse each word once.
    analysed = []
    for item in notes:
        key = item['word'].lower()
        if words_cache is not None and key in words_cache:
            f0, sp, ap, audio = words_cache[key]
        else:
            audio = speaker.say(SPOKEN.get(key, item['word']))
            f0, sp, ap = analyse(audio)
            if words_cache is not None:
                words_cache[key] = (f0, sp, ap, audio)
        parts = syllables(f0, sp, ap, len(item['notes']))
        bins = sp.shape[1]
        # Really voiced: periodic, and not far quieter than the vowel. A pitch tracker hears a pitch in
        # the faint aspiration after a p as well; given a note, that would turn 'pals' into 'hals'.
        energy = band_energy(sp)
        loud = np.zeros(len(f0), dtype=bool)
        for part in parts:
            a, b = part['onset'][0], part['coda'][1]
            loud[a:b] = energy[a:b] > part['level'] - 18
        voiced = harmonic(f0, ap) & loud
        for k, (step, length, midi) in enumerate(item['notes']):
            t = pre + (item['start'] + step) * s16 + rng.normal(0.004, 0.006)
            analysed.append(
                {
                    'f0': f0,
                    'sp': sp,
                    'ap': ap,
                    'voiced': voiced,
                    'audio': audio,
                    'part': parts[k],
                    'start': t,
                    'end': pre + (item['start'] + step + length) * s16,
                    'midi': (harmony(midi, shift, root) if shift else midi),
                    'line': item['line'],
                    'last': k == len(item['notes']) - 1,
                    'strong': step % 4 == 0,
                }
            )
    f0_out = np.zeros(total)
    # Where each output frame comes from in the spoken words, for the consonants copied as they were.
    source = [None] * total
    sp_out = np.full((total, bins), 1e-12)
    ap_out = np.ones((total, bins))
    gain = np.zeros(total)
    reference = float(np.median([a['part']['level'] for a in analysed]))
    previous_pitch = None
    # How long each syllable's leading consonant may be: never more than a third of the note before
    # it, so a fast line keeps its vowels (singers shorten consonants, not vowels).
    for n, syl in enumerate(analysed):
        oa, ob = syl['part']['onset']
        limit = ONSET
        if n and analysed[n - 1]['line'] == syl['line']:
            limit = min(limit, 0.35 * (syl['start'] - analysed[n - 1]['start']))
        syl['onset_frames'] = max(0, min(ob - oa, int(limit / FRAME)))
    for n, syl in enumerate(analysed):
        nxt = analysed[n + 1] if n + 1 < len(analysed) else None
        (oa, ob), (va, vb), (ca, cb) = syl['part']['onset'], syl['part']['vowel'], syl['part']['coda']
        onset_frames = syl['onset_frames']
        start_f = int(syl['start'] / FRAME)
        end = syl['end']
        if nxt and nxt['start'] - syl['end'] < s16 * 1.01:
            end = min(end, nxt['start'] - nxt['onset_frames'] * FRAME)
        else:
            end -= 0.03
        end_f = max(start_f + 6, int(end / FRAME))
        # The vowel keeps at least 55 % of the note; the consonant after it gets the rest at most.
        coda_frames = min(cb - ca, int(CODA / FRAME), int(0.45 * (end_f - start_f)))
        vowel_end_f = max(start_f + 4, end_f - coda_frames)
        level_db = np.clip(reference - syl['part']['level'], -9, 9) + (1.0 if syl['strong'] else 0)
        # Onset consonants, at natural speed, just before the beat.
        segments = [
            (start_f - onset_frames, start_f, np.linspace(oa, ob - 1, onset_frames) if onset_frames else np.array([])),
            (
                start_f,
                vowel_end_f,
                frame_map(va, vb, vowel_end_f - start_f, stable_window(syl['sp'], va, vb, syl['part']['peak'])),
            ),
        ]
        if syl['last']:
            segments.append((vowel_end_f, vowel_end_f + coda_frames, np.linspace(ca, max(ca, cb - 1), max(1, coda_frames))))
        else:
            segments.append((vowel_end_f, end_f, np.linspace(ca, max(ca, cb - 1), max(1, end_f - vowel_end_f))))
        target = hz(syl['midi'] + options.get('transpose', 0))
        held = (vowel_end_f - start_f) * FRAME
        rate = 5.4 + rng.uniform(-0.3, 0.3)
        depth = 28 + rng.uniform(-6, 8)
        phase = rng.uniform(0, 2 * np.pi)
        phrase_start = n == 0 or analysed[n - 1]['line'] != syl['line'] or syl['start'] - analysed[n - 1]['end'] > 0.25
        for a, b, src in segments:
            if b <= a or not len(src):
                continue
            a, b = max(0, a), min(total, b)
            src = src[: b - a] if len(src) >= b - a else np.interp(np.linspace(0, len(src) - 1, b - a), np.arange(len(src)), src)
            spec, aper = sample(syl['sp'], syl['ap'], src)
            frames = np.clip(np.round(src).astype(int), 0, len(syl['f0']) - 1)
            voiced = syl['voiced'][frames]
            times = (np.arange(a, b) - start_f) * FRAME
            cents = np.zeros(b - a)
            if held > 0.32 and not options.get('plain'):
                ramp = np.clip((times - 0.15) / 0.3, 0, 1)
                cents += depth * ramp * np.sin(2 * np.pi * rate * times + phase)
            if phrase_start and not options.get('plain'):
                cents += -70 * np.exp(-np.clip(times, 0, None) / 0.035) * (times >= 0)
            pitch = target * 2 ** (cents / 1200)
            if previous_pitch and not phrase_start and not options.get('plain'):
                glide = np.clip(times / 0.06, 0, 1)
                glide = 0.5 - 0.5 * np.cos(np.pi * glide)
                pitch = np.exp((1 - glide) * np.log(previous_pitch) + glide * np.log(pitch))
            env = np.ones(b - a)
            if held > 0.4:
                env *= 1 + 0.12 * np.clip(times / (held * 0.3), 0, 1) - 0.35 * np.clip((times - held * 0.7) / (held * 0.3), 0, 1)
            # Consonants a little louder than speech has them: singers articulate.
            emphasis = np.where(voiced, 1.0, 10 ** (CONSONANT_DB / 10))
            sp_out[a:b] = spec * (10 ** (level_db / 10)) * (env**2 * emphasis)[:, None]
            ap_out[a:b] = aper
            natural = syl['f0'][np.clip(np.round(src).astype(int), 0, len(syl['f0']) - 1)]
            f0_out[a:b] = natural if options.get('spoken') else np.where(voiced, pitch, 0)
            gain[a:b] = 1
            amp = np.sqrt(10 ** (level_db / 10)) * env * np.sqrt(emphasis)
            for k, j in enumerate(range(a, b)):
                if not voiced[k]:
                    source[j] = (syl['audio'], src[k] * FRAME, amp[k])
        previous_pitch = target
        # A breath before a line that starts after a rest.
        if phrase_start:
            length = int(0.24 / FRAME)
            b = start_f - onset_frames - int(0.04 / FRAME)
            a = b - length
            if a > 0 and not gain[a:b].any():
                shape = np.sin(np.linspace(0, np.pi, length)) ** 2
                vowel = syl['sp'][va:vb].mean(axis=0)
                sp_out[a:b] = vowel[None, :] * 10 ** (-30 / 10) * shape[:, None]
                ap_out[a:b] = 1
                f0_out[a:b] = 0
    # Drift: a slow wander of a few cents, as no singer holds a pitch perfectly.
    drift = np.convolve(rng.normal(0, 1, total), np.ones(60) / 60, mode='same')
    f0_out = np.where(f0_out > 0, f0_out * 2 ** (drift * 40 / 1200), 0)
    # Voiced frames come from the vocoder, on the melody; consonants without a pitch (p, t, k, s, sh,
    # f, h) are copied from the spoken word, grain by grain, because a vocoder blurs them.
    copied = np.array([entry is not None for entry in source], dtype=float)
    weight = np.convolve(copied, np.ones(3) / 3, mode='same')
    sp_out *= ((1 - weight) ** 2)[:, None]
    sp_out = np.maximum(sp_out, 1e-12)
    y = pw.synthesize(f0_out, np.ascontiguousarray(sp_out), np.ascontiguousarray(ap_out), SR, FP)
    hop = SR * FRAME
    size = int(round(2 * hop))
    window = np.hanning(size + 2)[1:-1]
    grains = np.zeros(len(y) + size * 2)
    for j, entry in enumerate(source):
        if entry is None:
            continue
        audio, at, amp = entry
        centre = int(at * SR)
        a = centre - size // 2
        piece = np.zeros(size)
        lo, hi = max(0, a), min(len(audio), a + size)
        if hi > lo:
            piece[lo - a : hi - a] = audio[lo:hi]
        out = int(j * hop) - size // 2 + size
        grains[out : out + size] += piece * window * amp * weight[j]
    grains = grains[size : size + len(y)]
    return finish(y + grains)


def finish(y, target_db=-19):
    y = sosfilt(butter(2, 95, 'highpass', fs=SR, output='sos'), y)
    # A gentle compressor: evens out syllables like a vocal chain does.
    env = np.sqrt(np.convolve(y ** 2, np.ones(441) / 441, mode='same')) + 1e-9
    db = 20 * np.log10(env)
    over = np.clip(db - (target_db + 4), 0, None)
    y = y * 10 ** (-(over * (1 - 1 / 3)) / 20)
    voiced = env > env.max() * 0.05
    rms = np.sqrt(np.mean(y[voiced] ** 2)) if voiced.any() else 1
    y = y * (10 ** (target_db / 20) / rms)
    peak = np.abs(y).max()
    if peak > 0.95:
        y *= 0.95 / peak
    return y


def main():
    here = pathlib.Path(__file__).parent
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True)
    parser.add_argument('--song', default=str(here / 'all-my-pals.json'))
    parser.add_argument('--out', default=str(here.parent.parent / 'assets' / 'vocals'))
    parser.add_argument('--only', nargs='*')
    args = parser.parse_args()
    song = json.loads(pathlib.Path(args.song).read_text())
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    speaker = Speaker(args.model, song['speaker'])
    cache = {}
    # Every phrase is the lead plus the same line an octave below at -6 dB: a classic doubling that
    # keeps the words clear while the lead sits high. The harmony (a third below) is its own file.
    jobs = [(name, phrase, 0) for name, phrase in song['phrases'].items()]
    jobs.append(('chorus-low', song['phrases']['chorus'], -2))
    for index, (name, phrase, shift) in enumerate(jobs):
        if args.only and name not in args.only:
            continue
        seed = 17 + index
        lead = sing(
            speaker, phrase, song['bpm'], song['pre'], seed, shift=shift, words_cache=cache, root=song['root']
        )
        if not shift:
            low = sing(
                speaker,
                phrase,
                song['bpm'],
                song['pre'],
                seed + 50,
                words_cache=cache,
                options={'transpose': -12},
                root=song['root'],
            )
            n = min(len(lead), len(low))
            lead = finish(lead[:n] + low[:n] * 10 ** (-6 / 20))
        sf.write(out / f'{name}.wav', lead, SR, subtype='PCM_16')
        print(f'{name}: {len(lead) / SR:.1f} s')


if __name__ == '__main__':
    main()
