import Footer from '../components/layout/footer'
import Navbar from '../components/layout/navbar'
import EventsPage from '../components/pages/events/EventsPage'
import PageBg from '../components/shared/pageBg'

const Events = () => (
  <div className="relative overflow-hidden min-h-screen flex flex-col">
    <PageBg />
    <Navbar />
    <EventsPage />
    <Footer />
  </div>
)

export default Events
