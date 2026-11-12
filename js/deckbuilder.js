import { loadGameData, defaultRules, filterCards, cardId, cardName, cardType, cardCost, cardColors, normalize, escapeHtml, colorMap, colorLabels, colorDefinitions, cardImage, heroFormImage, parseSearchQuery, matchesColorFilter } from './data.js'
import { setupSharedUI, toast, openCardDialog, closeCardDialog, bindDialogClose } from './shared.js'
import { addCard as addDeckCard, removeCard as removeDeckCard, moveCard as moveDeckCard, setHero as setDeckHero, createDeck, normalizeDeck, countZone, countTotalCopies } from './core/deck-builder.js'
import { analyzeDeck, effectiveCardCost, isOffIdentity } from './core/deck-analyzer.js'
import { exportDeck as serializeDeck, importDeck as parseDeck } from './core/deck-io.js'
import { validateDeck as checkDeck } from './core/deck-validation.js'
import { getHeroForm } from './core/heroes.js'

setupSharedUI()
bindDialogClose()

const $ = selector => document.querySelector(selector)
const $$ = selector => [...document.querySelectorAll(selector)]
const state = {
  cards: [],
  heroes: [],
  cardById: new Map(),
  heroById: new Map(),
  rules: defaultRules,
  deck: createDeck(),
  selectedColor: '',
  poolMode: 'cards',
  heroDialogId: null,
  heroDialogFormId: null
}

function getCard(id) {
  return state.cardById.get(String(id)) ?? null
}

function getHero(id = state.deck.heroId) {
  return state.heroById.get(String(id ?? '')) ?? null
}

function getForm(hero, formId = state.deck.heroFormId) {
  return getHeroForm(hero, formId)
}

function currentHero() {
  return getHero()
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem('trick-current-deck-v2') || localStorage.getItem('trick-current-deck-v1') || 'null')
    state.deck = saved && typeof saved === 'object' ? saved : createDeck()
  } catch {
    state.deck = createDeck()
  }
}

function persistDraft() {
  state.deck.name = $('#deck-name').value.trim() || 'Novo deck'
  state.deck = normalizeDeck(state.deck, state.cardById)
  localStorage.setItem('trick-current-deck-v2', JSON.stringify(state.deck))
}

