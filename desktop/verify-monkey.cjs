// Random actions in the real interface, on an isolated profile. Looks for uncaught
// errors, a broken layout, and saved data the validator rejects. Repeatable by seed.
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({window,out})=>{
  const seeds=(process.env.RITM_MONKEY_SEEDS||'11,22,33').split(',').map(Number),steps=Number(process.env.RITM_MONKEY_STEPS||250);
  const console_=[];
  window.webContents.on('console-message',(_e,level,message)=>{if(level>=3)console_.push(message.slice(0,300));});
  const report=[];
  for(const seed of seeds){
    const result=await window.webContents.executeJavaScript(`(async()=>{
      const {validateProject}=await import('./domain.mjs');
      let s=${seed};const rnd=()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
      const pick=list=>list[Math.floor(rnd()*list.length)];
      const skip=new Set(['open-project','save-project','download-export','refresh-export']);
      const errors=[],toasts=new Map(),log=[];
      const onError=e=>errors.push('error: '+(e.message||e.reason?.message||e.reason));
      window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
      const toast=document.querySelector('#toast'),watch=new MutationObserver(()=>{if(toast.className.includes('error')){toasts.set(toast.textContent,(toasts.get(toast.textContent)||0)+1);}});watch.observe(toast,{attributes:true,childList:true});
      const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
      const scope=()=>{const m=document.querySelector('#modal');return m.open?m:document;};
      const press=(e,x,y)=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x,clientY:y}));};
      const words=['','А','Новое название','7','<b>x</b>','"кавычка"','0','-5','120','9999','abc','   '];
      const dates=['2026-11-09','2026-11-10','2027-01-01','2026-12-31','2020-02-29'];
      const acts={
        action(){const list=[...scope().querySelectorAll('[data-action]')].filter(e=>visible(e)&&!skip.has(e.dataset.action)&&!e.disabled);if(!list.length)return;const e=pick(list);log.push('action '+e.dataset.action);e.click();},
        card(){if(scope()!==document)return;const list=[...document.querySelectorAll('[data-appointment],[data-procedure]')].filter(visible);if(!list.length)return;const e=pick(list),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;log.push('card');press(e,x,y);document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y}));},
        drag(){if(scope()!==document)return;const list=[...document.querySelectorAll('[data-appointment],[data-procedure],.resize-handle')].filter(visible);if(!list.length)return;const e=pick(list),r=e.getBoundingClientRect(),box=document.querySelector('.schedule-scroll').getBoundingClientRect(),x=r.left+2,y=r.top+2,tx=box.left+rnd()*box.width,ty=box.top+rnd()*(innerHeight-box.top);log.push('drag');press(e,x,y);document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x+10,clientY:y+10}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:tx,clientY:ty}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:tx,clientY:ty}));},
        field(){const list=[...scope().querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>visible(e)&&!e.closest('.time-popup,.color-popup,.search'));if(!list.length)return;const e=pick(list);log.push('field '+(e.dataset.field||e.name||e.id||e.className));
          if(e.type==='checkbox'||e.type==='radio'){e.click();return;}
          if(e.tagName==='SELECT'){if(e.options.length){e.selectedIndex=Math.floor(rnd()*e.options.length);e.dispatchEvent(new Event('change',{bubbles:true}));}return;}
          if(e.type==='date')e.value=pick(dates);else if(e.classList.contains('time-input'))e.value=pick(['00:00','08:30','13:15','17:30','23:55','']);else if(e.type==='number')e.value=pick(['','1','5','7','55','60','0','-5','9999','2.5']);else e.value=pick(words);
          e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},
        submit(){const f=scope()===document?null:scope().querySelector('form');if(f){log.push('submit '+f.id);f.requestSubmit();}},
        key(){const k=pick([['KeyZ',true],['KeyY',true],['KeyD',true],['Delete',false],['Escape',false]]);log.push('key '+k[0]);document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:k[1],code:k[0],key:k[0]==='Delete'?'Delete':k[0]==='Escape'?'Escape':k[0]}));},
        close(){const m=document.querySelector('#modal');if(m.open){log.push('close');m.close();}}
      };
      const weights=['action','action','action','card','card','drag','drag','field','field','field','submit','key','key','close'];
      let bad=null,done=0;
      for(let i=0;i<${steps}&&!bad;i++){
        try{acts[pick(weights)]();}catch(e){errors.push('step: '+e.message);}
        await new Promise(r=>setTimeout(r,0));
        done=i+1;
        if(errors.length)bad=errors[0];
        if(!document.querySelector('.app-shell'))bad='Интерфейс исчез';
        try{validateProject(JSON.parse(window.ritmDesktop.storage.load().data));}catch(e){bad='Сохранение некорректно: '+e.message;}
        const shell=document.querySelector('.app-shell');if(shell&&shell.scrollWidth>innerWidth+1)bad='Страница вылезла по ширине';
      }
      window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);watch.disconnect();
      document.querySelector('#modal').close();document.body.classList.remove('dragging');
      return {seed:${seed},done,bad,last:log.slice(-12),toasts:[...toasts].sort((a,b)=>b[1]-a[1]).slice(0,25)};
    })()`,true);
    report.push(result);
  }
  if(out)fs.writeFileSync(path.join(out,'monkey-report.json'),JSON.stringify({report,console:[...new Set(console_)]},null,1));
  for(const r of report)console.log('MONKEY seed',r.seed,'steps',r.done,r.bad?('BAD '+r.bad+' | '+r.last.join(' > ')):'ok');
  console.log('MONKEY console errors',[...new Set(console_)].slice(0,8).join(' || ')||'none');
  console.log('MONKEY toasts',JSON.stringify(report.flatMap(r=>r.toasts).slice(0,30)));
};
