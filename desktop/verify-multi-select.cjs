module.exports=async({window})=>{
  const out=await window.webContents.executeJavaScript(`(async()=>{try{
    const assert=(value,message)=>{if(!value)throw Error(message)};
    const read=()=>JSON.parse(window.ritmDesktop.storage.load().data);
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const date=document.querySelector('#date-picker').value;
    const appts=()=>read().days[date].appointments;
    const undo=()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));
    const place=(index,start)=>{const card=document.querySelectorAll('[data-procedure]')[index],r=card.getBoundingClientRect();card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));document.querySelector('[data-action="place-procedure"]').click();const form=document.querySelector('#place-form');form.querySelector('[name="start"]').value=start;form.requestSubmit();};
    const press=(id,mods={})=>{const el=document.querySelector('[data-appointment="'+id+'"]'),r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+20,clientY:r.top+12,...mods}));if(!mods.ctrlKey&&!mods.shiftKey)document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));};
    const header=()=>document.querySelector('.inspector-header span')?.textContent;
    const change=(key,value)=>{const el=document.querySelector('.inspector [data-field="'+key+'"]');assert(el,'No field '+key);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
    if(appts().length<3){place(0,'09:00');place(0,'10:00');place(1,'11:00');}
    const list=appts(),[a,b,c]=list;
    assert(list.length>=3,'Need three blocks');
    // Ctrl+click builds the selection; the inspector switches to the multi form.
    press(a.id);press(b.id,{ctrlKey:true});await frame();
    assert(header()==='Выбрано: 2','Multi inspector header: '+header());
    assert(document.querySelectorAll('.appointment.selected').length===2,'Two blocks must look selected');
    assert(!document.querySelector('.inspector [data-field="patientId"]'),'Patient must not be editable for several blocks');
    press(c.id,{shiftKey:true});await frame();
    assert(header()==='Выбрано: 3','Shift+click did not add a block');
    press(c.id,{ctrlKey:true});await frame();
    assert(header()==='Выбрано: 2','Ctrl+click did not remove a block');
    // Every field edits all selected blocks.
    change('color','#112233');change('textColor','#445566');change('text','Общий');change('duration','30');change('status','cancelled');change('locked',true);
    let now=appts().filter(x=>x.id===a.id||x.id===b.id);
    assert(now.every(x=>x.color==='#112233'&&x.textColor==='#445566'&&x.text==='Общий'&&x.duration===30&&x.status==='cancelled'&&x.locked===true),'Multi edit missed a block or field');
    assert(appts().find(x=>x.id===c.id).color===c.color,'Unselected block changed');
    change('start','12:00');now=appts().filter(x=>x.id===a.id||x.id===b.id);
    assert(now.every(x=>x.start===720),'Multi start failed');
    change('end','13:00');now=appts().filter(x=>x.id===a.id||x.id===b.id);
    assert(now.every(x=>x.duration===60),'Multi end failed');
    const workers=[...document.querySelectorAll('.inspector [data-field="instructorId"] option')].map(o=>o.value).filter(v=>v&&v!=='__mixed');
    if(workers.length){change('instructorId',workers[0]);assert(appts().filter(x=>x.id===a.id||x.id===b.id).every(x=>x.instructorId===workers[0]),'Multi instructor failed');}
    // One undo reverts one inspector edit for all blocks.
    undo();await frame();
    // Group move: press a selected block and drag: both blocks keep their distance.
    press(a.id);press(b.id,{ctrlKey:true});await frame();
    const before=appts().filter(x=>x.id===a.id||x.id===b.id).map(x=>({id:x.id,start:x.start,patientId:x.patientId}));
    const el=document.querySelector('[data-appointment="'+a.id+'"]'),r=el.getBoundingClientRect(),scale=(r.height+2)/appts().find(x=>x.id===a.id).duration;
    el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+20,clientY:r.top+10}));
    const dy=Math.round(30*scale);
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+20,clientY:r.top+10+Math.round(dy/2)}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+20,clientY:r.top+10+dy}));
    await frame();
    assert(document.querySelector('#drag-ghosts .drag-ghost'),'Group drag shows no ghost of the other block');
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));await frame();
    const after=appts().filter(x=>x.id===a.id||x.id===b.id);
    const deltas=after.map(x=>x.start-before.find(y=>y.id===x.id).start);
    assert(deltas[0]!==0&&deltas[0]===deltas[1],'Group move must shift every block by the same time: '+deltas);
    assert(after.every(x=>x.patientId===before.find(y=>y.id===x.id).patientId),'Group move changed columns');
    assert(header()==='Выбрано: 2','Selection lost after group move');
    assert(!document.querySelector('#drag-ghosts'),'Ghosts left after drop');
    // A click on a selected block without moving collapses to that block.
    press(a.id);await frame();
    assert(header()!=='Выбрано: 2'&&document.querySelectorAll('.appointment.selected').length===1,'Plain click must select one block');
    // Context menu acts on the whole selection.
    press(a.id);press(b.id,{ctrlKey:true});await frame();
    const target=document.querySelector('[data-appointment="'+b.id+'"]'),tr=target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:tr.left+20,clientY:tr.top+10}));
    const menu=document.querySelector('.appt-menu');assert(menu,'No menu');
    const items=[...menu.querySelectorAll('button')];
    assert(/\\(2\\)/.test(items[0].textContent)&&/Удалить выбранные \\(2\\)/.test(items.find(i=>/Удалить выбранные/.test(i.textContent)).textContent),'Menu does not name the selection: '+items.map(i=>i.textContent));
    const total=appts().length;items.find(i=>/Удалить выбранные/.test(i.textContent)).click();await frame();
    assert(appts().length===total-2&&!appts().some(x=>x.id===a.id||x.id===b.id),'Delete selected removed wrong blocks');
    undo();await frame();assert(appts().length===total,'One undo must restore both blocks');
    // Inspector button deletes the selection too, Delete key as well.
    press(a.id);press(b.id,{ctrlKey:true});await frame();
    document.querySelector('.inspector [data-action="delete-selection"]').click();await frame();
    assert(appts().length===total-2,'Inspector delete failed');
    undo();await frame();
    // Group duplicate: copies follow the originals and become the selection; one undo removes them.
    press(a.id);press(b.id,{ctrlKey:true});await frame();
    const n=appts().length;
    document.querySelector('.inspector [data-action="duplicate"]').click();await frame();
    assert(appts().length===n+2,'Group duplicate failed');
    assert(header()==='Выбрано: 2'&&!document.querySelector('.appointment.selected[data-appointment="'+a.id+'"]'),'Copies must be selected after duplicate');
    undo();await frame();assert(appts().length===n,'One undo must remove both copies');
    // The context menu offers duplicate and move-to-day for the group.
    press(a.id);press(b.id,{ctrlKey:true});await frame();
    const t2=document.querySelector('[data-appointment="'+a.id+'"]'),r2=t2.getBoundingClientRect();
    t2.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r2.left+20,clientY:r2.top+10}));
    const labels=[...document.querySelectorAll('.appt-menu button')].map(x=>x.textContent);
    assert(labels.some(x=>/^Дублировать [(]2[)]/.test(x))&&labels.some(x=>/^В другой день… [(]2[)]/.test(x)),'Group menu lacks duplicate/move: '+labels);
    [...document.querySelectorAll('.appt-menu button')].find(x=>/^Дублировать/.test(x.textContent)).click();await frame();
    assert(appts().length===n+2,'Menu duplicate failed');undo();await frame();
    // Group copy to another day through the form.
    press(a.id);press(b.id,{ctrlKey:true});await frame();
    document.querySelector('.inspector [data-action="transfer-appointment"]').click();
    const tf=document.querySelector('#transfer-form');assert(tf,'No transfer form for group');
    const dest=tf.querySelector('[name="date"]').value;
    tf.requestSubmit();await frame();
    assert(document.querySelector('#date-picker').value===dest&&read().days[dest].appointments.length>=2,'Group transfer failed');
    assert(read().days[date].appointments.length===n,'Copy mode must keep the source day');
    undo();await frame();
    const picker=document.querySelector('#date-picker');picker.value=date;picker.dispatchEvent(new Event('change',{bubbles:true}));await frame();
    assert(appts().length===n,'Source day changed by transfer');
    // Library card menu: select every block of the type, duplicate the card.
    const card=[...document.querySelectorAll('[data-procedure]')].find(c=>c.dataset.procedure===a.procedureId),cr=card.getBoundingClientRect();
    card.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:cr.left+10,clientY:cr.top+10}));
    let items2=[...document.querySelectorAll('.appt-menu button')];
    assert(items2.length===3&&/^Выделить все в дне [(][0-9]+[)]/.test(items2[0].textContent)&&/Дублировать/.test(items2[1].textContent)&&/Удалить из библиотеки/.test(items2[2].textContent),'Library menu wrong: '+items2.map(x=>x.textContent));
    const same=appts().filter(x=>x.procedureId===a.procedureId).length;
    items2[0].click();await frame();
    assert(document.querySelectorAll('.appointment.selected').length===same,'Select all of type selected '+document.querySelectorAll('.appointment.selected').length+' not '+same);
    if(same>1)assert(header()==='Выбрано: '+same,'Multi inspector expected after select all of type');
    const procs=read().procedures.length;
    const card2=[...document.querySelectorAll('[data-procedure]')].find(c=>c.dataset.procedure===a.procedureId),cr2=card2.getBoundingClientRect();
    card2.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:cr2.left+10,clientY:cr2.top+10}));
    [...document.querySelectorAll('.appt-menu button')][1].click();await frame();
    assert(read().procedures.length===procs+1,'Library menu duplicate failed');
    undo();await frame();assert(read().procedures.length===procs,'Undo of card duplicate failed');
    press(a.id);press(b.id,{ctrlKey:true});await frame();
  }catch(e){return "ERR "+e.message;}})()`);if(typeof out==="string"&&out.startsWith("ERR"))throw Error(out);
  console.log('MULTI_SELECT_VERIFIED');
};
