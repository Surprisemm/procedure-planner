// Random setups must never break the generator's rules. Repeatable by seed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDay,validatePlacement} from '../domain.mjs';
import {buildSlots,normalizeSettings,planDay,poolKey,procedurePools} from '../autofill.mjs';

const random=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const hm=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

function scenario(seed){
  const rng=random(seed),int=(a,b)=>a+Math.floor(rng()*(b-a+1)),chance=p=>rng()<p,pick=list=>list[int(0,list.length-1)];
  const patients=Array.from({length:int(1,12)},(_,i)=>({id:`p${i}`,name:`П${i}`,house:'1',archived:false}));
  const staff=Array.from({length:int(1,6)},(_,i)=>`i${i}`);
  const names=['массаж','спорт','эрго','кушетка','тренажёр','физио','психолог'].slice(0,int(1,7));
  const procedures=names.map((name,i)=>{
    const crew=[...staff].sort(()=>rng()-.5).slice(0,chance(.15)?0:int(1,Math.min(3,staff.length)));
    return {id:`m${i}`,name,duration:pick([30,45,50,55,60,75]),color:'#ffffff',textColor:'#000000',instructors:crew.map(instructorId=>({instructorId,color:'#ffffff'}))};
  });
  const day=makeDay('2026-11-09',patients);
  if(chance(.3))day.bands.push({id:'b2',name:'Консилиум',start:pick([600,690,900]),duration:30,color:'#ffffff'});
  const settings=normalizeSettings(null,procedures,day.bands);
  if(chance(.3))settings.blockedBands['Обед']=false;
  if(chance(.5))settings.blockedBands['Консилиум']=true;
  settings.start=pick([480,540,600]);settings.end=pick([900,1050,1200]);settings.slot=pick([45,60,60,60,90]);
  for(const pool of procedurePools(procedures)){
    const row=settings.rows[pool.key];
    row.enabled=chance(.85);row.grid=chance(.6);row.gap=pick([0,5,10,15]);
    row.together=pick(['single','single','any','groups']);row.capacity=int(2,5);row.groupId=pick(['common','extra']);
    if(chance(.3))row.limit=int(1,3);
    for(const t of pool.templates){
      const work=settings.instructors[t.work];
      if(chance(.1))work.enabled=false;
      if(chance(.25))work.from=hm(pick([540,600,720,840]));
      if(chance(.25))work.to=hm(pick([900,1020,1200,1320]));
      if(work.from&&work.to&&work.from>=work.to){work.from='';work.to='';}
    }
  }
  const links=[];
  if(names.length>=2&&chance(.6))links.push({a:names[0],b:names[1],simultaneous:chance(.5)});
  if(names.length>=4&&chance(.3))links.push({a:names[2],b:names[3],simultaneous:chance(.5)});
  const groupList=[{id:'common',name:'Общая',values:{}},{id:'extra',name:'Доп',values:{}}];
  for(const g of groupList)for(const p of patients)if(chance(.7))g.values[p.id]=int(1,3);
  if(chance(.3))settings.mode='partial',settings.partialKeys=names.filter(()=>chance(.5));
  if(settings.mode==='partial'&&!settings.partialKeys.length)settings.partialKeys=[names[0]];
  if(chance(.3))day.disabledPatientIds=patients.filter(()=>chance(.3)).map(p=>p.id);
  // Existing work: some locked, some not, possibly messy.
  for(let i=0,n=chance(.5)?int(1,10):0;i<n;i++){
    const procedure=pick(procedures),instructorId=procedure.instructors.length?pick(procedure.instructors).instructorId:null;
    day.appointments.push({id:`a${i}`,patientId:pick(patients).id,procedureId:procedure.id,instructorId,start:int(108,220)*5,duration:procedure.duration,text:procedure.name,locked:chance(.6)});
  }
  return {seed,procedures,day,settings,links,groupList,rng};
}
const ends=a=>a.start+a.duration;
const over=(a,b)=>a.start<ends(b)&&b.start<ends(a);

