export function createDeck(name = "Novo deck") {
  return { formatVersion: 1, name, heroCardId: null, cards: [] }
}

export function setHero(deck, heroCardId) {
  return { ...deck, heroCardId }
}

export function addCard(deck, cardId, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("A quantidade adicionada deve ser um inteiro positivo.")
  const existing = deck.cards.find(entry => entry.cardId === cardId)
  const cards = existing
    ? deck.cards.map(entry => entry.cardId === cardId ? { ...entry, quantity: entry.quantity + quantity } : entry)
    : [...deck.cards, { cardId, quantity }]
  return { ...deck, cards }
}

export function removeCard(deck, cardId, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("A quantidade removida deve ser um inteiro positivo.")
  const cards = deck.cards.flatMap(entry => {
    if (entry.cardId !== cardId) return [entry]
    const remaining = entry.quantity - quantity
    return remaining > 0 ? [{ ...entry, quantity: remaining }] : []
  })
  return { ...deck, cards }
}
