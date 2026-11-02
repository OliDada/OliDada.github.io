// Background thread for the long-range radio scan (signals.mjs).
import { radioSources } from './signals.mjs';
self.onmessage = (e) => self.postMessage({ id: e.data.id, sources: radioSources(e.data.center) });
