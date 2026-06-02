'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile, Brief, Avancee, Escalade, BRIEF_SECTIONS } from '@/lib/types'
import QuarimChat from '@/components/QuarimChat'
import Channels from '@/components/Channels'

type Pane = 'dashboard' | 'avancees' | 'quarim' | 'canaux' | 'escalades'

export default function EmployeePage() {
  const router = useRouter()
  const sb = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pane, setPane] = useState<Pane>('dashboard')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [myAvancees, setMyAvancees] = useState<Avancee[]>([])
  const [myEscalades, setMyEscalades] = useState<Escalade[]>([])
  const [transcript, setTranscript] = useState('')
  const [confidentiel, setConfidentiel] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [lastResume, setLastResume] = useState('')
  const [toast, setToast] = useState('')
  const [isRec, setIsRec] = useState(false)
  const [recTimer, setRecTimer] = useState('00:00')
  const [escInput, setEscInput] = useState('')
  const recognition = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const recSecs = useRef(0)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return }
      sb.from('profiles').select('*').eq('id', data.session.user.id).single().then(({ data: p }) => {
        if (!p) { router.replace('/login'); return }
        if (p.role === 'admin') { router.replace('/admin'); return }
        setProfile(p)
        loadData(p)
      })
    })
  }, [])

  async function loadData(p: Profile) {
    const [{ data: b }, { data: av }, { data: esc }] = await Promise.all([
      sb.from('briefs').select('*').order('week_date', { ascending: false }).limit(1).single(),
      sb.from('avancees').select('*').eq('author_id', p.id).order('created_at', { ascending: false }),
      sb.from('escalades').select('*').eq('author_id', p.id).order('created_at', { ascending: false }),
    ])
    if (b) setBrief(b)
    if (av) setMyAvancees(av)
    if (esc) setMyEscalades(esc)
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
    recognition.current.onend = () => { setIsRec(false); clearInterval(timerRef.current) }
    recognition.current.start()
    setIsRec(true); recSecs.current = 0
    timerRef.current = setInterval(() => {
      recSecs.current++
      setRecTimer(`${String(Math.floor(recSecs.current/60)).padStart(2,'0')}:${String(recSecs.current%60).padStart(2,'0')}`)
    }, 1000)
  }

  async function submitAvancee() {
    if (!transcript.trim()) { showToast('Dictez ou écrivez votre compte-rendu'); return }
    setGenLoading(true)
    try {
      const res = await fetch('/api/avancee', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, userName: profile!.full_name, orgName: profile!.org_name })
      })
      const { resume, error } = await res.json()
      if (error) { showToast(error); return }
      await sb.from('avancees').insert({
        author_id: profile!.id, transcript, resume, confidentiel,
        week_date: new Date().toISOString().split('T')[0]
      })
      setLastResume(resume); setTranscript(''); setConfidentiel(false)
      loadData(profile!)
      showToast('Avancées soumises' + (confidentiel ? ' — confidentiel' : ''))
    } catch (e: any) { showToast(e.message) }
    finally { setGenLoading(false) }
  }

  async function escalader(question: string, context: string) {
    await sb.from('escalades').insert({ author_id: profile!.id, question, context_quarim: context })
    loadData(profile!)
    showToast('Question transmise à la direction')
  }

  if (!profile) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontStyle:'italic', opacity:.4, fontFamily:'Georgia,serif', fontSize:20 }}>Quarim</div>

  const pendingReponses = myEscalades.filter(e => e.reponse)

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="wordmark">
            <span className="wordmark__name">Quarim</span>
            <span className="wordmark__ctx">{profile.org_name}</span>
          </div>
          <div className="header-right">
            <span className="role-badge">{profile.pole || 'Collaborateur'}</span>
            <span className="user-pill">{profile.full_name}</span>
            <button className="btn btn-sm" onClick={async () => { await sb.auth.signOut(); router.replace('/login') }}>Déconnexion</button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <div className="sidebar">
          {([
            ['dashboard','Tableau de bord'],
            ['avancees','Mes avancées'],
            ['quarim','Quarim IA'],
            ['canaux','Canaux'],
            ['escalades','Mes escalades'],
          ] as [Pane, string][]).map(([id, label]) => (
            <button key={id} className={`nav-item ${pane === id ? 'active' : ''}`} onClick={() => setPane(id)}>
              {label}
              {id === 'escalades' && pendingReponses.length > 0 && <span className="nav-badge">{pendingReponses.length}</span>}
            </button>
          ))}
        </div>

        <div className="content-area">

          {/* ── DASHBOARD ── */}
          {pane === 'dashboard' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Tableau de bord</span>
                <h1 className="pane__title">Bonjour, <em>{profile.full_name.split(' ')[0]}</em></h1>
              </div>

              {brief ? (
                <div className="brief-banner">
                  <div className="brief-banner__info">
                    <div className="brief-banner__title">Brief de la direction disponible</div>
                    <div className="brief-banner__sub">Semaine du {new Date(brief.week_date).toLocaleDateString('fr-FR', { day:'numeric', month:'long' })}</div>
                  </div>
                  <button className="btn btn-sm" onClick={() => setPane('quarim')}>Interroger Quarim →</button>
                </div>
              ) : (
                <div className="brief-banner" style={{opacity:.5}}>
                  <div><div className="brief-banner__title">Aucun brief cette semaine</div><div className="brief-banner__sub">La direction n'a pas encore publié de compte-rendu.</div></div>
                </div>
              )}

              <div className="sec-title">Réponses reçues de la direction</div>
              {pendingReponses.length === 0
                ? <div className="empty"><div className="empty__title">Aucune réponse</div><div className="empty__sub">Les réponses de la direction apparaîtront ici.</div></div>
                : <div className="card-list">{myEscalades.filter(e=>e.reponse).map(e => (
                  <div key={e.id} className="card-row">
                    <div className="card-row__top"><span className="card-row__name" style={{fontSize:13}}>"{e.question}"</span><span className="status-tag st-ok">Répondu</span></div>
                    <div className="dirigeant-rep">
                      <div className="dirigeant-rep__head"><span className="label" style={{fontSize:10,opacity:.7}}>Réponse de la direction</span></div>
                      <div className="dirigeant-rep__body">{e.reponse}</div>
                    </div>
                  </div>))}</div>}
            </div>
          )}

          {/* ── AVANCÉES ── */}
          {pane === 'avancees' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Compte-rendu</span>
                <h1 className="pane__title">Mes <em>avancées</em></h1>
                <p className="pane__intro">Dictez ou écrivez votre bilan de la semaine. Quarim le résume pour la direction.</p>
              </div>
              <div className="rec-bar">
                <button className="btn btn-primary" onClick={toggleRec}>{isRec ? 'Arrêter' : 'Commencer la dictée'}</button>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span className={`rec-dot ${isRec ? 'live' : ''}`}/>
                  <span className="rec-txt">{isRec ? 'Enregistrement' : 'En attente'}</span>
                </div>
                {isRec && <span style={{fontFamily:'var(--serif)',fontStyle:'italic',fontSize:20}}>{recTimer}</span>}
              </div>
              <div className="field" style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <span className="label">Votre compte-rendu</span>
                  <button className="linklike" onClick={() => setTranscript('')}>Effacer</button>
                </div>
                <textarea rows={6} value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Racontez votre semaine librement — avancées, blocages, questions, dossiers en cours…" style={{border:'var(--rule)',borderBottom:'var(--rule)',borderRadius:'var(--radius)',padding:'16px 18px',minHeight:140}}/>
              </div>

              {/* CONFIDENTIEL TOGGLE */}
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,padding:'14px 0',borderTop:'var(--rule)',borderBottom:'var(--rule)'}}>
                <button className={`btn btn-confidentiel ${confidentiel ? 'active' : ''}`} onClick={() => setConfidentiel(v => !v)}>
                  🔒 {confidentiel ? 'Confidentiel activé' : 'Marquer confidentiel'}
                </button>
                <span style={{fontSize:12,opacity:.55,fontStyle:'italic'}}>
                  {confidentiel ? 'Visible uniquement par la direction — vos collègues ne verront pas ce compte-rendu.' : 'Visible par toute l\'équipe par défaut.'}
                </span>
              </div>

              <div style={{display:'flex',gap:12,marginBottom:28}}>
                <button className="btn btn-primary" onClick={submitAvancee} disabled={genLoading}>
                  {genLoading ? <><span className="spinner"/> Envoi…</> : 'Soumettre à Quarim'}
                </button>
              </div>

              {lastResume && (
                <div className="card-list" style={{marginBottom:24}}>
                  <div className="card-row">
                    <div className="card-row__top"><span className="card-row__name">Résumé envoyé à la direction</span><span className="status-tag st-ok">Soumis</span></div>
                    <div className="card-row__sub">{lastResume}</div>
                  </div>
                </div>
              )}

              <div className="sec-title">Mes comptes-rendus</div>
              {myAvancees.length === 0
                ? <div className="empty"><div className="empty__title">Aucun compte-rendu</div></div>
                : <div className="card-list">{myAvancees.map(a => (
                  <div key={a.id} className="card-row">
                    <div className="card-row__top">
                      <span style={{fontSize:12,opacity:.5}}>{new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                      <div style={{display:'flex',gap:6}}>
                        {a.confidentiel && <span className="status-tag st-conf">🔒</span>}
                        <span className="status-tag st-ok">Envoyé</span>
                      </div>
                    </div>
                    <div className="card-row__sub">{a.resume}</div>
                  </div>))}</div>}
            </div>
          )}

          {/* ── QUARIM IA ── */}
          {pane === 'quarim' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Assistant</span>
                <h1 className="pane__title">Parler à <em>Quarim</em></h1>
                <p className="pane__intro">Quarim connaît le brief de la direction. Si sa réponse ne suffit pas, escaladez directement.</p>
              </div>
              <QuarimChat
                brief={brief}
                profile={profile}
                suggestions={['Points bloquants','Mes priorités cette semaine','Délais urgents à respecter','Contacts en cas de problème']}
              />
              <div style={{marginTop:24,paddingTop:20,borderTop:'var(--rule)'}}>
                <div className="sec-title">Escalader une question</div>
                <p style={{fontSize:13,opacity:.6,marginBottom:14}}>Si Quarim ne peut pas répondre, transmettez votre question directement à la direction.</p>
                <div style={{display:'flex',gap:10}}>
                  <input type="text" value={escInput} onChange={e => setEscInput(e.target.value)} placeholder="Votre question pour la direction…" style={{flex:1}} onKeyDown={e => { if(e.key==='Enter') { escalader(escInput,'Escalade manuelle'); setEscInput('') }}}/>
                  <button className="btn btn-primary btn-sm" onClick={() => { if(escInput.trim()){ escalader(escInput,'Escalade manuelle'); setEscInput('') }}}>Escalader</button>
                </div>
              </div>
            </div>
          )}

          {/* ── CANAUX ── */}
          {pane === 'canaux' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Communication</span>
                <h1 className="pane__title">Canaux <em>d'équipe</em></h1>
                <p className="pane__intro">Vous voyez les canaux généraux et ceux de votre pôle ({profile.pole}). Le bouton 🔒 rend un message visible uniquement par la direction.</p>
              </div>
              <Channels profile={profile}/>
            </div>
          )}

          {/* ── ESCALADES ── */}
          {pane === 'escalades' && (
            <div className="pane">
              <div className="pane__head">
                <span className="label">Escalades</span>
                <h1 className="pane__title">Mes questions <em>transmises</em></h1>
              </div>
              {myEscalades.length === 0
                ? <div className="empty"><div className="empty__title">Aucune escalade</div><div className="empty__sub">Vos questions transmises à la direction apparaîtront ici.</div></div>
                : <div className="card-list">{myEscalades.map(e => (
                  <div key={e.id} className="card-row">
                    <div className="card-row__top">
                      <span className="card-row__name" style={{fontSize:13}}>"{e.question}"</span>
                      <span className={`status-tag ${e.reponse ? 'st-ok' : 'st-wait'}`}>{e.reponse ? 'Répondu' : 'En attente'}</span>
                    </div>
                    {e.reponse && (
                      <div className="dirigeant-rep">
                        <div className="dirigeant-rep__head"><span className="label" style={{fontSize:10,opacity:.7}}>Direction</span></div>
                        <div className="dirigeant-rep__body">{e.reponse}</div>
                      </div>
                    )}
                  </div>))}</div>}
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </>
  )
}
