import { render, screen } from '@testing-library/react';
import Dashboard from '../Dashboard';

const mockAnalytics = {
  last_import_date: new Date().toISOString(),
  kpis: {
    total_skus: 10,
    low_stock_count: 2,
    critical_count: 1,
    total_units: 430,
  },
  usage_rates: [
    { sku: '10005', description: '12x12x12 Box', daily_usage: 3.5, days_until_empty: 14 },
    { sku: '10006', description: '10x10x10 Box', daily_usage: 1.2, days_until_empty: 4 },
  ],
  reorder_suggestions: [
    { sku: '10006', description: '10x10x10 Box', days_until_empty: 4, current_quantity: 5 },
  ],
  trend: [
    { date: '2026-03-17', units_sold: 20 },
    { date: '2026-03-18', units_sold: 35 },
    { date: '2026-03-19', units_sold: 15 },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => mockAnalytics,
    })
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

test('shows loading state before data arrives', () => {
  global.fetch.mockReturnValueOnce(new Promise(() => {})); // never resolves
  render(<Dashboard />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test('fetches analytics from /api/analytics on mount', async () => {
  render(<Dashboard />);

  await screen.findByText(/total skus/i);

  expect(global.fetch).toHaveBeenCalledWith('/api/analytics');
});

test('renders KPI tile for total SKUs', async () => {
  render(<Dashboard />);

  expect(await screen.findByText(/total skus/i)).toBeInTheDocument();
  expect(await screen.findByText('10')).toBeInTheDocument();
});

test('renders KPI tile for low stock count', async () => {
  render(<Dashboard />);

  expect(await screen.findByText(/low stock/i)).toBeInTheDocument();
  expect(await screen.findByText('2')).toBeInTheDocument();
});

test('renders KPI tile for critical count', async () => {
  render(<Dashboard />);

  expect(await screen.findByText(/critical/i)).toBeInTheDocument();
  expect(await screen.findByText('1')).toBeInTheDocument();
});

test('renders usage rate rows with days until empty', async () => {
  render(<Dashboard />);

  expect(await screen.findByText('12x12x12 Box')).toBeInTheDocument();
  expect(await screen.findByText(/14 days/i)).toBeInTheDocument();

  expect(await screen.findByText('10x10x10 Box')).toBeInTheDocument();
  expect(await screen.findByText(/4 days/i)).toBeInTheDocument();
});

test('renders reorder suggestions section', async () => {
  render(<Dashboard />);

  expect(await screen.findByText(/reorder suggestions/i)).toBeInTheDocument();
  expect(await screen.findByText(/10x10x10 Box/i)).toBeInTheDocument();
});

test('shows error message when analytics fetch fails', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

  render(<Dashboard />);

  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

test('shows stale data alert when last import exceeds threshold', async () => {
  const staleAnalytics = {
    ...mockAnalytics,
    last_import_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  };

  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => staleAnalytics,
  });

  render(<Dashboard />);

  expect(await screen.findByRole('alert')).toBeInTheDocument();
});
