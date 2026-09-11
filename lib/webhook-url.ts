export function isPrivateAddress(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    /^fe[89ab]/.test(host) ||
    host.startsWith('::ffff:127.') ||
    host.startsWith('::ffff:10.') ||
    host.startsWith('::ffff:192.168.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
    return true;
  return (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}
export function validateWebhookUrl(
  value: unknown,
  production = process.env.NODE_ENV === 'production',
) {
  const url = new URL(String(value ?? ''));
  if (
    (production && url.protocol !== 'https:') ||
    (!production && !['https:', 'http:'].includes(url.protocol))
  )
    throw new Error('Webhook URL must use HTTPS.');
  if (url.username || url.password) throw new Error('Webhook URLs cannot contain credentials.');
  if (isPrivateAddress(url.hostname))
    throw new Error('Private or local webhook destinations are not allowed.');
  return url.toString();
}
async function resolve(hostname: string, type: 'A' | 'AAAA') {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
    { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(4000) },
  );
  if (!response.ok) throw new Error('Webhook hostname could not be verified');
  const body = (await response.json()) as { Answer?: Array<{ type: number; data: string }> };
  return (body.Answer ?? [])
    .filter((item) => item.type === (type === 'A' ? 1 : 28))
    .map((item) => item.data);
}
export async function assertWebhookDestinationSafe(
  value: unknown,
  production = process.env.NODE_ENV === 'production',
) {
  const normalized = validateWebhookUrl(value, production),
    url = new URL(normalized);
  if (!production) return normalized;
  const addresses = (
    await Promise.all([resolve(url.hostname, 'A'), resolve(url.hostname, 'AAAA')])
  ).flat();
  if (!addresses.length || addresses.some(isPrivateAddress))
    throw new Error('Webhook hostname does not resolve exclusively to public addresses.');
  return normalized;
}
