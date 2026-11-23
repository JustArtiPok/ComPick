import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/labels'

interface StoreStat {
  name: string
  offers: number
  minPrice: number
  maxPrice: number
}

/** Магазины собираются из живых предложений каталога (API не имеет отдельного эндпоинта магазинов) */
export default function Stores() {
  const [stores, setStores] = useState<StoreStat[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { items } = await api.listComponents()
        const details = await Promise.all(items.map((c) => api.componentDetail(c.id)))
        const map = new Map<string, StoreStat>()
        for (const d of details) {
          for (const o of d.offers ?? []) {
            const s = map.get(o.store_name) ?? {
              name: o.store_name,
              offers: 0,
              minPrice: Infinity,
              maxPrice: 0,
            }
            s.offers += 1
            s.minPrice = Math.min(s.minPrice, o.price)
            s.maxPrice = Math.max(s.maxPrice, o.price)
            map.set(o.store_name, s)
          }
        }
        setStores([...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
      } catch {
        setError('Сервер недоступен. Запустите backend: uvicorn app.main:app --port 8000')
      }
    })()
  }, [])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#16181D]">Магазины</h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#6B6F7B]">
        ComPick сравнивает предложения этих магазинов и считает итог сборки по лучшим актуальным
        ценам. Цена считается устаревшей через 24 часа после проверки.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">
          {error}
        </p>
      )}
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {stores.map((s) => (
          <li key={s.name} className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
            <h2 className="text-base font-semibold text-[#16181D]">{s.name}</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#6B6F7B]">Предложений в каталоге</dt>
                <dd className="font-medium text-[#16181D]">{s.offers}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6B6F7B]">Цены от</dt>
                <dd className="font-medium text-[#16181D]">{formatPrice(s.minPrice)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6B6F7B]">до</dt>
                <dd className="font-medium text-[#16181D]">{formatPrice(s.maxPrice)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  )
}
