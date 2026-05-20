// Simple PIN hashing using SubtleCrypto (no bcrypt dependency needed)
export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode('ledger_salt_v1_' + pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPin(pin, hash) {
  const attempt = await hashPin(pin)
  return attempt === hash
}

export function fmt(n) {
  return 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID')
}

export function fmtShort(n) {
  const abs = Math.abs(n)
  if (abs >= 1e9) return 'Rp ' + (abs / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return 'Rp ' + (abs / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return 'Rp ' + (abs / 1e3).toFixed(0) + 'K'
  return 'Rp ' + Math.round(abs)
}

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const DEFAULT_CATS = [
  'Uncategorized','Staff/Labour','Villa Maintenance','Utilities','Travel',
  'Groceries','Water (PDAM)','Living Cost','Internet','Transfer in',
  'Interest','Bank fees','Tax','THR/Bonus','Vehicle','Other'
]
