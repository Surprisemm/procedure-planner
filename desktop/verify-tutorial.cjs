const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  fs.mkdirSync(out,{recursive:true});
  const run=code=>window.webContents.executeJavaScript(code);
  const settle=()=>run(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const before=await run(`window.ritmDesktop.storage.load().data`);
  await run(`document.querySelectorAll(':popover-open').forEach(e=>e.hidePopover());document.querySelector('[data-action="help"]').click();`);
  for(let i=0;i<6;i++){
    await run(`(async()=>{const assert=(v,m)=>{if(!v)throw Error(m)},page=document.querySelector('[data-help-page]'),img=page.querySelector('img');await img.decode();assert(img.naturalWidth>100,'Tutorial image missing');assert(Number(page.dataset.helpPage)===${i},'Wrong tutorial order');assert(document.querySelectorAll('.help-dot').length===6,'Missing navigation dots');assert(!/excel/i.test(page.textContent),'Outdated help content');assert(document.querySelector('.help-dot.active').dataset.page==='${i}','Wrong active step');const modal=document.querySelector('#modal'),r=modal.getBoundingClientRect();assert(r.top>=0&&r.bottom<=innerHeight&&modal.scrollWidth<=modal.clientWidth+1,'Tutorial overflows');})()`);
    await settle();
    const r=await run(`(()=>{const r=document.querySelector('#modal').getBoundingClientRect();return {x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)};})()`);
    fs.writeFileSync(path.join(out,`step-${i+1}.png`),(await window.webContents.capturePage(r)).toPNG());
    if(i<5)await run(`document.querySelector('.modal-footer [data-action="help-page"][data-page="${i+1}"]').click();`);
  }
  await run(`document.querySelector('.modal-footer [data-page="4"]').click();if(document.querySelector('[data-help-page]').dataset.helpPage!=='4')throw Error('Back failed');document.querySelector('.help-dot[data-page="0"]').click();if(!document.querySelector('.modal-footer [data-page="-1"]').disabled)throw Error('First page back enabled');document.querySelector('.help-dot[data-page="5"]').click();document.querySelector('.modal-footer [data-action="close-modal"]').click();if(document.querySelector('#modal').open)throw Error('Done did not close');document.querySelector('[data-action="help"]').click();if(document.querySelector('[data-help-page]').dataset.helpPage!=='0')throw Error('Reopen failed');document.querySelector('.modal-head [data-action="close-modal"]').click();`);
  if(await run(`window.ritmDesktop.storage.load().data`)!==before)throw Error('Tutorial changed schedule data');
  window.setSize(1000,680);await settle();
  await run(`document.querySelector('[data-action="help"]').click();document.querySelector('.help-dot[data-page="3"]').click();`);
  await settle();
  await run(`(()=>{const m=document.querySelector('#modal'),r=m.getBoundingClientRect();if(r.bottom>innerHeight||m.scrollHeight>m.clientHeight+1||m.scrollWidth>m.clientWidth+1)throw Error('Small-window tutorial overflows');})()`);
  fs.writeFileSync(path.join(out,'small-window.png'),(await window.webContents.capturePage()).toPNG());
  await run(`document.querySelector('.modal-head [data-action="close-modal"]').click();`);
  console.log('TUTORIAL_VERIFIED');
};
