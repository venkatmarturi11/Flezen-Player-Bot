const LABELS = {
  metadata: 'File information',
  playback: 'Video playback',
  download: 'Download',
};

const STATE = {
  ok: { icon: '✓', text: 'Available', cls: 'ok' },
  unavailable: { icon: '✕', text: 'Not available', cls: 'bad' },
  not_applicable: { icon: '–', text: 'Not applicable', cls: 'na' },
};

/**
 * Shows the three outcomes separately so that "metadata found" is never
 * mistaken for "video can be played" or "file can be downloaded".
 */
export default function StageList({ stages }) {
  return (
    <ul className="stages" aria-label="Capabilities">
      {['metadata', 'playback', 'download'].map((key) => {
        const s = stages[key] || { status: 'unavailable' };
        const view = STATE[s.status] || STATE.unavailable;
        return (
          <li key={key} className={`stage ${view.cls}`}>
            <span className="stage-icon" aria-hidden="true">{view.icon}</span>
            <div>
              <div className="stage-title">
                {LABELS[key]} <span className="stage-state">· {view.text}</span>
              </div>
              {s.reason && <div className="stage-reason">{s.reason}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
