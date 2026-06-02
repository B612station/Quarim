'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const sb = createClient()
    const { data, error: err } = await sb.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    const { data: profile } = await sb.from('profiles').select('role').eq('id', data.user.id).single()
    router.replace(profile?.role === 'admin' ? '/admin' : '/employee')
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-wordmark">Quarim</div>
        <span className="auth-sub">Mémoire opérationnelle</span>

        <form onSubmit={handleLogin}>
          <div className="field">
            <span className="label">Email</span>
            <input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus/>
          </div>
          <div className="field">
            <span className="label">Mot de passe</span>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required/>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%', justifyContent:'center'}}>
            {loading ? <><span className="spinner"/> Connexion…</> : 'Se connecter'}
          </button>
        </form>

        <div className="auth-footer">
          <Link href="/forgot-password">Mot de passe oublié ?</Link>
          <Link href="/register">Créer un compte</Link>
        </div>
      </div>
    </div>
  )
}
