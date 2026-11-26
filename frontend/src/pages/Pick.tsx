import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { CATEGORY_LABEL, capitalize, formatPrice } from '@/lib/labels'
import type { Category, Recommendation, UsageProfile } from '@/types/api'

const PRIORITY_CATEGORIES: Category[] = ['processor', 'video_card', 'memory', 'storage']

export default function Pick() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<UsageProfile[]>([])
  const [purpose, setPurpose] = useState('')
  const [budget, setBudget] = useState(80_000)
  const [priorities, setPriorities] = useState<Category[]>(['video_card'])
  const [result, setResult] = useState<Recommendation | null>(null)
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)
  const [staleNote, setStaleNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listProfiles()
      .then((list) => {
        setProfiles(list)
        if (list.length > 0) setPurpose(list[0].name)
      })
      .catch(() => setError('Сервер недоступен. Запустите backend: uvicorn app.main:app --port 8000'))
  }, [])

  function togglePriority(cat: Category) {
    setPriorities((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!purpose) return
    setLoading(true)
    setResult(null)
    setEmptyMessage(null)
    setStaleNote(null)
    setError(null)
    try {
      const rec = await api.recommendByPurpose(purpose, budget, priorities)
      const items = rec.items
      if (items.length === 0) {
        setEmptyMessage(
          rec.message ??
            `Для назначения «${purpose}» за ${formatPrice(budget)} нет совместимого набора деталей. Увеличьте бюджет или выберите другое назначение.`,
        )
        return
      }
      const best = items[0]
      setResult(best)
      // Проверяем свежесть цен выбранных деталей (предел — 30 дней, NFR-04)
      const details = await Promise.all(
        Object.values(best.build.items)
          .filter((i) => i?.component)
          .map((i) => api.componentDetail(i!.component.id).catch(() => null)),
      )
      const staleNames = details
        .filter((d) => d && (d.offers ?? []).some((o) => o.is_stale))
        .map((d) => d!.name)
      if (staleNames.length > 0) {
        setStaleNote(
          `Предупреждение: цена не актуальна — ${staleNames.join(', ')}. Проверьте её в магазине.`,
        )
      }
    } catch {
      setError('Сервер недоступен. Запустите backend: uvicorn app.main:app --port 8000')
    } finally {
      setLoading(false)
    }
  }

  async function openInConfigurator(rec: Recommendation) {
    const build = await api.createBuild()
    for (const item of Object.values(rec.build.items)) {
      if (item) await api.addComponent(build.id, item.component.id)
    }
    sessionStorage.setItem('compick.buildId', build.id)
    sessionStorage.setItem('compick.budget', String(budget))
    sessionStorage.setItem('compick.purpose', purpose)
    navigate('/configurator')
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#16181D]">Подбор сборки</h1>
      <p className="mt-2 text-sm text-[#6B6F7B]">
        Выберите назначение и бюджет, мы предложим сборку и проверим совместимость
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form onSubmit={handleSubmit} className="h-fit rounded-2xl border border-[#E8E9EE] bg-white p-6">
          <h2 className="text-base font-semibold text-[#16181D]">Параметры подбора</h2>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-[#16181D]">Назначение</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPurpose(p.name)}
                  aria-pressed={purpose === p.name}
                  className={`rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E44D6] ${
                    purpose === p.name
                      ? 'bg-[#16181D] text-white'
                      : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
                  }`}
                >
                  {capitalize(p.name)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-5 block text-sm font-medium text-[#16181D]" htmlFor="pick-budget">
            Бюджет, ₽
          </label>
          <input
            id="pick-budget"
            type="number"
            min={30_000}
            step={1000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="mt-2 w-full rounded-lg border border-[#E8E9EE] px-3 py-2.5 text-sm outline-none focus:border-[#2E44D6]"
          />

          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-[#16181D]">Приоритетные детали</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIORITY_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => togglePriority(cat)}
                  aria-pressed={priorities.includes(cat)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E44D6] ${
                    priorities.includes(cat)
                      ? 'bg-[#16181D] text-white'
                      : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
                  }`}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading || !purpose}
            className="mt-6 w-full rounded-xl bg-[#2E44D6] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2539B8] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E44D6]"
          >
            {loading ? 'Подбираем…' : 'Подобрать сборку'}
          </button>
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">
              {error}
            </p>
          )}
        </form>

        <div className="space-y-4">
          {result && (
            <div className="rounded-2xl border border-[#E8E9EE] bg-white p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-[#16181D]">Предложенная сборка</h2>
                <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-medium text-[#1E8E4B]">
                  Совместимо
                </span>
                <span className="rounded-full bg-[#F5F6F8] px-2.5 py-1 text-xs text-[#6B6F7B]">
                  Цены на дату среза
                </span>
              </div>

              {staleNote && (
                <p role="status" className="mt-3 rounded-lg bg-[#FFF6E5] px-3 py-2 text-sm text-[#B26A00]">
                  {staleNote}
                </p>
              )}

              <ul className="mt-4 divide-y divide-[#F0F1F4]">
                {Object.entries(result.build.items).map(([cat, item]) => (
                  <li key={cat} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-[#6B6F7B]">{CATEGORY_LABEL[cat as Category] ?? cat}</span>
                    <span className="font-medium text-[#16181D]">{item?.component.name}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F1F4] pt-4">
                <div>
                  <span className="block text-xs text-[#6B6F7B]">Итоговая стоимость</span>
                  <span className="text-2xl font-bold text-[#16181D]">
                    {formatPrice(result.total_price)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openInConfigurator(result)}
                  className="rounded-xl bg-[#2E44D6] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2539B8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E44D6]"
                >
                  Открыть в конфигураторе
                </button>
              </div>
            </div>
          )}

          {emptyMessage && (
            <div className="rounded-2xl border border-[#F3E3B8] bg-[#FFFCF3] p-6">
              <p className="text-xs text-[#6B6F7B]">Состояние: подходящей сборки нет</p>
              <h2 className="mt-1 text-base font-semibold text-[#B26A00]">
                Под этот бюджет сборка не нашлась
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6B6F7B]">{emptyMessage}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBudget((b) => b + 20_000)}
                  className="rounded-lg border border-[#E8E9EE] bg-white px-4 py-2 text-sm font-medium text-[#16181D] hover:bg-[#F5F6F8]"
                >
                  Изменить бюджет
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/builds')}
                  className="rounded-lg border border-[#E8E9EE] bg-white px-4 py-2 text-sm font-medium text-[#16181D] hover:bg-[#F5F6F8]"
                >
                  Смотреть готовые сборки
                </button>
              </div>
            </div>
          )}

          {!result && !emptyMessage && !loading && (
            <div className="rounded-2xl border border-dashed border-[#E8E9EE] p-10 text-center text-sm text-[#9AA0AB]">
              Задайте параметры слева и нажмите «Подобрать сборку»
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
