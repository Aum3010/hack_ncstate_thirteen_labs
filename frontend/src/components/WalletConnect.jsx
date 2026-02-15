import React, { useState, useEffect } from 'react'
import { connectWallet } from '../api/auth'
import { listWallets } from '../api/wallets'
import { connectPhantom, getPhantomProvider, getPhantomAddress } from '../api/phantom'
import './WalletConnect.css'

export default function WalletConnect({ onConnect, wallets: walletsProp }) {
  const [internalWallets, setInternalWallets] = useState([])
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phantomLoading, setPhantomLoading] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [showPaste, setShowPaste] = useState(false)

  const wallets = walletsProp != null ? walletsProp : internalWallets

  useEffect(() => {
    if (walletsProp != null) return
    listWallets()
      .then(setInternalWallets)
      .catch(() => setInternalWallets([]))
  }, [walletsProp])

  const hasPhantom = !!getPhantomProvider()
  const phantomAddress = getPhantomAddress()
  const phantomConnectedNotLinked = phantomAddress && !wallets.some((w) => w.address === phantomAddress)

  const handleConnectPhantom = async () => {
    setError('')
    setPhantomLoading(true)
    const timeoutMs = 35000
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out. Is the backend running? Check VITE_API_URL.')), timeoutMs)
    )
    try {
      const { address: addr } = await connectPhantom()
      await Promise.race([connectWallet(addr), timeoutPromise])
      onConnect?.()
    } catch (err) {
      setError(err.message || 'Failed to connect Phantom')
    } finally {
      setPhantomLoading(false)
    }
  }

  const handleLinkThisWallet = async () => {
    if (!phantomAddress) return
    setError('')
    setLinkLoading(true)
    try {
      await connectWallet(phantomAddress)
      if (walletsProp == null) {
        const list = await listWallets()
        setInternalWallets(list)
      }
      onConnect?.()
    } catch (err) {
      setError(err.message || 'Failed to link wallet')
    } finally {
      setLinkLoading(false)
    }
  }

  const handlePasteSubmit = async (e) => {
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
      {phantomConnectedNotLinked && (
        <div className="wallet-connect-link-existing">
          <p className="wallet-connect-hint">
            Phantom is connected as {phantomAddress.slice(0, 8)}...{phantomAddress.slice(-8)}. Add this wallet to your account?
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLinkThisWallet}
            disabled={linkLoading}
          >
            {linkLoading ? 'Linking...' : 'Add this wallet'}
          </button>
        </div>
      )}

      {!phantomConnectedNotLinked && (
        <>
          {hasPhantom ? (
            <button
              type="button"
              className="btn btn-primary wallet-connect-phantom-btn"
              onClick={handleConnectPhantom}
              disabled={phantomLoading}
            >
              {phantomLoading ? 'Connecting...' : 'Connect with Phantom'}
            </button>
          ) : (
            <p className="wallet-connect-hint">Install Phantom to connect your Solana wallet.</p>
          )}

          <p className="wallet-connect-or">
            {showPaste ? null : (
              <button type="button" className="btn btn-ghost wallet-connect-toggle" onClick={() => setShowPaste(true)}>
                Or paste your Solana address
              </button>
            )}
          </p>
          {showPaste && (
            <form onSubmit={handlePasteSubmit} className="wallet-connect-form">
              <input
                className="input"
                type="text"
                placeholder="Solana wallet address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !address.trim()}>
                {loading ? 'Linking...' : 'Link wallet'}
              </button>
            </form>
          )}
        </>
      )}

      {error && <div className="auth-error">{error}</div>}
    </div>
  )
}
