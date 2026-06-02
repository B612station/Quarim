'use client'
import { useState, useRef, useEffect } from 'react'
import { Brief, Profile } from '@/lib/types'

interface Msg { role: 'user' | 'ai'; text: string; when: string }

interface Props {
  brief: Brief | null
  profile: Profile
  suggestions?: string[]
}

function now() { return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
function esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export default function QuarimChat({ brief, profile, suggestions }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'ai',
    text: brief
      ? `Bonjour${profile.role === 'admin' ? '' : ` ${profile.full_name.split(' ')[0]}`}. Le brief de la direction est disponible. Posez-moi vos questions.`
      : 'Bonjour. Aucun brief n\'a encore été publié cette semaine. Je reste disponible pour vos questions.',
    when: now()
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [msgs])

  async function send(q?: string) {
    const question = q || input.trim()
    if (!question || loading) return
    setInput('')
    const userMsg: Msg = { role: 'user', text: question, when: now() }
    setMsgs(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          brief: brief?.summary || null,
          role: profile.role,
          pole: profile.pole,
          orgName: profile.org_name,
          history: msgs.slice(-6).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }))
        })
      })
      const data = await res.json()
      setMsgs(prev => [...prev, { role: 'ai', text: data.reply, when: now() }])
    } catch {
      setMsgs(prev => [...prev, { role: 'ai', text: 'Erreur de connexion. Vérifiez la configuration.', when: now() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="ia-status">
        <span className="dot"/>
        <span className="s">Quarim</span>
        <span className="d">— en ligne {brief ? `· brief semaine ${brief.week_date}` : '· sans brief cette semaine'}</span>
      </div>

      <div ref={threadRef} className="thread" style={{ maxHeight: 480, overflowY: 'auto' }}>
        {msgs.map((m, i) => (
          <div key={i} className={`msg msg--${m.role === 'ai' ? 'ai' : 'user'}`}>
            <div className="msg__from">
              {m.role === 'ai' ? 'Quarim' : profile.full_name}
              <span className="when">{m.when}</span>
            </div>
            <div
              className="msg__body"
              dangerouslySetInnerHTML={{
                __html: m.role === 'ai'
                  ? m.text.split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')
                  : esc(m.text)
              }}
            />
          </div>
        ))}
        {loading && (
          <div className="msg msg--ai">
            <div className="msg__from">Quarim</div>
            <div className="typing"><span/><span/><span/></div>
          </div>
        )}
      </div>

      {suggestions && (
        <div className="quick">
          {suggestions.map(s => (
            <button key={s} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <div className="composer">
        <div className="field">
          <span className="label">Votre question</span>
          <textarea
            rows={1}
            placeholder="Posez votre question à Quarim…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => send()} disabled={loading}>
          Envoyer
        </button>
      </div>
    </div>
  )
}
