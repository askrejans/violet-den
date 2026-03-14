import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPanel from '../SettingsPanel';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ show_urls: true }) })
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SettingsPanel', () => {
  it('renders all tabs including Display', () => {
    render(<SettingsPanel onClose={() => {}} />);
    expect(screen.getByText('Display')).toBeInTheDocument();
    expect(screen.getByText('Credentials')).toBeInTheDocument();
    expect(screen.getByText('Certificate')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<SettingsPanel onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Display tab content by default', async () => {
    render(<SettingsPanel onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Dashboard Display')).toBeInTheDocument();
    });
  });

  it('shows toggle for show link addresses', async () => {
    render(<SettingsPanel onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Show link addresses')).toBeInTheDocument();
    });
  });
});
