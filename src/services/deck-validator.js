export function validateDeck(deck, cards, rules) {
  const errors = []
  const warnings = []
  let cardCount = 0
  const seen = new Set()

  if (!deck || !Array.isArray(deck.cards)) {
    return {
      valid: false,
      errors: [{ code: "INVALID_DECK", message: "Estrutura de deck inválida." }],
      warnings,
      cardCount
    }
  }

  if (rules.heroRequired && !deck.heroCardId) {
    errors.push({ code: "MISSING_HERO", message: "O deck não possui um herói selecionado." })
  }

  if (deck.heroCardId) {
    const hero = cards.get(deck.heroCardId)
    if (!hero) errors.push({ code: "UNKNOWN_HERO", message: `Herói não encontrado: ${deck.heroCardId}.`, cardId: deck.heroCardId })
    else if (rules.heroMustBeCreature && hero.type !== "Criatura") errors.push({ code: "INVALID_HERO_TYPE", message: "O herói selecionado não é uma Criatura.", cardId: hero.id })
  }

  for (const entry of deck.cards) {
    if (!entry || typeof entry.cardId !== "string") {
      errors.push({ code: "INVALID_DECK_ENTRY", message: "Entrada de carta inválida." })
      continue
    }

    if (seen.has(entry.cardId)) {
      errors.push({ code: "DUPLICATE_DECK_ENTRY", message: `A carta ${entry.cardId} aparece em mais de uma entrada.`, cardId: entry.cardId })
      continue
    }
    seen.add(entry.cardId)

    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
      errors.push({ code: "INVALID_QUANTITY", message: `Quantidade inválida para ${entry.cardId}.`, cardId: entry.cardId })
      continue
    }

    const card = cards.get(entry.cardId)
    if (!card) {
      errors.push({ code: "UNKNOWN_CARD", message: `Carta não encontrada: ${entry.cardId}.`, cardId: entry.cardId })
      continue
    }

    cardCount += entry.quantity
    if (entry.quantity > rules.maximumCopiesPerCard) {
      errors.push({ code: "COPY_LIMIT_EXCEEDED", message: `${card.name}: ${entry.quantity} cópias; o máximo é ${rules.maximumCopiesPerCard}.`, cardId: card.id })
    }
  }

  const countedCards = cardCount + (rules.deckSize.heroCountsTowardSize && deck.heroCardId ? 1 : 0)
  if (rules.deckSize.minimum !== null && countedCards < rules.deckSize.minimum) {
    errors.push({ code: "DECK_TOO_SMALL", message: `O deck possui ${countedCards} cartas; o mínimo é ${rules.deckSize.minimum}.` })
  }
  if (rules.deckSize.maximum !== null && countedCards > rules.deckSize.maximum) {
    errors.push({ code: "DECK_TOO_LARGE", message: `O deck possui ${countedCards} cartas; o máximo é ${rules.deckSize.maximum}.` })
  }

  if (rules.deckSize.minimum === null || rules.deckSize.maximum === null) {
    warnings.push({ code: "DECK_SIZE_UNCONFIGURED", message: "Os limites de tamanho do deck ainda não foram configurados." })
  }

  return { valid: errors.length === 0, errors, warnings, cardCount: countedCards }
}
