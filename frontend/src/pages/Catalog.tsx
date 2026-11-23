import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { CATEGORY_LABEL, formatPrice, specLine } from '@/lib/labels'
import type { Category, Component } from '@/types/api'

const TABS: (Category | 'all')[] = [
  'all',
  'processor',
  'motherboard',
  'memory',
  'video_card',
  'power_supply',
  'case',
]

export default function Catalog() {
  const [tab, setTab] = useState<Category | 'all'>('all')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Component[]>([])
  const [detail, setDetail] = useState<Component | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .listComponents({ ...(tab === 'all' ? {} : { category: tab }), ...(q ? { q } : {}) })
        .then((r) => setItems(r.items))
        .catch(() => setError('Сервер недоступен. Запустите backend: uvicorn app.main:app --port 8000'))
    }, 200)
    return () => clearTimeout(t)
  }, [tab, q])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#16181D]">Комплектующие</h1>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              tab === t
                ? 'bg-[#16181D] text-white'
                : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
            }`}
          >
            {t === 'all' ? 'Все' : CATEGORY_LABEL[t]}
          </button>
        ))}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию"
          aria-label="Поиск по названию"
          className="ml-auto rounded-lg border border-[#E8E9EE] px-3 py-2 text-sm outline-none focus:border-[#2E44D6]"
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">
          {error}
        </p>
      )}

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => api.componentDetail(c.id).then(setDetail).catch(() => {})}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-[#E8E9EE] bg-white px-4 py-3 text-left transition-colors hover:border-[#2E44D6]"
            >
              <span className="min-w-0">
                <span className="block text-xs text-[#6B6F7B]">{CATEGORY_LABEL[c.category]}</span>
                <span className="block truncate text-sm font-semibold text-[#16181D]">{c.name}</span>
                <span className="block text-xs text-[#6B6F7B]">{specLine(c)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-[#16181D]">
                  {formatPrice(c.best_price)}
                </span>
                <span className="block text-xs text-[#6B6F7B]">{c.price_source?.store ?? ''}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => e.target === e.currentTarget && setDetail(null)}
          onKeyDown={(e) => e.key === 'Escape' && setDetail(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={detail.name}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[#6B6F7B]">{CATEGORY_LABEL[detail.category]}</p>
                <h2 className="text-base font-semibold text-[#16181D]">{detail.name}</h2>
                <p className="mt-0.5 text-xs text-[#6B6F7B]">{specLine(detail)}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Закрыть"
                className="rounded-lg border border-[#E8E9EE] px-2.5 py-1 text-sm text-[#6B6F7B] hover:bg-[#F5F6F8]"
              >
                ✕
              </button>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-[#16181D]">Предложения магазинов</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {[...(detail.offers ?? [])]
                .sort((a, b) => a.price - b.price)
                .map((o, i) => (
                  <li key={o.store_id} className="flex items-center justify-between">
                    <span className="text-[#6B6F7B]">{o.store_name}</span>
                    <span className="font-medium text-[#16181D]">
                      {formatPrice(o.price)}
                      {i === 0 && (
                        <span className="ml-1 text-xs font-medium text-[#1E8E4B]">· лучшая цена</span>
                      )}
                      {o.is_stale && (
                        <span className="ml-1 text-xs text-[#B26A00]">· цена устарела</span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  )
}
