import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../src/saas/'+path,import.meta.url),'utf8');
const [layout,platform,workspace,emails,smtp]=await Promise.all(['PlatformLayout.jsx','Platform.jsx','PlatformWorkspace.jsx','PlatformEmails.jsx','PlatformSettings.jsx'].map(read));
// Keep navigation, deep links and contextual actions aligned after the rename.
assert.doesNotMatch(layout, /<p>MANAGE<\/p>/);
const sidebarStyles=await read('platform.css');
assert.doesNotMatch(sidebarStyles,/admin-nav-group\s*\+\s*\.admin-nav-group::before|admin-nav-group button/);
assert.match(layout,/<Link key=\{label\} to=/);
for (const category of ['Workspace', 'Billing', 'Email', 'Website']) assert.ok(layout.includes("label:'"+category+"', items:"));
assert.match(layout,/\['SMTP settings', 'mail'\]/);
assert.match(layout,/\['Payment configuration', 'credit-card'\]/);
assert.match(platform,/'SMTP settings':'settings'/);
assert.match(platform,/'Payment configuration':'payment-configuration'/);
assert.match(platform,/selectSection\('SMTP settings'\)/);
assert.match(workspace,/onSelect\('Payment configuration'\)/);
assert.match(emails,/SMTP settings to send a test/);
assert.match(smtp,/<Panel title="Send test email"><form/);
assert.match(smtp,/Save SMTP settings/);
for(const source of [layout,platform,workspace,emails,smtp]) {
 assert.doesNotMatch(source,/\['Settings',|(?:tab===|selectSection\(|onSelect\()'Settings'|in Settings to send|Open platform settings/);
 assert.doesNotMatch(source,/Payment credentials are managed in the server configuration/);
}
console.log('Platform settings navigation and visible email test checks passed.');
