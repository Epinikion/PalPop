// Keep the original single-file entry point's electro and festival tracks in sync.
// Run explicitly after changing their composers, arrangements, or instruments.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { TRACKS, TRACK_IDS, DANCE, FESTIVAL } from '../src/audio/catalog.js';
const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function moduleDeclarations(file) {
  const source = read(file),
    ast = parse(source, { sourceType: 'module' });
  return ast.program.body
    .filter((node) => node.type !== 'ImportDeclaration')
    .map((node) => node.declaration || node)
    .filter((node) => node.type === 'FunctionDeclaration' || node.type === 'VariableDeclaration')
    .map((node) => ({
      name: node.id?.name || node.declarations[0].id.name,
      code: source.slice(node.start, node.end),
      node,
      source,
    }));
}
const composer = moduleDeclarations('src/audio/songs/dance-composition.js');
const factory = moduleDeclarations('src/audio/dance.js')[0];
const voices = moduleDeclarations('src/audio/instruments/dance.js')[0];
const festivalComposer = moduleDeclarations('src/audio/songs/festival-composition.js');
const festivalFactory = moduleDeclarations('src/audio/festival.js')[0];
const festivalVoices = moduleDeclarations('src/audio/instruments/festival.js')[0];
const chord = moduleDeclarations('src/audio/composition.js')[0];
function factoryFunction(file, name) {
  const item = moduleDeclarations(file)[0],
    node = item.node.body.body.find((node) => node.id?.name === name);
  if (!node) throw new Error(`Missing ${file}:${name}`);
  return item.source.slice(node.start, node.end);
}
const feedback = moduleDeclarations('src/audio/game-feedback.js')[0];
const names = {
  context: 'AC',
  session: 'SESSION',
  bar: 'technoBar',
  section: 'technoSection',
  graph: 'MB',
  stemFlash: 'stemFlash',
  feverOn: 'feverOn',
  hype: 'hype',
  enabled: 'musOn',
  volume: 'musicVol',
  effectsVolume: 'effectsVol',
  sfxG: 'sfxG',
  songStart: 'songStart',
  playing: 'songSrc',
  master: 'master',
  noiseBuf: 'noiseBuf',
  musG: 'musG',
  musIn: 'musIn',
  analyser: 'an',
  frequencyData: 'anData',
  bassShelf: 'bassShelf',
  dangerLevel: 'dangerK',
  dangerActive: 'dangerOn',
  previousFever: 'prevFever',
  pendingFx: 'pendingFx',
  pendingHits: 'pendingHits',
  environmentKey: 'gameEnvKey',
  nextStepTime: 'technoNext',
  step: 'technoStep',
  lastRewardTime: 'lastRewardTime',
};
const legacy = (source) =>
  source
    .replace(/audio\.(\w+)/g, (_, key) => {
      if (!names[key]) throw new Error('Unknown legacy audio field ' + key);
      return names[key];
    })
    .replace(/(?:audioInstruments|audioComposition|audioMath|audioGraph|audioScheduler)\./g, '')
    .replace(
      /game\.(phase|iceTime|danger|goldTime)/g,
      (_, key) => ({ phase: 'state', iceTime: 'iceT', danger: 'danger', goldTime: 'goldT' })[key],
    );
const factoryBody = legacy(
  factory.source.slice(factory.node.body.start + 1, factory.node.body.end - 1),
);
const newArrangement = `const electroArrangement=(()=>{${factoryBody}})();\nfunction scheduleDanceStep(step,t){electroArrangement.scheduleDanceStep(step,t);}`;
const newVoices = voices.node.body.body
  .filter((node) => node.type === 'FunctionDeclaration')
  .map((node) => [node.id.name, legacy(voices.source.slice(node.start, node.end))]);
const chordNode = chord.node.body.body.find(
  (node) => node.type === 'FunctionDeclaration' && node.id.name === 'chordFor',
);
let html = read('../index.html').replaceAll('\r\n', '\n');
const start = html.lastIndexOf('<script>') + 8,
  end = html.indexOf('</script>', start),
  script = html.slice(start, end);
const ast = parse(script),
  iife = ast.program.body.find(
    (node) => node.type === 'ExpressionStatement' && node.expression.callee?.body,
  ),
  body = iife.expression.callee.body.body;
const replacements = new Map(newVoices);
for (const item of festivalComposer) replacements.set(item.name, item.code);
for (const node of festivalVoices.node.body.body.filter(
  (node) => node.type === 'FunctionDeclaration',
))
  replacements.set(node.id.name, legacy(festivalVoices.source.slice(node.start, node.end)));
