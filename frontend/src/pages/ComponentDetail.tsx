import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '@/lib/api'
import { CATEGORY_LABEL, formatPrice } from '@/lib/labels'
import type { Component } from '@/types/api'

/** Куда ведёт «Перейти в магазин» — сайты магазинов из каталога */
const STORE_URL: Record<string, string> = {
  DNS: 'https://www.dns-shop.ru',
  Ситилинк: 'https://www.citilink.ru',
  Регард: 'https://www.regard.ru',
}

function specs(c: Component): [string, string][] {
  const rows: [string, string][] = []
  if (c.socket) rows.push(['Сокет', c.socket])
  if (c.category === 'processor') {
    if (c.tdp_watts) rows.push(['TDP', `${c.tdp_watts} Вт`])
    if (c.has_integrated_gpu !== undefined)
      rows.push(['Встроенная графика', c.has_integrated_gpu ? 'есть' : 'нет'])
  }
  if (c.memory_type) rows.push(['Тип памяти', c.memory_type])
  if (c.category === 'motherboard') {
    if (c.memory_slots) rows.push(['Слоты памяти', String(c.memory_slots)])
    if (c.max_memory_gb) rows.push(['Макс. объём памяти', `${c.max_memory_gb} ГБ`])
    if (c.max_memory_frequency_mhz)
      rows.push(['Макс. частота памяти', `${c.max_memory_frequency_mhz} МГц`])
  }
  if (c.category === 'memory') {
    if (c.capacity_gb && c.modules_count)
      rows.push(['Комплект', `${c.modules_count} × ${c.capacity_gb} ГБ`])
    if (c.frequency_mhz) rows.push(['Частота', `${c.frequency_mhz} МГц`])
  }
  if (c.category === 'video_card') {
    if (c.length_mm) rows.push(['Длина', `${c.length_mm} мм`])
    if (c.tdp_watts) rows.push(['TDP', `${c.tdp_watts} Вт`])
  }
  if (c.category === 'storage') {
    if (c.storage_type) rows.push(['Тип накопителя', c.storage_type])
    if (c.capacity_gb)
      rows.push(['Ёмкость', c.capacity_gb >= 1000 ? `${c.capacity_gb / 1000} ТБ` : `${c.capacity_gb} ГБ`])
  }
  if (c.wattage) rows.push(['Мощность', `${c.wattage} Вт`])
  rows.push(['Потребление', `${c.power_draw_wt} Вт`])
  return rows
}

function offerStatus(o: { availability: string; is_stale: boolean }) {
  if (o.availability !== 'in_stock')
    return { label: 'Нет в наличии', cls: 'bg-[#F5F6F8] text-[#6B6F7B]' }
  if (o.is_stale) return { label: 'Не актуально', cls: 'bg-[#FFF6E5] text-[#B26A00]' }
  return { label: 'В наличии', cls: 'bg-[#E7F6EC] text-[#1E8E4B]' }
}

function updatedLabel(o: { updated_at: string; is_stale: boolean }) {
  const date = new Date(o.updated_at).toLocaleDateString('ru-RU')
  return o.is_stale ? `${date} · не актуально` : `${date} · актуально`
}

export default function ComponentDetail() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<Component | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api
      .componentDetail(id)
      .then(setItem)
      .catch(() => setError('Деталь не найдена или сервер недоступен.'))
  }, [id])

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p role="alert" className="rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">{error}</p>
        <Link to="/catalog" className="mt-4 inline-block text-sm text-[#2E44D6] hover:underline">
          ← Назад в каталог
        </Link>
      </main>
    )
  }
  if (!item) {
    return <main className="mx-auto max-w-6xl px-4 py-8 text-sm text-[#6B6F7B]">Загружаем…</main>
  }

  const offers = [...(item.offers ?? [])].sort((a, b) => a.price - b.price)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-sm text-[#6B6F7B]" aria-label="Хлебные крошки">
        <Link to="/catalog" className="hover:text-[#16181D]">Каталог</Link>
        {' / '}
        {CATEGORY_LABEL[item.category]}
      </nav>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#16181D]">{item.name}</h1>
      <p className="mt-1 text-sm text-[#6B6F7B]">
        {CATEGORY_LABEL[item.category]} · {item.brand}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.5fr]">
        <section className="h-fit rounded-2xl border border-[#E8E9EE] bg-white p-5">
          <h2 className="text-base font-semibold text-[#16181D]">Характеристики</h2>
          <dl className="mt-3 divide-y divide-[#F0F1F4]">
            {specs(item).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-[#6B6F7B]">{k}</dt>
                <dd className="font-medium text-[#16181D]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
          <h2 className="text-base font-semibold text-[#16181D]">Предложения магазинов</h2>
          <p className="mt-1 text-xs text-[#6B6F7B]">
            Лучшая цена выбрана среди товаров в наличии. Цены на дату среза
          </p>

          <div className="mt-4 hidden grid-cols-[1fr_0.7fr_0.9fr_1fr_auto] gap-3 border-b border-[#F0F1F4] pb-2 text-xs font-medium text-[#6B6F7B] md:grid">
            <span>Магазин</span>
            <span>Цена</span>
            <span>Наличие</span>
            <span>Обновлено</span>
            <span />
          </div>

          <ul className="divide-y divide-[#F0F1F4]">
            {offers.map((o, i) => {
              const s = offerStatus(o)
              const url = STORE_URL[o.store_name]
              return (
                <li
                  key={o.store_id}
                  className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1fr_0.7fr_0.9fr_1fr_auto] md:items-center md:gap-3"
                >
                  <span className="text-sm font-semibold text-[#16181D]">{o.store_name}</span>
                  <span className="text-sm font-semibold text-[#16181D]">
                    {formatPrice(o.price)}
                    {i === 0 && o.availability === 'in_stock' && !o.is_stale && (
                      <span className="ml-1 text-xs font-medium text-[#1E8E4B]">· лучшая</span>
                    )}
                  </span>
                  <span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </span>
                  <span className="text-xs text-[#6B6F7B]">{updatedLabel(o)}</span>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className={`w-fit rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        i === 0
                          ? 'bg-[#2E44D6] text-white hover:bg-[#2539B8]'
                          : 'border border-[#E8E9EE] text-[#16181D] hover:bg-[#F5F6F8]'
                      }`}
                    >
                      Перейти в магазин
                    </a>
                  ) : (
                    <span />
                  )}
                </li>
              )
            })}
            {offers.length === 0 && (
              <li className="py-6 text-center text-sm text-[#9AA0AB]">
                Предложений магазинов пока нет — цена не определена.
              </li>
            )}
          </ul>
          <p className="mt-3 text-xs text-[#9AA0AB]">
            Кнопка откроет страницу магазина в новой вкладке
          </p>
        </section>
      </div>
    </main>
  )
}
