export default function AttendeeAnswers({answers=[],onDownload}) {
 if(!answers.length)return null;
 return <dl className="attendee-answers">{answers.map(a=><div key={a.id}><dt>{a.label}</dt><dd>{a.type==='file'?(a.value?(onDownload?<button type="button" onClick={()=>onDownload(a)}>Download {a.value.name}</button>:a.value.name):'—'):Array.isArray(a.value)?a.value.join(', ')||'—':typeof a.value==='boolean'?(a.value?'Yes':'No'):String(a.value??'')||'—'}</dd></div>)}</dl>;
}
