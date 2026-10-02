const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'SickVersion');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const write = (name, code) => {
  const early = '<script>window.addEventListener("error",e=>{document.title="LOADERR:"+e.message+"@"+(e.filename||"").split("/").pop()+":"+e.lineno;});<\/script>\n';
  fs.writeFileSync(path.join(root, name), html.replace('<script src="js/util.js"></script>', early + '<script src="js/util.js"></script>').replace('</body>', '<script>\n' + code + '\n</script>\n</body>'));
};

/* 1) music engine: every step of all four arrangement forms + merge path */
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

/* 2) gameplay: start, drop a stack, merge, verify bodies + score */
write('_t2.html', `
window.addEventListener('error',e=>{document.title='LOADERR:'+e.message+'@'+(e.filename||'').split('/').pop()+':'+e.lineno;});
setTimeout(()=>{
  try{
    if(!PAL.Debug){document.title='NODEBUG';return;}
    PAL.Debug.start();
    for(let k=0;k<18;k++){PAL.Debug.drop();for(let i=0;i<30;i++)PAL.Debug.update(.033);}
    const b=PAL.Debug.bodies();
    document.title='PLAYOK:'+b+':'+PAL.Debug.state();
  }catch(e){document.title='PLAYFAIL:'+e.message+'@@'+(e.stack||'').split('\\n').slice(0,3).join('##');}
},400);
`);

/* 3) mid-game screenshot: fewer drops so circles stay visible */
write('_t3.html', `
setTimeout(()=>{
  try{
    PAL.Debug.start();
    for(let k=0;k<7;k++){PAL.Debug.drop();for(let i=0;i<40;i++)PAL.Debug.update(.033);}
    PAL.Debug.drop();
    for(let i=0;i<20;i++)PAL.Debug.update(.033);
    document.title='SHOTOK';
  }catch(e){document.title='SHOTFAIL:'+e.message;}
},400);
`);

console.log('built SickVersion/_t1.html _t2.html _t3.html');
