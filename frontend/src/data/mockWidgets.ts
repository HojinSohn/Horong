export interface MockWidgetLine {
  text: string
  href?: string
}

export interface MockWidget {
  title: string
  lines: MockWidgetLine[]
  headerLink?: { text: string; href: string }
}

export const jobWidgets: MockWidget[] = [
  {
    title: 'Job Tracking',
    lines: [{ text: 'Acme Corp — interview scheduled' }, { text: 'Globex — applied' }],
  },
  {
    title: 'Job Search',
    headerLink: {
      text: 'Source ↗',
      href: 'https://github.com/speedyapply/2027-AI-College-Jobs/blob/main/NEW_GRAD_USA.md',
    },
    lines: [
      {
        text: 'NVIDIA — AI GPU Power Architect (New Grad 2026), Santa Clara, CA',
        href: 'https://nvidia.wd5.myworkdayjobs.com/en-US/nvidiaexternalcareersite/job/US-CA-Santa-Clara/GPU-Power-Architect---New-College-Grad-2026_JR2017169',
      },
      {
        text: 'Google — Data Engineer, Google Maps, Mountain View, CA',
        href: 'https://www.google.com/about/careers/applications/jobs/results/72704944984990406',
      },
      {
        text: 'Adobe — Research Scientist/Engineer, Seattle, WA',
        href: 'https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced/job/Seattle/Research-Scientist-Engineer_R170713',
      },
    ],
  },
]
