import React, { useState } from 'react'
import AddFarmModal from '../../../../Modals/website/addFarmModal'
import Button from '../../../shared/button'
import P_FTable from './P_fTable'

const P_FarmTable: React.FC = () => {
  const [isaddFarmOpen, setisaddFarmOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'All' | 'Verified'>('All') // Filter: All or Verified
  const [filterActivity, setFilterActivity] = useState<'Live' | 'Ended'>('Live') // Filter: Live or Ended
  const [filterOwnership, setFilterOwnership] = useState<'All' | 'My Pools'>('All') // Filter: All or My Pools

  const onCraetefarmClick = () => {
    setisaddFarmOpen(true)
  }
  return (
    <>
      <div className="w-full m-auto flex flex-col gap-[16px]">
        {/* Top Section */}
        <div className="top flex max-sm:flex-col justify-between items-center gap-[10px]">
          {/* Left Section */}
          <div className="flex gap-[8px] sm-s:flex-col">
            {/* Status Filter */}
            <div className="switcher flex justify-center items-center gap-[3px] w-fit p-[3px] bg-white rounded-[12px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
              <p
                className={`${
                  filterStatus === 'All' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]`}
                onClick={() => setFilterStatus('All')}
              >
                All
              </p>
              <p
                className={`${
                  filterStatus === 'Verified' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px]`}
                onClick={() => setFilterStatus('Verified')}
              >
                Verified
              </p>
            </div>

            {/* Activity Filter */}
            <div className="switcher flex justify-center items-center gap-[3px] w-fit p-[3px] bg-white rounded-[12px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
              <p
                className={`${
                  filterActivity === 'Live' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]`}
                onClick={() => setFilterActivity('Live')}
              >
                Live
              </p>
              <p
                className={`${
                  filterActivity === 'Ended' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px]`}
                onClick={() => setFilterActivity('Ended')}
              >
                Ended
              </p>
            </div>

            {/* Ownership Filter */}
            <div className="switcher flex justify-center items-center gap-[3px] w-fit p-[3px] bg-white rounded-[12px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
              <p
                className={`${
                  filterOwnership === 'All' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px] shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]`}
                onClick={() => setFilterOwnership('All')}
              >
                All
              </p>
              <p
                className={`${
                  filterOwnership === 'My Pools' ? 'text-white linearGradient' : 'text-black'
                } flex items-center justify-center text-center cursor-pointer tracking-[0.09px] rounded-[10px] w-[92px] sm-s:w-[125px] h-[38px]`}
                onClick={() => setFilterOwnership('My Pools')}
              >
                My Pools
              </p>
            </div>
          </div>
          {/* Right Section */}
          <div className="flex gap-[14px] items-center justify-end w-full max-sm:justify-center">
            <Button
              text="Create Farm"
              img="ic:sharp-add"
              className="button btn-red-border max-sm:!w-[250px]"
              height={45}
              width={140}
              clr="text-red"
              onClick={onCraetefarmClick}
            />
          </div>
        </div>

        {/* Bottom Section - Table */}
        <div className="bottom ">
          <P_FTable filterStatus={filterStatus} filterActivity={filterActivity} filterOwnership={filterOwnership} />
        </div>
      </div>

      {/* <AddFarmModal isaddFarmOpen={isaddFarmOpen} setisaddFarmOpen={setisaddFarmOpen} /> */}
    </>
  )
}

export default P_FarmTable
