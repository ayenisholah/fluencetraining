"use client";

import { useState } from "react";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

/** Local search box state for one admin section, debounced for the query. */
export function useSectionSearch() {
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim());
  return { search, setSearch, term: term || undefined };
}
