import {hm,layoutAppointments,visibleColumns,isPatientEnabled,TIME_GUTTER,timeMarkIsClear} from './domain.mjs';
import {textStyle,canvasFont,fitText,bandLabelLayout,layoutPeriodLabels} from './presentation.mjs';
export function dateLabel(date){return new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
export function scheduleTitle(date){const d=new Date(date+'T12:00:00');return `Расписание на ${['воскресенье','понедельник','вторник','среду','четверг','пятницу','субботу'][d.getDay()]}, ${d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}`;}
function textBox(ctx,value,x,y,w,h,{size=12,fontFamily='Segoe UI',bold=false,italic=false,color='#26334b',align='center',strike=false}={}){
  if(w<=4||h<=2)return;
  const style={fontSize:size,fontFamily,bold,italic},fit=fitText(ctx,value,w-10,h-(h<18?0:4),style);
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.font=canvasFont({...style,fontSize:fit.fontSize});ctx.fillStyle=color;ctx.textBaseline='middle';ctx.textAlign=align;
  let top=y+(h-fit.lines.length*fit.lineHeight)/2+fit.lineHeight/2;
  for(const line of fit.lines){const tx=align==='left'?x+5:align==='right'?x+w-5:x+w/2;ctx.fillText(line,tx,top);if(strike){const width=ctx.measureText(line).width;ctx.fillRect(align==='left'?tx:align==='right'?tx-width:tx-width/2,top,width,1);}top+=fit.lineHeight;}
  ctx.restore();
}
function styledBox(ctx,value,x,y,w,h,style,options={}){textBox(ctx,value,x,y,w,h,{size:style.fontSize,fontFamily:style.fontFamily,bold:style.bold,italic:style.italic,...options});}
export function renderScheduleImage(day,{scale=2,start=day.start,end=Math.min(1439,day.end),columns=visibleColumns(day)}={}){
  columns=columns.filter(c=>isPatientEnabled(day,c.patientId));
  const gutter=TIME_GUTTER,titleH=54,headH=78,axisInset=10,ppm=1.6;
  const width=gutter+columns.reduce((s,c)=>s+c.width,0),height=titleH+headH+axisInset+(end-start)*ppm+36;
  if(end<=start||start<0||end>1440)throw Error('Укажите корректный диапазон времени');
  if(width*scale>16000||height*scale>16000||width*height*scale*scale>80000000)throw Error('Слишком большое изображение. Уменьшите масштаб или разделите колонки.');
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Не удалось создать изображение');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  textBox(ctx,scheduleTitle(day.date),14,9,width-28,34,{size:18,bold:true,align:'left'});
  const top=titleH+headH+axisInset,bodyH=(end-start)*ppm;
  ctx.fillStyle='#f5f7f8';ctx.fillRect(0,titleH,gutter,headH+axisInset+bodyH);textBox(ctx,'Время',0,titleH,gutter,headH,{size:11,bold:true});
  let x=gutter;
  for(const col of columns){ctx.fillStyle=col.headerColor;ctx.fillRect(x,titleH,col.width,headH);styledBox(ctx,col.name,x+4,titleH+5,col.width-8,46,textStyle(col,'name',{fontSize:12}));styledBox(ctx,`Домик ${col.house||'—'}`,x,titleH+51,col.width,23,textStyle(col,'house',{fontSize:10}),{color:'#6b7077'});ctx.fillStyle=col.color;ctx.fillRect(x,top,col.width,bodyH);x+=col.width;}
  const intersects=a=>a.start<end&&a.start+a.duration>start;
  ctx.save();ctx.beginPath();ctx.rect(gutter,top,width-gutter,bodyH);ctx.clip();
  for(let m=Math.ceil(start/day.step)*day.step;m<=end;m+=day.step){ctx.strokeStyle=m%60===0?'#d4dcde':'#e9edef';ctx.lineWidth=m%60===0?1:.5;const y=top+(m-start)*ppm;ctx.beginPath();ctx.moveTo(gutter,y);ctx.lineTo(width,y);ctx.stroke();}
  for(const b of day.bands.filter(intersects)){ctx.fillStyle=b.color;ctx.fillRect(gutter,top+(b.start-start)*ppm,width-gutter,b.duration*ppm);}
  x=gutter;
  for(const col of columns){for(const a of layoutAppointments(day.appointments.filter(a=>a.patientId===col.patientId&&intersects(a)))){
    const gap=3,w=(col.width-2*gap)/a.tracks-2,ax=x+gap+a.track*(w+2),y=top+(a.start-start)*ppm,h=Math.max(1,a.duration*ppm-2),style=textStyle(a,'text');
    ctx.save();ctx.globalAlpha=a.status==='cancelled'?.55:1;ctx.beginPath();ctx.roundRect(ax,y+1,w,h,Math.min(5,w/2,h/2));ctx.fillStyle=a.color;ctx.fill();ctx.strokeStyle='#00000020';ctx.stroke();ctx.clip();
    const timeHeight=h>28?17:0;styledBox(ctx,a.text,ax+2,y+3,w-4,h-timeHeight-3,style,{color:a.textColor,align:a.align,strike:a.status==='cancelled'});
    if(timeHeight)textBox(ctx,`${hm(a.start)}–${hm(a.start+a.duration)}`,ax,y+h-timeHeight,w,timeHeight,{size:9,color:a.textColor});ctx.restore();
  }x+=col.width;}
  ctx.restore();
  const labels=layoutPeriodLabels(ctx,day.bands.filter(intersects),ppm,start,end,gutter);
  for(let m=Math.ceil(start/30)*30;m<end;m+=30){
    if(!timeMarkIsClear(m,labels,ppm))continue;
    const y=top+(m-start)*ppm,hour=m%60===0;ctx.font=`${hour?'600':'400'} 11px "Segoe UI", sans-serif`;const gap=ctx.measureText(hm(m)).width/2+7;
    ctx.beginPath();ctx.strokeStyle=hour?'#aeb5bf':'#dce0e5';ctx.lineWidth=hour?1.5:1;if(hour){ctx.moveTo(0,y);ctx.lineTo(gutter/2-gap,y);ctx.moveTo(gutter/2+gap,y);}else ctx.moveTo(gutter-18,y);ctx.lineTo(gutter,y);ctx.stroke();textBox(ctx,hm(m),0,y-10,gutter,20,{size:11,color:hour?'#38475b':'#686d73',bold:hour});
  }
  for(const {band:b,label:l,top:relativeTop} of labels){const y=top+relativeTop;ctx.fillStyle=b.color;ctx.fillRect(0,y,gutter,l.height);styledBox(ctx,b.name,2,y+2,gutter-4,l.height-l.timeSize-6,l.style,{color:'#59616d'});textBox(ctx,`${hm(b.start)}–${hm(b.start+b.duration)}`,2,y+l.height-l.timeSize-4,gutter-4,l.timeSize+2,{size:l.timeSize,color:'#59616d'});}
  ctx.strokeStyle='#d9e0e2';ctx.lineWidth=1;x=gutter;ctx.beginPath();ctx.moveTo(0,titleH);ctx.lineTo(width,titleH);ctx.moveTo(gutter,top);ctx.lineTo(width,top);for(const col of columns){ctx.moveTo(x,titleH);ctx.lineTo(x,top+bodyH);x+=col.width;}ctx.moveTo(width-.5,titleH);ctx.lineTo(width-.5,top+bodyH);ctx.moveTo(0,top+bodyH);ctx.lineTo(width,top+bodyH);ctx.stroke();
  textBox(ctx,`${columns.length} пациентов · ${hm(start)}–${hm(end)}`,12,height-30,width-24,24,{size:10,color:'#7f8389',align:'left'});return canvas;
}
export async function downloadBlob(blob,name){if(window.ritmDesktop)return window.ritmDesktop.saveFile({name,type:blob.type==='image/png'?'png':'json',bytes:new Uint8Array(await blob.arrayBuffer())});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return {ok:true};}
