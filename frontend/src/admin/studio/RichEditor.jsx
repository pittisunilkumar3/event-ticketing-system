import { useEffect, useMemo, useRef, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor, Essentials, Paragraph, Heading, Bold, Italic, Underline,
  Strikethrough, FontFamily, FontSize, FontColor, FontBackgroundColor,
  Alignment, Link, List, Indent, IndentBlock, BlockQuote, Table,
  TableToolbar, HorizontalLine, RemoveFormat, SourceEditing,
  FindAndReplace, SelectAll, PasteFromOffice, Subscript, Superscript,
  SpecialCharacters, SpecialCharactersEssentials, ShowBlocks, Fullscreen,
  Image, ImageUpload, ImageInsert, ImageToolbar, ImageCaption, ImageStyle,
  ImageResize, ImageTextAlternative,
} from 'ckeditor5';
import api from '../../api/client';
import 'ckeditor5/ckeditor5.css';

function ImageUploadAdapter(editor) {
  editor.plugins.get('FileRepository').createUploadAdapter = loader => {
    const controller = new AbortController();
    return {
      async upload() {
        const file = await loader.file;
        if (!file || !['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
        if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
        const body = new FormData(); body.append('image', file);
        const { data } = await api.post('/admin/studio/upload', body, {
          signal: controller.signal,
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: progress => { loader.uploadTotal = progress.total || file.size; loader.uploaded = progress.loaded; },
        });
        return { default: data.data.url };
      },
      abort() { controller.abort(); },
    };
  };
}

export default function RichEditor({ value, onChange, label = 'Message', placeholder = 'Write your message…', editorRef }) {
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [initialData] = useState(value || '');
  const instance = useRef(null);
  const syncing = useRef(false);
  useEffect(() => {
    const editor = instance.current;
    if (!editor || editor.getData() === (value || '')) return;
    syncing.current = true;
    try {
      if (editor.plugins.get('SourceEditing').isSourceEditingMode) editor.plugins.get('SourceEditing').isSourceEditingMode = false;
      editor.setData(value || '');
    } finally { syncing.current = false; }
  }, [value]);
  const config = useMemo(() => ({
    licenseKey: import.meta.env.VITE_CKEDITOR_LICENSE_KEY || 'GPL',
    plugins: [Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough,
      FontFamily, FontSize, FontColor, FontBackgroundColor, Alignment, Link, List,
      Indent, IndentBlock, BlockQuote, Table, TableToolbar, HorizontalLine, RemoveFormat, SourceEditing,
      FindAndReplace, SelectAll, PasteFromOffice, Subscript, Superscript, SpecialCharacters,
      SpecialCharactersEssentials, ShowBlocks, Fullscreen, Image, ImageUpload, ImageInsert,
      ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageTextAlternative],
    extraPlugins: [ImageUploadAdapter],
    toolbar: {
      items: ['sourceEditing', '|', 'undo', 'redo', '|', 'findAndReplace', 'selectAll', '-',
        'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'removeFormat', '|',
        'numberedList', 'bulletedList', 'outdent', 'indent', 'blockQuote', 'alignment', '-',
        'link', 'insertImage', 'insertTable', 'horizontalLine', 'specialCharacters', '|', 'showBlocks', 'fullscreen', '-',
        'heading', 'fontFamily', 'fontSize', '|', 'fontColor', 'fontBackgroundColor'],
      shouldNotGroupWhenFull: true,
    },
    fontSize: { options: [8, 9, 10, 11, 12, 14, 'default', 16, 18, 20, 22, 24, 26, 28, 36, 48, 72] },
    fontFamily: { options: ['default', 'Arial, Helvetica, sans-serif', 'Comic Sans MS, cursive',
      'Courier New, Courier, monospace', 'Georgia, serif', 'Lucida Sans Unicode, Lucida Grande, sans-serif',
      'Tahoma, Geneva, sans-serif', 'Times New Roman, Times, serif', 'Trebuchet MS, Helvetica, sans-serif', 'Verdana, Geneva, sans-serif'] },
    link: { defaultProtocol: 'https://', allowedProtocols: ['https?', 'mailto'] },
    table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] },
    image: { toolbar: ['imageTextAlternative', 'toggleImageCaption', '|', 'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'resizeImage'] },
    fullscreen: { menuBar: { isVisible: false } },
    placeholder,
  }), [placeholder]);
  return <div className="studio-rich-editor" onInput={event => {
    if (event.target.matches('.ck-source-editing-area textarea')) {
      instance.current?.plugins.get('SourceEditing').updateEditorData();
    }
  }}>
    {error && <p role="alert" className="studio-error">{error}</p>}
    {!ready && !error && <p role="status" className="studio-editor-loading">Loading CKEditor…</p>}
    <CKEditor editor={ClassicEditor} config={config} data={initialData}
      onReady={editor => {
        instance.current = editor;
        if (editor.getData() !== (value || '')) {
          syncing.current = true;
          try { editor.setData(value || ''); } finally { syncing.current = false; }
        }
        setError('');
        setReady(true);
        editor.editing.view.change(writer => writer.setAttribute('aria-label', label, editor.editing.view.document.getRoot()));
        if (editorRef) editorRef.current = {
          insertText(text) {
            if (editor.plugins.get('SourceEditing').isSourceEditingMode) {
              editor.plugins.get('SourceEditing').isSourceEditingMode = false;
            }
            editor.model.change(writer => editor.model.insertContent(writer.createText(text)));
            editor.editing.view.focus();
          },
        };
      }}
      onChange={(_, editor) => { if (!syncing.current) onChange(editor.getData()); }}
      onAfterDestroy={() => { instance.current = null; if (editorRef) editorRef.current = null; }}
      onError={() => setError('The editor could not load. Please refresh the page and try again.')}
    />
  </div>;
}
