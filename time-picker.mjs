const clock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const pad=value=>String(value).padStart(2,'0');

// Replace native cyclic time selectors while retaining each input's form name,
// value and change events. Time is always chosen in the popup, never typed.
export function setupTimePickers(container){
  for(const input of container.querySelectorAll('input[type="time"]')){
    input.type='text';input.classList.add('time-input');input.readOnly=true;input.inputMode='none';
    const control=document.createElement('span');control.className='time-control';input.before(control);control.append(input);
    const trigger=document.createElement('button');trigger.type='button';trigger.className='time-trigger';trigger.innerHTML=clock;trigger.setAttribute('aria-label','Выбрать время');trigger.setAttribute('aria-expanded','false');
    const popup=document.createElement('span');popup.className='time-popup';popup.popover='auto';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Выбор времени');popup.tabIndex=-1;
    const columns=document.createElement('span');columns.className='time-picker-columns';popup.append(columns);
    const parts={};let draft={hour:0,minute:0};
    for(const [part,count,title] of [['hour',24,'Часы'],['minute',60,'Минуты']]){
      const column=document.createElement('span');column.className='time-picker-column';
      const heading=document.createElement('span');heading.className='time-picker-heading';heading.textContent=title;
      const list=document.createElement('span');list.className='time-options';list.dataset.part=part;list.setAttribute('role','listbox');list.setAttribute('aria-label',title);list.tabIndex=0;
      for(let value=0;value<count;value++){
        const option=document.createElement('button');option.type='button';option.className='time-option';option.textContent=pad(value);option.dataset.value=value;option.setAttribute('role','option');option.tabIndex=-1;
        option.onclick=event=>{event.preventDefault();draft[part]=value;refresh();list.focus();};list.append(option);
      }
      list.onkeydown=event=>{
        let next=draft[part];if(event.key==='ArrowDown')next++;else if(event.key==='ArrowUp')next--;else if(event.key==='Home')next=0;else if(event.key==='End')next=count-1;else return;
        event.preventDefault();event.stopPropagation();draft[part]=Math.max(0,Math.min(count-1,next));refresh();reveal(part);
      };
      column.append(heading,list);columns.append(column);parts[part]=list;
    }
    const done=document.createElement('button');done.type='button';done.className='btn primary time-picker-done';done.textContent='Готово';
    const actions=document.createElement('span');actions.className='time-picker-actions';
    if(input.hasAttribute('data-time-clearable')){const clear=document.createElement('button');clear.type='button';clear.className='btn time-picker-clear';clear.textContent='Очистить';clear.onclick=event=>{event.preventDefault();popup.hidePopover();input.focus();if(input.value){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}};actions.append(clear);}
    actions.append(done);popup.append(actions);control.append(trigger,popup);
    // A click on the popup's empty area must not reach the label around the field.
    popup.addEventListener('click',event=>event.preventDefault());
    function refresh(){for(const part of ['hour','minute'])for(const option of parts[part].children){const selected=Number(option.dataset.value)===draft[part];option.classList.toggle('selected',selected);option.setAttribute('aria-selected',String(selected));}}
    function reveal(part){const list=parts[part],selected=list.children[draft[part]];list.scrollTop=selected.offsetTop-(list.clientHeight-selected.offsetHeight)/2;}
    function position(){const rect=control.getBoundingClientRect(),width=200,height=popup.offsetHeight;popup.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-width-8))}px`;popup.style.top=`${Math.max(8,rect.bottom+height+6<=window.innerHeight?rect.bottom+6:rect.top-height-6)}px`;}
    function open(){
      if(popup.matches(':popover-open')){popup.hidePopover();return;}
      const value=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(input.value);draft={hour:value?Number(value[1]):0,minute:value?Number(value[2]):0};refresh();popup.showPopover();position();reveal('hour');reveal('minute');parts.hour.focus();
    }
    // The browser closes the popup on press, so remember whether it was open:
    // the click that follows must not reopen it.
    let wasOpen=false;
    for(const target of [input,trigger]){
      target.addEventListener('pointerdown',()=>{wasOpen=popup.matches(':popover-open');});
      target.addEventListener('click',event=>{event.preventDefault();if(wasOpen){wasOpen=false;if(popup.matches(':popover-open'))popup.hidePopover();return;}open();});
    }
    input.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '||(event.key==='ArrowDown'&&event.altKey)){event.preventDefault();open();}});
    done.onclick=event=>{event.preventDefault();const value=`${pad(draft.hour)}:${pad(draft.minute)}`;popup.hidePopover();input.focus();if(input.value!==value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}};
    popup.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();done.click();}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();popup.hidePopover();trigger.focus();}});
    popup.addEventListener('toggle',event=>{trigger.setAttribute('aria-expanded',String(event.newState==='open'));});
  }
}
