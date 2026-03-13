export interface AlphaArcadeMarket {
  app_id: number
  question: string
  category: string
  image_url: string
  resolution_time: number
  yes_token_id: number
  no_token_id: number
  yes_price: number
  no_price: number
  volume_24h: number
  total_volume: number
  status: string
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
  status: 'active' | 'withdrawing' | 'withdrawn' | 'auto_withdrawn' | 'resolved'
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

export interface BuildTxnResponse {
  transactions: string[]
  poolId: string
  pool: AlphaArcadePool
}
