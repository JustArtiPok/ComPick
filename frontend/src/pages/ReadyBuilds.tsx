import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { CATEGORY_LABEL, capitalize, formatPrice } from '@/lib/labels'
import type { Recommendation, UsageProfile } from '@/types/api'

export default function ReadyBuilds() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<UsageProfile[]>([])
  const [purpose, setPurpose] = useState('')
  const [budget, setBudget] = useState(80_000)
  const [items, setItems] = useState<Recommendation[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.listProfiles().then((list) => {
      setProfiles(list)
      if (list.length > 0) setPurpose(list[0].name)
    })
  }, [])

  useEffect(() => {
    if (!purpose) return
    setLoading(true)
    api
      .recommendByPurpose(purpose, budget)
      .then((r) => {
        setItems(r.items)
        setMessage(r.items.length === 0 ? r.message ?? 'Подходящих сборок не найдено.' : null)
      })
      .catch(() => setMessage('Сервер недоступен.'))
      .finally(() => setLoading(false))
  }, [purpose, budget])

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
      <h1 className="text-3xl font-bold tracking-tight text-[#16181D]">Готовые сборки</h1>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPurpose(p.name)}
            aria-pressed={purpose === p.name}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              purpose === p.name
                ? 'bg-[#16181D] text-white'
                : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
            }`}
          >
            {capitalize(p.name)}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-[#6B6F7B]">
          Бюджет
          <input
            type="number"
            value={budget}
            min={30_000}
            step={1000}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-28 rounded-lg border border-[#E8E9EE] px-3 py-2 text-sm text-[#16181D] outline-none focus:border-[#2E44D6]"
          />
          ₽
        </label>
      </div>

      {loading && <p className="mt-8 text-sm text-[#6B6F7B]">Подбираем…</p>}
      {message && !loading && (
        <p role="status" className="mt-8 rounded-lg bg-[#F5F6F8] px-4 py-3 text-sm text-[#6B6F7B]">
          {message}
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map((rec, i) => (
          <article key={i} className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#16181D]">
                Сборка для: {capitalize(purpose)}
              </h2>
              <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-medium text-[#1E8E4B]">
                Всё совместимо
              </span>
            </div>
            <ul className="mt-4 divide-y divide-[#F0F1F4]">
              {Object.entries(rec.build.items).map(([cat, item]) => (
                <li key={cat} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[#6B6F7B]">{CATEGORY_LABEL[cat as never] ?? cat}</span>
                  <span className="font-medium text-[#16181D]">{item?.component.name}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-[#F0F1F4] pt-4">
              <span className="text-xl font-bold text-[#16181D]">{formatPrice(rec.total_price)}</span>
              <button
                type="button"
                onClick={() => openInConfigurator(rec)}
                className="rounded-lg bg-[#2E44D6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2539B8]"
              >
                Открыть в конфигураторе
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
