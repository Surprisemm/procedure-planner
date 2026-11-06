const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

module.exports=async function captureReview({window:win,out,root}){
  fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'test-files'),{recursive:true});
  win.show();
  const D=await import(pathToFileURL(path.join(root,'domain.mjs')).href),wc=win.webContents;
  const base=D.ensureStays(D.newProject(true)),old=Object.keys(base.days)[0],first='2026-11-09';
  base.days[first]=base.days[old];base.days[first].date=first;if(old!==first)delete base.days[old];base.demo=false;
  base.stays[0].name='Ноябрь · первый заезд';Object.assign(base.stays[0],{startDate:first,endDate:'2026-12-06',viewDate:first});
  for(const date of D.stayDates(first,'2026-12-06'))if(!base.days[date])base.days[date]=D.makeDay(date,base.patients);
  D.copyScheduleDay(base,first,'2026-11-16',{appointments:true,replace:true});
  base.days['2026-11-11'].appointments=D.clone(base.days[first].appointments.slice(0,6)).map(a=>({...a,id:D.uid()}));
  const firstId=base.currentStayId;D.createStay(base,'Декабрь · второй заезд','2026-12-07');D.switchStay(base,firstId);
  const empty=D.ensureStays(D.newProject(false));empty.demo=false;empty.stays[0].name='Новое расписание';empty.stays[0].viewDate=Object.keys(empty.days)[0];
  const busy=D.clone(base);busy.days[first].appointments.push({...D.clone(busy.days[first].appointments[0]),id:D.uid(),start:560,text:'Массаж · пересечение',color:'#a8d9ee'});
  const cancelled=D.clone(base);cancelled.days[first].appointments[0].status='cancelled';
  const periods=D.clone(base);periods.days[first].bands.push({id:D.uid(),name:'Консилиум',start:735,duration:30,color:'#d8dfe8'},{id:D.uid(),name:'Собрание',start:900,duration:20,color:'#d7cef0'});
  const styled=D.clone(base);styled.days[first].columns[0].headerColor='#f7df88';styled.days[first].columns[0].color='#f4f7ff';styled.days[first].cells.push({id:D.uid(),patientId:styled.patients[0].id,start:720,duration:30,color:'#e4eafa',text:'Индивидуальное занятие'});
  fs.writeFileSync(path.join(out,'test-files','Пример проекта Расписание процедур.json'),JSON.stringify(base,null,2));
  const manifest=[],errors=[];let sequence=0;
  const helpers=`const $=s=>document.querySelector(s);const click=s=>{const e=$(s);if(!e)throw Error('Missing '+s);e.click();};const set=(s,value,event='change')=>{const e=$(s);if(!e)throw Error('Missing '+s);e.value=value;e.dispatchEvent(new Event(event,{bubbles:true}));};const choose=s=>{const e=$(s);if(!e)throw Error('Missing '+s);const r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+12,clientY:r.top+12}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));};`;
  const run=code=>wc.executeJavaScript(`(async()=>{${helpers}${code}})()`,true);
  async function settle(){await run(`await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);await new Promise(r=>setTimeout(r,90));}
  async function load(project=base){
    await wc.executeJavaScript(`window.ritmDesktop.storage.save(${JSON.stringify(JSON.stringify(project))})`);
    const ready=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await ready;await settle();
  }
  async function capture(group,slug,title,keepToast=false){
    if(!keepToast)await run(`$('#toast').className='';`);await settle();
    const number=String(++sequence).padStart(3,'0'),folder=path.join(out,group);fs.mkdirSync(folder,{recursive:true});
    const file=`${group}/${number}-${slug}.png`,image=await wc.capturePage();fs.writeFileSync(path.join(out,file),image.toPNG());
    manifest.push({number,group,title,file,...image.getSize()});fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(`CAPTURE ${number} ${title}`);
  }
  async function scene(group,slug,title,code='',fixture=base,keepToast=false){
    try{win.setContentSize(1440,920);await load(fixture);if(code)await run(code);await capture(group,slug,title,keepToast);}catch(error){errors.push({title,error:error.message});console.error('CAPTURE_ERROR',title,error.message);}
  }
  const modalClose=`click('#modal .modal-footer [data-action="close-modal"]');`;
  const selectAppointment=`choose('[data-appointment]');`;
  const selectProcedure=`choose('[data-procedure]');`;
  const selectPatient=`click('[data-action="select-patient"]');`;
  const selectBand=`click('.gutter-band');`;
  const scrollLunch=`$('.schedule-scroll').scrollTop=320;`;
  const inspectorBottom=`$('.inspector').scrollTop=10000;`;
  const G='01-main';
  await scene(G,'day','Главный экран · заполненный день');
  await scene(G,'lunch','Обед и защита подписей шкалы времени',scrollLunch);
  await scene(G,'evening','Конец рабочего дня',`$('.schedule-scroll').scrollTop=10000;`);
  await scene(G,'horizontal','Горизонтальная прокрутка · последние пациенты',`$('.schedule-scroll').scrollLeft=10000;`);
  await scene(G,'empty','Пустое расписание · нет пациентов','',empty);
  await scene(G,'arrival-empty','Новый день заезда · пациенты без назначений',`click('[data-action="goto-day"][data-date="2026-11-10"]');`);
  await scene(G,'second-schedule','Другое расписание · независимый состав',`document.querySelectorAll('[data-action="choose-schedule"]')[1].click();`);
  await scene(G,'some-disabled','Часть пациентов выключена на выбранный день',`document.querySelectorAll('.patient-day-toggle')[0].click();document.querySelectorAll('.patient-day-toggle')[3].click();`);
  await scene(G,'all-disabled','Все пациенты выключены · пустое состояние',`for(let i=0;i<10;i++)document.querySelectorAll('.patient-day-toggle')[i].click();`);
  await scene(G,'search','Поиск пациента',`set('#patient-search','Анна','input');`);
  await scene(G,'search-empty','Поиск · ничего не найдено',`set('#patient-search','Несуществующий пациент','input');`);
  await scene(G,'no-left','Скрыта левая панель',`click('[data-action="toggle-left"]');`);
  await scene(G,'no-inspector','Скрыт инспектор',`click('[data-action="toggle-right"]');`);
  await scene(G,'library-collapsed','Библиотека процедур свёрнута',`click('[data-action="toggle-library"]');`);
  await scene(G,'workspace-only','Рабочая область · все панели свёрнуты',`click('[data-action="toggle-left"]');click('[data-action="toggle-right"]');click('[data-action="toggle-library"]');`);
  for(const zoom of ['0.75','1.25','1.5','2'])await scene(G,`zoom-${zoom.replace('.','-')}`,`Масштаб ${Number(zoom)*100}%`,`set('#zoom','${zoom}');`);
  await load(base);win.setContentSize(1000,680);await capture(G,'compact','Минимальный размер окна · 1000×680');win.setContentSize(1440,920);
  await load(base);win.setContentSize(1920,1080);await capture(G,'large','Большой размер окна · 1920×1080');win.setContentSize(1440,920);
  const I='02-inspectors';
  await scene(I,'day','Инспектор дня');
  await scene(I,'patient','Инспектор пациента · верхняя часть',selectPatient);
  await scene(I,'patient-bottom','Инспектор пациента · цвета и удаление',selectPatient+inspectorBottom);
  await scene(I,'procedure','Инспектор вида процедуры',selectProcedure);
  await scene(I,'appointment','Инспектор назначения · время',selectAppointment);
  await scene(I,'appointment-bottom','Инспектор назначения · оформление и действия',selectAppointment+inspectorBottom);
  await scene(I,'cancelled','Отменённая процедура · зачёркнутый блок',selectAppointment,cancelled);
  await scene(I,'conflict','Пересечение процедур · инспектор предупреждения',selectAppointment,busy);
  await scene(I,'period','Инспектор общей полосы',scrollLunch+selectBand);
  await scene(I,'several-periods','Обед, консилиум и свой период',scrollLunch,periods);
  await scene(I,'custom-period','Инспектор своего периода',`click('[data-action="select-band"][data-id="${periods.days[first].bands[2].id}"]');`,periods);
  await scene(I,'cell','Инспектор оформления области',`$('.schedule-scroll').scrollTop=230;const lane=$('[data-lane]'),r=lane.getBoundingClientRect();lane.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+40,clientY:r.top+255}));`);
  await scene(I,'styled-cell','Цвет заголовка, фон колонки и оформленная область',`$('.schedule-scroll').scrollTop=230;const lane=$('[data-lane]'),r=lane.getBoundingClientRect();lane.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+40,clientY:r.top+260}));`,styled);
  const F='03-schedules-days';
  await scene(F,'new-schedule','Создание расписания · стандартные 28 дней',`click('[data-action="new-stay"]');`);
  await scene(F,'custom-dates','Создание расписания · свои даты и копирование пациентов',`click('[data-action="new-stay"]');set('#stay-form [name="name"]','Декабрь · новая группа');set('#stay-form [name="date"]','2026-12-01');set('#stay-form [name="endDate"]','2026-12-14','input');$('#stay-form [name="patients"]').checked=true;`);
  await scene(F,'invalid-dates','Создание расписания · ошибочный диапазон',`click('[data-action="new-stay"]');set('#stay-form [name="endDate"]','2026-11-01','input');`);
  await scene(F,'rename','Изменение названия расписания',`const t=document.createElement('button');t.dataset.action='rename-stay';document.body.append(t);t.click();t.remove();`);
  await scene(F,'new-day','Добавление дня · варианты переноса',`click('[data-action="new-day"]');`);
  await scene(F,'day-exists','Добавление дня · дата уже существует',`click('[data-action="new-day"]');$('#day-form').requestSubmit();`);
  await scene(F,'saved-days','Список сохранённых дней',`click('[data-action="saved-days"]');`);
  await scene(F,'copy-filled','Копирование на заполненный день · подтверждение',`click('[data-action="copy-day"]');`);
  await scene(F,'copy-confirmed','Копирование на заполненный день · замена разрешена',`click('[data-action="copy-day"]');$('#copy-day-form [name="replace"]').click();`);
  await scene(F,'copy-empty','Копирование на пустой день заезда',`click('[data-action="copy-day"]');set('#copy-day-form [name="date"]','2026-11-17');`);
  await scene(F,'copy-new','Копирование с созданием нового дня',`click('[data-action="copy-day"]');set('#copy-day-form [name="date"]','2026-12-14');`);
  await scene(F,'copy-same','Копирование · исходная и целевая даты совпадают',`click('[data-action="copy-day"]');set('#copy-day-form [name="date"]','${first}');`);
  await scene(F,'copy-result','Результат копирования в следующий понедельник',`click('[data-action="copy-day"]');$('#copy-day-form [name="replace"]').click();$('#copy-day-form').requestSubmit();`);
  const P='04-patients-procedures';
  await scene(P,'new-patient','Добавление пациента',`click('.side-title [data-action="add-patient"]');`);
  await scene(P,'patient-filled','Добавление пациента · заполненные поля',`click('.side-title [data-action="add-patient"]');set('#add-patient-form [name="name"]','Иванов Иван Иванович');set('#add-patient-form [name="house"]','7А');`);
  await scene(P,'batch','Добавление пациентов списком',`click('[data-action="batch-patients"]');set('#batch-form textarea','Иванов Иван; 7\\nПетрова Анна; 3\\nСидоров Алексей; 12А');`);
  await scene(P,'batch-error','Добавление списком · ошибка имени',`click('[data-action="batch-patients"]');set('#batch-form textarea','; 7');$('#batch-form').requestSubmit();`);
  await scene(P,'new-procedure','Создание вида процедуры',`click('[data-action="add-procedure"]');set('#add-procedure-form [name="name"]','Индивидуальное занятие');`);
  await scene(P,'place','Назначение процедуры без перетаскивания',selectProcedure+`click('[data-action="place-procedure"]');`);
  await scene(P,'place-error','Назначение процедуры · за пределами дня',selectProcedure+`click('[data-action="place-procedure"]');set('#place-form [name="start"]','17:15');$('#place-form').requestSubmit();`);
  await scene(P,'transfer-copy','Копирование отдельной процедуры в другой день',selectAppointment+`click('[data-action="transfer-appointment"]');`);
  await scene(P,'transfer-move','Перенос отдельной процедуры в другой день',selectAppointment+`click('[data-action="transfer-appointment"]');set('#transfer-form [name="mode"]','move');`);
  await scene(P,'transfer-error','Перенос процедуры · та же дата',selectAppointment+`click('[data-action="transfer-appointment"]');set('#transfer-form [name="date"]','${first}');$('#transfer-form').requestSubmit();`);
  await scene(P,'conflict-list','Список пересечений в расписании',`click('[data-action="show-conflicts"]');`,busy);
  const T='05-periods-time';
  await scene(T,'new-period','Добавление общей полосы · обед',`click('.inspector [data-action="add-band"]');`);
  await scene(T,'consultation','Добавление консилиума',`click('.inspector [data-action="add-band"]');set('#add-band-form [name="kind"]','Консилиум');set('#add-band-form [name="start"]','12:15');set('#add-band-form [name="end"]','12:45');`);
  await scene(T,'custom','Добавление своего периода',`click('.inspector [data-action="add-band"]');set('#add-band-form [name="kind"]','custom');set('#add-band-form [name="name"]','Собрание');`);
  await scene(T,'period-error','Добавление периода · конец раньше начала',`click('.inspector [data-action="add-band"]');set('#add-band-form [name="end"]','12:00');$('#add-band-form').requestSubmit();`);
  await scene(T,'time-inspector','Выбор времени в инспекторе',selectBand+`$('[data-field="start"]').closest('.time-control').querySelector('.time-trigger').click();`);
  await scene(T,'time-modal','Выбор времени в окне добавления периода',`click('.inspector [data-action="add-band"]');$('#add-band-form [name="start"]').closest('.time-control').querySelector('.time-trigger').click();`);
  await scene(T,'time-first','Списки времени · первые значения 00',selectBand+`$('[data-field="start"]').closest('.time-control').querySelector('.time-trigger').click();for(const list of document.querySelectorAll('.time-popup:popover-open .time-options'))list.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Home'}));`);
  await scene(T,'time-last','Списки времени · последние значения 23 и 59',selectBand+`$('[data-field="start"]').closest('.time-control').querySelector('.time-trigger').click();for(const list of document.querySelectorAll('.time-popup:popover-open .time-options'))list.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'End'}));`);
  const R='06-deletion';
  await scene(R,'patient','Подтверждение удаления пациента',`click('[data-action="remove-patient"]');`);
  await scene(R,'procedure','Подтверждение удаления вида процедуры',selectProcedure+`click('[data-action="delete-selection"]');`);
  await scene(R,'schedule','Удаление выбранного расписания',`click('.schedule-picker-item.active [data-action="remove-schedule"]');`);
  await scene(R,'inactive','Удаление другого расписания',`document.querySelectorAll('[data-action="remove-schedule"]')[1].click();`);
  await scene(R,'last','Удаление последнего расписания',`click('[data-action="remove-schedule"]');`,empty);
  const demo=D.clone(base);demo.demo=true;
  await scene(R,'reset','Подтверждение очистки демонстрации',`click('[data-action="new-project"]');`,demo);
  const E='07-export-help';
  await scene(E,'export','Экспорт PNG · всё расписание',`click('[data-action="export"]');`);
  await scene(E,'export-range','Экспорт PNG · выбранное время',`click('[data-action="export"]');set('#export-start','11:00');set('#export-end','15:00');`);
  await scene(E,'export-parts','Экспорт PNG · разделение по 6 колонок',`click('[data-action="export"]');set('#export-columns','6');`);
  await scene(E,'export-error','Экспорт PNG · ошибочный диапазон',`click('[data-action="export"]');set('#export-start','18:00');`);
  await scene(E,'help','Справка и сочетания клавиш',`click('[data-action="help"]');`);
  const X='08-interactions';
  await scene(X,'drag','Перетаскивание процедуры · допустимое положение',`const card=$('[data-procedure]'),r=card.getBoundingClientRect(),lane=$('[data-lane]').getBoundingClientRect();card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+20,clientY:r.top+20}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:lane.left+55,clientY:lane.top+240}));`);
  await scene(X,'drag-invalid','Перетаскивание процедуры · выход за границы дня',`$('.schedule-scroll').scrollTop=10000;const card=$('[data-procedure]'),r=card.getBoundingClientRect(),lane=$('[data-lane]').getBoundingClientRect();card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+20,clientY:r.top+20}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:lane.left+55,clientY:lane.top+470*1.4}));`);
  await scene(X,'resize','Изменение длительности процедуры за край',selectAppointment+`const handle=$('.appointment.selected [data-resize="bottom"]'),r=handle.getBoundingClientRect();handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+30,clientY:r.top+3}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+30,clientY:r.top-11}));`);
  // Standalone export samples are included alongside screenshots.
  await load(base);
  for(const [slug,title,options] of [['full','Готовый PNG · полное расписание',{scale:2}],['range','Готовый PNG · с 11:00 до 15:00',{scale:2,start:660,end:900}]]){
    const url=await run(`const {renderScheduleImage}=await import('./export.mjs');return renderScheduleImage(JSON.parse(window.ritmDesktop.storage.load().data).days['${first}'],${JSON.stringify(options)}).toDataURL('image/png');`);
    const group='09-export-images',number=String(++sequence).padStart(3,'0'),file=`${group}/${number}-${slug}.png`;fs.mkdirSync(path.join(out,group),{recursive:true});fs.writeFileSync(path.join(out,file),Buffer.from(url.split(',')[1],'base64'));manifest.push({number,group,title,file});
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(out,'capture-errors.json'),JSON.stringify(errors,null,2));
  buildGallery(out);await load(base);fs.writeFileSync(path.join(out,'READY.txt'),`Captured ${manifest.length} images. Errors: ${errors.length}.`);console.log('REVIEW_READY',manifest.length,errors.length);
};

