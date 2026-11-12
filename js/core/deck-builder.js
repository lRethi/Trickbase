import { normalizeCardType } from './card-catalog.js'

function resolveCard(cards, id) {
  if (!cards) return null
  if (typeof cards.get === 'function') return cards.get(id) ?? null
  if (typeof cards.getById === 'function') return cards.getById(id) ?? null
  return cards[id] ?? null
}

function toQuantityMap(value) {
  if (Array.isArray(value)) {
    const result = {}
    for (const entry of value) {
      if (!entry?.cardId || !Number.isInteger(Number(entry.quantity)) || Number(entry.quantity) < 1) continue
      result[entry.cardId] = (result[entry.cardId] ?? 0) + Number(entry.quantity)
    }
    return result
  }
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter(([id, quantity]) => id && Number.isInteger(Number(quantity)) && Number(quantity) > 0).map(([id, quantity]) => [id, Number(quantity)]))
}

export function normalizeDeck(deck = {}, cards = null) {
  const mainboard = toQuantityMap(deck.mainboard ?? deck.cards)
  const sideboard = toQuantityMap(deck.sideboard)
  for (const [id, quantity] of Object.entries(mainboard)) {
    const card = resolveCard(cards, id)
    if (card && normalizeCardType(card).type === 'Ficha') {
      sideboard[id] = (sideboard[id] ?? 0) + quantity
      delete mainboard[id]
    }
  }
  return {
    formatVersion: 2,
    name: String(deck.name || 'Novo deck'),
    heroId: deck.heroId ?? deck.hero ?? deck.heroCardId ?? null,
    heroFormId: deck.heroFormId ?? deck.heroForm ?? null,
    mainboard,
    sideboard
  }
}

export function createDeck(name = 'Novo deck') {
  return { formatVersion: 2, name, heroId: null, heroFormId: null, mainboard: {}, sideboard: {} }
}

export function setHero(deck, heroId, heroFormId = null) {
  return { ...normalizeDeck(deck), heroId: heroId || null, heroFormId: heroId ? heroFormId : null }
}

export function addCard(deck, cardOrId, quantity = 1, options = {}) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('A quantidade adicionada deve ser um inteiro positivo.')
  const card = typeof cardOrId === 'object' && cardOrId !== null ? cardOrId : resolveCard(options.cards, cardOrId)
  const cardId = typeof cardOrId === 'string' ? cardOrId : String(cardOrId?.id ?? '')
  if (!cardId) throw new Error('A carta precisa possuir um identificador.')
  const deckState = normalizeDeck(deck, options.cards)
  const requestedZone = options.zone === 'sideboard' ? 'sideboard' : 'mainboard'
  const targetZone = card && normalizeCardType(card).type === 'Ficha' ? 'sideboard' : requestedZone
  const zone = { ...deckState[targetZone] }
  zone[cardId] = (zone[cardId] ?? 0) + quantity
  return { ...deckState, [targetZone]: zone }
}

export function removeCard(deck, cardId, quantity = 1, zone = 'mainboard') {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('A quantidade removida deve ser um inteiro positivo.')
  const deckState = normalizeDeck(deck)
  const targetZone = zone === 'sideboard' ? 'sideboard' : 'mainboard'
  const current = deckState[targetZone][cardId] ?? 0
  const next = { ...deckState[targetZone] }
  if (current <= quantity) delete next[cardId]
  else next[cardId] = current - quantity
  return { ...deckState, [targetZone]: next }
}

export function moveCard(deck, cardId, quantity = 1, from = 'mainboard', cards = null) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('A quantidade movida deve ser um inteiro positivo.')
  const deckState = normalizeDeck(deck, cards)
  const source = from === 'sideboard' ? 'sideboard' : 'mainboard'
  const target = source === 'mainboard' ? 'sideboard' : 'mainboard'
  const card = resolveCard(cards, cardId)
  if (card && normalizeCardType(card).type === 'Ficha' && target === 'mainboard') throw new Error('Fichas devem permanecer no Sideboard.')
  const available = deckState[source][cardId] ?? 0
  if (available < quantity) throw new Error('A quantidade solicitada não está disponível nessa seção.')
  const sourceMap = { ...deckState[source] }
  const remaining = available - quantity
  if (remaining > 0) sourceMap[cardId] = remaining
  else delete sourceMap[cardId]
  const targetMap = { ...deckState[target], [cardId]: (deckState[target][cardId] ?? 0) + quantity }
  return { ...deckState, [source]: sourceMap, [target]: targetMap }
}

export function countZone(deck, zone = 'mainboard') {
  const normalized = normalizeDeck(deck)
  return Object.values(normalized[zone === 'sideboard' ? 'sideboard' : 'mainboard']).reduce((sum, quantity) => sum + quantity, 0)
}

export function countTotalCopies(deck, cardId) {
  const normalized = normalizeDeck(deck)
  return (normalized.mainboard[cardId] ?? 0) + (normalized.sideboard[cardId] ?? 0)
}
