/* HTTP polling transport — drop-in replacement for WebSocket on Safari.
   Safari silently drops WebSocket data frames over wss:// with self-signed certs.
   This class mimics the WebSocket API so XTerminal works identically. */

import { api, getToken } from './api';

const POLL_INTERVAL = 80; // ms

export class HttpTransport {
  constructor() {
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this._sessionId = null;
    this._pollTimer = null;
    this._polling = false;
  }

  send(data) {
    const msg = JSON.parse(data);

    if (msg.type === 'connect') {
      // Create session on the backend
      api('/api/terminal/create', {
        method: 'POST',
        body: JSON.stringify(msg),
      })
        .then(r => r.json())
        .then(res => {
          if (res.error) {
            this.onmessage?.({ data: JSON.stringify({ type: 'error', data: res.error }) });
            return;
          }
          this._sessionId = res.sessionId;
          this.readyState = 1; // OPEN
          this._startPolling();
        })
        .catch(() => {
          this.onerror?.();
          this.close();
        });
      return;
    }

    if (!this._sessionId) return;

    if (msg.type === 'disconnect') {
      api(`/api/terminal/${this._sessionId}/input`, {
        method: 'POST',
        body: JSON.stringify(msg),
      }).catch(() => {});
      this.close();
      return;
    }

    // input, resize
    api(`/api/terminal/${this._sessionId}/input`, {
      method: 'POST',
      body: JSON.stringify(msg),
    }).catch(() => {});
  }

  close() {
    if (this.readyState === 3) return;
    this._stopPolling();
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000, reason: '' });
  }

  _startPolling() {
    this._pollTimer = setInterval(() => this._poll(), POLL_INTERVAL);
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async _poll() {
    if (this._polling || !this._sessionId || this.readyState !== 1) return;
    this._polling = true;
    try {
      const res = await api(`/api/terminal/${this._sessionId}/poll`);
      if (res.status === 404) {
        this.close();
        return;
      }
      const { messages } = await res.json();
      for (const msg of messages) {
        this.onmessage?.({ data: JSON.stringify(msg) });
      }
    } catch {
      // Network error — keep trying
    } finally {
      this._polling = false;
    }
  }
}

export function shouldUsePolling() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('transport');
  if (override === 'polling') return true;
  if (override === 'ws') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
