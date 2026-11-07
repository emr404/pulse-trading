import { Decimal } from 'decimal.js'
export function validateOrder(
  quantity: number,
  side: 'buy' | 'sell',
  price: number,
  cash: number,
  held: number,
) {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 1000000 ||
    new Decimal(quantity).decimalPlaces() > 8
  )
    return 'Enter a positive quantity with up to 8 decimal places.'
  if (side === 'buy' && new Decimal(quantity).mul(price).gt(cash))
    return 'Insufficient buying power.'
  if (side === 'sell' && quantity > held)
    return 'Quantity exceeds your holdings.'
  return ''
}
export function sizeOrder(
  part: number,
  side: 'buy' | 'sell',
  price: number,
  cash: number,
  held: number,
) {
  const max = side === 'buy' ? cash / (price * 1.001 || 1) : held
  return Math.floor(max * part * 10000) / 10000
}
