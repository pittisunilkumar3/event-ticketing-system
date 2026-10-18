const test=require('node:test'),assert=require('node:assert/strict');
const forms=require('../services/registrationForms');
const field=(id,type,rest={})=>({id:'f_'+id,type,label:id,required:false,width:12,options:[],...rest});
const config=fields=>forms.validate({title:'Registration',description:'',enabled:true,fields});
test('validates all supported field types and rejects duplicate IDs and invalid conditions',()=>{
 const fields=forms.types.map(t=>field(t,t,{options:['A','B']}));assert.equal(config(fields).fields.length,15);
 for(const list of [[field('a','unknown')],[field('a','text'),field('a','text')],[field('a','select',{options:['One']})],[field('a','text',{condition:{field_id:'f_missing',value:'yes'}})],[field('a','number',{min:10,max:2})]])assert.throws(()=>config(list));
});
test('checks required answers, choices, text limits, numeric ranges, dates and safe URLs',()=>{
 const c=config([field('name','text',{required:true,maxLength:4}),field('age','number',{min:18,max:100}),field('day','date'),field('website','url'),field('choice','checkboxes',{options:['A','B']}),field('consent','consent',{required:true})]);
 const valid={f_name:'Alex',f_age:21,f_day:'2028-02-29',f_website:'https://example.com',f_choice:['A'],f_consent:true};assert.equal(forms.answersFor(c,valid)[1].value,21);
 for(const changes of [{f_name:''},{f_name:'Too long'},{f_age:17},{f_age:'NaN'},{f_day:'2027-02-29'},{f_website:'javascript:alert(1)'},{f_choice:['A','A']},{f_choice:['C']},{f_consent:false},{f_consent:'true'},{f_extra:'injected'}])assert.throws(()=>forms.answersFor(c,{...valid,...changes}));
});
test('conditional required questions are checked only when all parents are visible',()=>{
 const c=config([field('choice','radio',{options:['Yes','No']}),field('follow','select',{options:['A','B'],required:true,condition:{field_id:'f_choice',value:'Yes'}}),field('detail','text',{required:true,condition:{field_id:'f_follow',value:'A'}})]);
 assert.equal(forms.answersFor(c,{f_choice:'No',f_follow:'A'}).length,1);
 assert.throws(()=>forms.answersFor(c,{f_choice:'Yes'}));
 assert.throws(()=>forms.answersFor(c,{f_choice:'Yes',f_follow:'A'}));
 assert.equal(forms.answersFor(c,{f_choice:'Yes',f_follow:'B'}).length,2);
});
test('file fields validate actual content and reject forged or unexpected uploads',()=>{
 const c=config([field('document','file',{required:true})]),file={fieldname:'registration_file_f_document',originalname:'document.pdf',buffer:Buffer.from('%PDF-1.7\nfixture')};
 assert.equal(forms.answersFor(c,{},[file])[0].value.mime,'application/pdf');
 assert.throws(()=>forms.answersFor(c,{}));assert.throws(()=>forms.answersFor(c,{},[{...file,buffer:Buffer.from('<script>bad</script>')}]));assert.throws(()=>forms.answersFor(c,{},[{...file,fieldname:'registration_file_f_other'}]));
 assert.deepEqual(forms.answersFor({...c,enabled:false},{f_document:'anything'}),[]);
});
test.after(()=>require('../config/db').end());
const attendees=require('../services/attendees');
const custom=fields=>({config:forms.validate({title:'Pass details',enabled:true,attendee_mode:'fields',fields})});
const people=(form,answers={},other={})=>attendees.validate([{ticket_type_id:1,qty:1,attendees:[{registration_answers:answers,...other}]}],form).get(1)[0];
test('organizer fields control identity and required rules without mandatory defaults',()=>{
 const form=custom([field('name','name',{required:true}),field('email','email'),field('phone','tel')]);
 assert.throws(()=>people(form,{}, {name:'Cannot bypass required answer',email:'x@y.test',phone:'12345678'}),/required/);
 const guest=people(form,{f_name:'  Real Guest  '});
 assert.equal(guest.name,'Real Guest');assert.equal(guest.email,'');assert.equal(guest.phone,'');
 assert.throws(()=>people(form,{f_name:'Guest',f_email:'invalid'}),/email/);
 assert.throws(()=>people(form,{f_name:'Guest',f_phone:'------'}),/phone/);
 assert.equal(people(custom([]),{}, {name:'Ignore injected identity',email:'injected@other.test'}).name,'Attendee 1');
 assert.equal(people(custom([])).email,'');
 for(const type of ['name','email','tel'])assert.throws(()=>people(custom([field('contact',type,{required:true})])),/required/);
 const filled=people(form,{f_name:'Guest',f_email:'GUEST@EXAMPLE.TEST',f_phone:'+91 9876543210'});
 assert.equal(filled.email,'guest@example.test');assert.equal(filled.phone,'+91 9876543210');
 assert.deepEqual(form.config.fields.map(f=>f.maxLength),[150,254,40]);
});
test('hidden and disabled identity fields are omitted; changed versions cannot bypass required fields',()=>{
 const form=custom([field('choice','select',{options:['Yes','No']}),field('name','name',{required:true,condition:{field_id:'f_choice',value:'Yes'}})]);
 assert.equal(people(form,{f_choice:'No',f_name:'Hidden Name'}).name,'Attendee 1');
 assert.throws(()=>people(form,{f_choice:'Yes'}),/required/);
 assert.equal(people({config:{...form.config,enabled:false}}).name,'Attendee 1');
 const eventForm={config:{...form.config,enabled:false},revision:3};
 assert.throws(()=>forms.checkVersions([{ticket_type_id:1}],new Map([[1,{...eventForm,source:'event',revision:0,version:'event:3:ticket:0'}]]),eventForm,2),/changed/);
});
test('booking contact uses one validated attendee without mixing identities or inventing contact values',()=>{
 const first={name:'First',email:'',phone:'12345678'},second={name:'Second',email:'second@example.test',phone:''};
 assert.deepEqual(attendees.bookingContact(new Map([[1,[first,second]]])),{customer_name:'Second',email:'second@example.test',phone:null});
 assert.deepEqual(attendees.bookingContact(new Map([[1,[first]]])),{customer_name:'First',email:'',phone:'12345678'});
 assert.throws(()=>attendees.bookingContact(new Map()),/attendee/);
});
