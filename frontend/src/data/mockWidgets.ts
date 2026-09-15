export interface MockWidget {
  title: string
  lines: string[]
}

export const jobWidgets: MockWidget[] = [
  { title: 'Job Tracking', lines: ['Acme Corp — interview scheduled', 'Globex — applied'] },
  { title: 'Job Search', lines: ['3 new matches for "platform engineer"'] },
]
