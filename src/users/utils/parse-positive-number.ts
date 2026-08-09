export function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
