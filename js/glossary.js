import { loadGameData, filterCards, cardId, cardName, cardType, cardCost, cardColors, cardKeywords, normalize, formatCardNumber, canonicalColorLabel } from './data.js'
import { setupSharedUI, toast, cardTileMarkup, openCardDialog, bindDialogClose, bindSlashSearch } from './shared.js'

setupSharedUI()
bindDialogClose()

const state = { cards: [], mode: 'grid' }
const $ = selector => document.querySelector(selector)
const $$ = selector => [...document.querySelectorAll(selector)]

function currentFilters() {
  return {
    query: $('#card-search').value,
    type: $('#filter-type').value,
    subtype: $('#filter-subtype').value,
    rarity: $('#filter-rarity').value,
    colors: $$('#color-filters input:checked').map(input => input.value),
    min: $('#cost-min').value === '' ? null : Number($('#cost-min').value),
    max: $('#cost-max').value === '' ? null : Number($('#cost-max').value),
    sort: $('#sort-select').value
  }
}

function renderChips(filters) {
  const chips = []
  if (filters.type) chips.push(filters.type)
  if (filters.subtype) chips.push(filters.subtype)
  if (filters.rarity) chips.push(filters.rarity)
  filters.colors.forEach(color => chips.push(color === 'incolor' ? 'Sem cor' : canonicalColorLabel(color)))
  if (filters.min !== null || filters.max !== null) chips.push(`Custo ${filters.min ?? 0}–${filters.max ?? '∞'}`)
  $('#active-filters').innerHTML = chips.map(chip => `<span class="filter-chip">${chip}</span>`).join('')
}

function render() {
  const filters = currentFilters()
  const cards = filterCards(state.cards, filters)
  $('#visible-count').textContent = cards.length.toLocaleString('pt-BR')
  $('#result-caption').textContent = cards.length === 1 ? 'carta encontrada' : 'cartas encontradas'
  $('#card-grid').classList.toggle('list-mode', state.mode === 'list')
  $('#card-grid').innerHTML = cards.map(cardTileMarkup).join('')
  $('#empty-state').hidden = cards.length > 0
  renderChips(filters)
}

function openCard(id) {
  const card = state.cards.find(item => cardId(item) === id)
  if (!card) return
  openCardDialog(card)
}

function clearFilters() {
  $('#card-search').value = ''
  $('#filter-type').value = ''
  $('#filter-subtype').value = ''
  $('#filter-rarity').value = ''
  $('#cost-min').value = ''
  $('#cost-max').value = ''
  $$('#color-filters input').forEach(input => input.checked = false)
  render()
}

function bindEvents() {
  ;['card-search', 'filter-type', 'filter-subtype', 'filter-rarity', 'cost-min', 'cost-max', 'sort-select'].forEach(id => $(`#${id}`).addEventListener('input', render))
  $('#color-filters').addEventListener('change', render)
  $('#clear-filters').addEventListener('click', clearFilters)
  $('#empty-clear').addEventListener('click', clearFilters)
  $$('.view-button').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.view
    $$('.view-button').forEach(item => item.classList.toggle('active', item === button))
    render()
  }))
  $('#card-grid').addEventListener('click', event => {
    const tile = event.target.closest('[data-open-card]')
    if (tile) openCard(tile.dataset.openCard)
  })
  $('#card-grid').addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return
    const tile = event.target.closest('[data-open-card]')
    if (!tile) return
    event.preventDefault()
    openCard(tile.dataset.openCard)
  })
  bindSlashSearch('#card-search')
}

async function init() {
  bindEvents()
  try {
    const data = await loadGameData()
    state.cards = data.cards
    $('#collection-total').hidden = false
    $('#collection-count').textContent = state.cards.length.toLocaleString('pt-BR')
    render()
  } catch (error) {
    $('#data-error').hidden = false
    $('#card-grid').hidden = true
    $('#visible-count').textContent = '—'
    $('#result-caption').textContent = 'coleção indisponível'
  }
}

init()
