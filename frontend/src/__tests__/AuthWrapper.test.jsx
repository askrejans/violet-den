import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthWrapper from '../AuthWrapper';

// Mock the api module
jest.mock('../api', () => {
  let _token = null;
  return {
    setToken: (t) => { _token = t; },
    getToken: () => _token,
    api: jest.fn(),
  };
});

const { setToken, getToken, api } = require('../api');

beforeEach(() => {
  setToken(null);
  api.mockReset();
  jest.restoreAllMocks();
});

describe('AuthWrapper', () => {
  it('renders login form when no token', () => {
    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('does not render children when not authenticated', () => {
    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows loading state while validating stored token', () => {
    setToken('stored-token');
    api.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    // Should show loading (logo), not login form or children
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders children when stored token is valid', async () => {
    setToken('valid-token');
    api.mockResolvedValue({ json: () => Promise.resolve({ valid: true }) });
    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('shows login when stored token is invalid', async () => {
    setToken('expired-token');
    api.mockResolvedValue({ json: () => Promise.resolve({ valid: false }) });
    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });
  });

  it('shows login when token validation fails (backend unreachable)', async () => {
    setToken('some-token');
    api.mockRejectedValue(new Error('Network error'));
    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });
  });

  it('handles successful login', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ success: true, token: 'new-token' }),
      })
    );

    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('shows error on failed login', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ success: false }),
      })
    );

    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('shows error when server unreachable during login', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network')));

    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText(/cannot reach server/i)).toBeInTheDocument();
    });
  });

  it('shows "Signing in…" while login is in progress', async () => {
    global.fetch = jest.fn(() => new Promise(() => {})); // never resolves

    render(<AuthWrapper><div>Dashboard</div></AuthWrapper>);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Signing in…')).toBeInTheDocument();
    });
  });
});
