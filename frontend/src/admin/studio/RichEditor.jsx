import CkEditor from '../CkEditor';

// All policy and email editors share the hostel project's classic editor.
export default function RichEditor({value='',...props}) {
 return <CkEditor data={value} {...props}/>;
}
