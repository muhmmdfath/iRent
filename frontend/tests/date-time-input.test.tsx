import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DateTimeInput } from '@/components/ui/date-time-input';

function BookingTime() {
  const [value, setValue] = useState('2026-10-25T21:45');
  return (
    <>
      <label htmlFor="booking-time">Waktu booking</label>
      <DateTimeInput
        id="booking-time"
        name="startAt"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        timeRange={{ from: '08:00', to: '22:00' }}
      />
      <output aria-label="Nilai booking">{value}</output>
    </>
  );
}
describe('booking clock', () => {
  it('uses explicit 24-hour WIB and limits the closing hour to minute zero', () => {
    render(<BookingTime />);
    expect(
      screen.getByRole('button', { name: 'Waktu booking' }),
    ).toHaveTextContent('21:45 WIB');
    fireEvent.click(screen.getByRole('button', { name: 'Waktu booking' }));
    const hours = screen.getByRole('combobox', { name: 'Jam' });
    expect(
      [...hours.querySelectorAll('option')].map((option) => option.value),
    ).toEqual(
      Array.from({ length: 15 }, (_, index) =>
        String(index + 8).padStart(2, '0'),
      ),
    );
    fireEvent.change(hours, { target: { value: '22' } });
    expect(screen.getByLabelText('Nilai booking')).toHaveTextContent(
      '2026-10-25T22:00',
    );
    expect(
      screen
        .getByRole('combobox', { name: 'Menit' })
        .querySelectorAll('option'),
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Waktu booking' }),
    ).toHaveTextContent('22:00 WIB');
    fireEvent.change(hours, { target: { value: '08' } });
    expect(
      screen
        .getByRole('combobox', { name: 'Menit' })
        .querySelectorAll('option'),
    ).toHaveLength(60);
    expect(screen.getByLabelText('Nilai booking')).toHaveTextContent(
      '2026-10-25T08:00',
    );
  });
  it('does not restrict administrative timestamps that have no booking range', () => {
    render(<DateTimeInput defaultValue="2026-10-25T02:30" initiallyOpen />);
    expect(
      screen.getByRole('combobox', { name: 'Jam' }).querySelectorAll('option'),
    ).toHaveLength(24);
    expect(screen.getByRole('combobox', { name: 'Menit' })).toHaveValue('30');
  });
});

it('disables unavailable and past dates without changing the selection', () => {
  render(
    <DateTimeInput
      value="2026-10-25T10:00"
      initiallyOpen
      timeRange={{ from: '08:00', to: '22:00' }}
      min="2026-10-25T10:00"
      disabledDate={(date) => date === '2026-10-29'}
    />,
  );
  expect(
    screen.getByRole('button', { name: '24 Oktober 2026' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '29 Oktober 2026' }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: '30 Oktober 2026' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '29 Oktober 2026' }));
  expect(
    screen.getByRole('button', { name: '25 Oktober 2026' }),
  ).toHaveAttribute('aria-pressed', 'true');
});
