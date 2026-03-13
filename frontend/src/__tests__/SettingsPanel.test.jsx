import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPanel from '../SettingsPanel';

describe('SettingsPanel', () => {
  it('renders tabs', () => {
    render(<SettingsPanel onClose={() => {}} />);
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
});
