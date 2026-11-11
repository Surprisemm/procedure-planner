// Copy and paste, Ctrl+drag copies, instructor labels and highlight, export by
// instructors and for several days. Runs on the demo project in an isolated profile.
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  const step=code=>window.webContents.executeJavaScript(`(async()=>{
    const assert=(v,m)=>{if(!v)throw Error(m)},read=()=>JSON.parse(window.ritmDesktop.storage.load().data);
    const date=()=>document.querySelector('#date-picker').value,list=()=>read().days[date()].appointments;
    const key=(code,extra={})=>document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code,...extra}));
    const undo=()=>key('KeyZ');
    const block=id=>document.querySelector('[data-appointment="'+id+'"]');
    const press=(id,mods={})=>{const r=block(id).getBoundingClientRect();block(id).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+20,clientY:r.top+12,...mods}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,...mods}));};
    const hoverAt=(x,y)=>document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y}));
    const set=(el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
    const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    ${code}
  })()`,true);
  await step(`
    document.querySelector('[data-field="start"]').dispatchEvent(new Event('change',{bubbles:true}));
    const start=list(),a=start[0],b=start.find(x=>x.patientId!==a.patientId);
    // Copy, paste after the original when the pointer is not over the grid.
    key('KeyV');assert(list().length===start.length,'Nothing to paste yet');
    press(a.id);hoverAt(2,2);key('KeyC');
    assert(document.querySelector('#toast').textContent.includes('Скопировано процедур: 1'),'Copy toast');
    key('KeyV');
    let now=list(),added=now.at(-1);
    assert(now.length===start.length+1&&added.id!==a.id&&added.patientId===a.patientId&&added.start===a.start+a.duration&&added.procedureId===a.procedureId,'Paste after the original');
    assert(document.querySelector('.appointment.selected').dataset.appointment===added.id,'Pasted block must be selected');
    undo();assert(list().length===start.length,'Paste must undo');
    // Paste under the pointer.
    const lanes=[...document.querySelectorAll('[data-lane]')],lane=lanes[4],r=lane.getBoundingClientRect(),box=document.querySelector('.schedule-scroll').getBoundingClientRect(),y=box.bottom-60;
    hoverAt(r.left+r.width/2,y);key('KeyV');
    added=list().at(-1);assert(added.patientId===lane.dataset.lane&&added.start>a.start,'Paste must land under the pointer: '+added.start);
    undo();
    // Two blocks keep their shape; the lane menu pastes too.
    press(a.id);press(b.id,{ctrlKey:true});await frame();
    assert(document.querySelectorAll('.appointment.selected').length===2,'Ctrl+click must still add to the selection');
    key('KeyC');
    document.querySelectorAll('[data-lane]')[4].dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:y}));
    const item=document.querySelector('.appt-menu button');assert(item&&item.textContent==='Вставить (2)','Lane menu: '+item?.textContent);
    item.click();now=list();assert(now.length===start.length+2,'Menu paste failed');
    const pasted=now.slice(-2),cols=read().days[date()].columns.map(c=>c.patientId);
    assert(cols.indexOf(pasted[1].patientId)-cols.indexOf(pasted[0].patientId)===cols.indexOf(b.patientId)-cols.indexOf(a.patientId)&&pasted[1].start-pasted[0].start===b.start-a.start,'Shape must be kept');
    undo();
    // Cut and paste into another day at the same patients and times.
    press(a.id);press(b.id,{ctrlKey:true});await frame();key('KeyX');
    assert(list().length===start.length-2,'Cut must remove the blocks');undo();
    press(a.id);press(b.id,{ctrlKey:true});await frame();key('KeyC');
    document.querySelector('[data-action="new-day"]').click();document.querySelector('#day-form [name=mode]').value='empty';document.querySelector('#day-form').requestSubmit();
    hoverAt(2,2);key('KeyV');
    now=list();assert(now.length===2&&now[0].patientId===a.patientId&&now[0].start===a.start&&now[1].patientId===b.patientId&&now[1].start===b.start,'Paste into another day');
    window.__second=date();
    document.querySelector('[data-action="prev-day"]').click();
  `);
  // Ctrl+drag leaves a copy.
  await step(`
    const start=list(),a=start[0],r=block(a.id).getBoundingClientRect(),lane=document.querySelectorAll('[data-lane]')[5].getBoundingClientRect(),y=r.top+150;
    block(a.id).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+20,clientY:r.top+12,ctrlKey:true}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+40,clientY:r.top+40,ctrlKey:true}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:lane.left+30,clientY:y,ctrlKey:true}));
    assert(document.querySelector('.drag-tooltip').textContent.includes('копия'),'Preview must say it is a copy');
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:lane.left+30,clientY:y,ctrlKey:true}));
    const now=list(),copy=now.at(-1),same=now.find(x=>x.id===a.id);
    assert(now.length===start.length+1&&same.start===a.start&&same.patientId===a.patientId,'The original must stay');
    assert(copy.patientId===document.querySelectorAll('[data-lane]')[5].dataset.lane&&copy.text===a.text,'The copy must land in the target column');
    undo();
    // Without Ctrl the same drag moves.
    block(a.id).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+20,clientY:r.top+12}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+40,clientY:r.top+40}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:lane.left+30,clientY:y}));
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:lane.left+30,clientY:y}));
    assert(list().length===start.length&&list().find(x=>x.id===a.id).patientId!==a.patientId,'Plain drag must move');
    undo();
  `);
  // Instructor names on blocks and highlight of one instructor.
  await step(`
    document.querySelector('[data-action="sidebar-tab"][data-tab="instructors"]').click();document.querySelector('[data-action="batch-instructors"]').click();
    const f=document.querySelector('#instructor-form');f.querySelector('textarea').value=['Юлия','Наталья'].join(String.fromCharCode(10));f.requestSubmit();
    const people=read().instructors;
    for(const [index,person] of people.entries()){
      const card=document.querySelectorAll('.procedure-card')[index],r=card.getBoundingClientRect();
      card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
      document.querySelector('#apply-procedure-day').click();document.querySelector('[data-action=add-proc-instructor]').click();
      set(document.querySelector('[data-proc-instructor="0"]'),person.id);
    }
    const mine=list().filter(x=>x.instructorId===people[0].id);assert(mine.length>0,'Appointments need an instructor');
    document.querySelector('.workspace-heading').click();
    assert(!document.querySelector('.appointment-instructor'),'Names are off by default');
    document.querySelector('.inspector [data-display=instructors]').click();
    assert(read().display.instructors===true,'Option saved');
    const labels=[...document.querySelectorAll('.appointment-instructor')];
    assert(labels.length===list().filter(x=>x.instructorId).length&&labels.some(e=>e.textContent==='Юлия'),'Names on blocks: '+labels.length);
    for(const label of labels){const b=label.closest('.appointment').getBoundingClientRect(),l=label.getBoundingClientRect();assert(l.bottom<=b.bottom+1&&l.top>=b.top,'Name must fit the block');}
    const row=document.querySelector('[data-instructor-row="'+people[0].id+'"]'),rr=row.getBoundingClientRect();
    row.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:rr.left+30,clientY:rr.top+10,pointerId:1}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:rr.left+30,clientY:rr.top+10,pointerId:1}));
    assert(document.querySelectorAll('.appointment.instructor-match').length===mine.length&&document.querySelectorAll('.appointment.instructor-dim').length===list().length-mine.length,'Highlight');
    const rows=[...document.querySelectorAll('.instructor-day button')];assert(rows.length===mine.length&&document.querySelector('.inspector').textContent.includes('В этом дне: '+mine.length),'Instructor day list');
    const times=rows.map(e=>e.querySelector('span').textContent);assert(times.join()===[...times].sort().join(),'List by time');
    await frame();
  `);
  if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'instructor-highlight.png'),(await window.webContents.capturePage()).toPNG());}
  await step(`
    document.querySelector('.instructor-day button').click();
    assert(document.querySelector('.appointment.selected')&&!document.querySelector('.instructor-dim'),'List row must open the block');
    document.querySelector('.workspace-heading').click();
    // Export: by patients with names, by instructors, several days.
    const people=read().instructors,busy=people.filter(p=>list().some(x=>x.instructorId===p.id));
    document.querySelector('[data-action=export]').click();
    const q=id=>document.querySelector(id),canvas=()=>document.querySelector('#export-preview canvas');
    assert(q('#export-who').checked&&!q('.export-who').hidden,'Names follow the day option');
    const withNames=canvas().toDataURL();q('#export-who').click();assert(canvas().toDataURL()!==withNames,'Names must change the image');
    const patientsWidth=canvas().width;
    assert([...q('#export-view').options].map(o=>o.textContent).join().includes('Инструктор: Юлия'),'View choice');
    set(q('#export-view'),'instructors');
    assert(q('.export-who').hidden&&canvas().width===(112+200*busy.length)*2&&canvas().width!==patientsWidth,'Instructor view width: '+canvas().width);
    set(q('#export-view'),'instructor:'+people[0].id);assert(canvas().width===(112+200)*2,'One instructor');
    assert(q('#export-note').textContent===''&&q('[data-action=download-export] span').textContent==='Сохранить PNG','Single file');
    set(q('#export-days'),'all');
    assert(q('#export-time').hidden&&q('#export-range').hidden,'Time is automatic for several days');
    set(q('#export-view'),'patients');
    assert(q('#export-note').textContent.includes('Будет сохранено изображений: 2')&&q('[data-action=download-export] span').textContent==='Сохранить PNG (2)','Two days: '+q('#export-note').textContent);
    set(q('#export-days'),'range');assert(!q('#export-range').hidden,'Range fields');
    set(q('#export-to'),q('#export-from').value);assert(q('#export-note').textContent==='','Range of one day');
    set(q('#export-from'),'2031-01-01');assert(q('[data-action=download-export]').disabled&&q('#modal-error').textContent.includes('период'),'Bad range');
    set(q('#export-days'),'all');set(q('#export-columns'),'6');
    assert(q('[data-action=download-export] span').textContent==='Сохранить PNG (4)','Parts multiply the files');
    window.__names=[date(),window.__second];
    q('[data-action=download-export]').click();
  `);
  const folder=path.join(out,'export');
  for(let i=0;i<60&&!(fs.existsSync(folder)&&fs.readdirSync(folder).length>=4);i++)await new Promise(r=>setTimeout(r,250));
  const files=fs.existsSync(folder)?fs.readdirSync(folder).sort():[];
  if(files.length!==4||!files.every(f=>/^Расписание-\d{4}-\d{2}-\d{2}-часть-[12]\.png$/.test(f)))throw Error('Saved files: '+files.join(', '));
  for(const f of files)if(!fs.readFileSync(path.join(folder,f)).subarray(1,4).equals(Buffer.from('PNG')))throw Error('Not a PNG: '+f);
  await step(`
    for(let i=0;i<40&&!document.querySelector('#toast').textContent.includes('Сохранено изображений: 4');i++)await new Promise(r=>setTimeout(r,100));
    assert(document.querySelector('#toast').textContent.includes('Сохранено изображений: 4'),'Save toast: '+document.querySelector('#toast').textContent);
    document.querySelector('#modal [data-action=close-modal]').click();
  `);
  console.log('V105_VERIFIED');
};
