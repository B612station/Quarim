import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { transcript, orgName, sector } = await req.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })

  const prompt = `Tu es Quarim, assistant IA de ${orgName || 'l\'organisation'}${sector ? ', ' + sector : ''}.
Voici la dictée du dirigeant :
---
${transcript}
---
Génère un JSON avec exactement ces 5 clés :
{"situation_actuelle":"...","problemes_semaine":"...","actions_prochaine_semaine":"...","points_bloquants":"...","infos_pratiques":"..."}
Réponds UNIQUEMENT en JSON brut, sans backticks ni texte supplémentaire.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }] })
    })
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })
    const raw = data.content.map((c: any) => c.text || '').join('').trim()
    const summary = JSON.parse(raw)
    return NextResponse.json({ summary })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
