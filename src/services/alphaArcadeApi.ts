import axios from 'axios'
import { authAxios } from './apiClient'
import type {
  AlphaArcadeMarket,
  AlphaArcadePool,
  AlphaArcadePosition,
  AlphaArcadeOrderbook,
  BuildTxnResponse,
} from '../types/alphaArcade'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

const api = axios.create({
  baseURL: API_BASE,
})

// Public reads (no auth)
export async function getMarkets(): Promise<AlphaArcadeMarket[]> {
  const { data } = await api.get('/alpha-arcade/markets')
  return data.data
}

export async function getRewardMarkets(): Promise<AlphaArcadeMarket[]> {
  const { data } = await api.get('/alpha-arcade/markets/rewards')
  return data.data
}

export async function getMarketDetail(appId: number): Promise<AlphaArcadeMarket> {
  const { data } = await api.get(`/alpha-arcade/markets/${appId}`)
  return data.data
}

export async function getOrderbook(appId: number): Promise<AlphaArcadeOrderbook> {
  const { data } = await api.get(`/alpha-arcade/orderbook/${appId}`)
  return data.data
}

export async function getPools(): Promise<AlphaArcadePool[]> {
  const { data } = await api.get('/alpha-arcade/pools')
  return data.data
}

export async function getPool(poolId: string): Promise<AlphaArcadePool> {
  const { data } = await api.get(`/alpha-arcade/pool/${poolId}`)
  return data.data
}

export async function getPositionsByWallet(wallet: string): Promise<AlphaArcadePosition[]> {
  const { data } = await api.get(`/alpha-arcade/positions/${wallet}`)
  return data.data
}

export async function getPositionByPool(wallet: string, poolId: string): Promise<AlphaArcadePosition> {
  const { data } = await api.get(`/alpha-arcade/position/${wallet}/${poolId}`)
  return data.data
}

// Authenticated writes
export async function buildDeposit(payload: {
  wallet: string
  marketAppId: number
  usdcAmount: number
  spread?: number
}): Promise<BuildTxnResponse> {
  const { data } = await authAxios.post('/alpha-arcade/build-deposit', payload)
  return data.data
}

export async function buildWithdraw(payload: {
  wallet: string
  poolId: string
}): Promise<BuildTxnResponse> {
  const { data } = await authAxios.post('/alpha-arcade/build-withdraw', payload)
  return data.data
}

export async function recordDeposit(payload: {
  wallet: string
  marketAppId: number
  poolId: string
  usdcDeposited: number
  yesEscrowAppIds: number[]
  noEscrowAppIds: number[]
  spreadUsed: number
  entryMidPrice: number
  txId: string
}): Promise<AlphaArcadePosition> {
  const { data } = await authAxios.post('/alpha-arcade/record-deposit', payload)
  return data.data
}

export async function recordWithdraw(payload: {
  wallet: string
  poolId?: string
  positionId: string
  usdcRecovered: number
  remainingYesTokens: number
  remainingNoTokens: number
  txId: string
}): Promise<AlphaArcadePosition> {
  const { data } = await authAxios.post('/alpha-arcade/record-withdraw', payload)
  return data.data
}
