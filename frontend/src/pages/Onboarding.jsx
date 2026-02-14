import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWallet } from '../api/auth'
import { createBill } from '../api/bills'
import { createGoal } from '../api/goals'
import { updateMe } from '../api/users'
import './Onboarding.css'

const PARTITION_PRESETS = [
  { label: 'Balanced', investments: 20, bill_payments: 50, short_term_goals: 30 },
  { label: 'Savings focus', investments: 40, bill_payments: 40, short_term_goals: 20 },
  { label: 'Goals first', investments: 10, bill_payments: 50, short_term_goals: 40 },
]

export default function Onboarding({ user, onComplete }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [address, setAddress] = useState('')
  const [walletError, setWalletError] = useState('')
  const [partitionConfig, setPartitionConfig] = useState(
    user?.partition_config || {
      investments: { enabled: true, target_pct: 20 },
      bill_payments: { enabled: true, target_pct: 50 },
      short_term_goals: { enabled: true, target_pct: 30 },
    }
  )
  const [billForm, setBillForm] = useState({ name: '', amount: '' })
  const [goalForm, setGoalForm] = useState({ name: '', target: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasWallet = user?.has_wallet

  const handleWalletSubmit = async (e) => {
    e.preventDefault()
    setWalletError('')
    setLoading(true)
    try {
      await connectWallet(address.trim())
      onComplete?.()
      setStep(2)
    } catch (err) {
      setWalletError(err.message || 'Failed to link wallet')
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (preset) => {
    setPartitionConfig({
      investments: { enabled: true, target_pct: preset.investments },
      bill_payments: { enabled: true, target_pct: preset.bill_payments },
      short_term_goals: { enabled: true, target_pct: preset.short_term_goals },
    })
  }

  const handlePartitionNext = async () => {
    setLoading(true)
    setError('')
    try {
      await updateMe({ partition_config: partitionConfig })
      onComplete?.()
      setStep(3)
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleBillNext = async (e) => {
    e?.preventDefault()
    if (!billForm.name.trim() || !billForm.amount) {
      setError('Enter bill name and amount')
      return
    }
    setLoading(true)
    setError('')
    try {
      await createBill({
        name: billForm.name.trim(),
        amount: parseFloat(billForm.amount),
        bill_type: 'recurring',
        is_recurring: true,
      })
      onComplete?.()
      setStep(4)
    } catch (err) {
      setError(err.message || 'Failed to add bill')
    } finally {
      setLoading(false)
    }
  }

  const handleGoalFinish = async (e) => {
    e?.preventDefault()
    if (!goalForm.name.trim() || !goalForm.target) {
      setError('Enter goal name and target amount')
      return
    }
    setLoading(true)
    setError('')
    try {
      await createGoal({
        name: goalForm.name.trim(),
        target: parseFloat(goalForm.target),
        category: 'short_term',
      })
      await updateMe({ onboarding_completed: true })
      onComplete?.()
      navigate('/')
    } catch (err) {
      setError(err.message || 'Failed to add goal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card card">
        <div className="onboarding-progress">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`onboarding-dot ${step >= s ? 'active' : ''}`}
              onClick={() => step > s && setStep(s)}
            />
          ))}
        </div>
        <h1 className="onboarding-title">Set up your financial view</h1>

        {step === 1 && (
          <div className="onboarding-step">
            <h2>Link your Solana wallet</h2>
            <p className="text-muted">Connect your wallet to sync transactions into your pie chart.</p>
            {hasWallet ? (
              <p className="text-muted">Wallet already linked. You can add another or continue.</p>
            ) : (
              <form onSubmit={handleWalletSubmit} className="onboarding-form">
                <input
                  className="input"
                  type="text"
                  placeholder="Solana wallet address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                {walletError && <div className="auth-error">{walletError}</div>}
                <button type="submit" className="btn btn-primary" disabled={loading || !address.trim()}>
                  {loading ? 'Linking...' : 'Link wallet'}
                </button>
              </form>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(2)}
              style={{ marginTop: '1rem' }}
            >
              {hasWallet ? 'Continue' : 'Skip for now'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <h2>Choose your partition mix</h2>
            <p className="text-muted">How do you want to split your budget? These become your pie chart sections.</p>
            <div className="partition-presets">
              {PARTITION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn btn-ghost partition-preset"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}: {p.investments}% / {p.bill_payments}% / {p.short_term_goals}%
                </button>
              ))}
            </div>
            <div className="partition-summary">
              <span>Investments: {partitionConfig.investments?.target_pct ?? 20}%</span>
              <span>Bills: {partitionConfig.bill_payments?.target_pct ?? 50}%</span>
              <span>Goals: {partitionConfig.short_term_goals?.target_pct ?? 30}%</span>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="button" className="btn btn-primary" onClick={handlePartitionNext} disabled={loading}>
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <h2>Add your first bill</h2>
            <p className="text-muted">Rent, utilities, subscriptions—any recurring payment.</p>
            <form onSubmit={handleBillNext} className="onboarding-form">
              <input
                className="input"
                type="text"
                placeholder="Bill name (e.g. Rent, Netflix)"
                value={billForm.name}
                onChange={(e) => setBillForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="Amount (USD)"
                value={billForm.amount}
                onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))}
              />
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Adding...' : 'Add bill'}
              </button>
            </form>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(4)}
              style={{ marginTop: '0.75rem' }}
            >
              Skip
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-step">
            <h2>Add a short-term goal</h2>
            <p className="text-muted">Trip, laptop, gadget, or experience—what are you saving for?</p>
            <form onSubmit={handleGoalFinish} className="onboarding-form">
              <input
                className="input"
                type="text"
                placeholder="Goal (e.g. Laptop, Weekend trip)"
                value={goalForm.name}
                onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="Target amount (USD)"
                value={goalForm.target}
                onChange={(e) => setGoalForm((f) => ({ ...f, target: e.target.value }))}
              />
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Finishing...' : 'Finish setup'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