function savedDecks() {
  try {
    const value = JSON.parse(localStorage.getItem('trick-decks-v2') || localStorage.getItem('trick-decks') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function renderSavedDecks() {
  const select = $('#saved-decks')
  if (!select) return
  const previous = select.value
  const decks = savedDecks()
  select.innerHTML = '<option value="">Decks salvos</option>' + decks.map((deck, index) => `<option value="${index}">${escapeHtml(deck.name || `Deck ${index + 1}`)}</option>`).join('')
  if (previous && Number(previous) < decks.length) select.value = previous
}

function heroColorPieMarkup(hero) {
  if (!hero || hero.colors.length !== 2) return '<span class="hero-color-pie hero-color-pie-empty" aria-label="PLACEHOLDER"></span>'
  const first = colorMap[hero.colors[0]]
  const second = colorMap[hero.colors[1]]
  const labels = hero.colors.map(color => colorLabels[color]).join(' e ')
  return `<span class="hero-color-pie" style="--hero-color-one:${first};--hero-color-two:${second}" role="img" aria-label="Identidade de cores: ${escapeHtml(labels)}"></span>`
}

function heroColorTagsMarkup(hero) {
  return hero.colors.map(color => `<span class="hero-color-tag"><i style="--swatch:${colorMap[color]}"></i>${escapeHtml(colorLabels[color])}</span>`).join('')
}

function getPoolFilters() {
  return {
    query: $('#pool-search').value,
    type: $('#pool-type').value,
    colors: state.selectedColor ? [state.selectedColor] : [],
    sort: $('#pool-sort').value
  }
}

function poolCardMarkup(card) {
  const baseCost = cardCost(card)
  const adjustedCost = effectiveCardCost(card, currentHero())
  const modified = isOffIdentity(card, currentHero())
  const quantity = countTotalCopies(state.deck, cardId(card))
  const token = cardType(card).type === 'Ficha'
  const costMarkup = adjustedCost === null ? 'Custo —' : modified ? `Custo ${adjustedCost} <small class="cost-adjustment">(${baseCost} + 1)</small>` : `Custo ${adjustedCost}`
  return `<article class="pool-card" data-pool-card="${escapeHtml(cardId(card))}">
    <div class="pool-card-art" data-open-pool-card="${escapeHtml(cardId(card))}"><img loading="lazy" src="${escapeHtml(cardImage(card))}" alt="${escapeHtml(cardName(card))}" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"><span class="pool-quantity" ${quantity ? '' : 'hidden'}>${quantity}</span><button class="pool-add" data-pool-add="${escapeHtml(cardId(card))}" aria-label="Adicionar ${escapeHtml(cardName(card))}">+</button></div>
    <h3 class="pool-card-name" title="${escapeHtml(cardName(card))}">${escapeHtml(cardName(card))}</h3><div class="pool-card-meta">${costMarkup}${token ? '<span class="token-zone-note">Sideboard</span>' : ''}</div>
  </article>`
}

function heroTileMarkup(hero) {
  const form = getForm(hero, hero.defaultFormId)
  const selected = state.deck.heroId === hero.id
  return `<article class="hero-pool-card ${selected ? 'selected' : ''}" data-open-hero="${escapeHtml(hero.id)}">
    <div class="hero-pool-art"><img loading="lazy" src="${escapeHtml(heroFormImage(form))}" alt="${escapeHtml(form?.name ?? hero.name)}" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"><span class="hero-pool-cost">${form?.abilityCost ?? '—'}</span></div>
    <div class="hero-pool-copy"><h3>${escapeHtml(hero.name)}</h3><div class="hero-pool-colors">${heroColorTagsMarkup(hero)}</div><p>${escapeHtml(form?.abilityText ?? '')}</p><button class="button ${selected ? 'button-secondary' : 'button-primary'} button-small" type="button" data-select-hero="${escapeHtml(hero.id)}">${selected ? 'Selecionado' : 'Selecionar'}</button></div>
  </article>`
}

function renderPool() {
  const query = $('#pool-search').value
  const isHeroes = state.poolMode === 'heroes'
  if (isHeroes && state.selectedColor === 'incolor') state.selectedColor = ''
  const colors = state.selectedColor ? [state.selectedColor] : []
  $$('[data-color=\"incolor\"]').forEach(button => button.hidden = isHeroes)
  $$('.color-choice').forEach(button => button.classList.toggle('active', button.dataset.color === state.selectedColor && Boolean(state.selectedColor)))
  $('#pool-grid').hidden = isHeroes
  $('#hero-pool').hidden = !isHeroes
  $('#pool-type').hidden = isHeroes
  $('#pool-sort').hidden = isHeroes
  $('#pool-zone').hidden = isHeroes
  $('#pool-heading').textContent = isHeroes ? 'Heróis' : 'Cartas'
  $('#pool-search').placeholder = isHeroes ? 'Buscar Heróis por nome, habilidade ou cor...' : 'Buscar cartas por nome, texto ou cor...'
  if (isHeroes) {
    const results = state.heroes.filter(hero => {
      if (colors.length && !colors.some(color => hero.colors.includes(color))) return false
      if (!query) return true
      const searchColors = hero.colors.flatMap(color => colorDefinitions.find(definition => definition.id === color)?.aliases ?? [color])
      const parsed = parseSearchQuery(query)
      const searchText = normalize([hero.id, hero.name, ...hero.colors, ...searchColors, ...hero.forms.flatMap(form => [form.name, form.abilityText, form.abilityCost])].join(' '))
      const fields = {
        nome: normalize(hero.name),
        name: normalize(hero.name),
        id: normalize(hero.id),
        texto: normalize(hero.forms.map(form => form.abilityText).join(' ')),
        text: normalize(hero.forms.map(form => form.abilityText).join(' ')),
        habilidade: normalize(hero.forms.map(form => form.abilityText).join(' ')),
        ability: normalize(hero.forms.map(form => form.abilityText).join(' '))
      }
      return parsed.terms.every(term => searchText.includes(term) || hero.colors.some(color => matchesColorFilter([color], term))) && parsed.filters.every(({ field, value }) => {
        if (field === 'cor' || field === 'color') return hero.colors.some(color => matchesColorFilter([color], value))
        return fields[field] !== undefined && fields[field].includes(value)
      })
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    $('#pool-count').textContent = `${results.length} ${results.length === 1 ? 'Herói encontrado' : 'Heróis encontrados'}`
    $('#hero-pool').innerHTML = results.map(heroTileMarkup).join('')
    $('#pool-empty').hidden = results.length > 0
    return
  }
  const results = filterCards(state.cards, getPoolFilters())
  $('#pool-count').textContent = `${results.length} ${results.length === 1 ? 'carta encontrada' : 'cartas encontradas'}`
  $('#pool-grid').innerHTML = results.map(poolCardMarkup).join('')
  $('#pool-empty').hidden = results.length > 0
}

function switchPoolMode(mode) {
  state.poolMode = mode === 'heroes' ? 'heroes' : 'cards'
  $$('.browser-mode').forEach(button => {
    const active = button.dataset.poolMode === state.poolMode
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', String(active))
  })
  renderPool()
}

function addCard(id, zoneOverride = null) {
  const card = getCard(id)
  if (!card) return
  const maximum = Number(state.rules.maximumCopiesPerCard ?? 2)
  const quantity = countTotalCopies(state.deck, id)
  if (quantity >= maximum) {
    toast(`O limite é de ${maximum} cópias por carta, somando Mainboard e Sideboard.`)
    return
  }
  const requestedZone = zoneOverride || $('#pool-zone').value
  const token = cardType(card).type === 'Ficha'
  state.deck = addDeckCard(state.deck, card, 1, { zone: requestedZone, cards: state.cardById })
  renderDeck()
  persistDraft()
  toast(token ? `${cardName(card)} adicionada ao Sideboard.` : `${cardName(card)} adicionada ao ${requestedZone === 'sideboard' ? 'Sideboard' : 'Mainboard'}.`)
}

function removeCard(id, zone) {
  state.deck = removeDeckCard(state.deck, id, 1, zone)
  renderDeck()
  persistDraft()
}

function moveCard(id, from) {
  try {
    state.deck = moveDeckCard(state.deck, id, 1, from, state.cardById)
    renderDeck()
    persistDraft()
  } catch (error) {
    toast(error.message)
  }
}

function setHero(id, formId = null) {
  const hero = getHero(id)
  if (!hero) return
  const nextFormId = formId || hero.defaultFormId
  state.deck = setDeckHero(state.deck, hero.id, nextFormId)
  renderDeck()
  persistDraft()
  closeHeroDialog()
  toast(`${hero.name} selecionado.`)
}

function setHeroForm(formId) {
  const hero = currentHero()
  if (!hero || !hero.forms.some(form => form.id === formId)) return
  state.deck.heroFormId = formId
  renderDeck()
  persistDraft()
}

function validationResult() {
  const result = checkDeck(state.deck, state.cardById, state.rules, state.heroById)
  if (!result.mainboardCount && !result.errors.some(error => error.code === 'DECK_EMPTY')) {
    result.errors.push({ code: 'DECK_EMPTY', message: 'Adicione cartas ao Mainboard.' })
    result.valid = false
  }
  return result
}

function renderHero() {
  const hero = currentHero()
  const slot = $('#hero-slot')
  if (!hero) {
    slot.classList.remove('has-hero')
    slot.innerHTML = '<div class="hero-slot-empty"><strong>Selecione um Herói</strong><span>PLACEHOLDER</span><button class="button button-secondary button-small" id="choose-hero">Escolher Herói</button></div>'
    $('#choose-hero')?.addEventListener('click', () => switchPoolMode('heroes'))
    return
  }
  const form = getForm(hero)
  const formSelector = hero.forms.length > 1 ? `<label class="hero-form-select-wrap"><span>Forma</span><select class="field-select hero-form-select" id="hero-current-form">${hero.forms.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === form?.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>` : ''
  slot.classList.add('has-hero')
  slot.innerHTML = `<div class="hero-slot-main"><img class="hero-slot-image" src="${escapeHtml(heroFormImage(form))}" alt="${escapeHtml(form?.name ?? hero.name)}" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"><div class="hero-slot-copy"><strong>${escapeHtml(form?.name ?? hero.name)}</strong><span>Herói selecionado · habilidade ${form?.abilityCost ?? '—'}</span><div class="hero-slot-colors">${heroColorPieMarkup(hero)}${heroColorTagsMarkup(hero)}</div></div></div><div class="hero-slot-controls">${formSelector}<button class="hero-remove" id="remove-hero" type="button">Remover</button></div><p class="hero-slot-ability">${escapeHtml(form?.abilityText ?? '')}</p>`
  $('#remove-hero')?.addEventListener('click', () => {
    state.deck = setDeckHero(state.deck, null)
    renderDeck()
    persistDraft()
  })
  $('#hero-current-form')?.addEventListener('change', event => setHeroForm(event.target.value))
}

function renderDeckList(zone) {
  const container = zone === 'sideboard' ? $('#sideboard-list') : $('#deck-list')
  const entries = state.deck[zone] ?? {}
  const ids = Object.keys(entries).filter(id => getCard(id)).sort((a, b) => {
    const cardA = getCard(a)
    const cardB = getCard(b)
    return (effectiveCardCost(cardA, currentHero()) ?? Infinity) - (effectiveCardCost(cardB, currentHero()) ?? Infinity) || cardName(cardA).localeCompare(cardName(cardB), 'pt-BR')
  })
  if (!ids.length) {
    container.innerHTML = `<div class="deck-list-empty"><span>${zone === 'sideboard' ? '＋' : '✿'}</span><p>${zone === 'sideboard' ? 'PLACEHOLDER' : 'Adicione cartas ao Mainboard.'}</p></div>`
    return
  }
  container.innerHTML = ids.map(id => {
    const card = getCard(id)
    const cost = effectiveCardCost(card, currentHero())
    const altered = isOffIdentity(card, currentHero())
    const token = cardType(card).type === 'Ficha'
    const moveLabel = zone === 'mainboard' ? 'Mover para Sideboard' : 'Mover para Mainboard'
    const moveButton = token ? '' : `<button class="qty-button zone-move" data-zone-move="${escapeHtml(id)}" data-from-zone="${zone}" aria-label="${moveLabel}">${zone === 'mainboard' ? '↓' : '↑'}</button>`
    return `<div class="deck-entry"><span class="deck-quantity">${entries[id]}×</span><button class="deck-entry-thumb-button" type="button" data-open-deck-card="${escapeHtml(id)}" aria-label="Visualizar ${escapeHtml(cardName(card))}"><img class="deck-entry-thumb" loading="lazy" src="${escapeHtml(cardImage(card))}" alt="" onerror="this.onerror=null;this.src='assets/images/card-back.webp'"></button><div class="deck-entry-info"><div class="deck-entry-name">${escapeHtml(cardName(card))}</div><div class="deck-entry-type">${escapeHtml(cardType(card).type)}${cardType(card).subtype ? ` · ${escapeHtml(cardType(card).subtype)}` : ''}${token ? ' · Ficha' : ''}</div></div><div class="deck-entry-cost">${cost === null ? '—' : altered ? `${cost} <small>+1</small>` : cost}</div><div class="deck-entry-actions"><button class="qty-button" data-zone-remove="${escapeHtml(id)}" data-zone="${zone}" aria-label="Remover uma cópia">−</button><button class="qty-button" data-zone-add="${escapeHtml(id)}" data-zone="${zone}" aria-label="Adicionar uma cópia">+</button>${moveButton}</div></div>`
  }).join('')
}

function renderAnalysis() {
  const analysis = analyzeDeck(state.deck, state.cardById, state.heroById)
  const buckets = Array.from({ length: 7 }, (_, index) => analysis.manaCurve[index === 6 ? '7+' : String(index)] ?? 0)
  const maximum = Math.max(...buckets, 1)
  $('#curve-chart').innerHTML = buckets.map((value, index) => `<div class="curve-bar-wrap"><div class="curve-bar" style="height:${value ? Math.max(6, value / maximum * 100) : 2}%" title="Custo ${index === 6 ? '7 ou mais' : index}: ${value} carta(s)"></div></div>`).join('')
  $('#color-distribution').innerHTML = Object.entries(colorLabels).map(([color, label]) => {
    const value = analysis.colorCounts[color] ?? 0
    return `<span class="${value ? 'has-value' : ''}" style="--swatch:${colorMap[color]};flex:${Math.max(value, .25)}" title="${label}: ${value} carta(s)"></span>`
  }).join('')
  const result = validationResult()
  const errors = result.errors.map(error => ({ kind: 'error', message: error.message }))
  const warnings = result.warnings.map(warning => ({ kind: 'warning', message: warning.message }))
  if (analysis.unknownCostCards) warnings.push({ kind: 'warning', message: `${analysis.unknownCostCards} carta(s) sem custo cadastrado não entram na curva.` })
  if (analysis.offIdentityCards) warnings.push({ kind: 'warning', message: `${analysis.offIdentityCards} carta(s) fora da identidade do Herói recebem +1 no custo.` })
  const notes = [...errors, ...warnings]
  $('#deck-validation').innerHTML = notes.length
    ? notes.map(note => `<div class="validation-${note.kind}">${escapeHtml(note.message)}</div>`).join('')
    : '<span class="validation-ok">Deck válido segundo as regras configuradas.</span>'
}

function renderDeck() {
  state.deck = normalizeDeck(state.deck, state.cardById)
  $('#deck-name').value = state.deck.name
  const mainboardCount = countZone(state.deck, 'mainboard')
  const sideboardCount = countZone(state.deck, 'sideboard')
  const mainboardIds = Object.keys(state.deck.mainboard).filter(getCard)
  const uniqueColors = new Set(mainboardIds.flatMap(id => cardColors(getCard(id))))
  $('#deck-size').textContent = mainboardCount
  $('#deck-unique').textContent = mainboardIds.length
  $('#deck-colors').textContent = uniqueColors.size
  $('#sideboard-size').textContent = sideboardCount
  const sizeRules = state.rules.deckSize || {}
  $('#deck-limit-label').textContent = sizeRules.maximum !== null && sizeRules.maximum !== undefined
    ? `Máximo de ${sizeRules.maximum} cartas no Mainboard`
    : sizeRules.minimum !== null && sizeRules.minimum !== undefined
      ? `Mínimo de ${sizeRules.minimum} cartas no Mainboard`
      : 'PLACEHOLDER'
  renderHero()
  renderDeckList('mainboard')
  renderDeckList('sideboard')
  renderPool()
  renderAnalysis()
  renderSavedDecks()
}

function openCard(id) {
  const card = getCard(id)
  if (!card) return
  openCardDialog(card, {
    add: selected => {
      addCard(cardId(selected))
      closeCardDialog()
    },
    hero: null
  })
}

function openHeroDialog(id) {
  const hero = getHero(id)
  if (!hero) return
  state.heroDialogId = hero.id
  state.heroDialogFormId = hero.defaultFormId
  renderHeroDialog()
  $('#hero-modal').hidden = false
  document.body.classList.add('modal-open')
}

function renderHeroDialog() {
  const hero = getHero(state.heroDialogId)
  if (!hero) return
  const form = getForm(hero, state.heroDialogFormId)
  const image = $('#hero-modal-image')
  image.src = heroFormImage(form)
  image.alt = form?.name ?? hero.name
  image.onerror = () => {
    image.onerror = null
    image.src = 'assets/images/card-back.webp'
  }
  $('#hero-modal-title').textContent = form?.name ?? hero.name
  $('#hero-modal-colors').innerHTML = `${heroColorPieMarkup(hero)} ${hero.colors.map(color => escapeHtml(colorLabels[color])).join(' · ')}`
  $('#hero-modal-cost').textContent = `Custo da habilidade: ${form?.abilityCost ?? '—'}`
  $('#hero-modal-text').textContent = form?.abilityText || 'PLACEHOLDER'
  $('#hero-modal-forms').innerHTML = hero.forms.length > 1 ? hero.forms.map(item => `<button type="button" class="hero-form-option ${item.id === form?.id ? 'active' : ''}" data-hero-form-option="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>`).join('') : ''
  $('#hero-modal-select').textContent = state.deck.heroId === hero.id ? 'Herói selecionado' : 'Selecionar Herói'
}

function closeHeroDialog() {
  $('#hero-modal').hidden = true
  document.body.classList.remove('modal-open')
  state.heroDialogId = null
  state.heroDialogFormId = null
}

function exportCurrentDeck() {
  state.deck.name = $('#deck-name').value.trim() || 'Novo deck'
  const content = serializeDeck(state.deck, state.cardById)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${state.deck.name.trim().replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'trick-deck'}.trickdeck`
  link.click()
  URL.revokeObjectURL(url)
}

function importCurrentDeck(content) {
  try {
    state.deck = parseDeck(content, { cards: state.cardById, heroes: state.heroById })
    renderDeck()
    persistDraft()
    const result = validationResult()
    if (result.errors.length) toast(`Deck importado com ${result.errors.length} problema(s) para revisar.`)
    else toast('Deck importado.')
  } catch (error) {
    toast(error.message)
  }
}

function saveDeck() {
  state.deck.name = $('#deck-name').value.trim() || 'Novo deck'
  state.deck = normalizeDeck(state.deck, state.cardById)
  const decks = savedDecks()
  const saved = { ...state.deck, mainboard: { ...state.deck.mainboard }, sideboard: { ...state.deck.sideboard }, updatedAt: new Date().toISOString() }
  const index = decks.findIndex(deck => deck.name === saved.name)
  if (index >= 0) decks[index] = saved
  else decks.push(saved)
  localStorage.setItem('trick-decks-v2', JSON.stringify(decks))
  persistDraft()
  renderSavedDecks()
  toast('Deck salvo neste navegador.')
}

function startNewDeck() {
  const hasContent = countZone(state.deck, 'mainboard') + countZone(state.deck, 'sideboard') > 0 || state.deck.heroId
  if (hasContent && !confirm('Começar um deck novo? O rascunho atual continuará salvo no navegador.')) return
  state.deck = createDeck()
  renderDeck()
  persistDraft()
}

function clearList() {
  if (!countZone(state.deck, 'mainboard')) return
  if (!confirm('Remover todas as cartas do Mainboard?')) return
  state.deck.mainboard = {}
  renderDeck()
  persistDraft()
}

function loadSavedDeck(index) {
  if (index === '') return
  const deck = savedDecks()[Number(index)]
  if (!deck) return
  state.deck = normalizeDeck(deck, state.cardById)
  if (state.deck.heroId && !getHero(state.deck.heroId)) state.deck.heroId = null
  renderDeck()
  persistDraft()
  toast('Deck carregado.')
}

function bindEvents() {
  ;['pool-search', 'pool-type', 'pool-sort', 'pool-zone'].forEach(id => $(`#${id}`).addEventListener('input', renderPool))
  $$('.browser-mode').forEach(button => button.addEventListener('click', () => switchPoolMode(button.dataset.poolMode)))
  $('#pool-colors').addEventListener('click', event => {
    const button = event.target.closest('[data-color]')
    if (!button) return
    state.selectedColor = button.dataset.color
    $$('.color-choice').forEach(item => item.classList.toggle('active', item === button && Boolean(state.selectedColor)))
    renderPool()
  })
  $('#pool-grid').addEventListener('click', event => {
    const addButton = event.target.closest('[data-pool-add]')
    if (addButton) {
      event.stopPropagation()
      addCard(addButton.dataset.poolAdd)
      return
    }
    const tile = event.target.closest('[data-open-pool-card]')
    if (tile) openCard(tile.dataset.openPoolCard)
  })
  $('#hero-pool').addEventListener('click', event => {
    const selectButton = event.target.closest('[data-select-hero]')
    if (selectButton) {
      event.stopPropagation()
      const hero = getHero(selectButton.dataset.selectHero)
      if (hero) setHero(hero.id)
      return
    }
    const tile = event.target.closest('[data-open-hero]')
    if (tile) openHeroDialog(tile.dataset.openHero)
  })
  $('#hero-modal-close').addEventListener('click', closeHeroDialog)
  $('#hero-modal').addEventListener('click', event => {
    if (event.target === $('#hero-modal')) closeHeroDialog()
  })
  $('#hero-modal-forms').addEventListener('click', event => {
    const button = event.target.closest('[data-hero-form-option]')
    if (!button) return
    state.heroDialogFormId = button.dataset.heroFormOption
    renderHeroDialog()
  })
  $('#hero-modal-select').addEventListener('click', () => {
    const hero = getHero(state.heroDialogId)
    if (hero) setHero(hero.id, state.heroDialogFormId)
  })
  $('#hero-slot').addEventListener('click', event => {
    if (event.target.closest('#choose-hero')) switchPoolMode('heroes')
  })
  const bindDeckList = container => container.addEventListener('click', event => {
    const preview = event.target.closest('[data-open-deck-card]')
    const remove = event.target.closest('[data-zone-remove]')
    const add = event.target.closest('[data-zone-add]')
    const move = event.target.closest('[data-zone-move]')
    if (preview) openCard(preview.dataset.openDeckCard)
    if (remove) removeCard(remove.dataset.zoneRemove, remove.dataset.zone)
    if (add) addCard(add.dataset.zoneAdd, add.dataset.zone)
    if (move) moveCard(move.dataset.zoneMove, move.dataset.fromZone)
  })
  bindDeckList($('#deck-list'))
  bindDeckList($('#sideboard-list'))
  $('#deck-name').addEventListener('input', () => {
    state.deck.name = $('#deck-name').value
    persistDraft()
  })
  $('#save-deck').addEventListener('click', saveDeck)
  $('#new-deck').addEventListener('click', startNewDeck)
  $('#clear-list').addEventListener('click', clearList)
  $('#export-deck').addEventListener('click', exportCurrentDeck)
  $('#import-deck').addEventListener('click', () => $('#deck-file').click())
  $('#deck-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]
    if (file) importCurrentDeck(await file.text())
    event.target.value = ''
  })
  $('#saved-decks').addEventListener('change', event => loadSavedDeck(event.target.value))
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeHeroDialog()
  })
}

async function init() {
  bindEvents()
  loadDraft()
  $('#deck-name').value = state.deck.name || 'Novo deck'
  try {
    const data = await loadGameData()
    state.cards = data.cards
    state.heroes = data.heroes
    state.cardById = new Map(state.cards.map(card => [cardId(card), card]))
    state.heroById = new Map(state.heroes.map(hero => [hero.id, hero]))
    state.rules = data.rules
    state.deck = normalizeDeck(state.deck, state.cardById)
    const maximum = Number(state.rules.maximumCopiesPerCard ?? 2)
    for (const zone of ['mainboard', 'sideboard']) {
      state.deck[zone] = Object.fromEntries(Object.entries(state.deck[zone]).filter(([id, quantity]) => getCard(id) && quantity > 0).map(([id, quantity]) => [id, quantity]))
    }
    if (state.deck.heroId && !getHero(state.deck.heroId)) state.deck.heroId = null
    if (state.deck.heroId && state.deck.heroFormId && !getHero(state.deck.heroId).forms.some(form => form.id === state.deck.heroFormId)) state.deck.heroFormId = getHero(state.deck.heroId).defaultFormId
    for (const id of new Set([...Object.keys(state.deck.mainboard), ...Object.keys(state.deck.sideboard)])) {
      const total = countTotalCopies(state.deck, id)
      if (total > maximum) {
        const allowedSideboard = Math.max(0, maximum - (state.deck.mainboard[id] ?? 0))
        if (state.deck.sideboard[id] > allowedSideboard) state.deck.sideboard[id] = allowedSideboard
      }
    }
    renderDeck()
    persistDraft()
    const cardIdFromUrl = new URLSearchParams(window.location.search).get('card')
    if (cardIdFromUrl && getCard(cardIdFromUrl)) addCard(cardIdFromUrl)
  } catch (error) {
    $('#pool-error').hidden = false
    $('#pool-grid').hidden = true
    $('#pool-count').textContent = error.message || 'PLACEHOLDER'
    renderDeck()
    $('#pool-empty').hidden = true
  }
}

init()
