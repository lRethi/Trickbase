import { loadGameData, filterCards, cardId, cardName, cardImage, cardType, escapeHtml } from './data.js'
import { setupSharedUI, toast } from './shared.js'

setupSharedUI()

const STORAGE_KEY = 'trick.tiermaker.v1'
const DEFAULT_TIERS = [
  { id: 'tier-s', name: 'S', color: '#e6e936', cards: [] },
  { id: 'tier-a', name: 'A', color: '#71d96d', cards: [] },
  { id: 'tier-b', name: 'B', color: '#25b8e9', cards: [] },
  { id: 'tier-c', name: 'C', color: '#a25ce9', cards: [] },
  { id: 'tier-d', name: 'D', color: '#f0445f', cards: [] }
]

const $ = selector => document.querySelector(selector)
const state = { cards: [], tiers: structuredClone(DEFAULT_TIERS), selectedCardId: null }
const cardById = new Map()

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `tier-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tiers: state.tiers }))
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!Array.isArray(saved?.tiers)) return
    const validIds = new Set(state.cards.map(cardId))
    const seen = new Set()
    state.tiers = saved.tiers.filter(tier => tier && typeof tier.id === 'string').map(tier => ({
      id: tier.id,
      name: String(tier.name ?? 'PLACEHOLDER').slice(0, 24),
      color: /^#[0-9a-f]{6}$/i.test(tier.color) ? tier.color : '#817a72',
      cards: Array.isArray(tier.cards) ? tier.cards.filter(id => {
        if (!validIds.has(id) || seen.has(id)) return false
        seen.add(id)
        return true
      }) : []
    }))
    if (!state.tiers.length) state.tiers = structuredClone(DEFAULT_TIERS)
  } catch {
    state.tiers = structuredClone(DEFAULT_TIERS)
  }
}

function placedIds() {
  return new Set(state.tiers.flatMap(tier => tier.cards))
}

function renderTierRows() {
  $('#tier-board').innerHTML = state.tiers.map((tier, index) => `
    <section class="tier-row" data-tier-row="${escapeHtml(tier.id)}" style="--tier-color:${escapeHtml(tier.color)}">
      <div class="tier-label-panel">
        <input class="tier-name-input" data-tier-name="${escapeHtml(tier.id)}" value="${escapeHtml(tier.name)}" maxlength="24" aria-label="Nome do tier ${index + 1}">
        <label class="tier-color-control" title="Cor do tier"><span>Cor</span><input type="color" data-tier-color="${escapeHtml(tier.id)}" value="${escapeHtml(tier.color)}" aria-label="Cor do tier ${index + 1}"></label>
        <div class="tier-order-controls"><button type="button" class="tier-icon-button" data-tier-up="${escapeHtml(tier.id)}" aria-label="Mover tier para cima" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="tier-icon-button" data-tier-down="${escapeHtml(tier.id)}" aria-label="Mover tier para baixo" ${index === state.tiers.length - 1 ? 'disabled' : ''}>↓</button></div>
        <button type="button" class="tier-remove" data-tier-remove="${escapeHtml(tier.id)}">Remover</button>
      </div>
      <div class="tier-dropzone" data-drop-tier="${escapeHtml(tier.id)}" aria-label="Solte cartas no tier ${escapeHtml(tier.name)}">
        ${tier.cards.map(id => tierCardMarkup(cardById.get(id), tier.id)).join('')}
        ${tier.cards.length ? '' : '<span class="tier-drop-hint">Arraste cartas para cá</span>'}
      </div>
    </section>
  `).join('')
  $('#tier-target').innerHTML = state.tiers.map(tier => `<option value="${escapeHtml(tier.id)}">${escapeHtml(tier.name)}</option>`).join('')
}

function tierCardMarkup(card, tierId) {
  if (!card) return ''
  return `<button type="button" class="tier-card" draggable="true" data-tier-card="${escapeHtml(cardId(card))}" data-current-tier="${escapeHtml(tierId)}" title="${escapeHtml(cardName(card))}"><img loading="lazy" draggable="false" src="${escapeHtml(cardImage(card))}" alt="${escapeHtml(cardName(card))}" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"><span>${escapeHtml(cardName(card))}</span></button>`
}

