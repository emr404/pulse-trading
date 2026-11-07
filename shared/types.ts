import type { OrderRequest } from './order-types.js'
export interface Asset {
  symbol: string
  name: string
  sector: string
  color: string
  demoPrice: number
  demoChange: number
}
export const ASSETS: Asset[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    color: '#c7ccd7',
    demoPrice: 227.63,
    demoChange: 1.24,
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Technology',
    color: '#9ac75d',
    demoPrice: 142.87,
    demoChange: 3.42,
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    sector: 'Consumer cyclical',
    color: '#ed777c',
    demoPrice: 248.5,
    demoChange: -1.86,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    sector: 'Technology',
    color: '#78a9ee',
    demoPrice: 428.76,
    demoChange: 0.87,
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    sector: 'Consumer cyclical',
    color: '#e2b16f',
    demoPrice: 189.32,
    demoChange: 1.63,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    sector: 'Communication',
    color: '#8398f4',
    demoPrice: 176.14,
    demoChange: -0.42,
  },
  {
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    sector: 'Communication',
    color: '#6eabf5',
    demoPrice: 576.2,
    demoChange: 2.17,
  },
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    sector: 'Technology',
    color: '#e98778',
    demoPrice: 156.72,
    demoChange: -2.31,
  },
  {
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co.',
    sector: 'Financial services',
    color: '#a395db',
    demoPrice: 221.48,
    demoChange: 0.64,
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    sector: 'Index ETF',
    color: '#78b7bb',
    demoPrice: 573.18,
    demoChange: 0.82,
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    sector: 'Index ETF',
    color: '#9b8bd8',
    demoPrice: 493.37,
    demoChange: 1.16,
  },
  {
    symbol: 'DIA',
    name: 'SPDR Dow Jones ETF',
    sector: 'Index ETF',
    color: '#c8ad75',
    demoPrice: 422.54,
    demoChange: -0.23,
  },
]
export type Symbol = string
export const RANGES = ['1D', '1W', '1M', '3M', '1Y'] as const
export type Range = (typeof RANGES)[number]
export const RANGE_CONFIG: Record<
  Range,
  { seconds: number; days: number; interval: string }
> = {
  '1D': { seconds: 300, days: 1, interval: '5Min' },
  '1W': { seconds: 3600, days: 7, interval: '1Hour' },
  '1M': { seconds: 14400, days: 30, interval: '4Hour' },
  '3M': { seconds: 86400, days: 90, interval: '1Day' },
  '1Y': { seconds: 86400, days: 365, interval: '1Day' },
}
export type MarketMode = 'live' | 'demo'
export interface Quote {
  symbol: string
  price: number
  bid: number
  ask: number
  changePct: number | null
  previousClose: number | null
  high: number
  low: number
  volume: number
  updatedAt: number
  quoteAt: number
  priceAt?: number
}
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}
export interface FeedStatus {
  mode: MarketMode
  state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  lastMessageAt: number | null
  message: string
  provider: string
}
export interface Position {
  symbol: string
  quantity: number
  averagePrice: number
}
export interface Order {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  total: number
  createdAt: number
  mode: MarketMode
}
export interface Portfolio {
  requests?: OrderRequest[]
  initialCash: number
  cash: number
  realizedPnl: number
  positions: Position[]
  orders: Order[]
}
export interface MarketSnapshot {
  assets: Asset[]
  quotes: Quote[]
  status: FeedStatus
  trails: Record<string, number[]>
}
export type StreamMessage =
  | { type: 'market'; data: MarketSnapshot }
  | { type: 'portfolio'; data: Portfolio }
  | { type: 'heartbeat' }
