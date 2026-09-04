export interface MockWidget {
  title: string
  lines: string[]
}

export const leftWidgets: MockWidget[] = [
  { title: 'Job Tracking', lines: ['Acme Corp — interview scheduled', 'Globex — applied'] },
  { title: 'Job Search', lines: ['3 new matches for "platform engineer"'] },
]

export const rightWidgets: MockWidget[] = [
  { title: 'Stock Profile', lines: ['AAPL 231.14 +1.2%', 'NVDA 118.02 -0.4%'] },
]
