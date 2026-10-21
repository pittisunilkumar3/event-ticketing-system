import assert from 'node:assert/strict';
import {transformFrame,ticketExtent,newFrame} from '../src/components/ticketGeometry.js';
const f={x:100,y:100,w:200,h:150};
assert.deepEqual(transformFrame(f,'move',50,75,1000,'text'),{x:150,y:175,w:200,h:150});
assert.deepEqual(transformFrame(f,'move',-500,2000,1000,'text'),{x:0,y:850,w:200,h:150});
assert.deepEqual(transformFrame(f,'se',100,50,1000,'text'),{x:100,y:100,w:300,h:200});
assert.deepEqual(transformFrame(f,'nw',40,20,1000,'text'),{x:140,y:120,w:160,h:130});
for(const edge of ['n','ne','e','se','s','sw','w','nw'])for(const delta of [-9000,9000]){
 const next=transformFrame(f,edge,delta,delta,1000,'qr');
 assert.ok(next.x>=0&&next.y>=0&&next.x+next.w<=760&&next.y+next.h<=1000);
 assert.ok(next.w>=96&&next.h>=120);
}
assert.equal(ticketExtent([{frame:f}]),250);
const added=newFrame([{frame:f}],'qr',1000);assert.equal(added.w,160);assert.ok(added.y+added.h<=1000);
console.log('PASS: move, eight resize handles, canvas bounds and QR minimums.');

const source=(await import('node:fs/promises')).readFile;
const editor=await source(new URL('../src/admin/studio/TicketDesigner.jsx',import.meta.url),'utf8');
for(const removed of ['Design details','Show attendee name','Show ticket price','studio-design-controls','function changeLayout'])assert.ok(!editor.includes(removed));
console.log('PASS: removed Design details controls stay absent.');

for(const removed of ['TicketComponentEditor','ticket-edit-help','undoLayout','onCanvasHeight=','enableFreeform'])assert.ok(!editor.includes(removed));
console.log('PASS: preview modal has no component toolbar, layers, size or layout controls.');

const {snapTicketMove}=await import('../src/admin/studio/ticketAlignment.js');
const bounds={left:0,top:0,right:760,bottom:600},moving={left:20,top:20,right:120,bottom:60};
let snap=snapTicketMove(moving,bounds,[],307,0);
assert.equal(snap.dx,310);assert.ok(snap.guides.some(g=>g.axis==='x'&&g.position===380));
snap=snapTicketMove(moving,bounds,[{left:200,top:200,right:400,bottom:240}],228,179);
assert.equal(snap.dx,230);assert.equal(snap.dy,180);
assert.ok(snap.guides.some(g=>g.position===300));
snap=snapTicketMove(moving,bounds,[],307,0,0);assert.equal(snap.dx,307);
snap=snapTicketMove(moving,bounds,[],9999,9999);assert.equal(snap.dx,640);assert.equal(snap.dy,540);
console.log('PASS: ticket center, other component centers/edges, free movement and bounds.');

const presentationCss=await source(new URL('../src/components/ticketPresentation.css',import.meta.url),'utf8');
assert.match(presentationCss,/\.ticket-preserve-selection \.part-actions \{pointer-events:auto;/);
assert.match(presentationCss,/\.ticket-style-popover \{pointer-events:auto;/);
const elementStyle=await source(new URL('../src/admin/studio/TicketElementStyle.jsx',import.meta.url),'utf8');
assert.ok(elementStyle.includes('onPointerDown={e=>e.stopPropagation()}'));
assert.ok(elementStyle.includes("onKeyDown={e=>{e.stopPropagation();"));
console.log('PASS: Style controls receive pointer events and isolate canvas shortcuts.');

assert.ok(!editor.includes('window.prompt('));
assert.match(editor,/aria-label="Design name"/);
assert.match(editor,/name:selected.name.trim\(\)/);
console.log('PASS: New design uses the canvas name field instead of a browser prompt.');
assert.match(editor,/config: newTicketConfig\(data\)/);
assert.ok(!editor.includes('canvas:{height:1000}, layout_blocks:[]'));
assert.match(editor,/brand:data.brand\?\.company_name/);
console.log('PASS: new designs start with the same layout and organizer branding as existing tickets.');
