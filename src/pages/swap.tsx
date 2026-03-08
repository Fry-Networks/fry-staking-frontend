import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import SwapMain from '../components/pages/swap/swapMain'
import PageBg from '../components/shared/pageBg'

const Swap = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <SwapMain />
        <Footer />
      </div>
    </>
  )
}

export default Swap
