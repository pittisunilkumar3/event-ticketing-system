import { useEffect, useRef, useState } from 'react';

/**
 * CKEditor 4 — exact port of the hostel reference project's CkEditor.tsx.
 * Loaded from the local self-hosted distribution in /public/ckeditor4/ so
 * it works offline and every plugin/skin/lang file resolves locally.
 */

const CKEDITOR_LOCAL = '/ckeditor4/ckeditor.js';

// Load script once, cache the promise
let loadPromise = null;

function loadCKEditor4() {
  if (loadPromise) return loadPromise;
  if (typeof window !== 'undefined' && window.CKEDITOR) return Promise.resolve();

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CKEDITOR_LOCAL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load CKEditor 4 from /public/ckeditor4/'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export default function CkEditor({ data, onChange }) {
  const textareaRef = useRef(null);
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);
  const onChangeRef = useRef(onChange);
  const initialDataRef = useRef(data);
  // Unique id per instance so multiple editors / remounts never collide.
  const instanceId = useRef('cke_' + Math.random().toString(36).slice(2, 10));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let destroyed = false;

    const init = async () => {
      setReady(false);
      await loadCKEditor4();
      if (destroyed || !textareaRef.current) return;

      const CKEDITOR = window.CKEDITOR;
      if (!CKEDITOR) throw new Error('CKEditor failed to initialise.');

      // Set basePath so CKEditor finds plugins/skins/langs locally
      CKEDITOR.basePath = '/ckeditor4/';

      // Replace textarea with CKEditor 4 — full toolbar matching reference project
      const editor = CKEDITOR.replace(textareaRef.current.id, {
        toolbar: [
          { name: 'document', items: ['Source', 'Save', 'NewPage', 'Preview', 'Print', 'Templates'] },
          { name: 'clipboard', items: ['Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo'] },
          { name: 'editing', items: ['Find', 'Replace', '-', 'SelectAll', '-', 'SpellChecker', 'Scayt'] },
          { name: 'forms', items: ['Form', 'Checkbox', 'Radio', 'TextField', 'Textarea', 'Select', 'Button', 'ImageButton', 'HiddenField'] },
          '/',
          { name: 'basicstyles', items: ['Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat'] },
          { name: 'paragraph', items: ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', 'CreateDiv', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock', '-', 'BidiLtr', 'BidiRtl', 'Language'] },
          { name: 'links', items: ['Link', 'Unlink', 'Anchor'] },
          { name: 'insert', items: ['Image', 'Flash', 'Table', 'HorizontalRule', 'Smiley', 'SpecialChar', 'PageBreak', 'Iframe'] },
          '/',
          { name: 'styles', items: ['Styles', 'Format', 'Font', 'FontSize'] },
          { name: 'colors', items: ['TextColor', 'BGColor'] },
          { name: 'tools', items: ['Maximize', 'ShowBlocks'] },
          { name: 'about', items: ['About'] },
        ],
        height: 450,
        width: '100%',
        entities: false,
        enterMode: CKEDITOR.ENTER_BR,
        shiftEnterMode: CKEDITOR.ENTER_P,
        autoParagraph: false,
        allowedContent: true,
        extraAllowedContent: 'p(*)[*]{*};div(*)[*]{*};li(*)[*]{*};ul(*)[*]{*};span(*)[*]{*}',
        skin: 'moono',
        uiColor: '#F9FAFB',
        fontSize_sizes: '8/8px;9/9px;10/10px;11/11px;12/12px;14/14px;16/16px;18/18px;20/20px;22/22px;24/24px;26/26px;28/28px;36/36px;48/48px;72/72px',
        font_names: 'Arial/Arial,Helvetica,sans-serif;Comic Sans MS/Comic Sans MS,cursive;Courier New/Courier New,Courier,monospace;Georgia/Georgia,serif;Lucida Sans Unicode/Lucida Sans Unicode,Lucida Grande,sans-serif;Tahoma/Tahoma,Geneva,sans-serif;Times New Roman/Times New Roman,Times,serif;Trebuchet MS/Trebuchet MS,Helvetica,sans-serif;Verdana/Verdana,Geneva,sans-serif',
        toolbarCanCollapse: false,
        removeButtons: '',
      });

      // Set initial data
      editor.setData(initialDataRef.current || '');

      // Listen for changes
      editor.on('change', () => {
        isInternalChange.current = true;
        onChangeRef.current(editor.getData());
        isInternalChange.current = false;
      });

      editor.on('instanceReady', () => {
        if (!destroyed) setReady(true);
      });

      editorRef.current = editor;
    };

    init();

    return () => {
      destroyed = true;
      if (editorRef.current) {
        try { editorRef.current.destroy(); } catch { /* ignore */ }
        editorRef.current = null;
      }
    };
  }, []);

  // Update editor data when data prop changes externally (e.g., from API)
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      const currentData = editorRef.current.getData();
      if (currentData !== data) {
        editorRef.current.setData(data || '');
      }
    }
  }, [data]);

  return (
    <div className="ckeditor4-wrapper">
      {!ready && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin h-6 w-6 mr-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading editor...
        </div>
      )}
      <textarea
        ref={textareaRef}
        id={instanceId.current}
        defaultValue={data || ''}
        style={{ display: ready ? 'none' : 'block' }}
      />
    </div>
  );
}
