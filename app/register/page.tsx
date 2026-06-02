'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { POLES } from '@/lib/types'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', pole: '', orgName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!form.pole) { setError('Sélectionnez votre pôle de travail'); return }
    setLoading(true); setError('')
    const sb = createClient()
    const { data, error: err } = await sb.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } }
    })
    if (err || !data.user) { setError(err?.message || 'Erreur à l\'inscription'); setLoading(false); return }

    // Créer le profil — role employee par défaut
    const { error: profileErr } = await sb.from('profiles').insert({
      id: data.user.id,
      email: form.email,
      full_name: form.fullName,
      role: 'employee',
      pole: form.pole,
      org_name: form.orgName || 'Mon Organisation',
    })
    if (profileErr) { setError(profileErr.message); setLoading(false); return }
    router.replace('/employee')
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-wordmark">Quarim</div>
        <span className="auth-sub">Créer un compte</span>

        <form onSubmit={handleRegister}>
          <div className="field">
            <span className="label">Nom complet</span>
            <input type="text" placeholder="Marie Dupont" value={form.fullName} onChange={e => set('fullName', e.target.value)} required/>
          </div>
          <div className="field">
            <span className="label">Email professionnel</span>
            <input type="email" placeholder="marie@organisation.fr" value={form.email} onChange={e => set('email', e.target.value)} required/>
          </div>
          <div className="field">
            <span className="label">Mot de passe</span>
            <input type="password" placeholder="8 caractères minimum" value={form.password} onChange={e => set('password', e.target.value)} required minLength={8}/>
          </div>
          <div className="field">
            <span className="label">Votre pôle de travail</span>
            <select value={form.pole} onChange={e => set('pole', e.target.value)} required>
              <option value="">Sélectionnez votre pôle…</option>
              {POLES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="label">Organisation <span style={{opacity:.4,textTransform:'none',letterSpacing:0}}>(optionnel)</span></span>
            <input type="text" placeholder="Nom de votre entreprise" value={form.orgName} onChange={e => set('orgName', e.target.value)}/>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%', justifyContent:'center'}}>
            {loading ? <><span className="spinner"/> Création…</> : 'Créer mon compte'}
          </button>
        </form>

        <div className="auth-footer">
          <Link href="/login">Déjà un compte ? Se connecter</Link>
        </div>
      </div>
    </div>
  )
}
