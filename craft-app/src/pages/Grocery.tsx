import { useState, useEffect } from 'react'
import type { GroceryItem } from '../types/legacy'
import { supabase } from '../lib/supabase'
import {
  ShoppingCart, ListChecks, RotateCcw, X, History, ClipboardList,
  MapPin, Save, Trash2, ArrowLeft, CheckCircle2,
  ChevronUp, ChevronDown, ExternalLink, Plus,
} from 'lucide-react'

interface SavedList { id: string; name: string; items: string[]; created_at: string }

interface PriceEntry {
  id: string
  item_name: string
  store: string
  price: number
  updated_at: string
}

interface BasicItem { name: string; qty: string }

interface BasicsPreset {
  label: string
  emoji: string
  items: BasicItem[]
}

const BASICS_PRESETS: Record<string, BasicsPreset> = {
  vegan: {
    label: 'Vegan Basics',
    emoji: '🌱',
    items: [
      { name: 'Tofu', qty: '1 block' },
      { name: 'Tempeh', qty: '1 pack' },
      { name: 'Canned black beans', qty: '2 cans' },
      { name: 'Canned chickpeas', qty: '2 cans' },
      { name: 'Lentils', qty: '1 bag' },
      { name: 'Quinoa', qty: '1 bag' },
      { name: 'Brown rice', qty: '1 bag' },
      { name: 'Rolled oats', qty: '1 container' },
      { name: 'Plant-based milk', qty: '1 carton' },
      { name: 'Nutritional yeast', qty: '1 jar' },
      { name: 'Peanut butter', qty: '1 jar' },
      { name: 'Mixed nuts', qty: '1 bag' },
      { name: 'Olive oil', qty: '1 bottle' },
      { name: 'Frozen mixed vegetables', qty: '2 bags' },
      { name: 'Bananas', qty: '1 bunch' },
      { name: 'Spinach', qty: '1 bag' },
      { name: 'Garlic', qty: '1 bulb' },
      { name: 'Onions', qty: '3' },
      { name: 'Vegetable broth', qty: '1 carton' },
      { name: 'Nutritional supplement (B12)', qty: '1 bottle' },
    ],
  },
  vegetarian: {
    label: 'Vegetarian Basics',
    emoji: '🥦',
    items: [
      { name: 'Eggs', qty: '1 dozen' },
      { name: 'Greek yogurt', qty: '1 tub' },
      { name: 'Cheese', qty: '1 block' },
      { name: 'Milk', qty: '1 gallon' },
      { name: 'Canned black beans', qty: '2 cans' },
      { name: 'Canned chickpeas', qty: '2 cans' },
      { name: 'Lentils', qty: '1 bag' },
      { name: 'Tofu', qty: '1 block' },
      { name: 'Quinoa', qty: '1 bag' },
      { name: 'Brown rice', qty: '1 bag' },
      { name: 'Pasta', qty: '2 boxes' },
      { name: 'Peanut butter', qty: '1 jar' },
      { name: 'Mixed nuts', qty: '1 bag' },
      { name: 'Olive oil', qty: '1 bottle' },
      { name: 'Frozen mixed vegetables', qty: '2 bags' },
      { name: 'Bananas', qty: '1 bunch' },
      { name: 'Spinach', qty: '1 bag' },
      { name: 'Garlic', qty: '1 bulb' },
      { name: 'Onions', qty: '3' },
      { name: 'Vegetable broth', qty: '1 carton' },
    ],
  },
  budget: {
    label: 'Budget Basics',
    emoji: '💵',
    items: [
      { name: 'Eggs', qty: '1 dozen' },
      { name: 'Rice', qty: '1 bag' },
      { name: 'Dried or canned beans', qty: '3 cans' },
      { name: 'Pasta', qty: '3 boxes' },
      { name: 'Canned tomatoes', qty: '2 cans' },
      { name: 'Peanut butter', qty: '1 jar' },
      { name: 'Rolled oats', qty: '1 container' },
      { name: 'Frozen mixed vegetables', qty: '2 bags' },
      { name: 'Bananas', qty: '1 bunch' },
      { name: 'Potatoes', qty: '5 lb bag' },
      { name: 'Onions', qty: '3' },
      { name: 'Garlic', qty: '1 bulb' },
      { name: 'Chicken thighs', qty: '1 pack' },
      { name: 'Milk', qty: '1 gallon' },
      { name: 'Bread', qty: '1 loaf' },
      { name: 'Cooking oil', qty: '1 bottle' },
      { name: 'Salt', qty: '1 container' },
      { name: 'Canned tuna', qty: '3 cans' },
    ],
  },
}

