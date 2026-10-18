"""Run once as root on the dedicated TicketFlow database instance."""
import json
import os
import pathlib
import secrets
import subprocess

backend = pathlib.Path('/opt/ticketflow/app/backend')
env_file = backend / '.env'
credentials_file = pathlib.Path('/root/ticketflow-superadmin-credentials.json')
if env_file.exists() or credentials_file.exists():
    raise SystemExit('Production configuration already exists; refusing to overwrite it.')
os.umask(0o077)
password = secrets.token_hex(32)
sql = f"""
CREATE DATABASE ticketflow_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ticketflow_app'@'127.0.0.1' IDENTIFIED BY '{password}';
GRANT ALL PRIVILEGES ON ticketflow_prod.* TO 'ticketflow_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON `tf\\_%`.* TO 'ticketflow_app'@'127.0.0.1';
"""
subprocess.run(['mysql', '--no-defaults', '--socket=/run/ticketflow-db/mysql.sock', '-u', 'root'], input=sql, text=True, check=True)
values = dict(NODE_ENV='production', HOST='127.0.0.1', PORT='5017', TRUST_PROXY='loopback',
              DB_HOST='127.0.0.1', DB_PORT='3317', DB_USER='ticketflow_app', DB_PASSWORD=password,
              DB_NAME='ticketflow_prod', JWT_SECRET=secrets.token_hex(48),
              SETTINGS_ENCRYPTION_KEY=secrets.token_hex(32),
              PUBLIC_SITE_URL='https://ticket.cinica.org', BASE_DOMAIN='')
env_file.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
credentials_file.write_text(json.dumps(dict(email='admin@cinematicaexpo.com', password=secrets.token_urlsafe(24))))
print('Fresh production database, secrets and administrator credentials prepared.')
