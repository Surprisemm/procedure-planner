// Real mouse and keyboard: text typed in an inspector field must survive a click
// anywhere else, and that click must still do what it was aimed at.
module.exports=async({window})=>{
  const pause=(ms=90)=>new Promise(r=>setTimeout(r,ms));
  const send=async(type,x,y,extra={})=>{window.webContents.sendInputEvent({type,x:Math.round(x),y:Math.round(y),...extra});await pause(40);};
  const click=async({x,y})=>{await send('mouseMove',x,y);await send('mouseDown',x,y,{button:'left',clickCount:1});await send('mouseUp',x,y,{button:'left',clickCount:1});await pause();};
  const run=code=>window.webContents.executeJavaScript(code);
  const center=sel=>run(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  const type=async text=>{for(const ch of text)window.webContents.sendInputEvent({type:'char',keyCode:ch});await pause();};
  const state=`JSON.parse(window.ritmDesktop.storage.load().data)`;
  const emptyLane=()=>run(`(()=>{const box=document.querySelector('.schedule-scroll').getBoundingClientRect(),h=document.querySelector('.time-axis').getBoundingClientRect();for(let y=box.bottom-30;y>box.top+90;y-=12)for(let x=box.left+h.width+30;x<box.right-30;x+=70){if(document.elementFromPoint(x,y)?.matches('[data-lane]'))return {x,y};}return null;})()`);
  await run(`document.querySelector('[data-field="start"]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-action="sidebar-tab"][data-tab="instructors"]').click();document.querySelector('[data-action="add-instructor"]').click();const f=document.querySelector('#instructor-form');f.querySelector('[name=name]').value='Инструктор';f.requestSubmit();document.querySelector('[data-action="sidebar-tab"][data-tab="patients"]').click();document.querySelector('.workspace-heading').click();`);
  const appointmentId=await run(`document.querySelector('[data-appointment]').dataset.appointment`);
  const otherId=await run(`document.querySelectorAll('[data-appointment]')[1].dataset.appointment`);
  const pickAppointment=`[data-appointment="${appointmentId}"]`,pickOther=`[data-appointment="${otherId}"]`;
  const date=await run(`document.querySelector('#date-picker').value`);
  const appointment=`${state}.days['${date}'].appointments.find(a=>a.id==='${appointmentId}')`;
  const fields=[
    {name:'Текст блока',open:pickAppointment,field:'text',value:n=>'Текст'+n,read:appointment+'.text'},
    {name:'Длительность назначения',open:pickAppointment,field:'duration',value:(n,i)=>String(30+5*i),read:appointment+'.duration',number:true},
    {name:'Название процедуры',open:'[data-procedure]',field:'name',value:n=>'Процедура'+n,read:`${state}.procedures[0].name`},
    {name:'Длительность процедуры',open:'[data-procedure]',field:'duration',value:(n,i)=>String(30+5*i),read:`${state}.procedures[0].duration`,number:true},
    {name:'ФИО пациента',open:'.column-header',field:'name',value:n=>'Пациент'+n,read:`${state}.patients[0].name`},
    {name:'Домик',open:'.column-header',field:'house',value:n=>'Д'+n,read:`${state}.patients[0].house`},
    {name:'Название периода',open:'.gutter-band',field:'name',value:n=>'Период'+n,read:`${state}.days['${date}'].bands[0].name`},
    {name:'Название расписания',open:null,field:'scheduleName',value:n=>'Расписание'+n,read:`${state}.stays[0].name`},
    {name:'ФИО инструктора',open:'instructor',field:'name',value:n=>'Инструктор'+n,read:`${state}.instructors[0].name`}
  ];
  const targets=[
    {name:'другая карточка',point:()=>center(pickOther),done:`document.querySelector('.appointment.selected')?.dataset.appointment==='${otherId}'`},
    {name:'пустая колонка',point:emptyLane,done:`!!document.querySelector('[data-field="scheduleName"]')`},
    {name:'карточка библиотеки',point:()=>center('.procedure-card:nth-child(2)'),done:`document.querySelector('.procedure-card:nth-child(2)').classList.contains('selected')`},
    {name:'кнопка в шапке',point:()=>center('[data-action="help"]'),done:`document.querySelector('#modal').open`,after:`document.querySelector('#modal').close();`},
    {name:'пустое место страницы',point:()=>center('.workspace-subtitle'),done:`true`}
  ];
  const failures=[];let serial=0;
  const open=async spec=>{
    await run(`document.querySelector('#modal').close();document.querySelector('.workspace-heading').click();`);await pause(40);
    if(spec.open==='instructor'){
      await run(`document.querySelector('[data-action="sidebar-tab"][data-tab="instructors"]').click();`);
      await click(await center('.instructor-list .patient-item .patient-name'));
    }else if(spec.open){
      // An injected click can be dropped while the window settles; retry it, a real miss fails below.
      for(let attempt=0;attempt<3&&!(await run(`!!document.querySelector('.inspector [data-field="${spec.field}"]')`));attempt++){await click(await center(spec.open));await pause(120);}
    }
    else await run(`document.querySelector('[data-action="day-settings"]').click();`);
    await pause(40);
  };
  const edit=async(spec,i)=>{
    serial++;const value=spec.value(serial,(serial%10)+1);
    const point=await center(`.inspector [data-field="${spec.field}"]`);
    if(!point)throw Error('Нет поля '+spec.name+' serial='+serial+' '+JSON.stringify(await run(`({active:document.activeElement?.tagName+':'+(document.activeElement?.id||document.activeElement?.className),head:document.querySelector('.inspector-header span')?.textContent,selected:document.querySelector('.procedure-card.selected')?.dataset.procedure,modal:document.querySelector('#modal').open,hover:document.querySelector('[data-procedure]')?.dataset.procedure})`)));
    await click(point);
    await run(`(()=>{const e=document.querySelector('.inspector [data-field="${spec.field}"]');e.focus();e.select();})()`);
    await type(value);
    return value;
  };
  for(const spec of fields){
    for(const target of targets){
      await open(spec);
      const value=await edit(spec);
      const point=await target.point();
      if(!point){failures.push(`${spec.name} → ${target.name}: цель не найдена`);continue;}
      await click(point);await pause(60);
      const saved=await run(`String(${spec.read})`);
      if(saved!==value)failures.push(`${spec.name} → ${target.name}: ввели ${value}, сохранилось ${saved}`);
      if(!(await run(target.done)))failures.push(`${spec.name} → ${target.name}: клик не сработал`);
      if(target.after)await run(target.after);
      if(spec.open==='instructor')await run(`document.querySelector('[data-action="sidebar-tab"][data-tab="patients"]').click();`);
    }
  }
  // Moving to the next field keeps typing there, and an open colour popup stays open.
  await open(fields[2]);
  const first=await edit(fields[2]);
  await click(await center('.inspector [data-field="duration"]'));
  if(!(await run(`document.activeElement?.dataset?.field==='duration'`)))failures.push('Переход к следующему полю теряет фокус');
  if(await run(`String(${fields[2].read})`)!==first)failures.push('Переход к следующему полю теряет текст');
  await open(fields[2]);await edit(fields[2]);
  await click(await center('.inspector .color-trigger'));await pause(120);
  if(!(await run(`!!document.querySelector('.inspector .color-popup:popover-open')`)))failures.push('Цвет не открывается сразу после ввода текста');
  await run(`document.querySelector('.color-popup:popover-open')?.hidePopover();`);await pause(60);
  if(!(await run(`document.querySelector('.procedure-card').textContent.includes('Процедура')`)))failures.push('Библиотека не обновилась после закрытия цвета');
  // Tab saves and moves on to the next field.
  await open(fields[2]);const tabbed=await edit(fields[2]);
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});await pause(150);
  if(await run(`String(${fields[2].read})`)!==tabbed)failures.push('Tab теряет текст');
  if(await run(`document.activeElement===document.body`))failures.push('Tab теряет фокус');
  const whileTabbing=await run(`document.activeElement?.tagName+':'+document.activeElement?.textContent?.slice(0,20)`);
  await click(await center('.workspace-subtitle'));await pause(120);
  if(!(await run(`document.querySelector('.procedure-card').textContent.includes(${JSON.stringify(tabbed)})`)))failures.push('Библиотека не обновилась после Tab и клика, фокус был на '+whileTabbing);
  // Enter saves; drag right after typing starts from the right place.
  await open(fields[0]);const entered=await edit(fields[0]);
  await run(`0`);window.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});window.webContents.sendInputEvent({type:'char',keyCode:'\r'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});await pause();
  if(await run(`String(${fields[0].read})`)!==entered)failures.push('Enter не сохраняет текст');
  await open(fields[0]);const dragged=await edit(fields[0]);
  const startOf=()=>run(`${state}.days['${date}'].appointments.find(a=>a.id==='${otherId}').start`);
  const dragDown=async()=>{const from=await center(pickOther);await send('mouseMove',from.x,from.y);await send('mouseDown',from.x,from.y,{button:'left',clickCount:1});await send('mouseMove',from.x,from.y+30);await send('mouseMove',from.x,from.y+60);await send('mouseUp',from.x,from.y+60,{button:'left',clickCount:1});await pause(80);};
  const before=await startOf();await dragDown();
  const after=await startOf();
  if(await run(`String(${fields[0].read})`)!==dragged)failures.push('Перетаскивание сразу после ввода теряет текст');
  await run(`document.querySelector('.workspace-heading').click();`);await pause(40);
  const plainBefore=await startOf();await dragDown();const plain=await startOf()-plainBefore;
  if(after-before!==plain)failures.push(`Перетаскивание после ввода: ${after-before} мин, без ввода: ${plain} мин`);
  console.log('DRAG delta',after-before,plain);
  if(failures.length)throw Error('Ошибки инспектора:\n'+failures.join('\n'));
  console.log('INSPECTOR_COMMIT_VERIFIED',fields.length*targets.length);
};
