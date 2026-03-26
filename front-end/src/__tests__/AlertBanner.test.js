import { render, screen } from '@testing-library/react';
import AlertBanner from '../AlertBanner';

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

test('renders nothing when last import is within threshold', () => {
  const { container } = render(
    <AlertBanner lastImportDate={daysAgo(2)} thresholdDays={7} />
  );

  expect(container).toBeEmptyDOMElement();
});

test('shows alert when no sales data has ever been imported', () => {
  render(<AlertBanner lastImportDate={null} thresholdDays={7} />);

  const alert = screen.getByRole('alert');
  expect(alert).toBeInTheDocument();
  expect(alert).toHaveTextContent(/no sales data/i);
});

test('shows alert when last import exceeds threshold', () => {
  render(<AlertBanner lastImportDate={daysAgo(10)} thresholdDays={7} />);

  const alert = screen.getByRole('alert');
  expect(alert).toBeInTheDocument();
  expect(alert).toHaveTextContent(/sales data/i);
});

test('alert message includes how many days since last import', () => {
  render(<AlertBanner lastImportDate={daysAgo(10)} thresholdDays={7} />);

  expect(screen.getByRole('alert')).toHaveTextContent(/10 days/i);
});

test('threshold is configurable — no alert at 6 days with 7-day threshold', () => {
  const { container } = render(
    <AlertBanner lastImportDate={daysAgo(6)} thresholdDays={7} />
  );

  expect(container).toBeEmptyDOMElement();
});

test('threshold is configurable — alert fires at 3 days with 2-day threshold', () => {
  render(<AlertBanner lastImportDate={daysAgo(3)} thresholdDays={2} />);

  expect(screen.getByRole('alert')).toBeInTheDocument();
});
