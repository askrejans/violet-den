import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

jest.mock('../viteEnv');
jest.mock('../SSHPanel', () => () => <div data-testid="ssh-panel-mock" />);

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('App setup flow', () => {
  it('renders logo while checking setup status', () => {
    global.fetch = jest.fn(() => new Promise(() => {})); // never resolves
    render(<App />);
    expect(screen.getByAltText('')).toBeInTheDocument();
  });

  it('shows Onboarding when setup is not complete', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ setup_complete: false }) })
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/welcome to violetden/i)).toBeInTheDocument();
    });
  });

  it('shows AuthWrapper (login) when setup is complete', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ setup_complete: true }) })
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully (stays on loading)', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
    render(<App />);
    // Should not crash; stays on loading screen
    await waitFor(() => {
      expect(screen.getByAltText('')).toBeInTheDocument();
    });
  });
});
