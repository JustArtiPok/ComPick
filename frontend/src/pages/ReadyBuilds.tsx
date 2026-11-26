import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { CATEGORY_LABEL, capitalize, formatPrice } from '@/lib/labels'
import type { Recommendation, UsageProfile } from '@/types/api'

const BUDGETS: Record<string, number> = {
  игры: 70_000,
  учёба: 50_000,
  работа: 60_000,
  'монтаж видео': 140_000,
  программирование: 80_000,
}

interface Card {
  profile: UsageProfile
  rec: Recommendation
}

export default function ReadyBuilds() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<UsageProfile[]>([])
  const [filter, setFilter] = useState('all')
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const list = await api.listProfiles()
        setProfiles(list)
        // По одной сборке на назначение — через живой подбор backend
        const out: Card[] = []
        for (const p of list) {
          const r = await api.recommendByPurpose(p.name, BUDGETS[p.name] ?? 80_000)
          if (r.items.length > 0) out.push({ profile: p, rec: r.items[0] })
        }
        setCards(out)
      } catch {
        setError('Сервер недоступен. Запустите backend: uvicorn app.main:app --port 8000')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function openInConfigurator(card: Card) {
    const build = await api.createBuild()
    for (const item of Object.values(card.rec.build.items)) {
      if (item) await api.addComponent(build.id, item.component.id)
    }
    sessionStorage.setItem('compick.buildId', build.id)
    sessionStorage.setItem('compick.budget', String(BUDGETS[card.profile.name] ?? 80_000))
    sessionStorage.setItem('compick.purpose', card.profile.name)
    navigate('/configurator')
  }

  const visible = filter === 'all' ? cards : cards.filter((c) => c.profile.name === filter)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#16181D]">Готовые сборки</h1>
      <p className="mt-2 text-sm text-[#6B6F7B]">
        Сборки из каталога под выбранное назначение. Совместимость проверена
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
          className={`rounded-full px-4 py-2 text-sm transition-colors ${
            filter === 'all'
              ? 'bg-[#16181D] text-white'
              : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
          }`}
        >
          Все
        </button>
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setFilter(p.name)}
            aria-pressed={filter === p.name}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              filter === p.name
                ? 'bg-[#16181D] text-white'
                : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
            }`}
          >
            {capitalize(p.name)}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">
          {error}
        </p>
      )}
      {loading && <p className="mt-8 text-sm text-[#6B6F7B]">Подбираем сборки…</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <article key={card.profile.id} className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
            <h2 className="text-base font-semibold text-[#16181D]">
              Сборка: {capitalize(card.profile.name)}
            </h2>
            <p className="mt-0.5 text-xs text-[#6B6F7B]">
              Приоритет — {CATEGORY_LABEL[card.profile.priority_category].toLowerCase()}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-2xl font-bold text-[#16181D]">
                {formatPrice(card.rec.total_price)}
              </span>
              <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-medium text-[#1E8E4B]">
                Совместимо
              </span>
            </div>
            <button
              type="button"
              onClick={() => openInConfigurator(card)}
              className="mt-4 w-full rounded-lg border border-[#E8E9EE] px-4 py-2.5 text-sm font-medium text-[#16181D] transition-colors hover:bg-[#F5F6F8]"
            >
              Открыть в конфигураторе
            </button>
          </article>
        ))}
        {!loading && visible.length === 0 && !error && (
          <p className="text-sm text-[#9AA0AB]">Под это назначение сборок не нашлось.</p>
        )}
      </div>
    </main>
  )
}
