import { useState, useEffect } from 'react'
import type { GroceryItem } from '../types'
import { supabase } from '../lib/supabase'
import styles from './Grocery.module.css'

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
    const name = newItem.trim()
    if (!name) return
    const { data } = await supabase
      .from('grocery_items')
      .insert({ name, qty: newQty.trim(), checked: false })
      .select().single()
    if (data) setItems(prev => [...prev, data])
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
  setCart([])

  const results = []
  const cache = new Map()

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

let data = []

try {
  const res = await fetch(
    `/api/product-search?q=${encodeURIComponent(item.name)}`,
    { signal: controller.signal }
  )

  data = await res.json()
} catch (e) {
  data = []
} finally {
  clearTimeout(timeout)
}

          const result = {
            item: item.name,
            results: Array.isArray(data) ? data : []
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
  }
}
  function refreshSmartCart() {
    buildSmartCart()
  }

  function clearSmartCart() {
    setCart([])
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

  function computeTally(cartData: any[]) {
    const storeCounts = new Map<string, number>()
    const storeTotals = new Map<string, number>()

    cartData.forEach(c => {
      const byStore = new Map<string, number>()
      c.results?.forEach((r: any) => {
        if (!r.store || r.price == null) return
        if (!byStore.has(r.store) || r.price < byStore.get(r.store)!) {
          byStore.set(r.store, r.price)
        }
      })
      byStore.forEach((price, store) => {
        storeCounts.set(store, (storeCounts.get(store) ?? 0) + 1)
        storeTotals.set(store, (storeTotals.get(store) ?? 0) + price)
      })
    })

    return Array.from(storeCounts.entries())
      .map(([store, count]) => ({
        store,
        count,
        total: storeTotals.get(store) ?? 0
      }))
      .sort((a, b) => b.count - a.count || a.total - b.total)
  }

  const needs = items.filter(i => !i.checked)
  const have  = items.filter(i =>  i.checked)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}><i className="ti ti-shopping-cart" aria-hidden="true" /> grocery list</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={openBasicsModal}>
            <i className="ti ti-list-details" aria-hidden="true" /> build basics list
          </button>
          <button onClick={buildSmartCart}>Build Smart Cart</button>
          <button onClick={refreshSmartCart}>Refresh</button>
          <button onClick={clearSmartCart}>Clear</button>
          <button className="btn-ghost" onClick={() => setShowSaved(!showSaved)}>
            <i className="ti ti-history" aria-hidden="true" /> saved lists {savedLists.length > 0 && `(${savedLists.length})`}
          </button>
          <button className="btn-primary" onClick={openShoppingList} disabled={!needs.length}>
            <i className="ti ti-clipboard-list" aria-hidden="true" /> copy list & open notes
          </button>
        </div>
      </div>

      {/* Build Basics List modal */}
      {showBasicsModal && (
        <div className="modal-overlay" onClick={() => setShowBasicsModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{basicsPreset ? `${BASICS_PRESETS[basicsPreset].emoji} ${BASICS_PRESETS[basicsPreset].label}` : 'Build a Basics List'}</h3>
              <button className="close-btn" onClick={() => setShowBasicsModal(false)}>✕</button>
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
                          background: '#fff', color: 'var(--ink)',
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
                    <button className="btn-ghost btn-sm" onClick={backToPresets}>
                      <i className="ti ti-arrow-left" aria-hidden="true" /> back
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
                            padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                            background: checked ? 'var(--cream)' : '#fff',
                            border: '1.5px solid var(--border)',
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
                <button className="btn-ghost" onClick={() => setShowBasicsModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={addBasicsToList} disabled={addingBasics || basicsChecked.size === 0}>
                  {addingBasics ? 'Adding...' : `Add ${basicsChecked.size} item${basicsChecked.size === 1 ? '' : 's'} to list`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* location input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <i className="ti ti-map-pin" aria-hidden="true" />
        <input
          type="text"
          placeholder="city, state (e.g. Richmond, Virginia)..."
          value={location}
          onChange={e => saveLocation(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buildSmartCart()}
          style={{ width: 280 }}
        />
        <button className="btn-primary" onClick={buildSmartCart} disabled={!location}>
          <i className="ti ti-search" aria-hidden="true" /> search
        </button>
      </div>

      {/* save list row */}
      <div className={styles.saveRow}>
        <input type="text" placeholder="name this list (optional)..." value={listName}
          onChange={e => setListName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && saveList()}
          style={{ flex: 2 }} />
        <button className="btn-primary" onClick={saveList} disabled={saving || !items.length}>
          <i className="ti ti-device-floppy" aria-hidden="true" /> save list
        </button>
        {have.length > 0 && (
          <button className="btn-ghost" onClick={clearChecked}>
            <i className="ti ti-trash" aria-hidden="true" /> clear checked
          </button>
        )}
      </div>

      {/* saved lists panel */}
      {showSaved && (
        <div className={`card ${styles.savedPanel}`}>
          <div className={styles.savedPanelTitle}>saved lists</div>
          {savedLists.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--ink-muted)', padding: '0.5rem 0' }}>no saved lists yet</p>
            : savedLists.map(list => (
              <div key={list.id} className={styles.savedListRow}>
                <div>
                  <div className={styles.savedListName}>{list.name}</div>
                  <div className={styles.savedListItems}>{list.items.slice(0, 5).join(' · ')}{list.items.length > 5 ? ` +${list.items.length - 5} more` : ''}</div>
                </div>
                <button className={styles.removeBtn} onClick={() => deleteSavedList(list.id)}>
                  <i className="ti ti-trash" aria-hidden="true" />
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
  if (tally.length === 0) return null
  return (
    <div className={`card ${styles.savedPanel}`}>
      <div className={styles.savedPanelTitle}>best store for your list</div>
      {tally.map((t, i) => (
        <div key={t.store} className={styles.tallyRow}>
          <span className={styles.tallyRank}>{i + 1}</span>
          <span className={styles.tallyStore}>{t.store}</span>
          <div className={styles.tallyBarTrack}>
            <div className={styles.tallyBarFill} style={{ width: `${(t.count / totalTracked) * 100}%` }} />
          </div>
          <span className={styles.tallyCount}>{t.count}/{totalTracked} items</span>
          <span className={styles.priceBadge}>${t.total.toFixed(2)} est.</span>
        </div>
      ))}
    </div>
  )
})()}


      {loading ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>loading...</p>
      ) : (
        <div className={styles.layout}>
          <div className="card">
            <div className={styles.colHeader}>
              <span><i className="ti ti-list-check" aria-hidden="true" /> need to buy</span>
              <span className={styles.count}>{needs.length} items</span>
            </div>
            <div className={styles.list}>
              {needs.length === 0
                ? <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-muted)', padding: '1rem' }}>list is clear!</p>
                : needs.map(item => {
                  const cheapest = cheapestFor(item.name)
                  const itemPrices = pricesFor(item.name)
                  const isOpen = expandedItem === item.id
                  return (
                    <div key={item.id} className={styles.itemWrap}>
                      <div className={styles.item}>
                        <input type="checkbox" onChange={() => toggle(item.id, item.checked)} />
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemQty}>{item.qty}</span>
                        {cheapest && (
                          <span className={`${styles.priceBadge} ${isStale(cheapest.updated_at) ? styles.priceStale : ''}`}>
                            ${cheapest.price.toFixed(2)} @ {cheapest.store}
                          </span>
                        )}
                        <button className={styles.priceToggle} onClick={() => searchOnInstacart(item.id, item.name)} title="search on Instacart">
                          <i className="ti ti-shopping-cart-plus" aria-hidden="true" />
                        </button>
                        <button className={styles.priceToggle} onClick={() => setExpandedItem(isOpen ? null : item.id)}>
                          <i className={`ti ti-chevron-${isOpen ? 'up' : 'down'}`} aria-hidden="true" />
                        </button>
                        <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>

                      {isOpen && (
                        <div className={styles.priceDrawer}>
                          {itemPrices.length === 0 ? (
                            <p className={styles.noPrices}>no prices logged yet</p>
                          ) : (
                            <div className={styles.priceList}>
                              {itemPrices.map(p => (
                                <div key={p.id} className={styles.priceRow}>
                                  <span className={styles.priceStore}>{p.store}</span>
                                  <span className={styles.priceAmt}>${p.price.toFixed(2)}</span>
                                  <span className={`${styles.priceDate} ${isStale(p.updated_at) ? styles.priceStale : ''}`}>{p.updated_at}</span>
                                  <button className={styles.removeBtn} onClick={() => deletePrice(p.id)}>
                                    <i className="ti ti-x" aria-hidden="true" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className={styles.priceAddRow}>
                            <input
                              type="text"
                              placeholder="store..."
                              value={priceForm.store}
                              onChange={e => setPriceForm(f => ({ ...f, store: e.target.value }))}
                              style={{ flex: 2 }}
                            />
                            <input
                              type="number"
                              placeholder="price"
                              value={priceForm.price}
                              onChange={e => setPriceForm(f => ({ ...f, price: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && addPrice(item.name)}
                              style={{ flex: 1 }}
                            />
                            <button className="btn-primary" style={{ padding: '6px 10px' }} onClick={() => addPrice(item.name)}>
                              <i className="ti ti-plus" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              }
            </div>
            <div className={styles.addRow}>
              <input type="text" placeholder="add item..." value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                style={{ flex: 2 }} />
              <input type="text" placeholder="qty" value={newQty}
                onChange={e => setNewQty(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                style={{ flex: 1, minWidth: 0 }} />
              <button className="btn-primary" style={{ padding: '7px 12px' }} onClick={addItem}>
                <i className="ti ti-plus" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="card">
            <div className={styles.colHeader}>
              <span><i className="ti ti-circle-check" aria-hidden="true" /> already have</span>
              <span className={styles.count}>{have.length} items</span>
            </div>
            <div className={styles.list}>
              {have.length === 0
                ? <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-muted)', padding: '1rem' }}>nothing checked off yet</p>
                : have.map(item => (
                  <div key={item.id} className={`${styles.item} ${styles.checked}`}>
                    <input type="checkbox" checked onChange={() => toggle(item.id, item.checked)} />
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemQty}>{item.qty}</span>
                    <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
                      <i className="ti ti-trash" aria-hidden="true" />
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
        <div className={styles.colHeader}>
          <span><i className="ti ti-shopping-cart" aria-hidden="true" /> smart cart</span>
          <span className={styles.count}>{cart.length} items</span>
        </div>

        {loadingCart && <p style={{ fontSize: 13, color: 'var(--ink-muted)', padding: '1rem' }}>finding prices...</p>}

        {!loadingCart && cart.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-muted)', padding: '1rem' }}>
            enter your city and state above, then build a smart cart to see prices
          </p>
        )}

        {!loadingCart && cart.length > 0 && cart.map((c, i) => {
          const sorted = [...(c.results ?? [])].sort((a: any, b: any) => Number(a.price ?? 9999) - Number(b.price ?? 9999))
          const cheapest = sorted[0]
          const priciest = sorted[sorted.length - 1]
          const bigDiff = cheapest && priciest && (priciest.price - cheapest.price) >= 1

          return (
            <div key={i} className={styles.itemWrap}>
              <div className={styles.item}>
                <span className={styles.itemName}>{c.item}</span>
                {cheapest && (
                  <>
                    <span className={styles.priceBadge}>${Number(cheapest.price).toFixed(2)}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{cheapest.store}</span>
                    {bigDiff && (
                      <span style={{ fontSize: 11, color: 'var(--accent-warm)', fontWeight: 600 }}>
                        save ${(priciest.price - cheapest.price).toFixed(2)} vs {priciest.store}
                      </span>
                    )}
                  </>
                )}
              </div>
              {sorted.length > 1 && (
                <div style={{ paddingLeft: 16, fontSize: 12, color: 'var(--ink-muted)' }}>
                  {sorted.slice(1).map((r: any, j: number) => (
                    <span key={j} style={{ marginRight: 12 }}>{r.store} ${Number(r.price).toFixed(2)}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
