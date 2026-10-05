"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { ThemeQuickToggle } from "@/components/shell/theme-quick-toggle"
import { NOTE_LIST_PATH } from "@/lib/notes/routes"

import { HomeStats } from "./home-stats"

/**
 * The landing page. It exists to answer one question, "where do I write?", and to
 * show the size of the notebook, so it deliberately holds no editor, no list, and no
 * second copy of the workspace: everything it says is either a link into
 * `/notes` or a number derived from the notes state that page already owns.
 *
 * The theme control is here rather than only on the workspace page so light and
 * dark stay reachable from every screen in the app.
 */
export function HomeView() {
  return (
    <div className="home">
      <header className="home__bar">
        <span className="home__brand">Notable</span>

        <ThemeQuickToggle />
      </header>

      <main className="home__main">
        <section className="home__panel" aria-labelledby="home-title">
          <p className="home__eyebrow">Plain text notes</p>

          <h1 className="home__title" id="home-title">
            Your notebook
          </h1>

          <p className="home__lede">
            Write in Markdown, pin what matters, and tag the rest. Everything stays
            in this browser: there is no account to create and nothing leaves this
            device.
          </p>

          <Link className="home__action" href={NOTE_LIST_PATH}>
            Open Notes
            <ArrowRight aria-hidden="true" className="home__action-icon" />
          </Link>

          <HomeStats />
        </section>
      </main>
    </div>
  )
}