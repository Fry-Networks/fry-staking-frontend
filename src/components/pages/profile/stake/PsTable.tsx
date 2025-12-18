import { Icon } from '@iconify/react' // Import Iconify
import type { TableColumnsType } from 'antd'
import { Table } from 'antd'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Editstake from '../../../../Modals/website/editStakeModal'
import Button from '../../../shared/button'
import Input from '../../../shared/input'

interface DataType {
  key: React.Key
  pool: React.ReactNode
  tvl: string
  apr: string
  staked: string
  reward: React.ReactNode
  ends: React.ReactNode
}
interface P_STable {
  activeTab: 'Live' | 'Ended'
  activePool: 'All' | 'My Pools'
  data: any[]
  loading: boolean
}
// Define the columns for the table
const P_STable: React.FC<P_STable> = ({ activeTab, activePool }) => {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [iseditStakeOpen, setiseditStakeOpen] = useState(false)
  const navigate = useNavigate()
  const oneditClick = () => {
    setiseditStakeOpen(true)
  }
  const handleToggleExpand = (key: React.Key) => {
    setExpandedKeys(
      (prev) => (prev.includes(key) ? prev.filter((rowKey) => rowKey !== key) : [key]), // Allow only one row to expand at a time
    )
  }

  const columns: TableColumnsType<DataType> = [
    { title: <div className=" w-[350px]">Pool </div>, dataIndex: 'pool', key: 'pool' },

    {
      title: (
        <div className="flex items-center gap-[2px]">
          TVL
          <Icon icon="solar:arrow-down-outline" width={18} height={21} color="black" />
        </div>
      ),
      dataIndex: 'tvl',
      key: 'tvl',
      render: (value) => <p className="text-text_clr font-medium medium">{value}</p>,
    },
    { title: 'APR', dataIndex: 'apr', key: 'apr', render: (value) => <p className="text-text_clr font-medium medium">{value}</p> },
    { title: 'STAKED', dataIndex: 'staked', key: 'staked', render: (value) => <p className="text-text_clr font-medium medium">{value}</p> },
    {
      title: 'REWARD',
      dataIndex: 'reward',
      key: 'reward',
      render: (value) => value,
    },
    {
      title: 'ENDS',
      dataIndex: 'ends',
      key: 'ends',
      render: (_, record) => (
        <div className="flex items-center justify-between gap-[20px]">
          <div className="max-w-[71px]">
            <p className="text-text_clr medium leading-[27px] ">ends in 6 days</p>
          </div>
          <Icon
            icon={expandedKeys.includes(record.key) ? 'mdi:chevron-up' : 'mdi:chevron-down'}
            width={36}
            height={36}
            color="#808080"
            className="cursor-pointer"
            onClick={() => handleToggleExpand(record.key)}
          />
        </div>
      ),
    },
  ]

  // Define the data for the table
  const data: DataType[] = [
    {
      key: 1,
      pool: (
        <div className="flex items-center gap-[16px] w-[350px]">
          <div className="flex mr-[-20px]">
            <img src="../../assets/icons/Bitcoin.png" alt="BTC" className="w-[40px] h-[40px] drop-shadow-md" />
            <img
              src="../../assets/icons/eth-black.png"
              alt="BTC"
              className="w-[40px] h-[40px] drop-shadow-md relative right-[20px] z-[1]"
            />
          </div>
          <div className="flex flex-col">
            <h6 className="text-black font-bold tracking-[0.1px]">Stake BTC</h6>
            <p className="text-green font-medium small">Earn BTC</p>
            <p className="text-text_clr small">with 50 days lock</p>
          </div>
        </div>
      ),
      tvl: '$154.00',
      apr: '0.019%',
      staked: '$0',
      reward: (
        <div className="flex items-center justify-between">
          <p className="text-text_clr font-medium medium flex flex-col leading-[27px]">
            4,901 <span className="font-normal">0 BTC</span>
          </p>
        </div>
      ),
      ends: null,
    },
    {
      key: 2,
      pool: (
        <div className="flex items-center gap-[16px] w-[350px]">
          <div className="flex mr-[-20px]">
            <img src="../../assets/icons/Bitcoin.png" alt="BTC" className="w-[40px] h-[40px] drop-shadow-md" />
            <img
              src="../../assets/icons/eth-black.png"
              alt="BTC"
              className="w-[40px] h-[40px] drop-shadow-md relative right-[20px] z-[1]"
            />
          </div>
          <div className="flex flex-col">
            <h6 className="text-black font-bold tracking-[0.1px]">Stake BTC</h6>
            <p className="text-green font-medium small">Earn BTC</p>
            <p className="text-text_clr small">with 50 days lock</p>
          </div>
        </div>
      ),
      tvl: '$154.00',
      apr: '0.019%',
      staked: '$0',
      reward: (
        <div className="flex items-center justify-between">
          <p className="text-text_clr font-medium medium flex flex-col leading-[27px]">
            4,901 <span className="font-normal">0 BTC</span>
          </p>
        </div>
      ),
      ends: null,
    },
    {
      key: 3,
      pool: (
        <div className="flex items-center gap-[16px] w-[350px]">
          <div className="flex mr-[-20px]">
            <img src="../../assets/icons/Bitcoin.png" alt="BTC" className="w-[40px] h-[40px] drop-shadow-md" />
            <img
              src="../../assets/icons/eth-black.png"
              alt="BTC"
              className="w-[40px] h-[40px] drop-shadow-md relative right-[20px] z-[1]"
            />
          </div>
          <div className="flex flex-col">
            <h6 className="text-black font-bold tracking-[0.1px]">Stake BTC</h6>
            <p className="text-green font-medium small">Earn BTC</p>
            <p className="text-text_clr small">with 50 days lock</p>
          </div>
        </div>
      ),
      tvl: '$154.00',
      apr: '0.019%',
      staked: '$0',
      reward: (
        <div className="flex items-center justify-between">
          <p className="text-text_clr font-medium medium flex flex-col leading-[27px]">
            4,901 <span className="font-normal">0 BTC</span>
          </p>
        </div>
      ),
      ends: null,
    },
    {
      key: 4,
      pool: (
        <div className="flex items-center gap-[16px] w-[350px]">
          <div className="flex mr-[-20px]">
            <img src="../../assets/icons/Bitcoin.png" alt="BTC" className="w-[40px] h-[40px] drop-shadow-md" />
            <img
              src="../../assets/icons/eth-black.png"
              alt="BTC"
              className="w-[40px] h-[40px] drop-shadow-md relative right-[20px] z-[1]"
            />
          </div>
          <div className="flex flex-col">
            <h6 className="text-black font-bold tracking-[0.1px]">Stake BTC</h6>
            <p className="text-green font-medium small">Earn BTC</p>
            <p className="text-text_clr small">with 50 days lock</p>
          </div>
        </div>
      ),
      tvl: '$154.00',
      apr: '0.019%',
      staked: '$0',
      reward: (
        <div className="flex items-center justify-between">
          <p className="text-text_clr font-medium medium flex flex-col leading-[27px]">
            4,901 <span className="font-normal">0 BTC</span>
          </p>
        </div>
      ),
      ends: null,
    },
    {
      key: 5,
      pool: (
        <div className="flex items-center gap-[16px] w-[350px]">
          <div className="flex mr-[-20px]">
            <img src="../../assets/icons/Bitcoin.png" alt="BTC" className="w-[40px] h-[40px] drop-shadow-md" />
            <img
              src="../../assets/icons/eth-black.png"
              alt="BTC"
              className="w-[40px] h-[40px] drop-shadow-md relative right-[20px] z-[1]"
            />
          </div>
          <div className="flex flex-col">
            <h6 className="text-black font-bold tracking-[0.1px]">Stake BTC</h6>
            <p className="text-green font-medium small">Earn BTC</p>
            <p className="text-text_clr small">with 50 days lock</p>
          </div>
        </div>
      ),
      tvl: '$154.00',
      apr: '0.019%',
      staked: '$0',
      reward: (
        <div className="flex items-center justify-between">
          <p className="text-text_clr font-medium medium flex flex-col leading-[27px]">
            4,901 <span className="font-normal">0 BTC</span>
          </p>
        </div>
      ),
      ends: null,
    },
  ]

  // Filter data based on activeTab and activePool
  let filteredData = data
  if (activeTab === 'Ended') {
    filteredData = filteredData.slice(0, 3) // Show only 3 items for 'Ended'
  }
  if (activePool === 'My Pools') {
    filteredData = filteredData.filter((_, index) => index % 2 === 0) // Example: Filter for 'My Pools'
  }

  return (
    <>
      <Table<DataType>
        className="web-table"
        columns={columns}
        pagination={false}
        expandable={{
          expandedRowRender: (record) => (
            <div className="expandable">
              <div className="flex items-center gap-[10px] justify-between pr-[50px] max-xxxl:pr-[0px]">
                {/* Left */}
                <div className="flex flex-col gap-[4px]">
                  <Button text="Get BTC" className="button btn-red-border" height={45} width={106} />
                  <p className="text-link underline small cursor-pointer">Contract</p>
                </div>
                {/* Right */}
                <div className="flex gap-[24px] w-full justify-end">
                  <div className="flex flex-col gap-[4px]">
                    <div className="bg-[#F5F5F5] rounded-[10px] flex gap-[13px] items-center">
                      <Input type="number" name="number" placeholder="0" className="input-wrapper text-[16px] w-full max-w-[150px]" />
                      <p className="text-text_clr medium">Max</p>
                      <Button text="Stake" className="button btn-gray" height={45} width={106} />
                    </div>
                    <p className="text-text_clr e-small">Balance: 0 BTC</p>
                  </div>
                  <div className="flex flex-col gap-[4px]">
                    <div className="bg-[#F5F5F5] rounded-[10px] flex gap-[13px] items-center">
                      <Input type="number" name="number" placeholder="0" className="input-wrapper text-[16px] w-full max-w-[150px]" />
                      <p className="text-text_clr medium">Max</p>
                      <Button text="Withdraw" className="button btn-gray" height={45} width={106} />
                    </div>
                    <p className="text-text_clr e-small">In Pool: 0 BTC</p>
                  </div>
                  <div className="flex gap-[10px]">
                    <Button text="Claim" className="button btn-primary" height={45} width={106} />
                    <Button text="Compound" className="button btn-red-border" height={45} width={106} />
                    <Button text="Edit" className="button btn-red-border" height={45} width={106} onClick={oneditClick} />
                    <Button
                      text="View details"
                      className="button btn-red-border"
                      height={45}
                      width={128}
                      onClick={() => {
                        navigate('/stake-pool-stats')
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ),
          rowExpandable: () => true,
          expandedRowKeys: expandedKeys,
        }}
        expandIconColumnIndex={-1}
        dataSource={filteredData}
        scroll={{ x: '1170px' }}
      />

      <Editstake iseditStakeOpen={iseditStakeOpen} setiseditStakeOpen={setiseditStakeOpen} />
    </>
  )
}

export default P_STable
