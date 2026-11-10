import {
  ref,
  shallowRef,
  watch,
  onMounted,
  onUnmounted,
  computed,
  type Ref,
  type ComputedRef,
  type ShallowRef,
} from 'vue'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import {
  RANGE_CONFIG,
  type Candle,
  type Range,
  type MarketMode,
} from '../../../shared/types'
import { useCurrency } from '../../stores/currency'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useMarket } from '../market/store'
import { candleResponseSchema } from '../../../shared/api'
import { candleSchema, type CandleUpdate } from '../../../shared/protocol'
import { mergeLiveCandle } from './aggregate'
export interface ChartSelection {
  symbol: Ref<string>
  range: Ref<Range>
  mode: Ref<MarketMode>
}
export interface StockChart {
  container: Ref<HTMLDivElement | undefined>
  loading: Ref<boolean>
  error: Ref<string>
  expanded: Ref<boolean>
  bars: ShallowRef<Candle[]>
  legend: ComputedRef<Candle | undefined>
  loadHistory(): Promise<void>
}
export const useStockChart = (selection: ChartSelection): StockChart => {
  const market = useMarket()
  const currency = useCurrency()
  const container = ref<HTMLDivElement>()
  const loading = ref(true)
  const error = ref('')
  const expanded = ref(false)
  const hover = ref<Candle | null>(null)
  const bars = shallowRef<Candle[]>([])
  let chart: IChartApi | undefined
  let candles: ISeriesApi<'Candlestick'> | undefined
  let volume: ISeriesApi<'Histogram'> | undefined
  let abort: AbortController | undefined
  let observer: ResizeObserver | undefined
  let loadedSymbol = ''
  let loadedRange = ''
  const liveVolumes = new Map<number, number>()
  let unsubscribeFromCandles: (() => void) | undefined
  let animation = 0
  const pending = new Map<number, CandleUpdate>()
  const lastBar = shallowRef<Candle | null>(null)

  const legend = computed(
    () => hover.value ?? lastBar.value ?? bars.value.at(-1),
  )
  const loadHistory = async (): Promise<void> => {
    if (!chart || !selection.symbol.value) return
    abort?.abort()
    abort = new AbortController()
    const symbol = selection.symbol.value
    const range = selection.range.value
    const signal = abort.signal
    loading.value = true
    error.value = ''
    hover.value = null
    lastBar.value = null
    bars.value = []
    candles?.setData([])
    volume?.setData([])
    try {
      const data = await api(
        `/api/candles?symbol=${encodeURIComponent(symbol)}&range=${range}`,
        candleResponseSchema,
        { signal },
      )
      if (signal.aborted) return
      data.candles = data.candles
        .map((b) => candleSchema.parse(b))
        .sort((a, b) => a.time - b.time)
        .filter((b, i, all) => !i || b.time !== all[i - 1].time)
      bars.value = data.candles
      loadedSymbol = symbol
      loadedRange = range
      liveVolumes.clear()
      for (const update of data.live ?? [])
        liveVolumes.set(update.candle.time, update.candle.volume)
      candles?.setData(
        data.candles.map((b) => ({ ...b, time: b.time as UTCTimestamp })),
      )
      volume?.setData(
        data.candles.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? '#2b745f66' : '#864a5366',
        })),
      )
      chart.timeScale().fitContent()
      chart.applyOptions({
        timeScale: { timeVisible: ['1D', '1W', '1M'].includes(range) },
      })
    } catch (e) {
      if (!signal.aborted)
        error.value = e instanceof Error ? e.message : 'Chart unavailable.'
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }
  watch(
    () => [currency.currency, currency.rate],
    () => {
      candles?.applyOptions({
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => money(value),
          minMove: 0.01,
        },
      })
    },
  )
  onMounted(() => {
    if (!container.value) return
    chart = createChart(container.value, {
      height: 340,
      layout: {
        background: { type: ColorType.Solid, color: '#111111' },
        textColor: '#a3a3a3',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: '#202020' },
        horzLines: { color: '#242424' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#737373', labelBackgroundColor: '#404040' },
        horzLine: { color: '#737373', labelBackgroundColor: '#404040' },
      },
      rightPriceScale: {
        borderColor: '#303030',
        scaleMargins: { top: 0.12, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#303030',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      handleScroll: { vertTouchDrag: false },
    })
    candles = chart.addSeries(CandlestickSeries, {
      priceFormat: {
        type: 'custom',
        formatter: (value: number) => money(value),
        minMove: 0.01,
      },
      upColor: '#48c49b',
      downColor: '#dd6b75',
      wickUpColor: '#48c49b',
      wickDownColor: '#dd6b75',
      borderVisible: false,
    })
    volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        hover.value = null
        return
      }
      hover.value =
        bars.value.find((b) => b.time === Number(param.time)) ?? null
    })
    observer = new ResizeObserver((entries) => {
      chart?.applyOptions({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height,
      })
    })
    observer.observe(container.value)
    void loadHistory()
  })
  watch(
    () => [selection.symbol.value, selection.range.value, selection.mode.value],
    () => void loadHistory(),
  )
  const renderPendingCandles = (): void => {
    animation = 0
    if (
      loading.value ||
      !candles ||
      !volume ||
      loadedSymbol !== selection.symbol.value ||
      loadedRange !== selection.range.value
    )
      return
    try {
      for (const update of [...pending.values()].sort(
        (a, b) => a.candle.time - b.candle.time,
      )) {
        const raw = update.candle
        const last = bars.value.at(-1)
        const seconds = RANGE_CONFIG[selection.range.value].seconds
        const live =
          last &&
            Math.floor(raw.time / seconds) === Math.floor(last.time / seconds)
            ? { ...raw, time: last.time }
            : raw
        if (last && live.time < last.time) continue
        const merged = mergeLiveCandle(
          last,
          live,
          liveVolumes.get(raw.time) ?? 0,
        )
        liveVolumes.set(raw.time, live.volume)
        if (liveVolumes.size > 1000)
          liveVolumes.delete(liveVolumes.keys().next().value!)
        if (last?.time === live.time) bars.value[bars.value.length - 1] = merged
        else {
          bars.value = [...bars.value.slice(-999), merged]
        }
        lastBar.value = merged
        candles.update({ ...merged, time: merged.time as UTCTimestamp })
        volume.update({
          time: merged.time as UTCTimestamp,
          value: merged.volume,
          color: merged.close >= merged.open ? '#2b745f66' : '#864a5366',
        })
      }
      pending.clear()
    } catch {
      pending.clear()
      error.value = 'Unable to update the chart. Reload chart data to retry.'
    }
  }
  const subscribeToSelectedStock = (): void => {
    unsubscribeFromCandles?.()
    pending.clear()
    liveVolumes.clear()
    lastBar.value = null
    unsubscribeFromCandles = market.subscribeToCandles(
      `${selection.symbol.value}:${selection.range.value}`,
      (update) => {
        pending.set(update.candle.time, update)
        if (!animation) animation = requestAnimationFrame(renderPendingCandles)
      },
    )
  }

  watch(
    () => [selection.symbol.value, selection.range.value],
    subscribeToSelectedStock,
    { immediate: true },
  )
  watch(loading, (value) => {
    if (!value && pending.size && !animation)
      animation = requestAnimationFrame(renderPendingCandles)
  })
  watch(
    () => market.revision,
    () => void loadHistory(),
  )
  const escape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') expanded.value = false
  }
  onMounted(() => document.addEventListener('keydown', escape))
  const disposeChart = (): void => {
    unsubscribeFromCandles?.()
    cancelAnimationFrame(animation)
    pending.clear()
    abort?.abort()
    observer?.disconnect()
    chart?.remove()
    document.removeEventListener('keydown', escape)
  }
  onUnmounted(disposeChart)

  return { container, loading, error, expanded, bars, legend, loadHistory }
}
