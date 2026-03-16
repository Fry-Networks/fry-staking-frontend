import { Icon } from '@iconify/react' // Import Iconify
import { useWallet } from '@txnlab/use-wallet'
import type { TableColumnsType } from 'antd'
import { Table } from 'antd'
import axios from 'axios'
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { usePoolData } from '../../../context/PoolDataContext'
import { claimTokens, getStakingData, getUserData, stakeTokens, unstakeTokens, getAlgodClient, estimateStakingReward } from '../../../staking_func'
import { getAlgodConfigFromViteEnvironment } from '../../../utils/network/getAlgoClientConfigs'
import Button from '../../shared/button'
import Input from '../../shared/input'
import { tokenServiceInstance as tokenService } from '../../../services/TokenService'
import { authAxios } from '../../../services/apiClient'
import { useAuth } from '../../../hooks/useAuth'
import { fetchFeeConfig, calculateFeeSimple } from '../../../services/FeeService'
import type { FeeCalculation } from '../../../services/FeeService'
import FeeConfirmation from '../../shared/FeeConfirmation'
import StakeModal from '../../shared/StakeModal'
import WithdrawModal from '../../shared/WithdrawModal'

interface DataType {
  [x: string]: any
  key: React.Key
  pool: string
  tvl: string
  apr: string
  staked: string
  reward: string
  ends: string
  stakingContractId: number
  stakeTokenName?: string
  _id: string
}

interface StakingRecord {
  apr: number
  lockPeriod: number
  poolStartTime: number
  poolEndTime: number
  rewardToken?: number
  stakeToken?: number
  poolTime?: number
  totalStaked?: number
}

interface STableProps {
  stacks: DataType[]
  fetchData: () => Promise<void>
  showExpandable: string
  allPools?: DataType[]
}

const FRY_ASSET_ID = Number(import.meta.env.VITE_FRY_TOKEN_ID) || 2485314946;

