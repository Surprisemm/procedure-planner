// Drives the autofill dialog and the procedure rules in the real window. Expects a copy
// of tests/fixtures/autofill-project.json as autosave.json in the smoke profile.
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  const shot=async name=>{
    await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),(await window.webContents.capturePage()).toPNG());}
  };
  const step=code=>window.webContents.executeJavaScript(`(async()=>{
    const assert=(v,m)=>{if(!v)throw Error(m)},read=()=>JSON.parse(window.ritmDesktop.storage.load().data);
    const date=()=>document.querySelector('#date-picker').value,today=()=>read().days[date()];
    const stored=()=>{const s=read();return s.stays.find(x=>x.id===s.currentStayId).autofill;},plan=()=>stored().weekdays[new Date(date()+'T12:00:00').getDay()];
    const proc=name=>read().procedures.find(p=>p.name===name);
    const open=()=>{document.querySelector('[data-action=autofill]').click();const f=document.querySelector('#autofill-form');assert(f,'Dialog did not open');return f;};
    const form=()=>document.querySelector('#autofill-form');
    const row=key=>{const r=[...form().querySelectorAll('[data-row]')].find(e=>e.dataset.row===key);assert(r,'Missing row '+key);return r;};
    const set=(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    const choose=e=>{const r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));};
    const card=name=>{const el=[...document.querySelectorAll('.procedure-card')].find(e=>e.querySelector('strong').textContent===name);assert(el,'No card '+name);choose(el);};
    const rule=key=>document.querySelector('.inspector [data-rule="'+key+'"]');
    const undo=()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));
    const clearOverlap=list=>{for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(a.patientId===b.patientId&&a.start<b.start+b.duration&&b.start<a.start+a.duration)throw Error('Patient overlap');}};
    ${code}
  })()`,true);
  // The dialog keeps only the day: procedures, instructors, groups.
  await step(`
    const f=open();
    assert(read().procedures.filter(p=>p.name==='Массаж').length===1,'Old copies must merge into one card');
    assert(f.querySelectorAll('[data-row]').length===6,'One row per procedure');
    assert(row('массаж').querySelectorAll('[data-work]').length===2,'Row must list both instructors');
    assert(!f.querySelector('[data-grid],[data-limit],[data-together],[data-link]'),'Rules must not be edited in the dialog');
    assert(f.querySelectorAll('.af-card').length===3,'Dialog blocks');
    assert(document.querySelectorAll('#modal .af-help[popovertarget]').length===3&&document.querySelector('#modal [data-af-tutorial]'),'Hints');
    assert(f.querySelectorAll('.time-control').length===1+2*7&&[...f.querySelectorAll('.time-input')].every(e=>e.readOnly),'Time fields use the picker');
    assert(f.querySelector('.af-readonly').textContent==='17:30','Day end comes from the day');
    assert(!f.querySelector('[name=mode]'),'No separate modes');
    const all=f.querySelector('[data-pick-all]');assert(all.checked&&!all.indeterminate,'All procedures ticked');
    const height=()=>document.querySelector('#af-estimate').getBoundingClientRect().height,tall=height();
    row('спорт').querySelector('[data-pick]').click();assert(!all.checked&&all.indeterminate,'One off makes «Все» a dash');
    all.click();assert(all.checked&&[...f.querySelectorAll('[data-pick]')].every(e=>e.checked),'«Все» ticks everything');
    all.click();assert([...f.querySelectorAll('[data-pick]')].every(e=>!e.checked)&&!all.indeterminate,'«Все» clears everything');
    assert(Math.abs(height()-tall)<0.5,'The estimate must keep its size: '+tall+' -> '+height());
    all.click();const mark=document.querySelector('#af-estimate .af-estimate-icon');assert(mark&&Math.abs(height()-tall)<0.5,'One line with a mark');
    mark.dispatchEvent(new MouseEvent('mouseenter'));const tip=document.querySelector('#af-estimate-tip');assert(tip.matches(':popover-open')&&tip.querySelectorAll('li').length>=2,'Hover shows the details');
    const tr=tip.getBoundingClientRect();assert(tr.left>=0&&tr.top>=0&&tr.right<=innerWidth&&tr.bottom<=innerHeight,'Details stay in the window');
    mark.dispatchEvent(new MouseEvent('mouseleave'));assert(!tip.matches(':popover-open'),'Leaving hides the details');
    all.click();
    all.click();
    assert(row('массаж').querySelector('.af-rules span').textContent.includes('по сетке · поодиночке'),'Rules summary: '+row('массаж').querySelector('.af-rules span').textContent);
    const box=document.querySelector('#af-estimate'),note=key=>row(key).querySelector('[data-note]');
    assert(box.textContent.includes('Физиотерапевт')&&box.classList.contains('lost'),'Estimate must name the overloaded instructor: '+box.textContent);
    assert(note('физиотерапия').textContent==='нужно 10 · помещается 8'&&note('массаж').textContent==='нужно 10 · помещается 16','Row notes');
    const to=row('физиотерапия').querySelector('[data-work-to]'),control=to.closest('.time-control');
    to.click();assert(control.querySelector('.time-popup').matches(':popover-open'),'Clicking the field must open the picker');
    control.querySelector('[data-part=hour] [data-value="16"]').click();control.querySelector('.time-picker-done').click();
    assert(to.value==='16:00','Picker did not set the time');
    to.click();control.querySelector('.time-picker-clear').click();assert(to.value==='','Clear must remove the limit');
    const dialog=document.querySelector('#modal');assert(dialog.scrollWidth<=dialog.clientWidth+1,'Dialog overflows sideways');
  `);
  await shot('autofill-dialog.png');
  // The same settings by instructor.
  await step(`
    form().querySelector('[data-af-view=instructors]').click();
    assert(form().dataset.view==='instructors'&&form().querySelectorAll('.af-person').length===6,'People: '+form().querySelectorAll('.af-person').length);
    const person=name=>[...form().querySelectorAll('.af-person')].find(e=>e.querySelector('.af-name strong').textContent.trim()===name);
    assert(person('Физиотерапевт').querySelectorAll('[data-work]').length===2,'Artem has two procedures');
    assert(form().querySelectorAll('.af-chip [data-pick]').length===6,'Procedure switches stay available');
    set(person('Физиотерапевт').querySelector('[data-work-to]'),'13:00');
    person('АФК-инструктор 2').querySelector('[data-instructor-on]').click();
    assert(!person('АФК-инструктор 2').querySelector('[data-work-on]').checked,'Master switch must turn the instructor off');
    assert(document.querySelector('#af-estimate').textContent.includes('«Спорт»: не отмечен ни один инструктор'),'Estimate must follow');
    person('АФК-инструктор 2').querySelector('[data-instructor-on]').click();
    assert(person('АФК-инструктор 2').querySelector('[data-work-on]').checked,'Master switch back on');
  `);
  await shot('autofill-instructors.png');
  await step(`
    form().querySelector('[data-af-view=procedures]').click();
    const kept=[...form().querySelectorAll('[data-work]')].filter(e=>e.querySelector('[data-work-to]').value==='13:00');
    assert(kept.length===1&&kept[0].closest('[data-row]'),'Values must survive the view switch');
    set(kept[0].querySelector('[data-work-to]'),'');
    // "Изменить" saves the plan and opens the procedure.
    row('спорт').querySelector('[data-af-rules]').click();
    assert(!document.querySelector('#modal').open&&document.querySelector('.procedure-card.selected strong').textContent==='Спорт','Rules button must open the procedure');
    assert(plan()&&Array.isArray(plan().off),'The plan must be saved');
    const titles=[...document.querySelectorAll('.inspector .section-title')].map(e=>e.textContent);assert(titles.join()==='Процедура,Автозаполнение','Inspector sections: '+titles);
    assert(rule('grid').checked&&!rule('gap')&&!rule('capacity')&&!rule('groupId'),'Defaults');
    rule('grid').click();assert(proc('Спорт').rules.grid===false&&rule('gap'),'Grid off shows the break');
    set(rule('gap'),'10');assert(proc('Спорт').rules.gap===10,'Break saved');
    set(rule('together'),'any');assert(rule('capacity')&&proc('Спорт').rules.together==='any','Shared shows capacity');
    set(rule('capacity'),'1');assert(proc('Спорт').rules.capacity===2&&document.querySelector('#toast').textContent.includes('от 2 до 50'),'Bad capacity must be rejected');
    set(rule('capacity'),'4');set(rule('limit'),'3');assert(proc('Спорт').rules.capacity===4&&proc('Спорт').rules.limit===3,'Capacity and limit');
    set(rule('limit'),'');assert(proc('Спорт').rules.limit===null,'Empty limit');
    undo();assert(proc('Спорт').rules.limit===3,'Rule edits undo');
    const inspector=document.querySelector('.inspector');assert(inspector.scrollWidth<=inspector.clientWidth,'Inspector overflows');
  `);
  await shot('procedure-rules.png');
  await step(`
    card('Эрготерапия');set(rule('limit'),'1');
    const f=open();
    assert(row('спорт').querySelector('.af-rules span').textContent.includes('свободно, перерыв 10 · совместно до 4 · всего одновременно 3'),'Summary follows the rules: '+row('спорт').querySelector('.af-rules span').textContent);
    row('спорт').querySelector('[data-pick]').click();row('афк · тренажёр').querySelector('[data-pick]').click();
    set(row('массаж').querySelector('[data-work-to]'),'14:00');
    f.requestSubmit();
    assert(!document.querySelector('#modal').open,'Dialog must close after generating');
    const d=today();assert(d.appointments.length===40,'Expected 10 patients x 4 procedures, got '+d.appointments.length);
  `).catch(async error=>{await shot('autofill-failure.png');throw error;});
  await shot('autofill-result.png');
  await step(`
    const d=today();clearOverlap(d.appointments);
    assert(!d.appointments.some(a=>a.text==='Спорт'),'Unticked procedure was placed');
    for(const a of d.appointments)assert(a.start>=810||a.start+a.duration<=780,'Crossed lunch');
    const single=d.appointments.filter(a=>a.text==='Эрготерапия');for(const a of single)assert(single.filter(b=>b.start<a.start+a.duration&&a.start<b.start+b.duration).length===1,'Limit ignored');
    const limited=proc('Массаж').instructors[0].instructorId;for(const a of d.appointments.filter(a=>a.text==='Массаж'&&a.instructorId===limited))assert(a.start+a.duration<=840,'Instructor hours ignored');
    assert(plan().off.includes(proc('Спорт').id)&&plan().off.length===2,'Plan must remember what is off');
    const first=JSON.stringify(d.appointments.map(a=>[a.patientId,a.text,a.start]));
    document.querySelector('[data-action=autofill-repeat]').click();
    assert(today().appointments.length===40,'Repeat changed the amount of work');
    undo();assert(JSON.stringify(today().appointments.map(a=>[a.patientId,a.text,a.start]))===first,'One undo must restore the previous result');
    // Locks stay through repeats.
    choose(document.querySelector('.appointment'));document.querySelector('.appointment-group.is-selected .appointment-lock').click();
    const locked=today().appointments.find(a=>a.locked);assert(locked,'Lock was not set');
    for(let i=0;i<3;i++){document.querySelector('[data-action=autofill-repeat]').click();const kept=today().appointments.find(a=>a.id===locked.id);assert(kept&&kept.start===locked.start&&kept.locked,'Locked appointment moved');assert(today().appointments.filter(a=>a.patientId===locked.patientId&&a.text===locked.text).length===1,'Locked procedure was duplicated');}
    // Partial mode has its own switches and leaves other work alone.
    open();const all=form().querySelector('[data-pick-all]');all.checked=false;all.dispatchEvent(new Event('change',{bubbles:true}));
    for(const pick of form().querySelectorAll('[data-pick]'))assert(!pick.checked,'«Все» must clear the list');
    row('эрготерапия').querySelector('[data-pick]').click();
    const others=JSON.stringify(today().appointments.filter(a=>a.text!=='Эрготерапия').map(a=>a.id).sort());
    form().requestSubmit();
    assert(JSON.stringify(today().appointments.filter(a=>a.text!=='Эрготерапия').map(a=>a.id).sort())===others,'Partial generation changed other procedures');
    clearOverlap(today().appointments);
    // Renaming a procedure keeps its rules and its place in the plan.
    card('Спорт');set(document.querySelector('.inspector [data-field=name]'),'Спорт на улице');
    assert(proc('Спорт на улице').rules.gap===10,'Rules lost on rename');
    open();assert(!row('спорт на улице').querySelector('[data-pick]').checked&&row('эрготерапия').querySelector('[data-pick]').checked,'Plan lost on rename');
    document.querySelector('#modal [data-action=close-modal]').click();
  `);
  // A link is set on the procedure; without a shared instructor the report explains it.
  await step(`
    card('АФК · кушетка');
    const link=document.querySelector('.inspector [data-rule-link]');assert(link&&![...link.options].some(o=>o.textContent==='АФК · кушетка'),'Link choice');
    set(link,proc('АФК · тренажёр').id);
    assert(read().links.length===1&&document.querySelector('.inspector [data-rule-both]'),'Link saved');
    document.querySelector('.inspector [data-rule-both]').click();assert(read().links[0].simultaneous===true,'Both at once');
    card('АФК · тренажёр');assert(document.querySelector('.inspector [data-rule-link]').value===proc('АФК · кушетка').id,'The partner shows the same link');
    open();assert(row('афк · кушетка').querySelector('.af-rules span').textContent.includes('связка с «АФК · тренажёр»'),'Summary names the link');
    row('афк · тренажёр').querySelector('[data-pick]').click();form().requestSubmit();
    const modal=document.querySelector('#modal');
    assert(modal.open&&modal.textContent.includes('Итог автозаполнения')&&modal.textContent.includes('нет общего инструктора'),'Report must explain a link without a shared instructor');
    assert(document.querySelector('.af-report-hint')?.textContent.includes('у одного инструктора'),'Report must say what to change');
  `);
  await shot('autofill-report.png');
  await step(`
    document.querySelector('#modal [data-action=close-modal]').click();undo();
    card('АФК · кушетка');set(document.querySelector('.inspector [data-rule-link]'),'');assert(read().links.length===0,'Link removed');
    // Groups are saved without generating and then offered in the procedure.
    const before=JSON.stringify(today().appointments);
    open();form().querySelector('[data-af-add-group]').click();
    set(form().querySelector('[data-group-name]'),'Спорт');
    const id=form().querySelector('[data-group-name]').dataset.groupName,cells=[...form().querySelectorAll('[data-group-value="'+id+'"]')];
    assert(cells.length===10&&cells[0].type==='number','Every patient needs a number');
    const names=[...form().querySelectorAll('.af-matrix tbody td:first-child')].map(e=>e.textContent);assert(names.join()===[...names].sort((a,b)=>a.localeCompare(b,'ru')).join(),'Patients must be alphabetical');
    cells[0].value='1';cells[1].value='1';set(cells[2],'5');
    document.querySelector('#modal [data-af-save]').click();
    assert(!document.querySelector('#modal').open&&JSON.stringify(today().appointments)===before,'Save must not generate');
    assert(stored().groupList.length===2&&Object.values(stored().groupList[1].values).join()==='1,1,5','Groups saved');
    card('Спорт на улице');set(rule('together'),'groups');
    assert([...rule('groupId').options].map(o=>o.textContent).join()==='Общая,Спорт'&&rule('groupId').value==='common','Group choice');
    set(rule('groupId'),id);assert(proc('Спорт на улице').rules.groupId===id,'Group saved on the procedure');
    // Bad input blocks generation.
    open();set(form().querySelector('[name=slot]'),'0');form().requestSubmit();
    assert(document.querySelector('#modal').open&&document.querySelector('#modal-error').textContent.includes('слота'),'Invalid slot must block generation');
    document.querySelector('#modal [data-action=close-modal]').click();
    document.querySelector('[data-action=export]').click();const canvas=document.querySelector('#export-preview canvas');assert(canvas,'Generated day must export');
    const shownDay=today(),last=Math.max(...shownDay.appointments.map(a=>a.start+a.duration)),text=document.querySelector('#export-end').value;
    assert(text===String(Math.floor(last/60)).padStart(2,'0')+':'+String(last%60).padStart(2,'0'),'Export must end with the last procedure: '+text);
    document.querySelector('#modal [data-action=close-modal]').click();
  `);
  await step(`
    open();const buttons=[...document.querySelectorAll('#modal .af-help[popovertarget]')];
    for(const button of buttons){
      button.click();const popup=document.querySelector('.af-help-popup:popover-open');assert(popup&&popup.id===button.getAttribute('popovertarget'),'Hint did not open');
      const r=popup.getBoundingClientRect();assert(r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,'Hint leaves the window');
      assert(popup.querySelectorAll('li').length>=5,'Hint is too short');popup.hidePopover();
    }
    const body=document.querySelector('.autofill-body');body.scrollTop=body.scrollHeight;
  `);
  await shot('autofill-groups.png');
  await step(`document.querySelector('#modal [data-action=close-modal]').click();`);
  console.log('AUTOFILL_VERIFIED');
};
