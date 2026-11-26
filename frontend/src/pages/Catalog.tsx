import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { formatPrice, specLine } from '@/lib/labels'
import type { Category, Component } from '@/types/api'

const CATEGORIES: Category[] = [
  'processor',
  'motherboard',
  'memory',
  'storage',
  'video_card',
  'power_supply',
  'case',
]

const CATEGORY_PLURAL: Record<Category, string> = {
  processor: 'Процессоры',
  motherboard: 'Материнские платы',
  memory: 'Память',
  video_card: 'Видеокарты',
  power_supply: 'Блоки питания',
  case: 'Корпуса',
  storage: 'Накопители',
  cooler: 'Кулеры',
}

function freshness(c: Component): { label: string; cls: string } | null {
  if (c.best_price == null) return { label: 'Цена не определена', cls: 'bg-[#F5F6F8] text-[#6B6F7B]' }
  const updated = c.price_source?.updated_at
  if (!updated) return null
  // Предел актуальности цены — 30 дней (обновление раз в месяц)
  const ageHours = (Date.now() - new Date(updated).getTime()) / 3_600_000
  return ageHours > 30 * 24
    ? { label: 'Не актуально', cls: 'bg-[#FFF6E5] text-[#B26A00]' }
    : { label: 'Актуально', cls: 'bg-[#E7F6EC] text-[#1E8E4B]' }
}

export default function Catalog() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Category>('processor')
  const [q, setQ] = useState('')
  const [brand, setBrand] = useState('')
  const [items, setItems] = useState<Component[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .listComponents({ category: tab, ...(q ? { q } : {}) })
        .then((r) => {
          const filtered = brand
            ? r.items.filter((c) => c.brand.toLowerCase().includes(brand.toLowerCase()))
            : r.items
          setItems(filtered)
        })
        .catch(() => setError('Сервер недоступен. Запустите backend: uvicorn app.main:app --port 8000'))
    }, 200)
    return () => clearTimeout(t)
  }, [tab, q, brand])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#16181D]">Каталог комплектующих</h1>
      <p className="mt-2 text-sm text-[#6B6F7B]">
        Характеристики и предложения магазинов. Лучшая цена выбирается среди товаров в наличии
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-2xl border border-[#E8E9EE] bg-white p-4">
          <h2 className="px-2 text-sm font-semibold text-[#16181D]">Категории</h2>
          <ul className="mt-2 space-y-0.5">
            {CATEGORIES.map((cat) => (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() => setTab(cat)}
                  aria-pressed={tab === cat}
                  className={`w-full rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    tab === cat
                      ? 'font-semibold text-[#16181D]'
                      : 'text-[#6B6F7B] hover:bg-[#F5F6F8]'
                  }`}
                >
                  {CATEGORY_PLURAL[cat]}
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-4 block px-2 text-sm font-medium text-[#16181D]" htmlFor="brand-filter">
            Фильтр по бренду
          </label>
          <input
            id="brand-filter"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="AMD"
            className="mt-2 w-full rounded-lg border border-[#E8E9EE] px-3 py-2 text-sm outline-none focus:border-[#2E44D6]"
          />
        </aside>

        <div className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию"
            aria-label="Поиск по названию"
            className="w-full rounded-lg border border-[#E8E9EE] px-3 py-2.5 text-sm outline-none focus:border-[#2E44D6]"
          />

          <div className="mt-4 hidden grid-cols-[1.2fr_1fr_0.7fr_0.7fr_auto] gap-3 border-b border-[#F0F1F4] pb-2 text-xs font-medium text-[#6B6F7B] md:grid">
            <span>Деталь</span>
            <span>Характеристики</span>
            <span>Лучшая цена</span>
            <span>Обновлено</span>
            <span />
          </div>

          <ul className="divide-y divide-[#F0F1F4]">
            {items.map((c) => {
              const f = freshness(c)
              return (
                <li
                  key={c.id}
                  className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_auto] md:items-center md:gap-3"
                >
                  <span className="text-sm font-semibold text-[#16181D]">{c.name}</span>
                  <span className="text-sm text-[#6B6F7B]">{specLine(c)}</span>
                  <span className="text-sm font-semibold text-[#16181D]">
                    {c.best_price != null ? formatPrice(c.best_price) : (
                      <span className="rounded-full bg-[#F5F6F8] px-2 py-0.5 text-xs font-medium text-[#6B6F7B]">
                        Цена не определена
                      </span>
                    )}
                  </span>
                  <span>
                    {f && c.best_price != null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.cls}`}>
                        {f.label}
                      </span>
                    )}
                    {c.best_price == null && <span className="text-xs text-[#9AA0AB]">—</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/catalog/${c.id}`)}
                    className="w-fit rounded-lg border border-[#E8E9EE] px-3 py-1.5 text-xs font-medium text-[#16181D] hover:bg-[#F5F6F8]"
                  >
                    Открыть
                  </button>
                </li>
              )
            })}
            {items.length === 0 && (
              <li className="py-6 text-center text-sm text-[#9AA0AB]">
                По этим фильтрам деталей не нашлось.
              </li>
            )}
          </ul>
        </div>
      </div>
    </main>
  )
}
