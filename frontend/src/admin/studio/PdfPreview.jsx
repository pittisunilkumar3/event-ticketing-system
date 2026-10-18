import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl + '?module=1';

export default function PdfPreview({ url }) {
  const container = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ url });
    setLoading(true);
    setError('');
    const host = container.current;
    host.replaceChildren();
    (async () => {
      const document = await task.promise;
      for (let number = 1; number <= document.numPages && !cancelled; number++) {
        const page = await document.getPage(number);
        if (cancelled) break;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min((host.clientWidth - 24) / base.width, 1.5);
        const viewport = page.getViewport({ scale: Math.max(scale, 0.25) });
        const canvas = window.document.createElement('canvas');
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = viewport.width * ratio;
        canvas.height = viewport.height * ratio;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `PDF page ${number}`);
        host.append(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] }).promise;
      }
    })().catch(() => { if (!cancelled) setError('This PDF cannot be previewed. You can download it below.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; task.destroy(); };
  }, [url]);
  return <>{loading && <p role="status">Loading PDF…</p>}{error && <p role="alert">{error}</p>}<div className="studio-pdf-pages" ref={container}/></>;
}
