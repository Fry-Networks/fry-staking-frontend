import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import DropsPage from '../components/pages/drops/DropsPage'
import PageBg from '../components/shared/pageBg'
import { FeatureGate } from '../components/FeatureGate'

const Drops = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <FeatureGate feature="drops">
          <DropsPage />
        </FeatureGate>
        <Footer />
      </div>
    </>
  )
}

export default Drops
