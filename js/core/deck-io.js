import { normalizeDeck } from './deck-builder.js'

const headerV2 = 'TRICK-DECK/2'
const supportedHeaders = new Set([headerV2, 'TRICK-DECK/1', 'TCG-DECK/1'])

function serializeZone(lines, name, zone) {
  lines.push('', `[${name}]`)
  for (const [cardId, quantity] of Object.entries(zone).sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))) {
    lines.push(`${quantity} ${cardId}`)
  }
}

export function exportDeck(deck, cards = null) {
  const normalized = normalizeDeck(deck, cards)
  const lines = [
    headerV2,
    `name=${encodeURIComponent(normalized.name)}`,
    `hero=${normalized.heroId ?? ''}`,
    `hero-form=${normalized.heroFormId ?? ''}`
  ]
  serializeZone(lines, 'mainboard', normalized.mainboard)
  serializeZone(lines, 'sideboard', normalized.sideboard)
  return `${lines.join('\n')}\n`
}

export function importDeck(content, options = {}) {
  if (typeof content !== 'string') throw new Error('O conteúdo do deck deve ser texto.')
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/)
  const header = lines[0]?.trim()
  if (!supportedHeaders.has(header)) throw new Error('Formato de deck inválido ou versão não suportada.')
  let name = 'Deck importado'
  let heroId = null
  let heroFormId = null
  let activeZone = null
  const mainboard = {}
  const sideboard = {}
  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim()
    if (!line) continue
    const section = line.match(/^\[(mainboard|cards|sideboard)\]$/i)
    if (section) {
      const key = section[1].toLowerCase()
      activeZone = key === 'sideboard' ? 'sideboard' : 'mainboard'
      continue
    }
    if (!activeZone) {
      if (line.startsWith('name=')) {
        try {
          name = decodeURIComponent(line.slice(5))
        } catch {
          name = line.slice(5)
        }
      } else if (line.startsWith('hero=')) {
        heroId = line.slice(5).trim() || null
      } else if (line.startsWith('hero-form=')) {
        heroFormId = line.slice(10).trim() || null
      }
      continue
    }
    const match = line.match(/^(\d+)\s+([^\s]+)$/)
    if (!match) throw new Error(`Linha de carta inválida: ${line}`)
    const quantity = Number(match[1])
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`Quantidade inválida: ${line}`)
    const cardId = match[2]
    const target = activeZone === 'sideboard' ? sideboard : mainboard
    target[cardId] = (target[cardId] ?? 0) + quantity
  }
  if (!activeZone) throw new Error('Seção [mainboard] ou [cards] não encontrada.')
  const imported = normalizeDeck({ formatVersion: 2, name, heroId, heroFormId, mainboard, sideboard }, options.cards)
  if (options.heroes) {
    const known = typeof options.heroes.get === 'function'
      ? options.heroes.get(imported.heroId)
      : typeof options.heroes.getHeroById === 'function'
        ? options.heroes.getHeroById(imported.heroId)
        : Array.isArray(options.heroes)
          ? options.heroes.find(hero => hero.id === imported.heroId)
          : options.heroes[imported.heroId]
    if (!known) imported.heroId = null
    else if (imported.heroFormId && !known.forms?.some(form => form.id === imported.heroFormId)) imported.heroFormId = known.defaultFormId ?? null
  }
  return imported
}

