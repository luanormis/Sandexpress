export function registeredPeople(value: unknown): number {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 50 ? count : 1;
}

// Use the original bill, not a repeatedly shrinking balance. The last
// payment absorbs the cent remainder and can never exceed the balance.
export function accountShare(total: number, remaining: number, people: number): number {
  const totalCents = Math.max(0, Math.round(total * 100));
  const remainingCents = Math.max(0, Math.round(remaining * 100));
  if (!Number.isFinite(totalCents) || !Number.isFinite(remainingCents)) return 0;
  return Math.min(remainingCents, Math.ceil(totalCents / registeredPeople(people))) / 100;
}
