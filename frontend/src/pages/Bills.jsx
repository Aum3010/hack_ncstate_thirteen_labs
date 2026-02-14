import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listBills, createBill, updateBill, deleteBill, markPaid } from '../api/bills'
import './Bills.css'

export default function Bills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', due_day: '', bill_type: 'recurring', reminder_days_before: 3 })
  const [error, setError] = useState('')

  const load = () => listBills().then(setBills).catch(console.error).finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

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
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleMarkPaid = async (id, paid) => {
    try {
      await markPaid(id, paid)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bill?')) return
    try {
      await deleteBill(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="page-loading">Loading bills...</div>

  return (
    <div className="bills-page">
      <div className="page-header">
        <h1 className="page-title">Bill Payments</h1>
        <Link to="/calendar" className="btn btn-primary">Calendar</Link>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add bill'}
        </button>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {showForm && (
        <form onSubmit={handleSubmit} className="card bill-form">
          <input className="input" placeholder="Name (e.g. Rent, Electric)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <input className="input" type="number" min="1" max="31" placeholder="Due day (1-31)" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} />
          <select className="input" value={form.bill_type} onChange={(e) => setForm({ ...form, bill_type: e.target.value })}>
            <option value="recurring">Recurring</option>
            <option value="credit_card">Credit card</option>
          </select>
          <input className="input" type="number" min="0" placeholder="Remind days before" value={form.reminder_days_before} onChange={(e) => setForm({ ...form, reminder_days_before: e.target.value })} />
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      )}
      <div className="bills-list">
        {bills.length === 0 ? (
          <p className="text-muted">No bills. Add one to see reminders and calendar.</p>
        ) : (
          bills.map((b) => (
            <div key={b.id} className="card bill-card">
              <div className="bill-card-main">
                <span className="bill-name">{b.name}</span>
                <span className="bill-amount">${(b.amount_cents / 100).toFixed(2)}</span>
                {b.due_day && <span className="bill-due">Due day: {b.due_day}</span>}
                {b.due_date && <span className="bill-due">Due: {b.due_date}</span>}
              </div>
              <div className="bill-card-actions">
                <button type="button" className="btn btn-ghost" onClick={() => handleMarkPaid(b.id, !b.paid_at)}>
                  {b.paid_at ? 'Mark unpaid' : 'Mark paid'}
                </button>
                <button type="button" className="btn btn-danger" onClick={() => handleDelete(b.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
