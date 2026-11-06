import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,ensureStays,makeDay,clone,setPatientEnabled,isPatientEnabled,visibleColumns,copyScheduleDay,validateProject,validatePlacement,removeSchedule,createStay,switchStay} from '../domain.mjs';
test('new and copied days enable every patient, irrespective of the source day',()=>{const p=ensureStays(newProject()),source=Object.keys(p.days)[0],id=p.patients[0].id;setPatientEnabled(p.days[source],id,false);const target=source==='2026-12-01'?'2026-12-02':'2026-12-01';copyScheduleDay(p,source,target,{appointments:true});assert.ok(isPatientEnabled(p.days[target],id));assert.equal(visibleColumns(p.days[target]).length,p.patients.length);assert.equal(makeDay('2026-12-03',p.patients).disabledPatientIds.length,0);});
test('switching a patient off clears that patient for this day only, locked work included, and on stays empty',()=>{
  const p=ensureStays(newProject()),[date]=Object.keys(p.days),day=p.days[date],id=p.patients[0].id,other=p.patients[1].id;
  const own=day.appointments.filter(a=>a.patientId===id),rest=clone(day.appointments.filter(a=>a.patientId!==id));
  assert.ok(own.length>1);own[0].locked=true;
  const later='2030-01-01';copyScheduleDay(p,date,later,{appointments:true});const copyCount=p.days[later].appointments.filter(a=>a.patientId===id).length;
  setPatientEnabled(day,id,false);
  assert.equal(visibleColumns(day).length,9);assert.deepEqual(day.appointments,rest);
  assert.equal(p.days[later].appointments.filter(a=>a.patientId===id).length,copyCount,'other days keep their work');
  setPatientEnabled(day,id,true);assert.ok(isPatientEnabled(day,id));assert.deepEqual(day.appointments,rest,'switching back on brings nothing back');
  assert.ok(day.appointments.some(a=>a.patientId===other));validateProject(p);
});
test('work hidden by an older version disappears when the patient is switched on, and is not copied',()=>{
  const p=ensureStays(newProject()),[date]=Object.keys(p.days),day=p.days[date],id=p.patients[0].id,count=day.appointments.filter(a=>a.patientId===id).length;
  day.disabledPatientIds=[id];assert.ok(count>0);
  const target='2030-01-01';copyScheduleDay(p,date,target,{appointments:true});
  assert.ok(!p.days[target].appointments.some(a=>a.patientId===id),'hidden work must not reappear in a copy');
  setPatientEnabled(day,id,true);assert.ok(!day.appointments.some(a=>a.patientId===id));validateProject(p);
});
test('per-day participation persists through file round-trip and invalid references are rejected',()=>{let p=ensureStays(newProject());const date=Object.keys(p.days)[0];setPatientEnabled(p.days[date],p.patients[0].id,false);p=JSON.parse(JSON.stringify(p));validateProject(p);assert.equal(visibleColumns(p.days[date]).length,9);p.days[date].disabledPatientIds.push('missing');assert.throws(()=>validateProject(p));});
test('removing inactive schedule preserves current assignments and the global procedure library',()=>{const p=ensureStays(newProject()),first=p.currentStayId,date=Object.keys(p.days)[0],appointments=clone(p.days[date].appointments);createStay(p,'Другое',date);const second=p.currentStayId;switchStay(p,first);removeSchedule(p,second);assert.equal(p.currentStayId,first);assert.deepEqual(p.days[date].appointments,appointments);assert.equal(p.procedures.length,6);validateProject(p);});
test('removing active schedule selects another and leaves its patient roster intact',()=>{const p=ensureStays(newProject()),first=p.currentStayId,date=Object.keys(p.days)[0];createStay(p,'Другое',date);const second=p.currentStayId;removeSchedule(p,second);assert.equal(p.currentStayId,first);assert.equal(p.patients.length,10);validateProject(p);});
test('removing final schedule creates a blank replacement and keeps procedure definitions',()=>{const p=ensureStays(newProject()),old=p.currentStayId,before=clone(p.procedures);removeSchedule(p,old);assert.equal(p.stays.length,1);assert.notEqual(p.currentStayId,old);assert.equal(p.patients.length,0);assert.deepEqual(p.procedures,before);validateProject(p);});
