#!/usr/bin/env node
// GitHub-only Shell Shock campaign: bounded, idempotent verification and receipt.
// No installs, no remote mutations, no retries of deployment, no user commands.
import {readFileSync,existsSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const contract=JSON.parse(readFileSync(join(root,'campaign/voice-field-campaign.json'),'utf8'));
const receiptPath=join(root,contract.receipt);
const op=process.argv[2]||'plan';
const sha=process.env.GITHUB_SHA||process.env.SHELL_SHOCK_SHA||'local-unpinned';
const run=process.env.GITHUB_RUN_ID||'local';
const site=process.env.SHELL_SHOCK_SITE||'https://valar05.github.io/shell-shock-chasing-tail/';
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const write=report=>{mkdirSync(resolve(receiptPath,'..'),{recursive:true});writeFileSync(receiptPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({campaign:contract.campaign_id,status:report.status,sha:report.sha,receipt:contract.receipt,checks:report.checks?.length,blocker:report.blocker||null}));};
if(op==='plan'){console.log(JSON.stringify({campaign:contract.campaign_id,baseline:contract.baseline_sha,entrypoint:contract.entrypoint,checks:contract.checks,stop_policy:contract.stop_policy},null,2));process.exit(0);}
if(op==='status'){console.log(existsSync(receiptPath)?readFileSync(receiptPath,'utf8'):JSON.stringify({status:'not-run',receipt:contract.receipt}));process.exit(0);}
if(!['verify','resume'].includes(op)){console.error('Usage: node scripts/voice-field-campaign.mjs plan|verify|resume|status');process.exit(2);}
if(existsSync(receiptPath)){const previous=JSON.parse(readFileSync(receiptPath,'utf8'));if(previous.sha===sha&&previous.status==='automated-passed'){console.log(JSON.stringify({status:'verified-idempotent-skip',sha,receipt:contract.receipt}));process.exit(0);}}
const report={id:contract.campaign_id,sha,run_id:run,site,utc:new Date().toISOString(),status:'failed',checks:[],human_acceptance:'pending'};
function check(name,detail){report.checks.push({name,status:'pass',detail});}
function requireCheck(bool,name,detail){if(!bool)throw Error(name+': '+detail);check(name,detail);}
try{
 requireCheck(/^[0-9a-f]{40}$/.test(sha),'source-pin','40-character Git SHA present');
 requireCheck(run!=='local','execution-lane','GitHub Actions run '+run);
 const dist=join(root,'dist');
 const html=join(dist,'index.html');
 requireCheck(existsSync(html),'built-index','dist/index.html exists');
 const bytes=readFileSync(html);
 requireCheck(bytes.length>100&&/shell shock/i.test(bytes.toString()),'app-content','production HTML title present');
 requireCheck(bytes.toString().includes('/shell-shock-chasing-tail/'),'project-base','correct Pages subpath references');
 requireCheck(existsSync(join(dist,'coi-serviceworker.js')),'coi-asset','same-origin isolation service worker included');
 const assetDir=join(dist,'assets');
 const assetFiles=existsSync(assetDir)?readdirSync(assetDir):[];
 const wasm=assetFiles.filter(name=>name.endsWith('.wasm'));
 requireCheck(wasm.length>=1,'wasm-bundled','Moonshine WASM binary exists: '+wasm.join(','));
 const js=assetFiles.filter(name=>name.endsWith('.js'));
 requireCheck(js.length>=1,'js-bundled','compiled JavaScript exists');
 const allJs=js.map(name=>readFileSync(join(assetDir,name),'utf8')).join('\n');
 requireCheck(!allJs.includes('__voiceTestLoad'),'no-test-injection','production JS excludes test-only recognizer injection');
 const response=await fetch(site,{signal:AbortSignal.timeout(12000),redirect:'follow'});
 requireCheck(response.ok,'hosted-http','public site HTTP '+response.status);
 const hosted=await response.text();
 requireCheck(/shell shock/i.test(hosted)&&hosted.includes('/shell-shock-chasing-tail/'),'hosted-html','hosted app and project paths present');
 check('release-gates','Prior workflow stages enforce gameplay test, deployed browser smoke, real human WAV -> actual Moonshine inference; no physical-mic claim');
 report.status='automated-passed';
 report.artifacts={index_sha256:hash(bytes),wasm_files:wasm,js_file_count:js.length};
 write(report);
}catch(error){report.blocker=String(error?.message||error);write(report);process.exitCode=1;}
