module.exports=async({window})=>{
  await window.webContents.executeJavaScript(`(async()=>{
    const assert=(value,message)=>{if(!value)throw Error(message)};
    const chooseProcedure=()=>{const e=document.querySelector('[data-procedure]'),r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));};
    function checkProcedure(){const sections=document.querySelectorAll('.inspector-section'),section=sections[0],duration=section.querySelector('[data-field=duration]'),checkbox=section.querySelector('#apply-procedure-day');assert(sections.length===2&&section.querySelector('.section-title').textContent==='Процедура'&&sections[1].querySelector('.section-title').textContent==='Автозаполнение','Procedure inspector sections');assert(duration&&checkbox&&!!(duration.compareDocumentPosition(checkbox)&Node.DOCUMENT_POSITION_FOLLOWING),'Checkbox is not after duration');assert(section.lastElementChild.contains(checkbox),'Checkbox is not last');assert(document.querySelectorAll('.inspector-actions button').length===2,'Wrong actions under procedure');}
    chooseProcedure();checkProcedure();
    document.querySelector('.patient-select').click();
    const appearance=selector=>{const e=document.querySelector(selector),s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.fontStyle,s.color,s.backgroundColor].join('|');};
    const beforeName=appearance('.patient-name'),beforeHouse=appearance('.patient-house'),beforeRow=appearance('.patient-item.selected');
    const format=key=>document.querySelector('[data-field="'+key+'"]').closest('.text-field').querySelector('.text-format');
    const edit=(key,selector,value)=>{format(key).open=true;const e=format(key).querySelector(selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));};
    edit('name','select','Times New Roman');edit('name','input[type=number]','22');format('name').querySelector('.text-bold').click();format('name').querySelector('.text-italic').click();
    edit('house','select','Georgia');edit('house','input[type=number]','20');format('house').querySelector('.text-italic').click();
    for(const [key,value] of [['headerColor','#123456'],['color','#abcdef']]){const e=document.querySelector('[data-field="'+key+'"]');e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}
    assert(appearance('.patient-name')===beforeName&&appearance('.patient-house')===beforeHouse&&appearance('.patient-item.selected')===beforeRow,'Column appearance leaked to sidebar');
    assert(!document.querySelector('.patient-name').getAttribute('style')&&!document.querySelector('.patient-house').getAttribute('style'),'Sidebar still uses custom inline typography');
    const name=getComputedStyle(document.querySelector('.column-header.selected .name')),house=getComputedStyle(document.querySelector('.column-header.selected .house'));
    assert(name.fontFamily.includes('Times New Roman')&&name.fontStyle==='italic'&&Number(name.fontWeight)>=600,'Table name typography did not update');assert(house.fontFamily.includes('Georgia')&&house.fontStyle==='italic','Table house typography did not update');
    assert(getComputedStyle(document.querySelector('.column-header.selected')).backgroundColor==='rgb(18, 52, 86)','Table header background did not update');
    document.querySelector('#patient-search').value='Анна';document.querySelector('#patient-search').dispatchEvent(new Event('input',{bubbles:true}));assert(appearance('.patient-name')===beforeName,'Search redraw restored sidebar styles');
    document.querySelector('#patient-search').value='';document.querySelector('#patient-search').dispatchEvent(new Event('input',{bubbles:true}));
    chooseProcedure();checkProcedure();document.querySelector('.text-format').open=true;document.querySelector('.text-bold').click();assert(Number(getComputedStyle(document.querySelector('.procedure-card.selected strong')).fontWeight)>=600,'Template typography no longer affects library');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  })()`);
  console.log('INSPECTOR_LAYOUT_AND_SIDEBAR_VERIFIED');
};