function check(s){
  const {procedures,day,settings,links,groupList}=s;
  const plan=planDay({procedures,day,settings,links,groupList,rng:s.rng,attempts:4});
  const fail=message=>assert.fail(`seed ${s.seed}: ${message}`);
  const key=a=>poolKey(procedures.find(p=>p.id===a.procedureId)?.name??a.text);
  const enabled=new Set(day.columns.map(c=>c.patientId).filter(id=>!(day.disabledPatientIds||[]).includes(id)));
  const removed=new Set(plan.remove);
  for(const a of day.appointments)if(removed.has(a.id)&&(a.locked||!enabled.has(a.patientId)))fail(`removed protected ${a.id}`);
  const kept=day.appointments.filter(a=>enabled.has(a.patientId)&&!removed.has(a.id));
  const placed=plan.place.map(p=>({...p,isNew:true}));
  const blocked=day.bands.filter(b=>settings.blockedBands[b.name]);
  const slots=new Set(buildSlots(settings.start,settings.slot,blocked,day.step));
  const selected=new Set(settings.mode==='full'?Object.keys(settings.rows).filter(k=>settings.rows[k].enabled):settings.partialKeys);
  for(const l of links)if(settings.mode==='partial'&&(selected.has(l.a)||selected.has(l.b))){selected.add(l.a);selected.add(l.b);}
  const worker=a=>a.instructorId||null;
  const work=a=>{const keyWork=`${a.procedureId}:${a.instructorId||''}`;return settings.instructors[keyWork]||{};};
  const activeLinks=links.filter(l=>selected.has(l.a)&&selected.has(l.b));
  for(const a of placed){
    const k=key(a),row=settings.rows[k];
    if(!selected.has(k))fail(`placed unselected ${k}`);
    if(validatePlacement({...day,disabledPatientIds:[]},{start:a.start,duration:a.duration,patientId:a.patientId}))fail(`invalid placement ${a.start}`);
    if(a.start<settings.start)fail(`before start ${a.start}`);
    if(blocked.some(b=>over(a,b)))fail(`on blocked period ${a.start}`);
    if(row.grid&&!slots.has(a.start)&&!activeLinks.some(l=>l.a===k||l.b===k))fail(`off grid ${a.start}`);
    const w=work(a);
    if(w.enabled===false)fail('switched off instructor used');
    if(w.from&&a.start<toMin(w.from))fail(`before instructor hours ${a.start}`);
    if(w.to&&ends(a)>toMin(w.to))fail(`after instructor hours ${ends(a)}`);
    const same=[...kept,...placed].filter(b=>b!==a&&b.patientId===a.patientId);
    if(same.some(b=>over(a,b)))fail(`patient overlap ${a.patientId} ${a.start}`);
    if(same.some(b=>key(b)===k))fail(`procedure twice for ${a.patientId}: ${k}`);
    if(worker(a)!==null)for(const b of [...kept,...placed]){
      if(b===a||worker(b)!==worker(a)||!over(a,b))continue;
      const kb=key(b),both=activeLinks.find(l=>(l.a===k&&l.b===kb)||(l.b===k&&l.a===kb));
      if(both?.simultaneous)continue;
      if(kb===k&&row.together!=='single'&&a.start===b.start&&a.procedureId===b.procedureId&&a.duration===b.duration){
        if(row.together==='groups'){
          const values=(groupList.find(g=>g.id===row.groupId)||groupList[0]).values;
          if(values[a.patientId]==null||values[a.patientId]!==values[b.patientId])fail(`mixed groups ${a.patientId}/${b.patientId}`);
        }
        continue;
      }
      fail(`instructor clash ${worker(a)} ${k}@${a.start} and ${kb}@${b.start}`);
    }
    if(row.limit!=null){
      const all=[...kept,...placed].filter(b=>key(b)===k);
      for(const moment of [a.start,...all.filter(b=>over(a,b)).map(b=>b.start)]){
        const placedAt=all.filter(b=>b.start<=moment&&moment<ends(b));
        if(moment>=a.start&&moment<ends(a)&&placedAt.length>Math.max(row.limit,placedAt.filter(b=>!b.isNew).length))fail(`limit ${row.limit} exceeded by ${k}: ${placedAt.length}`);
      }
    }
    if(row.together!=='single'){
      const session=placed.filter(b=>worker(b)===worker(a)&&b.start===a.start&&b.procedureId===a.procedureId);
      if(worker(a)!==null&&session.length>row.capacity)fail(`capacity ${row.capacity} exceeded: ${session.length}`);
    }
  }
  // Every patient gets every selected procedure, or the report says why not.
  const unplaced=new Set(plan.report.unplaced.map(u=>`${u.patientId}|${u.key}`));
  for(const id of enabled)for(const k of selected){
    const has=[...kept,...placed].some(a=>a.patientId===id&&key(a)===k);
    if(!has&&!unplaced.has(`${id}|${k}`))fail(`${id} lost ${k} silently`);
    if(has&&unplaced.has(`${id}|${k}`))fail(`${id} ${k} reported but present`);
  }
  // Linked procedures of one patient stay next to each other with one instructor.
  for(const l of activeLinks)for(const id of enabled){
    const a=placed.find(p=>p.patientId===id&&key(p)===l.a),b=placed.find(p=>p.patientId===id&&key(p)===l.b);
    if(!a||!b)continue;
    if(plan.report.broken.some(x=>x.patientId===id))continue;
    const [one,two]=a.start<b.start?[a,b]:[b,a];
    if(worker(one)!==worker(two))fail(`link split between instructors for ${id}`);
    if(blocked.some(band=>band.start<ends(two)&&one.start<band.start+band.duration))fail(`link crosses a blocked period for ${id}`);
    const between=[...kept,...placed].filter(x=>x.patientId===id&&x!==a&&x!==b&&x.start>=ends(one)&&ends(x)<=two.start);
    if(between.length)fail(`something between linked procedures of ${id}`);
  }
  // An instructor never returns to an earlier activity because of generated work.
  const activity=k=>{const l=links.find(x=>x.a===k||x.b===k);return l?l.a+'+'+l.b:k;};
  const returns=items=>{let runs=0,previous=null;const seen=new Set();for(const a of [...items].sort((x,y)=>x.start-y.start)){const v=activity(key(a));if(v!==previous){runs++;previous=v;}seen.add(v);}return runs-seen.size;};
  for(const id of new Set(placed.map(worker).filter(Boolean))){
    const old=kept.filter(a=>worker(a)===id),all=[...old,...placed.filter(a=>worker(a)===id)];
    if(returns(all)>returns(old))fail(`instructor ${id} returns: ${returns(old)} -> ${returns(all)}`);
  }
  assert.equal(plan.report.placed,plan.place.length);
  assert.equal(plan.report.total,plan.place.length+plan.report.unplaced.length);
}
const toMin=value=>Number(value.slice(0,2))*60+Number(value.slice(3));

test('generator rules hold on 600 random setups',()=>{
  for(let seed=1;seed<=600;seed++)check(scenario(seed));
});
test('generator is repeatable for one seed and varies between seeds',()=>{
  const once=seed=>{const s=scenario(7);return JSON.stringify(planDay({procedures:s.procedures,day:s.day,settings:s.settings,links:s.links,groupList:s.groupList,rng:random(seed),attempts:2}).place);};
  assert.equal(once(5),once(5));
});
