import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import FarmTable from '../components/pages/farm/farmTable'
import PageBg from '../components/shared/pageBg'

const Farm = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen flex flex-col">
        <PageBg />
        <Navbar />
        <FarmTable />
        <Footer />
      </div>
    </>
  )
}

export default Farm
