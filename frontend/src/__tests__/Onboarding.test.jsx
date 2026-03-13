import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Onboarding from '../Onboarding';

jest.mock('../viteEnv');

describe('Onboarding', () => {
  const mockComplete = jest.fn();

  beforeEach(() => {
    mockComplete.mockClear();
    jest.restoreAllMocks();
  });

  it('renders onboarding title', () => {
    render(<Onboarding onComplete={mockComplete} />);
    expect(screen.getByText(/welcome to violetden/i)).toBeInTheDocument();
  });

  it('renders credential fields', () => {
    render(<Onboarding onComplete={mockComplete} />);
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm Password')).toBeInTheDocument();
  });

  it('disables save button when credentials are incomplete', () => {
    render(<Onboarding onComplete={mockComplete} />);
    const saveBtn = screen.getByText(/save & finish setup/i);
    expect(saveBtn).toBeDisabled();
  });

  it('enables save button when credentials are valid', () => {
    render(<Onboarding onComplete={mockComplete} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'pass1234' } });
    const saveBtn = screen.getByText(/save & finish setup/i);
    expect(saveBtn).not.toBeDisabled();
  });

  it('shows "Credentials ready" when valid', () => {
    render(<Onboarding onComplete={mockComplete} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'pass1234' } });
    expect(screen.getByText(/credentials ready/i)).toBeInTheDocument();
  });

  it('keeps button disabled when passwords do not match', () => {
    render(<Onboarding onComplete={mockComplete} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'different' } });
    expect(screen.getByText(/save & finish setup/i)).toBeDisabled();
  });

  it('keeps button disabled when password is too short', () => {
    render(<Onboarding onComplete={mockComplete} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'abc' } });
    expect(screen.getByText(/save & finish setup/i)).toBeDisabled();
  });

  it('shows hint when credentials are not yet valid', () => {
    render(<Onboarding onComplete={mockComplete} />);
    expect(screen.getByText(/fill in credentials above/i)).toBeInTheDocument();
  });

  it('renders section builder fields', () => {
    render(<Onboarding onComplete={mockComplete} />);
    expect(screen.getByPlaceholderText('Section Title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Link Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('URL')).toBeInTheDocument();
  });

  it('calls onComplete after successful setup', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ success: true }) })
    );

    render(<Onboarding onComplete={mockComplete} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByText(/save & finish setup/i));

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalled();
    });
  });

  it('shows error when server returns failure', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ success: false, error: 'Setup failed' }) })
    );

    render(<Onboarding onComplete={mockComplete} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByText(/save & finish setup/i));

    await waitFor(() => {
      expect(screen.getByText('Setup failed')).toBeInTheDocument();
    });
  });

  it('shows error when server is unreachable', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

    render(<Onboarding onComplete={mockComplete} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByText(/save & finish setup/i));

    await waitFor(() => {
      expect(screen.getByText(/cannot reach server/i)).toBeInTheDocument();
    });
  });
});
