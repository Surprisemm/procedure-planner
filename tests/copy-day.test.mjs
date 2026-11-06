import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,ensureStays,makeDay,clone,copyScheduleDay,setPatientEnabled,validateProject,addCalendarDays} from '../domain.mjs';

test('full copy replaces a prepared day without duplicating records and preserves target participation',()=>{
  const p=ensureStays(newProject()),source=Object.keys(p.days)[0],target=addCalendarDays(source,7),id=p.patients[0].id;
  const origin=p.days[source];origin.end=1020;origin.columns[0].headerColor='#f7df88';origin.bands.push({id:'consultation',name:'Консилиум',start:735,duration:30,color:'#edf0f3'});
  origin.cells.push({id:'area',patientId:id,start:720,duration:10,color:'#f7df88',text:'Заметка'});setPatientEnabled(origin,p.patients[1].id,false);
  p.days[target]=makeDay(target,p.patients);setPatientEnabled(p.days[target],id,false);p.days[target].appointments=[{...clone(origin.appointments[0]),id:'old-target'}];
  const before=clone(origin);const result=copyScheduleDay(p,source,target,{appointments:true,replace:true});
  assert.deepEqual(p.days[source],before);assert.equal(result.date,target);assert.equal(result.end,1020);assert.equal(result.appointments.length,origin.appointments.filter(a=>a.patientId!==id).length,'a patient switched off in the target stays empty');assert.ok(!result.appointments.some(a=>a.patientId===id));assert.ok(!result.appointments.some(a=>a.id==='old-target'));
  assert.deepEqual(result.disabledPatientIds,[id]);assert.equal(result.columns[0].headerColor,'#f7df88');assert.equal(result.bands.length,2);assert.equal(result.cells[0].text,'Заметка');
  for(const key of ['appointments','bands','cells'])assert.ok(result[key].every(a=>!origin[key].some(b=>b.id===a.id)));
  result.appointments[0].duration=30;result.bands[0].start=785;result.cells[0].text='Изменено';assert.deepEqual(origin,before);validateProject(p);
});
test('copy into an existing empty arrival day works and new day enables everyone',()=>{
  const p=ensureStays(newProject()),source=Object.keys(p.days)[0],target=addCalendarDays(source,7);setPatientEnabled(p.days[source],p.patients[0].id,false);
  p.days[target]=makeDay(target,p.patients);copyScheduleDay(p,source,target,{appointments:true,replace:true});assert.equal(p.days[target].disabledPatientIds.length,0);
  const next=addCalendarDays(source,14);copyScheduleDay(p,source,next,{appointments:true});assert.equal(p.days[next].disabledPatientIds.length,0);validateProject(JSON.parse(JSON.stringify(p)));
});
test('copy rejects same day, invalid date, missing source and unapproved replacement without mutation',()=>{
  const p=ensureStays(newProject()),source=Object.keys(p.days)[0],before=clone(p);
  assert.throws(()=>copyScheduleDay(p,source,source,{appointments:true,replace:true}));assert.throws(()=>copyScheduleDay(p,source,'2026-02-30',{replace:true}));assert.throws(()=>copyScheduleDay(p,'2020-01-01',source,{replace:true}));assert.deepEqual(p,before);
  const target=addCalendarDays(source,7);p.days[target]=makeDay(target,p.patients);const existing=clone(p.days[target]);assert.throws(()=>copyScheduleDay(p,source,target,{appointments:true}));assert.deepEqual(p.days[target],existing);
});
