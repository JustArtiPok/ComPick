import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { capitalize, formatPrice, CATEGORY_LABEL } from '@/lib/labels'
import type { Recommendation, UsageProfile } from '@/types/api'

const BUDGET_MIN = 30_000
const BUDGET_MAX = 300_000

export default function Home() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<UsageProfile[]>([])
  const [purpose, setPurpose] = useState<string>('')
  const [budget, setBudget] = useState(80_000)
  const [example, setExample] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listProfiles()
      .then((list) => {
        setProfiles(list)
        if (list.length > 0) setPurpose(list[0].name)
      })
      .catch(() => setError('Не удалось связаться с сервером. Проверьте, что backend запущен.'))
  }, [])

  // Живой пример справа — реальная рекомендация backend под выбранное назначение,
  // пересчитывается при смене назначения или движении ползунка бюджета
  // (с задержкой, чтобы не дёргать API на каждый пиксель)
  useEffect(() => {
    if (!purpose) return
    const timer = setTimeout(() => {
      api
        .recommendByPurpose(purpose, budget)
        .then((r) => setExample(r.items[0] ?? null))
        .catch(() => setExample(null))
    }, 350)
    return () => clearTimeout(timer)
  }, [purpose, budget])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!purpose) return
    setLoading(true)
    setError(null)
    try {
      const rec = await api.recommendByPurpose(purpose, budget)
      if (rec.items.length === 0) {
        setError(rec.message ?? 'Подходящей сборки не нашлось — попробуйте увеличить бюджет.')
        return
      }
      // Материализуем рекомендованную сборку через настоящие эндпоинты,
      // чтобы конфигуратор работал с живым состоянием backend
      const build = await api.createBuild()
      for (const item of Object.values(rec.items[0].build.items)) {
        if (item) await api.addComponent(build.id, item.component.id)
      }
      sessionStorage.setItem('compick.buildId', build.id)
      sessionStorage.setItem('compick.budget', String(budget))
      sessionStorage.setItem('compick.purpose', rec.purpose ?? purpose)
      navigate('/configurator')
    } catch {
      setError('Сервер недоступен. Запустите backend: uvicorn app.main:app --port 8000')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="grid gap-10 py-14 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-[#16181D] md:text-5xl">
            Соберите ПК
            <br />
            без ошибок
            <br />
            совместимости
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[#6B6F7B]">
            Выберите, для чего нужен компьютер, и укажите бюджет. Мы подберём сборку и проверим
            каждую деталь.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 max-w-md rounded-2xl border border-[#E8E9EE] bg-white p-6"
          >
            <fieldset>
              <legend className="text-sm font-medium text-[#16181D]">Для чего нужен ПК</legend>
              <div className="mt-3 flex flex-wrap gap-2">
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

            <label className="mt-6 block text-sm font-medium text-[#16181D]" htmlFor="budget">
              Бюджет
            </label>
            <div className="mt-2 flex items-center rounded-lg border border-[#E8E9EE] px-3 focus-within:border-[#2E44D6]">
              <input
                id="budget"
                type="number"
                min={BUDGET_MIN}
                max={BUDGET_MAX}
                step={1000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full py-2.5 text-sm outline-none"
              />
              <span className="text-sm text-[#6B6F7B]">₽</span>
            </div>
            <input
              type="range"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={1000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="Бюджет, ползунок"
              className="mt-3 w-full accent-[#2E44D6]"
            />
            <div className="flex justify-between text-xs text-[#6B6F7B]">
              <span>{formatPrice(BUDGET_MIN)}</span>
              <span>{formatPrice(BUDGET_MAX)}</span>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !purpose}
              className="mt-5 w-full rounded-xl bg-[#2E44D6] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2539B8] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E44D6]"
            >
              {loading ? 'Подбираем…' : 'Собрать ПК'}
            </button>
          </form>
        </div>

        <aside className="rounded-2xl border border-[#E8E9EE] bg-white p-5 md:mt-16">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#16181D]">
              Сборка: {capitalize(purpose || 'игры')}
            </h2>
            {example && (
              <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-medium text-[#1E8E4B]">
                Всё совместимо
              </span>
            )}
          </div>
          {example ? (
            <>
              <ul className="mt-4 divide-y divide-[#F0F1F4]">
                {Object.entries(example.build.items).map(([cat, item]) => (
                  <li key={cat} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-[#6B6F7B]">{CATEGORY_LABEL[cat as never] ?? cat}</span>
                    <span className="font-medium text-[#16181D]">{item?.component.name}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-end justify-between border-t border-[#F0F1F4] pt-4">
                <span className="text-sm text-[#6B6F7B]">Итого по лучшим ценам</span>
                <span className="text-2xl font-bold text-[#16181D]">
                  {formatPrice(example.total_price)}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-[#6B6F7B]">
              В этот бюджет сборка не помещается — подвиньте ползунок вправо.
            </p>
          )}
        </aside>
      </section>

      <section className="grid gap-8 border-t border-[#F0F1F4] py-12 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold text-[#16181D]">Мгновенная проверка</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6F7B]">
            Сокет, поддержка процессора платой, тип памяти и мощность блока питания проверяются
            после каждого изменения.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#16181D]">Понятные причины</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6F7B]">
            Если деталь не подходит, мы объясним почему простым языком и предложим подходящие
            варианты.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#16181D]">Цены нескольких магазинов</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6F7B]">
            Сравнивайте предложения и сразу видите итоговую стоимость сборки.
          </p>
        </div>
      </section>
    </main>
  )
}
