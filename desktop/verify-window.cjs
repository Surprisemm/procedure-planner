const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  const run=code=>window.webContents.executeJavaScript(code);
  const wait=()=>new Promise(r=>setTimeout(r,90));
  const assert=(v,m)=>{if(!v)throw Error(m);};
  fs.mkdirSync(out,{recursive:true});
  for(const width of [1000,1200,1440,1800]){
    window.setSize(width,820);await wait();
    for(const type of ['day','patient','procedure','appointment','band']){
      await run(`(()=>{document.querySelectorAll(':popover-open').forEach(e=>e.hidePopover());const s={day:'.workspace-heading',patient:'.patient-select',procedure:'[data-procedure]',appointment:'[data-appointment]',band:'.gutter-band'}[${JSON.stringify(type)}],e=document.querySelector(s);if(${JSON.stringify(type)}==='procedure'||${JSON.stringify(type)}==='appointment'){const r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));}else e.click();document.querySelectorAll('.inspector details').forEach(e=>e.open=true);})()`);
      await wait();
      const overflow=await run(`(()=>{const e=document.querySelector('.inspector'),inner=e.querySelector('.inspector-inner'),r=inner.getBoundingClientRect();return {width:e.clientWidth,scroll:e.scrollWidth,inner:inner.scrollWidth,content:inner.clientWidth,leaks:[...inner.querySelectorAll('input,select,textarea,button')].filter(e=>{const q=e.getBoundingClientRect();return q.width&&q.right>r.right+1}).map(e=>e.outerHTML.slice(0,100))};})()`);
      assert(overflow.scroll<=overflow.width&&overflow.inner<=overflow.content&&!overflow.leaks.length,`Inspector overflow ${width}/${type}: ${JSON.stringify(overflow)}`);
    }
    fs.writeFileSync(path.join(out,`inspector-${width}.png`),(await window.webContents.capturePage()).toPNG());
  }
  window.setSize(1440,920);await wait();
  const rect=command=>run(`(()=>{const r=document.querySelector('[data-window-command="${command}"]').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),top:Math.round(r.top+8)};})()`);
  for(const command of ['minimize','maximize','close']){
    const r=await rect(command);window.webContents.sendInputEvent({type:'mouseMove',x:r.x,y:r.y});await wait();
    const bg=await run(`getComputedStyle(document.querySelector('[data-window-command="${command}"]')).backgroundColor`);
    assert(bg===(command==='close'?'rgb(232, 17, 35)':'rgb(229, 231, 235)'),`Incorrect ${command} hover: ${bg}`);
    fs.writeFileSync(path.join(out,`hover-${command}.png`),(await window.webContents.capturePage()).toPNG());
  }
  window.webContents.sendInputEvent({type:'mouseMove',x:500,y:100});await wait();
  const r=await rect('close');
  const pixel=async()=>{const image=await window.webContents.capturePage({x:r.x,y:r.top,width:1,height:1});return [...image.toBitmap().subarray(0,3)];};
  const normal=await pixel();
  await run(`document.querySelector('[data-action="help"]').click()`);await wait();
  const dimmed=await pixel();assert(normal.every((n,i)=>n-dimmed[i]>35),`Caption buttons not dimmed: ${normal} -> ${dimmed}`);
  fs.writeFileSync(path.join(out,'dialog-dimmed.png'),(await window.webContents.capturePage()).toPNG());
  await run(`document.querySelector('#modal').close()`);await wait();
  assert((await pixel()).every((n,i)=>Math.abs(n-normal[i])<3),'Caption not restored after dialog closed');
  await run(`document.querySelector('[data-window-command="maximize"]').click()`);await wait();assert(window.isMaximized(),'Maximize button failed');
  assert(await run(`document.querySelector('[data-window-command="maximize"]').getAttribute('aria-label')==='Восстановить размер'`),'Restore glyph not synchronized');
  await run(`document.querySelector('[data-window-command="maximize"]').click()`);await wait();assert(!window.isMaximized(),'Restore button failed');
  await run(`document.querySelector('[data-window-command="minimize"]').click()`);await wait();assert(window.isMinimized(),'Minimize button failed');window.restore();await wait();
  let closeRequested=false;const intercept=e=>{e.preventDefault();closeRequested=true;};window.on('close',intercept);
  await run(`document.querySelector('[data-window-command="close"]').click()`);await wait();window.removeListener('close',intercept);assert(closeRequested,'Close button failed');
  console.log('WINDOW_AND_INSPECTOR_VERIFIED');
};
