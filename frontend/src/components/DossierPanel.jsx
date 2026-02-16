import React from 'react'

export default function DossierPanel({ title, children, className = '', intel }) {
  const classes = ['dossier-panel', intel ? 'dossier-intel' : '', className].filter(Boolean).join(' ')
  return (
    <section className={classes}>
      {title && <h2 className="dossier-title">{title}</h2>}
      {children}
    </section>
  )
}
