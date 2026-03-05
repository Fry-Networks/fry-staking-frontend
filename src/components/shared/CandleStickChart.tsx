import React, { useEffect, useState, useCallback } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts' // removed ApexAxisChartSeries
import axios from 'axios'

// Vestige Labs candle data interface
interface VestigeCandle {
  network_id: number
  asset_id: number
  interval: number
  denominating_asset_id: number
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  confidence: number
}

interface CandleData {
  x: Date
  y: [number, number, number, number] // [open, high, low, close]
}

const FETCH_INTERVAL = 5 * 60 * 1000 // 5 minutes

// Smart price formatter that preserves significant digits for small numbers
const formatPrice = (value: number): string => {
  if (value === 0) return '0';
  if (value >= 1) return value.toFixed(4);
  const str = value.toFixed(20);
  const match = str.match(/^0\.(0*[1-9]\d{0,3})/);
  return match ? `0.${match[1]}` : value.toPrecision(4);
}

// Vestige Labs API configuration
const VESTIGE_BASE_URL = 'https://api.vestigelabs.org'

// Function to get Vestige Labs candles API URL
const getVestigeCandlesUrl = (fromToken?: Currency, toToken?: Currency, timeframe: string = '1D'): string => {
  if (!fromToken || !toToken) {
    return `${VESTIGE_BASE_URL}/assets/0/candles?network_id=0&interval=86400&denominating_asset_id=31566704`
  }
  
  // Calculate time range based on timeframe
  const now = Math.floor(Date.now() / 1000)
  let interval: number
  let daysBack: number
  
  switch (timeframe) {
    case '1D':
      interval = 3600 // 1 hour intervals
      daysBack = 1
      break
    case '7D':
      interval = 86400 // 1 day intervals
      daysBack = 7
      break
    case '1M':
      interval = 86400 // 1 day intervals
      daysBack = 30
      break
    case '3M':
      interval = 86400 // 1 day intervals
      daysBack = 90
      break
    case '6M':
      interval = 86400 // 1 day intervals
      daysBack = 180
      break
    case '1Y':
      interval = 86400 // 1 day intervals
      daysBack = 365
      break
    default:
      interval = 86400
      daysBack = 7
  }
  
  const startTime = now - (daysBack * 24 * 60 * 60)
  
  return `${VESTIGE_BASE_URL}/assets/${fromToken.id}/candles?network_id=0&interval=${interval}&start=${startTime}&end=${now}&denominating_asset_id=${toToken.id}`
}

interface Currency {
  code: string
  label: string
  img: string
  id: number
  decimals: number
}

interface CandleStickChartProps {
  fromToken?: Currency
  toToken?: Currency
  swapAmount?: string
  timeframe?: '1D' | '7D' | '1M' | '3M' | '6M' | '1Y'
}

