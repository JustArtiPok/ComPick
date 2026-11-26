// Общие подписи и форматирование под макеты
import type { Category, Component } from '@/types/api'

export const CATEGORY_LABEL: Record<Category, string> = {
  processor: 'Процессор',
  motherboard: 'Материнская плата',
  memory: 'Оперативная память',
  video_card: 'Видеокарта',
  power_supply: 'Блок питания',
  case: 'Корпус',
  storage: 'Накопитель',
  cooler: 'Кулер',
}

// Порядок строк в конфигураторе. Корпус исключён (не участвует в провертках MVP,
// решение 26.11), накопителей может быть несколько — они рисуются отдельным блоком.
export const BUILD_CATEGORIES: Category[] = [
  'processor',
  'motherboard',
  'memory',
  'video_card',
  'power_supply',
]

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return 'цена неизвестна'
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`
}

/** Короткая строка характеристик под названием детали — как в макете конфигуратора */
export function specLine(c: Component): string {
  switch (c.category) {
    case 'processor':
      return [c.socket && `сокет ${c.socket}`, c.tdp_watts && `${c.tdp_watts} Вт`]
        .filter(Boolean)
        .join(' · ')
    case 'motherboard':
      return [c.socket, c.memory_type, 'mATX/ATX'].filter(Boolean).join(' · ')
    case 'memory':
      return [
        c.modules_count && c.capacity_gb && `${c.modules_count} × ${c.capacity_gb} ГБ`,
        c.memory_type,
        c.frequency_mhz && `${c.frequency_mhz} МГц`,
      ]
        .filter(Boolean)
        .join(' · ')
    case 'video_card':
      return [c.length_mm && `длина ${c.length_mm} мм`, c.tdp_watts && `${c.tdp_watts} Вт`]
        .filter(Boolean)
        .join(' · ')
    case 'power_supply':
      return [c.wattage && `${c.wattage} Вт`].filter(Boolean).join(' · ')
    case 'storage':
      return [
        c.storage_type,
        c.capacity_gb && (c.capacity_gb >= 1000 ? `${c.capacity_gb / 1000} ТБ` : `${c.capacity_gb} ГБ`),
      ]
        .filter(Boolean)
        .join(' · ')
    case 'case':
      return 'корпус'
    default:
      return ''
  }
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
