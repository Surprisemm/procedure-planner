module.exports=async({window})=>{
  const run=code=>window.webContents.executeJavaScript(code);
  const settle=()=>run(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  async function click(selector,corner=false){
    const point=await run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:Math.round(r.left+${corner?'3':'r.width/2'}),y:Math.round(r.top+${corner?'3':'r.height/2'})};})()`);
    window.webContents.sendInputEvent({type:'mouseMove',...point});
    window.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});
    window.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});
    await settle();
  }
  await run(`document.querySelector('[data-action="sidebar-tab"][data-tab="instructors"]').click();document.querySelector('[data-action="batch-instructors"]').click();const f=document.querySelector('#instructor-form');f.querySelector('textarea').value=Array.from({length:10},(_,i)=>'Тестовый инструктор '+(i+1)).join(String.fromCharCode(10));f.requestSubmit();`);
  const ids=await run(`JSON.parse(window.ritmDesktop.storage.load().data).instructors.map(i=>i.id)`);
  for(let round=0;round<2;round++)for(let i=0;i<ids.length;i++){
    await click(`.instructor-list .patient-item:has([data-action="select-instructor"][data-id="${ids[i]}"])`,true);
    const selected=await run(`document.querySelector('.instructor-list .patient-item.selected [data-action="select-instructor"]')?.dataset.id`);
    if(selected!==ids[i])throw Error(`Instructor row padding click missed ${round}/${i}`);
  }
  await click(`[data-action="select-instructor"][data-id="${ids[0]}"]`);
  await click('.inspector [data-field="name"]');
  await run(`document.querySelector('.inspector [data-field="name"]').select();`);
  await window.webContents.insertText('ФИО после редактирования');
  await click(`[data-action="select-instructor"][data-id="${ids[1]}"]`);
  const result=await run(`({selected:document.querySelector('.instructor-list .patient-item.selected [data-action="select-instructor"]')?.dataset.id,saved:JSON.parse(window.ritmDesktop.storage.load().data).instructors.find(i=>i.id===${JSON.stringify(ids[0])}).name})`);
  if(result.selected!==ids[1]||result.saved!=='ФИО после редактирования')throw Error('Rename blur swallowed instructor selection or lost edit: '+JSON.stringify(result));
  await click(`[data-action="remove-instructor"][data-id="${ids[0]}"]`);
  const afterTrash=await run(`document.querySelector('.instructor-list .patient-item.selected [data-action="select-instructor"]')?.dataset.id`);
  if(afterTrash!==ids[1])throw Error('Trash click unexpectedly selected instructor');
  await run(`document.querySelector('#modal .modal-footer [data-action="close-modal"]').click();`);
  console.log('INSTRUCTOR_SELECTION_VERIFIED');
};
