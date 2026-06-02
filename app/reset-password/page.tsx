'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const sb = createClient()
    const { error: err } = await sb.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.replace('/login'), 2000)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-wordmark">Quarim</div>
        <span className="auth-sub">Nouveau mot de passe</span>
        {done ? (
          <p style={{fontSize:14}}>Mot de passe mis à jour. Redirection…</p>
        ) : (
          <form onSubmit={handleUpdate}>
            <div className="field">
              <span className="label">Nouveau mot de passe</span>
              <input type="password" placeholder="8 caractères minimum" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoFocus/>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%',justifyContent:'center'}}>
              {loading ? <><span className="spinner"/> Mise à jour…</> : 'Mettre à jour'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
