import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CsvUpload from '../CsvUpload';

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

test('renders file input and upload button', () => {
  render(<CsvUpload />);

  expect(screen.getByLabelText(/upload sales csv/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
});

test('upload button is disabled when no file is selected', () => {
  render(<CsvUpload />);

  expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled();
});

test('upload button enables after a file is selected', async () => {
  render(<CsvUpload />);

  const file = new File(['sku,qty\n10005,3'], 'sales.csv', { type: 'text/csv' });
  const input = screen.getByLabelText(/upload sales csv/i);

  await userEvent.upload(input, file);

  expect(screen.getByRole('button', { name: /upload/i })).not.toBeDisabled();
});

test('posts the CSV file to /api/sales/upload on submit', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ message: 'Upload successful', rows_processed: 1 }),
  });

  render(<CsvUpload />);

  const file = new File(['sku,qty\n10005,3'], 'sales.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText(/upload sales csv/i), file);
  await userEvent.click(screen.getByRole('button', { name: /upload/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/sales/upload',
      expect.objectContaining({ method: 'POST' })
    );
  });

  const [, options] = global.fetch.mock.calls[0];
  expect(options.body).toBeInstanceOf(FormData);
});

test('shows success message after upload', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ message: 'Upload successful', rows_processed: 5 }),
  });

  render(<CsvUpload />);

  const file = new File(['sku,qty\n10005,3'], 'sales.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText(/upload sales csv/i), file);
  await userEvent.click(screen.getByRole('button', { name: /upload/i }));

  expect(await screen.findByText(/upload successful/i)).toBeInTheDocument();
});

test('shows error message when upload fails', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: 'Invalid CSV format' }),
  });

  render(<CsvUpload />);

  const file = new File(['bad data'], 'sales.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText(/upload sales csv/i), file);
  await userEvent.click(screen.getByRole('button', { name: /upload/i }));

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(await screen.findByText(/invalid csv format/i)).toBeInTheDocument();
});

test('rejects non-CSV files', async () => {
  render(<CsvUpload />);

  const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });
  await userEvent.upload(screen.getByLabelText(/upload sales csv/i), file);

  expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled();
  expect(screen.getByText(/only csv files are accepted/i)).toBeInTheDocument();
});
