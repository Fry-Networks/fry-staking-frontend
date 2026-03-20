import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import NftStakeTable from '../components/pages/nftStake/nftStakeTable'
import PageBg from '../components/shared/pageBg'
import { FeatureGate } from '../components/FeatureGate'

const NftStake = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <FeatureGate feature="nftStaking">
          <NftStakeTable />
        </FeatureGate>
        <Footer />
      </div>
    </>
  )
}

export default NftStake
