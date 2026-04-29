export function calculateGrossMargin(revenue: number, cogs: number): number {
  if (revenue <= 0) return 0
  return ((revenue - cogs) / revenue) * 100
}

export function calculateLTV(orders: { total: number }[]): number {
  return orders.reduce((sum, o) => sum + o.total, 0)
}

export function calculateCAC(marketingCost: number, newCustomers: number): number {
  if (newCustomers <= 0) return 0
  return marketingCost / newCustomers
}

export function calculateChurnRate(
  activeStart: number,
  activeEnd: number,
  newCustomers: number,
): number {
  if (activeStart <= 0) return 0
  const lost = activeStart + newCustomers - activeEnd
  return (lost / activeStart) * 100
}

export type RFMSegment = 'vip' | 'active' | 'new' | 'at_risk' | 'lost'

export function calculateRFMScore(
  recency: number,
  frequency: number,
  monetary: number,
): RFMSegment {
  const r = recency <= 30 ? 3 : recency <= 90 ? 2 : 1
  const f = frequency >= 5 ? 3 : frequency >= 2 ? 2 : 1
  const m = monetary >= 500000 ? 3 : monetary >= 150000 ? 2 : 1
  const score = r + f + m

  if (score >= 8) return 'vip'
  if (score >= 6) return 'active'
  if (f === 1 && r <= 30) return 'new'
  if (r > 90 && score <= 5) return 'at_risk'
  return 'lost'
}

export function calculateRetentionByCohort(
  orders: { customer_phone: string; paid_at: string }[],
  cohortMonth: string,
): Record<number, number> {
  const cohortStart = new Date(cohortMonth)

  const cohortCustomers = new Set(
    orders
      .filter((o) => {
        const d = new Date(o.paid_at)
        return (
          d.getFullYear() === cohortStart.getFullYear() &&
          d.getMonth() === cohortStart.getMonth()
        )
      })
      .map((o) => o.customer_phone),
  )

  if (cohortCustomers.size === 0) return {}

  const retention: Record<number, number> = { 0: 100 }
  const maxMonths = 12

  for (let month = 1; month <= maxMonths; month++) {
    const targetDate = new Date(cohortStart)
    targetDate.setMonth(targetDate.getMonth() + month)

    const activeInMonth = new Set(
      orders
        .filter((o) => {
          const d = new Date(o.paid_at)
          return (
            d.getFullYear() === targetDate.getFullYear() &&
            d.getMonth() === targetDate.getMonth() &&
            cohortCustomers.has(o.customer_phone)
          )
        })
        .map((o) => o.customer_phone),
    )

    retention[month] = Math.round((activeInMonth.size / cohortCustomers.size) * 100)
  }

  return retention
}

export function forecastRevenue(
  historicalSeries: { date: string; revenue: number }[],
  forecastDays: number,
): { date: string; forecast: number; lower: number; upper: number }[] {
  if (historicalSeries.length < 7) return []

  const values = historicalSeries.map((d) => d.revenue)
  const windowSize = Math.min(7, values.length)

  const movingAvg = (data: number[], window: number): number[] => {
    const result: number[] = []
    for (let i = window - 1; i < data.length; i++) {
      const slice = data.slice(i - window + 1, i + 1)
      result.push(slice.reduce((a, b) => a + b, 0) / window)
    }
    return result
  }

  const ma = movingAvg(values, windowSize)
  const lastMA = ma[ma.length - 1]

  const weeklyPattern: number[] = Array(7).fill(0)
  const weeklyCounts: number[] = Array(7).fill(0)
  historicalSeries.forEach((point) => {
    const dow = new Date(point.date).getDay()
    weeklyPattern[dow] += point.revenue
    weeklyCounts[dow]++
  })
  const avgByDow = weeklyPattern.map((sum, i) => (weeklyCounts[i] > 0 ? sum / weeklyCounts[i] : lastMA))
  const overallAvg = values.reduce((a, b) => a + b, 0) / values.length

  const result: { date: string; forecast: number; lower: number; upper: number }[] = []
  const lastDate = new Date(historicalSeries[historicalSeries.length - 1].date)

  for (let i = 1; i <= forecastDays; i++) {
    const d = new Date(lastDate)
    d.setDate(d.getDate() + i)
    const dow = d.getDay()
    const seasonalFactor = overallAvg > 0 ? avgByDow[dow] / overallAvg : 1
    const forecast = Math.round(lastMA * seasonalFactor)
    const stddev = Math.round(forecast * 0.15)
    result.push({
      date: d.toISOString().slice(0, 10),
      forecast,
      lower: Math.max(0, forecast - stddev),
      upper: forecast + stddev,
    })
  }

  return result
}

export function detectAnomalies(
  series: { date: string; value: number }[],
  threshold = 2,
): { date: string; value: number; zscore: number }[] {
  if (series.length < 3) return []

  const values = series.map((d) => d.value)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stddev = Math.sqrt(variance)

  if (stddev === 0) return []

  return series
    .map((d) => ({ ...d, zscore: Math.abs((d.value - mean) / stddev) }))
    .filter((d) => d.zscore > threshold)
}
