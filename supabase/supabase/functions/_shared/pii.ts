const EMAIL = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const PHONE = /(?:\+?\d[\s()./-]?){8,}/;
const BELGIAN_NISS = /\b\d{2}[.\/-]?\d{2}[.\/-]?\d{2}[-\s]?\d{3}[.\/-]?\d{2}\b/;
const CARD_LIKE = /\b(?:\d[ -]?){13,19}\b/;

export function containsLikelyPii(value: string): boolean {
  return EMAIL.test(value) || PHONE.test(value) || BELGIAN_NISS.test(value) ||
    CARD_LIKE.test(value);
}
