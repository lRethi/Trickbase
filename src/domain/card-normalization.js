import { CARD_COLORS, MAIN_CARD_TYPES } from "./constants.js"

export function normalizeCard(raw, collectionId) {
  if (!raw || typeof raw !== "object") throw new Error("Registro de carta inválido.")
  const rawType = typeof raw.type === "string" ? raw.type : ""
  const separator = rawType.indexOf(" - ")
  const mainType = separator >= 0 ? rawType.slice(0, separator).trim() : rawType.trim()
  const subtype = separator >= 0 ? rawType.slice(separator + 3).trim() || null : null

  if (!MAIN_CARD_TYPES.includes(mainType)) {
    throw new Error(`Tipo inválido na carta ${raw.id ?? "sem ID"}: ${raw.type}`)
  }

  if (!Array.isArray(raw.colors)) throw new Error(`Lista de cores inválida na carta ${raw.id}.`)
  const invalidColors = raw.colors.filter(color => !CARD_COLORS.includes(color))
  if (invalidColors.length > 0) {
    throw new Error(`Cores inválidas na carta ${raw.id}: ${invalidColors.join(", ")}`)
  }

  if (!Array.isArray(raw.keywords)) throw new Error(`Lista de palavras-chave inválida na carta ${raw.id}.`)

  return {
    id: raw.id,
    collectionId,
    name: String(raw.name ?? "").trim(),
    type: mainType,
    subtype,
    rarity: raw.rarity,
    cost: raw.cost ?? null,
    poder: raw.poder ?? null,
    vida: raw.vida ?? null,
    colors: [...raw.colors],
    text: String(raw.text ?? ""),
    keywords: [...new Set(raw.keywords.map(keyword => String(keyword).trim().toLocaleLowerCase("pt-BR")).filter(Boolean))],
    image: String(raw.image ?? "")
  }
}

export function normalizeCollection(collection) {
  if (!collection || typeof collection.id !== "string" || !Array.isArray(collection.cards)) {
    throw new Error("Estrutura de coleção inválida.")
  }
  return collection.cards.map(card => normalizeCard(card, collection.id))
}
