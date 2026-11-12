import { normalizeCollection } from "../domain/card-normalization.js"

function fold(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
}

export class CardCatalog {
  constructor(collections) {
    this.cards = collections.flatMap(normalizeCollection)
    this.byId = new Map()

    for (const card of this.cards) {
      if (this.byId.has(card.id)) throw new Error(`ID de carta duplicado: ${card.id}`)
      this.byId.set(card.id, card)
    }
  }

  getAll() {
    return [...this.cards]
  }

  getById(id) {
    return this.byId.get(id)
  }

  getByCollection(collectionId) {
    return this.cards.filter(card => card.collectionId === collectionId)
  }

  search(filters = {}) {
    const query = filters.query ? fold(filters.query) : null
    const name = filters.name ? fold(filters.name) : null
    const text = filters.text ? fold(filters.text) : null
    const subtype = filters.subtype ? fold(filters.subtype) : null
    const keyword = filters.keyword ? fold(filters.keyword) : null

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
      if (filters.colors?.length && !filters.colors.some(color => card.colors.includes(color))) return false

      if (query) {
        const searchable = [card.name, card.type, card.subtype ?? "", card.text, card.keywords.join(" "), card.rarity].join(" ")
        if (!fold(searchable).includes(query)) return false
      }

      return true
    })
  }
}
