module.exports=async({window})=>{
  await window.webContents.executeJavaScript(`(async()=>{
    const assert=(value,message)=>{if(!value)throw Error(message)},read=()=>JSON.parse(window.ritmDesktop.storage.load().data);
    document.querySelector('[data-field="start"]').dispatchEvent(new Event('change',{bubbles:true}));
    const originalDate=document.querySelector('#date-picker').value;
    document.querySelector('[data-action="new-day"]').click();let form=document.querySelector('#day-form');form.querySelector('[name=mode]').value='full';form.requestSubmit();
    const date=document.querySelector('#date-picker').value,initial=read(),id=initial.procedures[0].id;
    const choose=id=>{const e=document.querySelector('[data-procedure="'+id+'"]'),r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));};
    const set=(key,value)=>{const input=document.querySelector('[data-field="'+key+'"]');input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));};
    const matching=()=>read().days[date].appointments.filter(a=>a.procedureId===id);
    choose(id);let checkbox=document.querySelector('#apply-procedure-day');assert(checkbox&&!checkbox.checked,'Checkbox missing or enabled by default');
    set('name','Только заготовка');assert(JSON.stringify(read().days)===JSON.stringify(initial.days),'Unchecked edit changed appointments');
    checkbox=document.querySelector('#apply-procedure-day');checkbox.click();assert(JSON.stringify(read().days)===JSON.stringify(initial.days),'Checking alone modified appointments');
    set('name','Массаж рук');assert(matching().every(a=>a.text==='Массаж рук'),'Name was not propagated');
    set('color','#aabbcc');set('textColor','#123456');assert(matching().every(a=>a.color==='#aabbcc'&&a.textColor==='#123456'),'Colors were not propagated');
    assert(document.querySelector('#apply-procedure-day').checked,'Checkbox did not survive render');
    document.querySelector('.text-format').open=true;document.querySelector('.text-bold').click();
    assert(matching().every(a=>a.bold&&a.textStyles.text.bold),'Typography was not propagated');
    const beforeDuration=read();set('duration',45);assert(matching().every(a=>a.duration===45),'Duration was not propagated');
    assert(JSON.stringify(read().days[originalDate])===JSON.stringify(initial.days[originalDate]),'Another day was changed');
    for(const a of read().days[date].appointments){const old=initial.days[date].appointments.find(x=>x.id===a.id);assert(a.start===old.start&&a.patientId===old.patientId,'Start or patient changed');if(a.procedureId!==id)assert(JSON.stringify(a)===JSON.stringify(old),'Other procedure changed');}
    document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));
    assert(JSON.stringify(read().procedures)===JSON.stringify(beforeDuration.procedures)&&JSON.stringify(read().days)===JSON.stringify(beforeDuration.days),'Single undo did not restore template and appointments');
    choose(id);assert(!document.querySelector('#apply-procedure-day').checked,'Selection reset left propagation enabled');
    document.querySelector('#apply-procedure-day').click();choose(initial.procedures[1].id);assert(!document.querySelector('#apply-procedure-day').checked,'Switching template left propagation enabled');
    choose(id);document.querySelector('#apply-procedure-day').click();set('name','Массаж — текущий день');
    const inspector=document.querySelector('.inspector');assert(inspector.scrollWidth<=inspector.clientWidth,'Checkbox causes horizontal overflow');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  })()`);
  console.log('PROCEDURE_PROPAGATION_VERIFIED');
};
