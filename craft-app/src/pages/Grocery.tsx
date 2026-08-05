import { useState, useEffect } from 'react';
import type { GroceryItem } from '../types/legacy';
import { supabase } from '../lib/supabase';
import Icon, { type IconName } from '../components/Icon';
import Lantern from "../components/Lantern";
import EmptyState from '../components/EmptyState';
import breadBasketImg from '../assets/illustrations/bread_basket.png';
import hourglassImg from '../assets/illustrations/hourglass.png';
import empty9Img from '../public/icons/empty9.png';
import empty4Img from '../public/icons/empty4.png';


interface GroceryList { id: string; name: string; created_at: string }

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
  icon: IconName
  items: BasicItem[]
}

const BASICS_PRESETS: Record<string, BasicsPreset> = {
  vegan: {
    label: 'Vegan Basics',
    icon: 'apple-carrot',
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
    icon: 'potted-plant',
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
    icon: 'money-bag',
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
  baking: {
    label: 'Baking Basics',
    icon: 'cookbook',
    items: [
      { name: 'All-purpose flour', qty: '5 lb bag' },
      { name: 'Granulated sugar', qty: '4 lb bag' },
      { name: 'Brown sugar', qty: '1 lb bag' },
      { name: 'Powdered sugar', qty: '1 lb bag' },
      { name: 'Baking powder', qty: '1 can' },
      { name: 'Baking soda', qty: '1 box' },
      { name: 'Salt', qty: '1 container' },
      { name: 'Vanilla extract', qty: '1 bottle' },
      { name: 'Unsalted butter', qty: '1 lb' },
      { name: 'Eggs', qty: '1 dozen' },
      { name: 'Milk', qty: '1 carton' },
      { name: 'Vegetable oil', qty: '1 bottle' },
      { name: 'Cocoa powder', qty: '1 container' },
      { name: 'Chocolate chips', qty: '1 bag' },
      { name: 'Ground cinnamon', qty: '1 jar' },
      { name: 'Cornstarch', qty: '1 box' },
      { name: 'Yeast', qty: '1 packet' },
      { name: 'Parchment paper', qty: '1 roll' },
    ],
  },
  breakfast: {
    label: 'Breakfast Basics',
    icon: 'cooking-pot',
    items: [
      { name: 'Eggs', qty: '1 dozen' },
      { name: 'Bread', qty: '1 loaf' },
      { name: 'Rolled oats', qty: '1 container' },
      { name: 'Milk', qty: '1 gallon' },
      { name: 'Greek yogurt', qty: '1 tub' },
      { name: 'Butter', qty: '1 stick pack' },
      { name: 'Bananas', qty: '1 bunch' },
      { name: 'Berries', qty: '1 pack' },
      { name: 'Orange juice', qty: '1 carton' },
      { name: 'Coffee', qty: '1 bag' },
      { name: 'Maple syrup', qty: '1 bottle' },
      { name: 'Pancake mix', qty: '1 box' },
      { name: 'Peanut butter', qty: '1 jar' },
      { name: 'Honey', qty: '1 jar' },
      { name: 'Granola', qty: '1 bag' },
    ],
  },
  spice_rack: {
    label: 'Spice Rack Starter',
    icon: 'basket',
    items: [
      { name: 'Table salt', qty: '1 container' },
      { name: 'Black pepper', qty: '1 grinder' },
      { name: 'Garlic powder', qty: '1 jar' },
      { name: 'Onion powder', qty: '1 jar' },
      { name: 'Paprika', qty: '1 jar' },
      { name: 'Chili powder', qty: '1 jar' },
      { name: 'Ground cumin', qty: '1 jar' },
      { name: 'Dried oregano', qty: '1 jar' },
      { name: 'Dried basil', qty: '1 jar' },
      { name: 'Ground cinnamon', qty: '1 jar' },
      { name: 'Red pepper flakes', qty: '1 jar' },
      { name: 'Bay leaves', qty: '1 jar' },
      { name: 'Italian seasoning blend', qty: '1 jar' },
      { name: 'Cayenne pepper', qty: '1 jar' },
    ],
  },
}

// Smart Cart chain whitelist — only results whose seller name matches one of
// these aliases get kept. This filtering happens AFTER the SerpAPI search
// comes back, not by trying to scope the search query itself — restricting
// at the query level is what caused the old "Walmart or nothing" behavior,
// since Google Shopping doesn't reliably narrow to one retailer that way.
// Key = the canonical name shown in the UI/tally. Value = lowercase
// substrings that identify that chain in a raw seller string (SerpAPI
// results show things like "Walmart.com", "Walmart Supercenter", etc, so
// aliases need to be loose substrings, not exact matches).
//
// This is only the *default* seed list — every user's actual whitelist is
// stored in grocery_settings and editable from Settings, since which chains
// exist near you depends entirely on where you live.
const DEFAULT_ALLOWED_STORES: Record<string, string[]> = {
  'Walmart': ['walmart'],
  'Kroger': ['kroger'],
  'Target': ['target'],
  'Food Lion': ['food lion'],
  'Publix': ['publix'],
  'Harris Teeter': ['harris teeter'],
  'Whole Foods': ['whole foods'],
  "Trader Joe's": ['trader joe'],
  'Aldi': ['aldi'],
}

// Matches a raw seller/store string against the user's store whitelist and
// returns the canonical chain name, or null if it's not on the whitelist.
// Normalizing to the canonical name (rather than just filtering) means
// "Walmart" and "Walmart.com" get grouped together in the tally instead of
// counted as two different stores.
function normalizeStoreName(raw: string | undefined | null, allowedStores: Record<string, string[]>): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  for (const [canonical, aliases] of Object.entries(allowedStores)) {
    if (aliases.some(alias => lower.includes(alias))) return canonical
  }
  return null
}

