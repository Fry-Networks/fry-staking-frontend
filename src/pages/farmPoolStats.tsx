import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import FarmPoolStat from '../components/pages/farmpoolStats/farmpoolStats'
import PageBg from '../components/shared/pageBg'

const FarmPoolStats = () => {
  return (
    <>
      <div className="relative overflow-hidden">
        <PageBg />
        <Navbar />
        <FarmPoolStat />
        <Footer />
      </div>
    </>
  )
}

export default FarmPoolStats
