/* Local physics simulations, without browser/UI automation. Run: node tools/verify_friction.js */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const slice=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const shared=`
${slice('const W=','const SCORE=')}
${slice('const TIERS=','/* ================= live procedural audio engine')}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
${slice('const PHYS_H=','let score=')}
let time=0,uid=0,pace=1,state='title',bodies=[],merging=[],parts=[];
const burst=()=>{},dust=()=>{},sfxLand=()=>{},sparkles=()=>{},actSpecials=()=>{};
${slice('function mk(t,','const mkHeld=')}
${slice('function doMerge(','function gameOver(')}
`;
function simulate(kind,fps=60,baseline=false){
  const sandbox={};vm.createContext(sandbox);
  const physics=baseline?fs.readFileSync(path.join(__dirname,'physics-before.txt'),'utf8'):slice('function physics(h)','function tickPal');
  vm.runInContext(shared+physics+slice('function tickPal','/* ================= update ================= */'),sandbox);
  const setup={
    slide:"bodies=[mk(2,30,181)];bodies[0].vx=60;",
    contact:"bodies=[mk(4,60,177),mk(2,60,155)];bodies[1].vx=60;bodies[1].vy=50;",
    match:"bodies=[mk(0,45,170),mk(0,58.4,170)];",
    chain:"bodies=[mk(0,48,184),mk(0,60,184),mk(1,69,182.5)];",
    overlap:"bodies=[mk(2,60,160),mk(3,60,160)];",
    stack:"for(let i=0;i<32;i++){const b=mk(i%7,20+(i%4)*26,65+Math.floor(i/4)*14);b.vx=(i%3-1)*50;bodies.push(b);}",
    shake:"for(let i=0;i<16;i++){const b=mk(i%5,20+(i%4)*26,90+Math.floor(i/4)*20);b.vx=(i%3-1)*150;b.vy=-260;bodies.push(b);}",
  }[kind];
  assert(setup,kind);
  return JSON.parse(vm.runInContext(`
    ${setup}for(const b of bodies)b.age=.3;
    let maxOverlap=0;
    for(let i=0;i<${fps*6};i++)stepBodies(1/${fps});
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)maxOverlap=Math.max(maxOverlap,bodies[i].r+bodies[j].r-Math.hypot(bodies[i].x-bodies[j].x,bodies[i].y-bodies[j].y));
    JSON.stringify({bodies:bodies.map(b=>({t:b.t,x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r})),maxOverlap});
  `,sandbox));
}
for(const kind of ['slide','contact','match','chain','overlap','stack','shake']){
  const runs=[30,60,120].map(fps=>simulate(kind,fps));
  assert.deepStrictEqual(runs[0],runs[1]);assert.deepStrictEqual(runs[1],runs[2]);
  for(const b of runs[0].bodies){assert(Object.values(b).every(Number.isFinite));assert(b.x-b.r>=5.99&&b.x+b.r<=114.01&&b.y+b.r<=190.01);}
  assert(runs[0].maxOverlap<1.5,'deep overlap: '+kind+' '+runs[0].maxOverlap);
  if(kind==='match')assert(runs[0].bodies.length===1&&runs[0].bodies[0].t===1);
  if(kind==='chain')assert(runs[0].bodies.length===1&&runs[0].bodies[0].t===2);
  console.log(kind+': consistent at 30/60/120 FPS, '+runs[0].bodies.length+' bodies, max overlap '+runs[0].maxOverlap.toFixed(3)+'px');
}
const slide=simulate('slide').bodies[0];assert(slide.x>60&&Math.abs(slide.vx)<.2);
if(fs.existsSync(path.join(__dirname,'physics-before.txt'))){
  const old=simulate('slide',60,true).bodies[0],oldContact=simulate('contact',60,true),contact=simulate('contact');
  console.log('Floor travel: '+(old.x-30).toFixed(2)+'px before -> '+(slide.x-30).toFixed(2)+'px after');
  console.log('Contact travel: '+(oldContact.bodies.find(b=>b.t===2).x-60).toFixed(2)+'px before -> '+(contact.bodies.find(b=>b.t===2).x-60).toFixed(2)+'px after');
}
console.log('PASS: lighter friction, settling, overlaps, chains, stacks and shake trajectories.');
