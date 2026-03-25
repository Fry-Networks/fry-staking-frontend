import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import AlphaArcadePage from '../components/pages/alphaArcade/AlphaArcadePage'
import PageBg from '../components/shared/pageBg'
import { FeatureGate } from '../components/FeatureGate'

const AlphaArcade = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <FeatureGate feature="predictionLp">
          <AlphaArcadePage />
        </FeatureGate>
        <Footer />
      </div>
    </>
  )
}

export default AlphaArcade
