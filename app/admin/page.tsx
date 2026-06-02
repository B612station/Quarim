'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile, Brief, Avancee, Escalade, BRIEF_SECTIONS, POLES } from '@/lib/types'
import QuarimChat from '@/components/QuarimChat'
import Channels from '@/components/Channels'

type Pane = 'dashboard' | 'brief' | 'equipe' | 'escalades' | 'canaux' | 'quarim' | 'team-admin'

export default function AdminPage() {
  const router = useRouter()
  const sb = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pane, setPane] = useState<Pane>('dashboard')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [avancees, setAvancees] = useState<Avancee[]>([])
  const [escalades, setEscalades] = useState<Escalade[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [transcript, setTranscript] = useState('')
  const [weekDate, setWeekDate] = useState(new Date().toISOString().split('T')[0])
  const [genLoading, setGenLoading] = useState(false)
  const [replyEsc, setReplyEsc] = useState<Escalade | null>(null)
  const [replyText, setReplyText] = useState('')
  const [toast, setToast] = useState('')
  const [isRec, setIsRec] = useState(false)
  const [recTimer, setRecTimer] = useState('00:00')
  const recognition = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const recSecs = useRef(0)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return }
      sb.from('profiles').select('*').eq('id', data.session.user.id).single().then(({ data: p }) => {
        if (!p || p.role !== 'admin') { router.replace('/employee'); return }
        setProfile(p)
        loadData()
      })
    })
  }, [])

  async function loadData() {
    const [{ data: b }, { data: av }, { data: esc }, { data: mem }] = await Promise.all([
      sb.from('briefs').select('*').order('week_date', { ascending: false }).limit(1).single(),
      sb.from('avancees').select('*, profiles(full_name, pole)').order('created_at', { ascending: false }),
      sb.from('escalades').select('*, profiles(full_name, pole)').order('created_at', { ascending: false }),
      sb.from('profiles').select('*').order('full_name'),
    ])
    if (b) setBrief(b)
    if (av) setAvancees(av as Avancee[])
    if (esc) setEscalades(esc as Escalade[])
    if (mem) setMembers(mem)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  function toggleRec() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      showToast('Dictée vocale : utilisez Chrome ou Edge'); return
    }
    if (isRec) { recognition.current?.stop(); return }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    recognition.current = new SR()
    recognition.current.lang = 'fr-FR'
    recognition.current.continuous = true
    recognition.current.interimResults = true
    let base = transcript
    recognition.current.onresult = (e: any) => {
      let final = '', interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      base += final
      setTranscript(base + interim)
    }
    recognition.current.onend = () => {
      setIsRec(false); clearInterval(timerRef.current)
    }
    recognition.current.start()
    setIsRec(true)
    recSecs.current = 0
    timerRef.current = setInterval(() => {
      recSecs.current++
      const m = String(Math.floor(recSecs.current / 60)).padStart(2, '0')
      const s = String(recSecs.current % 60).padStart(2, '0')
      setRecTimer(`${m}:${s}`)
    }, 1000)
  }

  async function genBrief() {
    if (!transcript.trim()) { showToast('Dictez ou écrivez un compte-rendu'); return }
    setGenLoading(true)
    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, orgName: profile?.org_name || '', sector: '' })
      })
      const { summary, error } = await res.json()
      if (error) { showToast(error); return }
      const { data: newBrief } = await sb.from('briefs').insert({
        author_id: profile!.id, week_date: weekDate, transcript, summary
      }).select().single()
      if (newBrief) setBrief(newBrief)
      showToast('Brief généré et publié à l\'équipe')
    } catch (e: any) { showToast(e.message) }
    finally { setGenLoading(false) }
  }

  async function submitReply() {
    if (!replyText.trim() || !replyEsc) return
    await sb.from('escalades').update({
      reponse: replyText, reponse_by: profile!.id, reponse_at: new Date().toISOString()
    }).eq('id', replyEsc.id)
    setReplyEsc(null); setReplyText(''); loadData(); showToast('Réponse envoyée')
  }

  async function updateMemberRole(userId: string, role: string) {
    await sb.from('profiles').update({ role }).eq('id', userId)
    loadData(); showToast('Rôle mis à jour')
  }

  if (!profile) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontStyle:'italic', opacity:.4, fontFamily:'Georgia,serif', fontSize:20 }}>Quarim</div>

  const pendingEsc = escalades.filter(e => !e.reponse)

  function nav(p: Pane) { setPane(p) }

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="wordmark">
            <span className="wordmark__name">Quarim</span>
            <span className="wordmark__ctx">{profile.org_name}</span>
          </div>
          <div className="header-right">
            <span className="role-badge role-admin">Dirigeant</span>
            <span className="user-pill">{profile.full_name}</span>
            <button className="btn btn-sm" onClick={async () => { await sb.auth.signOut(); router.replace('/login') }}>Déconnexion</button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <div className="sidebar">
          <div className="nav-section">
            {([
              ['dashboard','Tableau de bord'],
              ['brief','Mon brief'],
              ['equipe','Mon équipe'],
              ['escalades','Escalades'],
              ['canaux','Canaux'],
              ['quarim','Quarim IA'],
              ['team-admin','Gestion équipe'],
            ] as [Pane, string][]).map(([id, label]) => (
              <button key={id} className={`nav-item ${pane === id ? 'active' : ''}`} onClick={() => nav(id)}>
                {label}
                {id === 'escalades' && pendingEsc.length > 0 && <span className="nav-badge">{pendingEsc.length}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="content-area">

          {/* ── DASHBOARD ── */}
          {pane === 'dashboard' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Tableau de bord</span>
                <h1 className="pane__title">Vue d'ensemble</h1>
              </div>
              <div className="metrics">
                <div className="metric-cell"><div className="metric-val">{members.length}</div><div className="metric-lbl">Membres</div></div>
                <div className="metric-cell"><div className="metric-val">{pendingEsc.length}</div><div className="metric-lbl">Escalades</div></div>
                <div className="metric-cell"><div className="metric-val">{avancees.length}</div><div className="metric-lbl">Avancées</div></div>
                <div className="metric-cell"><div className="metric-val">{brief ? 'Publié' : '—'}</div><div className="metric-lbl">Brief</div></div>
              </div>

              <div className="sec-title">Escalades en attente <button className="linklike" onClick={() => nav('escalades')}>Tout voir →</button></div>
              {pendingEsc.length === 0 ? <div className="empty"><div className="empty__title">Aucune escalade</div><div className="empty__sub">Quarim gère toutes les questions.</div></div>
              : <div className="card-list">{pendingEsc.slice(0,3).map(e => (
                <div key={e.id} className="card-row esc-row">
                  <div className="card-row__top"><span className="card-row__name">{(e.profiles as any)?.full_name}</span><span className="status-tag st-urgent">À traiter</span></div>
                  <div className="card-row__sub">"{e.question}"</div>
                  <div className="card-row__actions"><button className="btn btn-sm btn-primary" onClick={() => { setReplyEsc(e); setReplyText('') }}>Répondre</button></div>
                </div>))}</div>}

              <div className="sec-title" style={{marginTop:8}}>Avancées récentes <button className="linklike" onClick={() => nav('equipe')}>Tout voir →</button></div>
              {avancees.length === 0 ? <div className="empty"><div className="empty__title">Aucune avancée</div><div className="empty__sub">L'équipe n'a pas encore soumis de comptes-rendus.</div></div>
              : <div className="card-list">{avancees.slice(0,3).map(a => (
                <div key={a.id} className="card-row">
                  <div className="card-row__top">
                    <span className="card-row__name">{(a.profiles as any)?.full_name}</span>
                    <div style={{display:'flex',gap:6}}>
                      {a.confidentiel && <span className="status-tag st-conf">🔒 Confidentiel</span>}
                      <span className="status-tag st-ok">Reçu</span>
                    </div>
                  </div>
                  <div className="card-row__sub">{a.resume}</div>
                </div>))}</div>}
            </div>
          )}

          {/* ── BRIEF ── */}
          {pane === 'brief' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Brief hebdomadaire</span>
                <h1 className="pane__title">Dicter le <em>compte-rendu</em></h1>
                <p className="pane__intro">Parlez librement. Quarim structure votre dictée et la publie à l'équipe.</p>
              </div>
              <div className="field" style={{maxWidth:280, marginBottom:20}}>
                <span className="label">Semaine du</span>
                <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)}/>
              </div>
              <div className="rec-bar">
                <button className="btn btn-primary" onClick={toggleRec}>{isRec ? 'Arrêter' : 'Commencer la dictée'}</button>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span className={`rec-dot ${isRec ? 'live' : ''}`}/>
                  <span className="rec-txt">{isRec ? 'Enregistrement' : 'En attente'}</span>
                </div>
                {isRec && <span className="rec-timer" style={{fontFamily:'var(--serif)',fontStyle:'italic',fontSize:20}}>{recTimer}</span>}
              </div>
              <div className="field" style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <span className="label">Transcription</span>
                  <button className="linklike" onClick={() => setTranscript('')}>Effacer</button>
                </div>
                <div className="editable" contentEditable suppressContentEditableWarning
                  onInput={e => setTranscript((e.target as HTMLElement).innerText)}
                  data-empty={!transcript ? 'true' : 'false'}
                  data-ph="Parlez librement : situation générale, dossiers, décisions, blocages…"
                  style={{minHeight:160}}
                >{transcript}</div>
              </div>
              <div style={{display:'flex',gap:12,marginBottom:32}}>
                <button className="btn btn-primary" onClick={genBrief} disabled={genLoading}>
                  {genLoading ? <><span className="spinner"/> Génération…</> : 'Générer & publier le résumé'}
                </button>
              </div>
              {brief?.summary && (
                <>
                  <div className="sec-title">Dernier résumé publié</div>
                  <div className="summary-grid">
                    {BRIEF_SECTIONS.map(s => (
                      <div key={s.key} className="sum-card">
                        <div style={{display:'flex',alignItems:'baseline',gap:12}}>
                          <span className="sum-card__num">{s.roman}</span>
                          <span className="sum-card__title">{s.label}</span>
                        </div>
                        <div className="sum-card__body">{(brief.summary as any)[s.key]}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ÉQUIPE ── */}
          {pane === 'equipe' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Équipe</span>
                <h1 className="pane__title">Avancées de <em>l'équipe</em></h1>
              </div>
              {avancees.length === 0
                ? <div className="empty"><div className="empty__title">Aucune avancée</div><div className="empty__sub">Les comptes-rendus de l'équipe apparaîtront ici.</div></div>
                : <div className="card-list">{avancees.map(a => (
                  <div key={a.id} className="card-row">
                    <div className="card-row__top">
                      <div style={{display:'flex',alignItems:'baseline',gap:10}}>
                        <span className="card-row__name">{(a.profiles as any)?.full_name}</span>
                        {(a.profiles as any)?.pole && <span style={{fontSize:10,opacity:.5,border:'1px solid var(--ink)',padding:'1px 6px',borderRadius:'var(--radius)'}}>{(a.profiles as any).pole}</span>}
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        {a.confidentiel && <span className="status-tag st-conf">🔒 Confidentiel</span>}
                        <span style={{fontSize:11,opacity:.45}}>{new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                    <div className="card-row__sub">{a.resume}</div>
                  </div>))}</div>}
            </div>
          )}

          {/* ── ESCALADES ── */}
          {pane === 'escalades' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">À traiter</span>
                <h1 className="pane__title">Questions <em>escaladées</em></h1>
                <p className="pane__intro">Questions que Quarim n'a pas pu traiter. Répondez directement.</p>
              </div>
              {escalades.length === 0
                ? <div className="empty"><div className="empty__title">Aucune escalade</div><div className="empty__sub">Quarim gère toutes les questions pour l'instant.</div></div>
                : <div className="card-list">{escalades.map(e => (
                  <div key={e.id} className="card-row esc-row">
                    <div className="card-row__top">
                      <div>
                        <span className="card-row__name">{(e.profiles as any)?.full_name}</span>
                        {(e.profiles as any)?.pole && <span style={{fontSize:10,opacity:.45,marginLeft:8}}>{(e.profiles as any).pole}</span>}
                      </div>
                      <span className={`status-tag ${e.reponse ? 'st-ok' : 'st-urgent'}`}>{e.reponse ? 'Répondu' : 'En attente'}</span>
                    </div>
                    <div className="card-row__sub">"{e.question}"</div>
                    {e.context_quarim && <div className="card-row__sub" style={{fontStyle:'italic'}}>Contexte Quarim : {e.context_quarim}</div>}
                    {e.reponse
                      ? <div className="dirigeant-rep"><div className="dirigeant-rep__head"><span className="label" style={{fontSize:10,opacity:.7}}>Votre réponse</span></div><div className="dirigeant-rep__body">{e.reponse}</div></div>
                      : <div className="card-row__actions"><button className="btn btn-sm btn-primary" onClick={() => { setReplyEsc(e); setReplyText('') }}>Répondre</button></div>}
                  </div>))}</div>}
            </div>
          )}

          {/* ── CANAUX ── */}
          {pane === 'canaux' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Communication</span>
                <h1 className="pane__title">Canaux <em>d'équipe</em></h1>
                <p className="pane__intro">Créez des canaux généraux ou par pôle. Les messages confidentiels sont visibles uniquement par vous.</p>
              </div>
              <Channels profile={profile}/>
            </div>
          )}

          {/* ── QUARIM IA ── */}
          {pane === 'quarim' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Assistant</span>
                <h1 className="pane__title">Quarim <em>IA</em></h1>
              </div>
              <QuarimChat brief={brief} profile={profile} suggestions={['Points bloquants de la semaine','Résumé des avancées équipe','Décisions urgentes à prendre']}/>
            </div>
          )}

          {/* ── GESTION ÉQUIPE ── */}
          {pane === 'team-admin' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Administration</span>
                <h1 className="pane__title">Gestion de <em>l'équipe</em></h1>
                <p className="pane__intro">Gérez les rôles et les pôles de chaque membre.</p>
              </div>
              <div className="card-list">
                {members.map(m => (
                  <div key={m.id} className="card-row">
                    <div className="card-row__top">
                      <div>
                        <span className="card-row__name">{m.full_name}</span>
                        <span style={{fontSize:12,opacity:.5,marginLeft:8}}>{m.email}</span>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        {m.pole && <span style={{fontSize:10,opacity:.5,border:'1px solid var(--ink)',padding:'1px 6px',borderRadius:'var(--radius)'}}>{m.pole}</span>}
                        <span className={`role-badge ${m.role === 'admin' ? 'role-admin' : ''}`}>{m.role === 'admin' ? 'Admin' : 'Employé'}</span>
                      </div>
                    </div>
                    {m.id !== profile.id && (
                      <div className="card-row__actions">
                        <button className="btn btn-sm" onClick={() => updateMemberRole(m.id, m.role === 'admin' ? 'employee' : 'admin')}>
                          {m.role === 'admin' ? 'Rétrograder employé' : 'Promouvoir admin'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REPLY MODAL */}
      {replyEsc && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) setReplyEsc(null) }}>
          <div className="modal">
            <h3>Répondre à {(replyEsc.profiles as any)?.full_name}</h3>
            <p>"{replyEsc.question}"</p>
            <div className="field">
              <span className="label">Votre réponse</span>
              <textarea rows={4} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Répondez directement…" autoFocus/>
            </div>
            <div className="modal__actions">
              <button className="btn btn-primary" onClick={submitReply}>Envoyer</button>
              <button className="btn" onClick={() => setReplyEsc(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className={`toast show`}>{toast}</div>}
    </>
  )
}
