import { canonicalColors, COLOR_DEFINITIONS } from './colors.js'
import { normalizeCardType } from './card-catalog.js'
import { normalizeDeck } from './deck-builder.js'

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

export function isOffIdentity(card, hero) {
  if (!hero) return false
  const cardColors = canonicalColors(card?.colors ?? card?.cores)
  if (!cardColors.length) return false
  const identity = new Set(canonicalColors(hero.colors))
  return cardColors.some(color => !identity.has(color))
}

export function effectiveCardCost(card, hero) {
  const raw = card?.cost ?? card?.custo
  if (raw === null || raw === undefined || raw === '') return null
  const cost = Number(raw)
  if (!Number.isFinite(cost)) return null
  return cost + (isOffIdentity(card, hero) ? 1 : 0)
}

function analyzeZone(entries, cards, hero, colorCounts) {
  const manaCurve = {}
  let totalCards = 0
  let unknownCostCards = 0
  let colorlessCards = 0
  let cardsWithoutColor = 0
  let offIdentityCards = 0
  let creatures = 0
  let actions = 0
  let tokens = 0
  for (const [id, quantity] of Object.entries(entries)) {
    const card = resolve(cards, id)
    if (!card || !Number.isInteger(quantity) || quantity < 1) continue
    totalCards += quantity
    const cost = effectiveCardCost(card, hero)
    if (cost === null) unknownCostCards += quantity
    else {
      const bucket = cost >= 7 ? '7+' : String(cost)
      manaCurve[bucket] = (manaCurve[bucket] ?? 0) + quantity
    }
    const colors = canonicalColors(card.colors ?? card.cores)
    if (!colors.length) {
      cardsWithoutColor += quantity
      colorlessCards += quantity
    }
    if (isOffIdentity(card, hero)) offIdentityCards += quantity
    for (const color of colors) colorCounts[color] = (colorCounts[color] ?? 0) + quantity
    const type = normalizeCardType(card).type
    if (type === 'Criatura') creatures += quantity
    if (type === 'Ação') actions += quantity
    if (type === 'Ficha') tokens += quantity
  }
  return { totalCards, manaCurve, unknownCostCards, colorlessCards, cardsWithoutColor, offIdentityCards, creatures, actions, tokens }
}

export function analyzeDeck(deck, cards, heroes = null) {
  const normalized = normalizeDeck(deck, cards)
  const hero = resolveHero(heroes, normalized.heroId)
  const colorCounts = Object.fromEntries(COLOR_DEFINITIONS.map(color => [color.id, 0]))
  const sideboardColorCounts = Object.fromEntries(COLOR_DEFINITIONS.map(color => [color.id, 0]))
  const mainboard = analyzeZone(normalized.mainboard, cards, hero, colorCounts)
  const sideboard = analyzeZone(normalized.sideboard, cards, hero, sideboardColorCounts)
  return {
    totalCards: mainboard.totalCards,
    sideboardCards: sideboard.totalCards,
    combinedCards: mainboard.totalCards + sideboard.totalCards,
    manaCurve: mainboard.manaCurve,
    unknownCostCards: mainboard.unknownCostCards,
    colorCounts,
    sideboardColorCounts,
    colorlessCards: mainboard.colorlessCards,
    cardsWithoutColor: mainboard.cardsWithoutColor,
    offIdentityCards: mainboard.offIdentityCards,
    creatures: mainboard.creatures,
    actions: mainboard.actions,
    tokens: mainboard.tokens,
    sideboardAnalysis: sideboard,
    heroColors: hero ? canonicalColors(hero.colors) : []
  }
}
