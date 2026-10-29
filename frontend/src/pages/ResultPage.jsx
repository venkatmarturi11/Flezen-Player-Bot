import { useEffect } from 'react';
import StageList from '../components/StageList.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import DownloadButton from '../components/DownloadButton.jsx';
import { formatBytes } from '../services/link.js';
import { openExternal, showBackButton } from '../services/telegram.js';

export default function ResultPage({ result, onBack }) {
  useEffect(() => showBackButton(onBack), [onBack]);

  const { file, stages } = result;
  const isVideo = result.type === 'video';
  // A player is only shown for a source the backend actually reported as playable.
  const showPlayer = isVideo && result.playable && result.playbackUrl;
  const showDownload = result.downloadAvailable && result.downloadUrl;

  return (
    <main className="page result">
      <button type="button" className="btn-back" onClick={onBack}>← Back</button>

      <h1 className="result-title" title={result.title}>{result.title}</h1>
      <p className="subtitle">{isVideo ? 'Video' : 'File'} · Flezen shared file</p>

      {showPlayer ? (
        <VideoPlayer
          src={result.playbackUrl}
          poster={result.thumbnail}
          title={result.title}
          fallbackUrl={result.intentUrl || result.openUrl}
        />
      ) : isVideo ? (
        <div className="player-frame placeholder-frame" onClick={() => openExternal(result.intentUrl || result.openUrl)} role="button" tabIndex={0}>
          <div className="placeholder-icon">▶</div>
          <div className="placeholder-text">
            <strong>Tap to Play Video</strong>
            <span>Watch in Flezen App / Web</span>
          </div>
        </div>
      ) : null}

      <dl className="info">
        <div><dt>Name</dt><dd>{file.name}</dd></div>
        <div><dt>Size</dt><dd>{formatBytes(file.sizeBytes)}</dd></div>
        <div><dt>Type</dt><dd>{file.fileType || 'Unknown'}</dd></div>
        {file.uploadedAt && <div><dt>Uploaded</dt><dd>{file.uploadedAt}</dd></div>}
        {file.views != null && <div><dt>Views</dt><dd>{file.views}</dd></div>}
        {result.duration && <div><dt>Duration</dt><dd>{result.duration}</dd></div>}
      </dl>

      <StageList stages={stages} />

      {showDownload && (
        <DownloadButton url={result.downloadUrl} filename={file.name} expectedBytes={file.sizeBytes} />
      )}

      {!showPlayer && !showDownload && (
        <button type="button" className="btn-primary" onClick={() => openExternal(result.openUrl)}>
          Open in Flezen
        </button>
      )}
    </main>
  );
}
