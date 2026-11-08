import { Decimal } from 'decimal.js'
import type { Portfolio, Quote } from '../../../shared/types'
export interface PortfolioValuation {
  marketValue: number
  equity: number
  unrealized: number
  totalPnl: number
}
export function valuePortfolio(
  portfolio: Portfolio | null,
  quote: (symbol: string) => Quote | undefined,
): PortfolioValuation {
  let marketValue = new Decimal(0),
    cost = new Decimal(0)
  for (const position of portfolio?.positions ?? []) {
    marketValue = marketValue.plus(
      new Decimal(position.quantity).mul(
        quote(position.symbol)?.price ?? position.averagePrice,
      ),
    )
    cost = cost.plus(new Decimal(position.quantity).mul(position.averagePrice))
  }
  const equity = marketValue.plus(portfolio?.cash ?? 0)
  return {
    marketValue: marketValue.toNumber(),
    equity: equity.toNumber(),
    unrealized: marketValue.minus(cost).toNumber(),
    totalPnl: portfolio ? equity.minus(portfolio.initialCash).toNumber() : 0,
  }
}
