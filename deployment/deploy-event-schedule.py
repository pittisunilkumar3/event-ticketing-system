"""Deploy the staged daily-hours release, preserving files and event data for rollback."""
from pathlib import Path
import datetime, hashlib, json, shutil, subprocess, tarfile, time, urllib.request
root=Path('/opt/ticketflow/app'); stage=Path('/tmp/ticketflow-event-schedule-release')
stage.mkdir(exist_ok=True)
with tarfile.open('/tmp/ticketflow-schedule.tar.gz') as archive: archive.extractall(stage,filter='data')
manifest=json.loads((stage/'manifest.json').read_text())
for name,expected in manifest.items():
 target=root/name
 if expected and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()!=expected:
  raise RuntimeError('Live file differs from reviewed baseline: '+name)
backup=Path('/root/ticketflow-schedule-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
files=list(manifest)+['backend/generated/ticketDocument.cjs']
existing={name:(root/name).exists() for name in files}
for name in files:
 if existing[name]:
  dst=backup/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/name,dst)
shutil.copytree(root/'frontend/dist',backup/'dist')
node='/opt/ticketflow/runtime/bin/node'
migration=r'''
require('dotenv').config();const fs=require('fs'),db=require('./config/db');
(async()=>{
 const [orgs]=await db.platform.query('SELECT * FROM organizations');
 for(const org of orgs)await db.run(org,async()=>{
  await db.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_text VARCHAR(500) NOT NULL DEFAULT ""');
  await db.query('INSERT IGNORE INTO migrations(name) VALUES (?)',['027_event_schedule.sql']);
 });
 const org=orgs.find(o=>o.slug==='cinematica-expo');if(!org)throw Error('Organization missing');
 await db.run(org,async()=>{
  const [[e]]=await db.query('SELECT id,start_datetime,end_datetime,schedule_text FROM events WHERE id=1');
  if(e.start_datetime!=='2026-12-12 09:00:00'||e.end_datetime!=='2026-12-13 18:00:00')throw Error('Event dates changed');
  fs.writeFileSync(process.env.SCHEDULE_BACKUP+'/event.json',JSON.stringify(e),{mode:0o600});
  await db.query('UPDATE events SET schedule_text=? WHERE id=1',['Saturday timings: 9AM–6PM\nSunday timings: 10AM–6PM']);
 });
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.end());
'''
import os
try:
 subprocess.run([node,'-e',migration],cwd=root/'backend',env={**os.environ,'SCHEDULE_BACKUP':str(backup)},check=True)
 for name in files:
  dst=root/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(stage/name,dst)
 # Retain old hashed assets for browsers that already have the previous page open.
 shutil.copytree(stage/'frontend/dist',root/'frontend/dist',dirs_exist_ok=True)
 subprocess.run(['systemctl','restart','ticketflow'],check=True)
 for attempt in range(20):
  try:
   with urllib.request.urlopen('http://127.0.0.1:5017/api/o/cinematica-expo/events/cinematica-expo-2026',timeout=5) as response:
    payload=json.load(response)
   assert payload['data']['event']['schedule_text']=='Saturday timings: 9AM–6PM\nSunday timings: 10AM–6PM'
   break
  except Exception:
   if attempt==19:raise
   time.sleep(1)
 print('Deployed and verified. Backup: '+str(backup))
except Exception:
 for name in files:
  if existing[name]:shutil.copy2(backup/name,root/name)
  elif (root/name).exists():(root/name).unlink()
 shutil.copytree(backup/'dist',root/'frontend/dist',dirs_exist_ok=True)
 if (backup/'event.json').exists():
  restore="require('dotenv').config();const db=require('./config/db'),e=require(process.env.SCHEDULE_BACKUP+'/event.json');(async()=>{const [[o]]=await db.platform.query(\"SELECT * FROM organizations WHERE slug='cinematica-expo'\");await db.run(o,()=>db.query('UPDATE events SET schedule_text=? WHERE id=?',[e.schedule_text,e.id]));})().finally(()=>db.end());"
  subprocess.run([node,'-e',restore],cwd=root/'backend',env={**os.environ,'SCHEDULE_BACKUP':str(backup)},check=True)
 subprocess.run(['systemctl','restart','ticketflow'],check=True)
 raise
