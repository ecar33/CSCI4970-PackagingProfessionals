import { render, screen } from '@testing-library/react';
import App from './App';

test('renders inventory table header', () => {
  render(<App />);
  const headerElement = screen.getByText(/inventory table/i);
  expect(headerElement).toBeInTheDocument();
});