function renderPool() {
  const query = $('#tier-search').value
  const type = $('#tier-type').value
  const placed = placedIds()
  const available = state.cards.filter(card => !placed.has(cardId(card)))
  const results = filterCards(available, { query, type, sort: 'name', min: null, max: null })
  $('#tier-pool').innerHTML = results.map(card => `<button type="button" class="tier-pool-card ${state.selectedCardId === cardId(card) ? 'selected' : ''}" draggable="true" data-pool-card="${escapeHtml(cardId(card))}" title="${escapeHtml(cardName(card))}"><img loading="lazy" draggable="false" src="${escapeHtml(cardImage(card))}" alt="${escapeHtml(cardName(card))}" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"><span>${escapeHtml(cardName(card))}</span></button>`).join('')
  $('#tier-pool-count').textContent = available.length.toLocaleString('pt-BR')
  $('#tier-empty').hidden = results.length > 0
  $('#tier-selected-label').textContent = state.selectedCardId ? `Selecionada: ${cardName(cardById.get(state.selectedCardId))}` : 'Selecione uma carta para adicionar sem arrastar.'
  $('#tier-place-selected').disabled = !state.selectedCardId || !state.tiers.length
  $('#tier-return-selected').disabled = !state.selectedCardId || !placed.has(state.selectedCardId)
  $('#tier-summary').textContent = `${state.cards.length.toLocaleString('pt-BR')} cartas · ${state.tiers.reduce((sum, tier) => sum + tier.cards.length, 0)} classificadas`
}

function render() {
  renderTierRows()
  renderPool()
}

function moveCard(cardIdValue, targetTierId, beforeCardId = null) {
  if (!cardById.has(cardIdValue)) return
  state.tiers.forEach(tier => { tier.cards = tier.cards.filter(id => id !== cardIdValue) })
  if (targetTierId) {
    const target = state.tiers.find(tier => tier.id === targetTierId)
    if (!target) return
    const beforeIndex = beforeCardId ? target.cards.indexOf(beforeCardId) : -1
    if (beforeIndex >= 0) target.cards.splice(beforeIndex, 0, cardIdValue)
    else target.cards.push(cardIdValue)
  }
  state.selectedCardId = null
  saveState()
  render()
}

function reorderTier(tierId, direction) {
  const index = state.tiers.findIndex(tier => tier.id === tierId)
  const next = index + direction
  if (index < 0 || next < 0 || next >= state.tiers.length) return
  const [tier] = state.tiers.splice(index, 1)
  state.tiers.splice(next, 0, tier)
  saveState()
  render()
}

function handleDragStart(event) {
  const cardElement = event.target.closest('[data-pool-card], [data-tier-card]')
  if (!cardElement) return
  const id = cardElement.dataset.poolCard || cardElement.dataset.tierCard
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', id)
  cardElement.classList.add('dragging')
}

function handleDrop(event, tierId, beforeCardId = null) {
  event.preventDefault()
  const id = event.dataTransfer.getData('text/plain')
  if (!id || id === beforeCardId) return
  moveCard(id, tierId, beforeCardId)
}

function bindEvents() {
  $('#tier-search').addEventListener('input', renderPool)
  $('#tier-type').addEventListener('change', renderPool)
  $('#tier-add').addEventListener('click', () => {
    state.tiers.push({ id: createId(), name: 'Novo tier', color: '#817a72', cards: [] })
    saveState()
    render()
    $('#tier-board .tier-row:last-child .tier-name-input')?.focus()
  })
  $('#tier-clear').addEventListener('click', () => {
    if (!confirm('Limpar a classificação e restaurar os tiers iniciais?')) return
    state.tiers = structuredClone(DEFAULT_TIERS)
    state.selectedCardId = null
    saveState()
    render()
    toast('Tierlist reiniciada.')
  })
  $('#tier-place-selected').addEventListener('click', () => {
    if (!state.selectedCardId) return
    moveCard(state.selectedCardId, $('#tier-target').value)
  })
  $('#tier-return-selected').addEventListener('click', () => {
    if (!state.selectedCardId) return
    moveCard(state.selectedCardId, null)
  })
  $('#tier-board').addEventListener('input', event => {
    const nameInput = event.target.closest('[data-tier-name]')
    const colorInput = event.target.closest('[data-tier-color]')
    if (nameInput) {
      const tier = state.tiers.find(item => item.id === nameInput.dataset.tierName)
      if (tier) { tier.name = nameInput.value; saveState(); $('#tier-target').querySelector(`option[value="${CSS.escape(tier.id)}"]`).textContent = tier.name || 'PLACEHOLDER' }
    }
    if (colorInput) {
      const tier = state.tiers.find(item => item.id === colorInput.dataset.tierColor)
      if (tier) { tier.color = colorInput.value; colorInput.closest('.tier-row').style.setProperty('--tier-color', tier.color); saveState() }
    }
  })
  $('#tier-board').addEventListener('click', event => {
    const selectedTierCard = event.target.closest('[data-tier-card]')
    if (selectedTierCard) {
      state.selectedCardId = selectedTierCard.dataset.tierCard
      renderPool()
      return
    }
    const up = event.target.closest('[data-tier-up]')
    const down = event.target.closest('[data-tier-down]')
    const remove = event.target.closest('[data-tier-remove]')
    if (up) reorderTier(up.dataset.tierUp, -1)
    if (down) reorderTier(down.dataset.tierDown, 1)
    if (remove) {
      const tier = state.tiers.find(item => item.id === remove.dataset.tierRemove)
      if (!tier) return
      if (tier.cards.length && !confirm('As cartas deste tier voltarão para as cartas disponíveis. Continuar?')) return
      state.tiers = state.tiers.filter(item => item.id !== tier.id)
      if (!state.tiers.length) state.tiers.push({ id: createId(), name: 'Novo tier', color: '#817a72', cards: [] })
      saveState()
      render()
    }
  })
  $('#tier-pool').addEventListener('click', event => {
    const card = event.target.closest('[data-pool-card]')
    if (!card) return
    state.selectedCardId = card.dataset.poolCard
    renderPool()
  })
  $('#tier-pool').addEventListener('dragstart', handleDragStart)
  $('#tier-board').addEventListener('dragstart', handleDragStart)
  document.addEventListener('dragend', () => document.querySelectorAll('.dragging').forEach(item => item.classList.remove('dragging')))
  $('#tier-board').addEventListener('dragover', event => {
    const zone = event.target.closest('[data-drop-tier]')
    if (!zone) return
    event.preventDefault()
    zone.classList.add('drag-over')
  })
  $('#tier-board').addEventListener('dragleave', event => {
    const zone = event.target.closest('[data-drop-tier]')
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('drag-over')
  })
  $('#tier-board').addEventListener('drop', event => {
    const targetCard = event.target.closest('[data-tier-card]')
    const zone = event.target.closest('[data-drop-tier]')
    if (!zone) return
    zone.classList.remove('drag-over')
    handleDrop(event, zone.dataset.dropTier, targetCard?.dataset.tierCard ?? null)
  })
  $('#tier-pool').addEventListener('dragover', event => event.preventDefault())
  $('#tier-pool').addEventListener('drop', event => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain')
    if (id) moveCard(id, null)
  })
  $('#tier-export').addEventListener('click', exportTierlist)
}

