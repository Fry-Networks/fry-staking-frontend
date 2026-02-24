import { Icon } from '@iconify/react'
import { useWallet } from '@txnlab/use-wallet'
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import Addstake from '../../../Modals/website/addStakeModal'
import Button from '../../shared/button'
import STable from './sTable'
import Stakebanner from './stakebanner'
import { TokenService } from '../../../services/TokenService'

interface StakeTableProps {
  setTotals: (totals: { totalTvl: number; totalStaked: number; totalRewards: number }) => void
}
const USDC_ID = 31566704 // Algorand USDC ASA id

// Helper function to validate image URL (outside component to avoid recreation)
const isValidImageUrl = (url: string | undefined | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  // Check if it's a valid URL format
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    // If URL parsing fails, check if it's a relative path or data URL
    return url.startsWith('data:') || url.startsWith('/') || url.includes('.png') || url.includes('.jpg') || url.includes('.svg');
  }
};

const StakeTable: React.FC<StakeTableProps> = ({ setTotals }) => {
  // Initialize TokenService
  const tokenService = new TokenService();
  
  const [isaddStakeOpen, setisaddStakeOpen] = useState(false)
  const [stacks, setStacks] = useState<any[]>([])
  const [originalData, setOriginalData] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))
  const [tvlData, setTvlData] = useState<{ [key: string]: number }>({}) // Token prices for TVL calculations
  const [tokenImages, setTokenImages] = useState<{ [key: string]: string }>({}) // Token images from database
  // const [activeTab, setActiveTab] = useState<'Live' | 'Ended' | 'All'>('Live')
  const api_base_url = import.meta.env.VITE_API_BASE_URL;

  type TabOption = 'MyLive' | 'MyEnded' | 'Live' | 'Ended' | 'All'
  const [activeTab, setActiveTab] = useState<TabOption>('MyLive')

  const [filteredData, setFilteredData] = useState<any[]>([])
  const [searchToken, setSearchToken] = useState<string>('')

  const { activeAddress } = useWallet()

  const onCreateStakeClick = () => {
    setisaddStakeOpen(true)
  }

  // Fetch token data from database (prices and images)
  const fetchTokenData = async (): Promise<{ priceMap: { [key: string]: number }, imageMap: { [key: string]: string } }> => {
    try {
      // Fetch all tokens from database
      const tokens = await tokenService.fetchAllTokens();
      
      // Build price map for TVL calculations
      const priceMap: { [key: string]: number } = {};
      const imageMap: { [key: string]: string } = {};
      
      tokens.forEach(token => {
        priceMap[token.id.toString()] = token.price || 1; // Use token price or default to 1
        // Only use database image if it's valid, otherwise use Tinyman fallback
        const dbImage = token.image;
        if (isValidImageUrl(dbImage)) {
          imageMap[token.id.toString()] = dbImage;
        } else {
          // Use Tinyman as default if database image is invalid
          imageMap[token.id.toString()] = `https://asa-list.tinyman.org/assets/${token.id}/icon.png`;
        }
      });
      
      setTvlData(priceMap);
      setTokenImages(imageMap);
      
      return { priceMap, imageMap };
    } catch (error) {
      console.error('Failed to fetch token data:', error);
      // Set default prices and images
      const emptyMap = {};
      setTvlData(emptyMap);
      setTokenImages(emptyMap);
      return { priceMap: emptyMap, imageMap: emptyMap };
    }
  };

  const calculateTotals = () => {
    // console.log('in calculate totals')
    // console.log(filteredData)

    const totalTvl = filteredData.reduce((sum, item) => {
      const tvlValue = parseFloat(item.tvl.replace('$', '').trim()) || 0
      return sum + tvlValue
    }, 0)

    const totalStaked = filteredData.reduce((sum, item) => {
      const tvlValue = parseFloat(item.staked.replace('$', '').trim()) || 0
      return sum + tvlValue
    }, 0)

    // const totalRewards = filteredData.reduce((sum, item) => {
    //   const tvlValue = parseFloat(item.tvlReward) || 0
    //   return sum + tvlValue
    // }, 0)

    const totalRewards = filteredData.reduce((sum, item) => {
      const reward = typeof item.reward === 'number' ? item.reward : parseFloat(item.reward?.props?.children?.[1]) || 0;
      return sum + reward;
    }, 0);

    return { totalTvl, totalStaked, totalRewards }
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchToken(event.target.value)
  }

  useEffect(() => {
    // Only fetch pools when searchToken changes (not on initial tokenImages load)
    // Initial load is handled by the fetchTokenData useEffect
    if (Object.keys(tokenImages).length > 0 || searchToken) {
      const timer = setTimeout(() => {
        fetchAllPools()
      }, 800)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [searchToken])

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (originalData.length > 0) {
      updateRewards()
    }
  }, [currentTime])

  // const calculateReward = (stakingAmount: number, aprRate: number, stakingTime: number, currentTime: number): number => {
  //   if (isNaN(stakingAmount) || isNaN(aprRate) || isNaN(stakingTime)) return 0
  //   const normalizedStakeTime = (currentTime - stakingTime) / 31536000
  //   const reward = stakingAmount * aprRate * normalizedStakeTime
  //   return parseFloat(reward.toFixed(3))
  // }

  // const calculateReward = (
  //   staked: number,
  //   aprScaled: number, // APR in scaled form e.g. 1200000
  //   secondsStaked: number
  // ): number => {
  //   const reward = (staked * aprScaled * ((secondsStaked * 100) / 31104000)) / 1_000_000
  //   return Number(reward.toFixed(3))
  // }

  const calculateReward = (staked: number, aprScaled: number, secondsStaked: number) => {
    const reward = (staked * aprScaled * (secondsStaked / 31104000)) / 1_000_000
    return Number(reward.toFixed(3))
  }


  const fetchAllPools = async () => {
    try {
      const response = await axios.get(`${api_base_url}/staking/all`, {
        params: { tokenName: searchToken },
        headers: { 'Content-Type': 'application/json' },
      })
      // Pass tokenImages to processPoolData to ensure it uses the latest images
      processPoolData(response.data.data, tokenImages)
    } catch (error) {
      console.error('Error fetching all pools:', error)
    }
  }
