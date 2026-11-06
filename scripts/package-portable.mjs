import {build,Platform,Arch} from 'electron-builder';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifacts=await build({
  targets:Platform.WINDOWS.createTarget('portable',Arch.x64),
  prepackaged:path.join(root,'release','Расписание процедур-win32-x64'),
  config:{
    appId:'ru.procedureplanner.desktop',productName:'Расписание процедур',
    directories:{output:path.join(root,'release')},
    artifactName:'Расписание процедур 1.0.${ext}',
    win:{icon:path.join(root,'desktop','icon.ico'),executableName:'Schedule',signAndEditExecutable:false},
    portable:{requestExecutionLevel:'user',unpackDirName:'procedure-planner-1.0.0'}
  }
});
for(const artifact of artifacts)console.log('Готовый переносимый EXE:',artifact);
