import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPanel from '../SettingsPanel';

describe('SettingsPanel integration', () => {
  it('can switch tabs', () => {
    render(<SettingsPanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Certificate'));
    expect(screen.getByText(/SSL\/TLS Certificate/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Data'));
    expect(screen.getByText(/Manage Stored Data/i)).toBeInTheDocument();
  });
});
