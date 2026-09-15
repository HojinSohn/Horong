import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { Transaction } from '../lib/financeApi'
import { currencyFormatter, groupSpendingByPeriod, type Period } from '../lib/spending'

const AXIS_TICK_STYLE = { fontSize: 10, fill: 'var(--muted)' }

interface SpendingBarChartProps {
  transactions: Transaction[]
  period: Period
}

export function SpendingBarChart({ transactions, period }: SpendingBarChartProps) {
  const data = groupSpendingByPeriod(transactions, period)
  if (data.length === 0) return null

  return (
    <div className="finance-chart">
      <h3>Spending over time</h3>
      <BarChart width={260} height={130} data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS_TICK_STYLE} />
        <YAxis tick={AXIS_TICK_STYLE} width={40} />
        <Tooltip
          formatter={(value) => currencyFormatter.format(Number(value))}
          contentStyle={{ background: 'var(--bg-lift)', border: '1px solid var(--border)', borderRadius: 6 }}
          labelStyle={{ color: 'var(--text)' }}
        />
        <Bar dataKey="total" fill="#c94b38" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </div>
  )
}
