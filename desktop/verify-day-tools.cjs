const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  const step=code=>window.webContents.executeJavaScript(`(async()=>{
    const assert=(v,m)=>{if(!v)throw Error(m)},read=()=>JSON.parse(window.ritmDesktop.storage.load().data),date=()=>document.querySelector('#date-picker').value;
    const zoom=v=>{const z=document.querySelector('#zoom');z.value=String(v);z.dispatchEvent(new Event('change',{bubbles:true}));};
    const undo=()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));
    const widths=()=>[...document.querySelectorAll('.column-header')].map(e=>e.getBoundingClientRect().width);
    ${code}
  })()`,true);
  const shot=async name=>{await window.webContents.executeJavaScript(`new Promise(r=>setTimeout(r,150))`);if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),(await window.webContents.capturePage()).toPNG());}};
  await step(`
    document.querySelector('[data-field="start"]').dispatchEvent(new Event('change',{bubbles:true}));
    assert([...document.querySelectorAll('#zoom option')].map(o=>o.value).join()==='0.5,0.75,1,1.25,1.5,2','Zoom options');
    const base=read().days[date()].columns.map(c=>c.width);
    const canvasWidth=()=>{document.querySelector('[data-action=export]').click();const c=document.querySelector('#export-preview canvas'),w=[c.width,c.height];document.querySelector('#modal [data-action=close-modal]').click();return w;};
    assert(document.querySelector('#zoom').value==='1','Default zoom');
    const png=canvasWidth();
    assert(widths().every((w,i)=>Math.abs(w-base[i])<1),'100% must use the column width');
    for(const z of [0.5,0.75,1.5,2,1]){
      zoom(z);
      for(const name of document.querySelectorAll('.column-header .name'))assert(name.scrollWidth<=name.clientWidth+1,'Patient name clipped at '+z+': '+name.textContent);
      assert(widths().every((w,i)=>Math.abs(w-base[i]*z)<1),'Header width at '+z+': '+widths()[0]);
      assert([...document.querySelectorAll('.patient-lane')].every((e,i)=>Math.abs(e.getBoundingClientRect().width-base[i]*z)<1),'Lane width at '+z);
      assert(JSON.stringify(canvasWidth())===JSON.stringify(png),'PNG must not depend on zoom');
      assert(JSON.stringify(read().days[date()].columns.map(c=>c.width))===JSON.stringify(base),'Zoom must not change saved widths');
    }
    zoom(0.5);
    document.querySelector('.column-header').click();
    assert(document.querySelector('[data-field=width]').value===String(base[0]),'Inspector shows the real width');
    document.querySelector('.workspace-heading').click();
    // A drop lands in the column under the pointer at this zoom.
    const lane=document.querySelectorAll('[data-lane]')[2],r=lane.getBoundingClientRect(),card=document.querySelector('.procedure-card'),c=card.getBoundingClientRect(),box=document.querySelector('.schedule-scroll').getBoundingClientRect(),x=r.left+r.width/2,y=box.top+200,before=read().days[date()].appointments.length;
    card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:c.left+20,clientY:c.top+20}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:c.left+60,clientY:c.top-60}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y}));
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y}));
    const after=read().days[date()].appointments;assert(after.length===before+1,'Drop failed at 50%');
    assert(after.at(-1).patientId===lane.dataset.lane,'Drop landed in the wrong column at 50%');
    undo();
  `);
  await shot('zoom-50.png');
  await step(`
    zoom(1);
    const toolbar=document.querySelector('.toolbar'),button=document.querySelector('.toolbar [data-action=clear-day]');
    assert(button&&button.textContent.includes('Очистить расписание'),'Clear button missing');
    assert(button.getBoundingClientRect().left-document.querySelector('#zoom').getBoundingClientRect().right<40,'Clear button must sit next to the zoom');
    const d=read().days[date()],count=d.appointments.length;assert(count>2,'Need appointments');
    const lockId=d.appointments[0].id,hidden=d.appointments.at(-1).patientId,bands=JSON.stringify(d.bands);
    document.querySelector('.appointment-lock[data-id="'+lockId+'"]').click();
    document.querySelector('[data-patient-toggle="'+hidden+'"]').click();
    const full=JSON.stringify(read().days[date()].appointments);
    document.querySelector('.toolbar [data-action=clear-day]').click();
    assert(!document.querySelector('#modal').open,'Clearing must not ask');
    const cleared=read().days[date()];assert(cleared.appointments.length===0,'Day was not cleared: '+cleared.appointments.length);
    assert(!document.querySelector('.appointment'),'Blocks still shown');
    assert(JSON.stringify(cleared.bands)===bands&&cleared.columns.length===d.columns.length&&(cleared.disabledPatientIds||[]).includes(hidden),'Only appointments must go');
    assert(read().procedures.length>0,'Library must stay');
    assert(document.querySelector('[data-field="scheduleName"]'),'Inspector must return to the day');
    undo();assert(JSON.stringify(read().days[date()].appointments)===full,'Undo must restore everything, locks included');
    undo();undo();
    document.querySelector('.workspace-heading').click();
  `);
  window.setSize(1000,680);
  await shot('small.png');
  await step(`
    const toolbar=document.querySelector('.toolbar'),shell=document.querySelector('.app-shell');
    assert(toolbar.scrollWidth<=toolbar.clientWidth+1,'Toolbar overflows at the minimum window');
    const tops=[...toolbar.children].filter(e=>e.getBoundingClientRect().width).map(e=>e.getBoundingClientRect().top+e.getBoundingClientRect().height/2);assert(Math.max(...tops)-Math.min(...tops)<6,'Toolbar must stay on one line');
    const r=document.querySelector('.toolbar [data-action=clear-day]').getBoundingClientRect();assert(r.right<=toolbar.getBoundingClientRect().right+1&&r.width>0,'Clear button clipped');
    zoom(0.5);
  `);
  await shot('small-50.png');
  window.setSize(1440,920);
  await step(`zoom(1);`);
  console.log('DAY_TOOLS_VERIFIED');
};
