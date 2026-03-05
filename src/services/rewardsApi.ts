import axios from 'axios'
import { authAxios } from './apiClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

const api = axios.create({
  baseURL: API_BASE,
})

export interface RewardsConfig {
  isEnabled: boolean
  rewardSchedule: number[]
  minAlgoBalance: number
  minFryBalance: number
  minWalletAgeDays: number
  claimCooldownHours: number
  streakResetHours: number
  trustTierThresholds: Record<string, number>
  trustTierMultipliers: number[]
  circuitBreakerLevel: string
}

export interface RewardsStatus {
  enabled: boolean
  wallet: string
  currentStreak: number
  maxStreak: number
  nextReward: number
  estimatedReward: number
  trustTier: number
  multiplier: number
  canClaim: boolean
  cooldownMinutes: number
  lastClaimAt: string | null
  totalClaimed: number
  totalClaims: number
  rewardSchedule: number[]
  circuitBreakerLevel: string
}

export interface ClaimResult {
  txId: string
  actualReward: number
  baseReward: number
  trustTier: number
  multiplier: number
  streakDay: number
  currentStreak: number
}

export interface LeaderboardEntry {
  wallet: string
  totalClaimed: number
  totalClaims: number
  currentStreak: number
  trustTier: number
}

export async function fetchRewardsConfig(): Promise<RewardsConfig> {
  const { data } = await api.get('/rewards/config')
  return data.data
}

export async function fetchRewardsStatus(wallet: string): Promise<RewardsStatus> {
  const { data } = await api.get('/rewards/status', { params: { wallet } })
  return data.data
}

export async function claimReward(
  wallet: string,
  fingerprint: string,
  turnstileToken?: string
): Promise<ClaimResult> {
  const { data } = await authAxios.post('/rewards/claim', {
    wallet,
    fingerprint,
    turnstileToken,
  })
  return data.data
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await api.get('/rewards/leaderboard')
  return data.data
}
