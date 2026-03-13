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

    this._iframe.addEventListener('load', () => {
      this._iframeReady = true;
      this._trySendAuth();
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
