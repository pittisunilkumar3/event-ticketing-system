import {useEffect,useId,useRef,useState} from 'react';
import api from '../api/client';

// The same self-hosted CKEditor 4 distribution and Moono skin as the hostel project.
let loadPromise;
function loadEditor(){
 if(window.CKEDITOR?.replace)return Promise.resolve(window.CKEDITOR);
 if(!loadPromise)loadPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/ckeditor4/ckeditor.js';
  script.onload=()=>{if(window.CKEDITOR?.replace)resolve(window.CKEDITOR);else{script.remove();loadPromise=null;reject(new Error('Editor unavailable'));}};
  script.onerror=()=>{script.remove();loadPromise=null;reject(new Error('Editor unavailable'));};
  document.head.appendChild(script);
 });
 return loadPromise;
}
export default function CkEditor({data='',onChange,label='Message',editorRef,client=api,uploadUrl='/admin/studio/upload',disabled=false,onBusy}){
 const id='classic-editor-'+useId().replace(/:/g,''),textarea=useRef(null),fileInput=useRef(null),instance=useRef(null);
 const latest=useRef({data,onChange,disabled,onBusy}),syncing=useRef(false),lastEmitted=useRef(null);
 latest.current={data,onChange,disabled,onBusy};
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[uploading,setUploading]=useState(false);
 useEffect(()=>{
  let disposed=false,editor;
  loadEditor().then(CKEDITOR=>{
   if(disposed||!textarea.current)return;
   editor=CKEDITOR.replace(textarea.current,{
    customConfig:'',language:'en',skin:'moono',uiColor:'#F9FAFB',height:450,width:'100%',
    title:label,readOnly:latest.current.disabled,entities:false,enterMode:CKEDITOR.ENTER_BR,shiftEnterMode:CKEDITOR.ENTER_P,
    autoParagraph:false,allowedContent:true,toolbarCanCollapse:false,resize_enabled:false,
    // Keep the reference editing tools; stored HTML is still sanitized by our API.
    removePlugins:'forms,flash,iframe,scayt,wsc,save,preview,print,templates',
    toolbar:[
     {name:'document',items:['Source','-','NewPage']},
     {name:'clipboard',items:['Cut','Copy','Paste','PasteText','PasteFromWord','-','Undo','Redo']},
     {name:'editing',items:['Find','Replace','-','SelectAll']},'/',
     {name:'basicstyles',items:['Bold','Italic','Underline','Strike','Subscript','Superscript','-','RemoveFormat']},
     {name:'paragraph',items:['NumberedList','BulletedList','-','Outdent','Indent','-','Blockquote','CreateDiv','-','JustifyLeft','JustifyCenter','JustifyRight','JustifyBlock','-','BidiLtr','BidiRtl']},
     {name:'links',items:['Link','Unlink','Anchor']},
     {name:'insert',items:['Image','UploadImage','Table','HorizontalRule','Smiley','SpecialChar','PageBreak']},'/',
     {name:'styles',items:['Styles','Format','Font','FontSize']},
     {name:'colors',items:['TextColor','BGColor']},
     {name:'tools',items:['Maximize','ShowBlocks']},
     {name:'about',items:['About']},
    ],
    fontSize_sizes:'8/8px;9/9px;10/10px;11/11px;12/12px;14/14px;16/16px;18/18px;20/20px;22/22px;24/24px;26/26px;28/28px;36/36px;48/48px;72/72px',
    font_names:'Arial/Arial,Helvetica,sans-serif;Comic Sans MS/Comic Sans MS,cursive;Courier New/Courier New,Courier,monospace;Georgia/Georgia,serif;Lucida Sans Unicode/Lucida Sans Unicode,Lucida Grande,sans-serif;Tahoma/Tahoma,Geneva,sans-serif;Times New Roman/Times New Roman,Times,serif;Trebuchet MS/Trebuchet MS,Helvetica,sans-serif;Verdana/Verdana,Geneva,sans-serif',
    contentsCss:['/ckeditor4/contents.css'],baseFloatZIndex:10000,
   });
   instance.current=editor;
   editor.addCommand('ticketflowUpload',{exec:()=>fileInput.current?.click()});
   editor.ui.addButton('UploadImage',{label:'Upload image',command:'ticketflowUpload',icon:'/ckeditor4-upload.svg'});
   const emit=()=>{
    if(disposed||syncing.current)return;
    const html=editor.getData();lastEmitted.current=html;latest.current.onChange(html);
   };
   const bindEditable=()=>{
    const editable=editor.editable();
    if(editable){editable.setAttribute('aria-label',editor.mode==='source'?label+' HTML source':label);editable.on('input',emit);}
   };
   editor.on('change',emit);editor.on('mode',bindEditable);
   editor.on('instanceReady',()=>{
    if(disposed)return;
    syncing.current=true;
    editor.setData(latest.current.data||'',()=>{syncing.current=false;bindEditable();if(!disposed){setReady(true);setError('');}});
    if(editorRef)editorRef.current={insertText(text){
     if(editor.readOnly)return;
     if(editor.mode==='source'){
      const field=editor.editable().$;const start=field.selectionStart,end=field.selectionEnd;
      field.value=field.value.slice(0,start)+text+field.value.slice(end);field.selectionStart=field.selectionEnd=start+text.length;emit();field.focus();
     }else{editor.focus();editor.insertText(text);emit();}
    },getData:()=>editor.getData()};
   });
  }).catch(()=>{if(!disposed)setError('Unable to load CKEditor. Please try again.');});
  return()=>{disposed=true;instance.current=null;if(editorRef)editorRef.current=null;try{editor?.destroy(true);}catch{/* Already destroyed during a page change. */}};
 },[attempt,label,editorRef]);
 useEffect(()=>{
  const editor=instance.current;if(!ready||!editor||data===lastEmitted.current||editor.getData()===data)return;
  syncing.current=true;editor.setData(data||'',()=>{syncing.current=false;});
 },[data,ready]);
 useEffect(()=>{if(ready)instance.current?.setReadOnly(disabled);},[disabled,ready]);
 async function upload(event){
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024){setError('Choose a PNG, JPEG, WebP or GIF smaller than 5 MB.');return;}
  const editor=instance.current;setUploading(true);setError('');latest.current.onBusy?.(true);
  try{const body=new FormData();body.append('image',file);const {data:r}=await client.post(uploadUrl,body,{headers:{'Content-Type':'multipart/form-data'}});if(editor!==instance.current)return;
   const CKEDITOR=window.CKEDITOR;
   const insert=()=>{editor.focus();editor.insertHtml('<img src="'+CKEDITOR.tools.htmlEncode(r.data.url)+'" alt="" />');lastEmitted.current=editor.getData();latest.current.onChange(lastEmitted.current);};
   if(editor.mode==='source')editor.setMode('wysiwyg',insert);else insert();
  }catch(e){setError(e.response?.data?.message||'Image upload failed. Please try again.');}
  finally{setUploading(false);latest.current.onBusy?.(false);}
 }
 return <div className="studio-rich-editor ckeditor4 ckeditor4-wrapper">
  {!ready&&!error&&<p role="status">Loading CKEditor…</p>}
  {error&&<div role="alert" className="studio-error">{error}{!ready&&<button type="button" onClick={()=>{setError('');setAttempt(n=>n+1);}}>Try again</button>}</div>}
  {uploading&&<p role="status">Uploading image…</p>}
  <textarea id={id} ref={textarea} aria-label={label} defaultValue={data} style={{display:'none'}}/>
  <input ref={fileInput} type="file" aria-label={'Upload image to '+label} accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} hidden disabled={disabled||uploading}/>
 </div>;
}
