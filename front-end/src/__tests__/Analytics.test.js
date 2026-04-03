import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Analytics from '../Analytics';

// Recharts uses ResizeObserver which doesn't exist in jsdom — stub it out
jest.mock('recharts', () => {
  const Recharts = jest.requireActual('recharts');
  return {
    ...Recharts,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  };
});

function makeItem(overrides = {}) {
  return {
    sku: '10004',
    description: '10x10x10 Box',
    current_quantity: 50,
    daily_usage_rate: 2.5,
    days_until_empty: 20,
    reorder_point: 20,
    should_reorder: false,
    days_until_reorder: 12,
    lead_time_days: 5,
    safety_stock_days: 3,
    ...overrides,
  };
}

const MOCK_ITEMS = [
  makeItem({
    sku: '10004',
    description: '10x10x10 Box',
    current_quantity: 15,
    daily_usage_rate: 8.0,
    days_until_empty: 2,
    reorder_point: 64,
    should_reorder: true,
    days_until_reorder: 0,
  }),
  makeItem({
    sku: '10005',
    description: '12x12x12 Box',
    current_quantity: 35,
    daily_usage_rate: 3.5,
    days_until_empty: 10,
    reorder_point: 28,
    should_reorder: false,
    days_until_reorder: 2,
  }),
  makeItem({
    sku: '10011',
    description: '24x24x24 Box',
    current_quantity: 200,
    daily_usage_rate: 1.0,
    days_until_empty: 200,
    reorder_point: 8,
    should_reorder: false,
    days_until_reorder: 192,
  }),
  makeItem({
    sku: '10260',
    description: 'Bubble Mailer',
    current_quantity: 50,
    daily_usage_rate: 0,
    days_until_empty: null,
    reorder_point: 0,
    should_reorder: false,
    days_until_reorder: null,
  }),
];

function mockFetch(items = MOCK_ITEMS) {
  global.fetch = jest.fn((url) => {
    if (url.includes('/history')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    return Promise.resolve({ ok: true, json: async () => items });
  });
}

beforeEach(() => mockFetch());
afterEach(() => jest.resetAllMocks());

// ---------------------------------------------------------------------------
// Loading & error states
// ---------------------------------------------------------------------------

test('shows loading state before data arrives', () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  render(<Analytics />);
  expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
});

