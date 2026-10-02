const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const code=`
setTimeout(()=>{
  const r=s=>{const e=document.querySelector(s);if(!e)return s+':none';const b=e.getBoundingClientRect();const c=getComputedStyle(e);return s+'['+Math.round(b.x)+','+Math.round(b.width)+','+c.display+','+c.gridTemplateColumns+']';};
  const d=document.createElement('div');d.id='probe';
  d.textContent=[r('#app'),r('#bar'),r('#ladder'),r('.chip'),r('.chip canvas'),'vw='+innerWidth,'port='+matchMedia('(orientation:portrait)').matches].join(' | ');
  d.style.cssText='position:fixed;top:0;left:0;z-index:9999;background:#000;color:#0f0;font-size:10px';
  document.body.appendChild(d);
},800);
`;
fs.writeFileSync(__dirname+'/layout.html',html.replace('/* ================= boot ================= */',code+'/* ================= boot ================= */'));
console.log('layout.html built');
