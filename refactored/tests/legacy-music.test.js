import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { createAudioState } from '../src/audio/state.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioFestival } from '../src/audio/festival.js';

test('legacy festival dispatch matches the modular composition and scheduled music across chapters', () => {
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8'),
    start = html.lastIndexOf('<script>') + 8,
    script = html.slice(start, html.indexOf('</script>', start)),
    ast = parse(script),
    body = ast.program.body.find((node) => node.expression?.callee?.body)?.expression.callee.body
      .body,
    selected = new Set([
      'mulberry32',
      'FESTIVAL_FORMS',
      'FESTIVAL_PROGS',
      'FESTIVAL_MODE',
      'composeFestivalSession',
      'composeFestivalPhrase',
      'renewFestivalChapter',
      'festivalArrangement',
      'scheduleFestivalStep',
      'composeSession',
      'sectionAt',
      'chapterFor',
      'chordFor',
      'scheduleStep',
    ]),
    declarations = body.filter((node) =>
      selected.has(node.id?.name || node.declarations?.[0]?.id.name),
    );
  assert.equal(
    declarations.length,
    selected.size,
    'Every synced declaration must occur exactly once',
  );
  const plain = (value) => JSON.parse(JSON.stringify(value));
  for (const seed of [42, 123456789]) {
    const legacyEvents = [],
      modularEvents = [],
      sandbox = {
        track: 7,
        TRACKS: { 7: { style: 'festival' } },
        technoSeed: seed,
        SESSION: null,
        chapters: new Map(),
        hype: 0,
        feverOn: false,
        technoBar: 0,
        technoSection: 'READY',
      };
    for (const name of [
      'eKick',
      'eClap',
      'eHat',
      'eShaker',
      'eDanceBass',
      'eSnare',
      'eFestivalPiano',
      'ePad',
      'eFestivalChord',
      'eFestivalLead',
      'eRiser',
      'eCrash',
    ])
      sandbox[name] = (...args) => legacyEvents.push({ name, args });
    vm.createContext(sandbox);
    vm.runInContext(
      declarations.map((node) => script.slice(node.start, node.end)).join('\n'),
      sandbox,
      { timeout: 1000 },
    );
    sandbox.SESSION = sandbox.composeSession(seed);
    const audio = createAudioState();
    audio.trackId = 7;
    audio.seed = seed;
    const audioComposition = createAudioComposition({ audio });
    audio.session = audioComposition.composeSession(seed);
    const arrangement = createAudioFestival({
      audio,
      audioComposition,
      audioInstruments: new Proxy(
        {},
        {
          get:
            (_, name) =>
            (...args) =>
              modularEvents.push({ name, args }),
        },
      ),
    });
    assert.deepEqual(plain(sandbox.SESSION), audio.session);
    for (let bar = 0; bar < 128; bar++) {
      const section = audioComposition.sectionAt(bar);
      assert.deepEqual(plain(sandbox.sectionAt(bar)), section);
      assert.deepEqual(
        plain(sandbox.chordFor(bar, section.sec, section.cyc)),
        audioComposition.chordFor(bar, section.sec, section.cyc),
      );
      for (let step = 0; step < 16; step++) {
        const absolute = bar * 16 + step,
          time = absolute * audio.session.s16;
        sandbox.scheduleStep(absolute, time);
        arrangement.scheduleFestivalStep(absolute, time);
      }
    }
    assert.deepEqual(plain(legacyEvents), plain(modularEvents));
  }
});
