'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const sb = createClient()
    const { error: err } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) { setError(err.message); setLoading(false); return }
    setSent(true); setLoading(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-wordmark">Quarim</div>
        <span className="auth-sub">Mot de passe oublié</span>

        {sent ? (
          <div>
            <p style={{fontSize:14, lineHeight:1.7, marginBottom:20}}>
              Un email de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte mail (et vos spams).
            </p>
            <Link href="/login" className="btn btn-primary" style={{display:'inline-flex', justifyContent:'center', width:'100%'}}>
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div className="field">
              <span className="label">Votre email</span>
              <input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus/>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%', justifyContent:'center'}}>
              {loading ? <><span className="spinner"/> Envoi…</> : 'Envoyer le lien de réinitialisation'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link href="/login">Retour à la connexion</Link>
        </div>
      </div>
    </div>
  )
}
