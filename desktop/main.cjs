const {app,BrowserWindow,Menu,dialog,ipcMain,protocol,net,nativeImage}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..');
const APP_URL='ritm://app/index.html';
const FILES=new Set([...['schedule','patients','instructors','library','procedure','library-drag','days','inspector','export','autofill-button','autofill-result','autofill-day','autofill-procedures','autofill-rules','autofill-instructors','autofill-groups','autofill-locks','autofill-partial','autofill-report'].map(name=>`assets/tutorial/${name}.png`),'index.html','app.js','domain.mjs','autofill.mjs','export.mjs','styles.css','time-picker.mjs','desktop/icon.svg','color-picker.mjs','text-editors.mjs','presentation.mjs','drag-scroll.mjs']);
app.setName('Расписание процедур');
app.setAppUserModelId('ru.procedureplanner.desktop');
protocol.registerSchemesAsPrivileged([{scheme:'ritm',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let mainWindow,storage;
const smoke=process.argv.includes('--smoke-test');
const smokeDir=process.env.RITM_SMOKE_DIR;
if(smoke&&smokeDir)app.setPath('userData',path.resolve(smokeDir));
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
  app.whenReady().then(start).catch(error=>{if(smoke){console.error(error);app.exit(1);}else{dialog.showErrorBox('Не удалось запустить Расписание процедур',error.message);app.quit();}});
}
function trusted(event){return mainWindow&&!mainWindow.isDestroyed()&&event.sender===mainWindow.webContents&&event.senderFrame===mainWindow.webContents.mainFrame&&event.senderFrame.url===APP_URL;}
function send(command){mainWindow?.webContents.send('ritm:command',command);}
function appIcon(){return nativeImage.createFromPath(path.join(__dirname,'icon-512.png'));}

async function start(){
  storage=await import('./storage.mjs');
  if(!smoke)storage.migrateLegacyAutosave(path.join(app.getPath('appData'),'\u0420\u0438\u0442\u043c'),app.getPath('userData'));
  protocol.handle('ritm',request=>{const url=new URL(request.url),file=decodeURIComponent(url.pathname.slice(1));if(url.host!=='app'||!FILES.has(file))return new Response('Not found',{status:404});return net.fetch(pathToFileURL(path.join(ROOT,file)).href);});
  const session=require('electron').session.defaultSession;
  session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.setPermissionCheckHandler(()=>false);
  session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!['ritm:','file:','devtools:','data:','blob:'].includes(new URL(details.url).protocol)}));
  ipcMain.handle('ritm:window-state',event=>{if(!trusted(event))throw Error('Недопустимый источник запроса');return {maximized:mainWindow.isMaximized()};});
  ipcMain.on('ritm:window-command',(event,command)=>{if(!trusted(event))return;if(command==='minimize')mainWindow.minimize();else if(command==='maximize'){if(mainWindow.isMaximized())mainWindow.unmaximize();else mainWindow.maximize();}else if(command==='close')mainWindow.close();});
  ipcMain.on('ritm:load',event=>{event.returnValue=trusted(event)?storage.loadAutosave(app.getPath('userData')):{error:'Недопустимый источник запроса'};});
  ipcMain.on('ritm:autosave',(event,text)=>{try{if(!trusted(event))throw Error('Недопустимый источник запроса');event.returnValue=storage.saveAutosave(app.getPath('userData'),text);}catch(error){event.returnValue={ok:false,error:error.message};}});
  ipcMain.handle('ritm:open-project',async event=>{
    if(!trusted(event))throw Error('Недопустимый источник запроса');
    const result=await dialog.showOpenDialog(mainWindow,{title:'Открыть проект расписания',filters:[{name:'Проект расписания',extensions:['json']}],properties:['openFile']});
    if(result.canceled)return {canceled:true};
    const file=result.filePaths[0];if(fs.statSync(file).size>storage.MAX_PROJECT_BYTES)throw Error('Размер проекта превышает 15 МБ');
    const data=fs.readFileSync(file,'utf8');storage.parseProject(data);return {data};
  });
  ipcMain.handle('ritm:save-files',async(event,payload)=>{
    if(!trusted(event))throw Error('Недопустимый источник запроса');
    const files=payload?.files,png=Buffer.from([137,80,78,71,13,10,26,10]);
    if(!Array.isArray(files)||!files.length||files.length>400)throw Error('Некорректный набор файлов');
    let total=0;
    for(const file of files){
      if(!file||typeof file.name!=='string'||!/\.png$/i.test(file.name)||!(file.bytes instanceof Uint8Array)||file.bytes.byteLength>80*1024*1024||!Buffer.from(file.bytes.subarray(0,8)).equals(png))throw Error('Некорректное изображение PNG');
      total+=file.bytes.byteLength;
    }
    if(total>600*1024*1024)throw Error('Слишком большой набор изображений');
    // Checks run without dialogs: with --smoke-test the files go to the test folder.
    let folder=smoke&&smokeDir?path.join(path.resolve(smokeDir),'export'):null;
    if(!folder){
      const result=await dialog.showOpenDialog(mainWindow,{title:'Папка для изображений расписания',defaultPath:app.getPath('documents'),properties:['openDirectory','createDirectory']});
      if(result.canceled)return {canceled:true};
      folder=result.filePaths[0];
    }
    await fs.promises.mkdir(folder,{recursive:true});
    for(const file of files)await fs.promises.writeFile(path.join(folder,path.basename(file.name).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')),Buffer.from(file.bytes));
    return {ok:true,count:files.length,folder};
  });
  ipcMain.handle('ritm:save-file',async(event,payload)=>{
    if(!trusted(event))throw Error('Недопустимый источник запроса');
    if(!payload||!['json','png'].includes(payload.type)||typeof payload.name!=='string'||!(payload.bytes instanceof Uint8Array)||payload.bytes.byteLength>80*1024*1024)throw Error('Некорректный файл');
    const bytes=Buffer.from(payload.bytes);
    if(payload.type==='json')storage.parseProject(bytes.toString('utf8'));
    else if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Некорректное изображение PNG');
    const result=await dialog.showSaveDialog(mainWindow,{title:payload.type==='png'?'Сохранить расписание как изображение':'Сохранить проект расписания',defaultPath:path.join(app.getPath('documents'),path.basename(payload.name)),filters:[{name:payload.type==='png'?'Изображение PNG':'Проект расписания',extensions:[payload.type]}]});
    if(result.canceled)return {canceled:true};
    await fs.promises.writeFile(result.filePath,bytes);return {ok:true};
  });
  let bounds={width:1440,height:920};
  try {const b=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'window.json'),'utf8'));if(Number.isFinite(b.width)&&Number.isFinite(b.height))bounds={width:Math.max(1000,Math.min(2560,b.width)),height:Math.max(680,Math.min(1600,b.height))};}catch{}
  mainWindow=new BrowserWindow({...bounds,minWidth:1000,minHeight:680,title:'Расписание процедур',titleBarStyle:'hidden',titleBarOverlay:false,icon:appIcon(),backgroundColor:'#f5f6f8',show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,spellcheck:false,backgroundThrottling:!smoke}});
  for(const event of ['maximize','unmaximize'])mainWindow.on(event,()=>mainWindow.webContents.send('ritm:window-state',{maximized:mainWindow.isMaximized()}));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Файл',submenu:[{label:'Открыть проект…',accelerator:'CmdOrCtrl+O',click:()=>send('open-project')},{label:'Сохранить проект…',click:()=>send('save-project')},{label:'Сохранить PNG…',click:()=>send('export')},{type:'separator'},{role:'quit',label:'Выход'}]},
    {label:'Правка',submenu:[{label:'Отменить изменение расписания',click:()=>send('undo')},{label:'Повторить изменение расписания',click:()=>send('redo')},{type:'separator'},{role:'cut',label:'Вырезать'},{role:'copy',label:'Копировать'},{role:'paste',label:'Вставить'},{role:'selectAll',label:'Выбрать всё'}]},
    {label:'Вид',submenu:[{role:'togglefullscreen',label:'Полный экран'}]},
    {label:'Справка',submenu:[{label:'Как работать с программой',click:()=>send('help')},{label:'О программе',click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'Расписание процедур',message:'Редактор расписания процедур',detail:`Версия ${app.getVersion()}\nЛокальное приложение для Windows. Работает без подключения к интернету.`})}]}
  ]));
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==APP_URL)event.preventDefault();});
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.on('close',()=>{try{fs.mkdirSync(app.getPath('userData'),{recursive:true});const b=mainWindow.getNormalBounds();fs.writeFileSync(path.join(app.getPath('userData'),'window.json'),JSON.stringify({width:b.width,height:b.height}));}catch{}});
  if(smoke)mainWindow.webContents.on('did-finish-load',()=>require('./smoke.cjs')({app,window:mainWindow,smokeDir,root:ROOT}).catch(error=>{console.error(error);app.exit(1);}));
  await mainWindow.loadURL(APP_URL);
}
app.on('window-all-closed',()=>app.quit());
