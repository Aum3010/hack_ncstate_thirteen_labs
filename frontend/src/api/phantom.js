/**
 * Shared Phantom wallet helpers. Keeps app and Phantom connection state in sync.
 */

const CONNECT_TIMEOUT_MS = 30000

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message || 'Connection timed out. Please try again.')), ms)
    ),
  ])
}

export function getPhantomProvider() {
  if (typeof window === 'undefined') return null
  return window.phantom?.solana ?? null
}

/**
 * Connect Phantom; returns the connected wallet address.
 * Supports both publicKey and public_key (snake_case) for Phantom API compatibility.
 * @returns {{ address: string }}
 */
export async function connectPhantom() {
  const provider = getPhantomProvider()
  if (!provider) throw new Error('Phantom wallet not installed')
  const connectPromise = withTimeout(
    provider.connect(),
    CONNECT_TIMEOUT_MS,
    'Phantom connection timed out. Approve the request in Phantom or try again.'
  )
  const result = await connectPromise
  const pk = result?.publicKey ?? result?.public_key
  const address = pk != null
    ? (typeof pk === 'string' ? pk : pk.toString?.() ?? String(pk))
    : getPhantomAddress()
  if (!address) throw new Error('Phantom did not return a wallet address')
  return { address }
}

/**
 * Disconnect Phantom from this app. No-op if provider missing.
 */
export function disconnectPhantom() {
  const provider = getPhantomProvider()
  if (provider && typeof provider.disconnect === 'function') {
    provider.disconnect()
  }
}

/**
 * Current Phantom connected address, if any.
 * @returns {string | null}
 */
export function getPhantomAddress() {
  const provider = getPhantomProvider()
  if (!provider || !provider.publicKey) return null
  return provider.publicKey.toString()
}
