const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,root})=>{
  const out=path.join(root,'assets','tutorial');fs.mkdirSync(out,{recursive:true});
  const run=code=>window.webContents.executeJavaScript(code).catch(error=>{console.error(code);throw error;});
  const settle=()=>run(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,100))))`);
  await run(`(async()=>{for(let i=0;i<100&&!document.querySelector('.app-shell');i++)await new Promise(r=>setTimeout(r,30));})()`);
  async function shot(name,selector,limit={}){
    await settle();
    const rect=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.ceil(r.width),height:Math.ceil(r.height)};})()`);
    Object.assign(rect,limit);
    fs.writeFileSync(path.join(out,name+'.png'),(await window.webContents.capturePage(rect)).toPNG());
  }
  async function highlight(selector){await run(`(()=>{document.querySelectorAll('[data-tutorial-highlight]').forEach(e=>{e.style.outline='';delete e.dataset.tutorialHighlight;});const e=document.querySelector(${JSON.stringify(selector)});e.dataset.tutorialHighlight='';e.style.outline='2px solid #3478db';e.style.outlineOffset='2px';})()`);}
  await highlight('[data-action="new-stay"]');await shot('schedule','.schedule-picker');
  await highlight('.side-title [data-action="add-patient"]');await shot('patients','.sidebar',{height:385});
  await highlight('[data-action="add-procedure"]');await shot('library','.library',{width:760});
  await run(`document.querySelector('[data-action="new-day"]').click();document.querySelector('#day-form [name=mode]').value='full';document.querySelector('#day-form').requestSubmit();`);
  await highlight('.day-tab.active');await shot('days','.day-tabs',{width:680,height:340});
  await run(`(()=>{const e=document.querySelector('[data-appointment]')||document.querySelector('[data-procedure]'),r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));document.querySelector('.text-format').open=true;})()`);
  await shot('inspector','.inspector',{height:430});
  await run(`document.querySelector('[data-action="export"]').click();document.querySelector('#export-end').value='12:00';document.querySelector('#export-end').dispatchEvent(new Event('change',{bubbles:true}));`);
  await shot('export','#modal');
  console.log('TUTORIAL_SCREENSHOTS_OK',out);
};
