import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string
const api = axios.create({ baseURL: API_BASE })

export interface DropsStats {
  totalDrops: number
  totalClaims: number
  perClaimFee: number
  creationFee: number
  appId: number
}

export interface Drop {
  dropId: string
  tokenAsaId: number
  totalAmount: number
  claimsCount: number
  deadline: number
  status: string
  name: string
}

export interface DropEligibility {
  eligible: boolean
  amount: number
  alreadyClaimed: boolean
}

export async function getDropsStats(): Promise<DropsStats> {
  const { data } = await api.get('/drops/stats')
  return data.data
}

export async function getDropsList(): Promise<{ totalBoxes: number; drops: number }> {
  const { data } = await api.get('/drops/drops')
  return data.data
}

export async function getDropDetail(dropId: string): Promise<Drop> {
  const { data } = await api.get(`/drops/${dropId}`)
  return data.data
}

export async function checkDropEligibility(dropId: string, wallet: string): Promise<DropEligibility> {
  const { data } = await api.get(`/drops/${dropId}/eligible`, { params: { wallet } })
  return data.data
}
