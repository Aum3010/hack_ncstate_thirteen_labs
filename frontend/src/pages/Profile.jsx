import React, { useState, useEffect } from 'react'
import { updateMe } from '../api/users'
import { listWallets, disconnectWallet } from '../api/wallets'
import { getPhantomAddress, disconnectPhantom } from '../api/phantom'
import WalletConnect from '../components/WalletConnect'
import './Profile.css'

const MAIN_FOCUS_OPTIONS = [
  { value: 'bills', label: 'Staying on top of bills' },
  { value: 'saving', label: 'Saving for something specific' },
  { value: 'investing', label: 'Investing or growing money' },
  { value: 'tracking', label: 'Just tracking spending' },
]

const GOAL_TIME_OPTIONS = [
  { value: 'few_months', label: 'Next few months' },
  { value: 'this_year', label: 'This year' },
  { value: 'long_term', label: 'Long term' },
]

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'student', label: 'Student' },
  { value: 'retired', label: 'Retired' },
  { value: 'other', label: 'Other' },
]

const PRIORITY_OPTIONS = [
  { value: 'pay_debt', label: 'Pay down debt' },
  { value: 'emergency_fund', label: 'Emergency fund' },
  { value: 'save_goal', label: 'Save for a goal' },
  { value: 'invest', label: 'Invest' },
  { value: 'track_spending', label: 'Track spending' },
  { value: 'reduce_bills', label: 'Reduce bills' },
]

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
]

const CRYPTO_OPTIONS = [
  { value: 'payments', label: 'Payments' },
  { value: 'investing', label: 'Investing' },
  { value: 'both', label: 'Both' },
  { value: 'exploring', label: 'Just exploring' },
]

