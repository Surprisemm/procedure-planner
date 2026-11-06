// Real mouse: drag a patient column by its header.
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  const pause=(ms=60)=>new Promise(r=>setTimeout(r,ms));
  const send=async(type,x,y,extra={})=>{window.webContents.sendInputEvent({type,x:Math.round(x),y:Math.round(y),...extra});await pause(50);};
  const run=code=>window.webContents.executeJavaScript(code);
  const state=`JSON.parse(window.ritmDesktop.storage.load().data)`;
  const check=(value,message)=>{if(!value)throw Error(message);};
  const header=i=>run(`(()=>{const r=document.querySelectorAll('.column-header')[${i}].getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width};})()`);
  const order=()=>run(`[...document.querySelectorAll('.column-header')].map(e=>e.dataset.patient)`);
  const transforms=()=>run(`[...document.querySelectorAll('.column-header')].map(e=>e.style.transform)`);
  const undo=()=>run(`document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));`);
  await run(`document.querySelector('[data-field="start"]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.workspace-heading').click();document.querySelector('.schedule-scroll').scrollLeft=0;`);
  await send('mouseMove',5,5);
  const start=await order(),first=await header(0),width=first.width;
  // While dragging: neighbours slide, the dragged column and its blocks follow the cursor.
  await send('mouseMove',first.x,first.y);await send('mouseDown',first.x,first.y,{button:'left',clickCount:1});
  await send('mouseMove',first.x+20,first.y);await send('mouseMove',first.x+width*2-10,first.y);await pause(280);
  let moved=await transforms();
  check(moved[0].includes('translateX'),'Dragged header must follow the cursor: '+moved[0]);
  check(moved[1]===`translateX(-${width}px)`&&moved[2]===`translateX(-${width}px)`,'Neighbours must slide aside: '+moved.slice(0,4).join());
  check(moved[3]==='','Far columns stay: '+moved[3]);
  check(await run(`getComputedStyle(document.querySelectorAll('.column-header')[1]).transitionDuration!=='0s'`),'Slide must animate');
  check(await run(`document.querySelector('[data-lane="${start[1]}"]').style.transform===\`translateX(-${width}px)\``),'Lane must slide with its header');
  check(await run(`[...document.querySelectorAll('.appointment-group[data-col="${start[1]}"] .appointment')].every(e=>e.style.transform===\`translateX(-${width}px)\`)`),'Blocks must slide with their column');
  check(await run(`[...document.querySelectorAll('.appointment-group[data-col="${start[0]}"] .appointment')].every(e=>e.style.transform.includes('translateX'))`),'Blocks must follow the dragged column');
  check(await run(`document.querySelector('#drag-preview').hidden`),'No placement preview');
  // Everything of the dragged column lies above every other column, block over block included.
  await send('mouseMove',first.x+width*2-10-Math.round(width/2),first.y);await pause(280);
  const stack=await run(`(()=>{
    const id='${start[0]}',head=document.querySelector('.column-header[data-patient="'+id+'"]').getBoundingClientRect(),box=document.querySelector('.schedule-scroll').getBoundingClientRect();
    const neighbour=[...document.querySelectorAll('.appointment')].filter(e=>e.closest('.appointment-group').dataset.col!==id).some(e=>{const r=e.getBoundingClientRect();return r.left<head.right-4&&r.right>head.left+4;});
    const owner=e=>e.closest?.('.appointment-group')?.dataset.col??e.closest?.('[data-lane]')?.dataset.lane??e.closest?.('.column-header')?.dataset.patient;
    const wrong=[];
    const area=document.querySelector('#lanes').getBoundingClientRect();for(let y=Math.max(area.top+2,box.top+84);y<Math.min(area.bottom-2,box.bottom-20);y+=9)for(const x of [head.left+6,head.left+head.width/2,head.right-6]){const hit=document.elementFromPoint(x,y);if(owner(hit)!==id)wrong.push(Math.round(x)+','+Math.round(y)+' '+hit.className);}
    return {neighbour,wrong:wrong.slice(0,4),count:wrong.length};
  })()`);
  check(stack.neighbour,'Test setup: dragged column must overlap a neighbour block');
  check(!stack.count,'Dragged column must cover all other columns: '+stack.wrong.join(' | '));
  await send('mouseMove',first.x+width*2-10,first.y);await pause(280);
  if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'column-drag.png'),(await window.webContents.capturePage()).toPNG());}
  await send('mouseUp',first.x+width*2-10,first.y,{button:'left',clickCount:1});await pause(280);
  let now=await order();
  check(now[2]===start[0]&&now[0]===start[1]&&now[1]===start[2]&&now.length===start.length,'Order did not change: '+now.slice(0,3));
  check((await transforms()).every(t=>t===''),'Transforms must clear after the drop');
  const saved=await run(`(()=>{const s=${state};return {patients:s.patients.filter(p=>!p.archived).map(p=>p.id),days:Object.values(s.days).map(d=>d.columns.map(c=>c.patientId))};})()`);
  check(JSON.stringify(saved.patients)===JSON.stringify(now),'Patient order not saved');
  check(saved.days.every(d=>JSON.stringify(d)===JSON.stringify(now)),'Every day must follow');
  check(await run(`document.querySelector('.column-header.selected')===null`),'Drop must not select the column');
  check(await run(`document.querySelector('.patient-item .patient-select').dataset.id==='${start[1]}'`),'Left list must follow');
  await undo();check(JSON.stringify(await order())===JSON.stringify(start),'Undo must restore the order');
  // The header row and time axis stay above a column dragged past them.
  await send('mouseMove',first.x,first.y);await send('mouseDown',first.x,first.y,{button:'left',clickCount:1});await send('mouseMove',first.x-20,first.y);await send('mouseMove',first.x-Math.round(width/2)-30,first.y);await pause(120);
  check(await run(`(()=>{const a=document.querySelector('.time-axis').getBoundingClientRect(),hit=document.elementFromPoint(a.right-6,a.top+40);return !!hit.closest('.time-axis');})()`),'Time axis must stay on top');
  await run(`document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));`);await send('mouseUp',first.x-60,first.y,{button:'left',clickCount:1});await pause(260);
  // Blocks stay with their patient, the appointments themselves do not change.
  const before=await run(`JSON.stringify(Object.values(${state}.days)[0].appointments)`);
  await send('mouseMove',first.x,first.y);await send('mouseDown',first.x,first.y,{button:'left',clickCount:1});await send('mouseMove',first.x+width+40,first.y);await send('mouseMove',first.x+width+50,first.y);await send('mouseUp',first.x+width+50,first.y,{button:'left',clickCount:1});await pause(280);
  check(await run(`JSON.stringify(Object.values(${state}.days)[0].appointments)`)===before,'Appointments must not change');
  await undo();
  // A plain click still selects; Escape cancels.
  await send('mouseMove',first.x,first.y);await send('mouseDown',first.x,first.y,{button:'left',clickCount:1});await send('mouseUp',first.x,first.y,{button:'left',clickCount:1});await pause(100);
  check(await run(`document.querySelector('.column-header.selected')?.dataset.patient==='${start[0]}'`),'Click must still select the patient');
  await run(`document.querySelector('.workspace-heading').click();`);
  await send('mouseMove',first.x,first.y);await send('mouseDown',first.x,first.y,{button:'left',clickCount:1});await send('mouseMove',first.x+20,first.y);await send('mouseMove',first.x+width*2,first.y);
  await run(`document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));`);await pause(260);
  await send('mouseUp',first.x+width*2,first.y,{button:'left',clickCount:1});await pause(120);
  check(JSON.stringify(await order())===JSON.stringify(start),'Escape must cancel');
  check((await transforms()).every(t=>t===''),'Escape must clear the slide');
  // Different widths and 50% zoom.
  await run(`{const z=document.querySelector('#zoom');z.value='0.5';z.dispatchEvent(new Event('change',{bubbles:true}));}`);await pause();
  const small=await header(0);
  await send('mouseMove',small.x,small.y);await send('mouseDown',small.x,small.y,{button:'left',clickCount:1});await send('mouseMove',small.x+15,small.y);await send('mouseMove',small.x+small.width-8,small.y);await send('mouseUp',small.x+small.width-8,small.y,{button:'left',clickCount:1});await pause(280);
  now=await order();check(now[1]===start[0]&&now[0]===start[1],'Zoomed drag failed');
  await undo();
  await run(`{const z=document.querySelector('#zoom');z.value='1';z.dispatchEvent(new Event('change',{bubbles:true}));}`);
  // A patient switched off today keeps a sensible place.
  await run(`document.querySelector('[data-patient-toggle="${start[1]}"]').click();`);await pause();
  const third=await header(0);
  await send('mouseMove',third.x,third.y);await send('mouseDown',third.x,third.y,{button:'left',clickCount:1});await send('mouseMove',third.x+20,third.y);await send('mouseMove',third.x+third.width-10,third.y);await send('mouseUp',third.x+third.width-10,third.y,{button:'left',clickCount:1});await pause(280);
  now=await order();check(now[0]===start[2]&&now[1]===start[0],'Drag with a hidden patient failed: '+now.slice(0,2));
  console.log('COLUMN_DRAG_VERIFIED');
};
