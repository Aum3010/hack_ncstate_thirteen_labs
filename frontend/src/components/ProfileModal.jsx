import React from 'react'
import { Link } from 'react-router-dom'
import Profile from '../pages/Profile'
import MoneySection from './MoneySection'
import './ProfileModal.css'

export default function ProfileModal({ open, onClose, user, onUpdate }) {
  if (!open) return null

  return (
    <div className="profile-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Profile and settings">
      <div className="profile-modal-panel dossier-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2 className="profile-modal-title">Profile</h2>
          <button type="button" className="btn btn-ghost profile-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="profile-modal-body">
          <Profile user={user} onUpdate={onUpdate} embedded />
          <div className="profile-modal-divider" />
          <h2 className="dossier-title">Money & Crypto</h2>
          <MoneySection />
          <p className="profile-modal-link-wrap">
            <Link to="/bills" className="link-neon" onClick={onClose}>Bills →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
