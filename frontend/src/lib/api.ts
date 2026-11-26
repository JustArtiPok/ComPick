// Клиент ComPick API. В dev-режиме запросы идут через прокси Vite на backend (:8000).
import type {
  AddComponentResponse,
  Build,
  Category,
  Component,
  Recommendation,
  UsageProfile,
} from '@/types/api'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  listComponents(params: { category?: Category; q?: string } = {}) {
    const sp = new URLSearchParams()
    if (params.category) sp.set('category', params.category)
    if (params.q) sp.set('q', params.q)
    const qs = sp.toString()
    return request<{ count: number; items: Component[] }>(`/api/components${qs ? `?${qs}` : ''}`)
  },

  componentDetail(id: string) {
    return request<Component>(`/api/components/${id}`)
  },

  listProfiles() {
    return request<UsageProfile[]>('/api/profiles')
  },

  createBuild() {
    return request<Build>('/api/builds', { method: 'POST' })
  },

  getBuild(id: string) {
    return request<Build>(`/api/builds/${id}`)
  },

  addComponent(buildId: string, componentId: string) {
    return request<AddComponentResponse>(`/api/builds/${buildId}/components`, {
      method: 'POST',
      body: JSON.stringify({ component_id: componentId }),
    })
  },

  removeComponent(buildId: string, category: Category) {
    return request<Build>(`/api/builds/${buildId}/components/${category}`, { method: 'DELETE' })
  },

  removeStorageComponent(buildId: string, componentId: string) {
    return request<Build>(`/api/builds/${buildId}/storage/${componentId}`, { method: 'DELETE' })
  },

  recommendByBudget(budget: number) {
    return request<{ message?: string; items: Recommendation[] }>('/api/recommendations/budget', {
      method: 'POST',
      body: JSON.stringify({ budget_rub: budget }),
    })
  },

  recommendByPurpose(purpose: string, budget?: number, priorities?: Category[]) {
    return request<{ purpose: string; message?: string; items: Recommendation[] }>(
      '/api/recommendations/purpose',
      {
        method: 'POST',
        body: JSON.stringify({
          purpose,
          ...(budget ? { budget_rub: budget } : {}),
          ...(priorities && priorities.length > 0 ? { priorities } : {}),
        }),
      },
    )
  },
}
