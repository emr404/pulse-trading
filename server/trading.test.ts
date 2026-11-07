import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executeOrder, freshPortfolio, orderSchema } from './trading.js'
import { PortfolioStore } from './portfolio.js'
import type { Quote } from '../shared/types.js'
const now = Date.now()
const quote: Quote = {
  symbol: 'AAPL',
  price: 100,
  bid: 99,
  ask: 101,
  changePct: 0,
  high: 101,
  low: 99,
  volume: 0,
  updatedAt: now,
  quoteAt: now,
  previousClose: 100,
}
describe('paper trading', () => {
  it('buys at ask, sells at bid, and accounts for realized losses', () => {
    const initial = freshPortfolio()
    const bought = executeOrder(
      initial,
      { symbol: 'AAPL', side: 'buy', quantity: 2 },
      quote,
      'demo',
      now,
    )
    expect(initial.cash).toBe(10000)
    expect(bought.cash).toBe(9798)
    expect(bought.positions[0].averagePrice).toBe(101)
    const sold = executeOrder(
      bought,
      { symbol: 'AAPL', side: 'sell', quantity: 2 },
      quote,
      'demo',
      now,
    )
    expect(sold.cash).toBe(9996)
    expect(sold.realizedPnl).toBe(-4)
    expect(sold.positions).toEqual([])
    expect(sold.orders).toHaveLength(2)
  })
  it('rejects overspending, overselling, and stale quotes', () => {
    expect(() =>
      executeOrder(
        freshPortfolio(),
        { symbol: 'AAPL', side: 'buy', quantity: 1000 },
        quote,
        'demo',
        now,
      ),
    ).toThrow('cash')
    expect(() =>
      executeOrder(
        freshPortfolio(),
        { symbol: 'AAPL', side: 'sell', quantity: 1 },
        quote,
        'demo',
        now,
      ),
    ).toThrow('held')
    expect(() =>
      executeOrder(
        freshPortfolio(),
        { symbol: 'AAPL', side: 'buy', quantity: 1 },
        quote,
        'demo',
        now + 61000,
      ),
    ).toThrow('fresh')
  })
  it('rejects stale bid/ask even when the last trade is fresh', () => {
    expect(() =>
      executeOrder(
        freshPortfolio(),
        { symbol: 'AAPL', side: 'buy', quantity: 1 },
        { ...quote, quoteAt: now - 61000 },
        'live',
        now,
      ),
    ).toThrow('fresh')
  })
  it('validates order input', () => {
    for (const quantity of [0, -1, 0.000000001, 1000001, Infinity])
      expect(
        orderSchema.safeParse({ symbol: 'AAPL', side: 'buy', quantity })
          .success,
      ).toBe(false)
  })
  it('restores saved positions and orders', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pulse-test-'))
    try {
      const path = join(directory, 'portfolio.json')
      const value = executeOrder(
        freshPortfolio(),
        { symbol: 'AAPL', side: 'buy', quantity: 1 },
        quote,
        'demo',
        now,
      )
      new PortfolioStore(path).save(value)
      expect(new PortfolioStore(path).get()).toEqual(value)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
