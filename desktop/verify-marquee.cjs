// Real mouse: rubber-band selection on the grid.
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  const pause=(ms=60)=>new Promise(r=>setTimeout(r,ms));
  const send=async(type,x,y,extra={})=>{window.webContents.sendInputEvent({type,x:Math.round(x),y:Math.round(y),...extra});await pause(40);};
  const run=code=>window.webContents.executeJavaScript(code);
  const check=(value,message)=>{if(!value)throw Error(message);};
  const sweep=async(from,to,modifiers=[],release=true)=>{
    await send('mouseMove',from.x,from.y,{modifiers});await send('mouseDown',from.x,from.y,{button:'left',clickCount:1,modifiers});
    for(let i=1;i<=6;i++)await send('mouseMove',from.x+(to.x-from.x)*i/6,from.y+(to.y-from.y)*i/6,{modifiers});
    await pause(80);
    if(release){await send('mouseUp',to.x,to.y,{button:'left',clickCount:1,modifiers});await pause(120);}
  };
  const selected=()=>run(`[...document.querySelectorAll('.appointment.selected')].map(e=>e.dataset.appointment).sort()`);
  const saved=()=>run(`JSON.stringify(JSON.parse(window.ritmDesktop.storage.load().data).days[document.querySelector('#date-picker').value].appointments)`);
  await run(`document.querySelector('[data-field="start"]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.workspace-heading').click();document.querySelector('.schedule-scroll').scrollTop=0;document.querySelector('.schedule-scroll').scrollLeft=0;`);
  await send('mouseMove',5,5);
  // An empty spot under the morning blocks of the third column, dragged up-left to the first column.
  const spots=await run(`(()=>{
    const lanes=[...document.querySelectorAll('[data-lane]')],box=document.querySelector('.schedule-scroll').getBoundingClientRect();
    const empty=(lane)=>{const r=lane.getBoundingClientRect();for(let y=box.top+260;y<box.bottom-20;y+=6){const x=r.left+r.width/2;if(document.elementFromPoint(x,y)===lane)return {x,y};}return null;};
    const third=lanes[2].getBoundingClientRect(),first=lanes[0].getBoundingClientRect();
    return {from:empty(lanes[2]),to:{x:first.left+12,y:box.top+90},third:third.right};
  })()`);
  check(spots.from,'No empty spot to start from');
  const before=await saved();
  await sweep(spots.from,spots.to,[],false);
  const live=await run(`({frame:!!document.querySelector('#lanes .marquee'),hits:document.querySelectorAll('.appointment.marquee-hit').length})`);
  check(live.frame&&live.hits>=3,'Frame and live highlight while dragging: '+JSON.stringify(live));
  if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'marquee.png'),(await window.webContents.capturePage()).toPNG());}
  const expected=await run(`(()=>{const f=document.querySelector('#lanes .marquee').getBoundingClientRect();return [...document.querySelectorAll('#lanes .appointment')].filter(el=>{const r=el.getBoundingClientRect();return r.left<f.right&&r.right>f.left&&r.top<f.bottom&&r.bottom>f.top;}).map(e=>e.dataset.appointment).sort();})()`);
  await send('mouseUp',spots.to.x,spots.to.y,{button:'left',clickCount:1});await pause(150);
  const first=await selected();
  check(JSON.stringify(first)===JSON.stringify(expected)&&first.length>=3,'Selected '+first.length+', expected '+expected.length);
  check(await run(`!document.querySelector('.marquee')&&!document.querySelector('.marquee-hit')`),'Frame must disappear');
  check(await run(`document.querySelector('.inspector-header span').textContent==='Выбрано: '+${first.length}`),'Multi inspector');
  check(await saved()===before,'The frame must not move anything');
  // Ctrl adds to the selection.
  const more=await run(`(()=>{const lane=document.querySelectorAll('[data-lane]')[4],r=lane.getBoundingClientRect(),box=document.querySelector('.schedule-scroll').getBoundingClientRect();for(let y=box.top+260;y<box.bottom-20;y+=6){if(document.elementFromPoint(r.left+r.width/2,y)===lane)return {from:{x:r.left+r.width/2,y},to:{x:r.left+r.width/2+6,y:box.top+90}};}return null;})()`);
  check(more,'No second empty spot');
  await sweep(more.from,more.to,['control']);
  const added=await selected();
  check(added.length>first.length&&first.every(id=>added.includes(id)),'Ctrl must add: '+first.length+' -> '+added.length);
  // A plain frame replaces the selection; Escape cancels; a click on an empty spot clears it.
  await sweep(more.from,more.to);
  const replaced=await selected();check(replaced.length>0&&!first.some(id=>replaced.includes(id)),'Plain frame must replace the selection');
  await sweep(spots.from,spots.to,[],false);
  await run(`document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));`);await pause(60);
  await send('mouseUp',spots.to.x,spots.to.y,{button:'left',clickCount:1});await pause(120);
  check(JSON.stringify(await selected())===JSON.stringify(replaced)&&await run(`!document.querySelector('.marquee')`),'Escape must cancel');
  await send('mouseMove',spots.from.x,spots.from.y);await send('mouseDown',spots.from.x,spots.from.y,{button:'left',clickCount:1});await send('mouseUp',spots.from.x,spots.from.y,{button:'left',clickCount:1});await pause(120);
  check((await selected()).length===0&&await run(`!!document.querySelector('.inspector [data-field="scheduleName"]')`),'A click on an empty spot clears the selection');
  // The selection made by the frame moves together.
  await sweep(spots.from,spots.to);
  const group=await selected(),block=await run(`(()=>{const r=document.querySelector('.appointment.selected').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+12};})()`);
  await send('mouseMove',block.x,block.y);await send('mouseDown',block.x,block.y,{button:'left',clickCount:1});
  for(let i=1;i<=4;i++)await send('mouseMove',block.x,block.y+i*25);
  await send('mouseUp',block.x,block.y+100,{button:'left',clickCount:1});await pause(150);
  const moved=await run(`JSON.parse(window.ritmDesktop.storage.load().data).days[document.querySelector('#date-picker').value].appointments.filter(a=>${JSON.stringify(group)}.includes(a.id)).map(a=>a.start)`);
  const old=JSON.parse(before).filter(a=>group.includes(a.id)).map(a=>a.start);
  check(moved.every((s,i)=>s===old[i]+(moved[0]-old[0]))&&moved[0]!==old[0],'Framed blocks must move together');
  console.log('MARQUEE_VERIFIED',first.length,added.length);
};