async function fetchAlgoUsd(): Promise<number> {
  const r = await axios.get('https://api1.binance.com/api/v3/ticker/price', {
    params: { symbol: 'ALGOUSDT' },
  })
  return parseFloat(r.data?.price ?? '0')
}

async function fetchTinymanPool(a: number, b: number) {
  // Tinyman Analytics v1 pool endpoint (order-insensitive, try both just in case)
  const tryUrls = [
    `https://mainnet.analytics.tinyman.org/api/v1/pool/${a}/${b}/`,
    `https://mainnet.analytics.tinyman.org/api/v1/pool/${b}/${a}/`,
  ]
  for (const url of tryUrls) {
    try {
      const res = await axios.get(url, { timeout: 10000 })
      if (res.status === 200 && res.data) return res.data
    } catch {
      // try next
    }
  }
  throw new Error('Pool not found')
}

async function getAsaUsdPrice(asaId: number): Promise<number> {
  try {
    // 1) Prefer ASA/USDC pool -> direct USD price
    const usdcPool = await fetchTinymanPool(asaId, USDC_ID)
    const r = usdcPool?.reserves || usdcPool?.data?.reserves || usdcPool
    const reserveA = Number(r?.[asaId] ?? r?.asset_1 ?? 0)
    const reserveUSDC = Number(r?.[USDC_ID] ?? r?.asset_2 ?? 0)
    if (reserveA > 0 && reserveUSDC > 0) {
      return reserveUSDC / reserveA
    }
  } catch {
    // ignore; fallback below
  }

  // 2) Fallback: ASA/ALGO pool -> multiply by ALGO/USD
  const algoUsd = await fetchAlgoUsd()
  const ALGO_ASSET_ID = 0 // ALGO is native (represented as 0 in Tinyman analytics)
  const algoPool = await fetchTinymanPool(asaId, ALGO_ASSET_ID)
  const r2 = algoPool?.reserves || algoPool?.data?.reserves || algoPool

  // Detect which key is ASA vs ALGO
  const reserveAsa =
    Number(r2?.[asaId]) ??
    Number(r2?.asset_1_id === asaId ? r2?.asset_1 : r2?.asset_2) ?? 0
  const reserveAlgo =
    Number(r2?.[ALGO_ASSET_ID]) ??
    Number(r2?.asset_1_id === ALGO_ASSET_ID ? r2?.asset_1 : r2?.asset_2) ?? 0

  if (reserveAsa > 0 && reserveAlgo > 0) {
    const priceAsaInAlgo = reserveAlgo / reserveAsa
    return priceAsaInAlgo * algoUsd
  }

  // 3) Last resort
  return 1
}
// Updated processPoolData to use database token data
const processPoolData = async (result: any[], images: { [key: string]: string } = {}) => {
  const databaseImages = images;

  const transformedData = result.map((item: any, index: number) => {
    const now = Math.floor(Date.now() / 1000)
    const secondsLeft = item.stakingEndTime - now
    const daysLeft = Math.floor(secondsLeft / 86400)

    const normalizedStakedAmount = item.totalAmountStaked
    const secondsStaked = now - item.stakingTime
    const scaledApr = item.aprRate
    const finalReward = calculateReward(normalizedStakedAmount, scaledApr, secondsStaked)

    const stakeTokenId = (item?.stakeToken?.id ?? item?.stakeTokenId)?.toString()
    const rewardTokenId = (item?.rewardToken?.id ?? item?.rewardTokenId)?.toString()
    
    // Use database images with fallback to Tinyman
    // Validate database images before using them
    const stakeDbImage = databaseImages[stakeTokenId];
    const rewardDbImage = databaseImages[rewardTokenId];
    
    const staketokenImage = (stakeDbImage && isValidImageUrl(stakeDbImage)) 
      ? stakeDbImage 
      : `https://asa-list.tinyman.org/assets/${stakeTokenId}/icon.png`;
    const rewardtokenImage = (rewardDbImage && isValidImageUrl(rewardDbImage)) 
      ? rewardDbImage 
      : `https://asa-list.tinyman.org/assets/${rewardTokenId}/icon.png`;

    // Use database prices with fallback to calculated prices
    const usdPrice = tvlData[stakeTokenId] || 1
    const tvlUsd = normalizedStakedAmount * usdPrice

    return {
      _id: item._id,
      key: index + 1,
      pool: (
        <div className="flex items-center gap-[16px] w-[350px]">
          <div className="flex relative">
            <img 
              key={`reward-${rewardTokenId}-${rewardtokenImage}`}
              src={rewardtokenImage} 
              className="w-[40px] h-[40px] rounded-full drop-shadow-md" 
              alt={item?.rewardToken?.name || 'Reward token'}
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Prevent infinite loop - check if we've already tried to fallback
                const hasTriedFallback = target.dataset.fallbackAttempted === 'true';
                if (!hasTriedFallback && !target.src.includes('tinyman.org')) {
                  target.dataset.fallbackAttempted = 'true';
                  target.src = `https://asa-list.tinyman.org/assets/${rewardTokenId}/icon.png`;
                } else if (hasTriedFallback || target.src.includes('tinyman.org')) {
                  // If Tinyman also fails or we've already tried, use a placeholder
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI0U1RTlFQSIvPjxwYXRoIGQ9Ik0yMCAxMkMxNS41ODIyIDEyIDEyIDE1LjU4MjIgMTIgMjBDMTIgMjQuNDE3OCAxNS41ODIyIDI4IDIwIDI4QzI0LjQxNzggMjggMjggMjQuNDE3OCAyOCAyMEMyOCAxNS41ODIyIDI0LjQxNzggMTIgMjAgMTJaIiBmaWxsPSIjOUI5Q0E1Ii8+PC9zdmc+';
                }
              }}
            />
            <img 
              key={`stake-${stakeTokenId}-${staketokenImage}`}
              src={staketokenImage} 
              className="w-[40px] h-[40px] rounded-full drop-shadow-md z-50 -ml-4" 
              alt={item?.stakeToken?.name || 'Stake token'}
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Prevent infinite loop - check if we've already tried to fallback
                const hasTriedFallback = target.dataset.fallbackAttempted === 'true';
                if (!hasTriedFallback && !target.src.includes('tinyman.org')) {
                  target.dataset.fallbackAttempted = 'true';
                  target.src = `https://asa-list.tinyman.org/assets/${stakeTokenId}/icon.png`;
                } else if (hasTriedFallback || target.src.includes('tinyman.org')) {
                  // If Tinyman also fails or we've already tried, use a placeholder
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI0U1RTlFQSIvPjxwYXRoIGQ9Ik0yMCAxMkMxNS41ODIyIDEyIDEyIDE1LjU4MjIgMTIgMjBDMTIgMjQuNDE3OCAxNS41ODIyIDI4IDIwIDI4QzI0LjQxNzggMjggMjggMjQuNDE3OCAyOCAyMEMyOCAxNS41ODIyIDI0LjQxNzggMTIgMjAgMTJaIiBmaWxsPSIjOUI5Q0E1Ii8+PC9zdmc+';
                }
              }}
            />
          </div>
          <div className="flex flex-col">
            <h6 className="text-black font-bold tracking-[0.1px]">Stake {item?.stakeToken?.name || 'Token'}</h6>
            <p className="text-green font-medium small">Earn {item?.rewardToken?.name || 'Token'}</p>
            <p className="text-text_clr small">with {item?.lockPeriod / 86400} days lock</p>
          </div>
        </div>
      ),
      tvl: `$ ${Number(tvlUsd.toFixed(3)).toString().replace(/(\.\d*?)0+$/, '$1')}`,
      apr: `${item.aprRate}%`,
      staked: `$ ${Number(tvlUsd.toFixed(3)).toString().replace(/(\.\d*?)0+$/, '$1')}`,
      poolTime: item.duration / 86400,
      reward: Number(finalReward.toFixed(3)),
      ends: (
        <p className="text-text_clr small font-medium">
          {daysLeft >= 0 ? `${Math.max(daysLeft, 1)} ${Math.max(daysLeft, 1) === 1 ? 'day' : 'days'}` : 'Ended'}
        </p>
      ),
      stakingContractId: Number(item.stakingContractId),
      stakingTime: item.stakingTime,
      stakingEndTime: item.stakingEndTime,
      tvlReward: finalReward * usdPrice,
      totalAmountStaked: item.totalAmountStaked,
      userAddress: item.creatorId,
    }
  })

  setOriginalData(transformedData)
}

  const handleTabSwitch = (tab: TabOption) => {
    setActiveTab(tab);
  };

  const updateRewards = () => {
    const updatedData = filteredData.map((item) => {
      //   const stakedInDollars = parseFloat(item.staked.replace('$', '').trim())
      //   const finalReward = calculateReward(stakedInDollars, parseFloat(item.apr), item.stakingTime, currentTime)
      const stakedInFRY = item.totalAmountStaked
      const apr = parseFloat(item.apr) > 1 ? parseFloat(item.apr) / 100 : parseFloat(item.apr)
      const secondsStaked = currentTime - item.stakingTime
      const finalReward = calculateReward(stakedInFRY, apr, secondsStaked)

      return {
        ...item,
        reward: <p className="text-text_clr text-[15px] font-medium">$ {finalReward.toFixed(3)}</p>,
      }
    })

    setFilteredData(updatedData)
  }

  const filterPools = (data: any[]) => {
    const now = Math.floor(Date.now() / 1000)

    return data.filter((item) => {
      const isEnded = item.stakingEndTime <= now
      const isLive = item.stakingEndTime > now
      const belongsToWallet = item?.userAddress?.toLowerCase() === activeAddress?.toLowerCase()

      switch (activeTab) {
        case 'MyLive':
          return isLive && belongsToWallet
        case 'MyEnded':
          return isEnded && belongsToWallet
        case 'Live':
          return isLive && !belongsToWallet
        case 'Ended':
          return isEnded && !belongsToWallet
        case 'All':
          return true
        default:
          return true
      }
    })
  }


  useEffect(() => {
    const filtered = filterPools(originalData)
    setFilteredData(filtered)
  }, [originalData, activeTab, activeAddress])

  useEffect(() => {
    const totals = calculateTotals()
    setTotals(totals)
    setStacks(filteredData)
  }, [filteredData])

  useEffect(() => {
    const loadData = async () => {
      const { imageMap } = await fetchTokenData()
      // Fetch pools after token images are loaded, using the imageMap directly
      // Use fetchAllPools but pass imageMap to ensure it uses the latest images
      try {
        const response = await axios.get(`${api_base_url}/staking/all`, {
          params: { tokenName: searchToken },
          headers: { 'Content-Type': 'application/json' },
        })
        processPoolData(response.data.data, imageMap)
      } catch (error) {
        console.error('Error fetching all pools:', error)
      }
    }
    loadData()
  }, [])
  
  // Refetch pools when tokenImages are loaded/updated (but not on initial empty state)
  useEffect(() => {
    // Only refetch if we have token images and original data exists (meaning pools were already loaded)
    // Add a small delay to prevent rapid re-renders
    if (Object.keys(tokenImages).length > 0 && originalData.length > 0) {
      const timer = setTimeout(() => {
        fetchAllPools()
      }, 300)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [tokenImages])

  return (
    <>
      <div className="w-full mt-[40px] mb-[47px]">
        {activeAddress && <Stakebanner wallet={activeAddress} />}
        <div className="max-xxxl:w-[95%] w-[80%] m-auto flex flex-col gap-[16px]">
          {/* Tabs */}
          <div className="top flex max-md:flex-col justify-between items-center gap-[20px]">
            <div className="flex w-full justify-center md:justify-start">
              <div className="switcher flex flex-wrap justify-center md:flex-nowrap gap-[8px] p-[8px] bg-white rounded-[12px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)] overflow-x-auto max-w-full">
                {(['MyLive', 'MyEnded', 'Live', 'Ended', 'All'] as TabOption[]).map((tab) => (
                  <p
                    key={tab}
                    className={`${activeTab === tab
                      ? 'text-white linearGradient shadow-md'
                      : 'text-black hover:bg-gray-50'
                    } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] px-[16px] min-w-[120px] h-[40px] text-[14px] whitespace-nowrap transition-all duration-200`}
                    onClick={() => handleTabSwitch(tab)}
                  >
                    {{
                      MyLive: 'My Live',
                      MyEnded: 'My Ended',
                      Live: 'Live Pools',
                      Ended: 'Ended Pools',
                      All: 'All Pools',
                    }[tab]}
                  </p>
                ))}
              </div>
            </div>


            {/* Search + Create Stake */}
            <div className="flex flex-col md:items-end gap-[14px] w-full">
              <div className="flex justify-center md:justify-end">
                <Button
                  text="Create Stake"
                  onClick={onCreateStakeClick}
                  img="ic:sharp-add"
                  className="button btn-red-border w-[250px] md:w-[180px]"
                  height={45}
                  clr="text-red"
                />
              </div>
              <div className="max-w-[398px] max-md:max-w-[250px] w-full mx-auto md:mx-0 py-[12px] px-[8px] flex items-center gap-[8px] rounded-[12px] bg-white shadow">
                <Icon icon="si:search-line" color="#A8A8A8" width={22} height={22} />
                <input type="search" placeholder="Search token" className="w-full" value={searchToken} onChange={handleSearchChange} />
              </div>
            </div>
          </div>

          {/* Table */}
          {/* <div className="bottom">
            <STable stacks={stacks} fetchData={fetchAllPools} activeTab={activeTab} />
          </div> */}
          {/* <div className="bottom">
            {activeTab === 'Live' ? (
              <STable stacks={stacks} fetchData={fetchAllPools} showExpandable='Live' />
            ) : (
              <STable stacks={stacks} fetchData={fetchAllPools} showExpandable='All' />
            )}
          </div> */}

          <div className="w-full mt-1">
            <p className="text-sm text-gray-500">
              {{
                MyLive: 'Showing your active staking pools.',
                MyEnded: 'Showing your ended staking pools.',
                Live: 'Showing active pools from other users.',
                Ended: 'Showing ended pools from other users.',
                All: 'Showing all staking pools.',
              }[activeTab]}
            </p>
          </div>

          <div className="bottom">
            {!activeAddress ? (
              <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-sm">
                <Icon icon="mdi:wallet-outline" className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Connect Your Wallet</h3>
                <p className="text-gray-500 text-center">Please connect your wallet to view staking pools and start earning rewards.</p>
              </div>
            ) : stacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-sm">
                <Icon icon="mdi:folder-open-outline" className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Pools Found</h3>
                <p className="text-gray-500 text-center">There are currently no staking pools available in this category.</p>
              </div>
            ) : (
              <STable
                stacks={stacks}
                fetchData={fetchAllPools}
                showExpandable={activeTab}
              />
            )}
          </div>
        </div>
      </div>
      <Addstake isaddStakeOpen={isaddStakeOpen} setisaddStakeOpen={setisaddStakeOpen} fetchData={fetchAllPools} />
    </>
  )
}

export default StakeTable
