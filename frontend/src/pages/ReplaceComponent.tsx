import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '@/lib/api'
import { CATEGORY_LABEL, formatPrice } from '@/lib/labels'
import type { Build, Category, Component } from '@/types/api'

type Compat = 'ok' | 'unknown' | 'bad' | 'pending'

interface Candidate {
  component: Component
  compat: Compat
}

function requirement(build: Build, category: Category): string | null {
  const cpu = build.items.processor?.component
  const mb = build.items.motherboard?.component
  if (category === 'memory' && mb) return `Нужна память ${mb.memory_type}`
  if (category === 'processor' && mb) return `Нужен сокет ${mb.socket}`
  if (category === 'motherboard' && cpu) return `Нужен сокет ${cpu.socket}`
  if (category === 'power_supply') {
    const load = Object.values(build.items).reduce(
      (s, i) => s + (i?.component.power_draw_wt ?? 0),
      0,
    )
    return load > 0 ? `Нагрузка сборки ~${load} Вт — с запасом 20–30 %` : null
  }
  return null
}

export default function ReplaceComponent() {
  const { category } = useParams<{ category: Category }>()
  const navigate = useNavigate()
  const [build, setBuild] = useState<Build | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [onlyFitting, setOnlyFitting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const buildId = sessionStorage.getItem('compick.buildId')
    if (!buildId || !category) {
      navigate('/configurator')
      return
    }
    ;(async () => {
      try {
        const b = await api.getBuild(buildId)
        setBuild(b)
        const { items } = await api.listComponents({ category })
        const currentId = b.items[category]?.component.id
        // Пробная установка каждого кандидата на одноразовой копии сборки
        const probe = await api.createBuild()
        for (const item of Object.values(b.items)) {
          if (item && item.component.category !== category) {
            await api.addComponent(probe.id, item.component.id)
          }
        }
        const results: Candidate[] = []
        for (const c of items) {
          if (c.id === currentId) {
            results.push({ component: c, compat: 'ok' })
            continue
          }
          const r = await api.addComponent(probe.id, c.id)
          const compat: Compat = !r.saved
            ? 'bad'
            : r.compatibility.status === 'unknown'
              ? 'unknown'
              : 'ok'
          results.push({ component: c, compat })
          await api.removeComponent(probe.id, category).catch(() => {})
        }
        results.sort((a, b) => (a.component.best_price ?? Infinity) - (b.component.best_price ?? Infinity))
        setCandidates(results)
      } catch {
        setError('Сервер недоступен или сборка не найдена.')
      }
    })()
  }, [category, navigate])

  const currentItem = build?.items[category as Category]
  // Накопители добавляются к сборке (несколько штук), а не заменяются
  const isMultiStorage = category === 'storage'
  const visible = useMemo(
    () => (onlyFitting ? candidates.filter((c) => c.compat !== 'bad') : candidates),
    [candidates, onlyFitting],
  )

  async function choose(c: Candidate) {
    if (!build || !category || c.compat === 'bad') return
    setBusy(true)
    try {
      const r = await api.addComponent(build.id, c.component.id)
      if (r.saved) {
        navigate('/configurator')
      } else {
        navigate('/configurator', {
          state: { rejected: { [category]: { component: c.component, warnings: r.compatibility.warnings } } },
        })
      }
    } catch {
      setError('Сервер недоступен — деталь не заменена.')
      setBusy(false)
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p role="alert" className="rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">{error}</p>
        <Link to="/configurator" className="mt-4 inline-block text-sm text-[#2E44D6] hover:underline">
          ← Назад к сборке
        </Link>
      </main>
    )
  }

  if (!build || !category) {
    return <main className="mx-auto max-w-6xl px-4 py-8 text-sm text-[#6B6F7B]">Загружаем…</main>
  }

  const req = requirement(build, category)
  const cpuName = build.items.processor?.component.name
  const mbName = build.items.motherboard?.component.name

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-sm text-[#6B6F7B]" aria-label="Хлебные крошки">
        <Link to="/configurator" className="hover:text-[#16181D]">Моя сборка</Link>
        {' / Замена детали'}
      </nav>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#16181D]">
        {CATEGORY_LABEL[category]}
      </h1>
      <p className="mt-2 text-sm text-[#6B6F7B]">
        Детали из каталога с предложением магазина. Совместимость проверена с вашей сборкой
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-2xl border border-[#E8E9EE] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#16181D]">Ваша сборка</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-[#6B6F7B]">
            {cpuName && <li>Процессор: {cpuName}</li>}
            {mbName && <li>Плата: {mbName}</li>}
            {(build?.storage_items ?? []).length > 0 && (
              <li>
                Накопители ({build!.storage_items!.length}):{' '}
                {build!.storage_items!.map((s) => s.component.name).join(' + ')}
              </li>
            )}
            {req && <li className="font-medium text-[#B3261E]">{req}</li>}
          </ul>
          <p className="mt-4 border-t border-[#F0F1F4] pt-3 text-base font-bold text-[#16181D]">
            Итого {formatPrice(build.total_price)}
          </p>
        </aside>

        <div className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOnlyFitting(true)}
              aria-pressed={onlyFitting}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                onlyFitting ? 'bg-[#16181D] text-white' : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
              }`}
            >
              Только подходящие
            </button>
            <button
              type="button"
              onClick={() => setOnlyFitting(false)}
              aria-pressed={!onlyFitting}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                !onlyFitting ? 'bg-[#16181D] text-white' : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
              }`}
            >
              Все
            </button>
          </div>

          <div className="mt-4 hidden grid-cols-[1.3fr_0.9fr_0.9fr_0.6fr_auto] gap-3 border-b border-[#F0F1F4] pb-2 text-xs font-medium text-[#6B6F7B] md:grid">
            <span>Деталь</span>
            <span>Совместимость</span>
            <span>Лучшая цена</span>
            <span>К сборке</span>
            <span />
          </div>

          {candidates.length === 0 && (
            <p className="py-6 text-center text-sm text-[#9AA0AB]">Проверяем совместимость…</p>
          )}

          <ul className="divide-y divide-[#F0F1F4]">
            {visible.map((c) => {
              const isCurrent = !isMultiStorage && c.component.id === currentItem?.component.id
              const delta =
                !isMultiStorage && c.component.best_price != null && currentItem?.price != null
                  ? c.component.best_price - currentItem.price
                  : null
              return (
                <li
                  key={c.component.id}
                  className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1.3fr_0.9fr_0.9fr_0.6fr_auto] md:items-center md:gap-3"
                >
                  <span className="text-sm font-semibold text-[#16181D]">{c.component.name}</span>
                  <span>
                    {c.compat === 'ok' && (
                      <span className="rounded-full bg-[#E7F6EC] px-2 py-0.5 text-xs font-medium text-[#1E8E4B]">
                        Подходит
                      </span>
                    )}
                    {c.compat === 'unknown' && (
                      <span className="rounded-full bg-[#FFF6E5] px-2 py-0.5 text-xs font-medium text-[#B26A00]">
                        Не подтверждается
                      </span>
                    )}
                    {c.compat === 'bad' && (
                      <span className="rounded-full bg-[#FDECEA] px-2 py-0.5 text-xs font-medium text-[#B3261E]">
                        Не подходит
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-[#16181D]">
                    {c.component.best_price != null ? (
                      <>
                        {formatPrice(c.component.best_price)}
                        {c.component.price_source && (
                          <span className="text-xs font-normal text-[#6B6F7B]">
                            {' '}· {c.component.price_source.store}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full bg-[#F5F6F8] px-2 py-0.5 text-xs font-medium text-[#6B6F7B]">
                        Цена не определена
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-[#6B6F7B]">
                    {isCurrent
                      ? 'текущая'
                      : delta != null && delta !== 0
                        ? `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('ru-RU')} ₽`
                        : '—'}
                  </span>
                  <button
                    type="button"
                    disabled={isCurrent || c.compat === 'bad' || busy}
                    onClick={() => choose(c)}
                    className={`w-fit rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                      isCurrent || c.compat === 'bad'
                        ? 'cursor-not-allowed border border-[#E8E9EE] text-[#9AA0AB]'
                        : 'bg-[#2E44D6] text-white hover:bg-[#2539B8]'
                    }`}
                  >
                    {isMultiStorage ? 'Добавить' : 'Выбрать'}
                  </button>
                </li>
              )
            })}
            {visible.length === 0 && candidates.length > 0 && (
              <li className="py-6 text-center text-sm text-[#9AA0AB]">
                Подходящих деталей нет — переключите фильтр на «Все».
              </li>
            )}
          </ul>

          <p className="mt-4 border-t border-[#F0F1F4] pt-3 text-xs leading-relaxed text-[#9AA0AB]">
            «Не подходит»: деталь несовместима со сборкой. «Не подтверждается»: данных о
            совместимости нет — уточните у магазина.
          </p>
        </div>
      </div>
    </main>
  )
}
