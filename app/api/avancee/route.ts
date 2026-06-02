import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { transcript, userName, orgName } = await req.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })

  const prompt = `Tu es Quarim. Voici le compte-rendu de ${userName} chez ${orgName || 'l\'organisation'} :
---
${transcript}
---
Fais un résumé factuel en 3 à 5 phrases pour le dirigeant. Commence par mentionner le prénom si pertinent. Sois concis et factuel. Réponds uniquement le résumé, sans titre ni introduction.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400,
        messages: [{ role: 'user', content: prompt }] })
    })
    const data = await res.json()
    const resume = data.content.map((c: any) => c.text || '').join('')
    return NextResponse.json({ resume })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
