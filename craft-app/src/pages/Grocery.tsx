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

interface ProductMatch {
  id: string
  item_name: string
  product_name: string
  product_url: string
  retailer: string
  price: number
  external_id: string
  image_url: string
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
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([])
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [priceForm, setPriceForm] = useState<{ store: string; price: string }>({ store: '', price: '' })

  useEffect(() => {
  fetchItems()
  fetchSavedLists()
  fetchPrices()
  fetchProductMatches()
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

  async function fetchProductMatches() {
  const { data } = await supabase
    .from('grocery_product_matches')
    .select('*')
    .order('created_at', { ascending: false })

  setProductMatches(
  results.flatMap(r =>
    (r.results ?? []).map((p: any) => ({
      id: crypto.randomUUID(),
      item_name: r.item,
      product_name: p.name,
      retailer: p.store,
      price: p.price ?? 0
    }))
  )
)
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

  async function searchProduct(itemName: string) {
  const q = encodeURIComponent(itemName)

  const res = await fetch(`/api/product-search?q=${q}`)
  if (!res.ok) return null

  return await res.json()
}
  
async function buildSmartCart() {
  const needItems = items.filter(i => !i.checked)

  const results = await Promise.all(
    needItems.map(async (item) => {
      const res = await fetch(`/api/product-search?q=${encodeURIComponent(item.name)}`)
      const data = await res.json()

      return {
        item: item.name,
        results: Array.isArray(data) ? data : []
      }
    })
  )

  setCart(results)
}

  function refreshSmartCart() {
  setCart([])
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
  const url = `https://www.instacart.com/store/s?k=${query}`

  window.open(url, '_blank')

  setPriceForm({
    store: 'Instacart',
    price: '',
  })

  setExpandedItem(itemId)
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

  function searchEntireListOnInstacart() {
  const needItems = items.filter(i => !i.checked)

  if (!needItems.length) return

  const query = encodeURIComponent(
    needItems
      .map(i => `${i.qty ? i.qty + ' ' : ''}${i.name}`)
      .join(' ')
  )

  window.open(
    `https://www.instacart.com/store/s?k=${query}`,
    '_blank'
  )
}

  const needs = items.filter(i => !i.checked)
  const have  = items.filter(i =>  i.checked)

  function storeTally() {
  const storeCounts = new Map<string, number>()

  cart.forEach(c => {
    c.results?.forEach((r: any) => {
      if (!r.store) return
      storeCounts.set(r.store, (storeCounts.get(r.store) ?? 0) + 1)
    })
  })

  return Array.from(storeCounts.entries())
    .map(([store, count]) => ({ store, count }))
    .sort((a, b) => b.count - a.count)
}


  const tally = storeTally()
  const totalTracked = tally.reduce((sum, t) => sum + t.count, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}><i className="ti ti-shopping-cart" aria-hidden="true" /> grocery list</h1>
        <div style={{display:'flex',gap:8}}>

          <button onClick={buildSmartCart}>
  Build Smart Cart
</button>

  <button onClick={refreshSmartCart}>
  Refresh
</button>

  <button onClick={clearSmartCart}>
  Clear
</button>
          
          <button className="btn-ghost" onClick={() => setShowSaved(!showSaved)}>
            <i className="ti ti-history" aria-hidden="true" /> saved lists {savedLists.length > 0 && `(${savedLists.length})`}
          </button>
          
          <button className="btn-primary" onClick={openShoppingList} disabled={!needs.length}>
            <i className="ti ti-clipboard-list" aria-hidden="true" /> copy list & open notes
          </button>
        </div>
      </div>

      {/* save list row */}
      <div className={styles.saveRow}>
        <input type="text" placeholder="name this list (optional)..." value={listName}
          onChange={e => setListName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && saveList()}
          style={{flex:2}} />
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
            ? <p style={{fontSize:12,color:'var(--ink-muted)',padding:'0.5rem 0'}}>no saved lists yet</p>
            : savedLists.map(list => (
              <div key={list.id} className={styles.savedListRow}>
                <div>
                  <div className={styles.savedListName}>{list.name}</div>
                  <div className={styles.savedListItems}>{list.items.slice(0,5).join(' · ')}{list.items.length > 5 ? ` +${list.items.length - 5} more` : ''}</div>
                </div>
                <button className={styles.removeBtn} onClick={() => deleteSavedList(list.id)}>
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              </div>
            ))
          }
        </div>
      )}

      {/* store leaderboard */}
      {totalTracked > 0 && (
        <div className={`card ${styles.savedPanel}`}>
          <div className={styles.savedPanelTitle}>cheapest store so far</div>
          {tally.map((t, i) => (
            <div key={t.store} className={styles.tallyRow}>
              <span className={styles.tallyRank}>{i + 1}</span>
              <span className={styles.tallyStore}>{t.store}</span>
              <div className={styles.tallyBarTrack}>
                <div className={styles.tallyBarFill} style={{ width: `${(t.count / totalTracked) * 100}%` }} />
              </div>
              <span className={styles.tallyCount}>{t.count}/{totalTracked}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{color:'var(--ink-muted)',fontSize:13}}>loading...</p>
      ) : (
        <div className={styles.layout}>
          <div className="card">
            <div className={styles.colHeader}>
              <span><i className="ti ti-list-check" aria-hidden="true" /> need to buy</span>
              <span className={styles.count}>{needs.length} items</span>
            </div>
            <div className={styles.list}>
              {needs.length === 0
                ? <p style={{textAlign:'center',fontSize:12,color:'var(--ink-muted)',padding:'1rem'}}>list is clear!</p>
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
                              style={{flex:2}}
                            />
                            <input
                              type="number"
                              placeholder="price"
                              value={priceForm.price}
                              onChange={e => setPriceForm(f => ({ ...f, price: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && addPrice(item.name)}
                              style={{flex:1}}
                            />
                            <button className="btn-primary" style={{padding:'6px 10px'}} onClick={() => addPrice(item.name)}>
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
                style={{flex:2}} />
              <input type="text" placeholder="qty" value={newQty}
                onChange={e => setNewQty(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                style={{flex:1,minWidth:0}} />
              <button className="btn-primary" style={{padding:'7px 12px'}} onClick={addItem}>
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
                ? <p style={{textAlign:'center',fontSize:12,color:'var(--ink-muted)',padding:'1rem'}}>nothing checked off yet</p>
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

      <div className="card">
  <div className={styles.colHeader}>
    <span>
      <i className="ti ti-shopping-cart" aria-hidden="true" /> smart cart
    </span>
    <span className={styles.count}>
      {productMatches.length} items
    </span>

      {tally.length > 0 && (
  <div style={{ marginTop: 8, fontSize: 14 }}>
    Best overall store: <strong>{tally[0].store}</strong> ({tally[0].count} items)
  </div>
)}


  </div>

  <div className={styles.list}>

    {cart.length > 0 && cart.map((c, i) => (
  <div key={i}>
    <strong>{c.item}</strong>

    {c.results.map((r: any, j: number) => (
      <div key={j}>
        {r.name} — {r.store} — ${r.price}
      </div>
    ))}
  </div>
))}
    {productMatches.length === 0 ? (
      <p
        style={{
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--ink-muted)',
          padding: '1rem'
        }}
      >
        no smart cart items yet
      </p>
    ) : (
      productMatches.map(match => (
        <div key={match.id} className={styles.item}>
          <div style={{ flex: 1 }}>
            <strong>{match.product_name}</strong>
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-muted)'
              }}
            >
              {match.item_name}
            </div>
          </div>

          <span className={styles.priceBadge}>
            ${Number(match.price ?? 0).toFixed(2)}
          </span>

          <span
            style={{
              fontSize: 12,
              color: 'var(--ink-muted)'
            }}
          >
            {match.retailer}
          </span>
        </div>
      ))
    )}
  </div>
</div>
    </div>
  )
}