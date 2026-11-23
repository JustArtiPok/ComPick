import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { BUILD_CATEGORIES, CATEGORY_LABEL, capitalize, formatPrice, specLine } from '@/lib/labels'
import type {
  Build,
  Category,
  CompatibilityWarning,
  Component,
} from '@/types/api'

interface RejectedItem {
  component: Component
  warnings: CompatibilityWarning[]
}

interface Alternative {
  component: Component
  price: number | null
}

export default function Configurator() {
  const navigate = useNavigate()
  const [build, setBuild] = useState<Build | null>(null)
  const [budget, setBudget] = useState(() => Number(sessionStorage.getItem('compick.budget')) || 80_000)
  const [purpose] = useState(() => sessionStorage.getItem('compick.purpose') || 'игры')
  const [rejected, setRejected] = useState<Partial<Record<Category, RejectedItem>>>({})
  const [alternatives, setAlternatives] = useState<Partial<Record<Category, Alternative[]>>>({})
  const [pickerCategory, setPickerCategory] = useState<Category | null>(null)
  const [pickerItems, setPickerItems] = useState<Component[]>([])
  const [pricePanel, setPricePanel] = useState<Component | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)

  const refresh = useCallback(async (id: string) => {
    const b = await api.getBuild(id)
    setBuild(b)
    return b
  }, [])

  // Инициализация: берём сборку из sessionStorage или создаём новую
  useEffect(() => {
    const existing = sessionStorage.getItem('compick.buildId')
    ;(async () => {
      try {
        if (existing) {
          await refresh(existing)
        } else {
          const b = await api.createBuild()
          sessionStorage.setItem('compick.buildId', b.id)
          setBuild(b)
        }
      } catch {
        setFatal('Не удалось связаться с сервером. Запустите backend: uvicorn app.main:app --port 8000')
      }
    })()
  }, [refresh])

  // Панель цен по умолчанию — видеокарта (как в макете)
  useEffect(() => {
    if (!build) return
    const vc = build.items.video_card?.component ?? Object.values(build.items)[0]?.component
    if (vc && !pricePanel) {
      api.componentDetail(vc.id).then(setPricePanel).catch(() => {})
    }
  }, [build, pricePanel])

  /** Подбор совместимых альтернатив: пробуем кандидатов на одноразовой копии сборки */
  async function probeAlternatives(current: Build, category: Category, excludeId: string) {
    try {
      const temp = await api.createBuild()
      for (const item of Object.values(current.items)) {
        if (item && item.component.category !== category) {
          await api.addComponent(temp.id, item.component.id)
        }
      }
      const { items } = await api.listComponents({ category })
      const candidates = items
        .filter((c) => c.id !== excludeId)
        .sort((a, b) => (a.best_price ?? Infinity) - (b.best_price ?? Infinity))
      const ok: Alternative[] = []
      for (const c of candidates) {
        if (ok.length >= 2) break
        const probe = await api.createBuild()
        for (const item of Object.values(current.items)) {
          if (item && item.component.category !== category) {
            await api.addComponent(probe.id, item.component.id)
          }
        }
        const r = await api.addComponent(probe.id, c.id)
        if (r.saved) ok.push({ component: c, price: c.best_price })
      }
      setAlternatives((prev) => ({ ...prev, [category]: ok }))
    } catch {
      // альтернативы — вспомогательная функция, молча пропускаем
    }
  }

  async function attemptAdd(category: Category, componentId: string) {
    if (!build) return
    try {
      const r = await api.addComponent(build.id, componentId)
      if (r.saved) {
        setRejected((prev) => ({ ...prev, [category]: undefined }))
        setAlternatives((prev) => ({ ...prev, [category]: undefined }))
        await refresh(build.id)
      } else {
        const { items } = await api.listComponents({ category })
        const comp = items.find((c) => c.id === componentId)
        if (comp) {
          setRejected((prev) => ({ ...prev, [category]: { component: comp, warnings: r.compatibility.warnings } }))
          probeAlternatives(build, category, componentId)
        }
      }
    } catch {
      setNotice('Сервер недоступен — действие не выполнено.')
    }
  }

  async function handleRemove(category: Category) {
    if (!build) return
    await api.removeComponent(build.id, category)
    await refresh(build.id)
  }

  function openPicker(category: Category) {
    setPickerCategory(category)
    api.listComponents({ category }).then((r) => setPickerItems(r.items)).catch(() => setPickerItems([]))
  }

  function showPrices(componentId: string) {
    api.componentDetail(componentId).then(setPricePanel).catch(() => {})
  }

  const psu = build?.items.power_supply?.component
  const load = useMemo(
    () =>
      Object.values(build?.items ?? {}).reduce(
        (sum, item) => sum + (item?.component.power_draw_wt ?? 0),
        0,
      ),
    [build],
  )

  const cpu = build?.items.processor?.component
  const mb = build?.items.motherboard?.component
  const ram = build?.items.memory?.component

  if (fatal) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <p role="alert" className="rounded-xl bg-[#FDECEA] px-4 py-3 text-sm text-[#B3261E]">{fatal}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 rounded-lg border border-[#E8E9EE] px-4 py-2 text-sm hover:bg-[#F5F6F8]"
        >
          На главную
        </button>
      </main>
    )
  }

  if (!build) {
    return <main className="mx-auto max-w-6xl px-4 py-16 text-sm text-[#6B6F7B]">Загружаем сборку…</main>
  }

  const total = build.total_price ?? 0
  const remaining = budget - total

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#16181D]">
            Сборка для: {capitalize(purpose)}
          </h1>
          <p className="mt-1 text-sm text-[#6B6F7B]">
            Бюджет{' '}
            <input
              type="number"
              value={budget}
              min={30_000}
              step={1000}
              onChange={(e) => {
                setBudget(Number(e.target.value))
                sessionStorage.setItem('compick.budget', e.target.value)
              }}
              aria-label="Бюджет сборки"
              className="w-24 rounded border border-[#E8E9EE] px-1.5 py-0.5 text-sm"
            />{' '}
            ₽
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setNotice('Сборка сохранена на сервере.')}
            className="rounded-lg border border-[#E8E9EE] px-4 py-2 text-sm font-medium text-[#16181D] hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:outline-[#2E44D6]"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={() => setOrderOpen(true)}
            className="rounded-lg bg-[#2E44D6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2539B8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E44D6]"
          >
            Список для заказа
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-lg bg-[#E7F6EC] px-3 py-2 text-sm text-[#1E8E4B]">
          {notice}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Левая колонка — строки сборки */}
        <div className="space-y-3">
          {BUILD_CATEGORIES.map((cat) => {
            const item = build.items[cat]
            const bad = rejected[cat]
            return (
              <div key={cat}>
                <div className="flex items-center gap-4 rounded-xl border border-[#E8E9EE] bg-white px-4 py-3">
                  <span className="w-28 shrink-0 text-xs text-[#6B6F7B]">{CATEGORY_LABEL[cat]}</span>
                  {item ? (
                    <>
                      <button
                        type="button"
                        onClick={() => showPrices(item.component.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-semibold text-[#16181D]">
                          {item.component.name}
                        </span>
                        <span className="block text-xs text-[#6B6F7B]">{specLine(item.component)}</span>
                      </button>
                      <span className="shrink-0 rounded-full bg-[#E7F6EC] px-2.5 py-1 text-xs font-medium text-[#1E8E4B]">
                        Подходит
                      </span>
                      <span className="w-24 shrink-0 text-right">
                        <span className="block text-sm font-semibold text-[#16181D]">
                          {formatPrice(item.price)}
                        </span>
                        <span className="block text-xs text-[#6B6F7B]">
                          {item.component.price_source ? `в ${item.component.price_source.store}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openPicker(cat)}
                          className="rounded-lg border border-[#E8E9EE] px-3 py-1.5 text-xs font-medium text-[#16181D] hover:bg-[#F5F6F8]"
                        >
                          Заменить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(cat)}
                          aria-label={`Убрать: ${CATEGORY_LABEL[cat]}`}
                          className="rounded-lg border border-[#E8E9EE] px-2 py-1.5 text-xs text-[#6B6F7B] hover:bg-[#F5F6F8]"
                        >
                          ✕
                        </button>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-[#9AA0AB]">Не выбрано</span>
                      <button
                        type="button"
                        onClick={() => openPicker(cat)}
                        className="shrink-0 rounded-lg bg-[#2E44D6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2539B8]"
                      >
                        Выбрать
                      </button>
                    </>
                  )}
                </div>

                {/* Строка отклонённой детали + объяснение + альтернативы */}
                {bad && (
                  <div className="mt-2 rounded-xl border border-[#F3C1BD] bg-[#FFF7F6] p-4">
                    <div className="flex items-center gap-4">
                      <span className="w-28 shrink-0 text-xs text-[#6B6F7B]">{CATEGORY_LABEL[cat]}</span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#16181D]">
                          {bad.component.name}
                        </span>
                        <span className="block text-xs text-[#6B6F7B]">{specLine(bad.component)}</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#FDECEA] px-2.5 py-1 text-xs font-medium text-[#B3261E]">
                        Не подходит
                      </span>
                      <span className="w-24 shrink-0 text-right text-sm font-semibold text-[#16181D]">
                        {formatPrice(bad.component.best_price)}
                      </span>
                    </div>
                    <div className="mt-3 border-t border-[#F3C1BD] pt-3">
                      <p className="text-sm font-semibold text-[#B3261E]">
                        {CATEGORY_LABEL[cat]} не подходит к сборке
                      </p>
                      {bad.warnings.map((w, i) => (
                        <p key={i} className="mt-1 text-sm leading-relaxed text-[#6B6F7B]">
                          {w.reason} {w.action}
                        </p>
                      ))}
                      {(alternatives[cat] ?? []).length > 0 && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {alternatives[cat]!.map((alt) => (
                            <div
                              key={alt.component.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-[#E8E9EE] bg-white px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-medium text-[#16181D]">
                                  {alt.component.name}
                                </span>
                                <span className="block text-xs text-[#6B6F7B]">
                                  {alt.price != null && alt.price - (bad.component.best_price ?? 0) !== 0
                                    ? `${alt.price! - (bad.component.best_price ?? 0) > 0 ? '+' : '−'}${Math.abs(
                                        alt.price! - (bad.component.best_price ?? 0),
                                      ).toLocaleString('ru-RU')} ₽ к сборке`
                                    : formatPrice(alt.price)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => attemptAdd(cat, alt.component.id)}
                                className="shrink-0 rounded-lg bg-[#2E44D6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2539B8]"
                              >
                                Выбрать
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Правая колонка */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-[#E8E9EE] bg-white p-5">
            <p className="text-xs text-[#6B6F7B]">Итого по лучшим ценам</p>
            <p className="mt-1 text-3xl font-bold text-[#16181D]">{formatPrice(total)}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0F1F4]">
              <div
                className={`h-full rounded-full ${remaining >= 0 ? 'bg-[#2E44D6]' : 'bg-[#B3261E]'}`}
                style={{ width: `${Math.min(100, budget > 0 ? (total / budget) * 100 : 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[#6B6F7B]">
              <span>Бюджет {formatPrice(budget)}</span>
              <span className={remaining < 0 ? 'font-medium text-[#B3261E]' : ''}>
                {remaining >= 0
                  ? `Осталось ${formatPrice(remaining)}`
                  : `Превышение на ${formatPrice(-remaining)}`}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#E8E9EE] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#16181D]">Проверка совместимости</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {cpu && mb && (
                <li className="flex items-center justify-between border-b border-[#F0F1F4] pb-2.5">
                  <span className="text-[#6B6F7B]">Сокет процессора и платы</span>
                  {cpu.socket === mb.socket ? (
                    <span className="font-medium text-[#1E8E4B]">{cpu.socket} ✓</span>
                  ) : (
                    <span className="font-medium text-[#B3261E]">
                      {cpu.socket} ≠ {mb.socket}
                    </span>
                  )}
                </li>
              )}
              {mb && ram && (
                <li className="flex items-center justify-between border-b border-[#F0F1F4] pb-2.5">
                  <span className="text-[#6B6F7B]">Тип памяти</span>
                  {mb.memory_type === ram.memory_type ? (
                    <span className="font-medium text-[#1E8E4B]">{ram.memory_type} ✓</span>
                  ) : (
                    <span className="font-medium text-[#B3261E]">
                      {ram.memory_type} ≠ {mb.memory_type}
                    </span>
                  )}
                </li>
              )}
              {(build.compatibility?.warnings ?? []).map((w, i) => (
                <li key={i} className="flex items-start justify-between gap-2 border-b border-[#F0F1F4] pb-2.5">
                  <span className="text-[#6B6F7B]">{w.component || 'Проверка'}</span>
                  <span
                    className={`text-right text-xs font-medium ${
                      w.severity === 'error' ? 'text-[#B3261E]' : 'text-[#B26A00]'
                    }`}
                  >
                    {w.reason}
                  </span>
                </li>
              ))}
              {!cpu || !mb ? (
                <li className="text-xs text-[#9AA0AB]">
                  Добавьте процессор и материнскую плату — покажем детали проверки
                </li>
              ) : null}
            </ul>
            {psu && (
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#16181D]">Мощность блока питания</span>
                  <span className="text-[#6B6F7B]">
                    {load} из {psu.wattage} Вт
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F0F1F4]">
                  <div
                    className={`h-full rounded-full ${
                      psu.wattage && load / psu.wattage <= 0.8 ? 'bg-[#1E8E4B]' : 'bg-[#B26A00]'
                    }`}
                    style={{ width: `${Math.min(100, psu.wattage ? (load / psu.wattage) * 100 : 0)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[#6B6F7B]">
                  {psu.wattage && psu.wattage - load >= psu.wattage * 0.3
                    ? `Запас больше ${Math.round(((psu.wattage - load) / psu.wattage) * 100)} %`
                    : 'Запас мощности мал — рекомендуем блок помощнее'}
                </p>
              </div>
            )}
          </div>

          {pricePanel?.offers && pricePanel.offers.length > 0 && (
            <div className="rounded-xl border border-[#E8E9EE] bg-white p-5">
              <h2 className="text-sm font-semibold text-[#16181D]">
                Цены: {pricePanel.name}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {[...pricePanel.offers]
                  .sort((a, b) => a.price - b.price)
                  .map((o, i) => (
                    <li key={o.store_id} className="flex items-center justify-between">
                      <span className="text-[#6B6F7B]">{o.store_name}</span>
                      <span className="font-medium text-[#16181D]">
                        {formatPrice(o.price)}
                        {i === 0 && (
                          <span className="ml-1 text-xs font-medium text-[#1E8E4B]">· лучшая цена</span>
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* Диалог выбора детали */}
      {pickerCategory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => e.target === e.currentTarget && setPickerCategory(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPickerCategory(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Выбор: ${CATEGORY_LABEL[pickerCategory]}`}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#16181D]">
                {CATEGORY_LABEL[pickerCategory]} — выбор
              </h2>
              <button
                type="button"
                onClick={() => setPickerCategory(null)}
                aria-label="Закрыть"
                className="rounded-lg border border-[#E8E9EE] px-2.5 py-1 text-sm text-[#6B6F7B] hover:bg-[#F5F6F8]"
              >
                ✕
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {pickerItems.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      attemptAdd(pickerCategory, c.id)
                      setPickerCategory(null)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E8E9EE] px-4 py-3 text-left transition-colors hover:border-[#2E44D6]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#16181D]">{c.name}</span>
                      <span className="block text-xs text-[#6B6F7B]">{specLine(c)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-[#16181D]">
                      {formatPrice(c.best_price)}
                    </span>
                  </button>
                </li>
              ))}
              {pickerItems.length === 0 && (
                <li className="text-sm text-[#6B6F7B]">В каталоге нет деталей этой категории.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Список для заказа */}
      {orderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => e.target === e.currentTarget && setOrderOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setOrderOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Список для заказа"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#16181D]">Список для заказа</h2>
              <button
                type="button"
                onClick={() => setOrderOpen(false)}
                aria-label="Закрыть"
                className="rounded-lg border border-[#E8E9EE] px-2.5 py-1 text-sm text-[#6B6F7B] hover:bg-[#F5F6F8]"
              >
                ✕
              </button>
            </div>
            <ul className="mt-4 divide-y divide-[#F0F1F4]">
              {Object.entries(build.items).map(([cat, item]) => (
                <li key={cat} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[#16181D]">
                      {item?.component.name}
                    </span>
                    <span className="text-xs text-[#6B6F7B]">
                      {item?.component.price_source?.store ?? 'цена неизвестна'}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-[#16181D]">
                    {formatPrice(item?.price)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-[#F0F1F4] pt-3">
              <span className="text-sm text-[#6B6F7B]">Итого</span>
              <span className="text-xl font-bold text-[#16181D]">{formatPrice(total)}</span>
            </div>
            {!build.is_complete && (
              <p className="mt-2 text-xs text-[#B26A00]">
                Сборка неполная: не хватает —{' '}
                {build.missing_categories.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ')}.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
