// A fictional role and fictional applicants. Each resume is chosen to show
// something keyword matching gets wrong and a judgment model gets right.

import type { Kind } from "./ranking";

export const SAMPLE_JOB = {
  title: "Senior Frontend Engineer",
  description: `Senior Frontend Engineer — Remote (EU time zones)

About us
Northwind Labs builds scheduling software used by 4,000 clinics.

What you'll do
- Own the patient booking flow end to end
- Work with design to evolve our component library
- Review code and help grow two junior engineers

What we're looking for
- 5+ years building production web applications
- Deep experience with React
- Strong TypeScript
- You have shipped accessible interfaces that meet WCAG 2.1 AA
- Experience with design systems or component libraries is a plus
- Mentoring experience is nice to have

We offer
- Four-day work week, learning budget, home office stipend`,
  requirements: [
    { id: "r-years", text: "5+ years building production web applications", kind: "must", weight: 4 },
    { id: "r-react", text: "React", kind: "skill", weight: 5 },
    { id: "r-ts", text: "TypeScript", kind: "skill", weight: 3 },
    { id: "r-a11y", text: "Has shipped accessible interfaces that meet WCAG 2.1 AA", kind: "must", weight: 3 },
    { id: "r-ds", text: "Experience with design systems or component libraries", kind: "pref", weight: 2 },
    { id: "r-mentor", text: "Has mentored other engineers", kind: "pref", weight: 1 },
  ] as { id: string; text: string; kind: Kind; weight: number }[],
};

