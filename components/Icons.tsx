type IconProps = { className?: string };

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function Logo() {
  return (
    <span aria-hidden className="inline-flex size-[22px] items-center justify-center rounded-[7px] bg-white">
      <span className="size-2 rounded-full bg-accent" />
    </span>
  );
}

export function ArrowRight({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} strokeWidth={1.8} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function FeatureIcon({ name, className = "size-6 text-accent" }: IconProps & { name: string }) {
  switch (name) {
    case "doc":
      return (
        <svg {...base} className={className}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M7 9h10M7 13h6" />
        </svg>
      );
    case "layers":
      return (
        <svg {...base} className={className}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
      );
    case "bars":
      return (
        <svg {...base} className={className}>
          <path d="M4 19h16" />
          <path d="M7 15V11M12 15V7M17 15v-2" />
        </svg>
      );
    default:
      return (
        <svg {...base} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      );
  }
}
