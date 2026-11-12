import { COLOR_DEFINITIONS, COLOR_LABELS, COLOR_MAP, canonicalColor, canonicalColorLabel, canonicalColors, fold, isColorless, matchesColorFilter } from './core/colors.js'
import { CardCatalog, normalizeCardCollection, normalizeCardType } from './core/card-catalog.js'
import { normalizeHeroCollection } from './core/heroes.js'

export const defaultRules = {
  deckSize: { minimum: null, maximum: null, heroCountsTowardSize: false },
  maximumCopiesPerCard: 2,
  heroRequired: true,
  sideboard: { countsTowardDeckSize: false }
}

export const colorMap = COLOR_MAP
export const colorDefinitions = COLOR_DEFINITIONS
export const colorLabels = COLOR_LABELS
export const normalize = fold
export { canonicalColor, canonicalColors, canonicalColorLabel, isColorless, matchesColorFilter }

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

export const cardId = card => String(card?.id ?? card?.numero ?? '')
export const cardName = card => String(card?.name ?? card?.nome ?? 'Carta sem nome')

export function cardType(card) {
  return normalizeCardType(card)
}

export function cardCost(card) {
  const value = card?.cost ?? card?.custo
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const cardColors = card => canonicalColors(card?.colors ?? card?.cores)
export const cardKeywords = card => Array.isArray(card?.keywords) ? card.keywords : Array.isArray(card?.palavrasChave) ? card.palavrasChave : []

export function cardImage(card) {
  const image = card?.image ?? card?.imagem
  if (image) return String(image)
  const digits = cardId(card).match(/(\d+)$/)?.[1]
  const number = digits ? String(Number(digits)) : '1'
  return `assets/cards/01_flowerpower/${number}.webp`
}

export function heroFormImage(form) {
  return String(form?.image || 'assets/images/card-back.webp')
}

export function formatCardNumber(card) {
  const id = cardId(card)
  const digits = id.match(/(\d+)$/)?.[1]
  return digits ? `#${digits.padStart(3, '0')}` : id
}

async function fetchJson(paths, label) {
  let lastError = null
  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: 'no-store' })
      if (!response.ok) continue
      return await response.json()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error(`${label} não encontrado.`)
}

