const encoder = new TextEncoder(),
  decoder = new TextDecoder();
const b64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const unb64 = (value: string) =>
  Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
async function key() {
  const material = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!material || material.length < 32)
    throw new Error('WEBHOOK_ENCRYPTION_KEY must contain at least 32 characters');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(material));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await key(),
      encoder.encode(value),
    );
  return `v1.${b64(iv)}.${b64(new Uint8Array(encrypted))}`;
}
export async function decryptSecret(value: string) {
  const [version, iv, payload] = value.split('.');
  if (version !== 'v1' || !iv || !payload) throw new Error('Unsupported encrypted secret format');
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) },
    await key(),
    unb64(payload),
  );
  return decoder.decode(clear);
}
