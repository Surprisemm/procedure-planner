const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  fs.mkdirSync(out,{recursive:true});
  const run=code=>window.webContents.executeJavaScript(code);
  const settle=()=>run(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const box=()=>run(`(()=>{const r=document.querySelector('#modal').getBoundingClientRect();return {x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)};})()`);
  async function walk(prefix){
    const count=await run(`document.querySelectorAll('.help-dot').length`);
    for(let i=0;i<count;i++){
      await run(`(async()=>{const assert=(v,m)=>{if(!v)throw Error(m)},page=document.querySelector('[data-help-page]'),img=page.querySelector('img');await img.decode();assert(img.naturalWidth>100,'Tutorial image missing: '+img.src);assert(Number(page.dataset.helpPage)===${i},'Wrong tutorial order');assert(!/excel/i.test(page.textContent),'Outdated help content');assert(document.querySelector('.help-dot.active').dataset.page==='${i}','Wrong active step');const modal=document.querySelector('#modal'),r=modal.getBoundingClientRect();assert(r.top>=0&&r.bottom<=innerHeight&&modal.scrollWidth<=modal.clientWidth+1,'Tutorial overflows');const text=page.querySelector('.tutorial-copy');assert(text.textContent.length>40,'Step needs an explanation');})()`);
      await settle();
      fs.writeFileSync(path.join(out,`${prefix}-${i+1}.png`),(await window.webContents.capturePage(await box())).toPNG());
      if(i<count-1)await run(`document.querySelector('.modal-footer [data-action="help-page"][data-page="${i+1}"]').click();`);
    }
    return count;
  }
  const before=await run(`window.ritmDesktop.storage.load().data`);
  await run(`document.querySelectorAll(':popover-open').forEach(e=>e.hidePopover());document.querySelector('[data-action="help"]').click();`);
  const main=await walk('step');
  if(main!==10)throw Error('Main tutorial pages: '+main);
  const last=main-1;
  await run(`document.querySelector('.modal-footer [data-page="${last-1}"]').click();if(document.querySelector('[data-help-page]').dataset.helpPage!=='${last-1}')throw Error('Back failed');document.querySelector('.help-dot[data-page="0"]').click();if(!document.querySelector('.modal-footer [data-page="-1"]').disabled)throw Error('First page back enabled');document.querySelector('.help-dot[data-page="${last}"]').click();document.querySelector('.modal-footer [data-action="close-modal"]').click();if(document.querySelector('#modal').open)throw Error('Done did not close');document.querySelector('[data-action="help"]').click();if(document.querySelector('[data-help-page]').dataset.helpPage!=='0')throw Error('Reopen failed');document.querySelector('.modal-head [data-action="close-modal"]').click();`);
  if(await run(`window.ritmDesktop.storage.load().data`)!==before)throw Error('Tutorial changed schedule data');
  // Autofill presentation: leaves the dialog with unsaved settings intact.
  await run(`document.querySelector('[data-action=autofill]').click();const first=document.querySelector('[data-row] [data-pick]');first.click();if(first.checked)throw Error('Setup failed');const hints=document.querySelectorAll('#modal .af-help[popovertarget]');if(hints.length!==3)throw Error('Blocks keep their text hints: '+hints.length);document.querySelector('[data-af-tutorial]').click();if(!document.querySelector('[data-help-page]'))throw Error('Presentation did not open');`);
  const deck=await walk('autofill');
  if(deck!==10)throw Error('Autofill pages: '+deck);
  await run(`document.querySelector('.modal-footer [data-action="help-done"]').click();const form=document.querySelector('#autofill-form');if(!form)throw Error('Finish must return to settings');if(form.querySelector('[data-row] [data-pick]').checked)throw Error('Unsaved settings lost');
    document.querySelector('[data-af-tutorial]').click();document.querySelector('.modal-head [data-action="help-done"]').click();if(!document.querySelector('#autofill-form'))throw Error('Close must return to settings');
    document.querySelector('[data-af-tutorial]').click();document.querySelector('#modal').dispatchEvent(new Event('cancel',{cancelable:true}));if(!document.querySelector('#autofill-form')||!document.querySelector('#modal').open)throw Error('Esc must return to settings');
    document.querySelector('#modal [data-action=close-modal]').click();document.querySelector('[data-action="help"]').click();if(document.querySelector('.tutorial-long')||document.querySelector('[data-help-page] img').getAttribute('src').includes('autofill'))throw Error('Main help must reopen as the main deck');document.querySelector('.modal-head [data-action="close-modal"]').click();`);
  window.setSize(1000,680);await settle();
  await run(`document.querySelector('[data-action="help"]').click();document.querySelector('.help-dot[data-page="3"]').click();`);
  await settle();
  await run(`(()=>{const m=document.querySelector('#modal'),r=m.getBoundingClientRect();if(r.bottom>innerHeight||m.scrollHeight>m.clientHeight+1||m.scrollWidth>m.clientWidth+1)throw Error('Small-window tutorial overflows');})()`);
  fs.writeFileSync(path.join(out,'small-window.png'),(await window.webContents.capturePage()).toPNG());
  await run(`document.querySelector('.modal-head [data-action="close-modal"]').click();document.querySelector('[data-action=autofill]').click();document.querySelector('[data-af-tutorial]').click();document.querySelector('.help-dot[data-page="3"]').click();`);
  await settle();
  await run(`(()=>{const m=document.querySelector('#modal'),r=m.getBoundingClientRect(),body=document.querySelector('.tutorial-body');if(r.bottom>innerHeight||m.scrollWidth>m.clientWidth+1)throw Error('Small-window autofill presentation overflows');body.scrollTop=body.scrollHeight;const list=body.querySelector('li:last-child').getBoundingClientRect(),view=body.getBoundingClientRect();if(list.bottom>view.bottom+1)throw Error('Text cannot be reached by scrolling');})()`);
  fs.writeFileSync(path.join(out,'small-window-autofill.png'),(await window.webContents.capturePage()).toPNG());
  await run(`document.querySelector('.modal-head [data-action="help-done"]').click();document.querySelector('#modal [data-action=close-modal]').click();`);
  console.log('TUTORIAL_VERIFIED');
};
