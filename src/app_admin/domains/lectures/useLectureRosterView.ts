import { useRef, useState } from "react";

type SessionScope = "REGULAR" | "SUPPLEMENT" | "ALL";

// Owned by the mounted lecture so a board visit preserves the roster being read.
export function useLectureRosterView() {
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("name");
  const [sessionScope, setSessionScope] = useState<SessionScope>("REGULAR");
  const scroll = useRef({ left: 0, top: 0 });
  return { searchInput, setSearchInput, sort, setSort, sessionScope, setSessionScope, scroll };
}

export type LectureRosterView = ReturnType<typeof useLectureRosterView>;
