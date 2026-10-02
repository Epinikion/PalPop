/* Build a browser diagnostics page; run its checks with the visible RUN AUDIO CHECKS button. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'verify_engine.js'),'utf8');
const hook=vm.runInNewContext(source.slice(source.indexOf('const hook='),source.indexOf('const server='))+'\nhook');
const diagnostics=`
const diag=document.createElement('section');diag.style.cssText='position:fixed;inset:0;z-index:999;background:#20182f;color:#e6ffbd;padding:24px;overflow:auto;font:14px/1.6 monospace';
diag.innerHTML='<h1>Soundtrack checks</h1><button id="runChecks">RUN AUDIO CHECKS</button><button id="runReactions">CHECK MERGE ACCENTS</button><p id="result">Ready</p><pre id="details"></pre><h2>Neon Daydream preview</h2><audio id="previewDance" controls></audio><h2>Techno preview</h2><audio id="previewTechno" controls></audio>';
document.body.appendChild(diag);
document.querySelector('#runReactions').onclick=()=>{try{document.querySelector('#details').textContent=JSON.stringify(engineTest.danceReactions());document.querySelector('#result').textContent='PASS: merge accents, mute and retry continuity';}catch(e){document.querySelector('#result').textContent='FAIL: '+e.message;}};
window.savePCM=(bytes,rate,style)=>{
  const buffer=new ArrayBuffer(44+bytes.length),view=new DataView(buffer),data=new Uint8Array(buffer);
  const write=(at,s)=>{for(let i=0;i<s.length;i++)data[at+i]=s.charCodeAt(i);};
  write(0,'RIFF');view.setUint32(4,36+bytes.length,true);write(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,bytes.length,true);data.set(bytes,44);
  let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
  document.querySelector(style==='dance'?'#previewDance':'#previewTechno').src='data:audio/wav;base64,'+btoa(binary);
};
document.querySelector('#runChecks').onclick=async()=>{
  const result=document.querySelector('#result'),details=document.querySelector('#details');result.textContent='RUNNING';details.textContent='';
  const log=v=>{details.textContent+=JSON.stringify(v)+'\\n';};
  try{
    const techno=engineTest.smoke();log(techno);if(techno.material!==24||techno.maxCache>3||!techno.deterministic)throw Error('techno composition');
    const dance=engineTest.dance();log(dance);if(dance.chords<100||dance.notes<100||dance.bpm!==124||dance.cache>3)throw Error('dance composition');
    log(engineTest.danceReactions());
    for(const args of [[12345,0,4,'dance'],[12345,8,4,'dance'],[12345,12,4,'dance'],[12345,16,8,'dance'],[24680,32,4,'dance'],[987654,80,8,'dance'],[12345,24,8,'techno'],[12345,32,8,'techno']]){
      const audio=await engineTest.render(...args);log(audio);if(audio.bad||audio.peak>=1||audio.rms<.004||audio.voices)throw Error('audio signal or resource check');
    }
    result.textContent='PASS: both compositions, every dance section, later chapters, clean audio and released voices';
  }catch(e){result.textContent='FAIL: '+e.message;log(e.stack);}
};
`;
new vm.Script(html.split('<script>')[1].split('</script>')[0]);
fs.writeFileSync(path.join(__dirname,'audio-check.html'),html.replace('<script>','<script>window.requestAnimationFrame=()=>0;</script><script>').replace('/* ================= boot ================= */',hook+diagnostics+'\n/* ================= boot ================= */'));
console.log('Built tools/audio-check.html; production JavaScript syntax OK');
