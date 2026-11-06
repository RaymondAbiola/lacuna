import Link from "next/link";

const REPO = "https://github.com/RaymondAbiola/lacuna";

// The mark is the product: a solid block with a piece missing from it.
function Mark() {
  return (
    <svg className="mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2 2 H22 V22 H2 Z M9 9 H17 V15.5 H9 Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function SiteHeader({ arena = false }: { arena?: boolean }) {
  return (
    <header className="site-header" id="top">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="shell site-header-inner">
        <Link className="brand" href="/">
          <Mark />
          <span className="wordmark">Lacuna</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <Link className="nav-link nav-link--current" href="/arena" aria-current={arena ? "page" : undefined}>
            Try It
          </Link>
          <a className="nav-link" href={`${REPO}#readme`}>
            Docs
          </a>
          {/* absolute, because the header is shared with /arena where there is
              no method section to jump to */}
          <a className="nav-link" href="/#method">
            Method
          </a>
          <a className="nav-pill" href={REPO}>
            View on GitHub
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  );
}
