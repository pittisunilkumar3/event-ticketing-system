import './registrationFields.css';
export const fieldTypes={name:'Full name',text:'Short answer',textarea:'Long answer',email:'Email address',tel:'Phone number',number:'Number',date:'Date',time:'Time',url:'Website URL',select:'Dropdown',radio:'Multiple choice',checkboxes:'Checkboxes',consent:'Consent',file:'File upload',section:'Section / description'};
export function fieldPlaceholder(field){
 if(field.placeholder?.trim())return field.placeholder;
 if(!['name','text','textarea','email','tel','number','url','select'].includes(field.type))return undefined;
 const label=(field.label||fieldTypes[field.type]).replace(/\s*\*$/, '').trim().toLowerCase();
 const hint=field.type==='email'?'Enter your email address':field.type==='url'?'https://example.com':`${field.type==='select'?'Select':'Enter'} your ${label}`;
 if(field.required)return hint;
 const optionalLabel=label==='organization / college name'?'Organization / college':field.type==='email'?'Email address':label.replace(/^./,c=>c.toUpperCase());
 return optionalLabel+' (optional)';
}
export function visibleFields(fields,answers){const shown=new Set();return fields.filter(f=>{const c=f.condition,a=answers[c?.field_id];const parent=fields.find(p=>p.id===c?.field_id);const visible=!c||(shown.has(c.field_id)&&(Array.isArray(a)?a.includes(c.value):String(a??(parent?.type==='consent'?false:''))===c.value));if(visible)shown.add(f.id);return visible;});}
export default function RegistrationFields({config,answers={},onChange=()=>{},files={},onFile=()=>{},preview=false,disabled=false,idPrefix=''}){
 return <div className="registration-fields">{visibleFields(config.fields,answers).map(f=>{
 const id=idPrefix+(preview?'preview_':'answer_')+f.id,helpId=id+'_help';
 const props={id,name:id,required:f.required,disabled,placeholder:fieldPlaceholder(f),'aria-describedby':f.help?helpId:undefined};
 return <div className="registration-field" style={{'--field-width':f.width}} key={f.id}>{f.type==='section'?<div className="registration-section"><h3>{f.label}</h3>{f.help&&<p>{f.help}</p>}</div>:<>
 {['radio','checkboxes'].includes(f.type)?<fieldset disabled={disabled} aria-describedby={f.help?helpId:undefined}><legend>{f.label}{f.required&&<span aria-hidden="true"> *</span>}</legend><div className="registration-options">{f.options.map((o,i)=><label key={i}><input type={f.type==='radio'?'radio':'checkbox'} name={id} value={o} required={f.type==='radio'?f.required:f.required&&!(answers[f.id]?.length)&&i===0} checked={f.type==='radio'?answers[f.id]===o:(answers[f.id]||[]).includes(o)} onChange={e=>onChange(f.id,f.type==='radio'?o:e.target.checked?[...(answers[f.id]||[]),o]:(answers[f.id]||[]).filter(v=>v!==o))}/><span>{o}</span></label>)}</div></fieldset>:f.type==='consent'?<label className="registration-consent"><input {...props} type="checkbox" checked={answers[f.id]===true} onChange={e=>onChange(f.id,e.target.checked)}/><span>{f.label}{f.required?' *':''}</span></label>:<><label htmlFor={id}>{f.label}{f.required&&<span aria-hidden="true"> *</span>}</label>{f.type==='textarea'?<textarea {...props} rows={4} maxLength={f.maxLength} value={answers[f.id]||''} onChange={e=>onChange(f.id,e.target.value)}/>:f.type==='select'?<select {...props} value={answers[f.id]||''} onChange={e=>onChange(f.id,e.target.value)}><option value="">{fieldPlaceholder(f)}</option>{f.options.map(o=><option key={o}>{o}</option>)}</select>:f.type==='file'?<><input {...props} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>onFile(f.id,e.target.files[0]||null)}/><small>PDF, PNG, JPEG or WebP · Up to 2 MB</small>{files[f.id]&&<small>{files[f.id].name}</small>}</>:<input {...props} type={f.type==='name'?'text':f.type} min={f.type==='number'?f.min??undefined:undefined} max={f.type==='number'?f.max??undefined:undefined} step={f.type==='number'?'any':undefined} maxLength={f.maxLength} value={answers[f.id]??''} onChange={e=>onChange(f.id,e.target.value)}/>}</>}
 {f.help&&<small id={helpId}>{f.help}</small>}</>}</div>;
 })}</div>;
}
