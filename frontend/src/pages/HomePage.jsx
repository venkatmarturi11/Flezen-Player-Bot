import { useState, useEffect } from 'react';
import CloudDownloadIcon from '../components/CloudDownloadIcon.jsx';
import LinkInput from '../components/LinkInput.jsx';
import { isValidFlezenShareLink } from '../services/link.js';
import { resolveLink } from '../services/api.js';
import { haptic } from '../services/telegram.js';

export default function HomePage({ onResolved, inTelegram }) {
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const valid = isValidFlezenShareLink(link);

  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('url');
      if (param && isValidFlezenShareLink(param)) {
        setLink(param);
        setLoading(true);
        resolveLink(param.trim())
          .then(onResolved)
          .catch((err) => setError(err.message || 'Could not load video.'))
          .finally(() => setLoading(false));
      }
    } catch {
      /* ignore */
    }
  }, [onResolved]);

  async function submit() {
    if (!valid || loading) return;
    setLoading(true);
    setError('');
    haptic('light');
    try {
      onResolved(await resolveLink(link.trim()));
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page home">
      {!inTelegram && (
        <p className="dev-banner" role="note">
          Running outside Telegram (development mode). Open this app from the bot for the full experience.
        </p>
      )}

      <div className="hero">
        <div className="hero-icon"><CloudDownloadIcon /></div>
        <h1>Flezen Downloader</h1>
        <p className="subtitle">Flezen Video Player · Play supported videos</p>
      </div>

      <LinkInput value={link} onChange={(v) => { setLink(v); setError(''); }} onSubmit={submit} disabled={loading} />

      {link && !valid && (
        <p className="hint" role="status">Use a Flezen share link like https://flezen.com/s/…</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <button type="button" className="btn-primary" disabled={!valid || loading} onClick={submit}>
        {loading ? <><span className="spinner-inline" aria-hidden="true" /> Checking link…</> : 'Download / Open Video'}
      </button>

      <section className="services" aria-label="Supported services">
        <h2>Supported services</h2>
        <div className="chips">
          <span className="chip chip-active">Flezen</span>
        </div>
        <p className="note">More services can be added later.</p>
      </section>
    </main>
  );
}
