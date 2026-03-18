import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Import the components under test ──────────────────────────
// Note: from src/test/ → src/components/ is one level up (../)
import SearchBar from '../components/SearchBar';
import AccentFilter from '../components/AccentFilter';
import ResultNavigator from '../components/ResultNavigator';
import type { Accent } from '../types/index';

// ── Mock useSearch / useSuggestions ────────────────────────────
// path from src/test/ to src/hooks/ is one level up
jest.mock('../hooks/useSearch', () => ({
  useSuggestions: jest.fn().mockReturnValue({ data: null }),
  useSearch: jest.fn().mockReturnValue({ data: null, isLoading: false, isError: false }),
}));

import { useSuggestions } from '../hooks/useSearch';
const mockUseSuggestions = useSuggestions as jest.MockedFunction<typeof useSuggestions>;

// ── Test query client ──────────────────────────────────────────
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ══════════════════════════════════════════════════════════════
//  SearchBar Tests (Task 9.1)
// ══════════════════════════════════════════════════════════════
describe('SearchBar (Task 9.1)', () => {
  const onSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSuggestions.mockReturnValue({ data: null } as any);
  });

  it('renders with placeholder text', () => {
    render(
      <SearchBar onSearch={onSearch} isLoading={false} placeholder="Search…" />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });

  it('calls onSearch when Search button clicked with text', async () => {
    render(<SearchBar onSearch={onSearch} isLoading={false} />, { wrapper: makeWrapper() });
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello');
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('calls onSearch when Enter pressed', async () => {
    render(<SearchBar onSearch={onSearch} isLoading={false} />, { wrapper: makeWrapper() });
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('does NOT call onSearch when input is empty', () => {
    render(<SearchBar onSearch={onSearch} isLoading={false} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('disables input and button when isLoading=true', () => {
    render(<SearchBar onSearch={onSearch} isLoading={true} />, { wrapper: makeWrapper() });
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('shows spinner when loading', () => {
    render(<SearchBar onSearch={onSearch} isLoading={true} />, { wrapper: makeWrapper() });
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  it('shows suggestions when useSuggestions returns data', async () => {
    mockUseSuggestions.mockReturnValue({
      data: { suggestions: ['hello world', 'hello there'] },
    } as any);

    render(<SearchBar onSearch={onSearch} isLoading={false} />, { wrapper: makeWrapper() });
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
  });

  it('selects a suggestion on click and calls onSearch', async () => {
    mockUseSuggestions.mockReturnValue({
      data: { suggestions: ['hello world'] },
    } as any);

    render(<SearchBar onSearch={onSearch} isLoading={false} />, { wrapper: makeWrapper() });
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello');
    fireEvent.focus(input);

    await waitFor(() => screen.getByText('hello world'));
    fireEvent.mouseDown(screen.getByText('hello world'));

    expect(onSearch).toHaveBeenCalledWith('hello world');
  });

  it('shows validation hint for single character input', async () => {
    render(<SearchBar onSearch={onSearch} isLoading={false} />, { wrapper: makeWrapper() });
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'h');
    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
  });

  it('navigates suggestions with ArrowDown / ArrowUp', async () => {
    mockUseSuggestions.mockReturnValue({
      data: { suggestions: ['option1', 'option2'] },
    } as any);

    render(<SearchBar onSearch={onSearch} isLoading={false} />, { wrapper: makeWrapper() });
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'op');
    fireEvent.focus(input);
    await waitFor(() => screen.getByRole('listbox'));

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const items = screen.getAllByRole('option');
    expect(items[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(items[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(items[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('closes dropdown on Escape key', async () => {
    mockUseSuggestions.mockReturnValue({
      data: { suggestions: ['hello world'] },
    } as any);

    render(<SearchBar onSearch={onSearch} isLoading={false} />, { wrapper: makeWrapper() });
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello');
    fireEvent.focus(input);
    await waitFor(() => screen.getByRole('listbox'));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════
//  AccentFilter Tests (Task 9.2)
// ══════════════════════════════════════════════════════════════
describe('AccentFilter (Task 9.2)', () => {
  const mockCounts: Record<Accent, number> = {
    ALL: 0, US: 12, UK: 5, AU: 3, CA: 8, OTHER: 1,
  };

  it('renders all accent options', () => {
    render(
      <AccentFilter
        selectedAccent="ALL"
        onAccentChange={jest.fn()}
        resultCounts={mockCounts}
      />
    );
    expect(screen.getByRole('radio', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /american/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /british/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /australian/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /canadian/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /other/i })).toBeInTheDocument();
  });

  it('marks the selected accent as checked', () => {
    render(
      <AccentFilter
        selectedAccent="US"
        onAccentChange={jest.fn()}
        resultCounts={mockCounts}
      />
    );
    expect(screen.getByRole('radio', { name: /american/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /british/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onAccentChange when a button is clicked', () => {
    const onChange = jest.fn();
    render(
      <AccentFilter
        selectedAccent="ALL"
        onAccentChange={onChange}
        resultCounts={mockCounts}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: /british/i }));
    expect(onChange).toHaveBeenCalledWith('UK');
  });

  it('displays count badges for each accent', () => {
    render(
      <AccentFilter
        selectedAccent="ALL"
        onAccentChange={jest.fn()}
        resultCounts={mockCounts}
      />
    );
    expect(screen.getByRole('radio', { name: /american/i })).toHaveTextContent('12');
    expect(screen.getByRole('radio', { name: /british/i })).toHaveTextContent('5');
  });

  it('does NOT call onAccentChange when disabled', () => {
    const onChange = jest.fn();
    render(
      <AccentFilter
        selectedAccent="ALL"
        onAccentChange={onChange}
        resultCounts={mockCounts}
        disabled={true}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: /american/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has radiogroup role', () => {
    render(
      <AccentFilter
        selectedAccent="ALL"
        onAccentChange={jest.fn()}
        resultCounts={mockCounts}
      />
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════
//  ResultNavigator Tests (Task 9.3)
// ══════════════════════════════════════════════════════════════
describe('ResultNavigator (Task 9.3)', () => {
  const baseProps = {
    currentIndex: 2,
    totalResults: 10,
    onPrevious: jest.fn(),
    onNext: jest.fn(),
    autoPlay: false,
    onAutoPlayToggle: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('displays current position as 1-based index', () => {
    render(<ResultNavigator {...baseProps} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('enables Prev when not at first result', () => {
    render(<ResultNavigator {...baseProps} currentIndex={2} />);
    expect(screen.getByLabelText('Previous result')).not.toBeDisabled();
  });

  it('disables Prev at first result (index 0)', () => {
    render(<ResultNavigator {...baseProps} currentIndex={0} />);
    expect(screen.getByLabelText('Previous result')).toBeDisabled();
  });

  it('enables Next when not at last result', () => {
    render(<ResultNavigator {...baseProps} currentIndex={2} totalResults={10} />);
    expect(screen.getByLabelText('Next result')).not.toBeDisabled();
  });

  it('disables Next at last result', () => {
    render(<ResultNavigator {...baseProps} currentIndex={9} totalResults={10} />);
    expect(screen.getByLabelText('Next result')).toBeDisabled();
  });

  it('calls onPrevious when Prev clicked', () => {
    render(<ResultNavigator {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Previous result'));
    expect(baseProps.onPrevious).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when Next clicked', () => {
    render(<ResultNavigator {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Next result'));
    expect(baseProps.onNext).toHaveBeenCalledTimes(1);
  });

  it('shows autoplay ON state correctly', () => {
    render(<ResultNavigator {...baseProps} autoPlay={true} />);
    const toggle = screen.getByRole('switch', { name: /auto-play/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onAutoPlayToggle(true) when autoPlay is off and clicked', () => {
    render(<ResultNavigator {...baseProps} autoPlay={false} />);
    fireEvent.click(screen.getByRole('switch', { name: /auto-play/i }));
    expect(baseProps.onAutoPlayToggle).toHaveBeenCalledWith(true);
  });

  it('calls onAutoPlayToggle(false) when autoPlay is on and clicked', () => {
    render(<ResultNavigator {...baseProps} autoPlay={true} />);
    fireEvent.click(screen.getByRole('switch', { name: /auto-play/i }));
    expect(baseProps.onAutoPlayToggle).toHaveBeenCalledWith(false);
  });

  it('disables both buttons when isLoading=true', () => {
    render(<ResultNavigator {...baseProps} isLoading={true} currentIndex={5} />);
    expect(screen.getByLabelText('Previous result')).toBeDisabled();
    expect(screen.getByLabelText('Next result')).toBeDisabled();
  });

  it('shows 0/0 when there are no results', () => {
    render(<ResultNavigator {...baseProps} currentIndex={0} totalResults={0} />);
    // Both current index and total are 0 — there will be two elements with text "0"
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(2);
  });
});
