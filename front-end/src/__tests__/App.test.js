import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

beforeEach(() => {
  global.fetch = jest.fn((url, options) => {
    if (url === '/api/inventory' && !options) {
      return Promise.resolve({
        ok: true,
        json: async () => ([
          {
            sku: '10005',
            description: '12x12x12 Box',
            item_quantity: 12,
            return_quantity: 1,
          },
        ]),
      });
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
