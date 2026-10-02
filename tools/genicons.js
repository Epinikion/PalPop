const fs=require('fs'),zlib=require('zlib');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');

function slice(a,b){const i=html.indexOf(a),j=html.indexOf(b);if(i<0||j<0)throw new Error('marker missing: '+a);return html.slice(i,j);}
const code=[
  slice('const BAY=','const seeded='),
  slice('const TIERS=[','/* ================= live procedural audio'),
  'const mkc=(w,h)=>{const c=document.createElement("canvas");c.width=w;c.height=h;return c;};',
  slice('function paint(','const FONT=')
].join('\n');

function makeCtx(w,h){
  const px=new Uint8ClampedArray(w*h*4);
  const parse=c=>{let h=c.slice(1);if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255,255];};
  return {
    fillStyle:'#000',px,
    fillRect(x,y,rw,rh){
      const c=parse(this.fillStyle);
      x=Math.round(x);y=Math.round(y);rw=Math.round(rw);rh=Math.round(rh);
      for(let yy=Math.max(0,y);yy<Math.min(h,y+rh);yy++)for(let xx=Math.max(0,x);xx<Math.min(w,x+rw);xx++){
        const o=(yy*w+xx)*4;px[o]=c[0];px[o+1]=c[1];px[o+2]=c[2];px[o+3]=c[3];
      }
    }
  };
}
global.document={createElement:()=>{const c={width:0,height:0};c.getContext=()=>{if(!c._ctx)c._ctx=makeCtx(c.width,c.height);return c._ctx;};return c;}};
global.window={};
const fn=new Function(code+';return paint;');
const paint=fn();
const spr=paint(9,25,6,false); // Drako as the app icon

const CRC_T=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc32=b=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC_T[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function chunk(type,data){
  const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
  const td=Buffer.concat([Buffer.from(type,'ascii'),data]);
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len,td,crc]);
}
function png(w,h,rgba){
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;Buffer.from(rgba.buffer,y*w*4,w*4).copy(raw,y*(w*4+1)+1);}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function icon(size,scale){
  const ctx=makeCtx(size,size);
  ctx.fillStyle='#1c1432';ctx.fillRect(0,0,size,size);
  ctx.fillStyle='#241a44';ctx.fillRect(0,Math.floor(size*.62),size,size);
  const s=spr.width*scale,ox=Math.floor((size-s)/2),oy=Math.floor((size-s)/2);
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
    const sx=Math.floor(x/scale),sy=Math.floor(y/scale),o=(sy*spr.width+sx)*4,a=spr._ctx.px[o+3];
    if(!a)continue;
    const o2=((oy+y)*size+ox+x)*4;
    ctx.px[o2]=spr._ctx.px[o];ctx.px[o2+1]=spr._ctx.px[o+1];ctx.px[o2+2]=spr._ctx.px[o+2];ctx.px[o2+3]=255;
  }
  for(const p of [[.14,.18],[.84,.24],[.2,.8],[.88,.74]]){
    const x=Math.floor(p[0]*size),y=Math.floor(p[1]*size),o=(y*size+x)*4;
    ctx.px[o]=255;ctx.px[o+1]=244;ctx.px[o+2]=176;ctx.px[o+3]=255;
  }
  return png(size,size,Buffer.from(ctx.px.buffer));
}
fs.writeFileSync(__dirname+'/../icon-192.png',icon(192,2));
fs.writeFileSync(__dirname+'/../icon-512.png',icon(512,6));
fs.writeFileSync(__dirname+'/../apple-touch-icon.png',icon(180,2));
console.log('icons written');
