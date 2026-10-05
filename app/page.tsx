import type { Metadata } from "next"

import { HomeView } from "@/components/home/home-view"

export const metadata: Metadata = {
  title: "Home",
  description: "Plain text notes in Markdown, stored in this browser.",
}

export default function HomePage() {
  return <HomeView />
}