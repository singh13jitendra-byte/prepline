/**
 * Prepline product icons. Drawn by hand on a 20 x 20 grid, 1.5 stroke, round
 * caps and joins, no fills. Keylines: 2px padding, circles r 7.25, squares 14.5.
 * They take `currentColor`, so colour comes from the token on the parent.
 */

import type { SVGProps } from "react";

export type IconName =
  | "search"
  | "chevron-down"
  | "chevron-right"
  | "check"
  | "x"
  | "external"
  | "bookmark"
  | "bookmark-filled"
  | "calendar"
  | "clock"
  | "pin"
  | "doc"
  | "folder"
  | "people"
  | "person"
  | "compass"
  | "alert"
  | "arrow-right"
  | "board"
  | "list"
  | "lock"
  | "sort"
  | "play"
  | "eye"
  | "pen"
  | "box"
  | "chat"
  | "plus"
  | "send"
  | "spark";

const paths: Record<IconName, React.ReactNode> = {
  search: (
    <>
      <circle cx="9" cy="9" r="5.25" />
      <path d="M13 13l3.75 3.75" />
    </>
  ),
  "chevron-down": <path d="M6 8l4 4 4-4" />,
  "chevron-right": <path d="M8 6l4 4-4 4" />,
  check: <path d="M4.75 10.5l3.25 3.25 7.25-7.5" />,
  x: <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />,
  external: (
    <>
      <path d="M11.75 4.25h4v4" />
      <path d="M15.5 4.5L9.5 10.5" />
      <path d="M14.25 11.5v3.25a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5H8.5" />
    </>
  ),
  bookmark: <path d="M6 3.75h8a.75.75 0 0 1 .75.75v11.75L10 13l-4.75 3.25V4.5A.75.75 0 0 1 6 3.75z" />,
  "bookmark-filled": (
    <>
      <path d="M6 3.75h8a.75.75 0 0 1 .75.75v11.75L10 13l-4.75 3.25V4.5A.75.75 0 0 1 6 3.75z" />
      <path d="M7.75 6.75h4.5M7.75 9.25h4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.25" y="4.25" width="13.5" height="12.5" rx="2" />
      <path d="M3.25 8.25h13.5M7 2.75v3M13 2.75v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6.25V10l2.5 1.75" />
    </>
  ),
  pin: (
    <>
      <path d="M10 17.25s5.25-4.6 5.25-8.75a5.25 5.25 0 1 0-10.5 0c0 4.15 5.25 8.75 5.25 8.75z" />
      <circle cx="10" cy="8.5" r="1.75" />
    </>
  ),
  doc: (
    <>
      <path d="M11.25 2.75H6a1.5 1.5 0 0 0-1.5 1.5v11.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7z" />
      <path d="M11.25 2.75V7h4.25M7.5 10.75h5M7.5 13.5h3.5" />
    </>
  ),
  folder: (
    <>
      <path d="M2.75 6.25a1.5 1.5 0 0 1 1.5-1.5h3.5l1.75 2h6.25a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5z" />
    </>
  ),
  people: (
    <>
      <circle cx="7.5" cy="7.5" r="2.75" />
      <path d="M2.75 16c.4-2.6 2.3-4.25 4.75-4.25s4.35 1.65 4.75 4.25" />
      <path d="M12.75 4.9a2.75 2.75 0 0 1 0 5.2M14.5 11.9c1.45.55 2.45 1.95 2.75 4.1" />
    </>
  ),
  person: (
    <>
      <circle cx="10" cy="7" r="3.25" />
      <path d="M4.25 16.75c.55-3 2.85-4.75 5.75-4.75s5.2 1.75 5.75 4.75" />
    </>
  ),
  compass: (
    <>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M12.75 7.25l-1.5 4-4 1.5 1.5-4z" />
    </>
  ),
  alert: (
    <>
      <path d="M8.7 3.6L2.95 13.9a1.5 1.5 0 0 0 1.3 2.25h11.5a1.5 1.5 0 0 0 1.3-2.25L11.3 3.6a1.5 1.5 0 0 0-2.6 0z" />
      <path d="M10 7.75v3.5M10 13.75v.01" />
    </>
  ),
  "arrow-right": <path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" />,
  board: (
    <>
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2" />
      <path d="M7.75 3.75v12.5M12.25 3.75v12.5" />
    </>
  ),
  list: <path d="M7.25 5.5h9.5M7.25 10h9.5M7.25 14.5h9.5M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01" />,
  lock: (
    <>
      <rect x="4.25" y="8.75" width="11.5" height="8" rx="1.75" />
      <path d="M6.75 8.75V6.5a3.25 3.25 0 0 1 6.5 0v2.25" />
    </>
  ),
  sort: <path d="M6.5 4.25v11.5M3.75 13l2.75 2.75L9.25 13M13.5 15.75V4.25M10.75 7l2.75-2.75L16.25 7" />,
  play: (
    <>
      <rect x="2.75" y="3.75" width="14.5" height="10.5" rx="1.75" />
      <path d="M8.75 6.75v4.5l3.5-2.25zM6.5 16.75h7" />
    </>
  ),
  eye: (
    <>
      <path d="M2.25 10S5 4.75 10 4.75 17.75 10 17.75 10 15 15.25 10 15.25 2.25 10 2.25 10z" />
      <circle cx="10" cy="10" r="2.5" />
    </>
  ),
  pen: (
    <>
      <path d="M12.6 4.15l3.25 3.25-8.6 8.6H4v-3.25z" />
      <path d="M10.75 6l3.25 3.25" />
    </>
  ),
  box: (
    <>
      <path d="M3.25 6.5L10 3.25l6.75 3.25v7L10 16.75 3.25 13.5z" />
      <path d="M3.25 6.5L10 9.75l6.75-3.25M10 9.75v7" />
    </>
  ),
  chat: (
    <>
      <path d="M4.25 4.25h11.5a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9.5l-3.75 2.5v-2.5h-1.5a1.5 1.5 0 0 1-1.5-1.5v-7a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M6.75 8.25h6.5M6.75 10.75h4" />
    </>
  ),
  plus: <path d="M10 4.5v11M4.5 10h11" />,
  send: <path d="M16.75 3.25L8.5 11.5M16.75 3.25l-5 13.5-3.25-5.25-5.25-3.25z" />,
  spark: <path d="M10 3v3.5M10 13.5V17M3 10h3.5M13.5 10H17M5.05 5.05l2.5 2.5M12.45 12.45l2.5 2.5M5.05 14.95l2.5-2.5M12.45 7.55l2.5-2.5" />,
};

export function Icon({
  name,
  size = 16,
  className,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `pp-icon ${className}` : "pp-icon"}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
