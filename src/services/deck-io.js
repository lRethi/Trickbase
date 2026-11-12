const header = "TCG-DECK/1"

export function exportDeck(deck) {
  const lines = [header, `name=${encodeURIComponent(deck.name)}`, `hero=${deck.heroCardId ?? ""}`, "", "[cards]"]
  for (const entry of deck.cards) lines.push(`${entry.quantity} ${entry.cardId}`)
  return `${lines.join("\n")}\n`
}

export function importDeck(content) {
  if (typeof content !== "string") throw new Error("O conteúdo do deck deve ser texto.")
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/)
  if (lines[0]?.trim() !== header) throw new Error("Formato de deck inválido ou versão não suportada.")

  let name = "Deck importado"
  let heroCardId = null
  let inCards = false
  const entries = []

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line === "[cards]") {
      inCards = true
      continue
    }
    if (!inCards) {
      if (line.startsWith("name=")) name = decodeURIComponent(line.slice(5))
      if (line.startsWith("hero=")) heroCardId = line.slice(5).trim() || null
      continue
    }
    const match = line.match(/^(\d+)\s+([A-Za-z0-9_-]+)$/)
    if (!match) throw new Error(`Linha de carta inválida: ${line}`)
    entries.push({ quantity: Number(match[1]), cardId: match[2] })
  }

  if (!inCards) throw new Error("Seção [cards] não encontrada.")
  return { formatVersion: 1, name, heroCardId, cards: entries }
}
