import { useState } from 'react';
import { formatBytes } from '../services/link.js';

/**
 * Downloads an authorized file source with progress. Only rendered when the backend
 * reports a downloadable source. Uses the filename supplied by the source.
 */
export default function DownloadButton({ url, filename, expectedBytes }) {
  const [state, setState] = useState('idle'); // idle | downloading | done | failed
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(expectedBytes || 0);

  async function start() {
    setState('downloading');
    setReceived(0);
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const len = Number(res.headers.get('content-length')) || expectedBytes || 0;
      setTotal(len);
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.byteLength;
        setReceived(got);
      }
      const blobUrl = URL.createObjectURL(new Blob(chunks));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      setState('done');
    } catch {
      setState('failed');
    }
  }

  const pct = total ? Math.min(100, Math.round((received / total) * 100)) : null;

  return (
    <div className="download">
      <button type="button" className="btn-primary" onClick={start} disabled={state === 'downloading'}>
        {state === 'downloading' ? `Downloading${pct != null ? ` ${pct}%` : '…'}` : 'Download Video'}
      </button>
      {state === 'downloading' && (
        <div className="progress" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-bar" style={{ width: pct != null ? `${pct}%` : '30%' }} />
        </div>
      )}
      {state === 'downloading' && <p className="note">{formatBytes(received)}{total ? ` of ${formatBytes(total)}` : ''}</p>}
      {state === 'done' && <p className="note" role="status">Download finished.</p>}
      {state === 'failed' && <p className="error" role="alert">The download failed. Please try again.</p>}
    </div>
  );
}
