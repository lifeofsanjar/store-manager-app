import { useEffect, useState } from 'react'
import { ApiError, api } from '../api.js'
import { Button, EmptyState, Field, LoadingState, money, Notice, PageHeading, Panel, ProductLookup } from '../components.jsx'
import { TEXT } from '../text.js'

function valueIsInvalid(value, number) {
  return value === '' || !Number.isSafeInteger(number) || number < 0
}

export default function StockView({ token, role }) {
  const [product, setProduct] = useState(null)
  const [count, setCount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState(null)
  const [draft, setDraft] = useState({ stock_qty: '', buy_price: '', sell_price: '' })
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    let active = true
    setProductsLoading(true)
    api('/products/', { token })
      .then((rows) => { if (active) setProducts(rows) })
      .catch((caught) => { if (active) setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic) })
      .finally(() => { if (active) setProductsLoading(false) })
    return () => { active = false }
  }, [token])

  async function saveProductStock(target, value) {
    const stockQty = Number(value)
    if (!target || value === '' || !Number.isSafeInteger(stockQty) || stockQty < 0) {
      setError(TEXT.errors.invalid)
      return false
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const updated = await api(`/products/${target.id}/stock/`, {
        token,
        method: 'PATCH',
        body: { stock_qty: stockQty },
      })
      setProducts((rows) => rows.map((row) => row.id === updated.id ? updated : row))
      setProduct((current) => current?.id === updated.id ? updated : current)
      if (product?.id === updated.id) setCount(String(updated.stock_qty))
      setSuccess(TEXT.messages.stockSaved)
      return true
    } catch (caught) {
      setError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic)
      return false
    } finally {
      setLoading(false)
    }
  }

  async function saveSelected(event) {
    event.preventDefault()
    await saveProductStock(product, count)
  }

  function startEditing(item) {
    setEditingProduct(item)
    setDraft({
      stock_qty: String(item.stock_qty),
      buy_price: String(item.buy_price),
      sell_price: String(item.sell_price),
    })
    setModalError('')
    setError('')
    setSuccess('')
  }

  async function saveModal(event) {
    event.preventDefault()
    const stockQty = Number(draft.stock_qty)
    const payload = { stock_qty: stockQty }
    if (valueIsInvalid(draft.stock_qty, stockQty)) {
      setModalError(TEXT.errors.invalid)
      return
    }
    if (role === 'owner') {
      payload.buy_price = Number(draft.buy_price)
      payload.sell_price = Number(draft.sell_price)
      if (valueIsInvalid(draft.buy_price, payload.buy_price) || valueIsInvalid(draft.sell_price, payload.sell_price)) {
        setModalError(TEXT.errors.invalid)
        return
      }
    }

    setModalSaving(true)
    setModalError('')
    setError('')
    setSuccess('')
    try {
      const updated = await api(`/products/${editingProduct.id}/stock/`, {
        token,
        method: 'PATCH',
        body: payload,
      })
      setProducts((rows) => rows.map((row) => row.id === updated.id ? updated : row))
      setProduct((current) => current?.id === updated.id ? updated : current)
      if (product?.id === updated.id) setCount(String(updated.stock_qty))
      setSuccess(TEXT.messages.stockSaved)
      setEditingProduct(null)
    } catch (caught) {
      setModalError(caught instanceof ApiError ? TEXT.errors[caught.code] || TEXT.errors.generic : TEXT.errors.generic)
    } finally {
      setModalSaving(false)
    }
  }

  return (
    <>
      <PageHeading icon="stock" title={TEXT.headings.stock} description={TEXT.descriptions.stock} />
      <Panel className="mt-5">
        <ProductLookup token={token} onSelect={(value) => { setProduct(value); setCount(String(value.stock_qty)); setSuccess(''); setError('') }} />
        {product ? (
          <form onSubmit={saveSelected} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-800">{product.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{product.barcode} · {TEXT.labels.buyPrice}: {money(product.buy_price)}</p>
              </div>
              {product.stock_qty < product.min_stock && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{TEXT.errors.lowStockWarning}</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,240px)_auto] sm:items-end">
              <Field label={TEXT.labels.stockCount} type="number" min="0" step="1" value={count} onChange={(event) => setCount(event.target.value)} required />
              <Button type="submit" disabled={loading}>{loading ? TEXT.messages.saving : TEXT.actions.saveStock}</Button>
            </div>
            {error && <div className="mt-4"><Notice>{error}</Notice></div>}
            {success && <div className="mt-4"><Notice tone="success">{success}</Notice></div>}
          </form>
        ) : <div className="mt-4"><EmptyState>{TEXT.messages.searchPrompt}</EmptyState></div>}
      </Panel>
      <Panel className="mt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">{TEXT.headings.allProducts}</h2>
            <p className="mt-1 text-sm text-slate-500">{products.length} {TEXT.labels.item.toLowerCase()}</p>
          </div>
        </div>
        {error && <div className="mb-4"><Notice>{error}</Notice></div>}
        {success && <div className="mb-4"><Notice tone="success">{success}</Notice></div>}
        {productsLoading ? <LoadingState /> : products.length ? (
          <div className="space-y-2.5">
            {products.map((item) => {
              const lowStock = item.stock_qty < item.min_stock
              return <article key={item.id} className="rounded-xl border border-slate-200 p-3.5 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-800">{item.name}</h3>
                      {lowStock && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{TEXT.errors.lowStockWarning}</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{TEXT.labels.barcode}: {item.barcode}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>{TEXT.labels.buyPrice}: {money(item.buy_price)}</span>
                      <span>{TEXT.labels.sellPrice}: {money(item.sell_price)}</span>
                      <span>{TEXT.labels.minStock}: {item.min_stock}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <div className="text-xs text-slate-500">{TEXT.labels.stockCount}</div>
                      <div className={`mt-0.5 text-lg font-bold ${lowStock ? 'text-amber-700' : 'text-slate-800'}`}>{item.stock_qty} {TEXT.labels.quantity.toLowerCase()}</div>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => startEditing(item)}>{TEXT.actions.edit}</Button>
                  </div>
                </div>
              </article>
            })}
          </div>
        ) : <EmptyState>{TEXT.messages.productsEmpty}</EmptyState>}
      </Panel>
      {editingProduct && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={() => !modalSaving && setEditingProduct(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="stock-edit-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="stock-edit-title" className="text-lg font-bold text-slate-900">{TEXT.headings.editProduct}</h2>
              <p className="mt-1 text-sm text-slate-500">{editingProduct.name} · {editingProduct.barcode}</p>
            </div>
            <button type="button" aria-label={TEXT.actions.cancel} disabled={modalSaving} onClick={() => setEditingProduct(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl font-bold leading-none text-slate-600 transition hover:bg-brand-50 hover:text-slate-900 disabled:opacity-50">x</button>
          </div>
          <form onSubmit={saveModal} className="space-y-4">
            <Field autoFocus label={TEXT.labels.stockCount} type="number" min="0" step="1" value={draft.stock_qty} onChange={(event) => setDraft((value) => ({ ...value, stock_qty: event.target.value }))} required />
            {role === 'owner' && <div className="grid gap-4 sm:grid-cols-2">
              <Field label={TEXT.labels.buyPrice} type="number" min="0" step="1" value={draft.buy_price} onChange={(event) => setDraft((value) => ({ ...value, buy_price: event.target.value }))} required />
              <Field label={TEXT.labels.sellPrice} type="number" min="0" step="1" value={draft.sell_price} onChange={(event) => setDraft((value) => ({ ...value, sell_price: event.target.value }))} required />
            </div>}
            {modalError && <Notice>{modalError}</Notice>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" disabled={modalSaving} onClick={() => setEditingProduct(null)}>{TEXT.actions.cancel}</Button>
              <Button type="submit" disabled={modalSaving}>{modalSaving ? TEXT.messages.saving : TEXT.actions.save}</Button>
            </div>
          </form>
        </section>
      </div>}
    </>
  )
}
