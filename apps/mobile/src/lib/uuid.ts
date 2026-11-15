/** RFC 4122 v4 UUID. Math.random is fine here: it only identifies a dev player, not a secret. */
export function uuidV4(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16));
  hex[12] = 4;
  hex[16] = ((hex[16] ?? 0) & 0x3) | 0x8;
  const s = hex.map((digit) => digit.toString(16)).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
