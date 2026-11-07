/**
 * Purchase approval is memory-only and covers a single action.
 * It is not written to disk, so it cannot be extended by editing local storage.
 */
let armed = false;

export function isParentalCommerceOk(): boolean {
  return armed;
}

export function grantParentalCommerce(): void {
  armed = true;
}

export function consumeParentalCommerce(): void {
  armed = false;
}

export function clearParentalCommerce(): void {
  armed = false;
}
