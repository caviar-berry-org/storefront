const paths = {
  overview: "M3 3v18h18M7 16l4-5 4 2 5-7",
  orders: "M8 5H5v16h14V5h-3M8 3h8v5H8zM8 12h8m-8 4h5",
  products: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4m-9 4v10M7.5 5l9 4",
  inquiries: "M4 4h16v13H9l-5 4zM8 9h8m-8 4h5",
  customers:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-8a4 4 0 0 1 0 8",
  promotions: "M3 12l9-9h8v8l-9 9zM16 7h.01",
  content: "M11 4H4v16h16v-7m-3-9 3 3m-9 9-4 1 1-4L18 3l3 3z",
  seoAndUtm: "M15.5 15.5 21 21M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0z",
  utm: "M10 13.5a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6L12.5 5M14 10.5a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l1.5-1.5",
  settings:
    "m9 3-.5 2.5-2 .9-2.4-.8-2 3.4 1.9 1.7v2.6l-1.9 1.7 2 3.4 2.4-.8 2 .9L9 21h4l.5-2.5 2-.9 2.4.8 2-3.4-1.9-1.7v-2.6L19.9 9l-2-3.4-2.4.8-2-.9L13 3zM14 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0z",
  info: "M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0ZM12 11v5m0-8h.01",
  signOut: "M10 3H4v18h6m-1-9h12m-4-4 4 4-4 4",
  collapse: "m4 8 4 4-4 4m16-8-4 4 4 4",
  expand: "m8 8-4 4 4 4m8-8 4 4-4 4",
  person:
    "M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  menu: "M3 6h18M3 12h18M3 18h18",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  add: "M12 5v14M5 12h14",
  close: "m6 6 12 12M18 6 6 18",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  visits:
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z",
  regions:
    "M19 10c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 14 0Zm-4 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z",
  countries:
    "M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0ZM2 12h20M12 2c6 5 6 15 0 20-6-5-6-15 0-20Z",
  archive: "M4 5h16v4H4zM5 9v11h14V9m-9 4h4",
  restore: "M8 5H4v4m0 0 3.2-3.2A7 7 0 1 1 5 15",
  trash: "M4 6h16M9 6V3h6v3m-9 0 1 15h10l1-15M10 10v7m4-7v7",
  down: "M12 4v15m-5-5 5 5 5-5",
  flame:
    "M12 22a7 7 0 0 0 7-7c0-3-2-5-3-6 0 3-2 4-2 4 1-5-2-9-4-11 0 4-1 6-3 9-1 2-2 3-2 5a7 7 0 0 0 7 6Z",
  chevron: "m9 5 7 7-7 7",
  image: "M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6m-5-10h.01",
  lock: "M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3m-4 5v2",
  copy: "M9 9h11v12H9zM15 5H4v12h1",
  check: "m4 12 5 6L20 6",
  newTab:
    "M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  money:
    "M3 6h18v12H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M6 9h.01M18 15h.01",
  eye: "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
} as const;

export type StaffIconName = keyof typeof paths;

export function StaffIcon({ name }: { name: StaffIconName }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
