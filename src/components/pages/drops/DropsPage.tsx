import React, { useEffect, useState } from 'react'
import { useNavigate } from "react-router-dom"
import DappFilter from "../../shared/DappFilter"
import { Icon } from '@iconify/react'
import { Spin } from 'antd'
import { getDropsStats } from '../../../services/dropsApi'
import type { DropsStats } from '../../../services/dropsApi'

const DropsPage: React.FC = () => {
  const [stats, setStats] = useState<DropsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const statsData = await getDropsStats().catch(() => null)
        if (statsData) setStats(statsData)
      } catch (e) {
        console.error('Failed to fetch drops data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="w-full mt-[40px] mb-[47px] flex-1">
      <div className="max-xxxl:w-[95%] w-[80%] m-auto flex flex-col gap-[24px]">
        <div className="flex items-center gap-3">
          <Icon icon="mdi:parachute-outline" width={32} className="text-secondary" />
          <h2 className="text-[var(--text-heading)] font-bold text-2xl">Drops</h2>
        </div>

        {/* Stats banner */}
        <div className="flex sm-s:flex-col justify-between gap-[10px] sm-s:gap-[20px] bg-[var(--bg-card)] rounded-[18px] py-[32px] px-[60px] max-sm:!px-[30px] shadow-[0px_4px_24.2px_0px_var(--shadow-color)]">
          <div className="flex flex-col items-center gap-[6px]">
            <p className="text-text_clr tracking-[0.54px] large">Total Drops</p>
            <h3 className="small text-[var(--text-heading)] font-medium tracking-[1.08px]">
              {loading ? '...' : stats?.totalDrops ?? 0}
            </h3>
          </div>
          <div className="flex flex-col items-center gap-[6px]">
            <p className="text-text_clr tracking-[0.54px] large">Total Claims</p>
            <h3 className="small text-[var(--text-heading)] font-medium tracking-[1.08px]">
              {loading ? '...' : (stats?.totalClaims ?? 0).toLocaleString()}
            </h3>
          </div>
          <div className="flex flex-col items-center gap-[6px]">
            <p className="text-text_clr tracking-[0.54px] large">Claim Fee</p>
            <h3 className="small text-[var(--text-heading)] font-medium tracking-[1.08px]">
              {loading ? '...' : `${stats?.perClaimFee ?? 0} ALGO`}
            </h3>
          </div>
          <div className="flex flex-col items-center gap-[6px]">
            <p className="text-text_clr tracking-[0.54px] large">Creation Fee</p>
            <h3 className="small text-[var(--text-heading)] font-medium tracking-[1.08px]">
              {loading ? '...' : `${stats?.creationFee ?? 0} ALGO`}
            </h3>
          </div>
        </div>

        {/* Drops info */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" />
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] rounded-[18px] p-8 shadow-[0px_4px_24.2px_0px_var(--shadow-color)]">
            <div className="flex flex-col items-center text-center gap-4">
              <Icon icon="mdi:parachute-outline" className="w-16 h-16 text-gray-400" />
              <h3 className="text-xl font-semibold text-[var(--text-heading)]">
                {stats?.totalDrops ?? 0} Drops Created
              </h3>
              <p className="text-[var(--text-secondary)] max-w-md">
                Haystack Drops lets creators airdrop tokens to their community.
                {' '}{(stats?.totalClaims ?? 0).toLocaleString()} claims processed so far.
              </p>
              <a
                href="https://haystack.network"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-white font-medium hover:opacity-90 transition-opacity"
              >
                <Icon icon="mdi:parachute" width={20} />
                Create or Claim Drops on Haystack
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DropsPage
