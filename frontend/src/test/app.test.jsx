import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import ResultPage from '../pages/ResultPage.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { isValidFlezenShareLink, formatBytes } from '../services/link.js';
import { resolveLink, ApiError } from '../services/api.js';

const EXAMPLE = 'https://flezen.com/s/dbhbi0hbjlnl41j838sg4d2mc4ez1bq';

// What the real backend returns for the example link (metadata only).
const metadataOnly = {
  success: true, provider: 'flezen', type: 'video', title: '5_*1***8*5*6*0***6*08.mp4',
  file: { name: '5_*1***8*5*6*0***6*08.mp4', sizeBytes: 13636124, fileType: 'video', uploadedAt: '2026-10-29 08:39:54 +0530 IST', views: 1 },
  thumbnail: null, duration: null,
  stages: {
    metadata: { status: 'ok' },
    playback: { status: 'unavailable', reason: 'No playback API.' },
    download: { status: 'unavailable', reason: 'No download API.' },
  },
  playable: false, playbackUrl: null, downloadAvailable: false, openUrl: EXAMPLE,
};

const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.restoreAllMocks();
  delete window.Telegram;
});

describe('link utils', () => {
  it('accepts share links with any id, rejects everything else', () => {
    expect(isValidFlezenShareLink(EXAMPLE)).toBe(true);
    expect(isValidFlezenShareLink('https://www.flezen.com/s/AbCdEfGh12')).toBe(true);
    for (const bad of ['', 'hello', 'http://flezen.com/s/abcdefgh', 'https://example.com/s/abcdefgh',
      'https://flezen.com/features', 'https://flezen.com/s/short', 'https://flezen.com/s/a/b']) {
      expect(isValidFlezenShareLink(bad)).toBe(false);
    }
  });
  it('formats sizes', () => {
    expect(formatBytes(13636124)).toBe('13 MB');
    expect(formatBytes(null)).toBe('Unknown');
    expect(formatBytes(512)).toBe('512 B');
  });
});

describe('api client', () => {
  it('returns data on success and maps backend/network/timeout errors', async () => {
    expect((await resolveLink(EXAMPLE, { fetchImpl: async () => jsonResponse(200, metadataOnly) })).type).toBe('video');
    await expect(resolveLink(EXAMPLE, { fetchImpl: async () => jsonResponse(404, { success: false, error: { code: 'not_found', message: 'Not found msg' } }) }))
      .rejects.toMatchObject({ code: 'not_found', message: 'Not found msg' });
    await expect(resolveLink(EXAMPLE, { fetchImpl: async () => { throw new TypeError('x'); } }))
      .rejects.toMatchObject({ code: 'network' });
    await expect(resolveLink(EXAMPLE, { fetchImpl: async () => jsonResponse(429, {}) }))
      .rejects.toBeInstanceOf(ApiError);
  });
});

describe('Home screen', () => {
  it('shows required copy and keeps the action disabled until a valid link is entered', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('Flezen Downloader')).toBeInTheDocument();
    expect(screen.getByText('Flezen Video Player · Play supported videos')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste a Flezen video or supported link...')).toBeInTheDocument();
    expect(screen.getByText('Flezen')).toBeInTheDocument(); // only Flezen listed as a service
    const btn = screen.getByRole('button', { name: 'Download / Open Video' });
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText('Flezen link'), 'not a link');
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Use a Flezen share link/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Flezen link'));
    await user.type(screen.getByLabelText('Flezen link'), EXAMPLE);
    expect(btn).toBeEnabled();
  });

  it('submits the example link and shows the metadata result with honest unavailable states', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, metadataOnly));
    render(<App />);
    await user.type(screen.getByLabelText('Flezen link'), EXAMPLE);
    await user.click(screen.getByRole('button', { name: 'Download / Open Video' }));
    await screen.findByRole('heading', { name: '5_*1***8*5*6*0***6*08.mp4' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ url: EXAMPLE });
    expect(screen.getByText('13 MB')).toBeInTheDocument();
    expect(screen.getByText(/File information/)).toBeInTheDocument();
    expect(screen.getAllByText(/Not available/)).toHaveLength(2); // playback + download
    expect(screen.queryByLabelText('Loading video')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download Video' })).not.toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull(); // no player without a playable source
    expect(screen.getByRole('button', { name: 'Open in Flezen' })).toBeInTheDocument();
    // Back returns to the home screen
    await user.click(screen.getByRole('button', { name: '← Back' }));
    expect(screen.getByText('Flezen Downloader')).toBeInTheDocument();
  });

  it('shows backend errors (e.g. deleted) and network errors without crashing', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(410, { success: false, error: { code: 'deleted', message: 'This shared file has been deleted or has expired.' } }))
      .mockRejectedValueOnce(new TypeError('offline'));
    render(<App />);
    await user.type(screen.getByLabelText('Flezen link'), EXAMPLE);
    await user.click(screen.getByRole('button', { name: 'Download / Open Video' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('deleted or has expired');
    await user.click(screen.getByRole('button', { name: 'Download / Open Video' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server'));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('shows the development banner outside Telegram', () => {
    render(<App />);
    expect(screen.getByText(/Running outside Telegram/)).toBeInTheDocument();
  });
});

describe('Telegram integration', () => {
  it('calls ready() and expand(), and wires the native Back button on the result page', async () => {
    const bb = { onClick: vi.fn(), offClick: vi.fn(), show: vi.fn(), hide: vi.fn() };
    window.Telegram = { WebApp: { initData: 'x=1', ready: vi.fn(), expand: vi.fn(), themeParams: {}, BackButton: bb, onEvent: vi.fn() } };
    render(<App />);
    expect(window.Telegram.WebApp.ready).toHaveBeenCalled();
    expect(window.Telegram.WebApp.expand).toHaveBeenCalled();
    expect(screen.queryByText(/Running outside Telegram/)).not.toBeInTheDocument();
    const onBack = vi.fn();
    const { unmount } = render(<ResultPage result={metadataOnly} onBack={onBack} />);
    expect(bb.show).toHaveBeenCalled();
    bb.onClick.mock.calls[0][0]();
    expect(onBack).toHaveBeenCalled();
    unmount();
    expect(bb.hide).toHaveBeenCalled();
  });
});

describe('player and download slots', () => {
  it('renders the player and download button only when sources are reported', () => {
    const rich = { ...metadataOnly, playable: true, playbackUrl: '/media/x.mp4', downloadAvailable: true, downloadUrl: '/dl/x',
      stages: { metadata: { status: 'ok' }, playback: { status: 'ok' }, download: { status: 'ok' } } };
    render(<ResultPage result={rich} onBack={() => {}} />);
    expect(document.querySelector('video')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
  });

  it('VideoPlayer shows a loading indicator, then an error message when the source fails', async () => {
    render(<VideoPlayer src="/broken.mp4" title="t" />);
    expect(screen.getByLabelText('Loading video')).toBeInTheDocument();
    fireEvent.error(document.querySelector('video'));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be played');
    expect(screen.queryByLabelText('Loading video')).not.toBeInTheDocument();
  });
});
