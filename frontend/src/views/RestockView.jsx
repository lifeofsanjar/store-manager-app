import { useState } from 'react'
import { ApiError, api } from '../api.js'
import { Button, EmptyState, Field, money, Notice, PageHeading, Panel, ProductLookup } from '../components.jsx'
import { TEXT } from '../text.js'

export default function RestockView({ token }) {
  const [mode, setMode] = useState('existing')
  const [selected, setSelected] = useState(null)
  const [quantity, setQuantity] = useState('1')
  const [buyPrice, setBuyPrice] = useState('')
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', sell_price: '', min_stock: '0' })
  const [cart, setCart] = useState([])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function addExisting() {
    if (!selected) {
      setError(TEXT.errors.missingProduct)
      return
    }
    const count = Number(quantity)
    const cost = Number(buyPrice)
    if (!Number.isSafeInteger(count) || count <= 0 || !Number.isSafeInteger(cost) || cost < 0) {
      setError(TEXT.errors.invalid)
      return
    }
    setCart((items) => [...items, {
      key: `existing-${selected.id}-${Date.now()}`,
      product_id: selected.id,
      name: selected.name,
      barcode: selected.barcode,
      quantity: count,
      buy_price: cost,
    }])
    setSelected(null)
    setQuantity('1')
    setBuyPrice('')
    setError('')
  }

  function addNew(event) {
    event.preventDefault()
    const count = Number(quantity)
    const cost = Number(buyPrice)
    const sell = Number(newProduct.sell_price)
    const min = Number(newProduct.min_stock || 0)
    if (!Number.isSafeInteger(count) || count <= 0 || !Number.isSafeInteger(cost) || cost < 0 || !Number.isSafeInteger(sell) || sell < 0 || !Number.isSafeInteger(min) || min < 0) {
      setError(TEXT.errors.invalid)
      return
    }
    setCart((items) => [...items, {
      key: `new-${newProduct.barcode}-${Date.now()}`,
      name: newProduct.name.trim(),
      barcode: newProduct.barcode.trim(),
      quantity: count,
      buy_price: cost,
      new_product: {
        name: newProduct.name.trim(),
        barcode: newProduct.barcode.trim(),
        sell_price: sell,
        min_stock: min,
      },
    }])
    setNewProduct({ name: '', barcode: '', sell_price: '', min_stock: '0' })
    setQuantity('1')
    setBuyPrice('')
    setError('')
  }

  async function submitRestock(event) {
    event.preventDefault()
    if (!cart.length) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await api('/restocks/', {
        token,
        method: 'POST',
        body: {
          note,
          items: cart.map(({ key, name, barcode, ...item }) => item),
        },
      })
      setSuccess(`${TEXT.messages.restockSaved} · #${result.id}`)
      setCart([])
      setNote('')
    } catch (caught) {
      setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeading title={TEXT.headings.restock} description={TEXT.descriptions.restock} />
      {success && <Notice tone="success">{success}</Notice>}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <Panel>
          <div className="flex gap-2 rounded-xl bg-[#f3f6f2] p-1.5">
            {[
              ['existing', TEXT.labels.existingProduct],
              ['new', TEXT.labels.newProduct],
            ].map(([value, label]) => (
              <button
                key={value} type="button" onClick={() => { setMode(value); setSelected(null); setError('') }}
                aria-pressed={mode === value}
                className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition ${mode === value ? 'bg-white text-[#1b4937] shadow-sm' : 'text-[#77847b] hover:text-[#1b4937]'}`}
              >{label}</button>
            ))}
          </div>

          {mode === 'existing' ? (
            <div className="mt-5 space-y-4">
              <ProductLookup token={token} onSelect={(product) => { setSelected(product); setBuyPrice(String(product.buy_price)); setQuantity('1') }} />
              {selected && (
                <div className="rounded-2xl border border-[#dce8de] bg-[#f7faf7] p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#253c30]">{selected.name}</div>
                      <div className="mt-1 text-xs text-[#819087]">{selected.barcode} · {TEXT.labels.lowStock}: {selected.stock_qty}</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-[#456252]">{money(selected.sell_price)}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={TEXT.labels.quantity} type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                    <Field label={TEXT.labels.buyPrice} type="number" min="0" step="1" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} required />
                  </div>
                  <Button type="button" className="mt-4 w-full sm:w-auto" onClick={addExisting}>{TEXT.actions.addLine}</Button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={addNew} className="mt-5 space-y-4">
              <Notice tone="info">{TEXT.messages.newProductHint}</Notice>
              <Field label={TEXT.labels.productName} value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} required />
              <Field label={TEXT.labels.barcode} value={newProduct.barcode} onChange={(event) => setNewProduct({ ...newProduct, barcode: event.target.value })} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={TEXT.labels.sellPrice} type="number" min="0" step="1" value={newProduct.sell_price} onChange={(event) => setNewProduct({ ...newProduct, sell_price: event.target.value })} required />
                <Field label={TEXT.labels.minStock} type="number" min="0" step="1" value={newProduct.min_stock} onChange={(event) => setNewProduct({ ...newProduct, min_stock: event.target.value })} />
                <Field label={TEXT.labels.quantity} type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
                <Field label={TEXT.labels.buyPrice} type="number" min="0" step="1" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} required />
              </div>
              <Button type="submit" variant="secondary" className="w-full sm:w-auto">{TEXT.actions.addLine}</Button>
            </form>
          )}
          {error && <div className="mt-4"><Notice>{error}</Notice></div>}
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#253c30]">{TEXT.labels.total}</h2>
            <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#4a6756]">{cart.length}</span>
          </div>
          {cart.length ? (
            <div className="space-y-2.5">
              {cart.map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-3 rounded-xl border border-[#e8ede7] p-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#283e32]">{item.name}</div>
                    <div className="mt-1 text-xs text-[#87928a]">{item.barcode} · {item.quantity} × {money(item.buy_price)}</div>
                    {item.new_product && <span className="mt-2 inline-flex rounded-full bg-[#eef5ef] px-2 py-1 text-[11px] font-semibold text-[#477555]">{TEXT.labels.newProduct}</span>}
                  </div>
                  <button type="button" onClick={() => setCart((rows) => rows.filter((row) => row.key !== item.key))} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[#a14a44] hover:bg-[#fff4f2]">{TEXT.actions.remove}</button>
                </div>
              ))}
            </div>
          ) : <EmptyState>{TEXT.messages.emptyCart}</EmptyState>}
          <form onSubmit={submitRestock} className="mt-4 border-t border-[#edf0eb] pt-4">
            <Field label={TEXT.labels.note} value={note} onChange={(event) => setNote(event.target.value)} />
            <Button type="submit" className="mt-4 w-full" disabled={!cart.length || loading}>
              {loading ? TEXT.messages.saving : TEXT.actions.acceptStock}
            </Button>
          </form>
        </Panel>
      </div>
    </>
  )
}