// Applies the whitelist to a raw results array from the product-search API
// (or from cache). Anything that doesn't match a known chain is dropped
// entirely rather than shown under its raw name — this is what keeps
// random marketplace sellers / instacart-only listings out of the cart.
function filterToAllowedStores(results: any[], allowedStores: Record<string, string[]>): any[] {
  if (!Array.isArray(results)) return []
  return results
    .map(r => ({ ...r, store: normalizeStoreName(r.store, allowedStores) }))
    .filter(r => r.store !== null)
}

export default function Grocery() {
  const [items, setItems] = useState<GroceryItem[]>([])
  const [currentList, setCurrentList] = useState('Default')
  const [lists, setLists] = useState<GroceryList[]>([])
  const [listsLoading, setListsLoading] = useState(true)
  const [newListName, setNewListName] = useState('')
  const [newItem, setNewItem] = useState('')
  const [newQty, setNewQty] = useState('')
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<any[]>([])
  const [loadingCart, setLoadingCart] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)
  const [prices, setPrices] = useState<PriceEntry[]>([])
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [priceForm, setPriceForm] = useState<{ store: string; price: string }>({ store: '', price: '' })
  const [location, setLocation] = useState(() => localStorage.getItem('grocery_location') || '')

  const [showSplitTrip, setShowSplitTrip] = useState(false)

  const [showBasicsModal, setShowBasicsModal] = useState(false)
  const [basicsPreset, setBasicsPreset] = useState<string | null>(null)
  const [basicsChecked, setBasicsChecked] = useState<Set<string>>(new Set())
  const [addingBasics, setAddingBasics] = useState(false)

  const [allowedStores, setAllowedStores] = useState<Record<string, string[]>>(DEFAULT_ALLOWED_STORES)
  const [showStoreSettings, setShowStoreSettings] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreAliases, setNewStoreAliases] = useState('')
  const [storeSettingsLoaded, setStoreSettingsLoaded] = useState(false)

  useEffect(() => {
    supabase.from('grocery_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data?.allowed_stores && Object.keys(data.allowed_stores).length > 0) {
        setAllowedStores(data.allowed_stores)
      }
      setStoreSettingsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!storeSettingsLoaded) return // don't overwrite DB with the default seed before initial load completes
    const timer = setTimeout(() => {
      supabase.from('grocery_settings').upsert({ id: 1, allowed_stores: allowedStores }).then(({ error }) => {
        if (error) console.error('grocery_settings save failed:', error)
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [allowedStores, storeSettingsLoaded])

  function addAllowedStore() {
    const name = newStoreName.trim()
    const aliases = newStoreAliases.trim().toLowerCase()
    if (!name || !aliases) return
    setAllowedStores(prev => ({ ...prev, [name]: aliases.split(',').map(a => a.trim()).filter(Boolean) }))
    setNewStoreName('')
    setNewStoreAliases('')
  }

  function removeAllowedStore(name: string) {
    setAllowedStores(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  useEffect(() => {
    fetchLists()
  }, [])

  useEffect(() => {
    fetchItems()
    fetchPrices()
  }, [currentList])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('grocery_items')
      .select('*')
      .eq('list_name', currentList)
      .order('created_at', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }

  // Lists are their own table now (name + id), separate from the items that
  // live inside them, so a list can exist (and be switched to) even before
  // anything's been added to it. Every list is real/actionable — there's no
  // separate "saved snapshot" concept anymore.
  async function fetchLists() {
    setListsLoading(true)
    const { data } = await supabase
      .from('grocery_lists')
      .select('*')
      .order('created_at', { ascending: true })
    let rows = data ?? []

    if (rows.length === 0) {
      // First run (or table just created) — seed a Default list so there's
      // always at least one to select. This also picks up any items that
      // already exist with list_name = 'Default' from before this table existed.
      const { data: seeded } = await supabase
        .from('grocery_lists')
        .insert({ name: 'Default' })
        .select().single()
      if (seeded) rows = [seeded]
    }

    setLists(rows)
    setListsLoading(false)
    setCurrentList(prev => rows.some(l => l.name === prev) ? prev : (rows[0]?.name ?? 'Default'))
  }

  async function createList() {
    const name = newListName.trim()
    if (!name) return

    const existing = lists.find(l => l.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setCurrentList(existing.name)
      setNewListName('')
      return
    }

    const { data } = await supabase
      .from('grocery_lists')
      .insert({ name })
      .select().single()
    if (data) {
      setLists(prev => [...prev, data])
      setCurrentList(data.name)
    }
    setNewListName('')
  }

  async function deleteList(list: GroceryList) {
    if (lists.length <= 1) return // always keep at least one list around
    if (!window.confirm(`Delete "${list.name}" and everything on it? This can't be undone.`)) return

    await supabase.from('grocery_items').delete().eq('list_name', list.name)
    await supabase.from('grocery_lists').delete().eq('id', list.id)

    setLists(prev => {
      const next = prev.filter(l => l.id !== list.id)
      if (currentList === list.name) setCurrentList(next[0]?.name ?? 'Default')
      return next
    })
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
        .insert({
          name: names[0],
          qty: newQty.trim(),
          checked: false,
          list_name: currentList,
        })
        .select().single()
      if (data) setItems(prev => [...prev, data])
    } else {
      // multiple comma-separated items — one qty doesn't apply to all of
      // them, so each gets added blank and can be filled in individually
      const rows = names.map(name => ({
        name,
        qty: '',
        checked: false,
        list_name: currentList,
      }))
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
      .map(i => ({ name: i.name, qty: i.qty, checked: false, list_name: currentList }))

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

    // Pull any recent cached search results for these items first, so
    // re-triggering a build (refresh, or clicking again while it looks
    // slow) doesn't re-spend a SerpAPI search on something we already
    // fetched a few hours ago. Cache lives 24h — long enough to cover a
    // shopping session's worth of refreshes, short enough that prices
    // don't go stale.
    const CACHE_TTL_HOURS = 24
    const cacheCutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()
    const normalizedNames = Array.from(new Set(needItems.map(i => i.name.toLowerCase().trim())))
    const persistedCache = new Map<string, any[]>()

    if (normalizedNames.length) {
      const { data: cachedRows } = await supabase
        .from('product_search_cache')
        .select('item_name, results, fetched_at')
        .in('item_name', normalizedNames)
        .gte('fetched_at', cacheCutoff)
      ;(cachedRows ?? []).forEach((row: any) => persistedCache.set(row.item_name, row.results))
    }

    try {
      for (let i = 0; i < needItems.length; i += 3) {
        const batch = needItems.slice(i, i + 3)

        const batchResults = await Promise.all(
          batch.map(async (item) => {
            if (cache.has(item.name)) {
              return cache.get(item.name)
            }

            const key = item.name.toLowerCase().trim()
            const cachedResults = persistedCache.get(key)
            if (cachedResults) {
              // Cache stores the RAW (unfiltered) result set on purpose —
              // see note below on why filtering happens at display/tally
              // time instead of before caching.
              const result = { item: item.name, results: cachedResults, cached: true }
              cache.set(item.name, result)
              return result
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

            const resultsArr = Array.isArray(data.results) ? data.results : []
            // NOTE: results are intentionally kept RAW (unfiltered) here —
            // whitelist filtering happens later, at display/tally time via
            // filterToAllowedStores(). Filtering this early was tried and
            // caused a regression: if a whitelisted store had zero results
            // for even one item, the median-fill estimator had nothing left
            // to estimate that item from (since non-whitelisted sellers had
            // already been discarded), which knocked every store out of the
            // "missingCount === 0" ranking in computeTally. Keeping the raw
            // set around means the estimator always has the broadest
            // possible pool to fill gaps from, while the UI still only ever
            // *shows* whitelisted stores.

            // Only persist successful lookups. A real API failure shouldn't
            // get cached as if it were a confirmed "nothing found" — that
            // would hide the failure behind a 24h cache hit next time.
            if (!data.error) {
              supabase.from('product_search_cache')
                .upsert({ item_name: key, results: resultsArr, fetched_at: new Date().toISOString() })
                .then(() => {})
            }

            const result = { item: item.name, results: resultsArr, error: data.error }
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

  function openDoorDashList() {
  const needItems = items.filter(i => !i.checked)
  if (!needItems.length) return

  const listText = needItems
    .map(i => `${i.qty ? i.qty + ' ' : ''}${i.name}`)
    .join('\n')

  navigator.clipboard?.writeText(listText).then(() => {
    // Open the DoorDash app if installed
    window.location.href = 'doordash://'

    setTimeout(() => {
      alert(
        'Your grocery list has been copied!\n\nOpen DoorDash and paste it into the search or shopping list.'
      )
    }, 500)
  }).catch(() => {
    alert(`Copy failed — here's your list:\n\n${listText}`)
  })
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
  // being excluded or only partially totaled.
  //
  // Two different pools are used on purpose:
  // - "allStores" (what gets ranked/shown) comes from the WHITELISTED
  //   results only — only ALLOWED_STORES chains ever appear in the
  //   leaderboard.
  // - "perItemMedian" (what fills gaps) is computed from the RAW/unfiltered
  //   results — every seller SerpAPI returned, whitelisted or not. This is
  //   what keeps the estimator working even when a whitelisted store has no
  //   direct result for a given item; if it only drew from the whitelisted
  //   subset, one item with zero whitelisted hits would have no median to
  //   fall back on and would knock every store out of the ranking.
  // Shared by computeTally and computeSplitTrip so both work off the exact
  // same pricing data — one pass over the cart's raw search results builds
  // every map either function needs, instead of each re-deriving its own
  // (and risking the two drifting out of sync with each other).
  function buildPriceMaps(cartData: any[]) {
    const allStores = new Set<string>()
    cartData.forEach(c => {
      filterToAllowedStores(c.results ?? [], allowedStores).forEach((r: any) => {
        if (r.store && r.price != null) allStores.add(r.store)
      })
    })

    // item -> (whitelisted store -> cheapest real price at that store)
    const perItemStorePrice = new Map<string, Map<string, number>>()
    // item -> median price across the FULL raw seller pool (any store)
    const perItemMedian = new Map<string, number>()

    cartData.forEach(c => {
      // Real prices: only from whitelisted stores, since that's all we rank
      const whitelisted = filterToAllowedStores(c.results ?? [], allowedStores)
      const byStore = new Map<string, number>()
      whitelisted.forEach((r: any) => {
        if (!r.store || r.price == null) return
        if (!byStore.has(r.store) || r.price < byStore.get(r.store)!) {
          byStore.set(r.store, r.price)
        }
      })
      perItemStorePrice.set(c.item, byStore)

      // Median: from the full raw pool (every seller, not just whitelisted)
      // so there's always the broadest possible basis for an estimate.
      const rawByStore = new Map<string, number>()
      ;(c.results ?? []).forEach((r: any) => {
        if (!r.store || r.price == null) return
        if (!rawByStore.has(r.store) || r.price < rawByStore.get(r.store)!) {
          rawByStore.set(r.store, r.price)
        }
      })
      const prices = Array.from(rawByStore.values()).sort((a, b) => a - b)
      if (prices.length > 0) {
        const mid = Math.floor(prices.length / 2)
        const median = prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2
        perItemMedian.set(c.item, median)
      }
    })

    return { allStores, perItemStorePrice, perItemMedian }
  }

  function computeTally(cartData: any[]) {
    const totalTracked = cartData.length
    if (totalTracked === 0) return []

    const { allStores, perItemStorePrice, perItemMedian } = buildPriceMaps(cartData)

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

  // Split-trip: instead of picking one store for the whole list, send each
  // item to whichever whitelisted store has the lowest REAL price for it.
  // Items with no real price anywhere get parked at the single cheapest
  // store (from computeTally) using the same median estimate that store
  // would've gotten anyway — so a gap in the data never becomes its own
  // phantom stop. Only worth showing if it actually beats the best
  // single-store total and doesn't fragment the list too much.
  function computeSplitTrip(cartData: any[]) {
    if (cartData.length === 0) return null

    const { perItemStorePrice, perItemMedian } = buildPriceMaps(cartData)
    const singleStore = computeTally(cartData)[0]
    if (!singleStore) return null

    const stops = new Map<string, { store: string; items: { name: string; price: number; estimated: boolean }[]; subtotal: number }>()

    cartData.forEach(c => {
      const byStore = perItemStorePrice.get(c.item)
      let bestStore: string | null = null
      let bestPrice = Infinity
      byStore?.forEach((price, store) => {
        if (price < bestPrice) { bestPrice = price; bestStore = store }
      })

      let store: string
      let price: number
      let estimated: boolean
      if (bestStore != null) {
        store = bestStore
        price = bestPrice
        estimated = false
      } else {
        // No real price anywhere for this item — park it at the single
        // cheapest store using its median estimate rather than inventing
        // a new stop for one unpriced item.
        store = singleStore.store
        price = perItemMedian.get(c.item) ?? 0
        estimated = true
      }

      if (!stops.has(store)) stops.set(store, { store, items: [], subtotal: 0 })
      const stop = stops.get(store)!
      stop.items.push({ name: c.item, price, estimated })
      stop.subtotal += price
    })

    const stopList = Array.from(stops.values()).sort((a, b) => b.subtotal - a.subtotal)
    const total = stopList.reduce((sum, s) => sum + s.subtotal, 0)
    const savings = singleStore.total - total

    return {
      stops: stopList,
      total,
      singleStoreName: singleStore.store,
      singleStoreTotal: singleStore.total,
      savings,
      worthIt: stopList.length > 1 && savings > 0.5,
    }
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
        <div className="title-row">
          <h2>Grocery List <Icon name="basket" size={22} /></h2>
          <Lantern size={50} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={openBasicsModal}>
            <Icon name="icon-listchecks" size={20} /> Build Basics List
          </button>
          <button className="btn btn-primary" onClick={buildSmartCart}>
            <Icon name="shopping-cart" size={20} /> Build Smart Cart
          </button>
          <button className="btn btn-secondary" onClick={refreshSmartCart}>
            <Icon name="icon-recur" size={20} /> Refresh
          </button>
          <button className="btn btn-ghost" onClick={clearSmartCart}>
            <Icon name="icon-clear" size={20} /> Clear
          </button>
          <button className="btn btn-primary" onClick={openDoorDashList} disabled={!needs.length}>
          <Icon name="icon-externallink" size={20} /> Copy List &amp; Open DoorDash
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Build Basics List modal */}
        {showBasicsModal && (
          <div className="modal-overlay" onClick={() => setShowBasicsModal(false)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {basicsPreset
                    ? <><Icon name={BASICS_PRESETS[basicsPreset].icon} size={18} /> {BASICS_PRESETS[basicsPreset].label}</>
                    : 'Build a Basics List'}
                </h3>
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
                          <span style={{ fontSize: '1.4rem' }}>
                            <Icon name={preset.icon} size={24} />
                          </span>
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
                        <Icon name="icon-arrowleft" size={13} /> Back
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
                            <Icon name={checked ? 'flowerfull' : 'flowerempty'} size={18} />
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
          <Icon name="icon-mappin" size={16} style={{ color: 'var(--ink-muted)', flexShrink: 0 }} />
          <input
            className="form-input"
            type="text"
            placeholder="City, state (e.g. your city, your state)…"
            value={location}
            onChange={e => saveLocation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buildSmartCart()}
            style={{ width: 280 }}
          />
          <button className="btn btn-primary" onClick={buildSmartCart} disabled={!location}>
            Build Smart Cart for {location}
          </button>
          <button className="btn btn-ghost" onClick={() => setShowStoreSettings(s => !s)}>
            <Icon name="icon-slidershorizontal" size={14} /> Stores ({Object.keys(allowedStores).length})
          </button>
        </div>

        {showStoreSettings && (
          <div className="card" style={{ marginTop: 8 }}>
            <div className="section-label">Stores Smart Cart Will Search</div>
            <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 10 }}>
              Only chains on this list are matched against search results — everything else gets filtered out. Add whatever's actually near you; remove ones that aren't.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {Object.entries(allowedStores).map(([name, aliases]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-muted)' }}>matches: {aliases.join(', ')}</div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => removeAllowedStore(name)}>
                    <Icon name="icon-trash2" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                className="form-input" type="text" placeholder="Store name (e.g. H-E-B)"
                value={newStoreName} onChange={e => setNewStoreName(e.target.value)}
                style={{ width: 160 }}
              />
              <input
                className="form-input" type="text" placeholder="Match text, comma-separated (e.g. heb, h-e-b)"
                value={newStoreAliases} onChange={e => setNewStoreAliases(e.target.value)}
                style={{ width: 220 }}
              />
              <button className="btn btn-primary" onClick={addAllowedStore} disabled={!newStoreName.trim() || !newStoreAliases.trim()}>
                Add
              </button>
            </div>
          </div>
        )}

        {/* my lists — every list here is a real, live list you can switch
            to, add/check off items on, and come back to later. nothing is
            just a static snapshot. */}
        <div className="card">
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="icon-listchecks" size={13} /> My Lists</span>
            <span style={{ fontWeight: 500 }}>{lists.length} list{lists.length === 1 ? '' : 's'}</span>
          </div>

          {listsLoading ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Loading lists…</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {lists.map(list => {
                const active = currentList === list.name
                return (
                  <div key={list.id} style={{ display: 'flex', alignItems: 'stretch' }}>
                    <button
                      onClick={() => setCurrentList(list.name)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: lists.length > 1 ? 'var(--radius-md) 0 0 var(--radius-md)' : 'var(--radius-md)',
                        border: `1.5px solid ${active ? 'var(--pink)' : 'var(--border)'}`,
                        background: active ? 'var(--pink)' : 'var(--white)',
                        color: active ? 'var(--white)' : 'var(--ink)',
                        fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                      }}
                    >
                      {list.name}
                    </button>
                    {lists.length > 1 && (
                      <button
                        onClick={() => deleteList(list)}
                        title={`Delete ${list.name}`}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                          border: `1.5px solid ${active ? 'var(--pink)' : 'var(--border)'}`,
                          borderLeft: 'none',
                          background: active ? 'var(--pink)' : 'var(--white)',
                          color: active ? 'var(--white)' : 'var(--ink-muted)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Icon name="icon-trash2" size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="form-input"
              type="text"
              placeholder="New list name (e.g. Costco Run)…"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createList()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={createList} disabled={!newListName.trim()}>
              <Icon name="icon-folderplus" size={20} /> New List
            </button>
          </div>
        </div>

        <Lantern variant="divider" />

        {have.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={clearChecked}>
              <Icon name="icon-trash2" size={20} /> Clear Checked
            </button>
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
<EmptyState image={empty9Img} message="No products found...Refresh or try again." />
      
    
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

        {/* split-trip mode — spread the list across stores if it actually saves money */}
        {(() => {
          if (cart.length === 0 || cartError) return null
          const split = computeSplitTrip(cart)
          if (!split || !split.worthIt) return null

          return (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div className="section-label" style={{ marginBottom: 0 }}>Split Trip Saves ${split.savings.toFixed(2)}</div>
                <button className="btn btn-ghost" onClick={() => setShowSplitTrip(s => !s)} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                  {showSplitTrip ? 'Hide' : 'Show'}
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', margin: '4px 0 0' }}>
                Buying everything at {split.singleStoreName} runs ${split.singleStoreTotal.toFixed(2)}. Splitting across {split.stops.length} stores brings it to ${split.total.toFixed(2)}.
              </p>
              {showSplitTrip && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {split.stops.map(stop => (
                    <div key={stop.store} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.82rem' }}>{stop.store}</span>
                        <span style={priceBadgeStyle(false)}>${stop.subtotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                        {stop.items.map(it => (
                          <div key={it.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                            <span>{it.name}{it.estimated ? ' (est.)' : ''}</span>
                            <span>${it.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {loading ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem' }}>Loading…</p>
        ) : (
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="icon-clipboardlist" size={13} /> Need to Buy</span>
                <span style={{ fontWeight: 500 }}>{needs.length} items</span>
              </div>
    <p className="daily-tasks-subtitle">Tap the flower to check it off...</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto', marginBottom: 12 }}>
                {needs.length === 0
                  ? 
      <EmptyState image={empty4Img} message="Nothing here yet." />
    
                  : needs.map(item => {
                    const cheapest = cheapestFor(item.name)
                    const itemPrices = pricesFor(item.name)
                    const isOpen = expandedItem === item.id
                    return (
                      <div key={item.id}>
                        <div style={itemRowStyle(false)}>
                          <button onClick={() => toggle(item.id, item.checked)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                            <Icon name="flowerempty" size={20} />
                          </button>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{item.name}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{item.qty}</span>
                          {cheapest && (
                            <span style={priceBadgeStyle(isStale(cheapest.updated_at))}>
                              ${cheapest.price.toFixed(2)} @ {cheapest.store}
                            </span>
                          )}
                          <button onClick={() => setExpandedItem(isOpen ? null : item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', display: 'flex', flexShrink: 0 }}>
                            {isOpen ? <Icon name="icon-chevronup" size={13} /> : <Icon name="icon-chevrondown" size={13} />}
                          </button>
                          <button onClick={() => removeItem(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', opacity: 0.4, display: 'flex', flexShrink: 0 }}>
                            <Icon name="icon-trash2" size={13} />
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
                                      <Icon name="icon-clear" size={12} />
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
                                <Icon name="icon-plus" size={13} />
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
                  <Icon name="icon-plus" size={20} />
                </button>
              </div>
            </div>

            <div className="card">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="groq_7" size={13} /> Already Have</span>
                <span style={{ fontWeight: 500 }}>{have.length} items</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                {have.length === 0
                  ? <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '12px 0' }}><Icon name="empty_jar" size={60} />Nothing checked off yet!</span>

                  : have.map(item => (
                    <div key={item.id} style={itemRowStyle(true)}>
                      <button onClick={() => toggle(item.id, item.checked)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                        <Icon name="flowerfull" size={20} />
                      </button>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-muted)', textDecoration: 'line-through' }}>{item.name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{item.qty}</span>
                      <button onClick={() => removeItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', opacity: 0.4, display: 'flex', flexShrink: 0 }}>
                        <Icon name="icon-trash2" size={13} />
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        <Lantern variant="divider" />

        {/* smart cart */}
        <div className="card">
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="shopping-cart" size={20} /> Smart Cart</span>
            <span style={{ fontWeight: 500 }}>{cart.length} items</span>
          </div>

          {loadingCart && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0', gap: 10 }}>
              <img src={hourglassImg} alt="" style={{ width: 120, animation: 'groceryHamsterPulse 1.4s ease-in-out infinite' }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Finding prices…</p>
              <style>{`
                @keyframes groceryHamsterPulse {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.08); opacity: 0.8; }
                }
              `}</style>
            </div>
          )}

          {!loadingCart && cart.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--ink-muted)', padding: '1rem' }}>
              Enter your city and state above, then build a smart cart to see prices.
            </p>
          )}

          {!loadingCart && cart.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cart.map((c, i) => {
                // c.results is the raw/unfiltered seller list (kept that way
                // for the median estimator) — filter to whitelisted stores
                // here so the visible per-item list only shows chains from
                // ALLOWED_STORES, same as the leaderboard above.
                const sorted = filterToAllowedStores(c.results ?? [], allowedStores)
                  .sort((a: any, b: any) => Number(a.price ?? 9999) - Number(b.price ?? 9999))
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
                          {c.cached && (
                            <span style={{ fontSize: '0.62rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>cached</span>
                          )}
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
                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>no matches at whitelisted stores</span>
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