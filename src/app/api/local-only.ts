import { NextResponse } from 'next/server';

/**
 * The journal server only listens on 127.0.0.1, so nothing else on the network
 * can reach it. A web page open in any browser on this PC still can, though:
 *
 *   - a cross-site form post needs no permission, so a page could upload junk
 *     images into data/screenshots until the disk fills;
 *   - DNS rebinding points a site's own name at 127.0.0.1, which makes the
 *     server look same-origin to that page, so it could read the journal or
 *     write over it.
 *
 * Both give themselves away in the headers: the request names some other host,
 * or says it came from some other origin. The app's own pages never do either.
 * Returns the response to send back when the request must be refused.
 */
export function refuseForeign(request: Request): NextResponse | null {
  if (!isLoopback(request.headers.get('host'))) return forbidden();

  const origin = request.headers.get('origin');
  if (origin !== null && !isLoopback(origin)) return forbidden();

  // sent by every current browser; the app's own fetches are same-origin
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') return forbidden();

  return null;
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** a Host header ("127.0.0.1:3000") or an Origin ("http://localhost:3000") */
function isLoopback(value: string | null): boolean {
  if (!value || value === 'null') return false;
  try {
    const url = new URL(value.includes('://') ? value : `http://${value}`);
    return LOOPBACK.has(url.hostname);
  } catch {
    return false;
  }
}

function forbidden() {
  return NextResponse.json({ ok: false, error: 'Only Sniper Journal itself may use this.' }, { status: 403 });
}
