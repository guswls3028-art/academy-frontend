import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { Clock3, CornerDownLeft, Search, X } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import styles from "./QuickNavigationDialog.module.css";

export type QuickNavigationItem = {
  to: string;
  label: string;
  group: string;
  icon?: ReactNode;
  keywords?: string[];
};

type QuickNavigationDialogProps = {
  open: boolean;
  onClose: () => void;
  items: QuickNavigationItem[];
  storageKey: string | null;
  placement: string;
};

const MAX_RECENT_ITEMS = 4;

function normalize(value: string): string {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

function matchesCurrentPath(pathname: string, destination: string): boolean {
  if (destination === "/workspace/mobile" || destination === "/workspace/dashboard") {
    return pathname === destination;
  }
  return pathname === destination || pathname.startsWith(`${destination}/`);
}

function readRecent(storageKey: string | null, destinations: Set<string>): string[] {
  if (!storageKey) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string" && destinations.has(value))
      .slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

function writeRecent(storageKey: string | null, destinations: string[]) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(destinations.slice(0, MAX_RECENT_ITEMS)));
  } catch {
    // 저장소가 차단되어도 현재 세션의 빠른 이동은 계속 동작한다.
  }
}

export default function QuickNavigationDialog({
  open,
  onClose,
  items,
  storageKey,
  placement,
}: QuickNavigationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const uniqueItems = useMemo(() => {
    const byDestination = new Map<string, QuickNavigationItem>();
    for (const item of items) {
      if (!byDestination.has(item.to)) byDestination.set(item.to, item);
    }
    return [...byDestination.values()];
  }, [items]);
  const itemByDestination = useMemo(
    () => new Map(uniqueItems.map((item) => [item.to, item])),
    [uniqueItems],
  );
  const destinations = useMemo(
    () => new Set(itemByDestination.keys()),
    [itemByDestination],
  );
  const [recentDestinations, setRecentDestinations] = useState<string[]>(() =>
    readRecent(storageKey, destinations),
  );

  useEffect(() => {
    setRecentDestinations(readRecent(storageKey, destinations));
  }, [destinations, storageKey]);

  const remember = (destination: string) => {
    if (!destinations.has(destination)) return;
    setRecentDestinations((current) => {
      const next = [destination, ...current.filter((item) => item !== destination)]
        .slice(0, MAX_RECENT_ITEMS);
      writeRecent(storageKey, next);
      return next;
    });
  };

  useEffect(() => {
    const matched = [...uniqueItems]
      .sort((left, right) => right.to.length - left.to.length)
      .find((item) => matchesCurrentPath(location.pathname, item.to));
    if (!matched) return;
    setRecentDestinations((current) => {
      const next = [matched.to, ...current.filter((item) => item !== matched.to)]
        .slice(0, MAX_RECENT_ITEMS);
      if (next.join("|") === current.join("|")) return current;
      writeRecent(storageKey, next);
      return next;
    });
  }, [location.pathname, storageKey, uniqueItems]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery("");
      setActiveIndex(0);
      dialog.showModal();
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const queryTokens = normalize(query).split(/[,/]/).filter(Boolean);
  const filteredItems = useMemo(() => {
    if (queryTokens.length === 0) return uniqueItems;
    return uniqueItems.filter((item) => {
      const searchable = normalize(
        [item.label, item.group, ...(item.keywords ?? [])].join(" "),
      );
      return queryTokens.every((token) => searchable.includes(token));
    });
  }, [queryTokens, uniqueItems]);
  const recentItems = recentDestinations
    .map((destination) => itemByDestination.get(destination))
    .filter((item): item is QuickNavigationItem => Boolean(item));
  const recentSet = new Set(recentDestinations);
  const otherItems = uniqueItems.filter((item) => !recentSet.has(item.to));
  const sections = queryTokens.length > 0
    ? [{ title: "검색 결과", items: filteredItems, recent: false }]
    : [
        ...(recentItems.length > 0
          ? [{ title: "최근 사용", items: recentItems, recent: true }]
          : []),
        { title: "전체 메뉴", items: otherItems, recent: false },
      ];
  const displayedItems = sections.flatMap((section) => section.items);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    resultsRef.current
      ?.querySelector<HTMLElement>("[data-active='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const selectItem = (item: QuickNavigationItem) => {
    remember(item.to);
    onClose();
    navigate(item.to);
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(displayedItems.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      const selected = displayedItems[activeIndex];
      if (selected) {
        event.preventDefault();
        selectItem(selected);
      }
    }
  };

  let renderedIndex = -1;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="quick-navigation-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.panel}
        data-analytics-placement={placement}
        data-testid="quick-navigation-dialog"
      >
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>업무 지도</span>
            <h2 id="quick-navigation-title" className={styles.title}>빠른 이동</h2>
          </div>
          <div className={styles.headingActions}>
            <span className={styles.escapeHint}>Esc 닫기</span>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="빠른 이동 닫기"
              onClick={onClose}
            >
              <X size={ICON.md} aria-hidden />
            </button>
          </div>
        </div>

        <label className={styles.searchField}>
          <Search size={ICON.md} aria-hidden />
          <span className={styles.srOnly}>메뉴 검색</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="메뉴 이름이나 할 일을 입력하세요"
            autoComplete="off"
          />
          <span className={styles.keyboardHint} aria-hidden>
            <span>↑↓</span>
            <CornerDownLeft size={14} />
          </span>
        </label>

        <div ref={resultsRef} className={styles.results} aria-live="polite">
          {displayedItems.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>일치하는 메뉴가 없습니다.</strong>
              <span>다른 업무 이름으로 검색해 보세요.</span>
            </div>
          ) : (
            sections.map((section) => (
              section.items.length > 0 && (
                <section key={section.title} className={styles.section}>
                  <h3 className={styles.sectionTitle}>{section.title}</h3>
                  <div className={styles.itemList}>
                    {section.items.map((item) => {
                      renderedIndex += 1;
                      const index = renderedIndex;
                      const active = index === activeIndex;
                      return (
                        <button
                          key={`${section.title}:${item.to}`}
                          type="button"
                          className={styles.item}
                          data-active={active ? "true" : undefined}
                          data-analytics-destination={item.to}
                          aria-current={matchesCurrentPath(location.pathname, item.to) ? "page" : undefined}
                          onMouseEnter={() => setActiveIndex(index)}
                          onFocus={() => setActiveIndex(index)}
                          onClick={() => selectItem(item)}
                        >
                          <span className={styles.icon} aria-hidden>
                            {section.recent ? <Clock3 size={ICON.md} /> : item.icon}
                          </span>
                          <span className={styles.itemBody}>
                            <strong>{item.label}</strong>
                            <span>{item.group}</span>
                          </span>
                          <span className={styles.enterMark} aria-hidden>
                            <CornerDownLeft size={14} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )
            ))
          )}
        </div>
      </div>
    </dialog>
  );
}
