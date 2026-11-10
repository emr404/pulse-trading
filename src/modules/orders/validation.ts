import { Decimal } from 'decimal.js'
export const validateOrder = (
  quantity: number,
  side: 'buy' | 'sell',
  price: number,
  cash: number,
  held: number,
): string => {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 1000000 ||
    new Decimal(quantity).decimalPlaces() > 8
  )
    return 'Enter a positive quantity with up to 8 decimal places.'
  if (!Number.isFinite(price) || price <= 0)
    return 'Waiting for a valid market price.'
  if (side === 'buy' && new Decimal(quantity).mul(price).gt(cash))
    return 'Insufficient buying power.'
  if (side === 'sell' && quantity > held)
    return 'Quantity exceeds your holdings.'
  return ''
}
export const sizeOrder = (
  part: number,
  side: 'buy' | 'sell',
  price: number,
  cash: number,
  held: number,
): number => {
  if (
    ![part, price, cash, held].every(Number.isFinite) ||
    price <= 0 ||
    part <= 0 ||
    part > 1
  )
    return 0
  // Leave a small buying-power buffer for price movement before execution.
  const max = side === 'buy' ? cash / (price * 1.001) : held
  return Math.floor(max * part * 10000) / 10000
}
