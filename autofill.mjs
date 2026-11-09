// Automatic schedule generator. No DOM here: the dialog in app.js supplies the
// settings and applies the returned plan as one undoable transaction.
import {durationFor,hm,minutes,visibleColumns,workKey,workdayEnd} from './domain.mjs';

export const DEFAULT_START=540;
export const DEFAULT_END=1050;
export const DEFAULT_SLOT=60;
const DAY_END=1440;

export const poolKey=name=>String(name).trim().toLowerCase();
const alignUp=(value,step)=>Math.ceil(value/step)*step;
const overlapsRange=(start,end,other)=>start<other.start+other.duration&&other.start<end;

// All instructors of a procedure work in parallel and a patient needs it once,
// from any of them. Library cards that share a name are treated as one procedure.
export function procedurePools(procedures){
  const pools=new Map();
  for(const procedure of procedures){
    const key=poolKey(procedure.name);
    if(!pools.has(key))pools.set(key,{key,name:procedure.name.trim(),templates:[]});
    const workers=procedure.instructors?.length?procedure.instructors.map(w=>w.instructorId):[null];
    for(const instructorId of workers)pools.get(key).templates.push({procedure,instructorId,work:workKey(procedure.id,instructorId)});
  }
  return [...pools.values()];
}
export const defaultRow=()=>({enabled:true,grid:true,gap:5,together:'single',capacity:2,groupId:COMMON_GROUP,limit:null});
export const isBlockedByDefault=name=>name.trim().toLowerCase()==='обед';
export function emptyAutofill(){return {links:[],groupList:[commonGroup()],weekdays:{}};}
export const COMMON_GROUP='common';
const commonGroup=()=>({id:COMMON_GROUP,name:'Общая',values:{}});
// A group is a named set of numbers, one per patient: patients with the same
// number may share a procedure that uses this group. "Общая" always exists.
// Older settings held one label or group per patient; those become its numbers.
export function normalizeGroups(store){
  const list=store?.groupList,old=store?.groups||{};
  if(Array.isArray(list)&&list.every(g=>g.values)){
    return {groupList:[list.find(g=>g.id===COMMON_GROUP)||commonGroup(),...list.filter(g=>g.id!==COMMON_GROUP)]};
  }
  const keys=[...new Set(Object.values(old).map(value=>value.trim()).filter(Boolean))],common=commonGroup();
  for(const [patient,value] of Object.entries(old))if(value.trim())common.values[patient]=keys.indexOf(value.trim())+1;
  return {groupList:[common]};
}
export const weekdayOf=date=>String(new Date(`${date}T12:00:00`).getDay());

// Fit saved settings to the current library: new procedures get defaults and
// removed ones drop out, so an old file never blocks the dialog.
export function normalizeSettings(raw,procedures,bands=[]){
  const rows={},instructors={};
  for(const {key,templates} of procedurePools(procedures)){
    rows[key]={...defaultRow(),...raw?.rows?.[key]};
    for(const {work} of templates)instructors[work]={enabled:true,from:'',to:'',...raw?.instructors?.[work]};
  }
  const blockedBands={};
  for(const {name} of bands)blockedBands[name]=raw?.blockedBands?.[name]??isBlockedByDefault(name);
  const partialKeys=(raw?.partialKeys||[]).filter(key=>rows[key]);
  return {start:raw?.start??DEFAULT_START,end:raw?.end??DEFAULT_END,slot:raw?.slot??DEFAULT_SLOT,mode:raw?.mode==='partial'?'partial':'full',partialKeys,blockedBands,rows,instructors};
}
// A weekday without its own settings starts from the most recently used ones.
export function resolveSettings(autofill,date,procedures,bands){
  const store=autofill||emptyAutofill(),own=store.weekdays?.[weekdayOf(date)];
  const inherited=store.lastWeekday!==undefined?store.weekdays?.[store.lastWeekday]:null;
  return {settings:normalizeSettings(own||inherited,procedures,bands),saved:!!own};
}
export function saveWeekdaySettings(autofill,date,settings,links,groupList){
  const weekday=weekdayOf(date),{groups:_old,...rest}=autofill||emptyAutofill();
  return {...rest,links,groupList,weekdays:{...autofill?.weekdays,[weekday]:settings},lastWeekday:weekday};
}

