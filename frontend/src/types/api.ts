// Типы ответов ComPick API (соответствуют backend/app/main.py)

export type Category =
  | 'processor'
  | 'motherboard'
  | 'memory'
  | 'video_card'
  | 'power_supply'
  | 'case'
  | 'storage'
  | 'cooler'

export interface PriceOffer {
  store_id: string
  store_name: string
  price: number
  availability: string
  updated_at: string
  age_hours: number
  is_stale: boolean
  is_demo: boolean
}

export interface Component {
  id: string
  name: string
  brand: string
  category: Category
  best_price: number | null
  price_source: { store: string; updated_at: string; is_demo: boolean } | null
  power_draw_wt: number
  socket?: string
  tdp_watts?: number
  has_integrated_gpu?: boolean
  memory_type?: string
  memory_slots?: number
  max_memory_gb?: number
  max_memory_frequency_mhz?: number
  capacity_gb?: number
  storage_type?: string
  modules_count?: number
  frequency_mhz?: number
  length_mm?: number
  wattage?: number
  offers?: PriceOffer[]
}

export interface CompatibilityWarning {
  code: string
  severity: 'error' | 'warning' | 'info'
  component: string
  reason: string
  action: string
}

export interface CompatibilityResult {
  status: 'compatible' | 'incompatible' | 'unknown'
  is_compatible: boolean
  warnings: CompatibilityWarning[]
}

export interface BuildItem {
  component: Component
  price: number | null
}

export interface Build {
  id: string
  name: string
  items: Partial<Record<Category, BuildItem>>
  /** Все накопители сборки (SSD и HDD можно совмещать); items.storage — первый из них */
  storage_items?: BuildItem[]
  missing_categories: Category[]
  is_complete: boolean
  total_price: number | null
  compatibility?: CompatibilityResult
}

export interface AddComponentResponse {
  saved: boolean
  build: Build
  compatibility: CompatibilityResult
}

export interface Recommendation {
  build: Build
  total_price: number
  score: number
}

export interface UsageProfile {
  id: string
  name: string
  priority_category: Category
}