replacements.set(
  'festivalArrangement',
  `const festivalArrangement=(()=>{${legacy(festivalFactory.source.slice(festivalFactory.node.body.start + 1, festivalFactory.node.body.end - 1))}})();\nfunction scheduleFestivalStep(step,t){festivalArrangement.scheduleFestivalStep(step,t);}`,
);
replacements.set(
  'initAudio',
  legacy(factoryFunction('src/audio/runtime.js', 'initAudio')).replaceAll(
    'startSong(',
    'startLiveTechno(',
  ),
);
replacements.set(
  'buildMusicGraph',
  legacy(factoryFunction('src/audio/graph.js', 'buildMusicGraph')),
);
for (const name of ['musicReact', 'reactToMerge', 'resetLiveMusic', 'reactToEvent'])
  replacements.set(name, legacy(factoryFunction('src/audio/reactions.js', name)));
replacements.set(
  'musicTick',
  legacy(factoryFunction('src/audio/scheduler.js', 'musicTick'))
    .replace('audioComposition.LOOK', 'LOOK')
    .replace(
      'arrangements[SESSION.style](technoStep, technoNext)',
      'scheduleStep(technoStep, technoNext)',
    ),
);
const soundBody = legacy(
  feedback.source.slice(feedback.node.body.start + 1, feedback.node.body.end - 1),
);
const soundWrappers = `const gameAudio=(()=>{${soundBody}})();
${moduleDeclarations('src/audio/output.js')[0].code}
const sfxDrop=()=>{},sfxClick=()=>{},sfxMerge=()=>{},sfxLand=(tier,speed)=>gameAudio.play('impact',{tier,speed}),
 sfxSwap=()=>gameAudio.play('swap'),sfxDiscover=()=>gameAudio.play('discover'),sfxFever=()=>gameAudio.play('fever'),
 sfxGoal=()=>gameAudio.play('goal'),sfxOver=()=>reactToEvent('over'),sfxShake=()=>gameAudio.play('shake'),
 sfxHeart=()=>gameAudio.play('danger'),sfxBoom=()=>gameAudio.play('boom'),sfxGold=()=>gameAudio.play('gold'),
 sfxZap=()=>gameAudio.play('zap'),sfxFreeze=()=>gameAudio.play('freeze'),
 sfxFeverEnd=()=>{},sfxLevel=()=>{},sfxTick=()=>{},sfxReady=()=>{},sfxPrism=()=>{},sfxClutch=()=>{},sfxThaw=()=>{};`;
replacements.set('sfxDrop', soundWrappers);
replacements.set(
  'DANCE_FORMS',
  composer
    .filter((item) => item.name.startsWith('DANCE_'))
    .map((item) => item.code)
    .join('\n'),
);
replacements.set(
  'composeDanceSession',
  composer
    .filter((item) => !item.name.startsWith('DANCE_'))
    .map((item) => item.code)
    .join('\n'),
);
replacements.set('scheduleDanceStep', newArrangement);
replacements.set('chordFor', legacy(chord.source.slice(chordNode.start, chordNode.end)));
const chapter = body.find((node) => node.id?.name === 'chapterFor');
replacements.set(
  'chapterFor',
  script.slice(chapter.start, chapter.end).replace(
    /if\(SESSION.style==='dance'\)\{[\s\S]*?return C;\s*\}/,
    `if(SESSION.style==='dance'){
const C=renewDanceChapter(seed,SESSION,R);chapters.set(cyc,C);if(chapters.size>3)chapters.delete(chapters.keys().next().value);return C;
}`,
  ),
);
const edits = [];
for (const node of ast.program.body)
  if (node.id?.name === 'reactToEvent') edits.push({ start: node.start, end: node.end, text: '' });
for (const node of body) {
  const name = node.id?.name || node.declarations?.[0].id.name;
  if (replacements.has(name)) {
    edits.push({ start: node.start, end: node.end, text: replacements.get(name) });
    replacements.delete(name);
  } else if (
    [
      'DANCE_MODES',
      'DANCE_PROGS',
      'composeDancePhrase',
      'renewDanceChapter',
      'electroArrangement',
      'gameAudio',
      'createAudioOutput',
      'scheduleFestivalStep',
    ].includes(name)
  )
    edits.push({ start: node.start, end: node.end, text: '' });
}
// New functions do not yet exist on an older legacy entry point.
const added = [];
for (const [name, code] of replacements) {
  if (
    name === 'reactToEvent' ||
    festivalComposer.some((item) => item.name === name) ||
    [
      'festivalArrangement',
      'festivalStack',
      'eFestivalPiano',
      'eFestivalLead',
      'eFestivalChord',
    ].includes(name)
  ) {
    added.push(code);
    replacements.delete(name);
  }
}
if (added.length) {
  edits.push({
    start: body[0].start,
    end: body[0].start,
    text: added.join('\n') + '\n',
  });
}
if (replacements.size) throw new Error('Missing legacy declarations: ' + [...replacements.keys()]);
let next = script;
for (const edit of edits.sort((a, b) => b.start - a.start))
  next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
