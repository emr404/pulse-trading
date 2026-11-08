import { z } from 'zod'
export const barSchema = z.object({
  t: z.string(),
  o: z.number().positive(),
  h: z.number().positive(),
  l: z.number().positive(),
  c: z.number().positive(),
  v: z.number().nonnegative(),
})
export const eventSchema = z.object({
  T: z.string(),
  S: z.string().optional(),
  msg: z.string().optional(),
  code: z.number().optional(),
  p: z.number().optional(),
  s: z.number().optional(),
  bp: z.number().optional(),
  ap: z.number().optional(),
  t: z.string().optional(),
  i: z.union([z.string(), z.number()]).optional(),
})

export type AlpacaEvent = z.infer<typeof eventSchema>
