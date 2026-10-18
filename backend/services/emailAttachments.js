const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const db=require('../config/db');
const root=process.env.EMAIL_ATTACHMENT_DIR||path.join(__dirname,'..','private','email-attachments');
const fail=message=>{throw Object.assign(new Error(message),{statusCode:400});};
function directory(){const id=db.current()?.id;if(!Number.isSafeInteger(Number(id)))fail('Organizer context is required.');return path.join(root,String(id));}
function fileId(id){if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id))fail('Choose a valid PDF attachment.');return id;}
async function metadata(id){fileId(id);try{return JSON.parse(await fs.readFile(path.join(directory(),id+'.json'),'utf8'));}catch{fail('PDF attachment not found in this organization.');}}
async function upload(file){
 if(!file||file.size>5*1024*1024||!file.buffer.subarray(0,5).equals(Buffer.from('%PDF-'))||!file.originalname.toLowerCase().endsWith('.pdf'))fail('Choose a PDF file up to 5 MB.');
 const id=crypto.randomBytes(16).toString('hex'),dir=directory();await fs.mkdir(dir,{recursive:true,mode:0o700});
 const info={id,name:path.basename(file.originalname).replace(/[\r\n\x00-\x1f]/g,'').slice(0,160)||'attachment.pdf',size:file.size};
 await fs.writeFile(path.join(dir,id+'.pdf'),file.buffer,{mode:0o600,flag:'wx'});await fs.writeFile(path.join(dir,id+'.json'),JSON.stringify(info),{mode:0o600,flag:'wx'});return info;
}
async function list(config){const files=await Promise.all((config.attachments||[]).map(a=>metadata(a.id)));if(files.reduce((n,f)=>n+f.size,0)>10*1024*1024)fail('Use up to 10 MB of PDFs per email.');return files;}
async function read(id){const info=await metadata(id);return {...info,content:await fs.readFile(path.join(directory(),fileId(id)+'.pdf'))};}
function needsTicket(config){return config.attach_ticket_pdf===true||/{{\s*ticket_pdf\s*}}/.test(JSON.stringify(config));}
async function build(config,brand,data){
 const result=[];
 for(const item of await list(config)){const file=await read(item.id);result.push({filename:file.name,content:file.content,contentType:'application/pdf',contentDisposition:'attachment'});}
 if(needsTicket(config)){
  const tickets=data.ticket_code?[data]:(data.tickets||[]).map(ticket=>({
   ...data,...require('./ticketEmails').values(ticket,ticket.answers_json?JSON.parse(ticket.answers_json):[]),
  }));
  const seen=new Set();
  for(const ticket of tickets){
   if(!ticket.ticket_code||seen.has(ticket.ticket_code))continue;
   seen.add(ticket.ticket_code);
   result.push({filename:'ticket-'+ticket.ticket_code+'.pdf',content:await require('./ticketPdf')(ticket,brand,config),contentType:'application/pdf',contentDisposition:'attachment'});
  }
 }
 return result;
}
module.exports={upload,metadata,list,read,build,needsTicket};