next = next.replace(
  /const DANCE=5,TECHNO=6,[^\n]+/,
  'const DANCE=5,TECHNO=6,FESTIVAL=7,VISUAL_THEME=6,TRACK_IDS=[DANCE,TECHNO,FESTIVAL],TRACKS=Array(8).fill(null);',
);
const festivalMetadata = `TRACKS[FESTIVAL]=${JSON.stringify(TRACKS[FESTIVAL])};`;
if (next.includes('TRACKS[FESTIVAL]='))
  next = next.replace(/TRACKS\[FESTIVAL\]=\{[^\n]+\};/, festivalMetadata);
else next = next.replace(/TRACKS\[DANCE\]=\{[^\n]+\};/, (line) => line + '\n' + festivalMetadata);
if (!next.includes("if((tonal?tonal.style:TRACKS[track].style)==='festival')"))
  next = next.replace(
    'function composeSession(seed,tonal){',
    "function composeSession(seed,tonal){\nif((tonal?tonal.style:TRACKS[track].style)==='festival')return composeFestivalSession(seed,tonal);",
  );
if (!next.includes("SESSION&&SESSION.style==='festival'?FESTIVAL_FORMS[0]"))
  next = next.replace(
    "SESSION&&SESSION.style==='dance'?DANCE_FORMS[0]:FORMS[0]",
    "SESSION&&SESSION.style==='festival'?FESTIVAL_FORMS[0]:SESSION&&SESSION.style==='dance'?DANCE_FORMS[0]:FORMS[0]",
  );
if (!next.includes("if(SESSION.style==='festival')"))
  next = next.replace(
    "if(SESSION.style==='dance'){\nconst C=renewDanceChapter",
    "if(SESSION.style==='festival'){const C=renewFestivalChapter(seed,SESSION,R);chapters.set(cyc,C);if(chapters.size>3)chapters.delete(chapters.keys().next().value);return C;}\nif(SESSION.style==='dance'){\nconst C=renewDanceChapter",
  );
if (!next.includes('scheduleFestivalStep(step,t);return;'))
  next = next.replace(
    'function scheduleStep(step,t){',
    "function scheduleStep(step,t){\nif(SESSION.style==='festival'){scheduleFestivalStep(step,t);return;}",
  );
if (!next.includes("['festivalTrack',FESTIVAL]"))
  next = next.replace(
    "['danceTrack',DANCE],['technoTrack',TECHNO]",
    "['danceTrack',DANCE],['technoTrack',TECHNO],['festivalTrack',FESTIVAL]",
  );
if (!next.includes("$('#festivalTrack').addEventListener"))
  next = next.replace(
    "$('#danceTrack').addEventListener",
    "$('#festivalTrack').addEventListener('click',()=>{initAudio();setTrack(FESTIVAL);});\n$('#danceTrack').addEventListener",
  );
next = next.replace(
  "track===DANCE?'LIVE DANCE':'LIVE TECHNO'",
  "'LIVE '+TRACKS[track].style.toUpperCase()",
);
next = next.replace(
  'eDanceLead(t,ch.notes[1]+12,.16,.03);',
  'eDanceChord(t,ch.notes.slice(0,3),.08,.055);',
);
// Legacy event sites already have sound hook stubs. Keep the new drop spatial and prevent duplicate merge cues.
next = next
  .replace('reactToMerge(t+1,comboN);', 'reactToMerge(t+1,comboN,x);')
  .replace(
    "state='play'; held=mkHeld(pick());",
    "state='play';gameAudio.play('start'); held=mkHeld(pick());",
  )
  .replace(
    'sfxG.gain.setTargetAtTime(0,t,.02);',
    'sfxG.gain.setTargetAtTime(musOn?effectsVol/100*.38:0,t,.025);',
  )
  .replace('bassAmt/100*7', 'bassAmt/100*3')
  .replace(
    /lastDanceAccent=-Infinity;(?:lastRewardTime=-Infinity;)*/,
    'lastDanceAccent=-Infinity;lastRewardTime=-Infinity;',
  )
  .replace("'MUSIC '+(musOn?'ON':'OFF')", "'SOUND '+(musOn?'ON':'OFF')");
