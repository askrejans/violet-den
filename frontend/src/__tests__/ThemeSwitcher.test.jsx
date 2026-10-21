import { act, fireEvent, render, screen } from '@testing-library/react';
import ThemeSwitcher from '../ThemeSwitcher';
import useTheme from '../useTheme';

const palette = {
  background: '#121212', surface: '#202020', secondary: '#303030',
  primary: '#00aaff', text: '#eeeeee', muted: '#aaaaaa', divider: '#444444', dark: true,
};
let originalParent;

function Appearance() {
  const [theme, setTheme] = useTheme();
  return <ThemeSwitcher value={theme} onChange={setTheme} />;
}

beforeEach(() => {
  localStorage.clear();
  originalParent = window.parent;
});

afterEach(() => {
  Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
  jest.restoreAllMocks();
});

it('offers exactly three themes and remembers the choice after remounting', () => {
  const view = render(<Appearance />);
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.getByLabelText('Izskats')).toHaveValue('violet');
  fireEvent.change(screen.getByLabelText('Izskats'), { target: { value: 'simple' } });
  expect(document.documentElement.dataset.theme).toBe('simple');
  expect(document.documentElement.style.colorScheme).toBe('light');
  view.unmount();
  render(<Appearance />);
  expect(screen.getByLabelText('Izskats')).toHaveValue('simple');
});

it('updates HA colors live without changing the saved theme choice', () => {
  const parent = { postMessage: jest.fn() };
  Object.defineProperty(window, 'parent', { configurable: true, value: parent });
  render(<Appearance />);
  fireEvent.change(screen.getByLabelText('Izskats'), { target: { value: 'ha' } });
  act(() => window.dispatchEvent(new MessageEvent('message', {
    source: parent, data: { type: 'ha-theme', palette },
  })));
  expect(document.documentElement.style.getPropertyValue('--ha-primary')).toBe('#00aaff');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  act(() => window.dispatchEvent(new MessageEvent('message', {
    source: parent, data: { type: 'ha-theme', palette: { ...palette, primary: '#ff8800', dark: false } },
  })));
  expect(document.documentElement.style.getPropertyValue('--ha-primary')).toBe('#ff8800');
  expect(document.documentElement.style.colorScheme).toBe('light');
  expect(screen.getByLabelText('Izskats')).toHaveValue('ha');
});

it('keeps the last received HA palette when opened directly later', () => {
  localStorage.setItem('violetden-theme', JSON.stringify('ha'));
  localStorage.setItem('violetden-ha-palette', JSON.stringify(palette));
  render(<Appearance />);
  expect(document.documentElement.style.getPropertyValue('--ha-background')).toBe('#121212');
  expect(document.documentElement.style.colorScheme).toBe('dark');
});

it('ignores messages from unrelated windows and incomplete palettes', () => {
  const parent = {};
  Object.defineProperty(window, 'parent', { configurable: true, value: parent });
  render(<Appearance />);
  act(() => window.dispatchEvent(new MessageEvent('message', {
    source: window, data: { type: 'ha-theme', palette },
  })));
  act(() => window.dispatchEvent(new MessageEvent('message', {
    source: parent, data: { type: 'ha-theme', palette: { primary: '#ff0000' } },
  })));
  expect(localStorage.getItem('violetden-ha-palette')).toBeNull();
});

it('falls back to violet for invalid saved preferences and works without storage', () => {
  localStorage.setItem('violetden-theme', JSON.stringify('unknown'));
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage disabled'); });
  render(<Appearance />);
  expect(screen.getByLabelText('Izskats')).toHaveValue('violet');
  fireEvent.change(screen.getByLabelText('Izskats'), { target: { value: 'simple' } });
  expect(document.documentElement.dataset.theme).toBe('simple');
});