function buildGallery(out){
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
  const labels={'01-main':'Основные состояния','02-inspectors':'Инспекторы','03-schedules-days':'Расписания и дни','04-patients-procedures':'Пациенты и процедуры','05-periods-time':'Периоды и время','06-deletion':'Удаление','07-export-help':'Экспорт и справка','08-interactions':'Перетаскивание и изменение размера','09-export-images':'Примеры готовых PNG','10-native':'Полное окно и системные диалоги'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groups=[...new Set(manifest.map(m=>m.group))];
  fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Расписание процедур — обзор интерфейса 0.4.3</title><style>*{box-sizing:border-box}body{font:14px "Segoe UI",sans-serif;margin:0;background:#f2f5fa;color:#25334b}header{padding:30px 36px;background:white;border-bottom:1px solid #dce3ef;position:sticky;top:0;z-index:2}h1{margin:0 0 8px;font-size:25px}p{color:#748198;line-height:1.5;margin:7px 0}input{border:1px solid #dce3ef;border-radius:8px;padding:10px 12px;width:min(450px,100%);font:inherit;margin-top:12px}nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}nav a{color:#346cc0;text-decoration:none;padding:5px 8px;background:#edf3ff;border-radius:5px}main{padding:10px 36px 40px}section{scroll-margin-top:240px}h2{margin:28px 0 14px;font-size:18px}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:18px}.card{background:white;border:1px solid #dce3ef;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px #22385807}.card img{display:block;width:100%;height:245px;object-fit:contain;background:#e9edf5;border-bottom:1px solid #e4eaf2}.caption{padding:13px 15px;line-height:1.5}.caption a{color:inherit;text-decoration:none}small{display:block;color:#8a96a8;margin-top:5px}a:hover{text-decoration:underline}[hidden]{display:none!important}</style><header><h1>Расписание процедур · обзор интерфейса</h1><p>${manifest.length} изображений · версия 0.4.3 · только вымышленные тестовые данные. Для замечаний достаточно указать номер снимка.</p><p>Снимки содержимого приложения дополнены полными снимками окна и системных диалогов Windows в последнем разделе. Раскрытые списки, календарь и палитра цвета показаны в последнем разделе.</p><input id="search" placeholder="Найти экран по названию или номеру"><nav>${groups.map(g=>`<a href="#${g}">${labels[g]||g}</a>`).join('')}</nav></header><main>${groups.map(g=>`<section id="${g}"><h2>${labels[g]||g}</h2><div class="cards">${manifest.filter(m=>m.group===g).map(m=>`<article class="card" data-search="${esc(m.number+' '+m.title)}"><a href="${encodeURI(m.file)}" target="_blank"><img src="${encodeURI(m.file)}" loading="lazy" alt="${esc(m.title)}"></a><div class="caption"><a href="${encodeURI(m.file)}" target="_blank"><b>№${m.number}</b> · ${esc(m.title)}</a><small>${esc(m.file)}</small></div></article>`).join('')}</div></section>`).join('')}</main><script>document.querySelector('#search').oninput=e=>{const q=e.target.value.toLocaleLowerCase('ru');document.querySelectorAll('.card').forEach(c=>c.hidden=!c.dataset.search.toLocaleLowerCase('ru').includes(q));document.querySelectorAll('section').forEach(s=>s.hidden=![...s.querySelectorAll('.card')].some(c=>!c.hidden));};</script></html>`);
  fs.writeFileSync(path.join(out,'Список экранов.md'),`# Расписание процедур — снимки интерфейса\n\nВерсия 0.4.3. Тестовые данные. Снимки сгруппированы по разделам; HTML-галерея: index.html.\n\n${manifest.map(m=>`- №${m.number} — ${m.title}: ${m.file}`).join('\n')}\n`);
}
module.exports.buildGallery=buildGallery;
