module.exports=async({window})=>{
  await window.webContents.executeJavaScript(`(async()=>{
    const assert=(value,message)=>{if(!value)throw Error(message)},read=()=>JSON.parse(window.ritmDesktop.storage.load().data);
    document.querySelector('[data-field="start"]').dispatchEvent(new Event('change',{bubbles:true}));
    const original=read().procedures;
    function open(){document.querySelector('[data-action="add-procedure"]').click();const form=document.querySelector('#add-procedure-form');assert(form.querySelector('[name=duration]').value==='50','New procedure does not default to 50');return form;}
    let form=open();form.querySelector('[name=name]').value='Тест: 50 минут';form.requestSubmit();
    let procedure=read().procedures.at(-1);assert(procedure.name==='Тест: 50 минут'&&procedure.duration===50,'Default duration was not stored');
    assert(document.querySelector('[data-procedure="'+procedure.id+'"]').textContent.includes('50 мин'),'Library shows wrong duration');
    assert(document.querySelector('[data-field=duration]').value==='50','Inspector shows wrong duration');
    const card=document.querySelector('[data-procedure="'+procedure.id+'"]');card.scrollIntoView({inline:'nearest'});
    const rect=card.getBoundingClientRect(),sc=document.querySelector('.schedule-scroll').getBoundingClientRect(),lane=document.querySelector('#lanes').getBoundingClientRect();
    card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:rect.left+20,clientY:rect.top+20}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:lane.left+50,clientY:sc.top+176}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
    assert(read().days[document.querySelector('#date-picker').value].appointments.at(-1).duration===50,'Dragged procedure did not keep 50 minutes');
    form=open();form.querySelector('[name=name]').value='Тест: 45 минут';const duration=form.querySelector('[name=duration]'),count=read().procedures.length;
    for(const value of ['','0','481','12.5']){duration.value=value;form.requestSubmit();assert(document.querySelector('#modal').open&&read().procedures.length===count,'Invalid duration accepted');}
    duration.value='45';form.requestSubmit();assert(read().procedures.at(-1).duration===45,'Custom duration ignored');
    assert(JSON.stringify(read().procedures.slice(0,original.length))===JSON.stringify(original),'Existing library durations changed');
    open();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  })()`);
  console.log('NEW_PROCEDURE_DURATION_VERIFIED');
};
