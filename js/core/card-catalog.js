import { COLOR_DEFINITIONS, canonicalColor, canonicalColors, fold, matchesColorFilter } from './colors.js'
import { normalizeHeroCollection } from './heroes.js'

export function normalizeCardType(card) {
  const raw = String(card?.type ?? card?.tipo ?? 'Desconhecido')
  const parts = raw.split(/\s[-–—]\s/)
  return {
    type: parts[0],
    subtype: parts.slice(1).join(' - ') || card?.subtype || card?.subtipo || ''
  }
}

export function normalizeCardCollection(collection) {
  const cards = Array.isArray(collection) ? collection : collection?.cards
  if (!Array.isArray(cards)) throw new Error('A coleção não contém uma lista de cartas.')
  const collectionId = Array.isArray(collection) ? 'unknown' : String(collection.id ?? 'unknown')
  return cards.map((card, index) => ({
    ...card,
    id: String(card.id ?? card.numero ?? `${collectionId}-${String(index + 1).padStart(3, '0')}`),
    collectionId: String(card.collectionId ?? collectionId),
    type: normalizeCardType(card).type,
    subtype: normalizeCardType(card).subtype,
    colors: canonicalColors(card.colors ?? card.cores, { includeColorless: true }),
    keywords: Array.isArray(card.keywords) ? card.keywords : Array.isArray(card.palavrasChave) ? card.palavrasChave : [],
    cost: normalizeCost(card.cost ?? card.custo)
  }))
}

function normalizeCost(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export class CardCatalog {
  constructor(collections = [], heroCollections = []) {
    this.cards = collections.flatMap(normalizeCardCollection)
    this.heroes = heroCollections.flatMap(normalizeHeroCollection)
    this.byId = new Map()
    this.heroById = new Map()
    for (const card of this.cards) {
      if (this.byId.has(card.id)) throw new Error(`ID de carta duplicado: ${card.id}`)
      this.byId.set(card.id, card)
    }
    for (const hero of this.heroes) {
      if (this.heroById.has(hero.id)) throw new Error(`ID de Herói duplicado: ${hero.id}`)
      this.heroById.set(hero.id, hero)
    }
  }

  getAll() {
    return [...this.cards]
  }

  getById(id) {
    return this.byId.get(String(id))
  }

  getByCollection(collectionId) {
    return this.cards.filter(card => card.collectionId === collectionId)
  }

  getHeroes() {
    return [...this.heroes]
  }

  getHeroById(id) {
    return this.heroById.get(String(id))
  }

  searchHeroes(filters = {}) {
    const query = fold(filters.query)
    const colors = Array.isArray(filters.colors) ? filters.colors : []
    return this.heroes.filter(hero => {
      if (colors.length && !colors.some(color => hero.colors.includes(canonicalColor(color)))) return false
      if (!query) return true
      const aliases = hero.colors.flatMap(color => COLOR_DEFINITIONS.find(definition => definition.id === color)?.aliases ?? [color])
      const searchable = [hero.id, hero.name, ...hero.colors, ...aliases, ...hero.forms.flatMap(form => [form.name, form.abilityText, form.abilityCost])].join(' ')
      return fold(searchable).includes(query)
    })
  }

  search(filters = {}) {
    const query = fold(filters.query)
    const name = fold(filters.name)
    const text = fold(filters.text)
    const subtype = fold(filters.subtype)
    const keyword = fold(filters.keyword)
    return this.cards.filter(card => {
      if (filters.collectionId && card.collectionId !== filters.collectionId) return false
      if (filters.type && card.type !== filters.type) return false
      if (filters.rarity && card.rarity !== filters.rarity) return false
      if (name && !fold(card.name).includes(name)) return false
      if (subtype && !fold(card.subtype).includes(subtype)) return false
      if (text && !fold(card.text).includes(text)) return false
      if (keyword && !card.keywords.some(value => fold(value).includes(keyword))) return false
      if (filters.costMin !== undefined && (card.cost === null || card.cost < filters.costMin)) return false
      if (filters.costMax !== undefined && (card.cost === null || card.cost > filters.costMax)) return false
      if (filters.colors?.length && !filters.colors.some(color => matchesColorFilter(card.colors, color))) return false
      if (query) {
        const searchable = [card.id, card.name, card.type, card.subtype, card.text, card.keywords.join(' '), card.rarity, ...card.colors].join(' ')
        const queryWords = query.split(/\s+/).filter(Boolean)
        if (!queryWords.every(term => fold(searchable).includes(term) || matchesColorFilter(card.colors, term))) return false
        if (queryWords.some(term => ['mente', 'azul', 'calma', 'verde', 'ordem', 'amarelo', 'corpo', 'laranja', 'furia', 'vermelho', 'caos', 'roxo'].includes(term))) {
          const colorTokens = queryWords.filter(term => ['mente', 'azul', 'calma', 'verde', 'ordem', 'amarelo', 'corpo', 'laranja', 'furia', 'vermelho', 'caos', 'roxo'].includes(term))
          if (!colorTokens.some(term => matchesColorFilter(card.colors, term))) return false
        }
      }
      return true
    })
  }
}