export const SAMPLE_RESUMES: { fileName: string; note: string; text: string }[] = [
  {
    fileName: "maya-okafor.pdf",
    note: "Strong fit on every requirement",
    text: `Maya Okafor
maya.okafor@example.com · +44 20 5550 1234 · linkedin.com/in/mayaokafor-demo

Experience
Staff Frontend Engineer, Brightpath Health (2021–present)
- Led the rebuild of the appointment booking app in React and TypeScript, serving 2M visits a month
- Created and maintain the Lumen component library (60 components, Storybook, visual regression tests)
- Ran the WCAG 2.1 AA remediation program; fixed 400+ issues and passed an external audit in 2023
- Mentor four engineers; started the frontend guild and its weekly code review sessions

Frontend Engineer, Parcelly (2017–2021)
- Built the shipment tracking dashboard in React; migrated 80k lines from JavaScript to TypeScript
- Cut bundle size by 45% with code splitting and route-level lazy loading

Education
BSc Computer Science, University of Leeds

Skills
React, TypeScript, Next.js, Storybook, Testing Library, axe, Figma`,
  },
  {
    fileName: "daniel-reyes-cv.docx",
    note: "Keyword stuffer: lists everything, has used little of it",
    text: `Daniel Reyes
daniel.reyes@example.com · (555) 010-4477

Summary
Frontend specialist. React, TypeScript, WCAG, accessibility, design systems, component libraries, mentoring, Next.js, Vue, Angular, Svelte, GraphQL, Kubernetes, AI.

Experience
Web Designer, Sunny Side Marketing (2022–present)
- Build and update WordPress sites for local restaurants and dentists
- Install SEO plugins and edit page templates in PHP
- Make banner graphics for social media campaigns

Intern, CopyCorner Print Shop (2021)
- Managed the shop's Instagram account

Skills
React · TypeScript · WCAG · Accessibility · Design Systems · Component Libraries · Mentoring · JavaScript · HTML · CSS · Figma · Photoshop · WordPress · SEO`,
  },
  {
    fileName: "lena-fischer.pdf",
    note: "Excellent engineer, but Vue instead of React",
    text: `Lena Fischer
lena.fischer@example.com · +49 30 5550 9876

Experience
Principal Frontend Engineer, Kassel Mobility (2019–present)
- Architected the rider app in Vue 3 and TypeScript; 1.5M monthly users
- Founded the Rail design system, adopted by 9 product teams
- Accessibility lead: built automated axe checks into CI and trained 30 engineers on WCAG 2.1 AA; app certified AA in 2022
- Mentor for the company's apprenticeship program (6 apprentices so far)

Frontend Developer, Stadtwerke Digital (2015–2019)
- Built customer portals in AngularJS, then Vue 2
- Introduced TypeScript and end-to-end testing with Cypress

Skills
Vue, TypeScript, Nuxt, Pinia, Vite, Cypress, accessibility auditing`,
  },
  {
    fileName: "aisha-rahman.pdf",
    note: "Strong React/TypeScript, accessibility never mentioned",
    text: `Aisha Rahman
aisha.rahman@example.com · 555-013-2468

Experience
Senior Software Engineer, Cartwheel Commerce (2020–present)
- Tech lead for the checkout team; rebuilt checkout in React 18 and TypeScript, lifting conversion 6%
- Designed the state management approach used across 14 React apps
- Onboarded and mentored three new hires

Software Engineer, Bluefin Travel (2018–2020)
- Built search and booking pages in React with Redux
- Wrote the company's first TypeScript style guide

Education
BEng Software Engineering, University of Manchester

Skills
React, TypeScript, Redux, Node.js, Jest, Playwright, performance profiling`,
  },
  {
    fileName: "priya-nair.pdf",
    note: "Senior backend engineer with a little React",
    text: `Priya Nair
priya.nair@example.com · +1 555 0199 331

Experience
Senior Backend Engineer, Ledgerly (2019–present)
- Designed the payments service in Go and PostgreSQL handling 3,000 requests per second
- Led the migration from a monolith to 12 services on Kubernetes
- Built a small internal admin panel in React for the support team
- Mentor for the backend chapter

Backend Engineer, Orbit Freight (2016–2019)
- Built REST APIs in Python and Django; owned the billing integration

Skills
Go, Python, PostgreSQL, Kafka, Kubernetes, gRPC, some React`,
  },
  {
    fileName: "tom-becker.pdf",
    note: "Promising junior, not senior yet",
    text: `Tom Becker
tom.becker@example.com

Experience
Junior Frontend Developer, Pixelgarden Agency (2023–present)
- Build landing pages and small web apps in React for agency clients
- Started using TypeScript on new projects this year
- Fixed color contrast and keyboard focus issues flagged by a client's accessibility checker

Education
Full-stack web development bootcamp, Le Wagon (2022)

Projects
- Habit tracker built with React and Firebase
- Contributions to an open-source React date picker (3 merged pull requests)

Skills
React, JavaScript, TypeScript (learning), Tailwind CSS, Git`,
  },
  {
    fileName: "sam-whitfield.docx",
    note: "Career changer: long career, short frontend tenure",
    text: `Sam Whitfield
sam.whitfield@example.com · (555) 017-8080

Experience
Frontend Engineer, Meadow Learning (2022–present)
- Build course player features in React and TypeScript
- Moved our buttons, forms and modals into a shared component library with the design team
- Pair with designers on screen reader testing for new features

Senior Graphic and UI Designer, Northshore Studio (2014–2022)
- Designed web and mobile interfaces for 40+ clients; hand-off in Figma
- Wrote HTML and CSS for marketing sites; introduced a color contrast checklist
- Managed and coached two junior designers

Skills
React, TypeScript, CSS, Figma, design tokens, usability testing`,
  },
  {
    fileName: "q3-status-update.txt",
    note: "Not a resume at all",
    text: `Q3 Status Update — Web Platform Team

Highlights
- The booking flow redesign shipped to 25% of clinics; bounce rate fell 8%
- Component library reached version 3.0 with new date and time pickers
- Accessibility audit found 42 issues; 30 fixed, 12 scheduled for Q4

Risks
- Two engineers on leave in November
- The React 19 upgrade depends on a vendor charting library

Next quarter
- Finish the rollout to all clinics
- Hire one senior frontend engineer
- Start the mobile web performance project`,
  },
];
