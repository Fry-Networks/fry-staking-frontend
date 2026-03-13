import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import NftStakeTable from '../components/pages/nftStake/nftStakeTable'
import PageBg from '../components/shared/pageBg'

const NftStake = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <NftStakeTable />
        <Footer />
      </div>
    </>
  )
}

export default NftStake
