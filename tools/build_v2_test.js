const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'SickVersion2');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const write = (name, code) => fs.writeFileSync(path.join(root, name), html.replace('</body>', '<script>\n' + code + '\n</script>\n</body>'));

/* music: all four forms + hooks/filters + merge path */
write('_t1.html', `
setTimeout(()=>{
  try{
    PAL.Music.init();
    const M=PAL.Music;let n=0;
    M.newSong(12345);
    for(let cyc=0;cyc<4;cyc++)for(let s=cyc*1024;s<(cyc+1)*1024;s++){M.debug.scheduleStep(s,100+s*0.11);n++;}
    M.newSong(987654);
    for(let s=0;s<1024;s++){M.debug.scheduleStep(s,100+s*0.11);n++;}
    M.newSong(24680);
    for(let k=0;k<8;k++)M.merge(k%8,1+(k%5));
    for(let k=0;k<6;k++)M.frame(.016,{state:'play'});
    for(let bar=0;bar<256;bar++){const SA=M.debug.sectionAt(bar);M.debug.chordFor(bar,SA.sec,SA.cyc);}
    document.title='TESTOK:'+n;
  }catch(e){document.title='TESTFAIL:'+e.message+'@@'+(e.stack||'').split('\\n').slice(0,3).join('##');}
},400);
`);

/* gameplay: start, drop a stack, run the juicy physics */
write('_t2.html', `
window.addEventListener('error',e=>{document.title='LOADERR:'+e.message+'@'+(e.filename||'').split('/').pop()+':'+e.lineno;});
setTimeout(()=>{
  try{
    if(!PAL.Debug){document.title='NODEBUG';return;}
    PAL.Debug.start();
    for(let k=0;k<22;k++){PAL.Debug.drop();for(let i=0;i<25;i++)PAL.Debug.update(.033);}
    document.title='PLAYOK:'+PAL.Debug.bodies()+':'+PAL.Debug.state();
  }catch(e){document.title='PLAYFAIL:'+e.message+'@@'+(e.stack||'').split('\\n').slice(0,3).join('##');}
},400);
`);

/* screenshot: a mid-game board with merges */
write('_t3.html', `
setTimeout(()=>{
  try{
    PAL.Debug.start();
    for(let k=0;k<9;k++){PAL.Debug.drop();for(let i=0;i<36;i++)PAL.Debug.update(.033);}
    PAL.Debug.drop();
    for(let i=0;i<18;i++)PAL.Debug.update(.033);
    document.title='SHOTOK';
  }catch(e){document.title='SHOTFAIL:'+e.message;}
},400);
`);

/* 4) fever / rescue / shake paths */
write('_t4.html', `
setTimeout(()=>{
  try{
    PAL.Debug.start();
    for(let k=0;k<10;k++){PAL.Debug.drop();for(let i=0;i<20;i++)PAL.Debug.update(.033);}
    PAL.Debug._t.startFever();
    for(let i=0;i<30;i++)PAL.Debug.update(.033);
    PAL.Debug._t.startRescue();
    PAL.Debug.update(.033);
    PAL.Debug._t.doRescue();
    for(let k=0;k<6;k++){PAL.Debug.drop();for(let i=0;i<20;i++)PAL.Debug.update(.033);}
    PAL.Debug._t.useShake();
    for(let i=0;i<20;i++)PAL.Debug.update(.033);
    document.title='SYSTOK:'+PAL.Debug.state()+':'+PAL.Debug.bodies();
  }catch(e){document.title='SYSFAIL:'+e.message+'@@'+(e.stack||'').split('\\n').slice(0,3).join('##');}
},400);
`);

console.log('built SickVersion2 tests');
