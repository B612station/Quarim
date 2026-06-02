'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Channel, Message, Profile } from '@/lib/types'

interface Props { profile: Profile }

export default function Channels({ profile }: Props) {
  const sb = createClient()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [confidentiel, setConfidentiel] = useState(false)
  const [newChanName, setNewChanName] = useState('')
  const [newChanPole, setNewChanPole] = useState('')
  const [showNewChan, setShowNewChan] = useState(false)
  const [loading, setLoading] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const isAdmin = profile.role === 'admin'

  useEffect(() => { loadChannels() }, [])

  useEffect(() => {
    if (!activeChannel) return
    loadMessages(activeChannel.id)
    // realtime subscription
    const sub = sb.channel(`messages:${activeChannel.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${activeChannel.id}` },
        payload => {
          loadMessages(activeChannel.id) // reload to get profile join
        })
      .subscribe()
    return () => { sb.removeChannel(sub) }
  }, [activeChannel])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  async function loadChannels() {
    const { data } = await sb.from('channels').select('*').order('created_at')
    if (!data) return
    // Filter: admin sees all, employee sees general + their pole
    const visible = isAdmin ? data : data.filter((c: Channel) => !c.pole || c.pole === profile.pole)
    setChannels(visible)
    if (visible.length > 0 && !activeChannel) setActiveChannel(visible[0])
  }

  async function loadMessages(channelId: string) {
    const { data } = await sb
      .from('messages')
      .select('*, profiles(full_name, role, pole)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) setMessages(data as Message[])
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || !activeChannel) return
    setInput(''); setLoading(true)
    await sb.from('messages').insert({
      channel_id: activeChannel.id,
      author_id: profile.id,
      content: text,
      confidentiel,
    })
    setConfidentiel(false); setLoading(false)
  }

  async function createChannel() {
    if (!newChanName.trim()) return
    await sb.from('channels').insert({
      name: newChanName.trim().toLowerCase().replace(/\s+/g, '-'),
      description: '',
      pole: newChanPole || null,
      created_by: profile.id,
    })
    setNewChanName(''); setNewChanPole(''); setShowNewChan(false)
    loadChannels()
  }

  function canSeeMessage(msg: Message): boolean {
    if (isAdmin) return true
    if (msg.author_id === profile.id) return true
    return !msg.confidentiel
  }

  function fmt(ts: string) {
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', border: 'var(--rule)', borderRadius: 'var(--radius)', overflow: 'hidden', minHeight: 520 }}>

      {/* CHANNEL LIST */}
      <div style={{ borderRight: 'var(--rule)', padding: '16px 0' }}>
        <div style={{ padding: '0 16px 12px', borderBottom: 'var(--rule)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="label" style={{ fontSize: 10 }}>Canaux</span>
          {isAdmin && (
            <button className="btn-ghost btn" style={{ padding: '2px 0', fontSize: 18, lineHeight: 1 }} onClick={() => setShowNewChan(v => !v)} title="Nouveau canal">+</button>
          )}
        </div>

        {isAdmin && showNewChan && (
          <div style={{ padding: '8px 14px', borderBottom: 'var(--rule)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input type="text" placeholder="nom-du-canal" value={newChanName} onChange={e => setNewChanName(e.target.value)} style={{ fontSize: 12, padding: '6px 2px' }}/>
            <select value={newChanPole} onChange={e => setNewChanPole(e.target.value)} style={{ fontSize: 12, padding: '6px 2px' }}>
              <option value="">Général (tous)</option>
              {['RH','Marketing','Commercial','Juridique','Opérations','Finance','Technique','Direction'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 10 }} onClick={createChannel}>Créer</button>
          </div>
        )}

        {channels.map(c => (
          <button
            key={c.id}
            className={`nav-item nav-channel ${activeChannel?.id === c.id ? 'active' : ''}`}
            onClick={() => setActiveChannel(c)}
          >
            {c.name}
            {c.pole && <span style={{ fontSize: 9, opacity: .5, marginLeft: 4 }}>{c.pole}</span>}
          </button>
        ))}

        {channels.length === 0 && (
          <div style={{ padding: '12px 16px', fontSize: 12, opacity: .45, fontStyle: 'italic' }}>
            {isAdmin ? 'Créez un canal +' : 'Aucun canal disponible'}
          </div>
        )}
      </div>

      {/* MESSAGES */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {activeChannel ? (
          <>
            <div style={{ padding: '12px 18px', borderBottom: 'var(--rule)', display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="label" style={{ fontSize: 12 }}>#{activeChannel.name}</span>
              {activeChannel.pole && <span style={{ fontSize: 10, opacity: .5 }}>{activeChannel.pole}</span>}
            </div>

            <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', opacity: .4, fontStyle: 'italic', fontSize: 14 }}>
                  Aucun message dans #{activeChannel.name}
                </div>
              )}
              {messages.map(m => {
                const visible = canSeeMessage(m)
                const isMe = m.author_id === profile.id
                return (
                  <div key={m.id} className="msg" style={{ paddingLeft: 0 }}>
                    <div className="msg__from">
                      {(m.profiles as any)?.full_name || 'Utilisateur'}
                      {(m.profiles as any)?.pole && <span className="pole-tag">{(m.profiles as any).pole}</span>}
                      <span className="when">{fmt(m.created_at)}</span>
                      {m.confidentiel && <span className="conf-label">🔒 Confidentiel</span>}
                    </div>
                    <div className={`msg__body ${!visible ? 'conf-blur' : ''}`} style={{ fontSize: 14, fontFamily: 'var(--sans)', fontWeight: 300 }}>
                      {visible ? m.content : '[Message confidentiel]'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* COMPOSER */}
            <div style={{ borderTop: 'var(--rule)', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <input
                  type="text"
                  placeholder={`Message dans #${activeChannel.name}…`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  style={{ flex: 1 }}
                />
                <button
                  className={`btn btn-confidentiel ${confidentiel ? 'active' : ''}`}
                  onClick={() => setConfidentiel(v => !v)}
                  title="Marquer comme confidentiel — visible seulement par la direction"
                >
                  🔒 {confidentiel ? 'Confidentiel' : 'Public'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={loading || !input.trim()}>
                  Envoyer
                </button>
              </div>
              {confidentiel && (
                <div style={{ fontSize: 11, opacity: .6, fontStyle: 'italic' }}>
                  Ce message sera visible uniquement par la direction et vous-même.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty" style={{ margin: 20 }}>
            <div className="empty__title">Sélectionnez un canal</div>
          </div>
        )}
      </div>
    </div>
  )
}
