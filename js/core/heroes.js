import { COLOR_DEFINITIONS, canonicalColor, canonicalColors, fold } from './colors.js'

function normalizeForm(form, fallbackId) {
  const abilityCostValue = form['ability-cost'] ?? form.abilityCost ?? form.ability_cost ?? null
  const abilityCost = abilityCostValue === null || abilityCostValue === '' ? null : Number(abilityCostValue)
  return {
    id: String(form.formId ?? form.form ?? fallbackId),
    name: String(form.name ?? 'PLACEHOLDER'),
    abilityCost: Number.isFinite(abilityCost) ? abilityCost : null,
    abilityText: String(form['ability-text'] ?? form.abilityText ?? form.ability_text ?? ''),
    image: String(form.image ?? '')
  }
}

export function normalizeHeroCollection(payload) {
  const entries = Array.isArray(payload) ? payload : payload?.cards
  if (!Array.isArray(entries)) throw new Error('O database de Heróis não contém uma lista de cartas.')
  const heroes = entries.map((entry, index) => {
    const formEntries = Object.entries(entry ?? {}).filter(([key, value]) => key.startsWith('forma-') && value && typeof value === 'object')
    const sourceForms = formEntries.length ? formEntries : [['forma-base', entry]]
    const forms = sourceForms.map(([key, value]) => normalizeForm(value, key))
    const source = sourceForms[0][1]
    const id = String(source.id ?? entry.id ?? `hero-${index + 1}`)
    const rawColors = source.colors ?? entry.colors
    const colors = canonicalColors(rawColors)
    if (!Array.isArray(rawColors) || rawColors.length !== 2 || colors.length !== 2) throw new Error(`O Herói ${id} precisa possuir exatamente duas cores principais distintas.`)
    const ids = new Set()
    for (const form of forms) {
      if (ids.has(form.id)) throw new Error(`Forma duplicada no Herói ${id}: ${form.id}.`)
      ids.add(form.id)
    }
    return {
      id,
      name: forms[0]?.name ?? String(source.name ?? 'PLACEHOLDER'),
      colors,
      forms,
      defaultFormId: forms.find(form => form.id === 'forma-base')?.id ?? forms[0]?.id ?? 'forma-base'
    }
  })
  const ids = new Set()
  for (const hero of heroes) {
    if (ids.has(hero.id)) throw new Error(`ID de Herói duplicado: ${hero.id}.`)
    ids.add(hero.id)
  }
  return heroes
}

export class HeroCatalog {
  constructor(collections = []) {
    this.heroes = collections.flatMap(normalizeHeroCollection)
    this.byId = new Map()
    for (const hero of this.heroes) {
      if (this.byId.has(hero.id)) throw new Error(`ID de Herói duplicado: ${hero.id}.`)
      this.byId.set(hero.id, hero)
    }
  }

  getAll() {
    return [...this.heroes]
  }

  getById(id) {
    return this.byId.get(String(id))
  }

  search(filters = {}) {
    const query = fold(filters.query)
    const colorFilters = Array.isArray(filters.colors) ? filters.colors : []
    return this.heroes.filter(hero => {
      if (colorFilters.length && !colorFilters.some(color => hero.colors.includes(canonicalColor(color)))) return false
      if (filters.color && !hero.colors.includes(canonicalColor(filters.color))) return false
      if (!query) return true
      const aliases = hero.colors.flatMap(color => COLOR_DEFINITIONS.find(definition => definition.id === color)?.aliases ?? [color])
      const fields = [hero.id, hero.name, ...hero.colors, ...aliases, ...hero.forms.flatMap(form => [form.name, form.abilityText, form.abilityCost])].join(' ')
      return fold(fields).includes(query)
    })
  }
}

export function getHeroForm(hero, formId = null) {
  if (!hero) return null
  return hero.forms.find(form => form.id === formId) ?? hero.forms.find(form => form.id === hero.defaultFormId) ?? hero.forms[0] ?? null
}
