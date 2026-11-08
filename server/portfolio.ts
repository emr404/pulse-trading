import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import { freshPortfolio, symbolSchema } from './trading.js'
import type { Portfolio } from '../shared/types.js'

const finite = z.number().finite()
export const portfolioSchema = z.object({
  requests: z
    .array(
      z.object({
        id: z.string(),
        symbol: symbolSchema,
        side: z.enum(['buy', 'sell']),
        quantity: finite.positive(),
        state: z.enum(['pending', 'filled', 'cancelled', 'rejected']),
        createdAt: finite,
        updatedAt: finite,
        reason: z.string().optional(),
        fillId: z.string().optional(),
      }),
    )
    .default([]),
  initialCash: finite.positive(),
  cash: finite.nonnegative(),
  realizedPnl: finite,
  positions: z.array(
    z.object({
      symbol: symbolSchema,
      quantity: finite.positive(),
      averagePrice: finite.positive(),
    }),
  ),
  orders: z.array(
    z.object({
      id: z.string(),
      symbol: symbolSchema,
      side: z.enum(['buy', 'sell']),
      quantity: finite.positive(),
      price: finite.positive(),
      total: finite.positive(),
      createdAt: finite,
      mode: z.enum(['live', 'demo']),
    }),
  ),
})

/** Single-user local MVP. Atomic replacement prevents partially written JSON. */
export class PortfolioStore {
  private value: Portfolio
  constructor(private file: string) {
    mkdirSync(dirname(file), { recursive: true })
    this.value = existsSync(file)
      ? portfolioSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
      : freshPortfolio()
  }
  get(): Portfolio {
    return structuredClone(this.value)
  }
  save(value: Portfolio): Portfolio {
    const validated = portfolioSchema.parse(value)
    writeFileSync(`${this.file}.tmp`, JSON.stringify(validated, null, 2), {
      mode: 0o600,
    })
    renameSync(`${this.file}.tmp`, this.file)
    this.value = validated
    return this.get()
  }
}
