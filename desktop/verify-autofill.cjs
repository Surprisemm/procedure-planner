// Drives the autofill dialog in the real window. Expects a project with patients
// and procedures in the smoke profile; never touches the user's own data.
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  const shot=async name=>{
    await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),(await window.webContents.capturePage()).toPNG());}
  };
  const step=code=>window.webContents.executeJavaScript(`(async()=>{
    const assert=(v,m)=>{if(!v)throw Error(m)},read=()=>JSON.parse(window.ritmDesktop.storage.load().data);
    const today=()=>{const s=read();return s.days[document.querySelector('#date-picker').value];};
    const open=()=>{document.querySelector('[data-action=autofill]').click();const f=document.querySelector('#autofill-form');assert(f,'Dialog did not open');return f;};
    const row=(f,key)=>{const r=[...f.querySelectorAll('[data-row]')].find(e=>e.dataset.row===key);assert(r,'Missing row '+key);return r;};
    const change=e=>e.dispatchEvent(new Event('change',{bubbles:true}));
    const clearOverlap=list=>{for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(a.patientId===b.patientId&&a.start<b.start+b.duration&&b.start<a.start+a.duration)throw Error('Patient overlap');}};
    ${code}
  })()`,true);
  await step(`
    const before=JSON.stringify(read().days);const f=open();
    assert(f.querySelectorAll('[data-row]').length===6,'Same-name templates must share a row');
    assert(read().procedures.filter(p=>p.name==='Массаж').length===1,'Old copies must merge into one card');
    assert(row(f,'массаж').querySelectorAll('[data-work]').length===2,'Row must list both instructors');
    assert(f.querySelector('#af-grid-all').checked,'Grid is on by default');
    assert(f.querySelector('[data-band-name="Обед"]').checked,'Lunch is blocked by default');
    assert(row(f,'афк · кушетка').querySelector('[data-limit]').value==='','Limit starts empty');
    assert(f.querySelectorAll('.time-control').length===2+2*7,'Every time field must use the inspector picker');
    assert([...f.querySelectorAll('.time-input')].every(e=>e.readOnly),'Time must not be typed');
    assert(f.querySelectorAll('.af-card').length===4,'Dialog must be split into blocks');
    assert(f.querySelectorAll('[data-group-value]').length===10,'Every patient must be listed');
    const listed=[...f.querySelectorAll('.af-matrix tbody td:first-child')].map(e=>e.textContent);assert(listed.join()===[...listed].sort((a,b)=>a.localeCompare(b,'ru')).join(),'Patients must be alphabetical');
    const to=row(f,'физиотерапия').querySelector('[data-work-to]'),control=to.closest('.time-control');
    to.click();assert(control.querySelector('.time-popup').matches(':popover-open'),'Clicking the field must open the picker');
    control.querySelector('[data-part=hour] [data-value="16"]').click();control.querySelector('[data-part=minute] [data-value="30"]').click();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    window.__afPicker=control;
    const dialog=document.querySelector('#modal');assert(dialog.scrollWidth<=dialog.clientWidth+1,'Dialog overflows sideways');
  `);
  await shot('autofill-dialog.png');
  await step(`
    window.__afPicker.querySelector('.time-picker-done').click();
    assert(window.__afPicker.querySelector('input').value==='16:30','Picker did not set the time');
    window.__afPicker.querySelector('input').click();window.__afPicker.querySelector('.time-picker-clear').click();
    assert(window.__afPicker.querySelector('input').value==='','Clear must remove the limit');
    assert(!document.querySelector('[name=start]').closest('.time-control').querySelector('.time-picker-clear'),'Required times cannot be cleared');
    {
      let current=document.querySelector('#autofill-form');
      assert(current.querySelectorAll('[data-group-name]').length===0&&current.querySelector('.af-matrix th:nth-child(2)').textContent==='Общая','Common group must exist and stay fixed');
      assert([...current.querySelectorAll('[data-group-value]')].every(e=>e.value===''),'Common group starts empty');
      current.querySelector('[data-af-add-group]').click();current=document.querySelector('#autofill-form');
      const name=current.querySelector('[data-group-name]');assert(name,'Group not created');
      name.value='Спорт';name.dispatchEvent(new Event('change',{bubbles:true}));current=document.querySelector('#autofill-form');
      const id=current.querySelector('[data-group-name]').dataset.groupName;
      const cells=[...current.querySelectorAll('[data-group-value="'+id+'"]')];assert(cells.length===10,'Every patient needs a number');
      assert(cells[0].type==='number'&&cells[0].step==='1','Numbers need the spinner');
      cells[0].value='1';cells[1].value='1';cells[2].value='5';
      const sport=row(current,'спорт');const mode=sport.querySelector('[data-together]');mode.value='groups';mode.dispatchEvent(new Event('change',{bubbles:true}));
      current=document.querySelector('#autofill-form');
      const pick=row(current,'спорт').querySelector('[data-row-group]');assert(pick&&[...pick.options].map(o=>o.textContent).join()==='Общая,Спорт','Procedure must choose a group');
      assert(pick.value==='common','New rows use the common group');
      assert(current.querySelector('[data-group-value="'+id+'"]').value==='1','Numbers lost on redraw');
      pick.value=id;pick.dispatchEvent(new Event('change',{bubbles:true}));
      window.__afGroup=id;
    }
    row(document.querySelector('#autofill-form'),'эрготерапия').querySelector('[data-limit]').value='1';
    row(document.querySelector('#autofill-form'),'спорт').querySelector('[data-pick]').click();
    row(document.querySelector('#autofill-form'),'афк · тренажёр').querySelector('[data-pick]').click();
    row(document.querySelector('#autofill-form'),'массаж').querySelector('[data-work-to]').value='14:00';
    document.querySelector('#autofill-form').requestSubmit();
    assert(!document.querySelector('#modal').open,'Dialog must close after generating');
    const d=today();assert(d.appointments.length===40,'Expected 10 patients x 4 procedures, got '+d.appointments.length);
  `).catch(async error=>{await shot('autofill-failure.png');throw error;});
  await shot('autofill-result.png');
  await step(`
    const d=today();clearOverlap(d.appointments);
    const single=d.appointments.filter(a=>a.text==='Эрготерапия');for(const a of single)assert(single.filter(b=>b.start<a.start+a.duration&&a.start<b.start+b.duration).length===1,'Limit ignored');
    assert(read().stays.find(s=>s.id===read().currentStayId).autofill.weekdays[new Date(document.querySelector('#date-picker').value+'T12:00:00').getDay()].rows['эрготерапия'].limit===1,'Limit not saved');
    const texts=new Set(d.appointments.map(a=>a.text));assert(!texts.has('Спорт'),'Unticked procedure was placed');
    for(const a of d.appointments)assert(a.start>=810||a.start+a.duration<=780,'Crossed lunch');
    const limited=read().procedures.find(p=>p.name==='Массаж').instructors[0].instructorId;for(const a of d.appointments.filter(a=>a.text==='Массаж'&&a.instructorId===limited))assert(a.start+a.duration<=840,'Instructor hours ignored');
    const first=JSON.stringify(d.appointments.map(a=>[a.patientId,a.text,a.start]));
    document.querySelector('[data-action=autofill-repeat]').click();
    const next=today();assert(next.appointments.length===d.appointments.length,'Repeat changed the amount of work');
    document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));
    assert(JSON.stringify(today().appointments.map(a=>[a.patientId,a.text,a.start]))===first,'One undo must restore the previous result');
    const saved=read().stays.find(s=>s.id===read().currentStayId).autofill;assert(saved,'Settings must survive undo');
    assert(saved.groupList.length===2&&saved.groupList[0].name==='Общая'&&saved.groupList[1].name==='Спорт'&&Object.values(saved.groupList[1].values).join()==='1,1,5','Groups must be saved');
    const again=open();assert(again.querySelector('[data-group-name]').value==='Спорт','Groups must return in the dialog');document.querySelector('#modal [data-action=close-modal]').click();
  `);
  await step(`
    const lock=document.querySelector('.appointment');lock.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:1,clientY:1}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:1,clientY:1}));
    document.querySelector('.appointment-lock[aria-pressed="false"]').click();
    const locked=today().appointments.find(a=>a.locked);assert(locked,'Lock was not set');
    for(let i=0;i<3;i++){document.querySelector('[data-action=autofill-repeat]').click();const kept=today().appointments.find(a=>a.id===locked.id);assert(kept&&kept.start===locked.start&&kept.locked,'Locked appointment moved');assert(today().appointments.filter(a=>a.patientId===locked.patientId&&a.text===locked.text).length===1,'Locked procedure was duplicated');}
    let f=open();f.querySelector('[name=mode][value=partial]').click();f=document.querySelector('#autofill-form');
    for(const pick of f.querySelectorAll('[data-pick]'))assert(!pick.checked,'Partial selection must start empty');
    row(f,'эрготерапия').querySelector('[data-pick]').click();
    const others=JSON.stringify(today().appointments.filter(a=>a.text!=='Эрготерапия').map(a=>a.id).sort());
    f.requestSubmit();
    assert(JSON.stringify(today().appointments.filter(a=>a.text!=='Эрготерапия').map(a=>a.id).sort())===others,'Partial generation changed other procedures');
    clearOverlap(today().appointments);
  `);
  await step(`
    let f=open();f.querySelector('[name=mode][value=full]').click();
    row(document.querySelector('#autofill-form'),'афк · тренажёр').querySelector('[data-pick]').click();
    document.querySelector('#autofill-form [data-af-add-link]').click();f=document.querySelector('#autofill-form');
    const link=f.querySelector('[data-link]');assert(link,'Link row missing');
    link.querySelector('[data-link-a]').value='афк · кушетка';link.querySelector('[data-link-b]').value='афк · тренажёр';
    f.requestSubmit();
    assert(document.querySelector('#modal').open&&document.querySelector('#modal').textContent.includes('Итог автозаполнения'),'Report must explain a link without a shared instructor');
    assert(document.querySelector('#modal').textContent.includes('нет общего инструктора'),'Report reason missing');
  `);
  await shot('autofill-report.png');
  await step(`
    document.querySelector('#modal [data-action=close-modal]').click();
    document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));
    let f=open();assert(f.querySelector('[data-link]'),'Link was not saved');
    f.querySelector('[data-af-remove-link]').click();f=document.querySelector('#autofill-form');
    assert(!f.querySelector('[data-link]'),'Link was not removed');
    f.querySelector('[name=start]').value='нет';f.requestSubmit();
    assert(document.querySelector('#modal').open&&document.querySelector('#modal-error').textContent.includes('начало'),'Invalid time must block generation');
    document.querySelector('#modal [data-action=close-modal]').click();
    const png=document.querySelector('[data-action=export]');png.click();const canvas=document.querySelector('#export-preview canvas');assert(canvas,'Generated day must export');
    const shownDay=today(),last=Math.max(...shownDay.appointments.map(a=>a.start+a.duration)),text=document.querySelector('#export-end').value;
    assert(shownDay.appointments.length&&text===String(Math.floor(last/60)).padStart(2,'0')+':'+String(last%60).padStart(2,'0'),'Export must end with the last procedure: '+text);document.querySelector('#modal [data-action=close-modal]').click();
  `);
  await step(`document.querySelector('[data-action=export]').click();`);
  await shot('export.png');
  await step(`document.querySelector('#modal [data-action=close-modal]').click();`);
  await step(`
    open();const buttons=[...document.querySelectorAll('#modal .af-help[popovertarget]')];assert(buttons.length===4,'Every block needs a hint: '+buttons.length);assert(document.querySelector('#modal [data-af-tutorial]'),'Title needs the presentation');
    for(const button of buttons){
      button.click();const popup=document.querySelector('.af-help-popup:popover-open');assert(popup&&popup.id===button.getAttribute('popovertarget'),'Hint did not open');
      const r=popup.getBoundingClientRect();assert(r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,'Hint leaves the window');
      assert(popup.querySelectorAll('li').length>=5,'Hint is too short');
      popup.hidePopover();
    }
    assert(document.querySelector('#modal').open,'Hints must not close the dialog');
    document.querySelector('.af-card:nth-child(2) .af-help').click();
  `);
  await shot('autofill-help.png');
  await step(`document.querySelector('.af-help-popup:popover-open').hidePopover();const body=document.querySelector('.autofill-body');body.scrollTop=body.scrollHeight;`);
  await shot('autofill-groups.png');
  await step(`document.querySelector('#modal [data-action=close-modal]').click();`);
  console.log('AUTOFILL_VERIFIED');
};
