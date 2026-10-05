"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House } from "lucide-react"

import { HOME_PATH } from "@/lib/notes/routes"

/**
 * Home is a route rather than another workspace view, so it is a link and not a
 * view button: choosing it navigates instead of switching the list that is already
 * on screen. It lives in the same row as the workspace views so both bars keep
 * one flat list of destinations rather than nesting navigation inside navigation.
 *
 * `aria-current="page"` marks it the current destination. The two view buttons use
 * `aria-current="true"` because they describe the current view of one page; a page
 * link is the other kind of current, and spelling the difference out is what keeps
 * assistive technology from reading "current" without saying what is current.
 */
export function HomeNavLink() {
  const pathname = usePathname()
  const isCurrent = pathname === HOME_PATH

  return (
    <Link
      href={HOME_PATH}
      className="shell-nav-button shell-home-link"
      data-active={isCurrent ? "true" : "false"}
      {...(isCurrent ? { "aria-current": "page" as const } : {})}
    >
      <House aria-hidden="true" className="shell-nav-button__icon" />
      <span className="shell-nav-button__label">Home</span>
    </Link>
  )
}