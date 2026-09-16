export interface MockWidget {
  title: string
  lines: string[]
}

export const jobWidgets: MockWidget[] = [
  { title: 'Job Tracking', lines: ['Acme Corp — interview scheduled', 'Globex — applied'] },
  {
    title: 'Job Search',
    lines: [
      'NVIDIA — AI GPU Power Architect (New Grad 2026), Santa Clara, CA',
      'Google — Data Engineer, Google Maps, Mountain View, CA',
      'Adobe — Research Scientist/Engineer, Seattle, WA',
    ],
  },
]