function selectedKeys(settings,links){
  if(settings.mode==='full')return new Set(Object.keys(settings.rows).filter(key=>settings.rows[key].enabled));
  const keys=new Set(settings.partialKeys);
  for(const link of links)if(keys.has(link.a)||keys.has(link.b)){keys.add(link.a);keys.add(link.b);}
  return keys;
}
// Returns messages that must be fixed before generation can start.
export function checkSettings(settings,procedures,day,links=[]){
  const errors=[],keys=selectedKeys(settings,links);
  if(!Number.isInteger(settings.start)||settings.start>=workdayEnd(day))errors.push('Начало должно быть раньше конца рабочего дня');
  if(!Number.isInteger(settings.slot)||settings.slot<day.step||settings.slot>480)errors.push(`Длина слота должна быть от ${day.step} до 480 минут`);
  if(!keys.size)errors.push('Отметьте хотя бы одну процедуру');
  for(const link of links)if(!link.a||!link.b||link.a===link.b)errors.push('В связке должны быть две разные процедуры');
  const linked=links.flatMap(link=>[link.a,link.b]);
  if(new Set(linked).size!==linked.length)errors.push('Процедура может входить только в одну связку');
  for(const pool of procedurePools(procedures)){
    if(!keys.has(pool.key))continue;
    const row=settings.rows[pool.key];
    if(!row.grid&&(!Number.isInteger(row.gap)||row.gap<0||row.gap>240))errors.push(`«${pool.name}»: укажите перерыв от 0 до 240 минут`);
    if(row.limit!=null&&(!Number.isInteger(row.limit)||row.limit<1||row.limit>500))errors.push(`«${pool.name}»: укажите максимум одновременно от 1 до 500 или оставьте поле пустым`);
    if(row.together!=='single'&&(!Number.isInteger(row.capacity)||row.capacity<2||row.capacity>50))errors.push(`«${pool.name}»: укажите от 2 до 50 пациентов одновременно`);
    for(const template of pool.templates){
      const work=settings.instructors[template.work],duration=durationFor(template.procedure,day);
      if(work.enabled===false)continue;
      if(duration%day.step)errors.push(`«${pool.name}»: длительность ${duration} мин не кратна шагу сетки ${day.step} мин`);
      const from=work.from?minutes(work.from):0,to=work.to?minutes(work.to):DAY_END;
      if(!Number.isFinite(from)||!Number.isFinite(to)||from>=to)errors.push(`«${pool.name}»: укажите время инструктора в формате ЧЧ:ММ, «с» раньше «до»`);
    }
  }
  return [...new Set(errors)];
}
// Fixed hourly starts, restarted from the end of each blocked period:
// 09:00 … 12:00, lunch, then 13:30, 14:30 and so on.
export function buildSlots(start,slot,blocked,step){
  const result=[];let current=alignUp(start,step);
  while(current<DAY_END){
    const band=blocked.find(b=>current>=b.start&&current<b.start+b.duration);
    if(band){current=alignUp(band.start+band.duration,step);continue;}
    result.push(current);current=alignUp(current+slot,step);
  }
  return result;
}

function context({procedures,day,settings:raw,links,groupList}){
  // The working day ends where the day's own properties say.
  const settings={...raw,end:workdayEnd(day)};
  const pools=new Map(procedurePools(procedures).map(pool=>[pool.key,pool]));
  const byId=new Map(procedures.map(p=>[p.id,p]));
  const keyOf=a=>poolKey(byId.get(a.procedureId)?.name??a.text);
  const keys=selectedKeys(settings,links);
  const activeLinks=links.filter(link=>keys.has(link.a)&&keys.has(link.b));
  const linkOf=new Map(activeLinks.flatMap(link=>[[link.a,link],[link.b,link]]));
  const allLinkOf=new Map(links.flatMap(link=>[[link.a,link],[link.b,link]]));
  const patientIds=visibleColumns(day).map(c=>c.patientId),enabled=new Set(patientIds);
  const remove=[],kept=[];
  for(const a of day.appointments){
    if(!enabled.has(a.patientId))continue;
    if(a.locked||(settings.mode==='partial'&&!keys.has(keyOf(a))))kept.push(a);else remove.push(a.id);
  }
  const blocked=day.bands.filter(b=>settings.blockedBands[b.name]);
  const slots=buildSlots(settings.start,settings.slot,blocked,day.step);
  const free=[];for(let m=alignUp(settings.start,day.step);m<DAY_END;m+=day.step)free.push(m);
  const templates=new Map();
  for(const key of keys){
    templates.set(key,(pools.get(key)?.templates||[]).filter(t=>settings.instructors[t.work]?.enabled!==false).map(t=>{
      const work=settings.instructors[t.work]||{};
      return {procedure:t.procedure,key,instructor:t.instructorId,duration:durationFor(t.procedure,day),from:work.from?minutes(work.from):0,to:work.to?minutes(work.to):null};
    }));
  }
  const activityOf=key=>{const link=allLinkOf.get(key);return link?`${link.a}\n${link.b}`:key;};
  return {day,settings,groupList,keys,keyOf,pools,linkOf,allLinkOf,patientIds,remove,kept,blocked,slots,free,templates,activityOf};
}
const gapFor=(ctx,key)=>{const row=ctx.settings.rows[key];return !row||row.grid?0:row.gap;};
const startsFor=(ctx,key)=>ctx.settings.rows[key]?.grid?ctx.slots:ctx.free;

