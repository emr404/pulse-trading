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
export const createPortfolioStore = (file: string) => {
  let localValue: Portfolio
  const get = (): Portfolio => {
    return structuredClone(localValue)
  }

  const save = (value: Portfolio): Portfolio => {
    const validated = portfolioSchema.parse(value)
    writeFileSync(`${file}.tmp`, JSON.stringify(validated, null, 2), {
      mode: 0o600,
    })
    renameSync(`${file}.tmp`, file)
    localValue = validated
    return get()
  }

  mkdirSync(dirname(file), { recursive: true })
  localValue = existsSync(file)
    ? portfolioSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    : freshPortfolio()

  return { get, save }
}
export type PortfolioStore = ReturnType<typeof createPortfolioStore>
