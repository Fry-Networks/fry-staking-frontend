import { Icon } from '@iconify/react'
import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet'
import EditProfileModal from '../../../Modals/website/editProfileModal'
import axios from 'axios'

const FRY_ASSET_ID = import.meta.env.VITE_FRY_TOKEN_ID // Replace with your actual FRY Token ID

const Profilebanner: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)

  const [iseditProfileOpen, setiseditProfileOpen] = useState(false)
  const [fryBalance, setFryBalance] = useState<number>(0)
  const [userData, setUserData] = useState<any>(null)
  const { activeAddress, clients } = useWallet()

  const dummyData = {
    name: 'Dummy User',
    profilePicture: '../../assets/images/home/mainDP.png',
    banner: '../../assets/images/home/coverDP.png',
    bio: '',
  }

  const fetchUserData = async () => {
    if (!activeAddress) {
      setIsLoading(false)
      setUserData(dummyData)
      return
    }

    try {
      setIsLoading(true)
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/user/${activeAddress}`)
      if (response.data.data) {
        setUserData(response.data.data)
      } else {
        setUserData(dummyData)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      setUserData(dummyData)
    } finally {
      setIsLoading(false)
    }
  }

 const fetchFryBalance = async () => {
    if (!activeAddress || !clients) return

    const provider = clients.pera || clients.myalgo || clients.defly
    if (!provider) return

    try {
      const accountInfo = await provider.getAccountInfo(activeAddress)
      console.log('Account Info:', accountInfo)
      // Convert FRY_ASSET_ID to number for comparison
      const fryAssetId = Number(FRY_ASSET_ID)
      console.log('FRY_ASSET_ID:', fryAssetId)
      const fryAsset = accountInfo.assets?.find((a: any) => a['asset-id'] === fryAssetId)
      console.log('FRY Asset:', fryAsset)
      const balance = fryAsset ? fryAsset.amount / 1_000_000 : 0
      setFryBalance(balance)
    } catch (error) {
      console.error('Error fetching FRY balance:', error)
      setFryBalance(0)
    }
  }

  useEffect(() => {
    fetchUserData()
    fetchFryBalance()
  }, [activeAddress])
  console.log('userData', userData)
    if (isLoading) {
    return (
       <div className="w-full mt-[32px] mb-[47px] flex justify-center items-center min-h-[400px]">
        <svg className="animate-spin h-12 w-12 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    )
  }
  return (
    <>
      <div className="w-full mt-[32px] mb-[47px]">
        <div className="max-xxxl:w-[95%] w-[80%] m-auto flex flex-col items-center">
          <img src={userData?.banner || '../../assets/images/home/coverDP.png'} alt="Banner" className="w-full h-[500px] object-cover sm-s:h-[170px]" />
          <img src={userData?.profilePicture || '../../assets/images/home/mainDP.png'} alt="Profile" className="w-[142px] h-[142px] mt-[-70px]" />
          <div className="flex items-center justify-center mt-5 gap-[13px]">
            <h3 className="font-apex text-black leading-[1.6px] ">{userData?.name}</h3>
            <Icon
              icon="material-symbols:edit-sharp"
              width={28}
              height={28}
              color="#2B2B2B"
              className="cursor-pointer"
              onClick={() => setiseditProfileOpen(true)}
            />
          </div>

          <div className="mt-[17px] flex flex-col items-center gap-[10px]">
            <div className="flex gap-[10px] items-center bg-white border border-[#E7E7E7] rounded-[15px] py-[12px] px-[20px]">
              <img src="../../assets/images/logo-red.svg" alt="FRY" />
              <p className="large text-black">{fryBalance.toFixed(2)} FRY</p>
            </div>

            {activeAddress && (
              <div className="bg-[#f7f7f7] text-xs text-[#666] px-4 py-2 rounded-[10px] break-all text-center">
                Wallet: {activeAddress}
              </div>
            )}
          </div>
        </div>
      </div>

      <EditProfileModal
        iseditProfileOpen={iseditProfileOpen}
        setiseditProfileOpen={setiseditProfileOpen}
        userData={userData}
        setUserData={setUserData}
        walletId={activeAddress}
      />
    </>
  )
}

export default Profilebanner
