const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const MARK='/* ================= boot ================= */';
if(!html.includes(MARK))throw new Error('boot marker not found');

function inject(code,file){
  fs.writeFileSync(__dirname+'/'+file,html.replace(MARK,code+'\n'+MARK));
}

// 1) sprite sheet: all pals normal + blink
inject(`
setTimeout(()=>{
  try{
    document.querySelectorAll('#app,.side-note,#book,#radio').forEach(e=>e.remove());
    document.body.style.cssText='margin:0;background:#241640';
    const sc=3,cell=66*sc,cols=4;
    const c=document.createElement('canvas');c.width=cols*cell+20;c.height=8*cell+20;
    const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#241640';g.fillRect(0,0,c.width,c.height);
    for(let i=0;i<16;i++){
      for(let row=0;row<2;row++){
        const spr=(row?SPRB:SPR)[i];
        const cx=10+(i%cols)*cell+cell/2,cy=10+(Math.floor(i/cols)+row*4)*cell+cell/2;
        g.strokeStyle='#3a2a5d';g.strokeRect(10+(i%cols)*cell+.5,10+(Math.floor(i/cols)+row*4)*cell+.5,cell-1,cell-1);
        g.drawImage(spr,Math.round(cx-spr.width*sc/2),Math.round(cy-spr.height*sc/2),spr.width*sc,spr.height*sc);
      }
    }
    c.style.cssText='display:block';document.body.appendChild(c);document.title='SHEETOK';
  }catch(e){document.title='SHEETFAIL:'+e.message;}
},200);
`,'preview.html');

// 2) Drako big
inject(`
setTimeout(()=>{
  try{
    document.querySelectorAll('#app,.side-note,#book,#radio').forEach(e=>e.remove());
    document.body.style.cssText='margin:0;background:#241640;display:flex;gap:40px;align-items:center;justify-content:center;height:100vh';
    for(const spr of [SPR[9],SPRB[9]]){
      const sc=8,c=document.createElement('canvas');c.width=spr.width*sc;c.height=spr.height*sc;
      const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(spr,0,0,c.width,c.height);
      document.body.appendChild(c);
    }
    document.title='DRAKOOK';
  }catch(e){document.title='DRAKOFAIL:'+e.message;}
},200);
`,'drako.html');

// 3) audio engine smoke test: schedule every step of cycles 0..3 (all four arrangement forms)
inject(`
setTimeout(()=>{
  try{
    initAudio();
    if(!AC){document.title='NO_AUDIOCTX';return;}
    startLiveTechno(true,12345);
    let n=0;
    for(let cyc=0;cyc<4;cyc++)for(let s=cyc*1024;s<(cyc+1)*1024;s++){scheduleStep(s,100+s*0.11);n++;}
    startLiveTechno(true,987654);
    for(let s=0;s<1024;s++){scheduleStep(s,100+s*0.11);n++;}
    // merge attack path: hype pump + accent hits + duck automation
    startLiveTechno(true,24680);
    for(let k=0;k<8;k++){reactToMerge(2+(k%8),1+(k%5));}
    for(let k=0;k<6;k++)musicTick();
    // also exercise bassRoot/chordFor through sections
    for(let bar=0;bar<256;bar++){const SA=sectionAt(bar);chordFor(bar,SA.sec,SA.cyc);}
    document.title='TESTOK:'+n;
  }catch(e){document.title='TESTFAIL:'+e.message+'@@'+(e.stack||'').split('\\n').slice(0,4).join('##');}
},300);
`,'audiotest.html');

console.log('built preview.html, drako.html, audiotest.html');
