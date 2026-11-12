import { loadGameData, filterCards, cardId, cardName, cardImage, cardType, escapeHtml } from './data.js'
import { setupSharedUI, toast } from './shared.js'

setupSharedUI()

const STORAGE_KEY = 'trick.playground.v1'
const $ = selector => document.querySelector(selector)
const state = { cards: [], items: [], dragging: null, nextZ: 1 }
const cardById = new Map()

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `play-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, nextZ: state.nextZ }))
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    const valid = new Set(state.cards.map(cardId))
    if (!Array.isArray(saved?.items)) return
    state.items = saved.items.filter(item => item && valid.has(item.cardId)).map(item => ({
      instanceId: String(item.instanceId || createId()),
      cardId: item.cardId,
      x: Number.isFinite(item.x) ? Math.min(95, Math.max(0, item.x)) : 40,
      y: Number.isFinite(item.y) ? Math.min(95, Math.max(0, item.y)) : 35,
      z: Number.isFinite(item.z) ? item.z : 1
    }))
    state.nextZ = Math.max(Number(saved.nextZ) || 1, ...state.items.map(item => item.z + 1))
  } catch {
    state.items = []
    state.nextZ = 1
  }
}

function renderCatalog() {
  const results = filterCards(state.cards, {
    query: $('#playground-search').value,
    type: $('#playground-type').value,
    sort: $('#playground-sort').value,
    min: null,
    max: null
  })
  $('#playground-catalog').innerHTML = results.map(card => {
    const { type, subtype } = cardType(card)
    return `<article class="playground-source-card"><img loading="lazy" src="${escapeHtml(cardImage(card))}" alt="${escapeHtml(cardName(card))}" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"><div class="playground-source-copy"><strong>${escapeHtml(cardName(card))}</strong><span>${escapeHtml(type)}${subtype ? ` · ${escapeHtml(subtype)}` : ''}</span></div><button type="button" class="playground-add" data-add-card="${escapeHtml(cardId(card))}" aria-label="Adicionar ${escapeHtml(cardName(card))} à mesa">+</button></article>`
  }).join('')
  $('#playground-results-count').textContent = results.length.toLocaleString('pt-BR')
  $('#playground-no-results').hidden = results.length > 0
}

function renderBoard() {
  $('#playground-board').querySelectorAll('.play-card').forEach(element => element.remove())
  $('#playground-empty').hidden = state.items.length > 0
  $('#playground-count').textContent = state.items.length.toLocaleString('pt-BR')
  state.items.forEach(item => {
    const card = cardById.get(item.cardId)
    if (!card) return
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'play-card'
    element.dataset.instanceId = item.instanceId
    element.style.left = `${item.x}%`
    element.style.top = `${item.y}%`
    element.style.zIndex = String(item.z)
    element.setAttribute('aria-label', `${cardName(card)}. Arraste para mover; solte fora da mesa para remover.`)
    element.innerHTML = `<img draggable="false" src="${escapeHtml(cardImage(card))}" alt="${escapeHtml(cardName(card))}" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"><span>${escapeHtml(cardName(card))}</span>`
    $('#playground-board').append(element)
  })
}

function addCard(cardIdValue) {
  if (!cardById.has(cardIdValue)) return
  const offset = state.items.length % 7
  state.items.push({
    instanceId: createId(),
    cardId: cardIdValue,
    x: Math.min(78, 8 + offset * 3.2),
    y: Math.min(72, 8 + offset * 3.5),
    z: state.nextZ++
  })
  saveState()
  renderBoard()
}

function getItem(instanceId) {
  return state.items.find(item => item.instanceId === instanceId)
}

function beginDrag(event) {
  const element = event.target.closest('.play-card')
  if (!element || event.button !== 0) return
  const rect = element.getBoundingClientRect()
  const item = getItem(element.dataset.instanceId)
  if (!item) return
  event.preventDefault()
  item.z = state.nextZ++
  state.dragging = {
    instanceId: item.instanceId,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    outside: false
  }
  element.classList.add('dragging')
  element.setPointerCapture(event.pointerId)
  element.style.zIndex = String(item.z)
}

function moveDrag(event) {
  const drag = state.dragging
  if (!drag || drag.pointerId !== event.pointerId) return
  const boardRect = $('#playground-board').getBoundingClientRect()
  const element = $('#playground-board').querySelector(`[data-instance-id="${CSS.escape(drag.instanceId)}"]`)
  const item = getItem(drag.instanceId)
  if (!element || !item) return
  const elementWidth = element.offsetWidth
  const elementHeight = element.offsetHeight
  const left = event.clientX - boardRect.left - drag.offsetX
  const top = event.clientY - boardRect.top - drag.offsetY
  drag.outside = event.clientX < boardRect.left || event.clientX > boardRect.right || event.clientY < boardRect.top || event.clientY > boardRect.bottom
  const clampedLeft = Math.min(boardRect.width - elementWidth, Math.max(0, left))
  const clampedTop = Math.min(boardRect.height - elementHeight, Math.max(0, top))
  item.x = boardRect.width ? clampedLeft / boardRect.width * 100 : item.x
  item.y = boardRect.height ? clampedTop / boardRect.height * 100 : item.y
  element.style.left = `${item.x}%`
  element.style.top = `${item.y}%`
  element.classList.toggle('outside-drop', drag.outside)
}

function finishDrag(event) {
  const drag = state.dragging
  if (!drag || (event && drag.pointerId !== event.pointerId)) return
  const itemIndex = state.items.findIndex(item => item.instanceId === drag.instanceId)
  const element = $('#playground-board').querySelector(`[data-instance-id="${CSS.escape(drag.instanceId)}"]`)
  if (drag.outside && itemIndex >= 0) {
    state.items.splice(itemIndex, 1)
    toast('Carta removida da mesa.')
  }
  element?.classList.remove('dragging', 'outside-drop')
  state.dragging = null
  saveState()
  renderBoard()
}

function bindEvents() {
  ;['playground-search', 'playground-type', 'playground-sort'].forEach(id => $(`#${id}`).addEventListener('input', renderCatalog))
  $('#playground-catalog').addEventListener('click', event => {
    const button = event.target.closest('[data-add-card]')
    if (button) addCard(button.dataset.addCard)
  })
  $('#playground-board').addEventListener('pointerdown', beginDrag)
  $('#playground-board').addEventListener('pointermove', moveDrag)
  $('#playground-board').addEventListener('pointerup', finishDrag)
  $('#playground-board').addEventListener('pointercancel', finishDrag)
  $('#playground-clear').addEventListener('click', () => {
    if (!state.items.length) return
    if (!confirm('Remover todas as cartas da mesa?')) return
    state.items = []
    saveState()
    renderBoard()
    toast('Mesa limpa.')
  })
}

async function init() {
  bindEvents()
  try {
    const data = await loadGameData()
    state.cards = data.cards
    state.cards.forEach(card => cardById.set(cardId(card), card))
    restoreState()
    renderCatalog()
    renderBoard()
  } catch (error) {
    $('#playground-error').hidden = false
    $('#playground-catalog').hidden = true
    toast(error.message || 'Falha ao carregar as coleções.')
  }
}

init()
