import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,ensureStays,clone,copyScheduleDay,createStay,switchStay,updateProcedureTemplate,validateProject} from '../domain.mjs';
function fixture(){
  const p=ensureStays(newProject(true)),date=Object.keys(p.days)[0],id=p.procedures[0].id,current=p.currentStayId;
  const otherDate=date==='2026-12-01'?'2026-12-02':'2026-12-01';copyScheduleDay(p,date,otherDate,{appointments:true});
  const example=clone(p.days[date].appointments.find(a=>a.procedureId===id));
  const otherStay=createStay(p,'Другая группа',date,true,date);
  p.days[date].appointments.push({...example,id:'other-stay-appointment',patientId:p.patients[0].id});
  switchStay(p,current);return {p,date,id,otherDate,otherStay};
}
test('unchecked changes only the template, without altering any existing assignments',()=>{
  const {p,date,id}=fixture(),before=clone(p.days);
  const count=updateProcedureTemplate(p,date,id,{name:'Новый массаж',color:'#aabbcc',duration:50});
  assert.equal(count,0);assert.deepEqual(p.days,before);assert.equal(p.procedures[0].duration,50);validateProject(p);
});
test('checked changes only edited properties for all matching assignments in this day, including hidden and cancelled ones',()=>{
  const {p,date,id,otherDate,otherStay}=fixture(),d=p.days[date],a=d.appointments.find(a=>a.procedureId===id);
  a.status='cancelled';a.note='Особое назначение';a.align='right';d.disabledPatientIds=[a.patientId];
  const before=clone(p),matching=d.appointments.filter(a=>a.procedureId===id);
  const count=updateProcedureTemplate(p,date,id,{name:'Массаж рук',color:'#abcdef',textColor:'#123456',duration:45},{applyToDay:true});
  assert.equal(count,matching.length);assert.ok(count>1);
  for(const original of before.days[date].appointments){const updated=d.appointments.find(a=>a.id===original.id);
    assert.deepEqual(updated,original.procedureId===id?{...original,text:'Массаж рук',color:'#abcdef',textColor:'#123456',duration:45}:original);
  }
  assert.deepEqual(p.days[otherDate],before.days[otherDate]);
  assert.deepEqual(p.stays.find(s=>s.id===otherStay),before.stays.find(s=>s.id===otherStay));validateProject(p);
});
test('typography maps template name to appointment text without resetting other settings',()=>{
  const {p,date,id}=fixture(),original=clone(p.days[date].appointments),style={fontFamily:'Arial',fontSize:16,bold:true,italic:true};
  updateProcedureTemplate(p,date,id,{textStyles:{name:style}},{applyToDay:true});
  for(const a of p.days[date].appointments){const before=original.find(x=>x.id===a.id);if(a.procedureId!==id){assert.deepEqual(a,before);continue;}
    assert.deepEqual(a.textStyles.text,style);for(const key of ['fontFamily','fontSize','bold','italic'])assert.equal(a[key],style[key]);
    for(const key of ['text','color','duration','patientId','start','status','note','align'])assert.equal(a[key],before[key]);
  }
  validateProject(p);
});
test('invalid duration propagation is atomic at the calendar boundary and valid extensions expand the canvas',()=>{
  const {p,date,id}=fixture(),d=p.days[date],a=d.appointments.find(a=>a.procedureId===id);a.start=1430;a.duration=10;
  const before=clone(p);assert.throws(()=>updateProcedureTemplate(p,date,id,{duration:45},{applyToDay:true}),/23:59/);assert.deepEqual(p,before);
  a.start=1050;a.duration=10;updateProcedureTemplate(p,date,id,{duration:45},{applyToDay:true});assert.equal(a.start,1050);assert.equal(a.duration,45);assert.ok(d.end>=1095);validateProject(p);
});
