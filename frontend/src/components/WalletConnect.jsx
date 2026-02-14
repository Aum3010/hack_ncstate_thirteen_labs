import React, { useState } from 'react'
import { connectWallet } from '../api/auth'
import './WalletConnect.css'

export default function WalletConnect({ onConnect }) {
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await connectWallet(address.trim())
      onConnect?.()
    } catch (err) {
      setError(err.message || 'Failed to link wallet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wallet-connect">
      <p className="wallet-connect-hint">Link your Solana wallet (paste address). Phantom/Solflare connect can be wired here.</p>
      <form onSubmit={handleSubmit} className="wallet-connect-form">
        <input
          className="input"
          type="text"
          placeholder="Solana wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading || !address.trim()}>
          {loading ? 'Linking...' : 'Link wallet'}
        </button>
      </form>
    </div>
  )
}
