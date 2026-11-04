const ITEMS = [
  {
    label: "Analyse\nAI agent rules",
    icon: (
      <>
        <circle cx="7.5" cy="7.5" r="5" />
        <path d="M11.3 11.3 L15.5 15.5" />
      </>
    ),
  },
  {
    label: "Find hidden\nrisks",
    icon: (
      <>
        <path d="M9 1.8 15 4.2v4.6c0 3.3-2.4 5.9-6 7.4-3.6-1.5-6-4.1-6-7.4V4.2Z" />
        <path d="M6.3 8.8 8.2 10.7 11.8 6.6" />
      </>
    ),
  },
  {
    label: "Get a detailed\nforensic report",
    icon: (
      <>
        <path d="M4 1.8h6.5L14 5.3v10.9H4Z" />
        <path d="M10.2 2v3.6h3.5M6.4 9h5.2M6.4 12h3.4" />
      </>
    ),
  },
];

export function FeatureStrip() {
  return (
    <ul className="features">
      {ITEMS.map((item) => (
        <li className="feature" key={item.label}>
          <svg
            className="feature-icon"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {item.icon}
          </svg>
          <span className="feature-label">
            {item.label.split("\n").map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
