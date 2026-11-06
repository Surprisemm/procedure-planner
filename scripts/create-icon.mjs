import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';

// One vector design shared by the header, executable, taskbar and shortcuts.
const destination=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../desktop');
const blue=[52,120,219];
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="138" fill="#3478db"/><g fill="none" stroke="white" stroke-width="24"><rect x="153" y="167" width="206" height="59" rx="4"/><rect x="153" y="286" width="133" height="59" rx="4"/></g></svg>';
fs.writeFileSync(path.join(destination,'icon.svg'),svg);
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}
function roundedRect(x,y,left,top,width,height,radius){if(x<left||x>=left+width||y<top||y>=top+height)return false;const cx=Math.max(left+radius,Math.min(left+width-radius,x)),cy=Math.max(top+radius,Math.min(top+height-radius,y));return (x-cx)**2+(y-cy)**2<=radius**2;}
function mark(x,y){
  if(!roundedRect(x,y,0,0,512,512,138))return null;
  for(const [left,top,width,height] of [[153,167,206,59],[153,286,133,59]]){
    if(roundedRect(x,y,left-12,top-12,width+24,height+24,16)&&!roundedRect(x,y,left+12,top+12,width-24,height-24,0))return [255,255,255];
  }
  return blue;
}
function raster(size){
  const bytes=Buffer.alloc(size*(size*4+1)),samples=4;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let coverage=0,r=0,g=0,b=0;
    for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
      const color=mark((x+(sx+.5)/samples)*512/size,(y+(sy+.5)/samples)*512/size);
      if(color){coverage++;r+=color[0];g+=color[1];b+=color[2];}
    }
    const offset=y*(size*4+1)+1+x*4;if(coverage){bytes[offset]=Math.round(r/coverage);bytes[offset+1]=Math.round(g/coverage);bytes[offset+2]=Math.round(b/coverage);bytes[offset+3]=Math.round(coverage*255/(samples*samples));}
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(bytes)),chunk('IEND',Buffer.alloc(0))]);
}
const sizes=[16,20,24,32,40,48,64,128,256],images=sizes.map(raster),directory=Buffer.alloc(6+16*sizes.length);directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);let offset=directory.length;
for(let i=0;i<sizes.length;i++){const entry=6+i*16;directory[entry]=directory[entry+1]=sizes[i]===256?0:sizes[i];directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);directory.writeUInt32LE(images[i].length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=images[i].length;}
const ico=Buffer.concat([directory,...images]);
fs.writeFileSync(path.join(destination,'icon.ico'),ico);
fs.writeFileSync(path.join(destination,'icon-512.png'),raster(512));
console.log('Иконка: SVG, PNG 512×512, ICO 16–256 px');