test('shows error message when fetch fails', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
  );
  render(<Analytics />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------------

test('renders Reorder Now KPI card with correct count', async () => {
  render(<Analytics />);
  // Wait for data to load before checking KPI value
  await screen.findByRole('table');
  const cards = screen.getAllByText('Reorder Now');
  const cardLabel = cards.find((el) => el.classList.contains('cardLabel'));
  expect(within(cardLabel.closest('.analyticsCard')).getByText('1')).toBeInTheDocument();
});

test('renders Due Soon KPI card', async () => {
  render(<Analytics />);
  expect(await screen.findByText(/due soon \(< 7 days\)/i)).toBeInTheDocument();
});

test('renders No Usage Data KPI card', async () => {
  render(<Analytics />);
  expect(await screen.findByText(/no usage data/i)).toBeInTheDocument();
});

test('renders Total SKUs Tracked KPI card with correct count', async () => {
  render(<Analytics />);
  const label = await screen.findByText(/total skus tracked/i);
  const cardEl = label.closest('.analyticsCard');
  expect(within(cardEl).getByText('4')).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Table content
// ---------------------------------------------------------------------------

test('renders a row for each item in the table', async () => {
  render(<Analytics />);
  const table = await screen.findByRole('table');
  expect(within(table).getByText('10x10x10 Box')).toBeInTheDocument();
  expect(within(table).getByText('12x12x12 Box')).toBeInTheDocument();
  expect(within(table).getByText('24x24x24 Box')).toBeInTheDocument();
  expect(within(table).getByText('Bubble Mailer')).toBeInTheDocument();
});

test('renders Reorder Now status badge in the table', async () => {
  render(<Analytics />);
  const table = await screen.findByRole('table');
  expect(within(table).getByText('Reorder Now')).toBeInTheDocument();
});

test('renders Due Soon status badge for item with days_until_reorder < 7', async () => {
  render(<Analytics />);
  const table = await screen.findByRole('table');
  expect(within(table).getByText('Due Soon')).toBeInTheDocument();
});

test('renders OK status badge for healthy item', async () => {
  render(<Analytics />);
  const table = await screen.findByRole('table');
  const okBadges = within(table).getAllByText('OK');
  expect(okBadges.length).toBeGreaterThan(0);
});

test('renders dash for days_until_empty when usage rate is 0', async () => {
  render(<Analytics />);
  await screen.findByRole('table');
  const dashes = screen.getAllByText('—');
  expect(dashes.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

test('filters table rows by SKU search', async () => {
  render(<Analytics />);
  const table = await screen.findByRole('table');

  fireEvent.change(screen.getByPlaceholderText(/search sku or description/i), {
    target: { value: '10004' },
  });

  expect(within(table).getByText('10x10x10 Box')).toBeInTheDocument();
  expect(within(table).queryByText('12x12x12 Box')).not.toBeInTheDocument();
});

test('filters table rows by description search', async () => {
  render(<Analytics />);
  await screen.findByRole('table');

  fireEvent.change(screen.getByPlaceholderText(/search sku or description/i), {
    target: { value: 'bubble' },
  });

  const table = screen.getByRole('table');
  expect(within(table).getByText('Bubble Mailer')).toBeInTheDocument();
  expect(within(table).queryByText('10x10x10 Box')).not.toBeInTheDocument();
});

test('shows empty state when search matches nothing', async () => {
  render(<Analytics />);
  await screen.findByRole('table');

  fireEvent.change(screen.getByPlaceholderText(/search sku or description/i), {
    target: { value: 'zzznomatch' },
  });

  expect(screen.getByText(/no items match/i)).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Fetch params
// ---------------------------------------------------------------------------

test('fetches /api/analytics with default params on mount', async () => {
  render(<Analytics />);
  await screen.findByRole('table');

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/analytics?days=30&lead_time=5&safety_stock=3'
  );
});

test('refetches with updated params when Apply is clicked', async () => {
  render(<Analytics />);
  await screen.findByRole('table');

  const inputs = screen.getAllByRole('spinbutton');
  fireEvent.change(inputs[0], { target: { value: '60' } });
  fireEvent.click(screen.getByRole('button', { name: /apply/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/analytics?days=60&lead_time=5&safety_stock=3'
    );
  });
});

// ---------------------------------------------------------------------------
// Row expand / detail panel
// ---------------------------------------------------------------------------

test('expands detail panel when a row is clicked', async () => {
  render(<Analytics />);
  const table = await screen.findByRole('table');

  fireEvent.click(within(table).getByText('10x10x10 Box').closest('tr'));

  // "Lead Time" (capital T) is the detail panel stat label, distinct from "Lead time" in params
  expect(await screen.findByText('Lead Time')).toBeInTheDocument();
  expect(screen.getByText('Safety Stock')).toBeInTheDocument();
  expect(screen.getByText('Days to Reorder')).toBeInTheDocument();
});

test('collapses detail panel when same row is clicked again', async () => {
  render(<Analytics />);
  const table = await screen.findByRole('table');
  const row = within(table).getByText('10x10x10 Box').closest('tr');

  fireEvent.click(row);
  expect(await screen.findByText('Lead Time')).toBeInTheDocument();

  fireEvent.click(row);
  await waitFor(() => {
    expect(screen.queryByText('Lead Time')).not.toBeInTheDocument();
  });
});

test('fetches history for expanded SKU', async () => {
  render(<Analytics />);
  const table = await screen.findByRole('table');

  fireEvent.click(within(table).getByText('10x10x10 Box').closest('tr'));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/analytics/10004/history')
    );
  });
});
