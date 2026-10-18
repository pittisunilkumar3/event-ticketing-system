const test=require('node:test'),assert=require('node:assert/strict');
const report=require('../services/ticketReport');
test('ticket filters reject malformed IDs, dates, pagination and unrecognized statuses',()=>{
 for(const query of [{page:'0'},{limit:'101'},{event_id:'1 OR 1=1'},{event_id:['1']},{from:'2026-02-30'},{from:'2026-10-20',to:'2026-10-01'},{status:'all'},{ticket_status:'sold'},{booking_group:'all'},{search:'a'.repeat(201)}])assert.throws(()=>report.filters(query));
 const filters=report.filters({search:'guest_100%=',from:'2026-10-01',to:'2026-10-01'});
 const query=report.where(filters);assert.equal(filters.booking_group,'real');assert.match(query.sql,/DATE_ADD/);assert.ok(query.values.includes('%guest=_100=%==%'));assert.doesNotMatch(query.sql,/guest_100/);
});
test('CSV preserves quotes, commas and multiline text and neutralizes spreadsheet formulas',()=>{
 assert.equal(report.csvCell('A,"B"\nC'),'"A,""B""\nC"');
 for(const value of ['=1+1','+919999999999','-2','@SUM(A1)',' \t=HYPERLINK("bad")','\nname'])assert.ok(report.csvCell(value).startsWith('"\''));
 const row=report.csvRow({attendee_name:'A, B',answers_json:JSON.stringify([{label:'City',value:'Hyderabad'},{label:'Choices',value:['One','Two']}])});
 assert.match(row,/City: Hyderabad\nChoices: One; Two/);assert.ok(report.csvHeader().startsWith('\ufeff'));assert.doesNotMatch(row,/undefined/);
});
test.after(()=>require('../config/db').end());
