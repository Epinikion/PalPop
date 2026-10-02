/* Run: node tools/verify_engine.js. Uses the bundled Playwright or PLAYWRIGHT_PATH. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const { chromium }=require(process.env.PLAYWRIGHT_PATH||'C:/Users/pepsi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const hook=`
window.engineTest={
  fixtures(fps,kind){
    state=kind==='prism'?'play':'title';bodies=[];merging=[];parts=[];physAccum=0;pace=1;
    if(kind==='match')bodies=[mk(0,45,170),mk(0,58.4,170)];
    else if(kind==='overlap')bodies=[mk(2,60,160),mk(3,60,160)];
    else if(kind==='chain')bodies=[mk(0,48,184),mk(0,60,184),mk(1,69,182.5)];
    else if(kind==='prism')bodies=[mk(PRISM,48,180),mk(4,67,177)];
    else if(kind==='special')bodies=[mk(BOOMER,48,180),mk(BOOMER,65,180)];
    else{for(let i=0;i<32;i++){const b=mk(i%7,20+(i%4)*26,65+Math.floor(i/4)*14);b.vx=(i%3-1)*50;bodies.push(b);}}
    for(const b of bodies)b.age=.3;
    for(let i=0;i<fps*4;i++)stepBodies(1/fps);
    return bodies.map(b=>({t:b.t,x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r}));
  },
  async live(){
    newGame();const origin=songStart,seed=technoSeed;
    tx=93;carX=22;held=mkHeld(0);drop();const x=bodies[0].x;
    newGame();const continuous=origin===songStart&&seed===technoSeed;
    const before=liveVoices;musOn=false;reactToMerge(6,5);musicTick();const muted=liveVoices===before&&pendingHits.length===0;
    musOn=true;applyAudio();
    for(let k=0;k<18;k++){tx=k<2?60:20+(k%4)*26;drop();for(let i=0;i<40;i++)update(.016);if(state!=='play')break;}
    const played={drops,merges,score};
    newGame();bodies=[mk(0,28,184),mk(1,47,182.5),mk(2,69,181),mk(3,94,179)];charge=CH_MAX;doShake();startFever();reactToMerge(8,4);musicTick();render();
    await new Promise(r=>setTimeout(r,550));
    return {continuous,muted,dropX:x,state,bodies:bodies.length,voices:liveVoices,played,shakeSpent:charge===0};
  },
  smoke(){
    track=TECHNO;
    technoSeed=12345;SESSION=composeSession(technoSeed);chapters.clear();
    const original=[eKick,eHat,eShaker,eClap,eSnare,eTom,ePerc,eRide,eZap,eBass,eAcid,ePad,ePluck,eLead,eStab,eRiser,eCrash,eImpact];
    let events=0;
    const spy=name=>(...a)=>{
      events++;for(const v of a)if(typeof v==='number'&&!Number.isFinite(v))throw Error(name+' nonfinite');
      if(name==='pluck'&&(a.length!==5||a[4]<=0||Math.abs(a[3])>1))throw Error('bad pluck '+a);
      if((name==='pad'||name==='bass'||name==='acid'||name==='lead')&&a[2]<=0)throw Error(name+' duration');
    };
    [eKick,eHat,eShaker,eClap,eSnare,eTom,ePerc,eRide,eZap,eBass,eAcid,ePad,ePluck,eLead,eStab,eRiser,eCrash,eImpact]=['kick','hat','shaker','clap','snare','tom','perc','ride','zap','bass','acid','pad','pluck','lead','stab','riser','crash','impact'].map(spy);
    try{
      const material=new Set(),forms=new Set();let maxCache=0;
      for(let cyc=0;cyc<24;cyc++){
        const C=chapterFor(cyc);material.add(JSON.stringify(C.motifs));forms.add(JSON.stringify(C.form||FORMS[0]));
        if(C.bpm!==SESSION.bpm||C.pc!==SESSION.pc)throw Error('tonal drift');
        for(let s=cyc*1024;s<(cyc+1)*1024;s++)scheduleStep(s,1+(s-cyc*1024)*SESSION.s16);
        maxCache=Math.max(maxCache,chapters.size);
      }
      const first=JSON.stringify(chapterFor(3));chapterFor(99999);chapterFor(99998);chapterFor(99997);
      const deterministic=first===JSON.stringify(chapterFor(3));
      feverOn=true;goldT=7;hype=1;for(let s=0;s<64;s++)scheduleStep(s,1+s*SESSION.s16);
      dangerOn=true;for(let s=500;s<564;s++)scheduleStep(s,1+(s-500)*SESSION.s16);
      return {events,material:material.size,forms:forms.size,maxCache,deterministic};
    }finally{[eKick,eHat,eShaker,eClap,eSnare,eTom,ePerc,eRide,eZap,eBass,eAcid,ePad,ePluck,eLead,eStab,eRiser,eCrash,eImpact]=original;feverOn=false;goldT=0;hype=0;dangerOn=false;}
  },
  dance(){
    track=DANCE;technoSeed=12345;SESSION=composeSession(technoSeed);chapters.clear();
    const original=[eKick,eHat,eClap,eShaker,ePad,eDanceBass,eDanceChord,eDanceLead,eRiser,eCrash,eSnare];
    const forbidden=[eAcid,eZap,ePerc,eImpact];let chords=0,notes=0,kicks=0;
    const check=name=>(...a)=>{for(const v of a)if(typeof v==='number'&&!Number.isFinite(v))throw Error(name+' nonfinite');
      if(name==='kick'){kicks++;if(a[3]!==0)throw Error('dance rumble');}
      if(name==='chord')chords++;if(name==='lead')notes++;
      if(['chord','lead','bass'].includes(name)&&a[2]<=0)throw Error(name+' duration');
      if(name==='riser'&&a[2]>.025)throw Error('loud dance riser');
    };
    [eKick,eHat,eClap,eShaker,ePad,eDanceBass,eDanceChord,eDanceLead,eRiser,eCrash,eSnare]=['kick','hat','clap','shaker','pad','bass','chord','lead','riser','crash','snare'].map(check);
    [eAcid,eZap,ePerc,eImpact]=Array(4).fill(()=>{throw Error('harsh voice in dance');});
    try{
      for(let s=0;s<24*1024;s++)scheduleStep(s,1+s*SESSION.s16);
      const hook=JSON.stringify(SESSION.hook);for(const C of chapters.values())if(JSON.stringify(C.hook)!==hook||C.bpm!==124)throw Error('dance hook or tempo changed');
      feverOn=true;hype=1;for(let s=0;s<1024;s++)scheduleStep(s,1+s*SESSION.s16);
      return{chords,notes,kicks,bpm:SESSION.bpm,cache:chapters.size};
    }finally{[eKick,eHat,eClap,eShaker,ePad,eDanceBass,eDanceChord,eDanceLead,eRiser,eCrash,eSnare]=original;[eAcid,eZap,ePerc,eImpact]=forbidden;feverOn=false;hype=0;}
  },
  danceReactions(){
    const old={AC,MB,SESSION,songSrc,track,songStart,technoStep,state,lead:eDanceLead,musOn,lastDanceAccent};
    let accents=0;
    try{
      track=DANCE;SESSION=composeSession(12345);AC={state:'running',currentTime:2};MB={song:{}};songSrc={live:true};musOn=true;lastDanceAccent=-Infinity;
      eDanceLead=(t,n,d,v)=>{if(v>.03||d>.16)throw Error('large merge accent');accents++;};
      for(let i=0;i<30;i++)reactToMerge(8,5);
      if(accents!==1||pendingHits.length)throw Error('merge storm');
      AC.currentTime+=SESSION.spb+.01;reactToMerge(8,5);if(accents!==2)throw Error('accent failed to recover');
      musOn=false;AC.currentTime+=1;reactToMerge(8,5);if(accents!==2)throw Error('muted accent');
      songStart=1;technoStep=96;const S=SESSION;newGame();
      if(SESSION!==S||songStart!==1||technoStep!==96)throw Error('retry restarted dance');
      return{accentsFor30Merges:1,muted:true,retryContinuous:true};
    }finally{AC=old.AC;MB=old.MB;SESSION=old.SESSION;songSrc=old.songSrc;track=old.track;songStart=old.songStart;technoStep=old.technoStep;state=old.state;eDanceLead=old.lead;musOn=old.musOn;lastDanceAccent=old.lastDanceAccent;hype=0;}
  },
  async render(seed,bar,count,style='techno'){
    track=style==='dance'?DANCE:TECHNO;
    const rate=24000,session=composeSession(seed),duration=count*16*session.s16+5;
    const offline=new OfflineAudioContext(2,Math.ceil(duration*rate),rate);
    const survivors=new Map(),realRelease=releaseVoice;
    for(const method of ['createOscillator','createBufferSource']){const create=offline[method].bind(offline);offline[method]=()=>{const source=create(),stop=source.stop.bind(source);source.stop=t=>{source.stopAt=t;stop(t);};return source;};}
    releaseVoice=(source,...args)=>{realRelease(source,...args);const ended=source.onended;survivors.set(source,new Error().stack.split('\\n')[2]);source.onended=()=>{survivors.delete(source);ended();};};
    window.AudioContext=function(){return offline;};AC=null;MB=null;songSrc=null;initAudio();startLiveTechno(true,seed);
    if(schedWorker){schedWorker.terminate();schedWorker=null;}if(schedTimer){clearInterval(schedTimer);schedTimer=null;}
    state='play';hype=.3;feverOn=false;goldT=0;dangerOn=false;
    for(let s=0;s<count*16;s++)scheduleStep(bar*16+s,.08+s*SESSION.s16);
    const buffer=await offline.startRendering();await new Promise(r=>setTimeout(r,20));
    let peak=0,sum=0,bad=0;const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
    for(let i=0;i<left.length;i++){for(const v of [left[i],right[i]]){if(!Number.isFinite(v))bad++;peak=Math.max(peak,Math.abs(v));sum+=v*v;}}
    const metrics={style,seed,bar,peak,rms:Math.sqrt(sum/(left.length*2)),bad,voices:liveVoices,survivors:[...survivors].map(([s,where])=>({stop:s.stopAt,where,duration}))};
    releaseVoice=realRelease;
    if((style==='techno'&&bar===32)||(style==='dance'&&bar===16)){const pcm=new Int16Array(left.length*2);for(let i=0;i<left.length;i++){pcm[i*2]=Math.max(-32768,Math.min(32767,left[i]*32767));pcm[i*2+1]=Math.max(-32768,Math.min(32767,right[i]*32767));}await window.savePCM(Array.from(new Uint8Array(pcm.buffer)),rate,style);}
    return metrics;
  }
};
`;
const server=http.createServer((req,res)=>{
  if(req.url==='/__test.html'){res.setHeader('Content-Type','text/html');res.end(html.replace('/* ================= boot ================= */',hook+'\n/* ================= boot ================= */'));return;}
  const file=path.join(root,req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'image/png');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  try{
    const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    const url='http://127.0.0.1:'+server.address().port;
    await page.goto(url+'/__test.html');
    const music=await page.evaluate(()=>engineTest.smoke());assert(music.material===24&&music.forms>8&&music.maxCache<=3&&music.deterministic);console.log('Arrangement:',JSON.stringify(music));
    for(const kind of ['match','overlap','chain','prism','special','stack']){
      const runs=[];for(const fps of [30,60,120])runs.push(await page.evaluate(({fps,kind})=>engineTest.fixtures(fps,kind),{fps,kind}));
      for(const run of runs){for(const b of run){assert(Number.isFinite(b.x)&&Number.isFinite(b.vy));assert(b.x-b.r>=5.99&&b.x+b.r<=114.01&&b.y+b.r<=190.01);}}
      assert.deepStrictEqual(runs[0],runs[1]);assert.deepStrictEqual(runs[1],runs[2]);
      if(kind==='match')assert(runs[0].length===1&&runs[0][0].t===1);
      if(kind==='chain')assert(runs[0].length===1&&runs[0][0].t===2);
      if(kind==='prism')assert(runs[0].length===1&&runs[0][0].t===5);
      if(kind==='special')assert(runs[0].length===2);
      if(kind==='overlap')assert(Math.hypot(runs[0][0].x-runs[0][1].x,runs[0][0].y-runs[0][1].y)>19.9);
      console.log('Physics:',kind,'30/60/120 FPS identical;',runs[0].length,'bodies');
    }
    const live=await page.evaluate(()=>engineTest.live());console.log('Gameplay:',JSON.stringify(live));assert(live.continuous&&live.muted&&live.dropX===93&&live.shakeSpent&&live.played.merges>0);
    await page.screenshot({path:path.join(__dirname,'engine-play.png')});
    for(const [seed,bar,count] of [[12345,0,4],[12345,24,8],[12345,32,8],[24680,48,8],[987654,64+20,8]]){
      await page.goto(url+'/__test.html');
      await page.exposeFunction('savePCM',(bytes,rate)=>{
        const pcm=Buffer.from(bytes),wav=Buffer.alloc(44+pcm.length);wav.write('RIFF');wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);pcm.copy(wav,44);fs.writeFileSync(path.join(__dirname,'techno-preview.wav'),wav);
      }).catch(e=>{if(!e.message.includes('already registered'))throw e;});
      const audio=await page.evaluate(args=>engineTest.render(...args),[seed,bar,count]);
      console.log('Audio:',JSON.stringify(audio));assert(audio.bad===0&&audio.peak<1&&audio.rms>.015&&audio.voices===0);
    }
    const ui=await browser.newPage({viewport:{width:430,height:900}});
    ui.on('pageerror',e=>errors.push(e.message));await ui.goto(url+'/');
    await ui.locator('#game').focus();await ui.keyboard.press('Space');
    await ui.waitForFunction(()=>document.querySelector('#title').hidden);
    for(let i=0;i<8;i++){await ui.keyboard.press('Space');await new Promise(r=>setTimeout(r,360));}
    await ui.waitForFunction(()=>Number(document.querySelector('#score').textContent)>0);
    await ui.screenshot({path:path.join(__dirname,'engine-play.png')});
    await ui.locator('#sndBtn').click();await ui.locator('#musTog').click();
    assert(await ui.locator('#musTog').getAttribute('aria-pressed')==='false');
    await ui.locator('#musTog').click();assert(await ui.locator('#musTog').getAttribute('aria-pressed')==='true');
    await ui.locator('#musicVol').focus();await ui.keyboard.press('Home');
    assert(await ui.locator('#musicValue').textContent()==='0%');
    await ui.keyboard.press('End');assert(await ui.locator('#musicValue').textContent()==='100%');
    await ui.screenshot({path:path.join(__dirname,'engine-mixer.png')});
    await ui.locator('#radioClose').click();await ui.setViewportSize({width:1280,height:900});
    await ui.screenshot({path:path.join(__dirname,'engine-desktop.png')});
    await ui.close();assert.deepStrictEqual(errors,[]);
    console.log('PASS: browser controls, mobile/desktop layouts, physics, continuous/muted playback, 24 chapters and offline audio.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
