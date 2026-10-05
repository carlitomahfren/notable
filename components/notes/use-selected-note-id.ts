"use client"

import { usePathname } from "next/navigation"

import { selectedNoteIdFromPathname } from "@/lib/notes/routes"

export function useSelectedNoteId(): string | null {
  return selectedNoteIdFromPathname(usePathname())
}