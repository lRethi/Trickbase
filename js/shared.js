import { cardId, cardName, cardType, cardCost, cardColors, cardKeywords, cardImage, formatCardNumber, escapeHtml, colorMap, colorLabels } from './data.js'

export function setupSharedUI() {
  document.querySelectorAll('.brand-logo').forEach(image => {
    image.addEventListener('error', () => {
      image.hidden = true
      const fallback = image.parentElement.querySelector('.brand-fallback')
      if (fallback) fallback.style.display = 'inline'
    }, { once: true })
  })
  const menuButton = document.querySelector('.mobile-menu-button')
  const navigation = document.querySelector('.site-navigation')
  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const open = navigation.classList.toggle('open')
      menuButton.setAttribute('aria-expanded', String(open))
    })
  }
}

export function toast(message) {
  const element = document.querySelector('.toast')
  if (!element) return
  element.textContent = message
  element.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => element.classList.remove('show'), 2500)
}

export function colorsMarkup(card) {
  return cardColors(card).map(color => `<i title="${escapeHtml(colorLabels[color] ?? color)}" style="background:${colorMap[color] || '#aaa'}"></i>`).join('')
}

export function cardTileMarkup(card) {
  const { type, subtype } = cardType(card)
  const cost = cardCost(card)
  return `<article class="card-tile" data-open-card="${escapeHtml(cardId(card))}" tabindex="0" role="button" aria-label="Ver ${escapeHtml(cardName(card))}">
    <div class="card-tile-art"><img loading="lazy" src="${escapeHtml(cardImage(card))}" alt="${escapeHtml(cardName(card))}" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"><span class="card-tile-cost">${cost === null ? '—' : cost}</span></div>
    <div class="card-tile-copy"><h3 class="card-tile-name">${escapeHtml(cardName(card))}</h3><div class="card-tile-meta"><span>${escapeHtml(type)}${subtype ? ` · ${escapeHtml(subtype)}` : ''}</span><span class="card-tile-colors">${colorsMarkup(card)}</span></div></div>
  </article>`
}

export function openCardDialog(card, actions = {}) {
  const modal = document.querySelector('#card-modal')
  if (!modal || !card) return
  const { type, subtype } = cardType(card)
  const image = modal.querySelector('#modal-image')
  image.src = cardImage(card)
  image.alt = cardName(card)
  image.onerror = () => {
    image.onerror = null
    image.src = 'assets/images/card-back.webp'
  }
  modal.querySelector('#modal-id').textContent = `${formatCardNumber(card)} · ${cardId(card)}`
  modal.querySelector('#modal-title').textContent = cardName(card)
  modal.querySelector('#modal-tags').innerHTML = [type, subtype, card.rarity ?? card.raridade, ...cardColors(card).map(color => colorLabels[color] ?? color)].filter(Boolean).map(value => `<span class="dialog-tag">${escapeHtml(value)}</span>`).join('')
  modal.querySelector('#modal-text').textContent = card.text ?? card.texto ?? 'PLACEHOLDER'
  const stats = [`Custo: ${cardCost(card) ?? '—'}`]
  if (card.poder !== null && card.poder !== undefined && card.poder !== '') stats.push(`Poder: ${card.poder}`)
  if (card.vida !== null && card.vida !== undefined && card.vida !== '') stats.push(`Vida: ${card.vida}`)
  modal.querySelector('#modal-stats').innerHTML = stats.map(value => `<span class="dialog-stat">${escapeHtml(value)}</span>`).join('')
  modal.querySelector('#modal-keywords').innerHTML = cardKeywords(card).map(value => `<span class="dialog-keyword">${escapeHtml(value)}</span>`).join('')
  const buildLink = modal.querySelector('#modal-build')
  const addButton = modal.querySelector('#modal-add')
  const heroButton = modal.querySelector('#modal-hero')
  if (buildLink) buildLink.href = `deckbuilder.html?card=${encodeURIComponent(cardId(card))}`
  if (addButton) addButton.onclick = () => actions.add?.(card)
  if (heroButton) { heroButton.hidden = typeof actions.hero !== 'function'; heroButton.onclick = () => actions.hero?.(card) }
  modal.hidden = false
  document.body.classList.add('modal-open')
  modal.querySelector('.dialog-close')?.focus()
}

export function closeCardDialog() {
  const modal = document.querySelector('#card-modal')
  if (modal) modal.hidden = true
  document.body.classList.remove('modal-open')
}

export function bindDialogClose() {
  const modal = document.querySelector('#card-modal')
  modal?.querySelector('#modal-close')?.addEventListener('click', closeCardDialog)
  modal?.addEventListener('click', event => {
    if (event.target === modal) closeCardDialog()
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeCardDialog()
  })
}

export function bindSlashSearch(selector, focusCallback) {
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
    event.preventDefault()
    focusCallback?.()
    document.querySelector(selector)?.focus()
  })
}

export function cardListEntryMarkup(card, quantity) {
  const { type, subtype } = cardType(card)
  return `<div class="deck-entry"><span class="deck-quantity">${quantity}×</span><div class="deck-entry-info"><div class="deck-entry-name">${escapeHtml(cardName(card))}</div><div class="deck-entry-type">${escapeHtml(type)}${subtype ? ` · ${escapeHtml(subtype)}` : ''}</div></div><div class="deck-entry-actions"><button class="qty-button" data-remove="${escapeHtml(cardId(card))}" aria-label="Remover uma cópia de ${escapeHtml(cardName(card))}">−</button><button class="qty-button" data-add="${escapeHtml(cardId(card))}" aria-label="Adicionar uma cópia de ${escapeHtml(cardName(card))}">+</button></div></div>`
}
