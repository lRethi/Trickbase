import { canonicalColors } from './colors.js'
import { normalizeCardType } from './card-catalog.js'
import { normalizeDeck } from './deck-builder.js'
import { isOffIdentity, effectiveCardCost } from './deck-analyzer.js'

function resolve(cards, id) {
  if (typeof cards?.get === 'function') return cards.get(id)
  if (typeof cards?.getById === 'function') return cards.getById(id)
  return cards?.[id]
}

function resolveHero(heroes, id) {
  if (!id || !heroes) return null
  if (typeof heroes.get === 'function') return heroes.get(id) ?? null
  if (typeof heroes.getHeroById === 'function') return heroes.getHeroById(id) ?? null
  if (Array.isArray(heroes)) return heroes.find(hero => hero.id === id) ?? null
  return heroes[id] ?? null
}

function toEntries(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.entries(value).map(([cardId, quantity]) => ({ cardId, quantity }))
  return []
}

export function validateDeck(deck, cards, rules = {}, heroes = null) {
  const errors = []
  const warnings = []
  const seenByZone = { mainboard: new Set(), sideboard: new Set() }
  const copyCounts = new Map()
  let cardCount = 0
  if (!deck || (!Array.isArray(deck.cards) && !Array.isArray(deck.mainboard) && (!deck.cards || typeof deck.cards !== 'object') && (!deck.mainboard || typeof deck.mainboard !== 'object'))) {
    return { valid: false, errors: [{ code: 'INVALID_DECK', message: 'Estrutura de deck inválida.' }], warnings, cardCount }
  }
  const legacy = deck.mainboard === undefined ? deck.cards : deck.mainboard
  const rawMainboard = toEntries(legacy)
  const rawSideboard = toEntries(deck.sideboard)
  for (const [zoneName, entries] of [['mainboard', rawMainboard], ['sideboard', rawSideboard]]) {
    const rawSeen = new Set()
    for (const entry of entries) {
      if (!entry || typeof entry.cardId !== 'string' || !entry.cardId) {
        errors.push({ code: 'INVALID_DECK_ENTRY', message: 'Entrada de carta inválida.', zone: zoneName })
        continue
      }
      if (rawSeen.has(entry.cardId)) errors.push({ code: 'DUPLICATE_DECK_ENTRY', message: `A carta ${entry.cardId} aparece em mais de uma entrada no ${zoneName}.`, cardId: entry.cardId, zone: zoneName })
      rawSeen.add(entry.cardId)
      if (!Number.isInteger(Number(entry.quantity)) || Number(entry.quantity) < 1) errors.push({ code: 'INVALID_QUANTITY', message: `Quantidade inválida para ${entry.cardId}.`, cardId: entry.cardId, zone: zoneName })
    }
  }
  const normalized = normalizeDeck(deck, cards)
  const heroId = normalized.heroId
  let hero = null
  if (rules.heroRequired !== false && !heroId) errors.push({ code: 'MISSING_HERO', message: 'Selecione um Herói para o deck.' })
  if (heroId) {
    hero = resolveHero(heroes, heroId)
    if (!hero) errors.push({ code: 'UNKNOWN_HERO', message: `Herói não encontrado: ${heroId}.`, heroId })
    else if (canonicalColors(hero.colors).length !== 2) errors.push({ code: 'INVALID_HERO_COLORS', message: `O Herói ${hero.name} não possui exatamente duas cores principais.`, heroId })
    else if (normalized.heroFormId && hero.forms?.length && !hero.forms.some(form => form.id === normalized.heroFormId)) errors.push({ code: 'INVALID_HERO_FORM', message: `A forma selecionada não existe para ${hero.name}.`, heroId, heroFormId: normalized.heroFormId })
  }
  for (const entry of rawMainboard) {
    const card = resolve(cards, entry.cardId)
    if (card && normalizeCardType(card).type === 'Ficha') warnings.push({ code: 'TOKEN_MOVED_TO_SIDEBOARD', message: `${card.name ?? entry.cardId} é uma Ficha e pertence ao Sideboard.`, cardId: entry.cardId })
  }
  const zones = [
    { name: 'mainboard', entries: toEntries(normalized.mainboard) },
    { name: 'sideboard', entries: toEntries(normalized.sideboard) }
  ]
  for (const zone of zones) {
    for (const entry of zone.entries) {
      if (!entry || typeof entry.cardId !== 'string') {
        errors.push({ code: 'INVALID_DECK_ENTRY', message: 'Entrada de carta inválida.' })
        continue
      }
      if (seenByZone[zone.name].has(entry.cardId)) {
        errors.push({ code: 'DUPLICATE_DECK_ENTRY', message: `A carta ${entry.cardId} aparece mais de uma vez no ${zone.name}.`, cardId: entry.cardId, zone: zone.name })
        continue
      }
      seenByZone[zone.name].add(entry.cardId)
      if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
        errors.push({ code: 'INVALID_QUANTITY', message: `Quantidade inválida para ${entry.cardId}.`, cardId: entry.cardId, zone: zone.name })
        continue
      }
      const card = resolve(cards, entry.cardId)
      if (!card) {
        errors.push({ code: 'UNKNOWN_CARD', message: `Carta não encontrada: ${entry.cardId}.`, cardId: entry.cardId, zone: zone.name })
        continue
      }
      if (zone.name === 'mainboard') cardCount += entry.quantity
      copyCounts.set(entry.cardId, (copyCounts.get(entry.cardId) ?? 0) + entry.quantity)
      if (zone.name === 'mainboard' && normalizeCardType(card).type === 'Ficha') {
        errors.push({ code: 'TOKEN_IN_MAINBOARD', message: `${card.name ?? entry.cardId} não pode ficar no Mainboard.`, cardId: entry.cardId })
      }
    }
  }
  if (cardCount === 0) errors.push({ code: 'DECK_EMPTY', message: 'Adicione cartas ao Mainboard.' })
  const maximumCopies = Number(rules.maximumCopiesPerCard ?? 2)
  for (const [cardId, quantity] of copyCounts) {
    const card = resolve(cards, cardId)
    if (quantity > maximumCopies) errors.push({ code: 'COPY_LIMIT_EXCEEDED', message: `${card?.name ?? cardId}: ${quantity} cópias somando Mainboard e Sideboard; o máximo é ${maximumCopies}.`, cardId })
  }
  const deckSize = rules.deckSize ?? {}
  const countedCards = cardCount + (deckSize.heroCountsTowardSize && heroId ? 1 : 0)
  if (deckSize.minimum !== null && deckSize.minimum !== undefined && countedCards < deckSize.minimum) errors.push({ code: 'DECK_TOO_SMALL', message: `O Mainboard possui ${countedCards} cartas; o mínimo é ${deckSize.minimum}.` })
  if (deckSize.maximum !== null && deckSize.maximum !== undefined && countedCards > deckSize.maximum) errors.push({ code: 'DECK_TOO_LARGE', message: `O Mainboard possui ${countedCards} cartas; o máximo é ${deckSize.maximum}.` })
  if (deckSize.minimum === null || deckSize.minimum === undefined || deckSize.maximum === null || deckSize.maximum === undefined) warnings.push({ code: 'DECK_SIZE_UNCONFIGURED', message: 'PLACEHOLDER' })
  const adjustedCards = []
  if (hero) {
    for (const [cardId, quantity] of Object.entries(normalized.mainboard)) {
      const card = resolve(cards, cardId)
      if (card && isOffIdentity(card, hero)) adjustedCards.push({ cardId, quantity, baseCost: card.cost ?? card.custo ?? null, effectiveCost: effectiveCardCost(card, hero) })
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    cardCount: countedCards,
    mainboardCount: cardCount,
    sideboardCount: Object.values(normalized.sideboard).reduce((sum, quantity) => sum + quantity, 0),
    heroId,
    heroColors: hero ? canonicalColors(hero.colors) : [],
    adjustedCards
  }
}
