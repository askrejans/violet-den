import { render, screen, fireEvent } from '@testing-library/react';
import IconPicker, { isMaterialIcon, ICONS } from '../IconPicker';

describe('isMaterialIcon', () => {
  it('returns true for valid Material Icons', () => {
    expect(isMaterialIcon('home')).toBe(true);
    expect(isMaterialIcon('router')).toBe(true);
    expect(isMaterialIcon('settings')).toBe(true);
  });

  it('returns false for non-icon strings', () => {
    expect(isMaterialIcon('NotAnIcon')).toBe(false);
    expect(isMaterialIcon('123')).toBe(false);
    expect(isMaterialIcon('')).toBeFalsy();
    expect(isMaterialIcon(null)).toBeFalsy();
    expect(isMaterialIcon(undefined)).toBeFalsy();
  });

  it('returns false for icon-like strings not in the list', () => {
    expect(isMaterialIcon('not_in_list_icon')).toBe(false);
  });
});

describe('ICONS list', () => {
  it('contains expected icons', () => {
    expect(ICONS).toContain('home');
    expect(ICONS).toContain('router');
    expect(ICONS).toContain('terminal');
    expect(ICONS).toContain('security');
  });

  it('has no duplicates', () => {
    const unique = new Set(ICONS);
    expect(unique.size).toBe(ICONS.length);
  });
});

describe('IconPicker component', () => {
  it('renders trigger button', () => {
    render(<IconPicker value="" onChange={() => {}} />);
    expect(screen.getByTitle('Choose icon')).toBeInTheDocument();
  });

  it('shows placeholder icon when no value', () => {
    const { container } = render(<IconPicker value="" onChange={() => {}} />);
    const placeholder = container.querySelector('.ip-placeholder');
    expect(placeholder).toBeInTheDocument();
  });

  it('shows selected icon when value is set', () => {
    const { container } = render(<IconPicker value="home" onChange={() => {}} />);
    const preview = container.querySelector('.ip-preview');
    expect(preview.textContent).toBe('home');
    expect(preview.classList.contains('ip-placeholder')).toBe(false);
  });

  it('shows clear button when value is set', () => {
    render(<IconPicker value="home" onChange={() => {}} />);
    expect(screen.getByTitle('Clear')).toBeInTheDocument();
  });

  it('does not show clear button when no value', () => {
    render(<IconPicker value="" onChange={() => {}} />);
    expect(screen.queryByTitle('Clear')).not.toBeInTheDocument();
  });

  it('calls onChange with empty string when clear is clicked', () => {
    const onChange = jest.fn();
    render(<IconPicker value="home" onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Clear'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('opens dropdown on trigger click', () => {
    render(<IconPicker value="" onChange={() => {}} />);
    fireEvent.click(screen.getByTitle('Choose icon'));
    expect(screen.getByPlaceholderText('Search icons…')).toBeInTheDocument();
  });

  it('filters icons by search term', () => {
    render(<IconPicker value="" onChange={() => {}} />);
    fireEvent.click(screen.getByTitle('Choose icon'));
    fireEvent.change(screen.getByPlaceholderText('Search icons…'), { target: { value: 'router' } });
    expect(screen.getByTitle('router')).toBeInTheDocument();
  });

  it('shows "No icons found" for invalid search', () => {
    render(<IconPicker value="" onChange={() => {}} />);
    fireEvent.click(screen.getByTitle('Choose icon'));
    fireEvent.change(screen.getByPlaceholderText('Search icons…'), { target: { value: 'zzzzzzzzz' } });
    expect(screen.getByText('No icons found')).toBeInTheDocument();
  });

  it('calls onChange when an icon is selected', () => {
    const onChange = jest.fn();
    render(<IconPicker value="" onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Choose icon'));
    fireEvent.click(screen.getByTitle('home'));
    expect(onChange).toHaveBeenCalledWith('home');
  });
});
