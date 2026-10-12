import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// vNN-gameplay modules export checks that runtime.mjs runs inside the live game harness.
const dir=fileURLToPath(new URL('./',import.meta.url));
const files=(await readdir(dir)).filter(f=>f.endsWith('.mjs')&&f!=='run-all.mjs'&&!/^v\d+-gameplay\.mjs$/.test(f)).sort();
let failed=0;
for(const file of files){
 const started=performance.now(),run=spawnSync(process.execPath,[dir+file],{encoding:'utf8'});
 const seconds=((performance.now()-started)/1000).toFixed(1);
 if(run.status===0)console.log(`ok    ${file} (${seconds}s)`);
 else{failed++;console.log(`FAIL  ${file} (${seconds}s)\n${(run.stderr||run.stdout).trim()}`);}
}
console.log(failed?`${failed} of ${files.length} test files failed`:`all ${files.length} test files passed`);
process.exit(failed?1:0);
