import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet'
import axios from 'axios'

const P_Farmbanner = () => {
  const { activeAddress } = useWallet()
  const [stats, setStats] = useState({ poolsCreated: 0, totalTvl: 0 })
  const api_base_url = import.meta.env.VITE_API_BASE_URL

  useEffect(() => {
    if (activeAddress) fetchStats()
  }, [activeAddress])

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${api_base_url}/farming/all`)
      const allFarms = res.data?.data || []

      const userFarms = allFarms.filter(
        (f: any) => f.creatorId?.toLowerCase() === activeAddress?.toLowerCase()
      )

      const totalTvl = userFarms.reduce((sum: number, f: any) => sum + (f.totalStaked || 0), 0)

      setStats({ poolsCreated: userFarms.length, totalTvl })
    } catch (error) {
      console.error('Error fetching farm stats:', error)
    }
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div className="m-auto flex max-sm:flex-col w-full justify-between gap-[10px] bg-[var(--card-bg,white)] rounded-[18px] py-[32px] max-sm:gap-[30px] px-[40px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
      <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
        <p className="text-[var(--text-secondary)] tracking-[0.54px] large">Farms Created</p>
        <h3 className="small text-[var(--text-primary)] font-medium tracking-[1.08px]">
          <span className="text-red">{stats.poolsCreated}</span>
        </h3>
      </div>
      <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
        <p className="text-[var(--text-secondary)] tracking-[0.54px] large">Farm TVL</p>
        <h3 className="small text-[var(--text-primary)] font-medium tracking-[1.08px]">
          <span className="text-red">$</span>{fmt(stats.totalTvl)}
        </h3>
      </div>
    </div>
  )
}

export default P_Farmbanner
