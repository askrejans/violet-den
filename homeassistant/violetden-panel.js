/**
 * VioletDen — Home Assistant Custom Panel
 *
 * Embeds the VioletDen dashboard as a sidebar panel in Home Assistant.
 * Works with HA Container, HA Core, HA OS, and HA Supervised.
 *
 * Usage in configuration.yaml:
 *
 *   panel_custom:
 *     - name: violetden-panel
 *       sidebar_title: VioletDen
 *       sidebar_icon: mdi:console-network
 *       url_path: violetden
 *       module_url: /local/violetden-panel.js
 *       require_admin: true
 *       config:
 *         url: "http://<violetden-host>:4000"
 */

class VioletDenPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._panel = null;
    this._iframe = null;
    this._iframeReady = false;
    this._authSent = false;
    this._boundMessageHandler = this._onMessage.bind(this);
  }

  connectedCallback() {
    window.addEventListener('message', this._boundMessageHandler);
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._boundMessageHandler);
  }

  set panel(panel) {
    this._panel = panel;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._trySendAuth();
  }

  _render() {
    if (!this._panel) return;

    const url = (this._panel.config && this._panel.config.url) || 'http://localhost:4000';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: 0;
          background: #0d0a1a;
        }
      </style>
      <iframe
        src="${this._escapeAttr(url)}"
        allow="clipboard-read; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      ></iframe>
    `;

    this._iframe = this.shadowRoot.querySelector('iframe');
    this._iframeReady = false;
    this._authSent = false;

    // Detect load failures (unreachable host on external network)
    this._loadTimer = setTimeout(() => {
      if (!this._iframeReady) {
        this._showOfflineMessage(url);
      }
    }, 10000);

    this._iframe.addEventListener('load', () => {
      clearTimeout(this._loadTimer);
      this._iframeReady = true;
      this._trySendAuth();
    });

    this._iframe.addEventListener('error', () => {
      clearTimeout(this._loadTimer);
      this._showOfflineMessage(url);
    });
  }

  _showOfflineMessage(url) {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: #0d0a1a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .offline-card {
          text-align: center;
          max-width: 420px;
          padding: 48px 40px;
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 16px;
          backdrop-filter: blur(12px);
        }
        .offline-icon {
          font-size: 56px;
          margin-bottom: 16px;
          opacity: 0.7;
        }
        .offline-title {
          color: #c4b5fd;
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 12px;
        }
        .offline-text {
          color: rgba(196, 181, 253, 0.7);
          font-size: 15px;
          line-height: 1.6;
          margin: 0 0 24px;
        }
        .offline-url {
          display: inline-block;
          padding: 8px 16px;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 8px;
          color: #a78bfa;
          font-family: 'SF Mono', SFMono-Regular, Consolas, monospace;
          font-size: 13px;
          word-break: break-all;
        }
        .retry-btn {
          display: inline-block;
          margin-top: 20px;
          padding: 10px 28px;
          background: rgba(139, 92, 246, 0.2);
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 8px;
          color: #c4b5fd;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .retry-btn:hover {
          background: rgba(139, 92, 246, 0.35);
        }
      </style>
      <div class="offline-card">
        <div class="offline-icon">🏠</div>
        <h2 class="offline-title">VioletDen is not reachable</h2>
        <p class="offline-text">
          The dashboard is only accessible from your local network.<br>
          Connect to your home Wi-Fi or VPN to access it.
        </p>
        <div class="offline-url">${this._escapeAttr(url)}</div>
        <br>
        <button class="retry-btn" id="retry">Retry</button>
      </div>
    `;

    this.shadowRoot.getElementById('retry').addEventListener('click', () => {
      this._render();
    });
  }

  /**
   * Listen for messages from the VioletDen iframe.
   * VioletDen sends { type: 'violetden-ready' } when it is loaded and
   * ready to receive auth, and { type: 'violetden-auth-result', success }
   * after processing the auth handshake.
   */
  _onMessage(event) {
    if (!this._iframe) return;

    // Only accept messages from the iframe origin
    try {
      const iframeUrl = new URL(this._iframe.src);
      if (event.origin !== iframeUrl.origin) return;
    } catch {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'violetden-ready') {
      this._iframeReady = true;
      this._authSent = false;
      this._trySendAuth();
    }
  }

  /**
   * Send HA auth credentials to the VioletDen iframe via postMessage.
   * The iframe backend validates the HA token against the HA API.
   */
  _trySendAuth() {
    if (!this._hass || !this._iframe || !this._iframeReady || this._authSent) return;

    const token = this._hass.auth && this._hass.auth.data
      ? this._hass.auth.data.access_token
      : null;

    if (!token) return;

    const iframeUrl = new URL(this._iframe.src);

    this._iframe.contentWindow.postMessage({
      type: 'ha-auth',
      token: token,
      user: {
        id: this._hass.user.id,
        name: this._hass.user.name,
        is_admin: this._hass.user.is_admin,
      },
    }, iframeUrl.origin);

    this._authSent = true;
  }

  _escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('violetden-panel', VioletDenPanel);
