// Explicit developer checks, loaded only with --smoke-test.
const fs=require('node:fs');
const path=require('node:path');
module.exports=async function runSmoke({app,window:mainWindow,smokeDir,root:ROOT}){
  if(process.argv.includes('--capture-tutorial')){await require('../scripts/capture-tutorial.cjs')({window:mainWindow,root:ROOT});app.exit(0);return;}
  const result=await mainWindow.webContents.executeJavaScript(`(async()=>{
    const assert=(v,m)=>{if(!v)throw Error(m)};
    for(let i=0;i<100&&!document.querySelector('.app-shell');i++)await new Promise(r=>setTimeout(r,30));
    assert(!!document.querySelector('.app-shell'),'Editor did not load');
    assert(typeof window.ritmDesktop?.storage?.save==='function','Desktop bridge missing');
    assert(typeof window.require==='undefined','Node exposed to renderer');
    const {newProject,localDate}=await import('./domain.mjs');
    const p=newProject(false);p.desktopSmokeMarker='native-persistence';
    assert(window.ritmDesktop.storage.save(JSON.stringify(p)).ok,'Native autosave failed');
    assert(JSON.parse(window.ritmDesktop.storage.load().data).desktopSmokeMarker==='native-persistence','Autosave round-trip failed');
    const {renderScheduleImage}=await import('./export.mjs');
    const canvas=renderScheduleImage(Object.values(newProject(true).days)[0]);
    assert(canvas.width>1000&&canvas.toDataURL('image/png').startsWith('data:image/png'),'PNG rendering failed');
    if(${process.argv.includes('--smoke-empty')}){
      document.querySelector('[data-action="new-project"]').click();
      document.querySelector('[data-action="confirm-modal"]').click();
      const frame=document.querySelector('.schedule-scroll').getBoundingClientRect();
      const empty=document.querySelector('.empty-schedule');
      assert(empty&&!document.querySelector('.schedule-table'),'Empty project should show onboarding instead of a narrow table');
      const card=empty.getBoundingClientRect();
      assert(card.width>=frame.width-18&&card.left>=frame.left,'Empty state must fill the workspace');
      const title=empty.querySelector('h2').getBoundingClientRect();
      assert(title.left>=frame.left&&title.right<=frame.right,'Empty state heading is clipped');
      const state=JSON.parse(window.ritmDesktop.storage.load().data);
      const bands=Object.values(state.days)[0].bands;
      assert(bands.length===1&&bands[0].name==='Обед'&&bands[0].start===780&&bands[0].duration===30,'New project must have only lunch from 13:00 to 13:30');
      empty.querySelector('[data-action="add-patient"]').click();
      const form=document.querySelector('#add-patient-form');
      assert(!!form,'Empty state add button does not open patient form');
      form.querySelector('[name="name"]').value='Проверочный пациент';
      form.querySelector('[name="house"]').value='12А';
      form.requestSubmit();
      assert(document.querySelectorAll('.column-header').length===1&&!document.querySelector('.empty-schedule'),'Adding a patient must show the grid');
      const lunch=document.querySelector('.gutter-band');
      assert(lunch&&lunch.textContent.includes('13:00–13:30'),'Lunch time on grid is incorrect');
      document.querySelector('[data-action="delete-selection"]').click();
      document.querySelector('[data-action="confirm-modal"]').click();
      assert(!!document.querySelector('.empty-schedule'),'Removing last patient must restore the empty state');
    }
    if(${process.argv.includes('--smoke-stays')}){
      const originalId=document.querySelector('.schedule-picker-item.active [data-action="choose-schedule"]').dataset.id;
      const initialTabs=document.querySelectorAll('.day-tab[data-date]').length;
      document.querySelector('[data-action="new-day"]').click();
      let form=document.querySelector('#day-form');form.querySelector('[name="mode"]').value='full';form.requestSubmit();
      assert(document.querySelectorAll('.day-tab[data-date]').length===initialTabs+1,'Day tab was not added');
      assert(document.querySelectorAll('[data-appointment]').length>0,'Day appointments were not copied');
      const band=document.querySelector('[data-band]');
      band.click();assert(document.querySelector('.inspector').textContent.includes('Общий период'),'Band does not select inspector');
      const bandBefore=JSON.parse(window.ritmDesktop.storage.load().data).days[document.querySelector('#date-picker').value].bands[0].start;
      band.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:400,clientY:400}));
      document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:400,clientY:500}));
      document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:400,clientY:500}));
      assert(document.querySelector('#drag-preview').hidden,'Band initiated drag');
      assert(JSON.parse(window.ritmDesktop.storage.load().data).days[document.querySelector('#date-picker').value].bands[0].start===bandBefore,'Band moved');
      assert(document.querySelectorAll('.time-label.hour').length>0&&document.querySelector('.hour-gridline'),'Hour boundaries missing');
      document.querySelector('[data-action="new-stay"]').click();form=document.querySelector('#stay-form');form.querySelector('[name="name"]').value='Ноябрь · второй заезд';form.requestSubmit();
      assert(document.querySelectorAll('.column-header').length===0,'Patient roster leaked into new stay');
      document.querySelector('[data-action="choose-schedule"][data-id="'+originalId+'"]').click();
      assert(document.querySelectorAll('.column-header').length===10,'Original stay was lost');
      document.querySelector('[data-appointment]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:400,clientY:350}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
      document.querySelector('[data-action="transfer-appointment"]').click();form=document.querySelector('#transfer-form');form.querySelector('[name="mode"]').value='move';form.requestSubmit();
      assert(document.querySelectorAll('.day-tab[data-date]').length===initialTabs+2,'Transfer destination day missing');
      assert(document.querySelectorAll('[data-appointment]').length===1,'Appointment transfer failed');
    }
    if(${process.argv.includes('--smoke-roster')}){
      const originalId=document.querySelector('.schedule-picker-item.active [data-action="choose-schedule"]').dataset.id;
      document.querySelector('[data-action="new-day"]').click();let form=document.querySelector('#day-form');form.requestSubmit();
      document.querySelector('.side-title [data-action="add-patient"]').click();form=document.querySelector('#add-patient-form');form.querySelector('[name="name"]').value='Пациент во всех днях';form.querySelector('[name="house"]').value='7';form.requestSubmit();
      let state=JSON.parse(window.ritmDesktop.storage.load().data);const patient=state.patients.find(p=>p.name==='Пациент во всех днях');
      assert(Object.values(state.days).every(d=>d.columns.some(c=>c.patientId===patient.id)),'Added patient missing in another day');
      const house=document.querySelector('[data-field="house"]');house.value='12А';house.dispatchEvent(new Event('change',{bubbles:true}));
      state=JSON.parse(window.ritmDesktop.storage.load().data);assert(Object.values(state.days).every(d=>d.columns.find(c=>c.patientId===patient.id).house==='12А'),'House is not shared');
      document.querySelector('[data-action="batch-patients"]').click();form=document.querySelector('#batch-form');form.querySelector('textarea').value='Анна; 3\\nБорис; 4';form.requestSubmit();
      state=JSON.parse(window.ritmDesktop.storage.load().data);assert(Object.values(state.days).every(d=>d.columns.length===13),'Batch roster not shared');
      document.querySelector('[data-action="new-stay"]').click();form=document.querySelector('#stay-form');form.querySelector('[name="name"]').value='Расписание второй группы';form.requestSubmit();assert(document.querySelectorAll('.column-header').length===0,'Schedule roster is not isolated');
      document.querySelector('[data-action="choose-schedule"][data-id="'+originalId+'"]').click();assert(document.querySelectorAll('.column-header').length===13,'Original roster lost');
      const inspectorBefore=document.querySelector('.inspector').textContent;document.querySelector('[data-action="remove-patient"][data-id="'+patient.id+'"]').click();assert(document.querySelector('.inspector').textContent===inspectorBefore,'Trash button unexpectedly selected patient');assert(document.querySelector('#modal').textContent.includes(patient.name),'Wrong patient in deletion dialog');document.querySelector('#modal .modal-footer [data-action="close-modal"]').click();assert(document.querySelectorAll('.column-header').length===13,'Cancel removed a patient');document.querySelector('[data-action="remove-patient"][data-id="'+patient.id+'"]').click();document.querySelector('[data-action="confirm-modal"]').click();
      state=JSON.parse(window.ritmDesktop.storage.load().data);assert(Object.values(state.days).every(d=>d.columns.length===12&&!d.columns.some(c=>c.patientId===patient.id)),'Deletion not shared across days');
      document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));state=JSON.parse(window.ritmDesktop.storage.load().data);assert(Object.values(state.days).every(d=>d.columns.length===13),'Undo did not restore shared roster');
    }
    if(${process.argv.includes('--smoke-participation')}){
      const originalId=document.querySelector('.schedule-picker-item.active [data-action="choose-schedule"]').dataset.id;
      const first=document.querySelector('.patient-day-toggle'),id=first.dataset.patientToggle;
      assert(document.querySelectorAll('.patient-day-toggle:checked').length===10,'New day must enable everyone');
      const count=document.querySelectorAll('[data-appointment]').length;first.click();
      assert(document.querySelectorAll('.column-header').length===9&&document.querySelectorAll('.patient-day-toggle').length===10,'Checkbox should hide only the column');
      let state=JSON.parse(window.ritmDesktop.storage.load().data),date=document.querySelector('#date-picker').value;
      assert(state.days[date].appointments.length===count,'Turning off deleted assignments');
      const hiddenWidth=renderScheduleImage(state.days[date]).width;
      assert(renderScheduleImage({...state.days[date],disabledPatientIds:[]}).width-hiddenWidth===288,'PNG includes disabled patient');
      document.querySelector('[data-action="new-day"]').click();document.querySelector('#day-form').requestSubmit();
      assert(document.querySelectorAll('.patient-day-toggle:checked').length===10&&document.querySelectorAll('.column-header').length===10,'New copied day inherited disabled state');
      document.querySelector('[data-action="goto-day"][data-date="'+date+'"]').click();
      assert(!document.querySelector('[data-patient-toggle="'+id+'"]').checked,'Day-specific toggle was not preserved');
      document.querySelector('[data-patient-toggle="'+id+'"]').click();assert(document.querySelectorAll('[data-appointment]').length===count,'Re-enabling did not restore assignments');
      for(let i=0;i<10;i++)document.querySelectorAll('.patient-day-toggle')[i].click();
      assert(document.querySelector('.empty-schedule').textContent.includes('Выберите пациентов'),'All-off state is incorrect');
      document.querySelector('[data-action="enable-all-patients"]').click();assert(document.querySelectorAll('.column-header').length===10,'Enable all failed');
      document.querySelector('[data-action="new-stay"]').click();let form=document.querySelector('#stay-form');form.querySelector('[name="name"]').value='Второе расписание';form.requestSubmit();
      const otherId=document.querySelector('.schedule-picker-item.active [data-action="choose-schedule"]').dataset.id;
      document.querySelector('[data-action="choose-schedule"][data-id="'+originalId+'"]').click();
      document.querySelector('[data-action="remove-schedule"][data-id="'+otherId+'"]').click();document.querySelector('#modal .modal-footer [data-action="close-modal"]').click();
      assert(document.querySelectorAll('.schedule-picker-item').length===2,'Cancel deleted schedule');
      document.querySelector('[data-action="remove-schedule"][data-id="'+otherId+'"]').click();document.querySelector('[data-action="confirm-modal"]').click();
      assert(document.querySelectorAll('.schedule-picker-item').length===1&&document.querySelectorAll('.column-header').length===10,'Wrong schedule was removed');
      document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));assert(document.querySelectorAll('.schedule-picker-item').length===2,'Undo schedule deletion failed');
      document.querySelector('[data-patient-toggle="'+id+'"]').click();
    }
    if(${process.argv.includes('--smoke-visual-bands')}){
      document.querySelector('.gutter-band').click();
      assert(!document.querySelector('[data-field="rule"]'),'Band modes still present in inspector');
      document.querySelector('[data-action="day-settings"]').click();document.querySelector('.inspector [data-action="add-band"]').click();assert(!document.querySelector('#modal [name="rule"]'),'Band creation still asks for a mode');document.querySelector('#modal .modal-footer [data-action="close-modal"]').click();
      const card=document.querySelector('[data-procedure]');card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:300,clientY:700}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
      document.querySelector('[data-action="place-procedure"]').click();const form=document.querySelector('#place-form');form.querySelector('[name="start"]').value='13:00';form.requestSubmit();
      assert(!document.querySelector('#modal').open,'Cannot place procedure over lunch');
      assert(!document.querySelector('.inspector .issue-box'),'Visual band produced a warning');
      const state=JSON.parse(window.ritmDesktop.storage.load().data),date=document.querySelector('#date-picker').value,d=state.days[date];
      const scroll=document.querySelector('.schedule-scroll');scroll.scrollTop=(780-d.start)*1.4-50;scroll.scrollLeft=180;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const gutter=document.querySelector('.time-axis').getBoundingClientRect(),label=document.querySelector('.gutter-band'),rect=label.getBoundingClientRect();
      assert(rect.left>=gutter.left&&rect.right<=gutter.right+1,'Band label extends into patient column');
      assert(label.textContent.includes('13:00–13:30')&&label.textContent.includes('Обед'),'Band label missing title or time');
      const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);assert(hit.closest('.gutter-band')===label,'Band label covered by procedure or horizontal scroll');
      const canvas=renderScheduleImage(d),pixel=canvas.getContext('2d').getImageData(4,Math.round((148+(780-d.start)*1.6+2)*2),1,1).data;
      assert(pixel[0]===237&&pixel[1]===240&&pixel[2]===243,'PNG band does not cover time gutter');scroll.scrollLeft=0;document.querySelector('.gutter-band').click();await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    if(${process.argv.includes('--smoke-default-duration')}){
      const originalDate=document.querySelector('#date-picker').value,saturday=originalDate==='2026-11-07'?'2026-11-14':'2026-11-07';
      document.querySelector('[data-action="new-day"]').click();let form=document.querySelector('#day-form');form.querySelector('[name="date"]').value=saturday;form.querySelector('[name="mode"]').value='empty';form.requestSubmit();
      const chooseProcedure=()=>{const card=document.querySelector('[data-procedure]');card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:300,clientY:700}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));};
      chooseProcedure();assert(document.querySelector('[data-field="duration"]').value==='55','Saturday procedure default is not 55');assert(!document.querySelector('[data-field="saturdayDuration"]'),'Saturday exception still present');
      document.querySelector('[data-action="place-procedure"]').click();document.querySelector('#place-form').requestSubmit();
      let state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[saturday].appointments[0].duration===55,'Saturday appointment did not use 55 minutes');
      chooseProcedure();const duration=document.querySelector('[data-field="duration"]');duration.value='40';duration.dispatchEvent(new Event('change',{bubbles:true}));
      document.querySelector('[data-action="place-procedure"]').click();form=document.querySelector('#place-form');form.querySelector('[name="start"]').value='10:00';form.requestSubmit();
      state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[saturday].appointments[0].duration===55&&state.days[saturday].appointments[1].duration===40,'Changing default changed existing appointment or missed new block');
      document.querySelector('[data-action="goto-day"][data-date="'+originalDate+'"]').click();chooseProcedure();assert(document.querySelector('[data-field="duration"]').value==='40','Procedure duration changed with weekday');
      document.querySelector('[data-action="select-patient"]').click();
      const header=document.querySelector('[data-field="headerColor"]').closest('label'),body=document.querySelector('[data-field="color"]').closest('label');
      assert(header.nextElementSibling.classList.contains('palette'),'Header palette is not directly below its color picker');assert(header.nextElementSibling.compareDocumentPosition(body)&Node.DOCUMENT_POSITION_FOLLOWING,'Body color is above the header palette');chooseProcedure();const resetDuration=document.querySelector('[data-field="duration"]');resetDuration.value='55';resetDuration.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-action="select-patient"]').click();
    }
    if(${process.argv.includes('--smoke-stay-dates')}){
      const originalId=document.querySelector('.schedule-picker-item.active [data-action="choose-schedule"]').dataset.id;
      document.querySelector('[data-action="new-stay"]').click();let form=document.querySelector('#stay-form');
      form.querySelector('[name="name"]').value='Заезд · 28 дней';const start=form.querySelector('[name="date"]'),end=form.querySelector('[name="endDate"]');start.value='2026-11-05';start.dispatchEvent(new Event('change'));
      assert(end.value==='2026-12-02'&&document.querySelector('#stay-duration').textContent.includes('28 календарных дней'),'Default range is not 28 inclusive days');
      form.querySelector('[name="patients"]').checked=true;form.requestSubmit();assert(!document.querySelector('#modal').open,'Schedule creation failed');
      let state=JSON.parse(window.ritmDesktop.storage.load().data),id=state.currentStayId;assert(Object.keys(state.days).length===28&&document.querySelectorAll('.day-tab[data-date]').length===28,'Not all calendar days were created');
      assert(Object.values(state.days).every(d=>d.columns.length===10&&d.disabledPatientIds.length===0&&d.bands.length===1&&d.bands[0].start===780),'Daily roster or lunch missing');
      assert(document.querySelector('.schedule-picker-item.active').textContent.includes('02.12.2026'),'Range missing from schedule list');
      document.querySelector('[data-action="choose-schedule"][data-id="'+originalId+'"]').click();document.querySelector('[data-action="choose-schedule"][data-id="'+id+'"]').click();
      assert(document.querySelector('#date-picker').value==='2026-11-05'&&document.querySelectorAll('.day-tab[data-date]').length===28,'Range lost when switching schedules');
      document.querySelector('[data-action="new-stay"]').click();form=document.querySelector('#stay-form');form.querySelector('[name="name"]').value='Короткий заезд';form.querySelector('[name="date"]').value='2026-12-30';form.querySelector('[name="date"]').dispatchEvent(new Event('change'));form.querySelector('[name="endDate"]').value='2027-01-02';form.querySelector('[name="endDate"]').dispatchEvent(new Event('input'));assert(document.querySelector('#stay-duration').textContent.includes('4 календарных дня'),'Custom count incorrect');form.requestSubmit();
      state=JSON.parse(window.ritmDesktop.storage.load().data);assert(Object.keys(state.days).length===4&&state.days['2027-01-02'],'Custom range ignored');
      document.querySelector('[data-action="new-stay"]').click();form=document.querySelector('#stay-form');form.querySelector('[name="name"]').value='Следующий заезд';
    }
    if(${process.argv.includes('--smoke-copy-day')}){
      assert(!document.querySelector('.toolbar [data-action="undo"]')&&!document.querySelector('.toolbar [data-action="redo"]'),'Undo/redo controls still visible');
      const {addCalendarDays}=await import('./domain.mjs');const source=document.querySelector('#date-picker').value,target=addCalendarDays(source,7),fresh=addCalendarDays(source,14);
      document.querySelector('[data-action="new-day"]').click();let form=document.querySelector('#day-form');form.querySelector('[name="date"]').value=target;form.querySelector('[name="mode"]').value='empty';form.requestSubmit();
      const firstId=document.querySelector('.patient-day-toggle').dataset.patientToggle;document.querySelector('.patient-day-toggle').click();
      document.querySelector('[data-action="goto-day"][data-date="'+source+'"]').click();
      document.querySelector('[data-action="copy-day"]').click();form=document.querySelector('#copy-day-form');assert(form.querySelector('[name="source"]').value===source&&form.querySelector('[name="date"]').value===target,'Weekly copy defaults incorrect');
      assert(form.querySelector('#copy-warning').hidden,'Empty day unnecessarily needs replacement confirmation');form.requestSubmit();assert(!document.querySelector('#modal').open,'Copy into prepared day failed');
      let state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[target].appointments.length===state.days[source].appointments.length,'Appointments did not copy');assert(state.days[target].disabledPatientIds.includes(firstId),'Target patient participation changed');
      const originalTarget=JSON.stringify(state.days[target]),originalSource=JSON.stringify(state.days[source]);
      document.querySelector('[data-action="copy-day"]').click();form=document.querySelector('#copy-day-form');form.querySelector('[name="source"]').value=source;form.querySelector('[name="source"]').dispatchEvent(new Event('change'));form.querySelector('[name="date"]').value=target;form.querySelector('[name="date"]').dispatchEvent(new Event('change'));
      assert(!form.querySelector('#copy-warning').hidden&&document.querySelector('#modal [type="submit"]').disabled,'Filled day lacks confirmation');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert(document.querySelector('#modal').open,'Unconfirmed copy ran');assert(JSON.stringify(JSON.parse(window.ritmDesktop.storage.load().data).days[target])===originalTarget,'Blocked copy mutated target');
      form.querySelector('[name="replace"]').click();form.requestSubmit();state=JSON.parse(window.ritmDesktop.storage.load().data);assert(JSON.stringify(state.days[source])===originalSource,'Source day changed');assert(state.days[target].appointments.length===state.days[source].appointments.length,'Copy duplicated existing appointments');
      document.querySelector('#date-picker').focus();document.querySelector('#date-picker').blur();document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,code:'KeyZ'}));state=JSON.parse(window.ritmDesktop.storage.load().data);assert(JSON.stringify(state.days[target])===originalTarget,'Ctrl+Z did not restore destination');
      document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,ctrlKey:true,shiftKey:true,code:'KeyZ'}));state=JSON.parse(window.ritmDesktop.storage.load().data);assert(JSON.stringify(state.days[target])!==originalTarget,'Ctrl+Shift+Z did not redo copy');
      document.querySelector('[data-action="copy-day"]').click();form=document.querySelector('#copy-day-form');form.querySelector('[name="source"]').value=source;form.querySelector('[name="date"]').value=fresh;form.querySelector('[name="date"]').dispatchEvent(new Event('change'));form.requestSubmit();state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[fresh].disabledPatientIds.length===0&&state.days[fresh].appointments.length===state.days[source].appointments.length,'New destination not copied or patients not enabled');
      document.querySelector('[data-action="copy-day"]').click();form=document.querySelector('#copy-day-form');form.querySelector('[name="source"]').value=source;form.querySelector('[name="date"]').value=source;form.querySelector('[name="date"]').dispatchEvent(new Event('change'));assert(document.querySelector('#modal [type="submit"]').disabled&&form.querySelector('#modal-error').textContent,'Same-day copy accepted');
      form.querySelector('#copy-next-week').click();assert(form.querySelector('[name="date"]').value===target,'Next week shortcut failed');
    }
    if(${process.argv.includes('--smoke-chrome')}){
      assert(!document.querySelector('.brand,.save-status,.side-footnote,.library .hint,.library [data-action="add-band"]'),'Removed labels or controls still present');
      const header=document.querySelector('.app-top');assert(header.getBoundingClientRect().top===0&&header.getBoundingClientRect().height===56,'Header is not flush with top');
      assert(header.querySelector('.window-title').textContent==='Расписание процедур'&&!header.textContent.includes('ПЛАНИРОВЩИК'),'Neutral window title missing');
      assert(getComputedStyle(header).getPropertyValue('-webkit-app-region')==='drag','Header is not draggable');assert(getComputedStyle(header.querySelector('button')).getPropertyValue('-webkit-app-region')==='no-drag','Header buttons cannot be clicked');
      assert(document.querySelectorAll('[data-window-command]').length===3,'Window controls missing');const controls=document.querySelector('.window-controls').getBoundingClientRect(),actions=document.querySelector('.top-actions').getBoundingClientRect();assert(actions.right<=controls.left,'File actions overlap window controls');
      let toggle=document.querySelector('.library [data-action="toggle-library"]');assert(toggle.nextElementSibling.tagName==='H2'&&toggle.getAttribute('aria-expanded')==='true','Toggle is not before library heading');assert(toggle.querySelector('path').getAttribute('d')==='m6 9 6 6 6-6','Expanded library chevron should point down');toggle.click();
      toggle=document.querySelector('.library [data-action="toggle-library"]');assert(document.querySelector('.library.collapsed')&&!document.querySelector('.procedure-list'),'Library did not collapse');assert(toggle.getAttribute('aria-expanded')==='false'&&toggle.querySelector('path').getAttribute('d')==='m6 15 6-6 6 6','Collapsed library chevron should point up');toggle.click();
      assert(document.querySelectorAll('.procedure-card').length===6,'Library did not reopen');document.querySelector('[data-action="day-settings"]').click();assert(document.querySelector('.inspector [data-action="add-band"]'),'Inspector period creation missing');
    }
    if(${process.argv.includes('--smoke-time-picker')}){
      assert(!document.querySelector('input[type="time"]'),'Native cyclic time input still present');
      document.querySelector('.gutter-band').click();let input=document.querySelector('[data-field="start"]');assert(input.type==='text'&&input.value==='13:00','Inspector time input missing');
      input.closest('.time-control').querySelector('.time-trigger').click();let popup=document.querySelector('.time-popup:popover-open');assert(popup,'Time picker did not open');
      const hours=popup.querySelector('[data-part="hour"]'),minutes=popup.querySelector('[data-part="minute"]');assert(hours.children.length===24&&minutes.children.length===60,'Time ranges are not finite');
      for(const list of [hours,minutes]){
        list.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'End'}));list.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowDown'}));assert(list.querySelector('[aria-selected="true"]')===list.lastElementChild,'End wraps to beginning');
        list.scrollTop=100000;const bottom=list.scrollTop;list.scrollTop+=1000;assert(list.scrollTop===bottom,'Scroll exceeds last entry');
        list.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Home'}));list.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowUp'}));assert(list.querySelector('[aria-selected="true"]')===list.firstElementChild,'Beginning wraps to end');list.scrollTop=-1000;assert(list.scrollTop===0,'Scroll precedes first entry');
      }
      assert(input.value==='13:00','Unapplied draft changed time');popup.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));assert(!document.querySelector('.time-popup:popover-open')&&input.value==='13:00','Escape did not cancel draft');
      input.closest('.time-control').querySelector('.time-trigger').click();popup=document.querySelector('.time-popup:popover-open');popup.querySelector('[data-part="minute"] [data-value="5"]').click();popup.querySelector('.time-picker-done').click();
      let state=JSON.parse(window.ritmDesktop.storage.load().data),date=document.querySelector('#date-picker').value;assert(state.days[date].bands[0].start===785&&state.days[date].bands[0].duration===30,'Inspector time did not commit');
      input=document.querySelector('[data-field="start"]');const valid=input.value;input.value='13:60';assert(!input.checkValidity(),'Invalid typed minute accepted');input.value=valid;
      document.querySelector('[data-action="day-settings"]').click();document.querySelector('.inspector [data-action="add-band"]').click();let form=document.querySelector('#add-band-form');assert(!form.querySelector('input[type="time"]'),'Modal still uses native time picker');
      form.querySelector('[name="start"]').closest('.time-control').querySelector('.time-trigger').click();popup=document.querySelector('.time-popup:popover-open');assert(popup&&popup.closest('#modal'),'Modal time picker not in modal');popup.querySelector('[data-part="minute"] [data-value="10"]').click();popup.querySelector('.time-picker-done').click();form.requestSubmit();assert(!document.querySelector('#modal').open,'Period form failed');
      state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[date].bands.at(-1).start===790,'Modal value was not submitted');
      document.querySelector('[data-action="export"]').click();input=document.querySelector('#export-start');input.closest('.time-control').querySelector('.time-trigger').click();popup=document.querySelector('.time-popup:popover-open');popup.querySelector('[data-part="minute"] [data-value="30"]').click();popup.querySelector('.time-picker-done').click();assert(input.value==='09:30'&&document.querySelector('.export-preview canvas'),'Export time picker failed');document.querySelector('#modal .modal-footer [data-action="close-modal"]').click();
      const axis=document.querySelector('.time-axis').getBoundingClientRect();for(const marker of document.querySelectorAll('.time-label')){const rect=marker.getBoundingClientRect(),text=marker.querySelector('span').getBoundingClientRect();assert(Math.abs(rect.top+rect.height/2-axis.top-parseFloat(marker.style.top))<1,'Time marker is not centered on tick');assert(Math.abs(text.top+text.height/2-rect.top-rect.height/2)<1,'Time text is not centered');}
      const canvas=renderScheduleImage(state.days[date]),ctx=canvas.getContext('2d'),y=Math.round((148+(600-state.days[date].start)*1.6)*2),left=ctx.getImageData(20,y,1,1).data,gap=ctx.getImageData(72,y,1,1).data;assert(left[0]!==gap[0]||left[1]!==gap[1],'PNG hour line has no center gap');
      document.querySelector('.gutter-band').click();document.querySelector('[data-field="start"]').closest('.time-control').querySelector('.time-trigger').click();
    }
    if(${process.argv.includes('--smoke-editor-v050')}){
      assert(!document.querySelector('.inspector .palette'),'Presets still visible in inspector');assert(!document.querySelector('[data-field="end"]'),'Canvas still has a working-day end setting');
      const choose=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));};
      document.querySelector('[data-action="select-patient"]').click();let color=document.querySelector('[data-field="headerColor"]');color.closest('.color-control').querySelector('.color-trigger').click();let popup=document.querySelector('.color-popup:popover-open');assert(popup&&popup.querySelector('.color-add')&&popup.querySelector('.color-done'),'Custom color picker missing controls');assert(popup.getBoundingClientRect().right<=innerWidth&&popup.getBoundingClientRect().left>=0,'Color picker exceeds window bounds');
      const hex=popup.querySelector('.color-code');hex.value='#ff0000';hex.dispatchEvent(new Event('input',{bubbles:true}));popup.querySelector('.color-add').click();let state=JSON.parse(window.ritmDesktop.storage.load().data),date=document.querySelector('#date-picker').value;assert(state.colorPresets.includes('#ff0000'),'Saved red swatch missing');assert(state.days[date].columns[0].headerColor==='#ffffff','Draft color applied before Done');popup.querySelector('.color-done').click();state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[date].columns[0].headerColor==='#ff0000','Done did not apply color');
      const format=()=>document.querySelector('[data-field="name"]').closest('.text-field').querySelector('.text-format');format().open=true;let family=format().querySelector('select');family.value='Georgia';family.dispatchEvent(new Event('change',{bubbles:true}));let size=format().querySelector('input');size.value=16;size.dispatchEvent(new Event('change',{bubbles:true}));format().querySelector('.text-bold').click();format().querySelector('.text-italic').click();state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.patients[0].textStyles.name.fontFamily==='Georgia'&&state.patients[0].textStyles.name.italic&&state.patients[0].textStyles.name.bold,'Text style did not persist');assert(document.querySelector('.column-header .name').style.fontFamily.includes('Georgia'),'Patient font not rendered');
      choose('[data-procedure]');let procFormat=document.querySelector('[data-field="name"]').closest('.text-field').querySelector('.text-format');procFormat.open=true;let procFamily=procFormat.querySelector('select');procFamily.value='Arial';procFamily.dispatchEvent(new Event('change',{bubbles:true}));procFormat=document.querySelector('[data-field="name"]').closest('.text-field').querySelector('.text-format');let procSize=procFormat.querySelector('input');procSize.value=14;procSize.dispatchEvent(new Event('change',{bubbles:true}));
      document.querySelector('[data-action="day-settings"]').click();document.querySelector('.inspector [data-action="add-band"]').click();let form=document.querySelector('#add-band-form');assert(!form.querySelector('[name="kind"]'),'Period still has a type selector');form.querySelector('[name="name"]').value='Собрание';form.querySelector('[name="start"]').value='15:00';form.querySelector('[name="end"]').value='15:20';form.requestSubmit();assert(!document.querySelector('#modal').open,'Cannot create short period');state=JSON.parse(window.ritmDesktop.storage.load().data);const band=state.days[date].bands.at(-1),label=document.querySelector('.gutter-band[data-id="'+band.id+'"]');assert(label.textContent.includes('Собрание')&&label.textContent.includes('15:00–15:20'),'Short period lost title or time');
      const lr=label.getBoundingClientRect(),title=label.querySelector('strong').getBoundingClientRect(),time=label.querySelector('span').getBoundingClientRect();assert(title.bottom<=time.top+.5&&time.bottom<=lr.bottom+.5,'Short period text is clipped or overlapping');
      const lane=document.querySelector('[data-lane]'),r=lane.getBoundingClientRect();lane.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+30,clientY:r.top+240}));assert(!document.querySelector('.cell-selection,.cell-fill')&&!document.querySelector('.inspector').textContent.includes('Оформление области'),'Styled cell still available');
      const before=JSON.parse(window.ritmDesktop.storage.load().data).days[date].appointments.length,card=document.querySelector('[data-procedure]'),cr=card.getBoundingClientRect(),grid=document.querySelector('#lanes').getBoundingClientRect();card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:cr.left+25,clientY:cr.top+25}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:grid.left+50,clientY:grid.top+60*1.4}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));state=JSON.parse(window.ritmDesktop.storage.load().data);const added=state.days[date].appointments.at(-1);assert(state.days[date].appointments.length===before+1&&Math.abs(added.start+added.duration/2-600)<=2.5,'Library drag does not use center anchor');assert(added.textStyles.text.fontFamily==='Arial'&&added.textStyles.text.fontSize===14,'Procedure typography did not transfer to new appointment');
      const element=document.querySelector('[data-appointment="'+added.id+'"]'),er=element.getBoundingClientRect();element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:er.left+30,clientY:er.top+35}));const scroll=document.querySelector('.schedule-scroll').getBoundingClientRect();document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:er.left+30,clientY:scroll.top-20}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[date].appointments.at(-1).start===state.days[date].start,'Dragging past top does not snap to first row');
      choose('[data-procedure]');document.querySelector('[data-action="place-procedure"]').click();form=document.querySelector('#place-form');form.querySelector('[name="start"]').value='18:30';form.requestSubmit();assert(!document.querySelector('#modal').open,'After-hours appointment rejected');state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[date].end>=1165,'Canvas did not expand');assert(!document.querySelector('.conflict-mark,.warning-count,.appointment.conflict,.issue-box'),'Warning UI still visible');
      const context=CanvasRenderingContext2D.prototype,original=context.fillText,originalRound=context.roundRect,texts=[];let rounded=0;context.fillText=function(text,...args){texts.push(text);return original.call(this,text,...args);};context.roundRect=function(...args){rounded++;return originalRound.apply(this,args);};try{const sample=structuredClone(state.days[date]);sample.cells.push({patientId:sample.columns[0].patientId,start:600,duration:30,text:'HIDDEN_LEGACY_CELL',color:'#ff0000'});renderScheduleImage(sample,{start:480,end:1200});}finally{context.fillText=original;context.roundRect=originalRound;}assert(rounded>0&&texts.some(t=>t.startsWith('Расписание на '))&&!texts.includes('HIDDEN_LEGACY_CELL'),'PNG rounding, title or cell removal failed');
      document.querySelector('[data-action="select-patient"]').click();document.querySelector('[data-field="headerColor"]').closest('.color-control').querySelector('.color-trigger').click();popup=document.querySelector('.color-popup:popover-open');assert([...popup.querySelectorAll('.color-swatch')].some(b=>b.style.background==='rgb(255, 0, 0)'),'Saved color missing when reopening');
    }
    if(${process.argv.includes('--smoke-editor-v051')}){
      const choose=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+15,clientY:r.top+15}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));};
      assert(!document.querySelector('.workspace-heading [data-action="day-settings"]')&&document.querySelectorAll('.toolbar [data-action="toggle-right"]').length===1,'Duplicate inspector button remains');
      choose('[data-appointment]');let field=document.querySelector('[data-field="text"]'),format=field.closest('.text-field').querySelector('.text-format'),alignment=format.querySelector('[data-text-alignment]');assert(alignment,'Alignment is outside text formatting');assert(!document.querySelector('[data-field="note"]').closest('.text-field'),'Notes still have typography');
      assert(document.querySelectorAll('.inspector [data-field="color"]').length===1,'Duplicate color controls');assert(document.querySelector('[data-field="color"]').closest('.inspector-section')===field.closest('.inspector-section'),'Colors are not in main section');
      format.open=true;alignment.value='right';alignment.dispatchEvent(new Event('change',{bubbles:true}));let state=JSON.parse(window.ritmDesktop.storage.load().data),date=document.querySelector('#date-picker').value;assert(state.days[date].appointments[0].align==='right','Alignment not applied');
      let input=document.querySelector('[data-field="color"]'),original=input.value;input.closest('.color-control').querySelector('.color-trigger').click();let popup=document.querySelector('.color-popup:popover-open');assert(!popup.closest('label'),'Color popup is still inside a field label');
      popup.querySelector('.color-sv').click();assert(popup.matches(':popover-open'),'Clicking palette area closed it');popup.querySelector('.color-hue').click();assert(popup.matches(':popover-open'),'Clicking hue slider closed palette');
      popup.querySelector('[data-color="#f3b5ac"]').click();assert(popup.matches(':popover-open')&&popup.querySelector('.color-code').value==='#F3B5AC'&&input.value===original,'Preset click closes or commits palette prematurely');popup.querySelector('.color-done').click();state=JSON.parse(window.ritmDesktop.storage.load().data);assert(state.days[date].appointments[0].color==='#f3b5ac','Preset color was not committed');
      input=document.querySelector('[data-field="color"]');input.closest('.color-control').querySelector('.color-trigger').click();popup=document.querySelector('.color-popup:popover-open');for(let i=0;i<20;i++){const code=popup.querySelector('.color-code');code.value='#ca00'+i.toString(16).padStart(2,'0');code.dispatchEvent(new Event('input',{bubbles:true}));popup.querySelector('.color-add').click();}
      const swatches=popup.querySelectorAll('.color-swatch'),grid=popup.querySelector('.color-presets');assert(getComputedStyle(grid).gridTemplateColumns.split(' ').length===8,'Presets are not eight per row');assert(swatches[8].getBoundingClientRect().top>swatches[0].getBoundingClientRect().top&&swatches[16].getBoundingClientRect().top>swatches[8].getBoundingClientRect().top,'New presets do not grow downward');assert(grid.scrollWidth<=grid.clientWidth+1,'Preset row scrolls horizontally');
      const removeColor='#ca0000',swatch=popup.querySelector('[data-color="'+removeColor+'"]');swatch.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}));assert(!popup.querySelector('.color-context-menu').hidden,'Preset context menu missing');popup.querySelector('.color-context-menu button').click();state=JSON.parse(window.ritmDesktop.storage.load().data);assert(!state.colorPresets.includes(removeColor)&&popup.matches(':popover-open'),'Preset deletion failed or closed palette');assert(state.days[date].appointments[0].color==='#f3b5ac','Deleting preset changed appointment color');
      popup.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Escape'}));document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Escape'}));assert(!document.querySelector('.appointment.selected')&&document.querySelector('[data-field="scheduleName"]'),'Escape did not restore day inspector');assert(!document.querySelector('[data-field="scheduleName"]').closest('.text-field'),'Schedule title has export-only typography controls');
      choose('[data-procedure]');let card=document.querySelector('.procedure-card.selected'),cr=card.getBoundingClientRect(),list=card.parentElement.getBoundingClientRect();assert(cr.left-3>=list.left&&cr.top-4>=list.top,'First card outline is clipped');
      document.querySelector('.workspace-heading').click();assert(document.querySelector('[data-field="scheduleName"]'),'Empty workspace did not restore day inspector');
      let scroll=document.querySelector('.schedule-scroll');scroll.scrollTop=40;await new Promise(r=>requestAnimationFrame(r));let initial=scroll.scrollTop;
      const startDrag=()=>{const card=document.querySelector('[data-procedure]'),r=card.getBoundingClientRect();card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+25,clientY:r.top+25}));const sc=document.querySelector('.schedule-scroll').getBoundingClientRect(),lane=document.querySelector('[data-lane]').getBoundingClientRect();document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:lane.left+45,clientY:sc.bottom-12}));return {sc,lane};};
      let location=startDrag();await new Promise(r=>setTimeout(r,120));assert(document.querySelector('.schedule-scroll').scrollTop===initial,'Timeline scrolled immediately on entry');document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:location.lane.left+45,clientY:location.sc.bottom-85}));await new Promise(r=>setTimeout(r,550));assert(document.querySelector('.schedule-scroll').scrollTop===initial,'Timeline scrolls down while pointer moves upward');document.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true}));
      initial=document.querySelector('.schedule-scroll').scrollTop;const beforeEnd=JSON.parse(window.ritmDesktop.storage.load().data).days[date].end;startDrag();await new Promise(r=>setTimeout(r,680));assert(document.querySelector('.schedule-scroll').scrollTop===initial,'Library drag scrolled after dwelling at edge');assert(JSON.parse(window.ritmDesktop.storage.load().data).days[date].end===beforeEnd,'Library drag extended canvas');document.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true}));
      scroll=document.querySelector('.schedule-scroll');scroll.scrollTop=0;await new Promise(r=>requestAnimationFrame(r));const appointment=document.querySelector('[data-appointment]'),ar=appointment.getBoundingClientRect(),sr=scroll.getBoundingClientRect();appointment.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:ar.left+25,clientY:ar.top+20}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:ar.left+25,clientY:sr.bottom-12}));await new Promise(r=>setTimeout(r,80));assert(scroll.scrollTop>0,'Timeline drag did not scroll immediately');const atBottom=scroll.scrollTop;document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:ar.left+25,clientY:sr.top+90}));await new Promise(r=>setTimeout(r,80));assert(scroll.scrollTop<atBottom,'Timeline drag did not reverse scrolling immediately');document.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true}));
      choose('[data-appointment]');field=document.querySelector('[data-field="text"]');field.closest('.text-field').querySelector('.text-format').open=true;document.querySelector('[data-field="color"]').closest('.color-control').querySelector('.color-trigger').click();popup=document.querySelector('.color-popup:popover-open');popup.querySelector('.color-swatch').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}));
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {url:location.href,patients:document.querySelectorAll('.column-header').length,bridge:true,autosave:true,png:true,nodeExposed:typeof window.require!=='undefined'};
  })()`,true);
  if(process.argv.includes('--smoke-instructor-selection'))await require('./verify-instructor-selection.cjs')({window:mainWindow});
  if(process.argv.includes('--smoke-autofill-foundation'))await require('./verify-autofill-foundation.cjs')({window:mainWindow,out:smokeDir});
  if(process.argv.includes('--smoke-inspector-layout'))await require('./verify-inspector-layout.cjs')({window:mainWindow});
  if(process.argv.includes('--smoke-procedure-propagation'))await require('./verify-procedure-propagation.cjs')({window:mainWindow});
  if(process.argv.includes('--smoke-procedure-duration'))await require('./verify-procedure-duration.cjs')({window:mainWindow});
  if(process.argv.includes('--smoke-delete-button'))await require('./verify-appointment-delete.cjs')({window:mainWindow});
  if(process.argv.includes('--smoke-window'))await require('./verify-window.cjs')({window:mainWindow,out:smokeDir});
  if(process.argv.includes('--smoke-tutorial'))await require('./verify-tutorial.cjs')({window:mainWindow,out:smokeDir});
  if(process.argv.includes('--smoke-chrome')){
    mainWindow.maximize();await new Promise(resolve=>setTimeout(resolve,200));if(!mainWindow.isMaximized())throw Error('Window did not maximize');
    const controlsFit=await mainWindow.webContents.executeJavaScript(`document.querySelector('.top-actions').getBoundingClientRect().right<=document.querySelector('.window-controls').getBoundingClientRect().left`);if(!controlsFit)throw Error('Maximized title bar actions overlap controls');
    mainWindow.unmaximize();await new Promise(resolve=>setTimeout(resolve,200));if(mainWindow.isMaximized())throw Error('Window did not restore');
  }
  if(smokeDir){fs.mkdirSync(smokeDir,{recursive:true});fs.writeFileSync(path.join(smokeDir,'desktop-smoke.json'),JSON.stringify(result,null,2));const capture=await mainWindow.webContents.capturePage();fs.writeFileSync(path.join(smokeDir,'desktop.png'),capture.toPNG());}
  if(smokeDir&&process.argv.includes('--smoke-editor-v050')){
    const exported=await mainWindow.webContents.executeJavaScript(`(async()=>{const {renderScheduleImage}=await import('./export.mjs');const p=JSON.parse(window.ritmDesktop.storage.load().data),d=p.days[document.querySelector('#date-picker').value];return renderScheduleImage(d,{start:870,end:945,columns:d.columns.slice(0,3),scale:2}).toDataURL('image/png');})()`);fs.writeFileSync(path.join(smokeDir,'export-period.png'),Buffer.from(exported.split(',')[1],'base64'));
    await mainWindow.webContents.executeJavaScript(`(async()=>{document.querySelectorAll(':popover-open').forEach(p=>p.hidePopover());const state=JSON.parse(window.ritmDesktop.storage.load().data),day=state.days[document.querySelector('#date-picker').value],band=day.bands.find(b=>b.name==='Собрание');document.querySelector('.gutter-band[data-id="'+band.id+'"]').click();document.querySelector('.schedule-scroll').scrollTop=(band.start-day.start)*1.4-140;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);fs.writeFileSync(path.join(smokeDir,'period.png'),(await mainWindow.webContents.capturePage()).toPNG());
  }
  console.log('DESKTOP_SMOKE_OK',JSON.stringify(result));if(!process.argv.includes('--smoke-keep-open'))app.exit(0);else{mainWindow.show();mainWindow.focus();}
}
