import { useState } from 'react'
import P_FarmTable from './farm/P_farmTable'
import P_Farmbanner from './farm/Pfarmbanner'
import PStakebanner from './stake/Pstakebanner'
import PstakeTable from './stake/PstakeTable'

const ProfileSwitcher = () => {
  const [activeTab, setActiveTab] = useState<'stake' | 'farm'>('stake') // Manage active tab state

  return (
    <>
      <div className="w-full mb-[100px]">
        <div className="max-xxxl:max-w-[95%] w-full max-w-[80%] m-auto flex flex-col items-center gap-[41px] max-md:gap-[20px]">
          {/* Switcher tab */}
          <div className="switcher flex justify-center items-center gap-[3px] w-fit p-[3px] bg-white rounded-[12px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
            {/* Stake Tab */}
            <p
              onClick={() => setActiveTab('stake')}
              className={`${
                activeTab === 'stake' ? 'text-white linearGradient shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]' : 'text-black'
              } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[117px] h-[48px]`}
            >
              Stake
            </p>
            {/* Farm Tab */}
            <p
              onClick={() => setActiveTab('farm')}
              className={`${
                activeTab === 'farm' ? 'text-white linearGradient shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]' : 'text-black'
              } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[117px] h-[48px]`}
            >
              Farm
            </p>
          </div>
          {/* Rendered Component div */}
          <div className="flex flex-col gap-[56px] w-full max-md:gap-[20px]">
            {activeTab === 'stake' && (
              <>
                <PStakebanner />
                <PstakeTable />
              </>
            )}
            {activeTab === 'farm' && (
              <>
                <P_Farmbanner />
                <P_FarmTable />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default ProfileSwitcher