if (!next.includes('effectsVol=clamp'))
  next = next.replace(
    'let songStart=0',
    "let effectsVol=clamp(Number(store.get('effectsVol',55))||0,0,100),lastRewardTime=-Infinity;\nlet songStart=0",
  );
if (!next.includes("gameAudio.play('drop',{tier:held.t,x:held.x})"))
  next = next.replace(
    'const b=mk(held.t,held.x,SPAWN_Y);',
    "gameAudio.play('drop',{tier:held.t,x:held.x});const b=mk(held.t,held.x,SPAWN_Y);",
  );
next = next.replace(
  'sfxLand(b.t,iv);',
  "gameAudio.play('impact',{tier:b.t,x:b.x,speed:iv,pair:'floor:'+b.id});",
);
if (!next.includes("pair:a.id+':'+b.id"))
  next = next.replace(
    'if(vn<-170&&parts.length<500)',
    "if(vn<-170&&state==='play')gameAudio.play('impact',{tier:Math.max(a.t,b.t),x:a.x,speed:-vn,pair:a.id+':'+b.id});if(vn<-170&&parts.length<500)",
  );
if (!next.includes("['effectsVol','effectsValue'"))
  next = next.replace(
    "['bassAmt','bassValue','bassAmt',()=>bassAmt,v=>bassAmt=v]",
    "['bassAmt','bassValue','bassAmt',()=>bassAmt,v=>bassAmt=v],\n['effectsVol','effectsValue','effectsVol',()=>effectsVol,v=>effectsVol=v]",
  );
if (!next.includes("if(!SESSION){$('#trackLabel')"))
  next = next.replace(
    "$('#trackLabel').textContent=(musOn?'':'PAUSED · ')+TRACKS[track].name;$('#tempoLabel').textContent=TRACKS[track].bpm+' BPM';",
    "if(!SESSION){$('#trackLabel').textContent=(musOn?'':'PAUSED · ')+TRACKS[track].name;$('#tempoLabel').textContent=TRACKS[track].bpm+' BPM';}",
  );
const metadata = TRACKS[DANCE];
next = next.replace(/TRACKS\[DANCE\]=\{[^\n]+\};/, `TRACKS[DANCE]=${JSON.stringify(metadata)};`);
parse(next); // Validate before touching the original entry point.
html = html.slice(0, start) + next + html.slice(end);
html = html.replace(
  /<div class="song-picker"[^>]*>[\s\S]*?<\/div>/,
  '<div class="song-picker" role="group" aria-label="Choose a song">' +
    TRACK_IDS.map((id) => {
      const song = TRACKS[id];
      return `<button id="${song.buttonId}" class="pbtn" aria-pressed="false"><b>${song.name}</b><small>${song.label}</small></button>`;
    }).join('\n') +
    '</div>',
);
if (!html.includes('.song-picker .pbtn:last-child:nth-child(odd)'))
  html = html.replace(
    '</style>',
    '.song-picker .pbtn:last-child:nth-child(odd){grid-column:1/-1;}\n</style>',
  );
html = html
  .replaceAll('NEON DAYDREAM', metadata.name)
  .replaceAll('DANCE / WARM CHORDS + MELODY', metadata.label)
  .replaceAll('WARM CHORDS OR ACID LINES.', 'ELECTRO SYNTHS OR ACID LINES.')
  .replaceAll('TWO SOUNDTRACKS.', 'THREE SOUNDTRACKS.')
  .replaceAll('BOTH SONGS ARE PLAYED LIVE', 'ALL THREE SONGS ARE PLAYED LIVE')
  .replaceAll('DANCE OR TECHNO.', 'FESTIVAL. ELECTRO. TECHNO.')
  .replaceAll('ELECTRO SYNTHS OR ACID LINES.', 'PIANO HOOKS, SYNTHS AND ACID LINES.')
  .replaceAll('124 BPM', '130 BPM')
  .replaceAll(
    'A SUNNY DANCE GROOVE, WARM PIANO CHORDS AND A MELODY YOU CAN HUM. GENTLE MERGE ACCENTS KEEP THE SONG IN FLOW.',
    metadata.description,
  );
if (!html.includes('id="effectsVol"'))
  html = html.replace(
    '<p class="mix-note" id="songDescription">',
    '<label class="mix-control" for="effectsVol">Effects<input id="effectsVol" type="range" min="0" max="100" step="1"><output id="effectsValue" for="effectsVol"></output></label>\n<p class="mix-note" id="songDescription">',
  );
html = html.replace('class="pbtn">MUSIC ON', 'class="pbtn">SOUND ON');
fs.writeFileSync(path.join(root, '../index.html'), html);
console.log('Updated the original entry point with the modular electro and festival engines.');
