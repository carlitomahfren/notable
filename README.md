# Notable

**A personal notebook with the flexibility of digital notes and the personality of a customizable workspace.**

Notable is a responsive, browser-based note-taking application for writing, organizing, and managing notes in a clean, customizable workspace. It combines a rich-text editing experience with Markdown-based content storage, manual note organization, and personalized themes.

**Live Demo:** [notable-notes.vercel.app](https://notable-notes.vercel.app)  
**Repository:** [github.com/carlitomahfren/notable](https://github.com/carlitomahfren/notable)

## Features

- **Rich-text editor** — Write naturally with headings, bold, italic, lists, checklists, links, code blocks, and blockquotes.
- **Markdown-based content** — Store note content in Markdown while editing through a visual rich-text interface.
- **Note organization** — Create, edit, delete, pin, tag, and manually reorder notes.
- **Search** — Find notes by title, content, or tags.
- **Customizable appearance** — Choose light, dark, or system color mode; select theme presets; and customize the accent color.
- **Export** — Export notes into supported formats, including Markdown, text, and PDF.
- **Autosave** — Save note changes automatically.
- **Responsive interface** — Adapt the workspace for desktop, tablet, and mobile screens.
- **Accessibility-focused interactions** — Keyboard navigation, visible focus states, reduced-motion support, and accessible controls.
- **Animated entry experience** — A short, theme-aware splash animation when entering the application.

## Privacy and Storage

Notable does not require an account. Notes are stored locally in the browser rather than synchronized to a cloud database.

This means notes are tied to the browser and device where they were created. Clearing browser data or losing access to that browser can put notes at risk, so users should export important notes for safekeeping.

Notable does not currently provide account-based cloud synchronization or real-time collaboration.

## Technology Stack

| Technology            | Purpose                                     |
| --------------------- | ------------------------------------------- |
| Next.js App Router    | Application framework and routing           |
| React                 | User interface                              |
| TypeScript            | Type-safe development                       |
| Tailwind CSS          | Styling and responsive UI                   |
| Tiptap                | Rich-text editor                            |
| Markdown              | Note content representation and interchange |
| Browser local storage | Local persistence                           |
| Vitest                | Automated testing                           |
| ESLint                | Code quality and linting                    |
| Git and GitHub        | Version control and source hosting          |
| Vercel                | Production deployment                       |

## Getting Started

### Prerequisites

- Node.js compatible with the project's configured environment
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/carlitomahfren/notable.git
cd notable
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `npm run dev`       | Start the development server |
| `npm run build`     | Create a production build    |
| `npm run start`     | Run the production build     |
| `npm run lint`      | Run ESLint                   |
| `npm run typecheck` | Run TypeScript checks        |
| `npm test`          | Run the Vitest test suite    |

## Project Documentation

The repository includes documentation covering the product requirements and technical architecture:

- [`docs/project-specification-v1.md`](docs/project-specification-v1.md) — Product specification and scope.
- [`docs/technical-implementation-plan-v1.md`](docs/technical-implementation-plan-v1.md) — Technical architecture and implementation plan.

## Deployment

Notable is deployed on [Vercel](https://vercel.com/).

Visit the live application:

**[https://notable-notes.vercel.app](https://notable-notes.vercel.app)**

## Project Status

Notable's current V1 feature scope is complete. The application has been deployed and manually verified across its core workflows, themes, exports, responsive layouts, and reduced-motion behavior.

Future enhancements are maintained separately from the current release so the completed version can remain stable while the project is presented in a portfolio.

## License

No license has been specified yet. All rights are reserved by default unless a license is added to the repository.
