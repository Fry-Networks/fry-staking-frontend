import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import DeviceStakeTable from '../components/pages/deviceStake/deviceStakeTable'
import PageBg from '../components/shared/pageBg'

const DeviceStake = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <DeviceStakeTable />
        <Footer />
      </div>
    </>
  )
}

export default DeviceStake
