import { useRef, useState } from 'react';
import { openExternal } from '../services/telegram.js';

/**
 * HTML5 video player with loading indicator, fallback action and fullscreen.
 */
export default function VideoPlayer({ src, poster, title, openUrl, intentUrl, fallbackUrl }) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const targetUrl = isAndroid ? (intentUrl || fallbackUrl || openUrl) : (openUrl || fallbackUrl);
  const buttonLabel = isAndroid ? '▶ Open in Flezen App to Play' : '▶ Open Flezen Stream Player';

  const copyLink = async () => {
    const link = openUrl || fallbackUrl || src;
    if (!link) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

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
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {targetUrl && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => openExternal(targetUrl)}
              >
                {buttonLabel}
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={copyLink}
            >
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
          </div>
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
