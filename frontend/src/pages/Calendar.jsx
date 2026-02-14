import React, { useState, useEffect } from 'react'
import { listBills, createBill } from '../api/bills'
import { listTransactions } from '../api/transactions'
import './Calendar.css'
import './Bills.css'

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days = []
  const startPad = first.getDay()
  for (let i = 0; i < startPad; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

function formatKey(d) {
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Calendar() {
  const [bills, setBills] = useState([])
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [loading, setLoading] = useState(true)
  const [showDueModal, setShowDueModal] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', amount: '', due_day: '', bill_type: 'recurring', reminder_days_before: 3 })
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(true)
  const [selectedDateKey, setSelectedDateKey] = useState(formatKey(new Date()))

  useEffect(() => {
    listBills().then(setBills).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    listTransactions().then(setTransactions).catch(console.error).finally(() => setTxLoading(false))
  }, [])

  const byDate = {}
  bills.forEach((b) => {
    if (b.due_date) {
      byDate[b.due_date] = (byDate[b.due_date] || []).concat(b)
    }
    if (b.due_day && !b.due_date) {
      const d = new Date(cursor.year, cursor.month, Math.min(b.due_day, 28))
      const key = formatKey(d)
      byDate[key] = (byDate[key] || []).concat(b)
    }
  })

  const days = getDaysInMonth(cursor.year, cursor.month)
  const monthLabel = new Date(cursor.year, cursor.month).toLocaleString('default', { month: 'long', year: 'numeric' })

  const prev = () => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
  const next = () => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))

  const txByDate = {}
  transactions.forEach((t) => {
    if (!t.transaction_at) return
    const d = new Date(t.transaction_at)
    const key = formatKey(d)
    txByDate[key] = (txByDate[key] || []).concat(t)
  })

  const billDueDateForMonth = (b, year, month) => {
    if (b.due_date) {
      const d = new Date(b.due_date)
      return d
    }
    if (b.due_day) {
      return new Date(year, month, Math.min(b.due_day, 28))
    }
    return null
  }

  const dueBills = bills
    .map((b) => ({ bill: b, date: billDueDateForMonth(b, cursor.year, cursor.month) }))
    .filter(({ date }) => date && date.getMonth() === cursor.month && date.getFullYear() === cursor.year)
    .sort((a, b) => a.date - b.date)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await createBill({
        name: form.name,
        amount: parseFloat(form.amount) || 0,
        due_day: form.due_day ? parseInt(form.due_day, 10) : null,
        bill_type: form.bill_type,
        reminder_days_before: parseInt(form.reminder_days_before, 10) || 3,
      })
      setForm({ name: '', amount: '', due_day: '', bill_type: 'recurring', reminder_days_before: 3 })
      setShowForm(false)
      listBills().then(setBills).catch(console.error)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="page-loading">Loading calendar...</div>

  return (
    <div className="calendar-page">
      <div className="page-header">
        <h1 className="page-title">Calendar</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowDueModal(true)}>View due bills</button>
      </div>
      <div className="calendar-controls">
        <button type="button" className="btn btn-ghost" onClick={prev}>←</button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button type="button" className="btn btn-ghost" onClick={next}>→</button>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="calendar-weekday">{d}</div>
        ))}
        {days.map((d, i) => {
          const key = formatKey(d)
          const items = byDate[key] || []
          const txCount = (txByDate[key] || []).length
          const isToday = d && formatKey(new Date()) === key
          const isSelected = d && key === selectedDateKey
          return (
            <div
              key={i}
              className={`calendar-day ${!d ? 'empty' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => d && setSelectedDateKey(key)}
            >
              {d && <span className="day-num">{d.getDate()}</span>}
              {d && items.length > 0 && (
                <ul className="day-bills">
                  {items.slice(0, 3).map((b) => (
                    <li key={b.id} className="day-bill">{b.name} ${(b.amount_cents / 100).toFixed(0)}</li>
                  ))}
                  {items.length > 3 && <li className="day-bill more">+{items.length - 3} more</li>}
                </ul>
              )}
              {d && txCount > 0 && (
                <div className="day-tx-count">{txCount} tx</div>
              )}
            </div>
          )
        })}
      </div>

      <div className="transactions-list">
        <h2 className="section-title">Transactions on {selectedDateKey}</h2>
        {txLoading ? (
          <div className="page-loading">Loading transactions...</div>
        ) : (
          (txByDate[selectedDateKey] || []).length === 0 ? (
            <p className="text-muted">No transactions for this day.</p>
          ) : (
            (txByDate[selectedDateKey] || []).map((t) => (
              <div key={t.id} className="card tx-card">
                <div className="tx-main">
                  <span className="tx-desc">{t.description || 'Transaction'}</span>
                  <span className="tx-amount">${(t.amount_cents / 100).toFixed(2)}</span>
                </div>
                <div className="tx-meta">
                  {t.category && <span className="tx-cat">{t.category}</span>}
                  {t.source && <span className="tx-source">{t.source}</span>}
                  {t.transaction_at && <span className="tx-time">{new Date(t.transaction_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {showDueModal && (
        <div className="modal-backdrop" onClick={() => setShowDueModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Bills due in {monthLabel}</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setShowDueModal(false)}>✕</button>
            </div>
            {error && <div className="auth-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
                {showForm ? 'Cancel' : 'Add bill'}
              </button>
            </div>
            {showForm && (
              <form onSubmit={handleSubmit} className="card bill-form">
                <label className="input-label" htmlFor="bill-name">Name</label>
                <input id="bill-name" className="input" placeholder="Name (e.g. Rent, Electric)" title="Bill name" aria-label="Bill name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

                <label className="input-label" htmlFor="bill-amount">Amount</label>
                <input id="bill-amount" className="input" type="number" step="0.01" placeholder="Amount" title="Amount in USD" aria-label="Amount in USD" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />

                <label className="input-label" htmlFor="bill-due-day">Due day (optional)</label>
                <input id="bill-due-day" className="input" type="number" min="1" max="31" placeholder="Due day (1-31)" title="Due day of month (1-31)" aria-label="Due day of month (1-31)" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} />

                <label className="input-label" htmlFor="bill-type">Type</label>
                <select id="bill-type" className="input" title="Type of bill" aria-label="Type of bill" value={form.bill_type} onChange={(e) => setForm({ ...form, bill_type: e.target.value })}>
                  <option value="recurring">Recurring</option>
                  <option value="credit_card">Credit card</option>
                </select>

                <label className="input-label" htmlFor="bill-remind">Remind days before</label>
                <input id="bill-remind" className="input" type="number" min="0" placeholder="Remind days before" title="Days before due to remind" aria-label="Days before due to remind" value={form.reminder_days_before} onChange={(e) => setForm({ ...form, reminder_days_before: e.target.value })} />

                <button type="submit" className="btn btn-primary">Add</button>
              </form>
            )}

            <div className="bills-list">
              {dueBills.length === 0 ? (
                <p className="text-muted">No bills due this month.</p>
              ) : (
                dueBills.map(({ bill: b, date }) => (
                  <div key={b.id} className="card bill-card">
                    <div className="bill-card-main">
                      <span className="bill-name">{b.name}</span>
                      <span className="bill-amount">${(b.amount_cents / 100).toFixed(2)}</span>
                      <span className="bill-due">Due: {formatKey(date)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
