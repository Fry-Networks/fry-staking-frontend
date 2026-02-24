import { toast } from 'react-toastify'
import React, { useState } from 'react'
import { Icon } from '@iconify/react'
import { useWallet } from '@txnlab/use-wallet'
import type { TableColumnsType } from 'antd'
import { Table } from 'antd'
import { useNavigate } from 'react-router-dom'
import Button from '../../shared/button'
import Input from '../../shared/input'
import { stakeTokens, claimRewards, unstakeTokens } from '../../../farming_func'
import axios from 'axios'
import algosdk from 'algosdk'
import { TokenService } from '../../../services/TokenService'

interface DataType {
  key: React.Key
  pool: React.ReactNode
  tvl: string
  apr: string
  staked: string
  reward: React.ReactNode
  ends: string
  _id: string
  appId: number
  farmEndTime: string
}

export type TabOption = 'MyLive' | 'MyEnded' | 'Live' | 'Ended' | 'All'

interface FTableProps {
  farms: DataType[]
  fetchData: () => Promise<void>
  showExpandable: TabOption
}

// const FRY_ASSET_ID = 2485314946;
const FRY_ASSET_ID = import.meta.env.VITE_FRY_TOKEN_ID ? Number(import.meta.env.VITE_FRY_TOKEN_ID) : 2485314946;

