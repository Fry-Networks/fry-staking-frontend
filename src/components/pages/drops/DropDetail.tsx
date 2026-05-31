import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { Spin } from 'antd'
import { useWallet } from '@txnlab/use-wallet'

interface Drop {
  dropId: string
  tokenAsaId: number
  totalAmount: number
  claimsCount: number
  deadline: number
  status: string
  name: string
}

const DropDetail: React.FC = () => {
  const { dropId } = useParams<{ dropId: string }>()
  const navigate = useNavigate()
  const { activeAddress } = useWallet()

  const [drop, setDrop] = useState<Drop | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!dropId) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const fetchDrop = async () => {
      setLoading(true)
      try {
        const mockDrop: Drop = {
          dropId,
          tokenAsaId: 2485314946,
          totalAmount: 1000000,
          claimsCount: 50,
          deadline: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          status: 'active',
          name: 'Drop Number ' + dropId,
        }
        setDrop(mockDrop)
        setNotFound(false)
      } catch (e) {
        console.error('Failed to fetch drop:', e)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchDrop()
  }, [dropId])

  if (loading) {
    return (
      <div className="w-full mt-[40px] mb-[47px] flex-1">
        <div className="max-xxxl:w-[95%] w-[80%] m-auto flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      </div>
    )
  }

  if (notFound || !drop) {
    return (
      <div className="w-full mt-[40px] mb-[47px] flex-1">
        <div className="max-xxxl:w-[95%] w-[80%] m-auto flex flex-col items-center justify-center p-8">
          <Icon icon="mdi:alert-circle" className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text-heading)] mb-2">Drop Not Found</h3>
          <button
            onClick={() => navigate('/drops')}
            className="px-6 py-2 rounded-lg bg-secondary text-white font-medium hover:opacity-90"
          >
            Back to Drops
          </button>
        </div>
      </div>
    )
  }

  const deadlineDate = new Date(drop.deadline * 1000)

  return (
    <div className="w-full mt-[40px] mb-[47px] flex-1">
      <div className="max-xxxl:w-[95%] w-[80%] m-auto flex flex-col gap-[24px]">
        <button
          onClick={() => navigate('/drops')}
          className="flex items-center gap-2 text-secondary hover:opacity-80 transition-opacity w-fit"
        >
          <Icon icon="mdi:chevron-left" width={20} />
          <span className="text-sm font-medium">Back to Drops</span>
        </button>

        <div className="bg-[var(--bg-card)] rounded-[16px] p-8 shadow-[0px_4px_24.2px_0px_var(--shadow-color)]">
          <h1 className="text-[var(--text-heading)] font-bold text-4xl mb-4">{drop.name}</h1>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-[var(--text-secondary)] text-sm mb-1">Token ASA ID</p>
              <p className="text-[var(--text-primary)] font-mono font-semibold">{drop.tokenAsaId}</p>
            </div>
            <div>
              <p className="text-[var(--text-secondary)] text-sm mb-1">Total Amount</p>
              <p className="text-[var(--text-primary)] font-semibold">{drop.totalAmount} tokens</p>
            </div>
            <div>
              <p className="text-[var(--text-secondary)] text-sm mb-1">Claims Processed</p>
              <p className="text-[var(--text-primary)] font-semibold">{drop.claimsCount}</p>
            </div>
            <div>
              <p className="text-[var(--text-secondary)] text-sm mb-1">Deadline</p>
              <p className="text-[var(--text-primary)] font-semibold">{deadlineDate.toLocaleDateString()}</p>
            </div>
          </div>

          {!activeAddress && (
            <p className="text-[var(--text-secondary)] text-center py-4">Connect your wallet to claim this drop</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default DropDetail