export default function Grocery() {
  const [items, setItems] = useState<GroceryItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [newQty, setNewQty] = useState('')
  const [loading, setLoading] = useState(true)
  const [savedLists, setSavedLists] = useState<SavedList[]>([])
  const [listName, setListName] = useState('')
  const [showSaved, setShowSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cart, setCart] = useState<any[]>([])
  const [loadingCart, setLoadingCart] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)
  const [prices, setPrices] = useState<PriceEntry[]>([])
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [priceForm, setPriceForm] = useState<{ store: string; price: string }>({ store: '', price: '' })
  const [location, setLocation] = useState(() => localStorage.getItem('grocery_location') || '')

  const [showBasicsModal, setShowBasicsModal] = useState(false)
  const [basicsPreset, setBasicsPreset] = useState<string | null>(null)
  const [basicsChecked, setBasicsChecked] = useState<Set<string>>(new Set())
  const [addingBasics, setAddingBasics] = useState(false)

  useEffect(() => {
    fetchItems()
    fetchSavedLists()
    fetchPrices()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('grocery_items')
      .select('*')
      .order('created_at', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }

  async function fetchSavedLists() {
    const { data } = await supabase
      .from('saved_grocery_lists')
      .select('*')
      .order('created_at', { ascending: false })
    setSavedLists(data ?? [])
  }

  async function fetchPrices() {
    const { data } = await supabase
      .from('grocery_prices')
      .select('*')
      .order('price', { ascending: true })
    setPrices(data ?? [])
  }

  async function addItem() {
    const raw = newItem.trim()
    if (!raw) return

    const names = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (names.length === 0) return

    if (names.length === 1) {
      // single item — the qty field applies as normal
      const { data } = await supabase
        .from('grocery_items')
        .insert({ name: names[0], qty: newQty.trim(), checked: false })
        .select().single()
      if (data) setItems(prev => [...prev, data])
    } else {
      // multiple comma-separated items — one qty doesn't apply to all of
      // them, so each gets added blank and can be filled in individually
      const rows = names.map(name => ({ name, qty: '', checked: false }))
      const { data } = await supabase
        .from('grocery_items')
        .insert(rows)
        .select()
      if (data) setItems(prev => [...prev, ...data])
    }

    setNewItem('')
    setNewQty('')
  }

  function openBasicsModal() {
    setBasicsPreset(null)
    setBasicsChecked(new Set())
    setShowBasicsModal(true)
  }

  function selectPreset(key: string) {
    setBasicsPreset(key)
    const preset = BASICS_PRESETS[key]
    setBasicsChecked(new Set(preset.items.map(i => i.name)))
  }

  function toggleBasicItem(name: string) {
    setBasicsChecked(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function backToPresets() {
    setBasicsPreset(null)
    setBasicsChecked(new Set())
  }

  async function addBasicsToList() {
    if (!basicsPreset) return
    const preset = BASICS_PRESETS[basicsPreset]
    const toAdd = preset.items.filter(i => basicsChecked.has(i.name))
    if (toAdd.length === 0) return

    setAddingBasics(true)
    const existingNames = new Set(items.map(i => i.name.toLowerCase()))
    const payload = toAdd
      .filter(i => !existingNames.has(i.name.toLowerCase()))
      .map(i => ({ name: i.name, qty: i.qty, checked: false }))

    if (payload.length > 0) {
      const { data } = await supabase.from('grocery_items').insert(payload).select()
      if (data) setItems(prev => [...prev, ...data])
    }

    setAddingBasics(false)
    setShowBasicsModal(false)
    setBasicsPreset(null)
    setBasicsChecked(new Set())
  }

  async function buildSmartCart() {
    const needItems = items.filter(i => !i.checked)

    setLoadingCart(true)
    setCartError(null)
    setCart([])

    const results = []
    const cache = new Map()
    let firstError: string | null = null

    try {
      for (let i = 0; i < needItems.length; i += 3) {
        const batch = needItems.slice(i, i + 3)

        const batchResults = await Promise.all(
          batch.map(async (item) => {
            if (cache.has(item.name)) {
              return cache.get(item.name)
            }

            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 4000)

            let data: { results?: any[]; error?: string } = {}

            try {
              const res = await fetch(
                `/api/product-search?q=${encodeURIComponent(item.name)}${location ? `&zip=${encodeURIComponent(location)}` : ''}`,
                { signal: controller.signal }
              )
              data = await res.json()
              if (data.error && !firstError) firstError = data.error
            } catch (e) {
              data = { error: 'Could not reach the price search service' }
              if (!firstError) firstError = data.error!
            } finally {
              clearTimeout(timeout)
            }

            const result = {
              item: item.name,
              results: Array.isArray(data.results) ? data.results : [],
              error: data.error,
            }

            cache.set(item.name, result)
            return result
          })
        )

        results.push(...batchResults)
        setCart(prev => [...prev, ...batchResults])
      }
    } finally {
      setLoadingCart(false)
      if (firstError) setCartError(firstError)
    }
  }

  function refreshSmartCart() {
    buildSmartCart()
  }

  function clearSmartCart() {
    setCart([])
    setCartError(null)
  }

  async function toggle(id: string, checked: boolean) {
    await supabase.from('grocery_items').update({ checked: !checked }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !checked } : i))
  }

  async function removeItem(id: string) {
    await supabase.from('grocery_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function clearChecked() {
    const checkedIds = items.filter(i => i.checked).map(i => i.id)
    if (!checkedIds.length) return
    await supabase.from('grocery_items').delete().in('id', checkedIds)
    setItems(prev => prev.filter(i => !i.checked))
  }

  async function saveList() {
    const name = listName.trim() || `List ${new Date().toLocaleDateString()}`
    const itemNames = items.map(i => i.qty ? `${i.qty} ${i.name}` : i.name)
    setSaving(true)
    const { data } = await supabase
      .from('saved_grocery_lists')
      .insert({ name, items: itemNames })
      .select().single()
    if (data) setSavedLists(prev => [data, ...prev])
    setListName('')
    setSaving(false)
  }

  async function deleteSavedList(id: string) {
    await supabase.from('saved_grocery_lists').delete().eq('id', id)
    setSavedLists(prev => prev.filter(l => l.id !== id))
  }

  function openShoppingList() {
    const needItems = items.filter(i => !i.checked)
    if (!needItems.length) return
    const listText = needItems.map(i => `${i.qty ? i.qty + ' ' : ''}${i.name}`).join('\n')
    navigator.clipboard?.writeText(listText).then(() => {
      window.location.href = 'mobilenotes://'
      setTimeout(() => {
        alert('Your list has been copied!\n\nOpen Notes and paste (long-press → Paste) to create your shopping list.')
      }, 500)
    }).catch(() => {
      alert(`Copy failed — here's your list:\n\n${listText}`)
    })
  }

  function searchOnInstacart(itemId: string, itemName: string) {
    const query = encodeURIComponent(itemName)
    window.open(`https://www.instacart.com/store/s?k=${query}`, '_blank')
    setPriceForm({ store: 'Instacart', price: '' })
    setExpandedItem(itemId)
  }

  function saveLocation(val: string) {
    setLocation(val)
    localStorage.setItem('grocery_location', val)
  }

  function pricesFor(itemName: string) {
    return prices
      .filter(p => p.item_name.toLowerCase() === itemName.toLowerCase())
      .sort((a, b) => a.price - b.price)
  }

  function cheapestFor(itemName: string) {
    const list = pricesFor(itemName)
    return list.length > 0 ? list[0] : null
  }

  function isStale(dateStr: string) {
    const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    return days > 30
  }

  async function addPrice(itemName: string) {
    if (!priceForm.store.trim() || !priceForm.price) return
    const { data } = await supabase
      .from('grocery_prices')
      .insert({
        item_name: itemName,
        store: priceForm.store.trim(),
        price: parseFloat(priceForm.price),
        updated_at: new Date().toISOString().split('T')[0],
      })
      .select().single()
    if (data) setPrices(prev => [...prev, data].sort((a, b) => a.price - b.price))
    setPriceForm({ store: '', price: '' })
  }

  async function deletePrice(id: string) {
    await supabase.from('grocery_prices').delete().eq('id', id)
    setPrices(prev => prev.filter(p => p.id !== id))
  }

  // Instead of only counting stores that had a literal search hit for every
  // item (which almost never happens), fill any gaps with the median price
  // other stores charged for that same item in this cart. Every store that
  // shows up anywhere then gets a complete, comparable total across the
  // whole list — part real prices, part reasonable estimate — rather than
  // being excluded or only partially totaled. This doesn't touch which
  // stores/results come back from the search itself, only how they're
  // combined into a per-store total.
  function computeTally(cartData: any[]) {
    const totalTracked = cartData.length
    if (totalTracked === 0) return []

    const allStores = new Set<string>()
    cartData.forEach(c => {
      c.results?.forEach((r: any) => {
        if (r.store && r.price != null) allStores.add(r.store)
      })
    })

    // item -> (store -> cheapest real price at that store)
    const perItemStorePrice = new Map<string, Map<string, number>>()
    // item -> median price across whatever stores did have a result
    const perItemMedian = new Map<string, number>()

    cartData.forEach(c => {
      const byStore = new Map<string, number>()
      c.results?.forEach((r: any) => {
        if (!r.store || r.price == null) return
        if (!byStore.has(r.store) || r.price < byStore.get(r.store)!) {
          byStore.set(r.store, r.price)
        }
      })
      perItemStorePrice.set(c.item, byStore)

      const prices = Array.from(byStore.values()).sort((a, b) => a - b)
      if (prices.length > 0) {
        const mid = Math.floor(prices.length / 2)
        const median = prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2
        perItemMedian.set(c.item, median)
      }
    })

    const storeResults = Array.from(allStores).map(store => {
      let total = 0
      let realCount = 0
      let estimatedCount = 0
      let missingCount = 0 // item has zero results anywhere — nothing to fill in from

      cartData.forEach(c => {
        const realPrice = perItemStorePrice.get(c.item)?.get(store)
        if (realPrice != null) {
          total += realPrice
          realCount++
        } else {
          const median = perItemMedian.get(c.item)
          if (median != null) {
            total += median
            estimatedCount++
          } else {
            missingCount++
          }
        }
      })

      return { store, total, realCount, estimatedCount, missingCount }
    })

    // Only rank stores where every item on the list could be either priced
    // or reasonably estimated — a store can't be "cheapest overall" if part
    // of the list has literally no data anywhere to estimate from.
    return storeResults
      .filter(s => s.missingCount === 0)
      .sort((a, b) => a.total - b.total)
  }

  const needs = items.filter(i => !i.checked)
  const have  = items.filter(i =>  i.checked)

  // Shared row treatment for grocery items — matches the token-based
  // list-row pattern used on DailyPlanner (white/blush background,
  // 1.5px border, --radius-md corners) instead of a bespoke module style.
  function itemRowStyle(checked: boolean) {
    return {
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderRadius: 'var(--radius-md)',
      background: checked ? 'var(--blush)' : 'var(--white)',
      border: `1.5px solid ${checked ? 'var(--pink-light)' : 'var(--border)'}`,
      fontSize: '0.82rem',
    } as React.CSSProperties
  }

  function priceBadgeStyle(stale: boolean) {
    return {
      fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' as const,
      padding: '2px 9px', borderRadius: 999, flexShrink: 0,
      color: stale ? 'var(--gold-dark)' : 'var(--sage-dark)',
      background: stale ? 'var(--gold-light)' : 'var(--sage-light)',
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Grocery List 🛒</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={openBasicsModal}>
            <ListChecks size={14} /> Build Basics List
          </button>
          <button className="btn btn-primary" onClick={buildSmartCart}>
            <ShoppingCart size={14} /> Build Smart Cart
          </button>
          <button className="btn btn-secondary" onClick={refreshSmartCart}>
            <RotateCcw size={14} /> Refresh
          </button>
          <button className="btn btn-ghost" onClick={clearSmartCart}>
            <X size={14} /> Clear
          </button>
          <button className="btn btn-secondary" onClick={() => setShowSaved(!showSaved)}>
            <History size={14} /> Saved Lists {savedLists.length > 0 && `(${savedLists.length})`}
          </button>
          <button className="btn btn-primary" onClick={openShoppingList} disabled={!needs.length}>
            <ClipboardList size={14} /> Copy List &amp; Open Notes
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Build Basics List modal */}
        {showBasicsModal && (
          <div className="modal-overlay" onClick={() => setShowBasicsModal(false)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{basicsPreset ? `${BASICS_PRESETS[basicsPreset].emoji} ${BASICS_PRESETS[basicsPreset].label}` : 'Build a Basics List'}</h3>
                <button className="close-btn" onClick={() => setShowBasicsModal(false)}><X size={16} /></button>
              </div>
              <div className="modal-body">
                {!basicsPreset ? (
                  <>
                    <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
                      Pick a starting point — you'll be able to customize before adding anything.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {Object.entries(BASICS_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => selectPreset(key)}
                          className="card"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                            background: 'var(--white)', color: 'var(--ink)',
                          }}
                        >
                          <span style={{ fontSize: '1.4rem' }}>{preset.emoji}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>{preset.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{preset.items.length} staple items</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                        Uncheck anything you don't want — {basicsChecked.size} of {BASICS_PRESETS[basicsPreset].items.length} selected
                      </p>
                      <button className="btn btn-ghost btn-sm" onClick={backToPresets}>
                        <ArrowLeft size={13} /> Back
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                      {BASICS_PRESETS[basicsPreset].items.map(item => {
                        const checked = basicsChecked.has(item.name)
                        const alreadyOnList = items.some(i => i.name.toLowerCase() === item.name.toLowerCase())
                        return (
                          <label
                            key={item.name}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                              background: checked ? 'var(--blush)' : 'var(--white)',
                              border: `1.5px solid ${checked ? 'var(--pink-light)' : 'var(--border)'}`,
                              opacity: alreadyOnList ? 0.55 : 1,
                              color: 'var(--ink)',
                            }}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleBasicItem(item.name)} />
                            <span style={{ flex: 1, fontSize: '0.86rem', color: 'var(--ink)' }}>{item.name}</span>
                            <span style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>{item.qty}</span>
                            {alreadyOnList && <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>on list</span>}
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
              {basicsPreset && (
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setShowBasicsModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={addBasicsToList} disabled={addingBasics || basicsChecked.size === 0}>
                    {addingBasics ? 'Adding...' : `Add ${basicsChecked.size} item${basicsChecked.size === 1 ? '' : 's'} to list`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* location input */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <MapPin size={16} style={{ color: 'var(--ink-muted)', flexShrink: 0 }} />
          <input
            className="form-input"
            type="text"
            placeholder="City, state (e.g. Richmond, Virginia)…"
            value={location}
            onChange={e => saveLocation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buildSmartCart()}
            style={{ width: 280 }}
          />
          <button className="btn btn-primary" onClick={buildSmartCart} disabled={!location}>
            Search
          </button>
        </div>

        {/* save list row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            type="text"
            placeholder="Name this list (optional)…"
            value={listName}
            onChange={e => setListName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveList()}
            style={{ flex: 2 }}
          />
          <button className="btn btn-primary" onClick={saveList} disabled={saving || !items.length}>
            <Save size={14} /> Save List
          </button>
          {have.length > 0 && (
            <button className="btn btn-ghost" onClick={clearChecked}>
              <Trash2 size={14} /> Clear Checked
            </button>
          )}
        </div>

        {/* saved lists panel */}
        {showSaved && (
          <div className="card">
            <div className="section-label">Saved Lists</div>
            {savedLists.length === 0
              ? <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', padding: '4px 0' }}>No saved lists yet.</p>
              : savedLists.map(list => (
                <div key={list.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px dashed var(--border)', gap: 10,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)' }}>{list.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                      {list.items.slice(0, 5).join(' · ')}{list.items.length > 5 ? ` +${list.items.length - 5} more` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSavedList(list.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', opacity: 0.5, flexShrink: 0 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {/* store leaderboard — computed inline from current cart */}
        {(() => {
          const tally = computeTally(cart)
          const totalTracked = cart.length
          if (cart.length === 0) return null
          if (cartError) {
            return (
              <div className="card">
                <div className="section-label">Best Store for Your Whole List</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--danger)', padding: '4px 0' }}>
                  Price lookup is down right now: {cartError}
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                  This isn't "no products found" — the search service itself failed. Try again in a bit, or check the SerpAPI account/key if this keeps happening.
                </p>
              </div>
            )
          }
          if (tally.length === 0) {
            return (
              <div className="card">
                <div className="section-label">Best Store for Your Whole List</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', padding: '4px 0' }}>
                  At least one item on your list had zero search results anywhere, so no store total could be estimated yet.
                </p>
              </div>
            )
          }
          return (
            <div className="card">
              <div className="section-label">Best Store for Your Whole List</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tally.map((t, i) => (
                  <div key={t.store} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--pink-dark)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.68rem', fontWeight: 700,
                    }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 70, flexShrink: 0 }}>{t.store}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${(t.realCount / totalTracked) * 100}%`,
                        background: 'linear-gradient(90deg, var(--secondary), var(--pink-dark))',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', minWidth: 46, textAlign: 'right', flexShrink: 0 }}>
                      {t.realCount}/{totalTracked} real
                    </span>
                    <span style={priceBadgeStyle(false)}>${t.total.toFixed(2)} est.</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {loading ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem' }}>Loading…</p>
        ) : (
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ListChecks size={13} /> Need to Buy</span>
                <span style={{ fontWeight: 500 }}>{needs.length} items</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto', marginBottom: 12 }}>
                {needs.length === 0
                  ? <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-muted)', padding: '1rem' }}>List is clear!</p>
                  : needs.map(item => {
                    const cheapest = cheapestFor(item.name)
                    const itemPrices = pricesFor(item.name)
                    const isOpen = expandedItem === item.id
                    return (
                      <div key={item.id}>
                        <div style={itemRowStyle(false)}>
                          <input type="checkbox" onChange={() => toggle(item.id, item.checked)} style={{ accentColor: 'var(--pink)', flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{item.name}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{item.qty}</span>
                          {cheapest && (
                            <span style={priceBadgeStyle(isStale(cheapest.updated_at))}>
                              ${cheapest.price.toFixed(2)} @ {cheapest.store}
                            </span>
                          )}
                          <button onClick={() => searchOnInstacart(item.id, item.name)} title="Search on Instacart"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', display: 'flex', flexShrink: 0 }}>
                            <ExternalLink size={13} />
                          </button>
                          <button onClick={() => setExpandedItem(isOpen ? null : item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', display: 'flex', flexShrink: 0 }}>
                            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                          <button onClick={() => removeItem(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', opacity: 0.4, display: 'flex', flexShrink: 0 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {isOpen && (
                          <div style={{ padding: '8px 12px 4px 34px', background: 'var(--cream)', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                            {itemPrices.length === 0 ? (
                              <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', padding: '4px 0 8px' }}>No prices logged yet.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                                {itemPrices.map(p => (
                                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', padding: '4px 0' }}>
                                    <span style={{ flex: 2, fontWeight: 600, color: 'var(--ink)' }}>{p.store}</span>
                                    <span style={{ flex: 1, color: 'var(--pink-dark)', fontWeight: 600 }}>${p.price.toFixed(2)}</span>
                                    <span style={{ flex: 1, color: isStale(p.updated_at) ? 'var(--gold-dark)' : 'var(--ink-muted)', fontSize: '0.66rem' }}>{p.updated_at}</span>
                                    <button onClick={() => deletePrice(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', opacity: 0.5 }}>
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                              <input
                                className="form-input"
                                type="text"
                                placeholder="Store…"
                                value={priceForm.store}
                                onChange={e => setPriceForm(f => ({ ...f, store: e.target.value }))}
                                style={{ flex: 2, fontSize: '0.78rem', padding: '6px 8px' }}
                              />
                              <input
                                className="form-input"
                                type="number"
                                placeholder="Price"
                                value={priceForm.price}
                                onChange={e => setPriceForm(f => ({ ...f, price: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && addPrice(item.name)}
                                style={{ flex: 1, fontSize: '0.78rem', padding: '6px 8px' }}
                              />
                              <button className="btn btn-primary" style={{ padding: '6px 10px' }} onClick={() => addPrice(item.name)}>
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                }
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-input" type="text" placeholder="Add item… (or item, item, item)" value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                  style={{ flex: 2 }} />
                <input className="form-input" type="text" placeholder="Qty" value={newQty}
                  onChange={e => setNewQty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                  style={{ flex: 1, minWidth: 0 }} />
                <button className="btn btn-primary" style={{ padding: '8px 12px' }} onClick={addItem}>
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="card">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={13} /> Already Have</span>
                <span style={{ fontWeight: 500 }}>{have.length} items</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                {have.length === 0
                  ? <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-muted)', padding: '1rem' }}>Nothing checked off yet.</p>
                  : have.map(item => (
                    <div key={item.id} style={itemRowStyle(true)}>
                      <input type="checkbox" checked onChange={() => toggle(item.id, item.checked)} style={{ accentColor: 'var(--pink)', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-muted)', textDecoration: 'line-through' }}>{item.name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{item.qty}</span>
                      <button onClick={() => removeItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', opacity: 0.4, display: 'flex', flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* smart cart */}
        <div className="card">
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShoppingCart size={13} /> Smart Cart</span>
            <span style={{ fontWeight: 500 }}>{cart.length} items</span>
          </div>

          {loadingCart && <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', padding: '1rem 0' }}>Finding prices…</p>}

          {!loadingCart && cart.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-muted)', padding: '1rem' }}>
              Enter your city and state above, then build a smart cart to see prices.
            </p>
          )}

          {!loadingCart && cart.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cart.map((c, i) => {
                const sorted = [...(c.results ?? [])].sort((a: any, b: any) => Number(a.price ?? 9999) - Number(b.price ?? 9999))
                const cheapest = sorted[0]
                const priciest = sorted[sorted.length - 1]
                const bigDiff = cheapest && priciest && (priciest.price - cheapest.price) >= 1

                return (
                  <div key={i}>
                    <div style={itemRowStyle(false)}>
                      <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', fontWeight: 600 }}>{c.item}</span>
                      {cheapest && (
                        <>
                          <span style={priceBadgeStyle(false)}>${Number(cheapest.price).toFixed(2)}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>{cheapest.store}</span>
                          {bigDiff && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--gold-dark)', fontWeight: 700 }}>
                              save ${(priciest.price - cheapest.price).toFixed(2)} vs {priciest.store}
                            </span>
                          )}
                        </>
                      )}
                      {!cheapest && c.error && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>lookup failed</span>
                      )}
                      {!cheapest && !c.error && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>no matches found</span>
                      )}
                    </div>
                    {sorted.length > 1 && (
                      <div style={{ paddingLeft: 16, paddingTop: 4, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                        {sorted.slice(1).map((r: any, j: number) => (
                          <span key={j} style={{ marginRight: 12 }}>{r.store} ${Number(r.price).toFixed(2)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
