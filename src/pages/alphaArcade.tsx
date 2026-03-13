import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import AlphaArcadePage from '../components/pages/alphaArcade/AlphaArcadePage'
import PageBg from '../components/shared/pageBg'

const AlphaArcade = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <AlphaArcadePage />
        <Footer />
      </div>
    </>
  )
}

export default AlphaArcade
