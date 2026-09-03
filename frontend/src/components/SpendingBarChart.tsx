import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { Transaction } from '../lib/financeApi'
import { currencyFormatter, groupSpendingByPeriod, type Period } from '../lib/spending'

const AXIS_TICK_STYLE = { fontSize: 10, fill: '#898781' }

interface SpendingBarChartProps {
  transactions: Transaction[]
}

export function SpendingBarChart({ transactions }: SpendingBarChartProps) {
  const [period, setPeriod] = useState<Period>('week')
  const data = groupSpendingByPeriod(transactions, period)
  if (data.length === 0) return null

  return (
    <div className="finance-chart">
      <div className="finance-chart__header">
        <h3>Spending over time</h3>
        <div className="finance-period-toggle" role="group" aria-label="Chart period">
          <button
            type="button"
            className={period === 'week' ? 'active' : undefined}
            onClick={() => setPeriod('week')}
          >
            Weekly
          </button>
          <button
            type="button"
            className={period === 'month' ? 'active' : undefined}
            onClick={() => setPeriod('month')}
          >
            Monthly
          </button>
        </div>
      </div>
      <BarChart width={260} height={200} data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS_TICK_STYLE} />
        <YAxis tick={AXIS_TICK_STYLE} width={40} />
        <Tooltip formatter={(value) => currencyFormatter.format(Number(value))} />
        <Bar dataKey="total" fill="#3987e5" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </div>
  )
}