const FTable: React.FC<FTableProps> = ({ farms, fetchData, showExpandable }) => {
  // Initialize TokenService
  const tokenService = new TokenService();
  
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [stakeInput, setStakeInput] = useState<{ [key: string]: string }>({})
  const [withdrawInput, setWithdrawInput] = useState<{ [key: string]: string }>({})
  const [stakeLoadingKeys, setStakeLoadingKeys] = useState<React.Key[]>([])
  const [withdrawLoadingKeys, setWithdrawLoadingKeys] = useState<React.Key[]>([])
  const [userStakes, setUserStakes] = useState<{ [key: string]: number }>({})
  const [poolData, setPoolData] = useState<{ [key: string]: number }>({})
  const [claimButtonDisabled, setClaimButtonDisabled] = useState<{ [key: string]: boolean }>({})
  const [claimingKeys, setClaimingKeys] = useState<React.Key[]>([])
  const [isOptedIn, setIsOptedIn] = useState<boolean | null>(null)

  const { providers, clients, activeAccount, activeAddress, signer } = useWallet()

  const navigate = useNavigate()

  React.useEffect(() => {
    async function checkOptIn() {
      if (!activeAddress) return
      try {
        const indexer = new algosdk.Indexer('', import.meta.env.VITE_INDEXER_SERVER || 'https://mainnet-idx.algonode.cloud', '')
        const accountInfo = await indexer.lookupAccountByID(activeAddress).do()
        const assets = accountInfo.account.assets || []
        setIsOptedIn(assets.some((asset: any) => asset['asset-id'] === FRY_ASSET_ID))
      } catch (e) {
        setIsOptedIn(null)
      }
    }
    checkOptIn()
  }, [activeAddress])

  const handleOptIn = async () => {
    if (!activeAddress || !signer) return
    try {
      const algod = new algosdk.Algodv2('', import.meta.env.VITE_ALGOD_SERVER || 'https://mainnet-api.algonode.cloud', '')
      const params = await algod.getTransactionParams().do()
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        to: activeAddress,
        assetIndex: FRY_ASSET_ID,
        amount: 0,
        suggestedParams: params,
      })

      const signedTxns: any = await signer([txn], [0])
      const { txId } = await algod.sendRawTransaction(signedTxns).do()
      await algosdk.waitForConfirmation(algod, txId, 4)
      toast.success('Opt-in to FRY successful!')
      setIsOptedIn(true)
    } catch (err) {
      console.error('Opt-in failed:', err)
      toast.error('Opt-in to FRY failed.')
    }
  }

  const handleToggleExpand = async (key: React.Key, appId?: number) => {
    if (expandedKeys.includes(key)) {
      setExpandedKeys((prev) => prev.filter((rowKey) => rowKey !== key))
    } else {
      setExpandedKeys([key])

      if (appId) {
        try {
          // Fetch user's staking data for the expanded pool
          const userRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/stakingfarmingtoken/pool/${appId}/user/${activeAddress}`)
          const totalStaked = userRes.data?.totalStaked || 0

          // Update the user stakes state for the current pool
          setUserStakes((prev) => ({
            ...prev,
            [String(key)]: totalStaked,
          }))

          // Fetch pool data for total tokens in the pool and total withdrawn
          const poolRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/stakingfarmingtoken/pool/${appId}`)

          const updatedTotalTokens = poolRes.data?.totalBalance || 0

          setPoolData((prev) => ({
            ...prev,
            [String(key)]: updatedTotalTokens,
          }))

          // Get the farm end time from the pool data
          const currentTime = Date.now()
          const farmEndTime = poolRes.data?.ends
          const isFarmEnded = currentTime > farmEndTime

          // Update the state to disable or show the Claim button
          setClaimButtonDisabled((prev) => ({
            ...prev,
            [String(key)]: !isFarmEnded, // Disable button if farm has not ended
          }))
        } catch (err) {
          console.error('Error fetching data:', err)
          setUserStakes((prev) => ({ ...prev, [String(key)]: 0 }))
          setPoolData((prev) => ({ ...prev, [String(key)]: 0 }))
        }
      }
    }
  }

  const handleStake = async (record: DataType) => {
    const keyStr = String(record.key)
    const amountStr = stakeInput[keyStr] || '0'
    const floatAmount = parseFloat(amountStr)

    if (isNaN(floatAmount) || floatAmount <= 0) {
      toast.error('Invalid stake amount')
      return
    }

    const stakeAmount = BigInt(Math.floor(floatAmount * 1_000_000))

    try {
      setStakeLoadingKeys((prev) => [...prev, record.key])

      // Perform the on-chain staking
      const tx = await stakeTokens(record.appId, Number(stakeAmount), activeAddress!, signer)
      toast.success('Stake successful')

      // Prepare staking data for DB (based on updated schema)
      const stakingData = {
        tokens: floatAmount,
        wallet: activeAddress!,
        poolId: record.appId,
        stakedAmount: floatAmount,
        earnedReward: 0,
        lastStakedAt: Date.now(),
        claimedAt: null,
      }

      // Log staking data in DB after staking
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/stakingfarmingtoken/add`, stakingData)

      // Fetch the updated staking balance from the backend
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/stakingfarmingtoken/pool/${record.appId}/user/${activeAddress}`)
      const updatedStake = res.data?.totalStaked

      // Update the state with the new staking data
      setUserStakes((prev) => ({
        ...prev,
        [String(record.key)]: updatedStake ? updatedStake : 0,
      }))

      // Fetch updated pool data (TVL)
      const poolRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/stakingfarmingtoken/pool/${record.appId}`)
      const updatedTotalTokens = poolRes.data?.totalBalance || 0
      setPoolData((prev) => ({
        ...prev,
        [String(record.key)]: updatedTotalTokens,
      }))

      // Clear stake input and fetch data again
      setStakeInput((prev) => ({ ...prev, [keyStr]: '' }))
      await fetchData()
    } catch (err) {
      console.error('Staking failed:', err)
      toast.error('Staking failed. Please try again.')
    } finally {
      setStakeLoadingKeys((prev) => prev.filter((k) => k !== record.key))
    }
  }

  const handleWithdraw = async (record: DataType) => {
    const keyStr = String(record.key)
    const withdrawAmountStr = withdrawInput[keyStr] || '0'
    const floatAmount = parseFloat(withdrawAmountStr)
    const unstakeAmount = BigInt(Math.floor(floatAmount * 1_000_000))

    if (unstakeAmount <= 0) {
      toast.error('Withdraw amount must be greater than zero')
      return
    }

    try {
      setWithdrawLoadingKeys((prev) => [...prev, record.key])

      const value = withdrawInput[keyStr] as unknown as number
      const adjustedWithdrawValue = value * 1_000_000

      // Call the function to unstake (withdraw tokens)
      const withdrawToken = await unstakeTokens(record.appId, adjustedWithdrawValue, activeAddress!, signer)

      // Log the withdrawal data to DB after the withdrawal is successful
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/farmingwithdraw/add`, {
        amount: floatAmount,
        userWallet: activeAddress!,
        poolId: record.appId,
        farmingTokenId: record.appId,
      })

      toast.success('Withdraw successful')

      // Fetch the updated staking balance from the backend
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/stakingfarmingtoken/pool/${record.appId}/user/${activeAddress}`)
      const updatedStake = res.data?.totalStaked

      // Update the user stake balance for the pool
      setUserStakes((prev) => ({
        ...prev,
        [String(record.key)]: updatedStake ? updatedStake : 0,
      }))

      // Fetch updated pool data (TVL) after withdrawal
      const poolRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/stakingfarmingtoken/pool/${record.appId}`)
      const updatedTotalTokens = poolRes.data?.totalBalance || 0
      setPoolData((prev) => ({
        ...prev,
        [String(record.key)]: updatedTotalTokens,
      }))

      // Clear withdraw input and fetch data again
      setWithdrawInput((prev) => ({ ...prev, [keyStr]: '' }))
      await fetchData()
    } catch (err: any) {
      console.error('Withdrawal failed:', err)
      toast.error(`Withdrawal failed: ${err.message || 'Unknown error'}`)
    } finally {
      setWithdrawLoadingKeys((prev) => prev.filter((k) => k !== record.key))
    }
  }

  // const handleClaim = async (record: DataType) => {
  //   const keyStr = String(record.key);

  //   try {
  //     setClaimingKeys((prev) => [...prev, record.key]);  // Start claiming process

  //     // Call your claim function here
  //     await claimRewards(record.appId, activeAddress!, signer); // Assume claimRewards is defined

  //     toast.success('Claim successful');

  //     // Update state or refetch data if needed
  //     await fetchData();

  //   } catch (error: unknown) {
  //     if (error instanceof Error) {
  //       toast.error(`${error.message}`);
  //     } else {
  //       toast.error('Claim failed: Unknown error');
  //     }
  //   } finally {
  //     setClaimingKeys((prev) => prev.filter(k => k !== record.key));  // End claiming process
  //   }
  // };

  const handleClaim = async (record: DataType) => {
    const keyStr = String(record.key)

    try {
      setClaimingKeys((prev) => [...prev, record.key])

      // Step 1: Claim from contract
      const result:any = await claimRewards(record.appId, activeAddress!, signer)
      toast.success('Claim successful')

      // Step 2: Fetch user box to get stake + reward data
      const userBox = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/stakingfarmingtoken/pool/${record.appId}/user/${activeAddress}`)

      const { totalStaked, stakeTime } = userBox.data || {}

      // Step 3: Log claim to database
      const dbResult = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/claimfarmrewards/add`, {
        walletId: activeAddress,
        poolId: record.appId,
        stakedAmount: totalStaked || 0,
        stakeStartTime: stakeTime || Math.floor(Date.now() / 1000),
        claimTime: Math.floor(Date.now() / 1000),
        rewardClaimed: Number(result?.claimedAmount || 0), // If your claimRewards returns claimedAmount
      })

      console.log(dbResult)

      await fetchData()
    } catch (error: any) {
      console.error('Claim failed:', error)
      toast.error(error.message || 'Claim failed')
    } finally {
      setClaimingKeys((prev) => prev.filter((k) => k !== record.key))
    }
  }

  const columns: TableColumnsType<DataType> = [
    { title: <div className="w-[350px]">Pool</div>, dataIndex: 'pool', key: 'pool' },
    {
      title: (
        <div className="flex items-center gap-[2px]">
          TVL
          <Icon icon="solar:arrow-down-outline" width={18} height={21} color="black" />
        </div>
      ),
      dataIndex: 'tvl',
      key: 'tvl',
      render: (value) => <p className="text-text_clr font-medium medium">{value}</p>, // Display TVL value
    },
    { title: 'APR', dataIndex: 'apr', key: 'apr', render: (value) => <p className="text-text_clr font-medium medium">{value}</p> },
    { title: 'STAKED', dataIndex: 'staked', key: 'staked', render: (value) => <p className="text-text_clr font-medium medium">{value}</p> },
    {
      title: 'REWARD',
      dataIndex: 'reward',
      key: 'reward',
      render: (value) => value,
    },
    ...(showExpandable !== 'All'
      ? [
          {
            title: 'ENDS',
            dataIndex: 'ends',
            key: 'ends',
            render: (value: string, record: DataType) => (
              <div className="flex items-center justify-between gap-[20px]">
                {(showExpandable == 'Live' || showExpandable == 'MyLive') && (
                  <div className="max-w-[71px]">
                    <p className="text-text_clr medium leading-[27px]">Ends in {value}</p>
                  </div>
                )}
                <Icon
                  icon={expandedKeys.includes(record.key) ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                  width={36}
                  height={36}
                  color="#808080"
                  className="cursor-pointer"
                  onClick={() => handleToggleExpand(record.key, record.appId)}
                />
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
     {isOptedIn === false && (
  <Button
    text="Opt-in to FRY Token"
    onClick={handleOptIn}
    className="button btn-primary"
    height={45}
    width={200}

  />
)}
      <Table<DataType>
        className="web-table"
        columns={columns}
        pagination={false}
        expandable={
          showExpandable !== 'All'
            ? {
                expandedRowRender: (record: any) => {
                  // Check if the pool has ended
                  const currentTime = Date.now()
                  const farmEndTime = record.farmEndTime // Assuming the "ends" field holds the farm end time
                  const isFarmEnded = currentTime > farmEndTime

                  return (
                    <div className="expandable">
                      <div className="flex items-center gap-[10px] justify-between pr-[50px] max-xxxl:pr-[0px]">
                        {/* Left */}
                        <div className="flex flex-col gap-[4px]">
                          <Button
                            text="Farm"
                            className="button btn-red-border"
                            height={45}
                            width={156}
                            onClick={() => {
                              // Redirect to Pera Wallet (mobile/web compatible)
                              window.open('https://explorer.perawallet.app/application/' + record.appId, '_blank')
                            }}
                          />
                        </div>

                        {/* Right */}
                        <div className="flex gap-[24px] w-full justify-end">
                          {/* Show Stake and Withdraw buttons only if the farm is still live */}
                          {(showExpandable === 'Live' || showExpandable === 'MyLive') && (
                            // (currentTime < farmEndTime) &&
                            <>
                              {/* Stake */}
                              <div className="flex flex-col gap-[4px]">
                                <div className="bg-[#F5F5F5] rounded-[10px] flex gap-[13px] items-center">
                                  <Input
                                    type="number"
                                    name="stake"
                                    placeholder="0"
                                    value={stakeInput[record.key] || ''}
                                    onChange={(e) => setStakeInput((prev) => ({ ...prev, [record.key]: e.target.value }))}
                                    className="input-wrapper text-[16px] w-full max-w-[150px]"
                                  />
                                  <p className="text-text_clr medium">Max</p>
                                  <Button
                                    text={stakeLoadingKeys.includes(record.key) ? 'Staking...' : 'Stake'}
                                    className="button btn-gray"
                                    height={45}
                                    width={106}
                                    onClick={() => handleStake(record)}
                                    disabled={stakeLoadingKeys.includes(record.key)}
                                  />
                                </div>
                                <p className="text-text_clr e-small">Balance: {userStakes[String(record.key)]?.toFixed(2) || '0'} token</p>
                              </div>

                              {/* Withdraw */}
                              <div className="flex flex-col gap-[4px]">
                                <div className="bg-[#F5F5F5] rounded-[10px] flex gap-[13px] items-center">
                                  <Input
                                    type="number"
                                    name="withdraw"
                                    placeholder="0"
                                    value={withdrawInput[record.key] || ''}
                                    onChange={(e) => setWithdrawInput((prev) => ({ ...prev, [record.key]: e.target.value }))}
                                    className="input-wrapper text-[16px] w-full max-w-[150px]"
                                  />
                                  <p className="text-text_clr medium">Max</p>
                                  <Button
                                    text={withdrawLoadingKeys.includes(record.key) ? 'Withdrawing...' : 'Withdraw'}
                                    className="button btn-gray"
                                    height={45}
                                    width={106}
                                    onClick={() => handleWithdraw(record)}
                                    disabled={withdrawLoadingKeys.includes(record.key)}
                                  />
                                </div>
                                <p className="text-text_clr e-small">In Pool: {poolData[String(record.key)]?.toFixed(2) || '0'} token</p>
                              </div>
                            </>
                          )}
                          {/* <p>
                          Ends on:{' '}
                          {record.farmEndTime}
                          {record.farmEndTime
                            ? new Date(Number(record.farmEndTime) * 1000).toLocaleString()
                            : 'N/A'}
                          <br />
                          Now: {new Date(currentTime).toLocaleString()}
                        </p> */}
                          {/* Show Claim button if the farm has ended */}
                          {(showExpandable == 'Live' || showExpandable == 'MyLive') && (
                            // {/* // (currentTime > farmEndTime) && */}
                            <Button
                              text={claimingKeys.includes(record.key) ? 'Claiming...' : 'Claim'} // Show 'Claiming...' during process
                              className="button btn-primary"
                              height={45}
                              width={106}
                              onClick={() => handleClaim(record)} // Call the claim function on button click
                              // disabled={claimButtonDisabled[String(record.key)]} // Disable if farm is not ended
                            />
                          )}

                          <Button
                            text="View details"
                            className="button btn-red-border"
                            height={45}
                            width={128}
                            onClick={() => navigate(`/farm-pool-stats?appId=${record.appId}`)}
                          />
                        </div>
                      </div>
                    </div>
                  )
                },
                rowExpandable: () => true,
                expandedRowKeys: expandedKeys,
              }
            : undefined
        }
        expandIconColumnIndex={-1}
        dataSource={farms}
        scroll={{ x: '1000px' }}
      />
    </div>
  )
}

export default FTable
