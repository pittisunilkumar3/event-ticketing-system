import {useEffect,useState} from 'react';
export function certificateError(file) {
  if(!file)return 'Upload the Udyam certificate for this attendee.';
  if(file.size>2*1024*1024)return 'The Udyam certificate must be 2 MB or smaller.';
  if(!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))return 'Choose a PDF, PNG, JPEG or WebP certificate.';
  return '';
}
export function udyamItems(items,records={}) {
  return items.map(item=>({ticket_type_id:item.id,qty:item.qty,attendees:Array.from({length:item.qty},(_,index)=>{
    const record=records[item.id+'_'+index];return record?.number?{udyam_number:record.number}:{};
  })}));
}
export function duplicateNumbers(records) {
  const counts=new Map();
  for(const record of Object.values(records)){if(record.number)counts.set(record.number,(counts.get(record.number)||0)+1);}
  return Object.fromEntries(Object.entries(records).map(([key,record])=>[key,counts.get(record.number)>1?{...record,status:'duplicate',error:'Use this Udyam Registration Number for one ticket only. Clear the duplicate field.'}:record]));
}
export default function useUdyam({policy,resetKey}) {
  const enabled=Boolean(policy?.enabled),[records,setRecords]=useState({});
  useEffect(()=>{setRecords({});},[resetKey,enabled,policy?.revision]);
  function change(key,input) {
    const number=input.toUpperCase().trim(),valid=/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(number);
    setRecords(current=>({...current,[key]:{number,status:valid?'accepted':'invalid',error:number&&!valid?'Use UDYAM, two state letters, two digits and seven digits.':''}}));
  }
  function upload(key,certificate) {
    setRecords(current=>({...current,[key]:{...current[key],certificate,fileError:certificate?certificateError(certificate):''}}));
  }
  const displayed=duplicateNumbers(records);
  const entered=Object.values(displayed).some(r=>r.number);
  const blocked=Object.values(displayed).some(r=>r.number&&r.status!=='accepted');
  return {records:displayed,change,upload,entered,blocked,enabled,policy};
}
