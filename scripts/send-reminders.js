#!/usr/bin/env node
/*
Usage:
  node send-reminders.js --url http://localhost:5000 --token your-admin-token
Env:
  BACKEND_URL (default http://localhost:5000)
  ADMIN_TOKEN (falls back to --token)
*/

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i]
  const v = process.argv[i + 1]
  if (k && k.startsWith('--')) args.set(k.slice(2), v)
}

const url = args.get('url') || process.env.BACKEND_URL || 'http://localhost:5000'
const token = args.get('token') || process.env.ADMIN_TOKEN

if (!token) {
  console.error('Missing admin token. Pass --token or set ADMIN_TOKEN env var.')
  process.exit(1)
}

const endpoint = `${url.replace(/\/$/, '')}/api/notifications/run`

async function main() {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'X-Admin-Token': token },
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`Request failed: ${res.status} ${res.statusText}\n${text}`)
      process.exit(1)
    }
    try {
      const json = JSON.parse(text)
      console.log('Success:', json)
    } catch (_) {
      console.log('Success:', text)
    }
  } catch (e) {
    console.error('Error:', e.message || e)
    process.exit(1)
  }
}

main()
