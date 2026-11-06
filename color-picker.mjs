const valid=value=>/^#[0-9a-f]{6}$/i.test(value);
function hsv(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;let h=d===0?0:max===rgb[0]?((rgb[1]-rgb[2])/d+6)%6:max===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4;return {h:h*60,s:max?d/max:0,v:max};}
function hex({h,s,v}){const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c,parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+parts.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');}
export function setupColorPickers(container,{getPresets,addPreset,removePreset}){
  for(const input of container.querySelectorAll('input[type="color"]')){
    input.type='hidden';const control=document.createElement('span');control.className='color-control';input.before(control);control.append(input);
    const trigger=document.createElement('button');trigger.type='button';trigger.className='color-trigger';trigger.setAttribute('aria-label','Выбрать цвет');
    const chip=document.createElement('span');chip.className='color-chip';const value=document.createElement('span');trigger.append(chip,value);
    const popup=document.createElement('span');popup.className='color-popup';popup.popover='auto';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Выбор цвета');
    const area=document.createElement('span');area.className='color-sv';area.tabIndex=0;area.setAttribute('role','slider');area.setAttribute('aria-label','Насыщенность и яркость');const point=document.createElement('span');point.className='color-point';area.append(point);
    const hue=document.createElement('input');hue.type='range';hue.min=0;hue.max=359;hue.className='color-hue';hue.setAttribute('aria-label','Цветовой тон');
    const code=document.createElement('input');code.type='text';code.maxLength=7;code.className='color-code';code.setAttribute('aria-label','Цвет HEX');
    const presets=document.createElement('span');presets.className='color-presets';
    const done=document.createElement('button');done.type='button';done.className='btn primary color-done';done.textContent='Готово';popup.append(area,hue,code,presets,done);control.append(trigger);
    // Keep the popup outside the field label. Otherwise a real click on its
    // saturation area activates the label's trigger and closes the popup.
    (control.closest('label')||control).after(popup);
    const context=document.createElement('span');context.className='color-context-menu';context.setAttribute('role','menu');context.hidden=true;
    const remove=document.createElement('button');remove.type='button';remove.textContent='Удалить';remove.setAttribute('role','menuitem');context.append(remove);popup.append(context);let contextColor=null,contextTarget=null;
    let draft=input.value,state=hsv(draft);
    const updateTrigger=()=>{chip.style.background=input.value;value.textContent=input.value.toUpperCase();};updateTrigger();
    const draw=()=>{area.style.backgroundColor=`hsl(${state.h} 100% 50%)`;point.style.left=`${state.s*100}%`;point.style.top=`${(1-state.v)*100}%`;hue.value=state.h;code.value=draft.toUpperCase();code.classList.remove('invalid');area.setAttribute('aria-valuetext',draft);};
    const select=color=>{draft=color.toLowerCase();state=hsv(draft);draw();};
    function showContext(button,color){contextColor=color;contextTarget=button;context.hidden=false;const r=button.getBoundingClientRect();context.style.left=`${Math.max(8,Math.min(r.left,innerWidth-148))}px`;context.style.top=`${Math.max(8,Math.min(r.bottom+3,innerHeight-44))}px`;remove.focus();}
    remove.onclick=e=>{e.preventDefault();e.stopPropagation();removePreset(contextColor);context.hidden=true;drawPresets();position();};
    function drawPresets(){presets.replaceChildren();for(const color of getPresets()){
      const button=document.createElement('button');button.type='button';button.className='color-swatch';button.style.background=color;button.dataset.color=color;button.setAttribute('aria-label',`Цвет ${color}`);button.setAttribute('aria-haspopup','menu');button.onclick=e=>{e.preventDefault();context.hidden=true;select(color);};
      button.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();showContext(button,color);};button.onkeydown=e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();e.stopPropagation();showContext(button,color);}};presets.append(button);
    }const add=document.createElement('button');add.type='button';add.className='color-add';add.textContent='+';add.setAttribute('aria-label','Добавить текущий цвет в образцы');add.onclick=e=>{e.preventDefault();context.hidden=true;if(valid(draft)&&!code.classList.contains('invalid')){addPreset(draft);drawPresets();position();}};presets.append(add);}
    function position(){const r=control.getBoundingClientRect(),height=popup.offsetHeight,width=popup.offsetWidth;popup.style.left=`${Math.max(8,Math.min(r.left,innerWidth-width-8))}px`;popup.style.top=`${Math.max(8,r.bottom+height+6<=innerHeight?r.bottom+6:r.top-height-6)}px`;}
    trigger.onclick=e=>{e.preventDefault();if(popup.matches(':popover-open')){popup.hidePopover();return;}context.hidden=true;select(input.value);drawPresets();popup.showPopover();position();code.focus();};
    const updateFromPointer=e=>{const r=area.getBoundingClientRect();state.s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));state.v=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));draft=hex(state);draw();};
    area.onpointerdown=e=>{e.preventDefault();area.setPointerCapture(e.pointerId);updateFromPointer(e);};area.onpointermove=e=>{if(area.hasPointerCapture(e.pointerId))updateFromPointer(e);};
    area.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();if(e.key==='ArrowLeft')state.s-=.01;if(e.key==='ArrowRight')state.s+=.01;if(e.key==='ArrowUp')state.v+=.01;if(e.key==='ArrowDown')state.v-=.01;state.s=Math.max(0,Math.min(1,state.s));state.v=Math.max(0,Math.min(1,state.v));draft=hex(state);draw();};
    hue.oninput=()=>{state.h=Number(hue.value);draft=hex(state);draw();};code.oninput=()=>{const candidate=code.value.startsWith('#')?code.value:'#'+code.value;if(valid(candidate))select(candidate);else code.classList.add('invalid');};
    done.onclick=e=>{e.preventDefault();if(code.classList.contains('invalid')){code.focus();return;}context.hidden=true;popup.hidePopover();trigger.focus();if(input.value!==draft){input.value=draft;updateTrigger();input.dispatchEvent(new Event('change',{bubbles:true}));}};
    popup.addEventListener('pointerdown',e=>{if(!context.contains(e.target)&&!e.target.closest('.color-swatch'))context.hidden=true;});
    popup.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!context.hidden){context.hidden=true;contextTarget?.focus();}else{popup.hidePopover();trigger.focus();}}if(e.key==='Enter'&&!e.target.closest('.color-swatch,.color-add,.color-context-menu')){e.preventDefault();e.stopPropagation();done.click();}};
  }
}
