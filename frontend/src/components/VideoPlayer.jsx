import { useRef, useState } from 'react';
import { openExternal } from '../services/telegram.js';

/**
 * HTML5 video player with loading indicator, fallback action and fullscreen.
 */
export default function VideoPlayer({ src, poster, title, fallbackUrl }) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setError('Playback could not start. Flezen requires their streaming player for this video.'));
    else v.pause();
  };

  const fullscreen = () => {
    const v = ref.current;
    if (!v) return;
    (v.requestFullscreen || v.webkitEnterFullscreen || v.webkitRequestFullscreen)?.call(v);
  };

  return (
    <div className="player">
      <div className="player-frame">
        <video
          ref={ref}
          src={src}
          poster={poster || undefined}
          title={title}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={() => setLoading(false)}
          onCanPlay={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onPlaying={() => { setLoading(false); setPlaying(true); }}
          onPause={() => setPlaying(false)}
          onError={() => {
            setLoading(false);
            setError('This video could not be played directly. Open in Flezen player to stream.');
          }}
        />
        {loading && !error && <div className="spinner" role="status" aria-label="Loading video" />}
      </div>
      {error ? (
        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <p className="error" role="alert" style={{ marginBottom: '0.75rem' }}>{error}</p>
          {fallbackUrl && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => openExternal(fallbackUrl)}
            >
              ▶ Open in Flezen App to Play
            </button>
          )}
        </div>
      ) : (
        <div className="player-actions">
          <button type="button" className="btn-secondary" onClick={toggle}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="btn-secondary" onClick={fullscreen}>Fullscreen</button>
        </div>
      )}
    </div>
  );
}
