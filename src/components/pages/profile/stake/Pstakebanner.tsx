import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet'
import axios from 'axios'

const PStakebanner = () => {
  const { activeAddress } = useWallet()
  const [stats, setStats] = useState({ poolsCreated: 0, totalTvl: 0, myStakes: 0, myRewards: 0 })
  const api_base_url = import.meta.env.VITE_API_BASE_URL

  useEffect(() => {
    if (activeAddress) fetchStats()
  }, [activeAddress])

  const fetchStats = async () => {
    try {
      const [allPoolsRes, stakerDataRes] = await Promise.allSettled([
        axios.get(`${api_base_url}/staking/all`),
        axios.get(`${api_base_url}/stakerdata/${activeAddress}`),
      ])

      const allPools = allPoolsRes.status === 'fulfilled' ? allPoolsRes.value.data?.data || [] : []
      const stakerRecords = stakerDataRes.status === 'fulfilled' ? stakerDataRes.value.data?.data || [] : []

      const poolsCreated = allPools.filter((p: any) => p.creatorId?.toLowerCase() === activeAddress?.toLowerCase()).length
      const totalTvl = allPools
        .filter((p: any) => p.creatorId?.toLowerCase() === activeAddress?.toLowerCase())
        .reduce((sum: number, p: any) => sum + (p.totalAmountStaked || 0), 0)

      const myStakes = stakerRecords.reduce((sum: number, r: any) => sum + (r.stakedAmount || 0), 0) / 1_000_000
      const myRewards = stakerRecords.reduce((sum: number, r: any) => sum + (r.rewardClaimed || 0), 0) / 1_000_000

      setStats({ poolsCreated, totalTvl, myStakes, myRewards })
    } catch (error) {
      console.error('Error fetching stake stats:', error)
    }
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div className="m-auto flex max-sm:flex-col w-full justify-between gap-[10px] bg-[var(--card-bg,white)] rounded-[18px] py-[32px] max-sm:gap-[30px] px-[40px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
      <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
        <p className="text-[var(--text-secondary)] tracking-[0.54px] large">Pools Created</p>
        <h3 className="small text-[var(--text-primary)] font-medium tracking-[1.08px]">
          <span className="text-red">{stats.poolsCreated}</span>
        </h3>
      </div>
      <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
        <p className="text-[var(--text-secondary)] tracking-[0.54px] large">Stake TVL</p>
        <h3 className="small text-[var(--text-primary)] font-medium tracking-[1.08px]">
          <span className="text-red">$</span>{fmt(stats.totalTvl)}
        </h3>
      </div>
      <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
        <p className="text-[var(--text-secondary)] tracking-[0.54px] large">My Stakes</p>
        <h3 className="small text-[var(--text-primary)] font-medium tracking-[1.08px]">
          {fmt(stats.myStakes)}
        </h3>
      </div>
      <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
        <p className="text-[var(--text-secondary)] tracking-[0.54px] large">My Rewards</p>
        <h3 className="small text-[var(--text-primary)] font-medium tracking-[1.08px]">
          {fmt(stats.myRewards)}
        </h3>
      </div>
    </div>
  )
}

export default PStakebanner
