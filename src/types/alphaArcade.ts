export interface AlphaArcadeMarket {
  marketAppId: number
  title: string
  categories: string[]
  image: string
  endTs: number
  yesAssetId: number
  noAssetId: number
  yesProb: number
  noProb: number
  twentyFourHrVolume: number
  volume: number
  id: string
  slug: string
  featured: boolean
  source: string
  createdAt: number
}

export interface AlphaArcadePool {
  _id: string
  creatorId: string
  marketAppId: number
  matcherAppId: number
  marketQuestion: string
  marketCategory: string
  marketImageUrl: string
  marketResolutionTime: number
  yesAsaId: number
  noAsaId: number
  usdcAsaId: number
  spreadBps: number
  rewardToken: { id: string; name: string }
  rewardTokenAmount: number
  totalProviders: number
  totalUsdcDeposited: number
  isActive: boolean
  isResolved: boolean
  resolutionOutcome: 'yes' | 'no' | null
  createdAt: string
}

export interface AlphaArcadePosition {
  _id: string
  wallet: string
  poolId: string
  marketAppId: number
  usdcDeposited: number
  yesEscrowAppIds: number[]
  noEscrowAppIds: number[]
  spreadUsed: number
  entryMidPrice: number
  status: 'active' | 'pending_withdrawal' | 'withdrawing' | 'withdrawn' | 'auto_withdrawn' | 'resolved'
  warningsSent?: { type: '48hr' | '24hr' | '6hr'; sentAt: string }[]
  usdcRecovered: number
  remainingYesTokens: number
  remainingNoTokens: number
  createdAt: string
  updatedAt: string
}

export interface AlphaArcadeOrderbook {
  bids: { price: number; size: number }[]
  asks: { price: number; size: number }[]
  midPrice: number
}

export interface AlphaArcadeStats {
  tvl: number
  totalProviders: number
  totalPositions: number
  activePools: number
}

export interface BuildTxnResponse {
  unsignedTxns: string[]
  feeTxn?: string | null
  poolId: string
  pool: AlphaArcadePool
  fee?: number
  netAmount?: number
  feePercent?: number
  yesAsaId?: number
  noAsaId?: number
  marketAddress?: string
  spreadBps?: number
  midPrice?: number
  spreadOffset?: number
  marketAppId?: number
}
