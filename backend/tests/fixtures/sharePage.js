// HTML modeled on the content observed at https://flezen.com/s/dbhbi0hbjlnl41j838sg4d2mc4ez1bq
// (2026-10-29). The exact production markup could not be fetched from the build sandbox,
// so the parser works on visible text and this fixture mirrors that text.
export const EXAMPLE_ID = 'dbhbi0hbjlnl41j838sg4d2mc4ez1bq';
export const EXAMPLE_URL = `https://flezen.com/s/${EXAMPLE_ID}`;
export const EXAMPLE_NAME = '5_*1***8*5*6*0***6*08.mp4';

export const sharePageHtml = (over = {}) => `<!doctype html><html><head>
<title>${over.name ?? EXAMPLE_NAME} | Secure File Access | Flezen</title>
<meta property="og:title" content="${over.name ?? EXAMPLE_NAME} | Secure File Access | Flezen">
<script>window.x = "Size 1";</script></head><body>
<header><a href="/features">Features</a></header>
<main><h1>${over.name ?? EXAMPLE_NAME}</h1><p>${over.size ?? '13636124'} • ${over.type ?? 'video'}</p>
<h2>Open this file</h2><a href="#">Open in App</a>
<h3>File Information</h3>
<div><span>Name</span><span>${over.name ?? EXAMPLE_NAME}</span></div>
<div><span>Size</span><span>${over.size ?? '13636124'}</span></div>
<div><span>Type</span><span>${over.type ?? 'video'}</span></div>
<div><span>Uploaded</span><span>2026-10-29 08:39:54.752903 +0530 IST</span></div>
<div><span>Views</span><span>${over.views ?? '1'}</span></div>
<div><span>Security</span><span>Encrypted &amp; Secure</span></div>
</main></body></html>`;