async function fetchOptionalJson(path) {
  try {
    const response = await fetch(path, { cache: 'no-store' })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function normalizeCollectionPayload(payload, fallbackId = 'unknown') {
  if (Array.isArray(payload)) return { id: fallbackId, name: fallbackId, cards: payload }
  return { ...payload, id: String(payload.id ?? fallbackId), name: String(payload.name ?? fallbackId) }
}

async function loadCollections() {
  const registry = await fetchOptionalJson('data/collections/index.json')
  const entries = Array.isArray(registry) ? registry : registry?.collections
  if (Array.isArray(entries) && entries.length) {
    const collections = []
    for (const entry of entries) {
      const path = String(entry.path ?? entry.file ?? '').trim()
      if (!path) throw new Error(`Caminho ausente no registro da coleção ${entry.id ?? entry.name ?? ''}.`)
      const payload = await fetchJson([path], entry.name ?? entry.id ?? 'Coleção')
      const collection = normalizeCollectionPayload(payload, entry.id ?? 'unknown')
      if (!Array.isArray(collection.cards)) throw new Error(`A coleção ${collection.name ?? collection.id} não contém uma lista de cartas.`)
      collections.push(collection)
    }
    return collections
  }
  const payload = await fetchJson([
    'data/collections/01_flowerpower/cards.json',
    'data/collections/01_flowerpower/cards.json',
    'data/flowerpower.json',
    '../data/collections/flowerpower.json'
  ], 'Coleção')
  return [normalizeCollectionPayload(payload, 'flowerpower')]
}

export async function loadGameData() {
  const collections = await loadCollections()
  const heroesPayload = await fetchJson([
    'data/collections/01_flowerpower/heroes.json',
    'data/heroes.json'
  ], 'Database de Heróis')
  const heroCollection = Array.isArray(heroesPayload) ? { id: 'flowerpower-heroes', cards: heroesPayload } : heroesPayload
  const cards = collections.flatMap(normalizeCardCollection)
  const heroes = normalizeHeroCollection(heroCollection)
  let rules = defaultRules
  try {
    const response = await fetch('data/rules.json', { cache: 'no-store' })
    if (response.ok) rules = mergeRules(await response.json())
  } catch {
    rules = defaultRules
  }
  const catalog = new CardCatalog(collections, [heroCollection])
  return { collection: collections[0], collections, cards, heroes, rules, catalog }
}

export function mergeRules(source = {}) {
  return {
    ...defaultRules,
    ...source,
    deckSize: { ...defaultRules.deckSize, ...(source.deckSize || {}) },
    sideboard: { ...defaultRules.sideboard, ...(source.sideboard || {}) }
  }
}

export function parseSearchQuery(query) {
  const text = String(query ?? '')
  const terms = []
  const filters = []
  const matcher = /([\wÀ-ÿ-]+):("[^"]+"|\S+)/g
  let match
  let remaining = text
  while ((match = matcher.exec(text))) {
    const field = normalize(match[1])
    const value = normalize(match[2].replace(/^"|"$/g, ''))
    filters.push({ field, value })
    remaining = remaining.replace(match[0], ' ')
  }
  remaining.split(/\s+/).map(normalize).filter(Boolean).forEach(term => terms.push(term))
  return { terms, filters }
}

export function matchesSearch(card, query) {
  const parsed = parseSearchQuery(query)
  const { type, subtype } = cardType(card)
  const colors = cardColors(card)
  const fields = {
    nome: normalize(cardName(card)),
    name: normalize(cardName(card)),
    tipo: normalize(type),
    type: normalize(type),
    subtipo: normalize(subtype),
    subtype: normalize(subtype),
    texto: normalize(card.text ?? card.texto ?? ''),
    text: normalize(card.text ?? card.texto ?? ''),
    id: normalize(cardId(card)),
    custo: cardCost(card) === null ? '' : String(cardCost(card)),
    cost: cardCost(card) === null ? '' : String(cardCost(card)),
    cor: colors.join(' '),
    color: colors.join(' '),
    raridade: normalize(card.rarity ?? card.raridade ?? ''),
    rarity: normalize(card.rarity ?? card.raridade ?? ''),
    habilidade: normalize(cardKeywords(card).join(' ')),
    keyword: normalize(cardKeywords(card).join(' '))
  }
  const haystack = normalize([cardName(card), cardId(card), type, subtype, card.text, card.texto, ...cardKeywords(card), ...colors].join(' '))
  if (!parsed.terms.every(term => haystack.includes(term) || (canonicalColor(term) && colors.includes(canonicalColor(term))) || ((term === 'incolor' || term === 'sem cor') && isColorless(card.colors ?? card.cores)))) return false
  return parsed.filters.every(({ field, value }) => {
    if (field === 'cor' || field === 'color') return matchesColorFilter(card.colors ?? card.cores, value)
    if (field === 'custo' || field === 'cost') return fields[field] === value
    return fields[field] !== undefined && fields[field].includes(value)
  })
}

export function sortCards(cards, sort = 'number') {
  return [...cards].sort((a, b) => {
    if (sort === 'name') return cardName(a).localeCompare(cardName(b), 'pt-BR')
    if (sort === 'cost-asc') return (cardCost(a) ?? Infinity) - (cardCost(b) ?? Infinity)
    if (sort === 'cost-desc') return (cardCost(b) ?? -Infinity) - (cardCost(a) ?? -Infinity)
    return cardId(a).localeCompare(cardId(b), 'pt-BR', { numeric: true })
  })
}

export function filterCards(cards, filters = {}) {
  return sortCards(cards.filter(card => {
    const { type, subtype } = cardType(card)
    const cost = cardCost(card)
    if (filters.query && !matchesSearch(card, filters.query)) return false
    if (filters.type && type !== filters.type) return false
    if (filters.subtype && !normalize(subtype).includes(normalize(filters.subtype))) return false
    if (filters.rarity && (card.rarity ?? card.raridade) !== filters.rarity) return false
    if (filters.colors?.length && !filters.colors.some(color => matchesColorFilter(card.colors ?? card.cores, color))) return false
    if (filters.min !== null && filters.min !== undefined && (cost === null || cost < filters.min)) return false
    if (filters.max !== null && filters.max !== undefined && (cost === null || cost > filters.max)) return false
    return true
  }), filters.sort)
}
