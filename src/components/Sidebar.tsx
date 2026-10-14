import Link from "next/link";
import Image from "next/image";
import logo from "../../public/images/logo.png";

const links = [
  {
    label: "Dashboard",
    href: "/",
    icon: <path d="M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" />,
  },
  {
    label: "Trends",
    href: "/trends",
    icon: <path d="M3 3v18h18 M6 16l5-6 4 3 6-8" />,
  },
  {
    label: "Runs",
    href: "/runs",
    icon: <path d="M9 6h12 M9 12h12 M9 18h12 M3 6h1 M3 12h1 M3 18h1" />,
  },
  {
    label: "Explore",
    href: "/explore",
    icon: (
      <>
        <circle cx="10.5" cy="10.5" r="7.5" />
        <path d="m16 16 5 5" />
      </>
    ),
  },
];

export default function Sidebar(){
  return (
    <aside className="relative w-full shrink-0 border-b border-border
    bg-brand px-6 pt-3 pb-6 md:min-h-screen md:w-40 md:border-b-0">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-12 bottom-0 hidden border-r border-border md:block"
      />
      <Link href="/" className="mx-auto block w-fit">
        <Image
        src={logo}
        alt="Runsight Logo"
        sizes="128px"
        className="h-auto w-32 shrink-0"
        />
      </Link>

    <nav aria-label="Main navigation" className="-mx-4 mt-3">
      <ul className="flex gap-2 md:flex-col">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium
              text-on-brand transition-colors hover:bg-surface-hover hover:text-foreground
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                >
                  {link.icon}
                </svg>
                {link.label}
              </Link>
          </li>
        ))}
      </ul>
      <hr className="my-4 w-full border-0 border-t-2 border-divider" />
      <Link
        href="/settings"
        className="block rounded-lg px-3 py-3 text-sm font-medium
        text-on-brand transition-colors hover:bg-surface-hover hover:text-foreground
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Settings
      </Link>
    </nav>
    </aside>
  );
}
