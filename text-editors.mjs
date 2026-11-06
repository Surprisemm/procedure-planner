import {FONTS,fontCss} from './presentation.mjs';
export function readTextStyles(form){return Object.fromEntries([...form.querySelectorAll('[data-text-key]')].filter(e=>e.dataset.textCustomized==='true').map(e=>[e.dataset.textKey,JSON.parse(e.dataset.textStyle)]));}
export function setupTextEditors(container,{getStyle=()=>({}),onChange=null,openKey='',getAlignment=()=>null,onAlignmentChange=null}={}){
  for(const input of container.querySelectorAll('input[type="text"]:not(.time-input),textarea')){
    if(input.hasAttribute('data-plain-text')||input.id==='patient-search'||input.id==='instructor-search'||input.closest('.color-popup')||input.dataset.textKey)continue;
    const key=input.dataset.field||input.name;if(!key||key==='scheduleName'||input.closest('#stay-form'))continue;
    const style={fontFamily:'Segoe UI',fontSize:12,bold:false,italic:false,...getStyle(key)};input.dataset.textKey=key;
    const panel=document.createElement('details');panel.className='text-format';panel.open=openKey===key;
    const summary=document.createElement('summary');summary.textContent='Оформление текста';panel.append(summary);
    const row=document.createElement('span');row.className='text-format-row';
    const family=document.createElement('select');family.setAttribute('aria-label','Шрифт');for(const font of FONTS){const option=document.createElement('option');option.value=font;option.textContent=font;family.append(option);}family.value=style.fontFamily;
    const size=document.createElement('input');size.type='number';size.min=6;size.max=48;size.value=style.fontSize;size.setAttribute('aria-label','Размер шрифта');
    const bold=document.createElement('button');bold.type='button';bold.className='text-bold';bold.textContent='B';bold.setAttribute('aria-label','Жирный');
    const italic=document.createElement('button');italic.type='button';italic.className='text-italic';italic.textContent='I';italic.setAttribute('aria-label','Курсив');
    const apply=()=>{input.dataset.textStyle=JSON.stringify(style);input.style.cssText+=`;${fontCss(style)}`;bold.setAttribute('aria-pressed',String(style.bold));italic.setAttribute('aria-pressed',String(style.italic));};
    const commit=()=>{input.dataset.textCustomized='true';apply();onChange?.(key,{...style});};
    family.onchange=()=>{style.fontFamily=family.value;commit();};size.onchange=()=>{const value=Number(size.value);if(Number.isInteger(value)&&value>=6&&value<=48){style.fontSize=value;commit();}else size.value=style.fontSize;};
    bold.onclick=e=>{e.preventDefault();style.bold=!style.bold;commit();};italic.onclick=e=>{e.preventDefault();style.italic=!style.italic;commit();};
    row.append(family,size,bold,italic);panel.append(row);
    const alignment=getAlignment(key);if(alignment!==null){const label=document.createElement('label');label.className='text-alignment';label.textContent='Выравнивание';const select=document.createElement('select');select.setAttribute('aria-label','Выравнивание текста');select.dataset.textAlignment=key;for(const [value,text] of [['left','Слева'],['center','По центру'],['right','Справа']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=alignment;select.onchange=()=>onAlignmentChange?.(key,select.value);label.append(select);panel.append(label);}
    const field=input.closest('label.field');if(field){const wrapper=document.createElement('div');wrapper.className='text-field';field.before(wrapper);wrapper.append(field,panel);}else input.after(panel);apply();
  }
}
