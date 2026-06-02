// Helper AI: Voyage AI embeddings + Anthropic Claude (fetch diretto, no SDK — latenza ottimale)

export async function voyageEmbed(text: string, apiKey: string): Promise<number[] | null> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3' }),
  })
  if (!res.ok) {
    console.error('[voyage] API error:', res.status, await res.text())
    return null
  }
  const json = (await res.json()) as { data?: { embedding: number[] }[] }
  return json.data?.[0]?.embedding ?? null
}

export async function anthropicChat(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  apiKey: string
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages,
    }),
  })
  if (!res.ok) {
    console.error('[anthropic] API error:', res.status, await res.text())
    return ''
  }
  const json = (await res.json()) as { content: Array<{ text: string }> }
  return json.content?.[0]?.text?.trim() ?? ''
}
