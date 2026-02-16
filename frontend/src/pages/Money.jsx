import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createTransaction } from '../api/transactions'
import { listWallets, syncWallet } from '../api/wallets'
import { uploadDocument, listDocuments } from '../api/documents'
import './Money.css'

export default function Money() {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', category: '', description: '', type: 'spend' })
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
    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
      setError('Enter a non-zero amount')
      return
    }
    const signedAmount = form.type === 'receive' ? Math.abs(amount) : -Math.abs(amount)
    try {
      await createTransaction({
        amount: signedAmount,
        category: form.category || undefined,
        description: form.description || undefined,
      })
      setForm({ amount: '', category: '', description: '', type: 'spend' })
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
      <section className="dossier-panel money-section">
        <h2 className="dossier-title">Upload bank statement / invoice</h2>
        <p className="text-muted">Backboard ingests for memory and RAG.</p>
        <label className="btn btn-ember" style={{ display: 'inline-block' }}>
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
      <section className="dossier-panel money-section">
        <h2 className="dossier-title">Wallet</h2>
        {wallets?.length > 0 ? (
          <div>
            <p className="text-muted">Solana: {wallets[0].address?.slice(0, 12)}...{wallets[0].address?.slice(-8)}</p>
            <button type="button" className="btn btn-ember" onClick={onSyncSolana} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync Solana'}
            </button>
          </div>
        ) : (
          <p className="text-muted">
            No wallet linked. Connect and manage wallets in <Link to="/profile">Profile</Link>.
          </p>
        )}
      </section>
      <section className="dossier-panel money-section">
        <h2 className="dossier-title">Add transaction</h2>
        {error && <div className="auth-error">{error}</div>}
        {!showForm ? (
          <button type="button" className="btn btn-ember" onClick={() => setShowForm(true)}>Add transaction</button>
        ) : (
          <form onSubmit={handleSubmit} className="money-form">
            <label className="input-label" htmlFor="tx-type">Type</label>
            <select id="tx-type" className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="spend">Spend</option>
              <option value="receive">Receive</option>
            </select>
            <input className="input" type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            <input className="input" placeholder="Category (e.g. food)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="form-actions">
              <button type="submit" className="btn btn-ember">Add</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setForm({ amount: '', category: '', description: '', type: 'spend' }); }}>Cancel</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
