import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const FRESH_TIMESTAMP = new Date().toISOString();
const STALE_TIMESTAMP = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

const inventoryResponse = () =>
  Promise.resolve({
    ok: true,
    json: async () => ([
      { sku: '10005', description: '12x12x12 Box', item_quantity: 12, return_quantity: 1 },
    ]),
  });

const lastScanResponse = (timestamp = FRESH_TIMESTAMP) =>
  Promise.resolve({ ok: true, json: async () => ({ timestamp }) });

beforeEach(() => {
  global.fetch = jest.fn((url, options) => {
    if (url === '/api/inventory' && !options) return inventoryResponse();
    if (url === '/api/lastscan') return lastScanResponse();

    if (url === '/api/inventory/10005' && options?.method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ sku: '10005', description: '12x12x12 Box', item_quantity: 15, return_quantity: 1 }),
      });
    }

    if (url === '/api/inventory/10005' && options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }

    if (url === '/api/blacklist/10005' && options?.method === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }

    if (url === '/api/csv/upload' && options?.method === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ message: 'ok' }) });
    }

    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('renders inventory from the backend', async () => {
  render(<App />);

  expect(screen.getByText(/loading inventory/i)).toBeInTheDocument();
  expect(await screen.findByText('12x12x12 Box')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/inventory');
});

test('saves a manual override through the backend', async () => {
  render(<App />);

  await screen.findByText('12x12x12 Box');
  userEvent.click(screen.getByRole('button', { name: /manual override/i }));

  const overrideInput = await screen.findByLabelText(/manual override for 10005/i);
  userEvent.clear(overrideInput);
  userEvent.type(overrideInput, '15');
  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/inventory/10005', expect.objectContaining({
      method: 'PATCH',
    }));
  });

  expect(await screen.findByText('15')).toBeInTheDocument();
});

test('posts CSV file to /api/csv/upload and refreshes inventory', async () => {
  const { container } = render(<App />);
  await screen.findByText('12x12x12 Box');

  const file = new File(['sku,qty\n10005,3'], 'sales.csv', { type: 'text/csv' });
  const fileInput = container.querySelector('input[type="file"]');
  userEvent.upload(fileInput, file);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/csv/upload', expect.objectContaining({ method: 'POST' }));
  });

  const csvCall = global.fetch.mock.calls.find(([url]) => url === '/api/csv/upload');
  expect(csvCall[1].body).toBeInstanceOf(FormData);

  await waitFor(() => {
    const inventoryCalls = global.fetch.mock.calls.filter(([url, opts]) => url === '/api/inventory' && !opts);
    expect(inventoryCalls.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Modal tests

async function openOverride() {
  await screen.findByText('12x12x12 Box');
  userEvent.click(screen.getByRole('button', { name: /manual override/i }));
  await screen.findByRole('button', { name: /delete/i });
}

test('delete button shows confirm modal', async () => {
  render(<App />);
  await openOverride();
  userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  expect(await screen.findByText(/are you sure you want to delete/i)).toBeInTheDocument();
});

test('cancelling delete modal does not call delete API', async () => {
  render(<App />);
  await openOverride();
  userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  await screen.findByText(/are you sure you want to delete/i);
  userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  await waitFor(() => expect(screen.queryByText(/are you sure you want to delete/i)).not.toBeInTheDocument());
  expect(global.fetch).not.toHaveBeenCalledWith('/api/inventory/10005', expect.objectContaining({ method: 'DELETE' }));
});

test('confirming delete modal calls delete API and removes row', async () => {
  render(<App />);
  await openOverride();
  userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  await screen.findByText(/are you sure you want to delete/i);
  userEvent.click(screen.getByRole('button', { name: /confirm/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/inventory/10005', expect.objectContaining({ method: 'DELETE' })));
  await waitFor(() => expect(screen.queryByText('12x12x12 Box')).not.toBeInTheDocument(), { timeout: 1000 });
});

test('blacklist button shows confirm modal', async () => {
  render(<App />);
  await openOverride();
  userEvent.click(screen.getByRole('button', { name: /^blacklist$/i }));
  expect(await screen.findByText(/are you sure you want to blacklist/i)).toBeInTheDocument();
});

test('cancelling blacklist modal does not call blacklist API', async () => {
  render(<App />);
  await openOverride();
  userEvent.click(screen.getByRole('button', { name: /^blacklist$/i }));
  await screen.findByText(/are you sure you want to blacklist/i);
  userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  await waitFor(() => expect(screen.queryByText(/are you sure you want to blacklist/i)).not.toBeInTheDocument());
  expect(global.fetch).not.toHaveBeenCalledWith('/api/blacklist/10005', expect.anything());
});

test('confirming blacklist modal calls blacklist API', async () => {
  render(<App />);
  await openOverride();
  userEvent.click(screen.getByRole('button', { name: /^blacklist$/i }));
  await screen.findByText(/are you sure you want to blacklist/i);
  userEvent.click(screen.getByRole('button', { name: /confirm/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/blacklist/10005', expect.objectContaining({ method: 'POST' })));
});

test('stale scan alert appears when last scan is over a week old', async () => {
  global.fetch.mockImplementation((url, options) => {
    if (url === '/api/inventory' && !options) return inventoryResponse();
    if (url === '/api/lastscan') return lastScanResponse(STALE_TIMESTAMP);
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });
  render(<App />);
  expect(await screen.findByText(/sales data may be outdated/i)).toBeInTheDocument();
});

test('stale scan alert dismisses on got it', async () => {
  global.fetch.mockImplementation((url, options) => {
    if (url === '/api/inventory' && !options) return inventoryResponse();
    if (url === '/api/lastscan') return lastScanResponse(STALE_TIMESTAMP);
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });
  render(<App />);
  await screen.findByText(/sales data may be outdated/i);
  userEvent.click(screen.getByRole('button', { name: /got it/i }));
  await waitFor(() => expect(screen.queryByText(/sales data may be outdated/i)).not.toBeInTheDocument());
});

test('stale scan alert does not appear when scan is recent', async () => {
  render(<App />);
  await screen.findByText('12x12x12 Box');
  expect(screen.queryByText(/sales data may be outdated/i)).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------

test('shows error message when CSV import fails', async () => {
  global.fetch.mockImplementation((url, options) => {
    if (url === '/api/inventory' && !options) return inventoryResponse();
    if (url === '/api/lastscan') return lastScanResponse();
    if (url.startsWith('/api/analytics')) return Promise.resolve({ ok: true, json: async () => [] });
    if (url === '/api/csv/upload') {
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: 'Invalid CSV format' }),
      });
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });

  const { container } = render(<App />);
  await screen.findByText('12x12x12 Box');

  const file = new File(['bad data'], 'sales.csv', { type: 'text/csv' });
  userEvent.upload(container.querySelector('input[type="file"]'), file);

  expect(await screen.findByRole('alert')).toHaveTextContent(/invalid csv format/i);
});
