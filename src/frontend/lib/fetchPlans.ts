import { apiBaseUrl, parseJsonResponse } from './apiBase'
import { FALLBACK_PLANS } from './fallbackPlans'
import type { Plan } from '../components/billing/PricingCards'

export async function fetchSubscriptionPlans(): Promise<Plan[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/subscription-plans`)
    if (!res.ok) return FALLBACK_PLANS
    const data = await parseJsonResponse<Plan[]>(res)
    return Array.isArray(data) && data.length > 0 ? data : FALLBACK_PLANS
  } catch {
    return FALLBACK_PLANS
  }
}
