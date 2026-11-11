// Rebuilds assets/tutorial from the demo project in an isolated profile. Everything
// shown is fictional: the demo patients and the instructors created here.
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,root})=>{
  const out=path.join(root,'assets','tutorial');fs.mkdirSync(out,{recursive:true});
  const run=code=>window.webContents.executeJavaScript(code).catch(error=>{console.error(code);throw error;});
  const settle=(ms=120)=>run(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,${ms}))))`);
  await run(`(async()=>{for(let i=0;i<100&&!document.querySelector('.app-shell');i++)await new Promise(r=>setTimeout(r,30));})()`);
  async function shot(name,selector,limit={}){
    await run(`document.querySelector('#toast').className='';document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'});`);
    await settle();
    const rect=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.ceil(r.width),height:Math.ceil(r.height)};})()`);
    Object.assign(rect,limit);
    fs.writeFileSync(path.join(out,name+'.png'),(await window.webContents.capturePage(rect)).toPNG());
  }
  const clearHighlight=`document.querySelectorAll('[data-tutorial-highlight]').forEach(e=>{e.style.outline='';delete e.dataset.tutorialHighlight;});`;
  async function highlight(selector){await run(`(()=>{${clearHighlight}const e=document.querySelector(${JSON.stringify(selector)});e.dataset.tutorialHighlight='';e.style.outline='2px solid #3478db';e.style.outlineOffset='2px';})()`);}
  await run(`
    window.__t={
      choose(e){const r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));},
      form(){return document.querySelector('#autofill-form');},
      row(key){return [...this.form().querySelectorAll('[data-row]')].find(e=>e.dataset.row===key);},
      change(e){e.dispatchEvent(new Event('change',{bubbles:true}));},
      state(){return JSON.parse(window.ritmDesktop.storage.load().data);},
      crew(index,names){
        this.choose(document.querySelectorAll('[data-procedure]')[index]);
        const people=this.state().instructors;
        names.forEach((name,i)=>{document.querySelector('[data-action=add-proc-instructor]').click();const select=document.querySelector('[data-proc-instructor="'+i+'"]');select.value=people.find(x=>x.name===name).id;this.change(select);});
      },
      work(key,name,field,value){const people=this.state().instructors,id=people.find(x=>x.name===name).id,el=[...this.row(key).querySelectorAll('[data-work]')].find(e=>e.dataset.work.endsWith(':'+id));if(field==='on'){if(el.querySelector('[data-work-on]').checked!==value)el.querySelector('[data-work-on]').click();}else{el.querySelector('[data-work-'+field+']').value=value;}}
    };0`);

  // Main tutorial.
  await highlight('[data-action="new-stay"]');await shot('schedule','.schedule-picker');
  await highlight('.side-title [data-action="add-patient"]');await shot('patients','.sidebar',{height:385});
  await run(`document.querySelector('[data-action="sidebar-tab"][data-tab="instructors"]').click();document.querySelector('[data-action="batch-instructors"]').click();const f=document.querySelector('#instructor-form');f.querySelector('textarea').value=['АФК-инструктор 1','АФК-инструктор 2','Массажист 1','Массажист 2','Физиотерапевт','Эрготерапевт'].join(String.fromCharCode(10));f.requestSubmit();document.querySelector('.workspace-heading').click();`);
  await highlight('.side-title [data-action="add-instructor"]');await shot('instructors','.sidebar',{height:385});
  await run(`${clearHighlight}document.querySelector('[data-action="sidebar-tab"][data-tab="patients"]').click();`);
  await highlight('[data-action="add-procedure"]');await shot('library','.library',{width:760});
  await run(`${clearHighlight}
    __t.crew(0,['Массажист 1','Массажист 2']);
    const color=document.querySelector('[data-proc-instructor-color="1"]');color.value='#bddcc2';__t.change(color);
    __t.crew(1,['Физиотерапевт']);__t.crew(2,['Эрготерапевт']);__t.crew(3,['АФК-инструктор 2']);__t.crew(4,['АФК-инструктор 1']);__t.crew(5,['АФК-инструктор 1']);
    __t.choose(document.querySelector('[data-procedure]'));`);
  await highlight('[data-action="add-proc-instructor"]');await shot('procedure','.inspector',{height:520});
  await run(`${clearHighlight}
    const cards=[...document.querySelectorAll('.procedure-card')],r=cards[0].getBoundingClientRect(),step=cards[1].getBoundingClientRect().left-r.left,y=r.bottom-6;
    cards[0].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+20,clientY:y}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+20+step*1.6,clientY:y}));`);
  await settle(320);
  await shot('library-drag','.library',{width:760});
  await run(`document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));document.querySelector('.workspace-heading').click();`);
  await settle(260);
  await run(`document.querySelector('[data-action="new-day"]').click();document.querySelector('#day-form [name=mode]').value='full';document.querySelector('#day-form').requestSubmit();`);
  await highlight('.day-tab.active');await shot('days','.day-tabs',{width:680,height:340});
  await run(`${clearHighlight}__t.choose(document.querySelector('[data-appointment]'));document.querySelector('.text-format').open=true;`);
  await shot('inspector','.inspector',{height:430});
  await run(`document.querySelector('.workspace-heading').click();`);

  // Autofill presentation.
  await highlight('[data-action="autofill"]');await shot('autofill-button','.workspace-heading');
  await run(`${clearHighlight}
    window.__t.card=name=>__t.choose([...document.querySelectorAll('.procedure-card')].find(e=>e.querySelector('strong').textContent===name));
    window.__t.rule=(key,value)=>{const el=document.querySelector('.inspector [data-rule="'+key+'"]');if(el.type==='checkbox')el.click();else{el.value=value;__t.change(el);}};
    window.__t.id=name=>__t.state().procedures.find(p=>p.name===name).id;
    __t.card('Спорт');__t.rule('grid');__t.rule('together','any');__t.rule('capacity','3');
    __t.card('АФК · кушетка');__t.rule('limit','2');
    const link=document.querySelector('.inspector [data-rule-link]');link.value=__t.id('АФК · тренажёр');__t.change(link);
    document.querySelector('.inspector [data-rule-both]').click();`);
  await shot('autofill-rules','#inspector-form .inspector-section:nth-child(2)');
  await run(`document.querySelector('.workspace-heading').click();document.querySelector('[data-action=autofill]').click();`);
  await settle();
  await shot('autofill-day','.af-card:nth-child(1)');
  await run(`__t.work('массаж','Массажист 1','to','14:00');__t.change(__t.row('массаж').querySelector('[data-work-to]'));`);
  await shot('autofill-procedures','.af-card:nth-child(2)');
  await run(`__t.form().querySelector('[data-af-view=instructors]').click();`);
  await shot('autofill-instructors','.af-card:nth-child(2)');
  await run(`
    __t.form().querySelector('[data-af-view=procedures]').click();
    __t.form().querySelector('[data-af-add-group]').click();
    const name=__t.form().querySelector('[data-group-name]');name.value='Спорт';__t.change(name);
    const id=__t.form().querySelector('[data-group-name]').dataset.groupName;window.__group=id;
    const cells=[...__t.form().querySelectorAll('[data-group-value="'+id+'"]')];[1,1,1,2,2,2,3,3,3,3].forEach((n,i)=>{cells[i].value=n;});__t.change(cells[0]);`);
  await shot('autofill-groups','.af-card:nth-child(3)');
  await run(`document.querySelector('#modal [data-af-save]').click();__t.card('Спорт');__t.rule('together','groups');__t.rule('groupId',window.__group);document.querySelector('.workspace-heading').click();
    document.querySelector('[data-action=autofill]').click();__t.form().requestSubmit();`);
  await settle(700);
  await shot('autofill-result','.schedule-frame');
  await run(`
    const blocks=[...document.querySelectorAll('.appointment-group')].filter(g=>g.querySelector('.appointment').textContent.includes('Массаж')).slice(0,3);
    for(const id of blocks.map(g=>g.querySelector('[data-appointment]').dataset.appointment))document.querySelector('.appointment-lock[data-id="'+id+'"]').click();
    document.querySelector('.workspace-heading').click();`);
  await settle(200);
  await shot('autofill-locks','.schedule-frame');
  await run(`document.querySelector('[data-action=autofill]').click();const all=__t.form().querySelector('[data-pick-all]');all.checked=false;__t.change(all);__t.row('эрготерапия').querySelector('[data-pick]').click();`);
  await settle();
  await shot('autofill-partial','#modal');
  await run(`
    {const all=__t.form().querySelector('[data-pick-all]');all.checked=true;__t.change(all);}
    __t.work('массаж','Массажист 2','on',false);__t.work('массаж','Массажист 1','to','11:00');
    __t.form().requestSubmit();`);
  await settle(700);
  await run(`if(!document.querySelector('#modal').textContent.includes('Итог автозаполнения'))throw Error('Report did not open');`);
  await shot('autofill-report','#modal');
  await run(`document.querySelector('#modal [data-action=close-modal]').click();document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));`);
  await settle();

  await run(`document.querySelector('[data-action="export"]').click();`);
  await shot('export','#modal');
  // The README example is the exported image itself.
  const image=await run(`document.querySelector('#export-preview canvas').toDataURL('image/png')`);
  fs.writeFileSync(path.join(root,'docs','images','schedule.png'),Buffer.from(image.split(',')[1],'base64'));
  console.log('TUTORIAL_SCREENSHOTS_OK',out);
};
