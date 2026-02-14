const API = import.meta.env.VITE_API_URL || ''

export async function uploadDocument(file, docType = 'statement') {
  const form = new FormData()
  form.append('file', file)
  form.append('doc_type', docType)
  const res = await fetch(`${API}/api/documents/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Upload failed')
  }
  return res.json()
}

export async function listDocuments() {
  const res = await fetch(`${API}/api/documents/`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load documents')
  const data = await res.json()
  return data.documents || []
}
