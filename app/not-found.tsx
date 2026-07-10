import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md place-items-center py-24 text-center">
      <div>
        <div className="font-mono text-5xl font-semibold text-slate-600">404</div>
        <h1 className="mt-4 font-display text-xl font-semibold text-white">
          No room by that name
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          The page you&rsquo;re looking for isn&rsquo;t part of this house.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-signal-blue px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-signal-blue/85"
        >
          Back to the Pulse
        </Link>
      </div>
    </div>
  );
}