function roundRect(context, x, y, width, height, radius, color) {
  context.fillStyle = color
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fill()
}

function loadImage(src) {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      const fallback = new Image()
      fallback.onload = () => resolve(fallback)
      fallback.onerror = () => resolve(null)
      fallback.src = 'assets/images/card-back.webp'
    }
    image.src = src
  })
}

async function exportTierlist() {
  const width = 1800
  const labelWidth = 190
  const cardWidth = 112
  const cardHeight = 157
  const gap = 13
  const rowPadding = 16
  const cardsPerLine = Math.max(1, Math.floor((width - labelWidth - rowPadding * 2) / (cardWidth + gap)))
  const rowHeights = state.tiers.map(tier => Math.max(190, Math.ceil(tier.cards.length / cardsPerLine) * (cardHeight + gap) + rowPadding * 2))
  const height = 116 + rowHeights.reduce((sum, value) => sum + value + 10, 0) + 35
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = '#171615'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#f5f0e8'
  context.font = '600 46px Georgia'
  context.fillText('Trick · Tierlist', 42, 65)
  context.fillStyle = '#aaa39a'
  context.font = '18px Inter, sans-serif'
  context.fillText(new Date().toLocaleDateString('pt-BR'), 44, 91)
  let y = 116
  for (let index = 0; index < state.tiers.length; index++) {
    const tier = state.tiers[index]
    const rowHeight = rowHeights[index]
    roundRect(context, 30, y, width - 60, rowHeight, 17, '#211f1d')
    roundRect(context, 30, y, labelWidth, rowHeight, 14, tier.color)
    context.fillStyle = '#171615'
    context.font = '700 42px Inter, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(tier.name || 'PLACEHOLDER', 30 + labelWidth / 2, y + rowHeight / 2)
    context.textAlign = 'left'
    context.textBaseline = 'alphabetic'
    const images = await Promise.all(tier.cards.map(id => loadImage(cardImage(cardById.get(id)))))
    images.forEach((image, cardIndex) => {
      if (!image) return
      const column = cardIndex % cardsPerLine
      const line = Math.floor(cardIndex / cardsPerLine)
      const x = 30 + labelWidth + rowPadding + column * (cardWidth + gap)
      const cardY = y + rowPadding + line * (cardHeight + gap)
      context.save()
      roundRect(context, x, cardY, cardWidth, cardHeight, 7, '#302c28')
      context.beginPath()
      context.roundRect(x, cardY, cardWidth, cardHeight, 7)
      context.clip()
      context.drawImage(image, x, cardY, cardWidth, cardHeight)
      context.restore()
    })
    y += rowHeight + 10
  }
  canvas.toBlob(blob => {
    if (!blob) { toast('Não foi possível exportar a imagem.'); return }
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'trick-tierlist.png'
    anchor.click()
    URL.revokeObjectURL(url)
    toast('Tierlist exportada como imagem.')
  }, 'image/png')
}

async function init() {
  bindEvents()
  try {
    const data = await loadGameData()
    state.cards = data.cards
    state.cards.forEach(card => cardById.set(cardId(card), card))
    restoreState()
    render()
  } catch (error) {
    $('#tier-error').hidden = false
    $('#tier-pool').hidden = true
    toast(error.message || 'Falha ao carregar as coleções.')
  }
}

init()
