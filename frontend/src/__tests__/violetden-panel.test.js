import fs from 'node:fs';
import path from 'node:path';
import '../../../homeassistant/violetden-panel.js';

const dashboardUrl = 'https://violetden.example.test:1988/';
const panelConfig = { config: { url: dashboardUrl } };
let observers;
let originalViewport;
let originalResizeObserver;

beforeEach(() => {
  jest.useFakeTimers();
  jest.replaceProperty(window, 'innerHeight', 900);
  originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  originalResizeObserver = global.ResizeObserver;
  observers = [];
  global.ResizeObserver = jest.fn((callback) => {
    const observer = { callback, observe: jest.fn(), disconnect: jest.fn() };
    observers.push(observer);
    return observer;
  });
});

afterEach(() => {
  document.body.replaceChildren();
  jest.useRealTimers();
  jest.restoreAllMocks();
  global.ResizeObserver = originalResizeObserver;
  if (originalViewport) {
    Object.defineProperty(window, 'visualViewport', originalViewport);
  } else {
    delete window.visualViewport;
  }
});

function mountPanel(top = 56, paddingBottom = 0) {
  const container = document.createElement('div');
  container.style.height = '200px';
  container.style.paddingBottom = `${paddingBottom}px`;
  const panel = document.createElement('violetden-panel');
  jest.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => ({ top }));
  panel.panel = panelConfig;
  container.append(panel);
  document.body.append(container);
  return panel;
}

function authenticate(panel) {
  const iframe = panel.shadowRoot.querySelector('iframe');
  const frameWindow = { postMessage: jest.fn() };
  Object.defineProperty(iframe, 'contentWindow', { value: frameWindow });
  panel.hass = {
    auth: { data: { access_token: 'ha-test-token' } },
    user: { id: 'test-user', name: 'Test user', is_admin: true },
  };
  return { iframe, frameWindow };
}

it('fills the viewport below the HA header even when an ancestor has a short height', () => {
  const panel = mountPanel();

  expect(panel.style.height).toBe('844px');
  window.innerHeight = 1000;
  window.dispatchEvent(new Event('resize'));
  expect(panel.style.height).toBe('944px');
});

it('fits the visible mobile viewport and preserves HA bottom safe-area padding', () => {
  const viewport = Object.assign(new EventTarget(), { height: 640, offsetTop: 0 });
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  const panel = mountPanel(56, 20);

  expect(panel.style.height).toBe('564px');
  viewport.height = 430;
  viewport.dispatchEvent(new Event('resize'));
  expect(panel.style.height).toBe('354px');
  viewport.offsetTop = 30;
  viewport.dispatchEvent(new Event('scroll'));
  expect(panel.style.height).toBe('384px');
});

it('fills the bottom of the visual viewport when it scrolls below the panel origin', () => {
  const viewport = Object.assign(new EventTarget(), { height: 430, offsetTop: 100 });
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  const panel = mountPanel(56, 20);

  expect(panel.style.height).toBe('454px');
  panel.parentElement.style.paddingBottom = '0px';
  viewport.dispatchEvent(new Event('resize'));
  expect(panel.style.height).toBe('474px');
});

it('updates the available height when the HA layout changes without a window resize', () => {
  const panel = mountPanel();
  panel.getBoundingClientRect.mockReturnValue({ top: 112 });
  observers[0].callback();

  expect(panel.style.height).toBe('788px');
  expect(observers[0].observe).toHaveBeenCalledWith(panel.parentElement);
});

it('keeps the loaded iframe and auth session when HA repeats the same panel configuration', () => {
  const panel = mountPanel();
  const { iframe, frameWindow } = authenticate(panel);
  iframe.dispatchEvent(new Event('load'));
  panel.panel = { config: { url: dashboardUrl } };

  expect(panel.shadowRoot.querySelector('iframe')).toBe(iframe);
  expect(frameWindow.postMessage).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('does not let a previous URL load timeout replace a newer iframe', () => {
  const panel = mountPanel();
  const previous = panel.shadowRoot.querySelector('iframe');
  jest.advanceTimersByTime(5000);
  panel.panel = { config: { url: 'https://other.example.test/' } };
  const current = panel.shadowRoot.querySelector('iframe');
  jest.advanceTimersByTime(5000);
  previous.dispatchEvent(new Event('error'));

  expect(panel.shadowRoot.querySelector('iframe')).toBe(current);
  expect(panel.shadowRoot.querySelector('.offline-card')).toBeNull();
  jest.advanceTimersByTime(5000);
  expect(panel.shadowRoot.querySelector('.offline-url')).toHaveTextContent('https://other.example.test/');
});

it('cleans up pending work on disconnect and resumes sizing and loading on reconnect', () => {
  const panel = mountPanel();
  const parent = panel.parentElement;
  panel.remove();
  window.innerHeight = 700;
  window.dispatchEvent(new Event('resize'));
  jest.advanceTimersByTime(10000);

  expect(panel.style.height).toBe('844px');
  expect(panel.shadowRoot.querySelector('.offline-card')).toBeNull();
  expect(observers[0].disconnect).toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  parent.append(panel);
  expect(panel.style.height).toBe('644px');
  expect(jest.getTimerCount()).toBe(1);
});

it('forwards HA credentials only to the current iframe at its configured origin', () => {
  const panel = mountPanel();
  const { iframe, frameWindow } = authenticate(panel);
  const ready = { type: 'violetden-ready' };
  const origin = new URL(dashboardUrl).origin;
  window.dispatchEvent(new MessageEvent('message', { data: ready, origin, source: window }));
  window.dispatchEvent(new MessageEvent('message', {
    data: ready, origin: 'https://untrusted.example.test', source: frameWindow,
  }));
  expect(frameWindow.postMessage).not.toHaveBeenCalled();

  window.dispatchEvent(new MessageEvent('message', { data: ready, origin, source: frameWindow }));
  expect(frameWindow.postMessage).toHaveBeenCalledWith(expect.objectContaining({
    type: 'ha-auth', token: 'ha-test-token',
  }), origin);
  iframe.dispatchEvent(new Event('error'));
  window.dispatchEvent(new MessageEvent('message', { data: ready, origin, source: frameWindow }));
  expect(frameWindow.postMessage).toHaveBeenCalledTimes(1);
});

it('ships identical manual-panel and HACS integration frontend sources', () => {
  const root = path.resolve(__dirname, '../../..');
  expect(fs.readFileSync(path.join(root, 'homeassistant/violetden-panel.js'), 'utf8'))
    .toBe(fs.readFileSync(path.join(root, 'custom_components/violetden/frontend/violetden-panel.js'), 'utf8'));
});
