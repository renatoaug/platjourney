// bun run --cwd apps/server push:keys — prints a VAPID key pair for the .env. Generate it once per
// instance: a new pair makes every browser that turned push on subscribe again.
import { createECDH } from 'node:crypto'

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
console.log(`PUSH_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`)
console.log(`PUSH_VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`)
