const colors = ["azul", "verde", "amarelo", "laranja", "vermelho", "roxo", "incolor"]

export function analyzeDeck(deck, cards) {
  const manaCurve = {}
  const colorCounts = Object.fromEntries(colors.map(color => [color, 0]))
  let totalCards = 0
  let unknownCostCards = 0
  let colorlessCards = 0
  let cardsWithoutColor = 0
  let creatures = 0
  let actions = 0
  let tokens = 0

  for (const entry of deck.cards) {
    const card = cards.get(entry.cardId)
    if (!card || !Number.isInteger(entry.quantity) || entry.quantity < 1) continue
    totalCards += entry.quantity

    if (card.cost === null) unknownCostCards += entry.quantity
    else {
      const bucket = card.cost >= 7 ? "7+" : String(card.cost)
      manaCurve[bucket] = (manaCurve[bucket] ?? 0) + entry.quantity
    }

    if (card.colors.length === 0) cardsWithoutColor += entry.quantity
    if (card.colors.includes("incolor")) colorlessCards += entry.quantity
    for (const color of card.colors) colorCounts[color] += entry.quantity

    if (card.type === "Criatura") creatures += entry.quantity
    if (card.type === "Ação") actions += entry.quantity
    if (card.type === "Ficha") tokens += entry.quantity
  }

  return { totalCards, manaCurve, unknownCostCards, colorCounts, colorlessCards, cardsWithoutColor, creatures, actions, tokens }
}
