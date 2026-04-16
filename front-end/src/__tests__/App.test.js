import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const inventoryResponse = () =>
  Promise.resolve({
    ok: true,
    json: async () => ([
      { sku: '10005', description: '12x12x12 Box', item_quantity: 12, return_quantity: 1 },
    ]),
  });

beforeEach(() => {
  global.fetch = jest.fn((url, options) => {
    if (url === '/api/inventory' && !options) {
      return inventoryResponse();
    }

    if (url === '/api/inventory/10005' && options?.method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          sku: '10005',
          description: '12x12x12 Box',
          item_quantity: 15,
          return_quantity: 1,
        }),
      });
    }

    if (url === '/api/csv/upload' && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ message: 'ok' }),
      });
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

test('shows error message when CSV import fails', async () => {
  global.fetch.mockImplementation((url, options) => {
    if (url === '/api/inventory' && !options) return inventoryResponse();
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