export default function Profile({ user, onUpdate, embedded }) {
  const [wallets, setWallets] = useState([])
  const [email, setEmail] = useState(user?.email || '')
  const [username, setUsername] = useState(user?.username || '')
  const [onboardingAnswers, setOnboardingAnswers] = useState(() => ({
    display_name: user?.onboarding_answers?.display_name ?? '',
    main_focus: user?.onboarding_answers?.main_focus ?? '',
    goal_time_horizon: user?.onboarding_answers?.goal_time_horizon ?? '',
    biggest_concern: user?.onboarding_answers?.biggest_concern ?? '',
  }))
  const [profileQuestionnaire, setProfileQuestionnaire] = useState(() => ({
    employment: user?.profile_questionnaire?.employment ?? '',
    income: user?.profile_questionnaire?.income ?? '',
    priorities: user?.profile_questionnaire?.priorities ?? [],
    risk_tolerance: user?.profile_questionnaire?.risk_tolerance ?? '',
    biggest_concern: user?.profile_questionnaire?.biggest_concern ?? '',
    short_term_goal: user?.profile_questionnaire?.short_term_goal ?? '',
    long_term_goal: user?.profile_questionnaire?.long_term_goal ?? '',
    crypto_use: user?.profile_questionnaire?.crypto_use ?? '',
    timezone: user?.profile_questionnaire?.timezone ?? '',
    city_or_area: user?.profile_questionnaire?.city_or_area ?? '',
    anything_else: user?.profile_questionnaire?.anything_else ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState(null)
  const [walletError, setWalletError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setEmail(user?.email || '')
    setUsername(user?.username || '')
  }, [user?.email, user?.username])

  useEffect(() => {
    setOnboardingAnswers({
      display_name: user?.onboarding_answers?.display_name ?? '',
      main_focus: user?.onboarding_answers?.main_focus ?? '',
      goal_time_horizon: user?.onboarding_answers?.goal_time_horizon ?? '',
      biggest_concern: user?.onboarding_answers?.biggest_concern ?? '',
    })
  }, [user?.onboarding_answers])

  useEffect(() => {
    setProfileQuestionnaire({
      employment: user?.profile_questionnaire?.employment ?? '',
      income: user?.profile_questionnaire?.income ?? '',
      priorities: user?.profile_questionnaire?.priorities ?? [],
      risk_tolerance: user?.profile_questionnaire?.risk_tolerance ?? '',
      biggest_concern: user?.profile_questionnaire?.biggest_concern ?? '',
      short_term_goal: user?.profile_questionnaire?.short_term_goal ?? '',
      long_term_goal: user?.profile_questionnaire?.long_term_goal ?? '',
      crypto_use: user?.profile_questionnaire?.crypto_use ?? '',
      timezone: user?.profile_questionnaire?.timezone ?? '',
      city_or_area: user?.profile_questionnaire?.city_or_area ?? '',
      anything_else: user?.profile_questionnaire?.anything_else ?? '',
    })
  }, [user?.profile_questionnaire])

  useEffect(() => {
    listWallets()
      .then(setWallets)
      .catch(() => setWallets([]))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const trimmedEmail = (email || '').trim()
    const trimmedUsername = (username || '').trim()
    if (!trimmedEmail && !trimmedUsername) {
      setError('Add at least one: email or username')
      return
    }
    if (trimmedEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address')
      return
    }
    if (trimmedUsername && !/^[a-zA-Z0-9_-]{1,80}$/.test(trimmedUsername)) {
      setError('Username: letters, numbers, underscore, hyphen, 1–80 characters')
      return
    }
    setSaving(true)
    try {
      await updateMe({ email: trimmedEmail, username: trimmedUsername })
      onUpdate?.()
      setSuccess('Saved.')
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const needsProfile = user && !user.email && !user.username

  const handleSaveOnboarding = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await updateMe({
        onboarding_answers: {
          display_name: (onboardingAnswers.display_name || '').trim() || undefined,
          main_focus: onboardingAnswers.main_focus || undefined,
          goal_time_horizon: onboardingAnswers.goal_time_horizon || undefined,
          biggest_concern: (onboardingAnswers.biggest_concern || '').trim() || undefined,
        },
      })
      onUpdate?.()
      setSuccess('About you saved.')
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const togglePriority = (value) => {
    setProfileQuestionnaire((q) => ({
      ...q,
      priorities: q.priorities.includes(value)
        ? q.priorities.filter((p) => p !== value)
        : [...q.priorities, value],
    }))
  }

  const handleSaveProfileQuestionnaire = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await updateMe({
        profile_questionnaire: {
          employment: profileQuestionnaire.employment || undefined,
          income: (profileQuestionnaire.income || '').trim() || undefined,
          priorities: profileQuestionnaire.priorities?.length ? profileQuestionnaire.priorities : undefined,
          risk_tolerance: profileQuestionnaire.risk_tolerance || undefined,
          biggest_concern: (profileQuestionnaire.biggest_concern || '').trim() || undefined,
          short_term_goal: (profileQuestionnaire.short_term_goal || '').trim() || undefined,
          long_term_goal: (profileQuestionnaire.long_term_goal || '').trim() || undefined,
          crypto_use: profileQuestionnaire.crypto_use || undefined,
          timezone: (profileQuestionnaire.timezone || '').trim() || undefined,
          city_or_area: (profileQuestionnaire.city_or_area || '').trim() || undefined,
          anything_else: (profileQuestionnaire.anything_else || '').trim() || undefined,
        },
      })
      onUpdate?.()
      setSuccess('Profile for assistant saved.')
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async (w) => {
    setWalletError('')
    setDisconnectingId(w.id)
    try {
      if (getPhantomAddress() === w.address) {
        disconnectPhantom()
      }
      await disconnectWallet(w.id)
      const list = await listWallets()
      setWallets(list)
      onUpdate?.()
    } catch (err) {
      setWalletError(err.message || 'Failed to disconnect')
    } finally {
      setDisconnectingId(null)
    }
  }

  return (
    <div className={embedded ? 'profile-embedded' : 'profile-page'}>
      {!embedded && <h1 className="page-title">Profile</h1>}
      {needsProfile && (
        <div className="dossier-panel profile-banner">
          <p className="profile-banner-text">Add your email or username so you can sign in and we can send notifications.</p>
        </div>
      )}
      <section className="dossier-panel profile-section">
        <h2 className="dossier-title">Account</h2>
        <p className="text-muted">Add at least one so you can sign in and we can reach you (email for notifications).</p>
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}
        <form onSubmit={handleSubmit} className="profile-form">
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </section>
      <section className="card profile-section">
        <h2 className="dossier-title">About you</h2>
        <p className="text-muted">Used to personalize your experience and the assistant. Edit anytime.</p>
        <form onSubmit={handleSaveOnboarding} className="profile-form">
          <input
            className="input"
            type="text"
            placeholder="What should we call you?"
            value={onboardingAnswers.display_name}
            onChange={(e) => setOnboardingAnswers((a) => ({ ...a, display_name: e.target.value }))}
          />
          <label className="text-muted" style={{ display: 'block', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Main focus</label>
          <select
            className="input"
            value={onboardingAnswers.main_focus}
            onChange={(e) => setOnboardingAnswers((a) => ({ ...a, main_focus: e.target.value }))}
          >
            <option value="">Select...</option>
            {MAIN_FOCUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label className="text-muted" style={{ display: 'block', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Goal time horizon</label>
          <select
            className="input"
            value={onboardingAnswers.goal_time_horizon}
            onChange={(e) => setOnboardingAnswers((a) => ({ ...a, goal_time_horizon: e.target.value }))}
          >
            <option value="">Select...</option>
            {GOAL_TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            className="input"
            type="text"
            placeholder="Biggest financial concern (one sentence)"
            value={onboardingAnswers.biggest_concern}
            onChange={(e) => setOnboardingAnswers((a) => ({ ...a, biggest_concern: e.target.value }))}
            style={{ marginTop: '0.5rem' }}
          />
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '0.75rem' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </section>
      <section className="dossier-panel profile-section">
        <h2 className="dossier-title">Solana wallet</h2>
        {walletError && <div className="auth-error">{walletError}</div>}
        {wallets.length >= 1 ? (
          <ul className="profile-wallet-list">
            {wallets.map((w) => (
              <li key={w.id} className="profile-wallet-row">
                <span className="profile-wallet-chain">{w.chain}</span>
                <span className="profile-wallet-address">{w.address?.slice(0, 8)}...{w.address?.slice(-8)}</span>
                <button
                  type="button"
                  className="btn btn-ghost profile-wallet-disconnect"
                  onClick={() => handleDisconnect(w)}
                  disabled={disconnectingId === w.id}
                >
                  {disconnectingId === w.id ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <WalletConnect
            wallets={wallets}
            onConnect={() => {
              listWallets().then(setWallets)
              onUpdate?.()
            }}
          />
        )}
      </section>
      <section className="dossier-panel profile-section">
        <h2 className="dossier-title">Profile for assistant</h2>
        <p className="text-muted">Optional. The more you share, the better the assistant can tailor advice. Used in memory and across the app.</p>
        <form onSubmit={handleSaveProfileQuestionnaire} className="profile-form">
          <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Employment</label>
          <select
            className="input"
            value={profileQuestionnaire.employment}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, employment: e.target.value }))}
          >
            <option value="">Select...</option>
            {EMPLOYMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            className="input"
            type="text"
            placeholder="Income (e.g. monthly amount or range, optional)"
            value={profileQuestionnaire.income}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, income: e.target.value }))}
            style={{ marginTop: '0.5rem' }}
          />
          <label className="text-muted" style={{ display: 'block', marginTop: '0.75rem', marginBottom: '0.25rem' }}>Financial priorities (select all that apply)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PRIORITY_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="checkbox"
                  checked={profileQuestionnaire.priorities?.includes(opt.value)}
                  onChange={() => togglePriority(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <label className="text-muted" style={{ display: 'block', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Risk tolerance</label>
          <select
            className="input"
            value={profileQuestionnaire.risk_tolerance}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, risk_tolerance: e.target.value }))}
          >
            <option value="">Select...</option>
            {RISK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            className="input"
            type="text"
            placeholder="Biggest financial concern"
            value={profileQuestionnaire.biggest_concern}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, biggest_concern: e.target.value }))}
            style={{ marginTop: '0.5rem' }}
          />
          <input
            className="input"
            type="text"
            placeholder="Short-term goal (next 12 months)"
            value={profileQuestionnaire.short_term_goal}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, short_term_goal: e.target.value }))}
            style={{ marginTop: '0.5rem' }}
          />
          <input
            className="input"
            type="text"
            placeholder="Long-term goal (e.g. 5 years)"
            value={profileQuestionnaire.long_term_goal}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, long_term_goal: e.target.value }))}
            style={{ marginTop: '0.5rem' }}
          />
          <label className="text-muted" style={{ display: 'block', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Crypto use</label>
          <select
            className="input"
            value={profileQuestionnaire.crypto_use}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, crypto_use: e.target.value }))}
          >
            <option value="">Select...</option>
            {CRYPTO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            className="input"
            type="text"
            placeholder="Timezone (e.g. America/New_York)"
            value={profileQuestionnaire.timezone}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, timezone: e.target.value }))}
            style={{ marginTop: '0.5rem' }}
          />
          <input
            className="input"
            type="text"
            placeholder="City or area (e.g. Mumbai, San Francisco)"
            value={profileQuestionnaire.city_or_area}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, city_or_area: e.target.value }))}
            style={{ marginTop: '0.5rem' }}
          />
          <input
            className="input"
            type="text"
            placeholder="Anything else the assistant should know"
            value={profileQuestionnaire.anything_else}
            onChange={(e) => setProfileQuestionnaire((q) => ({ ...q, anything_else: e.target.value }))}
            style={{ marginTop: '0.5rem' }}
          />
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '0.75rem' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </section>
    </div>
  )
}
