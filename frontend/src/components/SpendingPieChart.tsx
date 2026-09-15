import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts'
import type { Transaction } from '../lib/financeApi'
import { currencyFormatter, filterToLatestPeriod, groupSpendingByCategory, type Period } from '../lib/spending'

// User-requested hue family (red/teal/yellow/green/purple/pink), lightness
// and chroma snapped into the dark-mode OKLCH band and re-stepped for CVD
// separation — validated against this app's --panel surface (~#17140f).
const SERIES_COLORS = ['#c94b38', '#0088ae', '#b98a00', '#457300', '#8268be', '#d5518a']

interface SpendingPieChartProps {
  transactions: Transaction[]
  period: Period
}

export function SpendingPieChart({ transactions, period }: SpendingPieChartProps) {
  const data = groupSpendingByCategory(filterToLatestPeriod(transactions, period))
  if (data.length === 0) return null

  const grandTotal = data.reduce((sum, entry) => sum + entry.total, 0)

  return (
    <div className="finance-chart">
      <h3>Spending by category ({period === 'week' ? 'this week' : 'this month'})</h3>
      <PieChart width={300} height={180}>
        <Pie data={data} dataKey="total" nameKey="category" cx={90} cy={90} outerRadius={65} isAnimationActive={false}>
          {data.map((entry, index) => (
            <Cell key={entry.category} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => currencyFormatter.format(Number(value))}
          contentStyle={{ background: 'var(--bg-lift)', border: '1px solid var(--border)', borderRadius: 6 }}
          labelStyle={{ color: 'var(--text)' }}
        />
        <Legend
          layout="vertical"
          position="right"
          formatter={(value) => {
            const entry = data.find((d) => d.category === value)
            const percent = entry ? Math.round((entry.total / grandTotal) * 100) : 0
            return `${value} — ${percent}%`
          }}
          wrapperStyle={{ fontSize: 11, color: 'var(--muted)', width: 130 }}
        />
      </PieChart>
    </div>
  )
}
