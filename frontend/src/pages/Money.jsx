import React, { useState, useEffect } from 'react'
import { createTransaction } from '../api/transactions'
import { listWallets, syncWallet } from '../api/wallets'
import { uploadDocument, listDocuments } from '../api/documents'
import { optimizeAllocation } from '../api/optimizer'
import WalletConnect from '../components/WalletConnect'
import './Money.css'

export default function Money() {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', category: '', description: '' })
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [alloc, setAlloc] = useState({ staked_pct: 50, liquid_pct: 20, stable_pct: 30 })
  const [riskProfile, setRiskProfile] = useState('balanced')
  const [optResult, setOptResult] = useState(null)
  const [optLoading, setOptLoading] = useState(false)
  const [optError, setOptError] = useState('')

  const load = () => {
    Promise.all([listWallets(), listDocuments()])
      .then(([w, d]) => {
        setWallets(w)
        setDocuments(d)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const amount = parseFloat(form.amount)
    if (!amount) {
      setError('Enter amount')
      return
    }
    try {
      await createTransaction({
        amount: Math.abs(amount),
        category: form.category || undefined,
        description: form.description || undefined,
      })
      setForm({ amount: '', category: '', description: '' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const onSyncSolana = async () => {
    if (!wallets?.[0]) return
    setSyncing(true)
    setError('')
    try {
      await syncWallet(wallets[0].id)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      await uploadDocument(file, file.name.toLowerCase().includes('invoice') ? 'invoice' : 'statement')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const totalAlloc = alloc.staked_pct + alloc.liquid_pct + alloc.stable_pct

  const handleOptimize = async () => {
    setOptLoading(true)
    setOptError('')
    try {
      const data = await optimizeAllocation({
        current: alloc,
        risk_profile: riskProfile,
      })
      setOptResult(data)
    } catch (err) {
      setOptError(err.message || 'Failed to optimize allocation')
    } finally {
      setOptLoading(false)
    }
  }

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="money-page">
      <h1 className="page-title">Money & Crypto</h1>
      <section className="card money-section">
        <h2 className="section-title">Upload bank statement / invoice</h2>
        <p className="text-muted">Backboard ingests for memory and RAG.</p>
        <label className="btn btn-primary" style={{ display: 'inline-block' }}>
          {uploading ? 'Uploading...' : 'Choose file'}
          <input type="file" accept=".pdf,.csv,.txt" onChange={onFile} disabled={uploading} style={{ display: 'none' }} />
        </label>
        {documents.length > 0 && (
          <ul className="doc-list">
            {documents.slice(0, 5).map((d) => (
              <li key={d.id}>{d.file_name} ({d.doc_type})</li>
            ))}
          </ul>
        )}
      </section>
      <section className="card money-section">
        <h2 className="section-title">Wallet</h2>
        {wallets?.length > 0 ? (
          <div>
            <p className="text-muted">Solana: {wallets[0].address?.slice(0, 12)}...{wallets[0].address?.slice(-8)}</p>
            <button type="button" className="btn btn-primary" onClick={onSyncSolana} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync Solana'}
            </button>
          </div>
        ) : (
          <WalletConnect onConnect={load} />
        )}
      </section>
      <section className="card money-section">
        <h2 className="section-title">Smart Allocation Optimizer</h2>
        <p className="text-muted">
          AI portfolio coach for staking vs liquidity vs stable yield. Feels like a robo-advisor for your crypto stack.
        </p>
        <div className="alloc-grid">
          <div className="alloc-column">
            <div className="alloc-label-row">
              <span className="alloc-label">Staked</span>
              <span className="alloc-value">
                {alloc.staked_pct.toFixed(0)}
                %
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={alloc.staked_pct}
              onChange={(e) => setAlloc({ ...alloc, staked_pct: Number(e.target.value) })}
            />
            <div className="alloc-label-row">
              <span className="alloc-label">Liquid</span>
              <span className="alloc-value">
                {alloc.liquid_pct.toFixed(0)}
                %
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={alloc.liquid_pct}
              onChange={(e) => setAlloc({ ...alloc, liquid_pct: Number(e.target.value) })}
            />
            <div className="alloc-label-row">
              <span className="alloc-label">Stable yield</span>
              <span className="alloc-value">
                {alloc.stable_pct.toFixed(0)}
                %
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={alloc.stable_pct}
              onChange={(e) => setAlloc({ ...alloc, stable_pct: Number(e.target.value) })}
            />
            <div className="alloc-total">
              Total:
              {' '}
              {totalAlloc.toFixed(0)}
              %
            </div>
          </div>
          <div className="alloc-column">
            <div className="alloc-risk-toggle">
              <span className="alloc-label">Risk profile</span>
              <div className="alloc-risk-chips">
                {['conservative', 'balanced', 'aggressive'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`sim-chip ${riskProfile === p ? 'active' : ''}`}
                    onClick={() => setRiskProfile(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOptimize}
              disabled={optLoading}
            >
              {optLoading ? 'Optimizing...' : 'Optimize allocation'}
            </button>
            {optError && <div className="auth-error" style={{ marginTop: '0.5rem' }}>{optError}</div>}
            {optResult && (
              <div className="alloc-result">
                <div className="alloc-result-row">
                  <span className="alloc-label">Current expected return</span>
                  <span className="alloc-value">
                    {(optResult.current.expected_return * 100).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="alloc-result-row">
                  <span className="alloc-label">Optimized expected return</span>
                  <span className="alloc-value neon-green">
                    {(optResult.optimized.expected_return * 100).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="alloc-result-row">
                  <span className="alloc-label">Risk (drawdown proxy)</span>
                  <span className="alloc-value">
                    {(optResult.current.risk * 100).toFixed(1)}
                    %
                    {' '}
                    →
                    {' '}
                    <span className="neon-pink">
                      {(optResult.optimized.risk * 100).toFixed(1)}
                      %
                    </span>
                  </span>
                </div>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                  {optResult.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="card money-section">
        <h2 className="section-title">Add transaction</h2>
        {error && <div className="auth-error">{error}</div>}
        {!showForm ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>Add transaction</button>
        ) : (
          <form onSubmit={handleSubmit} className="money-form">
            <input className="input" type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            <input className="input" placeholder="Category (e.g. food)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Add</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
