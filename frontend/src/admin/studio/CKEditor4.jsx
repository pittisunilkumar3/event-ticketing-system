import { useEffect, useRef } from 'react';

/**
 * CKEditor 4 — the exact editor used by the cinicathon reference
 * (EmailTemplateEditor.jsx): loaded from the CKEditor 4.20.0 CDN with
 * window.CKEDITOR.replace and an email-safe configuration that keeps
 * inline styles, classes and full HTML intact.
 *
 * Props match the studio RichEditor contract so it is a drop-in swap:
 *   value, onChange, label, placeholder, editorRef ({ insertText(text) })
 */

// Shared CDN loader — guarantees the script is fetched only once no matter
// how many editors mount simultaneously.
let ckeditorScriptPromise = null;
function loadCKEditor() {
  if (window.CKEDITOR) return Promise.resolve();
  if (!ckeditorScriptPromise) {
    ckeditorScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.ckeditor.com/4.20.0/standard-all/ckeditor.js';
      script.onload = resolve;
      script.onerror = () => {
        ckeditorScriptPromise = null;
        reject(new Error('Failed to load CKEditor from CDN.'));
      };
      document.head.appendChild(script);
    });
  }
  return ckeditorScriptPromise;
}

export default function CKEditor4({ value, onChange, label = 'Message', placeholder, editorRef }) {
  const textareaRef = useRef(null);
  const editorInstance = useRef(null);
  const isReady = useRef(false);
  const disposed = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    disposed.current = false;
    let cleanup = () => {};
    loadCKEditor()
      .then(() => {
        if (disposed.current || !textareaRef.current || !window.CKEDITOR) return;
        initEditor();
      })
      .catch(() => {});
    cleanup = () => {
      disposed.current = true;
      if (editorInstance.current) {
        try { window.CKEDITOR.instances[editorInstance.current.name]?.destroy(true); } catch (e) { /* noop */ }
        editorInstance.current = null;
        isReady.current = false;
      }
      if (editorRef) editorRef.current = null;
    };
    return () => cleanup();
  }, []);

  const initEditor = () => {
    if (textareaRef.current && window.CKEDITOR && !editorInstance.current) {
      const editor = window.CKEDITOR.replace(textareaRef.current, {
        toolbar: [
          { name: 'basicstyles', items: ['Bold', 'Italic', 'Underline', 'Strike', '-', 'RemoveFormat'] },
          { name: 'paragraph', items: ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote'] },
          { name: 'links', items: ['Link', 'Unlink'] },
          { name: 'insert', items: ['Table', 'Image'] },
          { name: 'styles', items: ['Styles', 'Format'] },
          { name: 'tools', items: ['Maximize', '-', 'Source', '-', 'Undo', 'Redo'] }
        ],
        removeButtons: '',
        height: 200,
        removeDialogTabs: 'image:advanced;link:advanced',
        startupFocus: false,
        uiColor: '#f8f9fa',
        // Allow full CSS/inline styles in email templates
        allowedContent: true,
        extraAllowedContent: '*(*);*{*}',
        // Don't strip styles on paste
        pasteFilter: null,
        // Allow all HTML elements and attributes
        removeFormatTags: '',
        removeFormatAttributes: '',
        // Disable auto-paragraphing inside templates
        autoParagraph: false,
        enterMode: window.CKEDITOR.ENTER_BR,
        shiftEnterMode: window.CKEDITOR.ENTER_P,
        // Allow style tags and classes
        customConfig: '',
        disableNativeSpellChecker: false,
        // Protect email template HTML from being stripped
        protectSource: true,
      });
      editorInstance.current = editor;
      if (value) editor.setData(value);
      editor.on('change', () => {
        onChangeRef.current && onChangeRef.current(editor.getData());
      });
      if (label) {
        try { editor.container?.setAttribute('aria-label', label); } catch (e) { /* noop */ }
      }
      // Studio contract: insert {{placeholders}} at the caret.
      if (editorRef) {
        editorRef.current = {
          insertText(text) {
            editor.focus();
            editor.insertText(text);
          },
        };
      }
      isReady.current = true;
    }
  };

  useEffect(() => {
    if (isReady.current && editorInstance.current && value !== undefined) {
      const current = editorInstance.current.getData();
      if (current !== value) {
        editorInstance.current.setData(value || '', { noSnapshot: true });
      }
    }
  }, [value]);

  return (
    <div className="studio-rich-editor ckeditor4">
      <textarea
        ref={textareaRef}
        aria-label={label}
        data-placeholder={placeholder || undefined}
        style={{ display: 'none' }}
        defaultValue={value || ''}
      />
    </div>
  );
}
