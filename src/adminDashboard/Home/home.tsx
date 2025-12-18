import { Icon } from '@iconify/react'
import { FC } from 'react'
import Users from '../Users/users'
import FarmingList from './farmingList'
import StakingList from './stakingList'

const Home: FC = () => {
  return (
    <>
      <div className="dashboard-main flex flex-col gap-[20px]">
        {/* Top activity div */}
        <div className="activity-div flex gap-[30px] max-sm:flex-col">
          <div className="flex flex-col gap-[35px] max-sm:max-w-full max-w-[300px] w-full px-[16px] py-[20px] bg-white rounded-[14px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
            <div className="flex justify-between gap-[10px]">
              <div className="flex flex-col gap-[20px]">
                <p className="medium text-primary">Total User</p>
                <h4 className="small text-primary font-bold">40,689</h4>
              </div>
              <img src="../../assets/images/dashboard/user.svg" alt="Total Users Icon" className="w-[60px] h-[60px]" />
            </div>
            <div className="flex items-center justify-center gap-[8px]">
              <Icon icon="mynaui:trending-up-solid" width={24} height={24} color="#00B69B" />
              <p className="medium text-primary">
                <span className="text-neon">8.5%</span> Up from yesterday
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-[35px] max-sm:max-w-full max-w-[300px] w-full px-[16px] py-[20px] bg-white rounded-[14px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
            <div className="flex justify-between gap-[10px]">
              <div className="flex flex-col gap-[20px]">
                <p className="medium text-primary">Active Staking</p>
                <h4 className="small text-primary font-bold">10,293</h4>
              </div>
              <img src="../../assets/images/dashboard/stake.svg" alt="Total Users Icon" className="w-[60px] h-[60px]" />
            </div>
            <div className="flex items-center justify-center gap-[8px]">
              <Icon icon="mynaui:trending-up-solid" width={24} height={24} color="#00B69B" />
              <p className="medium text-primary">
                <span className="text-neon">1.3%</span> Up from past week
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-[35px] max-sm:max-w-full max-w-[300px] w-full px-[16px] py-[20px] bg-white rounded-[14px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
            <div className="flex justify-between gap-[10px]">
              <div className="flex flex-col gap-[20px]">
                <p className="medium text-primary">Active Farming</p>
                <h4 className="small text-primary font-bold">40,293</h4>
              </div>
              <img src="../../assets/images/dashboard/farm.png" alt="Total Users Icon" className="w-[60px] h-[60px]" />
            </div>
            <div className="flex items-center justify-center gap-[8px]">
              <Icon icon="mynaui:trending-down-solid" width={24} height={24} color="red" />
              <p className="medium text-primary">
                <span className="text-red">4.3%</span> Down from yesterday
              </p>
            </div>
          </div>
        </div>

        {/* User list */}
        <Users showSearchBar={false} showviewALL={true} dataLimit={3} showPagination={false} />

        {/* Staking list */}
        <StakingList />

        {/* Farming list */}
        <FarmingList />
      </div>
    </>
  )
}

export default Home
