import './create-icon.mjs';
import {packager} from '@electron/packager';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const builds=await packager({dir:root,out:path.join(root,'release'),name:'Расписание процедур',executableName:'Schedule',platform:'win32',arch:'x64',asar:true,overwrite:true,prune:true,icon:path.join(root,'desktop','icon.ico'),appBundleId:'ru.procedureplanner.desktop',appCopyright:'Расписание процедур',win32metadata:{CompanyName:'Расписание процедур',FileDescription:'Редактор расписания процедур',ProductName:'Расписание процедур',InternalName:'Schedule',OriginalFilename:'Schedule.exe'},ignore:[/^\/Проекты(\/|$)/,/^\/[^/]+\.exe$/,/^\/artifacts(\/|$)/,/^\/release(\/|$)/,/^\/tests(\/|$)/,/^\/docs(\/|$)/,/^\/scripts(\/|$)/,/^\/.*\.lnk$/,/^\/[^/]+\.bat$/,/^\/\.git(\/|$)/,/^\/(AGENTS|PROJECT_STATE|CHANGELOG)\.md$/]});
console.log('Готовое приложение:',builds.join('\n'));
