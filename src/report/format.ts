import type { ISODate } from '../data/types';

const d = (iso: ISODate) => new Date(iso + 'T00:00:00Z');

export const formatDate = (iso: ISODate) =>
  d(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const formatDay = (iso: ISODate) =>
  d(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export const formatMonthYear = (iso: ISODate) =>
  d(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const pad2 = (n: number) => String(n).padStart(2, '0');

const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numberWord = (n: number) => words[n] ?? String(n);

export const plural = (n: number, one: string, many = one + 's') => (n === 1 ? one : many);

export const fullName = (f: { firstName: string; lastName: string }) => `${f.firstName} ${f.lastName}`;
export const initials = (f: { firstName: string; lastName: string }) =>
  `${f.firstName[0] ?? ''}${f.lastName[0] ?? ''}`.toUpperCase();

/** "Alexandra and Daniel", "A, B and C" */
export const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

export const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
