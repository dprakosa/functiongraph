import { useEffect, useState } from "react";
import { RouteLink } from "../../routing/RouteLink";
import { Wordmark } from "../../components/shell/Sidebar";
import { AuthActionSlot } from "../../auth/AuthShell";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md transition-colors ${
        scrolled ? "border-hairline" : "border-transparent"
      }`}
    >
      <nav
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6"
        aria-label="Marketing"
      >
        <Wordmark />
        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-body no-underline transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <AuthActionSlot />
          <RouteLink
            to="/graph"
            className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white no-underline shadow-xs transition-colors hover:bg-accent-hover active:bg-accent-pressed"
          >
            Open the app
          </RouteLink>
        </div>
      </nav>
    </header>
  );
}
