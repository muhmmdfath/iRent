import { BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';

export function normalizePhone(value: string): string {
  let phone = value.trim().replace(/[\s()-]/g, '');
  if (phone.startsWith('0')) phone = '+62' + phone.slice(1);
  else if (phone.startsWith('62')) phone = '+' + phone;
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone))
    throw new BadRequestException('Nomor HP tidak valid.');
  return phone;
}
export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!isEmail(email) || email.length > 254)
    throw new BadRequestException('Email tidak valid.');
  return email;
}
export function normalizeIdentity(
  value: string,
): { email: string } | { phone: string } {
  return value.includes('@')
    ? { email: normalizeEmail(value) }
    : { phone: normalizePhone(value) };
}
