import "server-only";

/**
 * Shared HTTP helpers for payment-gateway route handlers (Module 6.5+): the
 * self-submitting redirect form, the "not configured" page, and the
 * back-to-ledger redirect. Kept gateway-agnostic so JazzCash, Easypaisa and any
 * future gateway render the same way.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlResponse(body: string): Response {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

/** 303 redirect to `<path>?pay=<status>` (absolute, resolved against `base`). */
export function redirectWith(base: string, path: string, status: string): Response {
  return Response.redirect(new URL(`${path}?pay=${status}`, base).toString(), 303);
}

/** A page that auto-POSTs the signed fields to the gateway. */
export function autoSubmitFormResponse(
  postUrl: string,
  fields: Record<string, string>,
  gatewayName: string,
): Response {
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
    .join("\n");
  return htmlResponse(`<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Redirecting to ${escapeHtml(gatewayName)}…</title></head>
  <body style="font-family: system-ui; padding: 2rem;">
    <p>Redirecting you to ${escapeHtml(gatewayName)} to complete payment…</p>
    <form id="gw" method="post" action="${escapeHtml(postUrl)}">
      ${inputs}
      <noscript><button type="submit">Continue to ${escapeHtml(gatewayName)}</button></noscript>
    </form>
    <script>document.getElementById('gw').submit();</script>
  </body>
</html>`);
}

/** A dev-safe page shown when a gateway's credentials aren't set. */
export function unconfiguredResponse(ledger: string, gatewayName: string): Response {
  return htmlResponse(`<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>${escapeHtml(gatewayName)} not configured</title></head>
  <body style="font-family: system-ui; padding: 2rem;">
    <p>Online payment via ${escapeHtml(gatewayName)} isn't set up for this school yet.</p>
    <p><a href="${escapeHtml(ledger)}">Back to fees</a></p>
  </body>
</html>`);
}
