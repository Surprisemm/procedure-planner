export const FONTS=['Segoe UI','Arial','Calibri','Verdana','Georgia','Times New Roman','Courier New'];
export function textStyle(record,key,fallback={}){
  const legacy=key==='text'?{fontSize:record?.fontSize,bold:record?.bold,italic:record?.italic,fontFamily:record?.fontFamily}:{};
  return {fontFamily:'Segoe UI',fontSize:12,bold:false,italic:false,...fallback,...Object.fromEntries(Object.entries(legacy).filter(([,v])=>v!==undefined)),...record?.textStyles?.[key]};
}
export const fontCss=s=>`font-family:'${FONTS.includes(s.fontFamily)?s.fontFamily:'Segoe UI'}';font-size:${Number(s.fontSize)||12}px;font-weight:${s.bold?600:400};font-style:${s.italic?'italic':'normal'}`;
export const canvasFont=s=>`${s.italic?'italic ':''}${s.bold?'600':'400'} ${s.fontSize}px "${FONTS.includes(s.fontFamily)?s.fontFamily:'Segoe UI'}"`;
export function wrapText(ctx,value,width){
  const lines=[];let line='';
  for(const paragraph of String(value).split('\n')){
    for(const word of paragraph.split(/\s+/)){
      const next=line?line+' '+word:word;if(ctx.measureText(next).width<=width){line=next;continue;}
      if(line){lines.push(line);line='';}
      for(const char of word){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}
    }
    lines.push(line);line='';
  }
  return lines.length?lines:[''];
}
export function fitText(ctx,value,width,height,style){
  let size=style.fontSize,lines;
  do{ctx.font=canvasFont({...style,fontSize:size});lines=wrapText(ctx,value,width);if(lines.length*size*1.1<=height&&(size<=6||String(value).split(/\s+/).every(word=>ctx.measureText(word).width<=width)))break;size-=.5;}while(size>4);
  return {fontSize:Math.max(4,size),lines,lineHeight:Math.max(4,size)*1.1};
}
export function bandLabelLayout(ctx,band,pixelsPerMinute,width=112){
  const style=textStyle(band,'name',{fontSize:11,bold:true}),timeSize=8;
  ctx.font=canvasFont({...style,fontSize:6});const minimum=wrapText(ctx,band.name,width-12).length*6.6+timeSize+10;
  const height=Math.max(band.duration*pixelsPerMinute,32,minimum),titleHeight=height-timeSize*1.1-10;
  const title=fitText(ctx,band.name,width-12,titleHeight,style);
  return {height,offset:(height-band.duration*pixelsPerMinute)/2,style:{...style,fontSize:title.fontSize},lines:title.lines,lineHeight:title.lineHeight,timeSize};
}
export function layoutPeriodLabels(ctx,bands,pixelsPerMinute,start,end,width=112){
  let bottom=0;
  const result=[...bands].sort((a,b)=>a.start-b.start).map(band=>{
    const label=bandLabelLayout(ctx,band,pixelsPerMinute,width),top=Math.max(0,(band.start-start)*pixelsPerMinute-label.offset,bottom);
    bottom=top+label.height+2;return {band,label,top};
  });
  let ceiling=(end-start)*pixelsPerMinute;
  for(let i=result.length-1;i>=0;i--){const item=result[i];item.top=Math.max(0,Math.min(item.top,ceiling-item.label.height));ceiling=item.top-2;}
  return result.map(item=>({...item,start:start+item.top/pixelsPerMinute,duration:item.label.height/pixelsPerMinute}));
}