const CandleStickChart: React.FC<CandleStickChartProps> = ({ fromToken, toToken, timeframe = '1D' }) => {
  const [chartData, setChartData] = useState<CandleData[]>([])
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)

  // Optional fallback generator (used if API fails)
  const generateChartData = useCallback((basePrice: number, volatility: number = 0.02, period: string = '1D') => {
    const data: CandleData[] = []
    const now = Date.now()

    let interval: number
    let dataPoints: number

    switch (period) {
      case '1D':
        interval = 60 * 60 * 1000 // 1 hour
        dataPoints = 24
        break
      case '7D':
        interval = 4 * 60 * 60 * 1000 // 4 hours
        dataPoints = 42
        break
      case '1M':
        interval = 24 * 60 * 60 * 1000 // 1 day
        dataPoints = 30
        break
      case '3M':
        interval = 24 * 60 * 60 * 1000
        dataPoints = 90
        break
      case '6M':
        interval = 24 * 60 * 60 * 1000
        dataPoints = 180
        break
      case '1Y':
        interval = 24 * 60 * 60 * 1000
        dataPoints = 365
        break
      default:
        interval = 60 * 60 * 1000
        dataPoints = 24
    }

    let price = basePrice
    for (let i = dataPoints; i >= 0; i--) {
      const ts = now - i * interval
      const change = (Math.random() - 0.5) * volatility * 2
      const open = price
      const close = price * (1 + change)
      const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5)
      const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5)

      data.push({ x: new Date(ts), y: [open, high, low, close] })
      price = close
    }
    return data
  }, [])

  const fetchTradeData = useCallback(async () => {
    // Don't fetch if tokens are not available
    if (!fromToken || !toToken) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true)
    try {
      const apiUrl = getVestigeCandlesUrl(fromToken, toToken, timeframe)
      
      // Fetch candles data from Vestige Labs API
      const response = await axios.get(apiUrl)
      const candlesData = response.data

      if (!candlesData || !Array.isArray(candlesData) || candlesData.length === 0) {
        throw new Error('No candles data returned from Vestige Labs')
      }

      // Convert Vestige Labs candles to our format
      const candles: CandleData[] = candlesData
        .sort((a: any, b: any) => a.timestamp - b.timestamp)
        .map((candle: any) => ({
          x: new Date(candle.timestamp * 1000), // Convert Unix timestamp to Date
          y: [
            candle.open,   // open
            candle.high,   // high
            candle.low,    // low
            candle.close   // close
          ]
        }))

      setChartData(candles)

      const latest = candles[candles.length - 1].y[3]
      const prev = candles[candles.length - 2]?.y[3] ?? latest
      setCurrentPrice(latest)
      setPriceChange(latest - prev)
      setPriceChangePercent(prev ? ((latest - prev) / prev) * 100 : 0)
      setLastUpdateTime(new Date())
      
    } catch (err: any) {
      // Only log error if tokens are available
      if (fromToken && toToken) {
        const errorMessage = err?.response?.status 
          ? `API returned ${err.response.status}`
          : err?.message || 'Network error';
        console.error(`Chart data error for ${fromToken.code}/${toToken.code}: ${errorMessage}`);
      }
      const fallback = generateChartData(0.2, 0.02, timeframe)
      setChartData(fallback)
      const latest = fallback[fallback.length - 1].y[3]
      const prev = fallback[fallback.length - 2]?.y[3] ?? latest
      setCurrentPrice(latest)
      setPriceChange(latest - prev)
      setPriceChangePercent(prev ? ((latest - prev) / prev) * 100 : 0)
      setLastUpdateTime(new Date())
    } finally {
      setIsLoading(false)
    }
  }, [generateChartData, timeframe, fromToken, toToken])

  useEffect(() => {
    // Only fetch if both tokens are available
    if (!fromToken || !toToken) {
      setIsLoading(false);
      return;
    }
    
    fetchTradeData()
    const id = setInterval(fetchTradeData, FETCH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchTradeData, fromToken, toToken])

  const options: ApexOptions = {
    chart: {
      type: 'candlestick',
      height: 350,
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
      background: 'transparent',
      zoom: { enabled: true, type: 'x', autoScaleYaxis: true },

    },
    title: {
      text: fromToken && toToken ? `${fromToken.code}/${toToken.code} Price Chart (Vestige Labs)` : 'Price Chart',
      align: 'left',
      style: { fontSize: '16px', fontWeight: 'bold', color: '#333' }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: { colors: '#7A7A7A' },
        datetimeFormatter: {
          year: 'yyyy',
          month: "MMM 'yy",
          day: 'dd MMM',
          hour: 'HH:mm',
        }
      },
      tooltip: { enabled: true },
      crosshairs: {
      show: true,
      width: 1,
      position: 'back',
      opacity: 0.9,
      stroke: { color: '#00B69B', width: 1, dashArray: 5 },
      fill: { type: 'solid', color: 'rgba(0, 182, 155, 0.1)' },
    },
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        style: { colors: '#7A7A7A' },
        formatter: (v) => v.toFixed(6),
      },
    },
    plotOptions: {
      candlestick: {
        colors: { upward: '#00B69B', downward: '#ef403c' },
        wick: { useFillColor: true },
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 1 },
    states: {
      hover: { filter: { type: 'darken', value: 0.9 } },
      active: { filter: { type: 'darken', value: 0.9 } },
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      x: { format: 'dd MMM yyyy HH:mm' },
      y: { formatter: (v) => v.toFixed(6) },
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const data = w.globals.initialSeries?.[seriesIndex]?.data?.[dataPointIndex]
        if (!data) return ''
        const [open, high, low, close] = data.y
        const date = new Date(data.x)
        const isUp = close >= open
        return `
          <div style="background: white; border: 1px solid #ccc; border-radius: 8px; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div style="font-weight: bold; margin-bottom: 8px; color: ${isUp ? '#00B69B' : '#ef403c'}">
              ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
            </div>
            <div><span style="color: #666;">Open:</span> <b>${open.toFixed(6)}</b></div>
            <div><span style="color: #666;">High:</span> <b style="color:#00B69B">${high.toFixed(6)}</b></div>
            <div><span style="color: #666;">Low:</span> <b style="color:#ef403c">${low.toFixed(6)}</b></div>
            <div><span style="color: #666;">Close:</span> <b style="color:${isUp ? '#00B69B' : '#ef403c'}">${close.toFixed(6)}</b></div>
          </div>
        `
      }
    },
    grid: { borderColor: '#f1f1f1', strokeDashArray: 3 },
    responsive: [{ breakpoint: 768, options: { chart: { height: 250 }, title: { style: { fontSize: '14px' } } } }],
    noData: { text: 'No data available', align: 'center', verticalAlign: 'middle', style: { color: '#7A7A7A', fontSize: '16px' } }
  }

    const series: { name: string; data: CandleData[] }[] = [{ name: 'Price', data: chartData }]


  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Show loading or placeholder when tokens aren't selected
  if (!fromToken || !toToken) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-2">Select tokens to view price chart</p>
          <p className="text-gray-400 text-sm">Choose tokens from the swap interface above</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-red-500"></div>
      </div>
    )
  }

  return (
    <div className="chart w-full px-[24px] pt-[19px] pb-[21px] rounded-[22px] bg-[var(--bg-card)] shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-apex text-[var(--text-primary)]">
          {fromToken && toToken ? `${fromToken.code}/${toToken.code} Price Chart` : 'Price Chart'}
        </h3>
        <div className="flex flex-col items-end gap-1">
          <span className="text-text_clr medium text-sm">
            Date: {lastUpdateTime ? formatDate(lastUpdateTime) : '--'}
          </span>
          <span className="text-text_clr medium text-sm">
            Last Updated: {lastUpdateTime ? formatTime(lastUpdateTime) : '--'}
          </span>
        </div>
      </div>

      <h4 className="text-[var(--text-primary)] tracking-[0.96px] mt-[3px]">
        $ {formatPrice(currentPrice)}
      </h4>
      <div className="flex items-center gap-[4px] mb-[50px]">
        <p className={`medium tracking-[0.48px] font-medium ${priceChange >= 0 ? 'text-green' : 'text-red-500'}`}>
          {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
        </p>
        <p className="text-text_clr medium tracking-[0.48px]">Today</p>
      </div>

      <ReactApexChart options={options} series={series} type="candlestick" height={350} />
    </div>
  )
}

export default CandleStickChart
