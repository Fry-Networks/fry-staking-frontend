import React, { useEffect, useState } from 'react'
import axios from 'axios'

interface StakeStats {
  totalTVL: number
  myStake: number
  myReward: number
}

interface StakeBannerProps {
  wallet: string | undefined
}

const Stakebanner: React.FC<StakeBannerProps> = ({ wallet }) => {
  const [stats, setStats] = useState<StakeStats>({
    totalTVL: 0,
    myStake: 0,
    myReward: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      if (!wallet) return

      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/stakingtoken/user-staking-stats/${wallet}`
        )

        if (res.data.success) {
          const { totalTVL, myStake, myReward } = res.data.data
          setStats({ totalTVL, myStake, myReward })
        }
      } catch (error) {
        console.error('Failed to fetch staking stats:', error)
      }
    }

    fetchStats()
  }, [wallet])

  return (
    <div className="w-full mt-[40px] mb-[47px]">
      <div className="max-xxxl:w-[95%] w-[80%] m-auto flex sm-s:flex-col justify-between gap-[10px] sm-s:gap-[20px] bg-white rounded-[18px] py-[32px] max-xxxl:px-[140px] px-[190px] max-sm:!px-[40px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
        <div className="flex flex-col items-center gap-[24px] sm-s:gap-[6px]">
          <p className="text-text_clr tracking-[0.54px] large">Stake TVL</p>
          <h3 className="small text-black font-medium tracking-[1.08px]">
            {stats.totalTVL.toLocaleString()}
          </h3>
        </div>
        <div className="flex flex-col items-center gap-[24px] sm-s:gap-[6px]">
          <p className="text-text_clr tracking-[0.54px] large">My Stakes</p>
          <h3 className="small text-black font-medium tracking-[1.08px]">
            {stats.myStake.toLocaleString()}
          </h3>
        </div>
        <div className="flex flex-col items-center gap-[24px] sm-s:gap-[6px]">
          <p className="text-text_clr tracking-[0.54px] large">My Reward</p>
          <h3 className="small text-black font-medium tracking-[1.08px]">
            {Number(stats.myReward).toFixed(6)}
          </h3>
        </div>
      </div>
    </div>
  )
}

export default Stakebanner
