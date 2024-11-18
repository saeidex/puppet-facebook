import Link from "next/link";

export default function NavigationMenu() {
  return (
    <nav>
      <ul className="flex gap-2 p-2 text-sm">
        <li>
          <Link href="/">Home</Link>
        </li>
        <li>
          <Link href="/about">About</Link>
        </li>
      </ul>
    </nav>
  );
}
