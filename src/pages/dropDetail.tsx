import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import DropDetail from '../components/pages/drops/DropDetail'
import PageBg from '../components/shared/pageBg'
import { FeatureGate } from '../components/FeatureGate'

const DropDetailPage = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <FeatureGate feature="drops">
          <DropDetail />
        </FeatureGate>
        <Footer />
      </div>
    </>
  )
}

export default DropDetailPage
