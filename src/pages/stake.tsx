import { useState } from 'react'
import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import Stakebanner from '../components/pages/stake/stakebanner'
import StakeTable from '../components/pages/stake/stakeTable'
import PageBg from '../components/shared/pageBg'

const Stake = () => {
  const [totals, setTotals] = useState({ totalTvl: 0, totalStaked: 0, totalRewards: 0 })
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <StakeTable setTotals={setTotals} />
        <Footer />
      </div>
    </>
  )
}

export default Stake
