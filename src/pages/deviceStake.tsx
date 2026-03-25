import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import DeviceStakeTable from '../components/pages/deviceStake/deviceStakeTable'
import PageBg from '../components/shared/pageBg'
import { FeatureGate } from '../components/FeatureGate'

const DeviceStake = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <FeatureGate feature="deviceStaking">
          <DeviceStakeTable />
        </FeatureGate>
        <Footer />
      </div>
    </>
  )
}

export default DeviceStake
