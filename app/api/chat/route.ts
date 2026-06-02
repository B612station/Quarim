import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { question, brief, role, pole, orgName, history } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })

  const ctx = brief ? JSON.stringify(brief) : 'Aucun brief disponible cette semaine.'
  const system = `Tu es Quarim, assistant IA de ${orgName || 'l\'organisation'}.
Tu t'adresses à un ${role === 'admin' ? 'dirigeant' : `collaborateur du pôle ${pole || 'inconnu'}`}.
Brief de la direction cette semaine : ${ctx}
Réponds en 3 à 6 phrases, de façon précise et orientée action.
Si tu ne peux pas répondre avec certitude, dis-le clairement.`

  const messages = [
    ...(history || []),
    { role: 'user', content: question }
  ]

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 700, system, messages })
    })
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })
    const reply = data.content.map((c: any) => c.text || '').join('')
    return NextResponse.json({ reply })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
