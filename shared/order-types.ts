export type OrderState = 'pending' | 'filled' | 'cancelled' | 'rejected'
export interface OrderRequest {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  state: OrderState
  createdAt: number
  updatedAt: number
  reason?: string
  fillId?: string
}
