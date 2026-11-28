// The hidden page that holds the local model: it runs Kev-0.6B (kev-runtime.js) and hosts the downloader worker (kev-download-worker.js).
// Why an offscreen document: the service worker is stopped after 30 seconds without work and cannot load the runtime's module files, and a
// settings page lives only while it is open. This page lives as long as the extension needs it and is closed (by the service worker) after
// the model has been idle for a few minutes.
//
// Messages, all through chrome.runtime. Everything that changes anything is accepted from the extension's own service worker only, so that
// neither a web page nor a content script can start, stop or delete a download or ask this page anything directly:
//   {target: 'kev-offscreen', op: 'ask', kind, question, levels, text}   -> {p} | {p: null, error}
//   {target: 'kev-offscreen', op: 'download', set, base?} | 'pause' | 'cancel' | 'prepare-delete' | 'unload'
//   {target: 'kev-offscreen', op: 'status'}                                -> {job, runtime}     (any extension page may ask)
// Sent by this page to whoever listens (the service worker and an open settings page):
//   {type: 'kev-progress', job, runtime}   {type: 'kev-idle'}
import { createHost } from './kev-host.js';

const SW_URL = chrome.runtime.getURL('src/background/service-worker.js');
const EXT_BASE = chrome.runtime.getURL('');

const send = (msg) => { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch (e) { /* the extension was reloaded */ } };
const host = createHost({ send });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'kev-offscreen') return false;            // not for this page
  const fromExtension = sender && sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(EXT_BASE);
  const fromWorker = fromExtension && sender.url === SW_URL;
  if (msg.op === 'status' ? !fromExtension : !fromWorker) { sendResponse({ error: 'refused' }); return false; }
  host.handle(msg).then(sendResponse, (e) => sendResponse({ p: null, error: String((e && e.message) || e) }));
  return true;
});

host.announce();