// A return is a procedure the instructor comes back to after doing something else.
function returnsCount(ctx,items){
  const sorted=[...items].sort((a,b)=>a.start-b.start);
  let runs=0,previous=null;const seen=new Set();
  for(const item of sorted){const activity=ctx.activityOf(item.key);if(activity!==previous){runs++;previous=activity;}seen.add(activity);}
  return runs-seen.size;
}
function shuffled(list,rng){
  const result=[...list];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function push(map,key,item){if(!map.has(key))map.set(key,[]);map.get(key).push(item);}

// How many patients have this procedure at the busiest moment of the interval.
function peakAt(items,start,end){
  const active=items.filter(item=>item.start<end&&start<item.end);
  let peak=0;
  for(const moment of [start,...active.map(item=>item.start).filter(s=>s>start)]){
    peak=Math.max(peak,active.filter(item=>item.start<=moment&&moment<item.end).length);
  }
  return peak;
}
function canPlace(ctx,state,patientId,template,start){return placementProblem(ctx,state,patientId,template,start)===null;}
function placementProblem(ctx,state,patientId,template,start){
  const {key,duration,instructor}=template,end=start+duration,row=ctx.settings.rows[key],gap=gapFor(ctx,key);
  if(start<ctx.settings.start||end>DAY_END)return 'day';
  if(start<template.from||(template.to!==null&&end>template.to))return 'hours';
  if(ctx.blocked.some(b=>overlapsRange(start,end,b)))return 'blocked';
  const clash=item=>{const g=Math.max(gap,item.gap);return start<item.end+g&&item.start<end+g;};
  if((state.patients.get(patientId)||[]).some(clash))return 'patient';
  if(row.limit!=null&&peakAt(state.procedures.get(key)||[],start,end)+1>row.limit)return 'limit';
  if(instructor===null)return null;
  const items=state.instructors.get(instructor)||[];
  let session=0;
  for(const item of items){
    if(!clash(item))continue;
    const parallel=item.key!==key&&ctx.linkOf.get(key)?.simultaneous&&ctx.linkOf.get(key)===ctx.linkOf.get(item.key);
    if(parallel)continue;
    if(row.together==='single'||item.procedureId!==template.procedure.id||item.start!==start||item.end!==end)return 'busy';
    if(row.together==='groups'){
      const values=(ctx.groupList.find(g=>g.id===row.groupId)||ctx.groupList.find(g=>g.id===COMMON_GROUP))?.values||{},number=values[patientId];
      if(number==null||values[item.patientId]!==number)return 'busy';
    }
    session++;
  }
  if(session&&session+1>row.capacity)return 'busy';
  return returnsCount(ctx,[...items,{start,key}])<=returnsCount(ctx,items)?null:'returns';
}
function commit(state,patientId,template,start,gap){
  const item={patientId,procedureId:template.procedure.id,key:template.key,start,end:start+template.duration,gap};
  push(state.patients,patientId,item);
  push(state.procedures,template.key,item);
  if(template.instructor!==null)push(state.instructors,template.instructor,item);
  state.place.push({patientId,procedureId:template.procedure.id,instructorId:template.instructor,start,duration:template.duration,key:template.key});
  return item;
}
function rollback(state,patientId,template,item){
  state.patients.get(patientId).splice(state.patients.get(patientId).indexOf(item),1);
  state.procedures.get(template.key).splice(state.procedures.get(template.key).indexOf(item),1);
  if(template.instructor!==null){const list=state.instructors.get(template.instructor);list.splice(list.indexOf(item),1);}
  state.place.pop();
}
function placeSingle(ctx,state,patientId,key,rng){
  const templates=ctx.templates.get(key)||[];
  if(!templates.length)return 'no-instructor';
  for(const start of startsFor(ctx,key))for(const template of shuffled(templates,rng)){
    if(canPlace(ctx,state,patientId,template,start)){commit(state,patientId,template,start,gapFor(ctx,key));return null;}
  }
  return 'no-time';
}
// Start of the next procedure in a link: the next slot, or right after the break.
function nextStart(ctx,end,firstKey,secondKey){
  const earliest=end+Math.max(gapFor(ctx,firstKey),gapFor(ctx,secondKey));
  if(ctx.settings.rows[secondKey]?.grid)return ctx.slots.find(s=>s>=earliest)??null;
  return alignUp(earliest,ctx.day.step);
}
// Nothing may stand between the two halves of a link, then or later.
function gapIsFree(state,patientId,from,to){return !(state.patients.get(patientId)||[]).some(item=>item.start<to&&from<item.end);}
function holdGap(state,patientId,from,to){if(to>from)push(state.patients,patientId,{patientId,key:'',start:from,end:to,gap:0,filler:true});}
function findLinked(ctx,state,patientId,pairs,first,second){
  for(const start of startsFor(ctx,first))for(const one of pairs.get(first)){
    if(!canPlace(ctx,state,patientId,one,start))continue;
    const item=commit(state,patientId,one,start,gapFor(ctx,first));
    for(const two of one.partners.get(second)){
      const next=nextStart(ctx,start+one.duration,first,second);
      const fits=next!==null&&gapIsFree(state,patientId,start+one.duration,next)&&!ctx.blocked.some(b=>overlapsRange(start,next+two.duration,b))&&canPlace(ctx,state,patientId,two,next);
      if(fits){rollback(state,patientId,one,item);return {start,next,one,two};}
    }
    rollback(state,patientId,one,item);
  }
  return null;
}
function placeLink(ctx,state,patientId,link,rng){
  if(!(ctx.templates.get(link.a)||[]).length||!(ctx.templates.get(link.b)||[]).length)return 'no-instructor';
  const prepared=[link.a,link.b].map(key=>[key,shuffled(ctx.templates.get(key),rng).map(t=>{
    const other=key===link.a?link.b:link.a;
    const partners=new Map([[other,shuffled(ctx.templates.get(other),rng).filter(p=>p.instructor===t.instructor)]]);
    return {...t,partners};
  }).filter(t=>[...t.partners.values()][0].length)]);
  const pairs=new Map(prepared);
  if(!prepared[0][1].length)return 'no-pair';
  const options=[findLinked(ctx,state,patientId,pairs,link.a,link.b),findLinked(ctx,state,patientId,pairs,link.b,link.a)].filter(Boolean);
  if(!options.length)return 'no-time';
  const best=options.length===2&&options[0].start===options[1].start?options[Math.floor(rng()*2)]:options.reduce((a,b)=>b.start<a.start?b:a);
  commit(state,patientId,best.one,best.start,gapFor(ctx,best.one.key));
  commit(state,patientId,best.two,best.next,gapFor(ctx,best.two.key));
  holdGap(state,patientId,best.start+best.one.duration,best.next);
  return null;
}
// One half of a link is locked: put the other half right next to it, with the
// same instructor. Returns false when no neighbouring place is free.
function placeNextToLocked(ctx,state,patientId,key,lockedItem,rng){
  const templates=(ctx.templates.get(key)||[]).filter(t=>lockedItem.instructor===null||t.instructor===lockedItem.instructor);
  const tolerance=ctx.settings.rows[key]?.grid?ctx.settings.slot:gapFor(ctx,key)+ctx.day.step;
  const starts=startsFor(ctx,key);
  for(const template of shuffled(templates,rng)){
    const after=starts.find(s=>s>=lockedItem.end&&s-lockedItem.end<tolerance);
    const before=[...starts].reverse().find(s=>s+template.duration<=lockedItem.start&&lockedItem.start-(s+template.duration)<tolerance);
    for(const start of [after,before]){
      if(start===undefined)continue;
      const span={start:Math.min(start,lockedItem.start),end:Math.max(start+template.duration,lockedItem.end)};
      if(ctx.blocked.some(b=>overlapsRange(span.start,span.end,b)))continue;
      const [from,to]=start<lockedItem.start?[start+template.duration,lockedItem.start]:[lockedItem.end,start];
      if(gapIsFree(state,patientId,from,to)&&canPlace(ctx,state,patientId,template,start)){commit(state,patientId,template,start,gapFor(ctx,key));holdGap(state,patientId,from,to);return true;}
    }
  }
  return false;
}

function attempt(ctx,rng){
  const state={patients:new Map(),instructors:new Map(),procedures:new Map(),place:[]};
  const done=new Map(ctx.patientIds.map(id=>[id,new Map()]));
  for(const a of ctx.kept){
    const key=ctx.keyOf(a),item={patientId:a.patientId,procedureId:a.procedureId,key,start:a.start,end:a.start+a.duration,gap:0,instructor:a.instructorId||null};
    push(state.patients,a.patientId,item);
    push(state.procedures,key,item);
    if(item.instructor!==null)push(state.instructors,item.instructor,item);
    done.get(a.patientId).set(key,item);
  }
  const unplaced=[],broken=[];
  const activities=new Map();
  for(const key of ctx.keys)if(!activities.has(ctx.activityOf(key)))activities.set(ctx.activityOf(key),ctx.linkOf.get(key)||key);
  for(const activity of shuffled([...activities.values()],rng)){
    for(const patientId of shuffled(ctx.patientIds,rng)){
      const has=done.get(patientId);
      const miss=(key,reason)=>{if(reason)unplaced.push({patientId,key,reason});};
      if(typeof activity==='string'){if(!has.has(activity))miss(activity,placeSingle(ctx,state,patientId,activity,rng));continue;}
      const hasA=has.get(activity.a),hasB=has.get(activity.b);
      if(hasA&&hasB)continue;
      if(!hasA&&!hasB){const reason=placeLink(ctx,state,patientId,activity,rng);if(reason){miss(activity.a,reason);miss(activity.b,reason);}continue;}
      const key=hasA?activity.b:activity.a,locked=hasA||hasB;
      if(placeNextToLocked(ctx,state,patientId,key,locked,rng))continue;
      const reason=placeSingle(ctx,state,patientId,key,rng);
      if(reason)miss(key,reason);else broken.push({patientId,key});
    }
  }
  return scored(ctx,state,unplaced,broken);
}
function scored(ctx,state,unplaced,broken){
  const overtime=state.place.filter(p=>p.start+p.duration>ctx.settings.end);
  const overtimeMinutes=overtime.reduce((sum,p)=>sum+p.start+p.duration-ctx.settings.end,0);
  const lastEnd=state.place.reduce((max,p)=>Math.max(max,p.start+p.duration),0);
  let windows=0;
  for(const items of state.patients.values()){
    const sorted=[...items].sort((a,b)=>a.start-b.start);
    for(let i=1;i<sorted.length;i++){
      const from=sorted[i-1].end,to=sorted[i].start;
      if(to<=from)continue;
      const lunch=ctx.blocked.filter(b=>overlapsRange(from,to,b)).reduce((sum,b)=>sum+b.duration,0);
      windows+=Math.max(0,to-from-lunch);
    }
  }
  const score=unplaced.length*1e9+broken.length*1e7+overtimeMinutes*1e4+lastEnd*10+windows;
  return {state,place:state.place,unplaced,broken,overtime:overtime.length,score};
}
function lockedReturns(ctx){
  const byInstructor=new Map();
  for(const a of ctx.kept)if(a.locked&&a.instructorId)push(byInstructor,a.instructorId,{start:a.start,key:ctx.keyOf(a)});
  return [...byInstructor].filter(([,items])=>returnsCount(ctx,items)>0).map(([id])=>id);
}
// Tries many random arrangements and returns the best. Nothing is changed here:
// the caller removes `remove` and creates appointments from `place`.
export function planDay({procedures,day,settings,links=[],groupList=[],rng=Math.random,attempts=400,budgetMs=Infinity}){
  const ctx=context({procedures,day,settings,links,groupList});
  const started=Date.now();
  let best=null;
  for(let i=0;i<attempts;i++){
    const result=attempt(ctx,rng);
    if(!best||result.score<best.score)best=result;
    if(Date.now()-started>budgetMs)break;
  }
  const place=best.place.map(({key,...rest})=>rest);
  const nameOf=key=>ctx.pools.get(key)?.name??key;
  return {remove:ctx.remove,place,report:{
    placed:place.length,
    total:place.length+best.unplaced.length,
    overtime:best.overtime,
    unplaced:best.unplaced.map(item=>({...item,name:nameOf(item.key),...explainUnplaced(ctx,best.state,item)})),
    broken:best.broken.map(item=>({...item,name:nameOf(item.key)})),
    lockedReturns:lockedReturns(ctx)
  }};
}

// ---- Why a procedure could not be placed.
// Checks run in this order, so the check a candidate fails shows how close it came.
const PROBLEM_ORDER=['day','hours','blocked','patient','limit','busy','returns'];
function explainUnplaced(ctx,state,item){
  const {patientId,key,reason}=item,templates=ctx.templates.get(key)||[],row=ctx.settings.rows[key];
  const instructorIds=[...new Set(templates.map(t=>t.instructor).filter(Boolean))];
  const limits=templates.map(t=>t.to).filter(to=>to!==null);
  const until=limits.length===templates.length&&limits.length?Math.max(...limits):null;
  const details={instructorIds,until,limit:row?.limit??null};
  if(reason!=='no-time')return {...details,cause:reason};
  let closest=-1,fits=false;
  for(const start of startsFor(ctx,key))for(const template of templates){
    const problem=placementProblem(ctx,state,patientId,template,start);
    if(problem===null)fits=true;else closest=Math.max(closest,PROBLEM_ORDER.indexOf(problem));
  }
  // Each half fits somewhere on its own: only the link keeps it out.
  if(fits)return {...details,cause:'link'};
  return {...details,cause:PROBLEM_ORDER[closest]||'day'};
}
const joinNames=(ids,nameOf)=>ids.map(nameOf).join(', ');
// Plain text for the report: what got in the way and what to change.
export function describeCause(item,nameOf=id=>id){
  const names=joinNames(item.instructorIds||[],nameOf),until=item.until!=null?` до ${hm(item.until)}`:'';
  switch(item.cause){
    case 'no-instructor':return {text:'не отмечен ни один инструктор',hint:'Отметьте инструктора в строке процедуры.'};
    case 'no-pair':return {text:'нет общего инструктора для связки',hint:'Обе процедуры связки должны быть у одного инструктора.'};
    case 'link':return {text:'нет двух свободных мест подряд для связки',hint:'Освободите время или уберите связку.'};
    case 'hours':return {text:`вне времени работы${names?`: ${names}`:''}${until}`,hint:'Расширьте поля «с» и «до» у инструктора.'};
    case 'blocked':return {text:'всё оставшееся время занято периодами «Не ставить на»',hint:'Снимите галочку у периода.'};
    case 'patient':return {text:'у пациента нет свободного времени, когда работает инструктор',hint:'Освободите пациента или расширьте время инструктора.'};
    case 'limit':return {text:`достигнут максимум одновременно${item.limit!=null?`: ${item.limit}`:''}`,hint:'Увеличьте «Макс.» или добавьте другое время.'};
    case 'busy':return {text:`нет свободного времени у инструктора${names?`: ${names}`:''}${until}`,hint:until?'Сдвиньте «до», добавьте инструктора или сделайте процедуру совместной.':'Добавьте инструктора или сделайте процедуру совместной.'};
    case 'returns':return {text:`инструктор уже перешёл на другую процедуру${names?`: ${names}`:''}`,hint:'Инструктор не возвращается к прежней процедуре: задайте порядок полями «с» и «до».'};
    default:return {text:'до 24:00 не осталось места',hint:'Уменьшите число процедур в этот день.'};
  }
}

// ---- Rough load estimate shown before generating.
function subtractRanges(start,end,busy){
  let parts=start<end?[[start,end]]:[];
  for(const [from,to] of busy){
    parts=parts.flatMap(([a,b])=>to<=a||from>=b?[[a,b]]:[...(from>a?[[a,from]]:[]),...(to<b?[[to,b]]:[])]);
  }
  return parts;
}
const mergedLength=parts=>{
  let total=0,reach=-Infinity;
  for(const [a,b] of [...parts].sort((x,y)=>x[0]-y[0])){const from=Math.max(a,reach);if(b>from){total+=b-from;reach=b;}}
  return total;
};
export function estimateLoad({procedures,day,settings:raw,links=[],groupList=[]}){
  if(checkSettings(raw,procedures,day,links).length)return null;
  const ctx=context({procedures,day,settings:raw,links,groupList}),settings=ctx.settings;
  const blockedRanges=ctx.blocked.map(b=>[b.start,b.start+b.duration]);
  const has=new Set(ctx.kept.map(a=>`${a.patientId}|${ctx.keyOf(a)}`));
  const busyOf=id=>ctx.kept.filter(a=>a.instructorId===id).map(a=>[a.start,a.start+a.duration]);
  const lengthFor=(key,duration)=>{const row=settings.rows[key];return row.grid?Math.ceil(duration/settings.slot)*settings.slot:duration+row.gap;};
  const windowOf=(t,limit)=>subtractRanges(Math.max(settings.start,t.from),t.to!==null?Math.min(t.to,limit):limit,[...blockedRanges,...busyOf(t.instructor)]);
  const fitIn=(parts,key,duration)=>{
    const row=settings.rows[key];let count=0;
    for(const [a,b] of parts){
      if(row.grid){let cursor=a;for(const slot of ctx.slots)if(slot>=cursor&&slot+duration<=b){count++;cursor=slot+duration;}}
      else if(b-a>=duration)count+=Math.floor((b-a+row.gap)/(duration+row.gap));
    }
    return count;
  };
  const sessionsFor=(key,patients)=>{
    const row=settings.rows[key];
    if(row.together==='single')return patients.length;
    if(row.together==='any')return Math.ceil(patients.length/row.capacity);
    const values=(groupList.find(g=>g.id===row.groupId)||groupList.find(g=>g.id===COMMON_GROUP))?.values||{},sizes=new Map();let alone=0;
    for(const id of patients){if(values[id]==null)alone++;else sizes.set(values[id],(sizes.get(values[id])||0)+1);}
    return alone+[...sizes.values()].reduce((sum,size)=>sum+Math.ceil(size/row.capacity),0);
  };
  const statusOf=(needed,fit,fitDay)=>needed<=fit?'ok':needed<=fitDay?'late':'lost';
  const rows={},shares=new Map();
  for(const key of ctx.keys){
    const workers=ctx.templates.get(key)||[],patients=ctx.patientIds.filter(id=>!has.has(`${id}|${key}`)),needed=sessionsFor(key,patients),name=ctx.pools.get(key)?.name??key,row=settings.rows[key];
    if(!needed){rows[key]={name,needed:0,fit:null,fitDay:null,status:'ok'};continue;}
    if(!workers.length){rows[key]={name,needed,fit:0,fitDay:0,status:'lost',cause:'no-instructor'};continue;}
    const link=ctx.linkOf.get(key);
    if(link){
      const other=link.a===key?link.b:link.a,partners=ctx.templates.get(other)||[];
      if(partners.length&&!workers.some(t=>partners.some(p=>p.instructor===t.instructor))){rows[key]={name,needed,fit:0,fitDay:0,status:'lost',cause:'no-pair'};continue;}
    }
    let fit=null,fitDay=null;
    if(workers.some(t=>t.instructor!==null)){
      const counted=workers.filter(t=>t.instructor!==null);
      const perWorker=counted.map(t=>fitIn(windowOf(t,settings.end),key,t.duration)),perDay=counted.map(t=>fitIn(windowOf(t,DAY_END),key,t.duration));
      fit=perWorker.reduce((a,b)=>a+b,0);fitDay=perDay.reduce((a,b)=>a+b,0);
      if(row.limit!=null){
        const perSession=Math.max(1,patients.length/needed),atOnce=Math.max(1,Math.floor(row.limit/perSession));
        fit=Math.min(fit,atOnce*Math.max(...perWorker));fitDay=Math.min(fitDay,atOnce*Math.max(...perDay));
      }
      for(const t of counted){
        if(!shares.has(t.instructor))shares.set(t.instructor,[]);
        shares.get(t.instructor).push({key,template:t,sessions:needed/counted.length,minutes:needed/counted.length*lengthFor(key,t.duration)});
      }
    }
    rows[key]={name,needed,fit,fitDay,status:fit===null?'ok':statusOf(needed,fit,fitDay)};
  }
  // An instructor with several procedures shares one working day between them.
  const instructors=[];
  for(const [instructorId,works] of shares){
    if(works.length<2)continue;
    const groups=new Map();
    for(const work of works){
      const link=ctx.linkOf.get(work.key),id=link?.simultaneous?`${link.a}\n${link.b}`:work.key;
      const current=groups.get(id);
      if(!current||work.minutes>current.minutes)groups.set(id,work);
    }
    const chosen=[...groups.values()],minutes=chosen.reduce((sum,w)=>sum+w.minutes,0),needed=Math.ceil(chosen.reduce((sum,w)=>sum+w.sessions,0)),length=minutes/needed;
    const available=limit=>mergedLength(works.flatMap(w=>windowOf(w.template,limit)));
    const fit=Math.floor(available(settings.end)/length),fitDay=Math.floor(available(DAY_END)/length);
    instructors.push({instructorId,needed,fit,fitDay,status:statusOf(needed,fit,fitDay)});
  }
  // A patient's procedures must fit into the patient's own free time.
  let late=0,lost=0;
  for(const id of ctx.patientIds){
    const own=ctx.kept.filter(a=>a.patientId===id).map(a=>[a.start,a.start+a.duration]);
    let minutes=0;
    for(const key of ctx.keys){
      if(has.has(`${id}|${key}`))continue;
      const durations=(ctx.templates.get(key)||[]).map(t=>lengthFor(key,t.duration));
      if(durations.length)minutes+=Math.min(...durations);
    }
    const free=limit=>mergedLength(subtractRanges(settings.start,limit,[...blockedRanges,...own]));
    if(minutes>free(DAY_END))lost++;else if(minutes>free(settings.end))late++;
  }
  const all=[...Object.values(rows).map(r=>r.status),...instructors.map(i=>i.status),...(lost?['lost']:[]),...(late?['late']:[])];
  return {rows,instructors,patients:{late,lost},status:all.includes('lost')?'lost':all.includes('late')?'late':'ok'};
}
const plural=(n,one,few,many)=>{const a=n%100,b=n%10;return a>10&&a<20?many:b===1?one:b>=2&&b<=4?few:many;};
// Lines for the dialog: the most serious first, nothing when all is well.
export function describeLoad(load,nameOf=id=>id){
  const lines=[];
  const sessions=n=>`${n} ${plural(n,'сеанс','сеанса','сеансов')}`;
  const shown=new Set();
  for(const row of Object.values(load.rows)){
    if(row.status==='ok')continue;
    if(row.cause==='no-instructor')lines.push({status:'lost',text:`«${row.name}»: не отмечен ни один инструктор.`});
    else if(row.cause==='no-pair'){if(!shown.has('pair')){shown.add('pair');lines.push({status:'lost',text:`«${row.name}»: нет общего инструктора для связки.`});}}
    else if(row.status==='late')lines.push({status:'late',text:`«${row.name}»: нужно ${sessions(row.needed)}, до конца дня помещается ${row.fit}. Остальные уйдут позже.`});
    else lines.push({status:'lost',text:`«${row.name}»: нужно ${sessions(row.needed)}, помещается ${row.fitDay}. Не поставится примерно ${row.needed-row.fitDay}.`});
  }
  for(const item of load.instructors){
    if(item.status==='ok')continue;
    const name=nameOf(item.instructorId);
    if(item.status==='late')lines.push({status:'late',text:`${name}: нужно ${sessions(item.needed)} на все процедуры, до конца дня помещается ${item.fit}. Остальные уйдут позже.`});
    else lines.push({status:'lost',text:`${name}: нужно ${sessions(item.needed)} на все процедуры, а до 24:00 помещается ${item.fitDay}. Не поставится примерно ${item.needed-item.fitDay}.`});
  }
  const people=n=>`${n} ${plural(n,'пациента','пациентов','пациентов')}`;
  if(load.patients.lost)lines.push({status:'lost',text:`У ${people(load.patients.lost)} процедуры не помещаются даже до 24:00.`});
  if(load.patients.late)lines.push({status:'late',text:`У ${people(load.patients.late)} процедуры не помещаются в рабочий день.`});
  return lines.sort((a,b)=>(a.status==='lost'?0:1)-(b.status==='lost'?0:1));
}
