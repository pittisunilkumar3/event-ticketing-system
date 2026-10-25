from pathlib import Path
import shutil,subprocess,datetime,urllib.request,urllib.error
root=Path('/opt/ticketflow/app/backend');stage=Path('/tmp/ticketflow-scanner-release')
backup=Path('/root/ticketflow-backup-scanner-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
files=['server.js','saas/tenancy.js','routes/scannerRoutes.js','services/scanner.js']
existed={name:(root/name).exists() for name in files}
for name in files:
 if existed[name]:
  dest=backup/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/name,dest)
server=(root/'server.js').read_text();anchor="tenant.use('/admin/tickets', require('./routes/ticketRoutes'));";line="tenant.use('/admin/scanner', require('./routes/scannerRoutes'));"
assert server.count(anchor)==1,'Unexpected server layout'
tenancy=(root/'saas/tenancy.js').read_text();old="'/admin/tickets/checkin','/booking-payments/verify'";new="'/admin/tickets/checkin','/admin/scanner/verify','/admin/scanner/checkin','/booking-payments/verify'"
assert old in tenancy or new in tenancy,'Unexpected tenancy layout'
try:
 for name in ['routes/scannerRoutes.js','services/scanner.js']:shutil.copy2(stage/name,root/name)
 if line not in server:(root/'server.js').write_text(server.replace(anchor,anchor+'\n'+line))
 (root/'saas/tenancy.js').write_text(tenancy.replace(old,new))
 for name in files:subprocess.run(['/opt/ticketflow/runtime/bin/node','--check',str(root/name)],check=True)
 subprocess.run(['systemctl','restart','ticketflow'],check=True)
 subprocess.run(['systemctl','is-active','--quiet','ticketflow'],check=True)
 import time
 for attempt in range(15):
  try:
   with urllib.request.urlopen('http://127.0.0.1:5017/',timeout=3) as r:assert r.status==200
   break
  except Exception:
   if attempt==14:raise
   time.sleep(1)
 try:urllib.request.urlopen('http://127.0.0.1:5017/api/o/cinematica-expo/admin/scanner/events',timeout=5)
 except urllib.error.HTTPError as e:assert e.code==401,'Scanner did not enforce authentication'
 else:raise RuntimeError('Scanner unexpectedly allowed anonymous access')
 print('Scanner deployed. API healthy; anonymous access rejected. Backup: '+str(backup))
except Exception:
 for name in files:
  if existed[name]:shutil.copy2(backup/name,root/name)
  elif (root/name).exists():(root/name).unlink()
 subprocess.run(['systemctl','restart','ticketflow'],check=True)
 print('Deployment failed; restored previous server files.')
 raise
