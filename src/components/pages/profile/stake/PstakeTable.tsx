import axios from 'axios'
import React, { useEffect, useState } from 'react'
import Addstake from '../../../../Modals/website/addStakeModal'
import Button from '../../../shared/button'
import P_STable from './PsTable'

const PstakeTable: React.FC = () => {
  const [isaddStakeOpen, setIsAddStakeOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'Live' | 'Ended'>('Live')
  const [activePool, setActivePool] = useState<'All' | 'My Pools'>('All')
  const [transactionData, setTransactionData] = useState<any[]>([]) // Store fetched transaction data
  const [loading, setLoading] = useState<boolean>(false) // For loading state
  const api_base_url = process.env.VITE_API_BASE_URL;

  // Define fetchData function
  const fetchData = async () => {
    try {
      setLoading(true) // Set loading to true while fetching
      console.log('Fetching data...')

      let url = `${api_base_url}/transactions` // Base API URL

      // Build the URL dynamically based on selected tab and pool
      if (activeTab === 'Live') {
        url += '?status=live' // Add query parameter for live transactions
      } else if (activeTab === 'Ended') {
        url += '?status=ended' // Add query parameter for ended transactions
      }

      if (activePool === 'My Pools') {
        url += '&pool=my' // Add query parameter for "My Pools"
      }

      console.log(`Fetching from URL: ${url}`)

      // Fetch the data from the API
      const response = await axios.get(url)

      // Check response status and data structure
      if (response.status === 200 && Array.isArray(response.data)) {
        console.log('Fetched data:', response.data)
        setTransactionData(response.data) // Set the fetched data in the state
      } else {
        console.error('Error fetching data:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false) // Set loading to false after fetching
    }
  }

  // Fetch data when the tab or pool selection changes
  useEffect(() => {
    console.log('Tab or pool changed, fetching data...')
    fetchData() // Fetch data on tab or pool change
  }, [activeTab, activePool]) // Dependency array to trigger fetch on state changes

  // Open "Create Stake" Modal
  const onCreateStakeClick = () => {
    setIsAddStakeOpen(true)
  }

  return (
    <>
      <div className="w-full m-auto flex flex-col gap-[16px]">
        {/* Top Section */}
        <div className="top flex max-sm:flex-col justify-between items-center gap-[10px]">
          {/* Left Section */}
          <div className="flex max-md:flex-col gap-[8px]">
            <div className="switcher flex justify-center items-center gap-[3px] w-fit p-[3px] bg-white rounded-[12px] shadow">
              <p
                className={`${
                  activeTab === 'Live' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px] shadow`}
                onClick={() => setActiveTab('Live')}
              >
                Live
              </p>
              <p
                className={`${
                  activeTab === 'Ended' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px]`}
                onClick={() => setActiveTab('Ended')}
              >
                Ended
              </p>
            </div>
            <div className="switcher flex justify-center items-center gap-[3px] w-fit p-[3px] bg-white rounded-[12px] shadow">
              <p
                className={`${
                  activePool === 'All' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px] shadow`}
                onClick={() => setActivePool('All')}
              >
                All
              </p>
              <p
                className={`${
                  activePool === 'My Pools' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px]`}
                onClick={() => setActivePool('My Pools')}
              >
                My Pools
              </p>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex gap-[14px] items-center justify-end w-full max-sm:justify-center">
            <Button
              text="Create Stake"
              onClick={onCreateStakeClick}
              img="ic:sharp-add"
              className="button btn-red-border max-sm:!w-[250px]"
              height={45}
              width={140}
              clr="text-red"
            />
          </div>
        </div>

        {/* Bottom Section - Table */}
        <div className="bottom">
          <P_STable
            activeTab={activeTab}
            activePool={activePool}
            data={transactionData} // ✅ Fix: Ensuring data is passed correctly
            loading={loading} // ✅ Fix: Ensuring loading is passed correctly
          />
        </div>
      </div>

      {/* Pass fetchData to Addstake */}
      <Addstake isaddStakeOpen={isaddStakeOpen} setisaddStakeOpen={setIsAddStakeOpen} fetchData={fetchData} />
    </>
  )
}

export default PstakeTable