// Define the columns for the table
// const STable: React.FC<STableProps> = memo(({ stacks, fetchData }) => {
const STable: React.FC<STableProps> = memo(({ stacks, fetchData, showExpandable, allPools }) => {
  const { ensureAuth } = useAuth();

  const api_base_url = import.meta.env.VITE_API_BASE_URL;
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  // stack btc input value
  const [stackValue, setStackValue] = useState<number>()
  const [withdrawValue, setWithdrawValue] = useState<number>()
  const [fryBalance, setFryBalance] = useState<number>(0) // 🔹 Store FRY balance
  const [tokenBalances, setTokenBalances] = useState<{ [key: string]: number }>({})
  const [isStaking, setIsStaking] = useState(false);
  const isStakingRef = useRef(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [isClaimingId, setIsClaimingId] = useState<string | null>(null); // Holds the _id of the pool being claimed
  const [estimatedRewards, setEstimatedRewards] = useState<Record<string, number>>({})
  const [rewardLoading, setRewardLoading] = useState<Record<string, boolean>>({})
  const [userStakes, setUserStakes] = useState<Record<string, number>>({})
  const [userStakeTimes, setUserStakeTimes] = useState<Record<string, number>>({})
  const [isMigrating, setIsMigrating] = useState<string | null>(null)

  // Fee confirmation state
  const [feeModalVisible, setFeeModalVisible] = useState(false)
  const [feeCalc, setFeeCalc] = useState<FeeCalculation | null>(null)
  const [feeLoading, setFeeLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ type: string; args: any } | null>(null)
  const [feeActionLabel, setFeeActionLabel] = useState('')
  const [feeAmountFormatted, setFeeAmountFormatted] = useState('')
  const [netAmountFormatted, setNetAmountFormatted] = useState('')

  // Modal state
  const [stakeModalOpen, setStakeModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [modalTarget, setModalTarget] = useState<{ appId: number; stakeTokenId: number; stakeTokenName: string; userStake: number } | null>(null)

  const navigate = useNavigate()

  const algoConfig = getAlgodConfigFromViteEnvironment()
  const networkName = useMemo(() => {
    return algoConfig.network === '' ? 'localnet' : algoConfig.network.toLocaleLowerCase()
  }, [algoConfig.network])
  const { setPoolData } = usePoolData() // Get the function to set poolData from context

  const { providers, clients, activeAccount, activeAddress, signer } = useWallet()
  const handleToggleExpand = (key: React.Key, stakeTokenId?: number) => {
    const isExpanding = !expandedKeys.includes(key)
    setExpandedKeys(
      (prev) => (prev.includes(key) ? prev.filter((rowKey) => rowKey !== key) : [key]), // Allow only one row to expand at a time
    )
    if (isExpanding) {
      if (stakeTokenId) fetchTokenBalance(key, stakeTokenId)
      // Fetch user's individual staked amount from smart contract
      if (activeAddress) {
        const pool = stacks.find(s => s.key === key)
        if (pool?.stakingContractId) {
          const k = String(key)
          getUserData(pool.stakingContractId, activeAddress)
            .then(data => {
              setUserStakes(prev => ({ ...prev, [k]: Number(data.stakedAmount || 0) / 1_000_000 }))
              setUserStakeTimes(prev => ({ ...prev, [k]: Number(data.stakeTime || 0) }))
            })
            .catch(() => setUserStakes(prev => ({ ...prev, [k]: 0 })))
          // Estimate reward for grey-out logic
          if (signer) {
            setRewardLoading(prev => ({ ...prev, [k]: true }))
            estimateStakingReward(pool.stakingContractId, activeAddress, signer)
              .then(est => setEstimatedRewards(prev => ({ ...prev, [k]: est.reward })))
              .catch(() => {}) // on error, leave undefined = button stays enabled
              .finally(() => setRewardLoading(prev => ({ ...prev, [k]: false })))
          }
        }
      }
    }
  }

  const [claimedPools, setClaimedPools] = useState<string[]>([])

  const fetchClaimedPools = async () => {
    if (!activeAddress) return

    try {
      const res = await axios.get(`${api_base_url}/stakerData/${activeAddress}`)
      if (res.status === 200) {
        console.log('staker data')
        console.log(res)
        const poolIds = res.data.data.map((item: any) => item.poolId)
        setClaimedPools(poolIds)
      }
    } catch (error) {
      console.error("Error fetching claimed pools:", error)
    }
  }

  const fetchBalance = async () => {
    if (!activeAddress || !clients) {
      setFryBalance(0)
      return
    }

    try {
      const provider = clients?.pera || clients?.myalgo || clients?.defly
      if (!provider) {
        return
      }

      const accountInfo = await provider.getAccountInfo(activeAddress)

      if (!accountInfo || !accountInfo.assets) {
        setFryBalance(0)
        return
      }

      const fryToken = accountInfo.assets.find((asset: any) => asset['asset-id'] === FRY_ASSET_ID || asset.id === FRY_ASSET_ID)

      if (!fryToken) {
        setFryBalance(0)
        return
      }

      const normalFryBalance = fryToken.amount / 1_000_000
      setFryBalance(normalFryBalance)
    } catch (error) {
      console.error('Error fetching balance:', error)
      setFryBalance(0)
    }
  }

  const fetchTokenBalance = async (key: React.Key, stakeTokenId: number) => {
    if (!activeAddress || !stakeTokenId) return
    try {
      const algod = await getAlgodClient()
      const assetInfo = await algod.accountAssetInformation(activeAddress, stakeTokenId).do()
      const balance = Number(assetInfo?.['asset-holding']?.amount ?? 0)
      setTokenBalances((prev) => ({ ...prev, [String(key)]: balance / 1_000_000 }))
    } catch {
      setTokenBalances((prev) => ({ ...prev, [String(key)]: 0 }))
    }
  }

  useEffect(() => {
    fetchBalance()
    fetchClaimedPools()
  }, [activeAddress]) // 🔹 Fetch balance whenever the wallet address changes

  useEffect(() => {
    // console.log(stacks, 'stacks')
  }, [stacks])
  const columns: TableColumnsType<DataType> = [
    { title: <div className=" w-[350px]">Pool </div>, dataIndex: 'pool', key: 'pool' },
    {
      title: 'TVL',
      dataIndex: 'tvl',
      key: 'tvl',
      sorter: (a, b) => (parseFloat(a.tvl.replace(/[$,\s]/g, '')) || 0) - (parseFloat(b.tvl.replace(/[$,\s]/g, '')) || 0),
      render: (value) => <p className="text-text_clr font-medium medium">{value}</p>,
    },
    { title: 'APR', dataIndex: 'apr', key: 'apr', sorter: (a, b) => (parseFloat(a.apr) || 0) - (parseFloat(b.apr) || 0), render: (value) => <p className="text-text_clr font-medium medium">{value}</p> },
    { title: 'STAKED', dataIndex: 'staked', key: 'staked', sorter: (a, b) => (a.totalAmountStaked || 0) - (b.totalAmountStaked || 0), render: (value) => <p className="text-text_clr font-medium medium">{value}</p> },
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
          sorter: (a: DataType, b: DataType) => (a.stakingEndTime || 0) - (b.stakingEndTime || 0),
          render: (value: string, record: DataType) => (
            <div className="flex items-center justify-between gap-[20px]">
              <div className="max-w-[71px]">
                <p className="text-text_clr medium leading-[27px]">{value}</p>
              </div>
              <Icon
                icon={expandedKeys.includes(record.key) ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                width={36}
                height={36}
                color="#808080"
                className="cursor-pointer"
                onClick={() => handleToggleExpand(record.key, record.stakeTokenId)}
              />
            </div>
          ),
        },
      ]
      : []),
  ]

  // Fee confirmation helpers

  const showFeeConfirmation = async (actionType: string, amountMicro: number, tokenAsaId: number, tokenDecimals: number, tokenName: string, label: string, action: { type: string; args: any }) => {
    try {
      setFeeLoading(true)
      const config = await fetchFeeConfig()
      const fee = calculateFeeSimple(actionType, amountMicro, config)

      setFeeCalc(fee)
      const divisor = Math.pow(10, tokenDecimals)
      setFeeAmountFormatted(`${(fee.feeAmount / divisor).toFixed(tokenDecimals > 2 ? 4 : 2)} ${tokenName}`)
      setNetAmountFormatted(`${(fee.netAmount / divisor).toFixed(tokenDecimals > 2 ? 4 : 2)} ${tokenName}`)
      setFeeActionLabel(label)
      setPendingAction({ ...action, args: { ...action.args, feeAmount: fee.feeAmount, feeTokenId: tokenAsaId, feeRecipient: fee.feeRecipient } })
      setFeeModalVisible(true)
    } catch (error: any) {
      toast.error(error?.message || 'Error calculating fee')
    } finally {
      setFeeLoading(false)
    }
  }

  const cancelFeeModal = () => {
    setFeeModalVisible(false)
    setPendingAction(null)
    setFeeCalc(null)
    setFeeAmountFormatted('')
    setNetAmountFormatted('')
    setIsStaking(false)
    setIsWithdrawing(false)
    isStakingRef.current = false
  }

  const executePendingAction = async () => {
    if (!pendingAction || !feeCalc) return
    setFeeModalVisible(false)
    const { type, args } = pendingAction

    if (type === 'stake') {
      setIsStaking(true)
      try {
        const StackToken = await stakeTokens(args.stakingContractId, args.adjustedStackValue, activeAddress!, signer, args.feeAmount, args.feeTokenId, args.feeRecipient);
        if (StackToken instanceof Error) {
          toast.error('Transaction canceled or staking failed.');
          return;
        }
        if (!activeAddress) {
          toast.error('No active address found for staking.');
          return;
        }

        // Backend updates — best-effort after successful on-chain stake
        try {
          const getStakingRecord = await getStakingData(args.stakingContractId, activeAddress, signer) as StakingRecord;
          const StakerData = await getUserData(args.stakingContractId, activeAddress);
          const stakingTokenPayload = {
            apr: getStakingRecord.apr,
            lockPeriod: getStakingRecord.lockPeriod,
            poolStartTime: getStakingRecord.poolStartTime,
            poolEndTime: getStakingRecord.poolEndTime,
            poolTime: getStakingRecord.poolTime || (getStakingRecord.poolEndTime - getStakingRecord.poolStartTime),
            rewardToken: Number(getStakingRecord.rewardToken || FRY_ASSET_ID),
            stakeTokens: Number(getStakingRecord.stakeToken || FRY_ASSET_ID),
            totalStaked: args.adjustedStackValue - (args.feeAmount || 0),
            poolId: args._id,
            appId: Number(args.stakingContractId),
            wallet: activeAddress
          };
          await authAxios.post('/stakingtoken/add', stakingTokenPayload);
          const { stakeTime } = StakerData;
          await authAxios.put(`/staking/update/${args._id}`, {
            aprRate: getStakingRecord.apr / 100,
            totalAmountStaked: Number(getStakingRecord.totalStaked ?? 0) / 1_000_000,
            totalStakers: 1,
            stakingTime: stakeTime,
          });
        } catch (backendErr) {
          console.warn('Backend update failed after successful stake:', backendErr);
        }

        // Always show success since on-chain stake succeeded
        await new Promise(r => setTimeout(r, 500));
        await fetchData();
        fetchBalance();
        const pool = stacks.find(s => s._id === args._id)
        if (pool?.stakeTokenId && pool?.key) fetchTokenBalance(pool.key, pool.stakeTokenId)
        toast.success('Staking successful!');
        setStackValue(0);
      } catch (error: any) {
        console.error('Error during staking operation:', error);
        const msg = error?.response?.data?.message || error?.message || 'Error during staking operation.';
        toast.error(msg);
      } finally {
        setIsStaking(false);
        isStakingRef.current = false;
      }
    } else if (type === 'withdraw') {
      await executeWithdraw(args)
    } else if (type === 'claim') {
      await executeClaim(args)
    } else if (type === 'claimAndWithdraw') {
      await executeClaimAndWithdraw(args)
    }

    setPendingAction(null)
    setFeeCalc(null)
  }

  // stacking function

  const handleStack = async (stakingContractId: number, _id: string) => {
    if (isStakingRef.current) return
    isStakingRef.current = true

    if (!stackValue) {
      toast.error('Please enter a valid amount');
      isStakingRef.current = false
      return;
    }

    try {
      await ensureAuth();
      const adjustedStackValue = stackValue * 1000000;
      const pool = stacks.find(s => s._id === _id);
      const stakeTokenId = pool?.stakeTokenId || FRY_ASSET_ID;
      const tokenName = pool?.stakeTokenName || 'tokens';
      await showFeeConfirmation('stakingDeposit', adjustedStackValue, stakeTokenId, 6, tokenName, `Stake ${stackValue} ${tokenName}`, {
        type: 'stake', args: { stakingContractId, _id, adjustedStackValue }
      })
    } catch (error: any) {
      toast.error(error?.message || 'Error preparing stake');
      isStakingRef.current = false
    } finally {
      setIsStaking(false); // ✅ Done loading
      isStakingRef.current = false
    }
  };

  const handleWithdraw = async (stakingContractId: number, _id: string) => {
    if (!withdrawValue || withdrawValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const poolData = stacks.find((item) => item._id === _id);
    if (!poolData) {
      toast.error('Pool data not found');
      return;
    }

    const userStakedAmount = userStakes[String(poolData.key)] || 0;

    if (withdrawValue > userStakedAmount) {
      toast.error(`Withdraw amount exceeds staked amount (${userStakedAmount} fry_token)`);
      return;
    }

    try {
      await ensureAuth();
      const adjustedWithdrawValue = withdrawValue * 1_000_000;
      const stakeTokenId = poolData.stakeTokenId || FRY_ASSET_ID;
      const tokenName = poolData.stakeTokenName || 'tokens';
      await showFeeConfirmation('stakingWithdraw', adjustedWithdrawValue, stakeTokenId, 6, tokenName, `Withdraw ${withdrawValue} ${tokenName}`, {
        type: 'withdraw', args: { stakingContractId, _id, adjustedWithdrawValue }
      })
    } catch (error: any) {
      toast.error(error?.message || 'Error preparing withdrawal');
      setIsWithdrawing(false);
    }
  };

  const executeWithdraw = async (args: any) => {
    setIsWithdrawing(true);
    try {
      const withdrawToken = await unstakeTokens(args.stakingContractId, args.adjustedWithdrawValue, activeAddress!, signer, args.feeAmount, args.feeTokenId, args.feeRecipient);

      if (withdrawToken instanceof Error) {
        toast.error(`Transaction failed: ${withdrawToken.message}`);
        return;
      }
      if (!withdrawToken) {
        toast.error('Withdrawal failed due to invalid response');
        return;
      }

      // Backend updates — best-effort after successful on-chain unstake
      try {
        const getStakingRecord = await getStakingData(args.stakingContractId, activeAddress!, signer) as StakingRecord;
        const StakerData = await getUserData(args.stakingContractId, activeAddress!);

        const { stakeTime } = StakerData;
        const calculateAPR = getStakingRecord.apr / 100;

        await authAxios.put(`/staking/update/${args._id}`, {
          aprRate: calculateAPR,
          totalAmountStaked: Number(getStakingRecord.totalStaked ?? 0) / 1_000_000,
          totalStakers: 1,
          stakingTime: stakeTime,
        });
        await authAxios.post('/withdraw/add', {
          tokens: Number(withdrawValue),
          wallet: activeAddress,
          poolId: args._id,
          appId: Number(args.stakingContractId),
        });
      } catch (backendErr) {
        console.warn('Backend update failed after successful withdraw:', backendErr);
      }

      // Always show success since on-chain unstake succeeded
      await new Promise(r => setTimeout(r, 500));
      await fetchData();
      fetchBalance();
      const pool = stacks.find(s => s._id === args._id)
      if (pool?.stakeTokenId && pool?.key) fetchTokenBalance(pool.key, pool.stakeTokenId)
      toast.success('Withdrawal successful');
      setWithdrawValue(0);
    } catch (error: any) {
      if (error?.message?.includes('Network mismatch')) {
        toast.error('Network mismatch: Please switch wallet to correct network.');
      } else {
        console.error('Error during withdrawal:', error);
        const msg = error?.response?.data?.message || error?.message || 'Error during withdrawal.';
        toast.error(msg);
      }
    } finally {
      setIsWithdrawing(false);
    }
  };



  // claim function

  const handleClaim = async (stakingContractId: number, _id: string) => {
    try {
      await ensureAuth();
      setIsClaimingId(_id);
      const poolData = stacks.find(s => s._id === _id);
      const rewardTokenId = poolData?.rewardTokenId || FRY_ASSET_ID;
      const rewardTokenName = poolData?.rewardTokenName || 'tokens';

      // Estimate reward for fee calculation
      const est = await estimateStakingReward(stakingContractId, activeAddress!, signer);
      const rewardMicro = est.reward > 0 ? est.reward : 1_000_000; // fallback to 1 token if 0

      await showFeeConfirmation('stakingClaim', rewardMicro, est.rewardTokenId || rewardTokenId, 6, rewardTokenName,
        `Claim rewards`, { type: 'claim', args: { stakingContractId, _id } })
    } catch (error: any) {
      console.error('Error during claim:', error);
      const msg = error?.response?.data?.message || error?.message || 'Error during claim.';
      toast.error(msg);
      setIsClaimingId(null);
    }
  };

  const executeClaim = async (args: any) => {
    try {
      const claimToken = await claimTokens(args.stakingContractId, activeAddress!, signer, args.feeAmount, args.feeTokenId, args.feeRecipient);
      console.log('claimToken:', claimToken);

      if (claimToken.error) {
        toast.error('Claim failed. Please try again.');
        return;
      }

      const { rewardClaimed, stakedAmount, updatedApr, tx, stakedTime } = claimToken;

      const stakerData = {
        walletId: activeAddress,
        stakedAmount,
        stakeTime: stakedTime,
        poolId: args._id,
        rewardClaimed,
      };

      const claimData = {
        walletId: activeAddress,
        stakedAmount,
        stakedTime,
        poolId: args._id,
        rewardClaimed,
      };

      const stakerRes = await authAxios.post('/stakerData/add', stakerData, {
        headers: { 'Content-Type': 'application/json' },
      });

      const claimResponse = await authAxios.post('/claimreward/add', claimData, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (claimResponse.status === 201) {
        toast.success('Rewards claimed successfully');
        setClaimedPools((prev) => [...prev, args._id]);
        await new Promise(r => setTimeout(r, 500));
        await fetchData();
        fetchBalance();
      } else {
        toast.error('Reward claim logged, but backend response was not OK.');
      }
    } catch (error: any) {
      console.error('Error during claim:', error);
      const msg = error?.response?.data?.message || error?.message || 'Error during claim.';
      toast.error(msg);
    } finally {
      setIsClaimingId(null);
    }
  };

  const handleClaimAndWithdraw = async (stakingContractId: number, _id: string) => {
    try {
      await ensureAuth();
      setIsClaimingId(_id);
      const poolData = stacks.find(s => s._id === _id);
      const rewardTokenId = poolData?.rewardTokenId || FRY_ASSET_ID;
      const rewardTokenName = poolData?.rewardTokenName || 'tokens';

      const est = await estimateStakingReward(stakingContractId, activeAddress!, signer);
      const rewardMicro = est.reward > 0 ? est.reward : 1_000_000;

      await showFeeConfirmation('stakingClaim', rewardMicro, est.rewardTokenId || rewardTokenId, 6, rewardTokenName,
        'Claim & Withdraw', { type: 'claimAndWithdraw', args: { stakingContractId, _id } });
    } catch (error: any) {
      console.error('Error during claim & withdraw:', error);
      toast.error(error?.message || 'Error during claim & withdraw');
      setIsClaimingId(null);
    }
  };

  const executeClaimAndWithdraw = async (args: any) => {
    try {
      // Step 1: Claim rewards
      const claimResult = await claimTokens(args.stakingContractId, activeAddress!, signer, args.feeAmount, args.feeTokenId, args.feeRecipient);

      if (claimResult.error) {
        toast.error('Claim failed. Withdrawal not attempted.');
        return;
      }

      const rewardClaimed = claimResult.rewardClaimed || 0;
      const stakedAmount = claimResult.stakedAmount || 0;
      const stakedTime = claimResult.stakedTime || 0;

      // Log claim to backend
      await authAxios.post('/stakerData/add', {
        walletId: activeAddress, stakedAmount, stakeTime: stakedTime,
        poolId: args._id, rewardClaimed,
      }, { headers: { 'Content-Type': 'application/json' } });

      await authAxios.post('/claimreward/add', {
        walletId: activeAddress, stakedAmount, stakedTime,
        poolId: args._id, rewardClaimed,
      }, { headers: { 'Content-Type': 'application/json' } });

      // Step 2: Withdraw full staked amount (if any)
      if (stakedAmount > 0) {
        const config = await fetchFeeConfig();
        const pool = stacks.find(s => s._id === args._id);
        const stakeTokenId = pool?.stakeTokenId || FRY_ASSET_ID;
        const withdrawFee = calculateFeeSimple('stakingWithdraw', stakedAmount, config);

        const withdrawResult = await unstakeTokens(
          args.stakingContractId, stakedAmount, activeAddress!, signer,
          withdrawFee.feeAmount, stakeTokenId, withdrawFee.feeRecipient
        );

        if (withdrawResult instanceof Error) {
          toast.warning('Rewards claimed but withdrawal failed: ' + withdrawResult.message);
        } else {
          await authAxios.post('/withdraw/add', {
            tokens: stakedAmount / 1_000_000, wallet: activeAddress,
            poolId: args._id, appId: Number(args.stakingContractId),
          });
          toast.success('Rewards claimed and tokens withdrawn!');
        }
      } else {
        toast.success('Rewards claimed (no tokens to withdraw).');
      }

      setClaimedPools(prev => [...prev, args._id]);
      await new Promise(r => setTimeout(r, 500));
      await fetchData();
      fetchBalance();
    } catch (error: any) {
      console.error('Error during claim & withdraw:', error);
      toast.error(error?.message || 'Error during claim & withdraw');
    } finally {
      setIsClaimingId(null);
    }
  };

  const handleMigrate = async (record: DataType) => {
    if (!activeAddress || !signer) {
      toast.error('Wallet not connected.')
      return
    }

    const k = String(record.key)
    const userStaked = userStakes[k]
    if (!userStaked || userStaked <= 0) {
      toast.error('No staked tokens to migrate.')
      return
    }

    // Find matching V2 pool (same stake + reward token pair) — search all pools, not just filtered tab
    const v2SearchPools = allPools || stacks
    const v2Pool = v2SearchPools.find(p =>
      p.contractVersion === 2 &&
      p.stakeTokenId === record.stakeTokenId &&
      p.rewardTokenId === record.rewardTokenId
    )
    if (!v2Pool) {
      toast.error('No matching V2 pool found yet.')
      return
    }

    try {
      await ensureAuth()
      setIsMigrating(record._id)

      const stakedMicro = Math.round(userStaked * 1_000_000)

      // Step 1: Unstake from V1 (with zero fee for migration)
      toast.info('Step 1/2: Unstaking from legacy pool...')
      const unstakeResult = await unstakeTokens(
        record.stakingContractId, stakedMicro, activeAddress, signer,
        0, record.stakeTokenId, ''
      )

      if (unstakeResult instanceof Error) {
        toast.error('Unstake failed: ' + unstakeResult.message)
        return
      }

      // Step 2: Stake into V2 (with zero fee for migration)
      toast.info('Step 2/2: Staking into V2 pool...')
      const stakeResult = await stakeTokens(
        v2Pool.stakingContractId, stakedMicro, activeAddress, signer,
        0, record.stakeTokenId, ''
      )

      if (stakeResult instanceof Error) {
        toast.warning('Unstake succeeded but V2 stake failed. Your tokens are in your wallet — please stake manually.')
        return
      }

      // Backend updates — best-effort after successful on-chain migration
      try {
        const getStakingRecord = await getStakingData(v2Pool.stakingContractId, activeAddress, signer) as StakingRecord
        const stakerData = await getUserData(v2Pool.stakingContractId, activeAddress)

        await authAxios.post('/stakingtoken/add', {
          apr: getStakingRecord.apr,
          lockPeriod: getStakingRecord.lockPeriod,
          poolStartTime: getStakingRecord.poolStartTime,
          poolEndTime: getStakingRecord.poolEndTime,
          poolTime: getStakingRecord.poolTime || (getStakingRecord.poolEndTime - getStakingRecord.poolStartTime),
          rewardToken: Number(getStakingRecord.rewardToken || FRY_ASSET_ID),
          stakeTokens: Number(getStakingRecord.stakeToken || FRY_ASSET_ID),
          totalStaked: stakedMicro,
          poolId: v2Pool._id,
          appId: Number(v2Pool.stakingContractId),
          wallet: activeAddress,
        })

        await authAxios.put(`/staking/update/${v2Pool._id}`, {
          aprRate: getStakingRecord.apr / 100,
          totalAmountStaked: Number(getStakingRecord.totalStaked ?? 0) / 1_000_000,
          totalStakers: 1,
          stakingTime: stakerData.stakeTime,
        })
      } catch (backendErr) {
        console.warn('Backend update failed after successful migration:', backendErr)
      }

      toast.success('Migration complete! Your tokens are now in the V2 pool.')
      await new Promise(r => setTimeout(r, 500))
      await fetchData()
    } catch (error: any) {
      console.error('Migration error:', error)
      const msg = error?.message || ''
      if (msg.includes('cancelled') || msg.includes('rejected') || msg.includes('User rejected') || msg.includes('4001')) {
        toast.error('Transaction cancelled by wallet.')
      } else if (msg.includes('4100') || msg.includes('pending')) {
        toast.error('You have a pending transaction in your wallet. Please approve or reject it first.')
      } else if (msg.includes('Network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error. Please check your connection and try again.')
      } else {
        toast.error('Migration failed: ' + (msg || 'Unknown error'))
      }
    } finally {
      setIsMigrating(null)
    }
  }

  // Function to handle the "View details" click
  // Function to handle the "View details" click
  const handleViewDetailsClick = (record: DataType) => {
    // Extract the plain data from React elements

    console.log('pooldate', record)

    // Set the pool data in context
    setPoolData(record)

    // Navigate to the pool stats page
    navigate('/stake-pool-stats')
  }

  return (
    <>
    <div className="w-full overflow-x-auto">
    <Table<DataType>
      className="web-table"
      columns={columns}
      pagination={false}
      expandable={
        showExpandable !== 'All'
          ? {
            // {
            expandedRowRender: (record) => (
              <div className="expandable">
                {(!record.contractVersion || record.contractVersion === 1) && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-3 mb-3 w-full">
                    <p className="text-red-400 font-medium text-sm">V1 Contract Bug Warning</p>
                    <p className="text-xs text-red-500/70">
                      Claiming rewards on this legacy pool will reset your stake timer and yield 0 rewards.
                      Use Withdraw only, or migrate to V2.
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-[10px] justify-between pr-[50px] max-xxxl:pr-[0px]">

                  {/* Left */}
                  <div className="flex flex-col gap-[4px]">
                    <Button
                      text={`Get ${record.stakeTokenName || 'Token'}`}
                      className="button btn-red-border"
                      height={45}
                      width={156}
                      onClick={() => window.open(
                        `https://app.tinyman.org/swap?asset_in=0&asset_out=${record.stakeTokenId}`,
                        '_blank'
                      )}
                    />
                    <a
                      href={`https://explorer.perawallet.app/application/${record.stakingContractId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline mt-1"
                    >
                      View Contract ↗
                    </a>
                    {(() => {
                      const k = String(record.key)
                      const stakeTime = userStakeTimes[k]
                      const lockSecs = record.lockPeriod || 0
                      if (stakeTime && lockSecs > 0) {
                        const unlockTime = stakeTime + lockSecs
                        const now = Math.floor(Date.now() / 1000)
                        if (now < unlockTime) {
                          const daysLeft = Math.ceil((unlockTime - now) / 86400)
                          return (
                            <p className="text-xs text-yellow-500 mt-1">
                              🔒 Unlocks in {daysLeft} {daysLeft === 1 ? 'day' : 'days'} ({new Date(unlockTime * 1000).toLocaleDateString()})
                            </p>
                          )
                        } else if (userStakes[k] > 0) {
                          return <p className="text-xs text-green mt-1">🔓 Unlocked — ready to withdraw</p>
                        }
                      }
                      return null
                    })()}
                    {/* Migrate button for V1 pools */}
                    {(!record.contractVersion || record.contractVersion === 1) && activeAddress && (() => {
                      const k = String(record.key)
                      const userStaked = userStakes[k] || 0
                      const stakeTime = userStakeTimes[k]
                      const lockSecs = record.lockPeriod || 0
                      const now = Math.floor(Date.now() / 1000)
                      const isLocked = stakeTime && lockSecs > 0 && (stakeTime + lockSecs) > now
                      const v2SearchPools = allPools || stacks
                      const hasV2 = v2SearchPools.some(p => p.contractVersion === 2 && p.stakeTokenId === record.stakeTokenId && p.rewardTokenId === record.rewardTokenId)

                      if (userStaked <= 0) return null

                      return (
                        <div className="mt-2">
                          {isLocked ? (
                            <>
                              <Button
                                text="Migrate to V2"
                                className="button btn-primary opacity-50"
                                height={36}
                                width={140}
                                disabled={true}
                              />
                              <p className="text-xs text-yellow-500 mt-1">
                                Unlocks {new Date((stakeTime + lockSecs) * 1000).toLocaleDateString()}
                              </p>
                            </>
                          ) : !hasV2 ? (
                            <p className="text-xs text-gray-500">V2 pool coming soon</p>
                          ) : (
                            <>
                              <Button
                                text={isMigrating === record._id ? 'Migrating...' : 'Migrate to V2'}
                                className="button btn-primary"
                                height={36}
                                width={140}
                                onClick={() => handleMigrate(record)}
                                disabled={!!isMigrating}
                              />
                              <p className="text-[10px] text-green-400 mt-1">Fee waived for migration!</p>
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  {/* Right */}
                  {/* stake */}{/* withdraw */}
                  <div className="flex gap-[24px] w-full justify-end">
                    {
                      (showExpandable === 'Live' || showExpandable === 'MyLive' || showExpandable === 'Ended' || showExpandable === 'MyEnded') &&
                      <div className="flex gap-[10px]">
                        {(!record.contractVersion || record.contractVersion === 1) ? (
                          <div className="flex flex-col items-center">
                            <Button
                              text="Stake"
                              className="button btn-primary opacity-50"
                              height={45}
                              width={106}
                              disabled={true}
                            />
                            <p className="text-[10px] text-yellow-500 mt-1">Deposits disabled — use V2</p>
                          </div>
                        ) : (
                          <Button
                            text="Stake"
                            className="button btn-primary"
                            height={45}
                            width={106}
                            onClick={() => {
                              setModalTarget({
                                appId: record.stakingContractId,
                                stakeTokenId: record.stakeTokenId || FRY_ASSET_ID,
                                stakeTokenName: record.stakeTokenName || 'tokens',
                                userStake: userStakes[String(record.key)] || 0,
                              })
                              setStakeModalOpen(true)
                            }}
                          />
                        )}
                        <Button
                          text="Withdraw"
                          className="button btn-primary"
                          height={45}
                          width={106}
                          onClick={() => {
                            setModalTarget({
                              appId: record.stakingContractId,
                              stakeTokenId: record.stakeTokenId || FRY_ASSET_ID,
                              stakeTokenName: record.stakeTokenName || 'tokens',
                              userStake: userStakes[String(record.key)] || 0,
                            })
                            setWithdrawModalOpen(true)
                          }}
                        />
                      </div>
                    }
                    {/* Claim & Withdraw */}

                    <div className="flex gap-[10px]">
                      {activeAddress && (
                        (!record.contractVersion || record.contractVersion === 1) ? (
                          <div className="flex flex-col items-center">
                            <Button
                              text="Claim"
                              className="button btn-primary opacity-50"
                              height={45}
                              width={106}
                              disabled={true}
                            />
                            <p className="text-[10px] text-red-500 mt-1">Claim disabled — use Withdraw</p>
                          </div>
                        ) : (
                          <Button
                            text={isClaimingId === record._id ? 'Claiming...' : 'Claim'}
                            className="button btn-primary"
                            height={45}
                            width={106}
                            onClick={() => handleClaim(record.stakingContractId, record._id)}
                            disabled={!!isClaimingId}
                          />
                        )
                      )}
                      {
                        (showExpandable === 'Ended' || showExpandable === 'MyEnded') &&
                        activeAddress && (
                          isClaimingId === record._id ? (
                            <p className="text-blue-500 font-medium mt-2">Processing...</p>
                          ) : claimedPools.includes(record._id) ? (
                            <p className="text-green font-semibold mt-2">✅ Rewards Claimed</p>
                          ) : (
                            (!record.contractVersion || record.contractVersion === 1) ? (
                              <div className="flex flex-col items-center">
                                <Button
                                  text="Claim & Withdraw"
                                  className="button btn-primary opacity-50"
                                  height={45}
                                  width={156}
                                  disabled={true}
                                />
                                <p className="text-[10px] text-red-500 mt-1">Claim disabled — use Withdraw</p>
                              </div>
                            ) : (
                              <Button
                                text={rewardLoading[String(record.key)] ? "Checking..." : "Claim & Withdraw"}
                                data-id="claim"
                                onClick={() => {
                                  setIsClaimingId(record._id)
                                  handleClaimAndWithdraw(record.stakingContractId, record._id).finally(() => setIsClaimingId(null))
                                }}
                                className="button btn-primary"
                                height={45}
                                width={156}
                                disabled={
                                  !!isClaimingId ||
                                  rewardLoading[String(record.key)] ||
                                  (estimatedRewards[String(record.key)] !== undefined && estimatedRewards[String(record.key)] <= 0)
                                }
                              />
                            )
                          )
                        )
                      }

                      {/* <Button text="Compound" className="button btn-red-border" height={45} width={106} /> */}
                      <Button
                        text="View details"
                        data-id="compound"
                        className="button btn-red-border"
                        height={45}
                        width={128}
                        onClick={() => navigate(`/stake-pool-stats?appId=${record.stakingContractId}`)}
                        // onClick={() => handleViewDetailsClick(record)} // Use the function here
                      />
                    </div>
                  </div>
                </div>
              </div>
            ),
            rowExpandable: () => true,
            expandedRowKeys: expandedKeys,
          }
          : undefined
      }
      expandIconColumnIndex={-1}
      dataSource={stacks}
      scroll={{ x: '1000px' }}
    />
    </div>
    <FeeConfirmation
      visible={feeModalVisible}
      onConfirm={executePendingAction}
      onCancel={cancelFeeModal}
      actionLabel={feeActionLabel}
      feePercent={feeCalc?.feePercent ?? 0}
      feeAmountFormatted={feeAmountFormatted}
      netAmountFormatted={netAmountFormatted}
      loading={feeLoading}
    />
    {modalTarget && (
      <>
        <StakeModal
          visible={stakeModalOpen}
          onClose={() => { setStakeModalOpen(false); setModalTarget(null) }}
          onSuccess={async () => { setStakeModalOpen(false); setModalTarget(null); await fetchData(); fetchBalance() }}
          appId={modalTarget.appId}
          stakeTokenId={modalTarget.stakeTokenId}
          stakeTokenName={modalTarget.stakeTokenName}
          isLpFarm={false}
        />
        <WithdrawModal
          visible={withdrawModalOpen}
          onClose={() => { setWithdrawModalOpen(false); setModalTarget(null) }}
          onSuccess={async () => { setWithdrawModalOpen(false); setModalTarget(null); await fetchData(); fetchBalance() }}
          appId={modalTarget.appId}
          stakeTokenId={modalTarget.stakeTokenId}
          stakeTokenName={modalTarget.stakeTokenName}
          userStake={modalTarget.userStake}
          isLpFarm={false}
        />
      </>
    )}
    </>
  )
})

export default STable
