import React, { useState, useEffect } from 'react'
import { listBills } from '../api/bills'
import './Calendar.css'

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

  useEffect(() => {
    listBills().then(setBills).catch(console.error).finally(() => setLoading(false))
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

  if (loading) return <div className="page-loading">Loading calendar...</div>

  return (
    <div className="calendar-page">
      <h1 className="page-title">Calendar</h1>
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
          const isToday = d && formatKey(new Date()) === key
          return (
            <div
              key={i}
              className={`calendar-day ${!d ? 'empty' : ''} ${isToday ? 'today' : ''}`}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
