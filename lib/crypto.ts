import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGO  = 'aes-256-gcm'
const KEY   = scryptSync(process.env.SUPABASE_SERVICE_ROLE_KEY!.slice(0, 32), 'tickrtalk-salt', 32)

export function encrypt(text: string): string {
  const iv     = randomBytes(12)
  const cipher = createCipheriv(ALGO, KEY, iv)
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':')
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, encHex] = payload.split(':')
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()])
  return dec.toString('utf8')
}
