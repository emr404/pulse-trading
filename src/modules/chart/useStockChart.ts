import {
  ref,
  shallowRef,
  watch,
  onMounted,
  onUnmounted,
  computed,
  type Ref,
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
import { api, money } from '../../lib/format'
import { useMarket } from '../market/store'
import { candleSchema, type CandleUpdate } from '../../../shared/protocol'
import { mergeLiveCandle } from './aggregate'
export function useStockChart(selection: {
  symbol: Ref<string>
  range: Ref<Range>
  mode: Ref<MarketMode>
}) {
  const market = useMarket()
  const currency = useCurrency()
  const container = ref<HTMLDivElement>(),
    loading = ref(true),
    error = ref(''),
    expanded = ref(false),
    hover = ref<Candle | null>(null),
    bars = shallowRef<Candle[]>([])
  let chart: IChartApi | undefined,
    candles: ISeriesApi<'Candlestick'> | undefined,
    volume: ISeriesApi<'Histogram'> | undefined,
    abort: AbortController | undefined,
    observer: ResizeObserver | undefined
  let loadedSymbol = '',
    loadedRange = ''
  const legend = computed(
    () => hover.value ?? lastBar.value ?? bars.value.at(-1),
  )
  async function load() {
    if (!chart || !selection.symbol.value) return
    abort?.abort()
    abort = new AbortController()
    const symbol = selection.symbol.value,
      range = selection.range.value,
      signal = abort.signal
    loading.value = true
    error.value = ''
    hover.value = null
    lastBar.value = null
    bars.value = []
    candles?.setData([])
    volume?.setData([])
    try {
      const data = await api<{ candles: Candle[]; live: CandleUpdate[] }>(
        `/api/candles?symbol=${encodeURIComponent(symbol)}&range=${range}`,
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
    void load()
  })
  watch(
    () => [selection.symbol.value, selection.range.value, selection.mode.value],
    () => void load(),
  )
  const liveVolumes = new Map<number, number>()
  let unsubscribe: (() => void) | undefined
  let animation = 0
  const pending = new Map<number, CandleUpdate>()
  const lastBar = shallowRef<Candle | null>(null)
  function flush() {
    animation = 0
    if (
      loading.value ||
      !candles ||
      !volume ||
      loadedSymbol !== selection.symbol.value ||
      loadedRange !== selection.range.value
    )
      return
    for (const update of [...pending.values()].sort(
      (a, b) => a.candle.time - b.candle.time,
    )) {
      const raw = update.candle,
        last = bars.value.at(-1)
      const seconds = RANGE_CONFIG[selection.range.value].seconds
      const live =
        last &&
        Math.floor(raw.time / seconds) === Math.floor(last.time / seconds)
          ? { ...raw, time: last.time }
          : raw
      if (last && live.time < last.time) continue
      const merged = mergeLiveCandle(last, live, liveVolumes.get(raw.time) ?? 0)
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
  }
  watch(
    () => [selection.symbol.value, selection.range.value],
    () => {
      unsubscribe?.()
      pending.clear()
      liveVolumes.clear()
      lastBar.value = null
      unsubscribe = market.subscribe(
        `${selection.symbol.value}:${selection.range.value}`,
        (update) => {
          pending.set(update.candle.time, update)
          if (!animation) animation = requestAnimationFrame(flush)
        },
      )
    },
    { immediate: true },
  )
  watch(loading, (value) => {
    if (!value && pending.size && !animation)
      animation = requestAnimationFrame(flush)
  })
  watch(
    () => market.revision,
    () => void load(),
  )
  function escape(event: KeyboardEvent) {
    if (event.key === 'Escape') expanded.value = false
  }
  onMounted(() => document.addEventListener('keydown', escape))
  onUnmounted(() => {
    unsubscribe?.()
    cancelAnimationFrame(animation)
    pending.clear()
    abort?.abort()
    observer?.disconnect()
    chart?.remove()
    document.removeEventListener('keydown', escape)
  })

  return { container, loading, error, expanded, bars, legend, load }
}
