import { FryFarmingClient } from './contracts/FryFarmingClient';
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, { Transaction, TransactionSigner } from 'algosdk';
import axios from 'axios';

const BOX_PRICE = 2500 + 400 * 64

algokit.Config.configure({ populateAppCallResources: true });

// Shared Algod client configuration
const getConfiguredAlgodClient = () => {
  const baseConfig = getAlgodConfigFromViteEnvironment();
  return algokit.getAlgoClient(baseConfig);
};

export const initFarming = async (
  signer: TransactionSigner,
  sender: string,
  params: {
    lpTokenA: number;
    lpTokenB: number;
    rewardToken: number;
    rewardAmount: number;
    farmStart: number;
    farmEnd: number;
    lockPeriod: number;
    farmEntryFee: number;
    rewardDistributionRate: number;
    rewardDistributionSchedule: number;
    fryRewardFee: number;
    fryToken: number;
    apr: number;
  }
) => {
  try {
    // Validate that all numeric parameters are valid numbers
    const numericParams = [
      { name: 'lpTokenA', value: params.lpTokenA },
      { name: 'lpTokenB', value: params.lpTokenB },
      { name: 'rewardToken', value: params.rewardToken },
      { name: 'rewardAmount', value: params.rewardAmount },
      { name: 'farmStart', value: params.farmStart },
      { name: 'farmEnd', value: params.farmEnd },
      { name: 'lockPeriod', value: params.lockPeriod },
      { name: 'farmEntryFee', value: params.farmEntryFee },
      { name: 'rewardDistributionRate', value: params.rewardDistributionRate },
      { name: 'rewardDistributionSchedule', value: params.rewardDistributionSchedule },
      { name: 'fryRewardFee', value: params.fryRewardFee },
      { name: 'apr', value: params.apr },
    ];

    for (const param of numericParams) {
      if (isNaN(param.value) || !isFinite(param.value)) {
        throw new Error(`Invalid parameter ${param.name}: ${param.value} is not a valid number`);
      }
    }

    // Step 1: Get Algorand client
    const algodConfig = getAlgodConfigFromViteEnvironment();
    const algodClient = algokit.getAlgoClient(algodConfig);

    const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig });
    algorandClient.setDefaultSigner(signer);

    // Step 2: Initialize contract
    const client = new FryFarmingClient(
      {
        sender: { addr: sender, signer },
        resolveBy: 'creatorAndName',
        creatorAddress: sender,
        findExistingUsing: algokit.getAlgoIndexerClient(getAlgodConfigFromViteEnvironment()),
        name: 'fry_farming',
      },
      algodClient
    );

    const fryTokenId = BigInt(import.meta.env.VITE_FRY_TOKEN_ID);
    const gasFee = BigInt(import.meta.env.VITE_GAS_FEE);

    // Step 3: Initialize the farming contract (no fry fee payment)
    const result = await client.create.initFarming({
      _authority: sender,
      _lp_token_a: BigInt(params.lpTokenA),
      _lp_token_b: BigInt(params.lpTokenB),
      _reward_token: BigInt(params.rewardToken),
      _reward_token_amount: BigInt(params.rewardAmount),
      _farm_start_time: BigInt(params.farmStart),
      _farm_end_time: BigInt(params.farmEnd),
      _lock_period: BigInt(params.lockPeriod),
      _farm_entry_fee: BigInt(params.farmEntryFee),
      _reward_distribution_rate: BigInt(params.rewardDistributionRate),
      _reward_distribution_schedule: BigInt(params.rewardDistributionSchedule),
      _fry_reward_fee: gasFee,
      _fry_token: fryTokenId,
    });

    const farmingAppId = BigInt(result.appId);
    await new Promise((res) => setTimeout(res, 500));

    // Step 4: Opt into contract assets
    const { lpTokenA, lpTokenB, rewardToken } = params;

    await optInToContractAssets(
      sender,
      signer,
      farmingAppId,
      BigInt(lpTokenA),
      BigInt(lpTokenB),
      BigInt(rewardToken)
    );
    await new Promise((res) => setTimeout(res, 1000));

    // Step 5: Transfer reward tokens to contract
    const transferAmount = BigInt(params.rewardAmount);

    await transferFryTokensToContract(
      sender,
      signer,
      BigInt(params.rewardToken),
      transferAmount,
      farmingAppId
    );

    return result;
  } catch (error) {
    console.error('Error initializing farming:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Improve error messages for better user experience
    if (error instanceof Error) {
      const errorMsg = error.message
      
      // Check for balance errors and provide better context
      if (errorMsg.includes('balance') && errorMsg.includes('below min')) {
        // Extract balance information if available
        const balanceMatch = errorMsg.match(/balance\s+(\d+)\s+below\s+(?:min|minimum)\s+(\d+)/i);
        const accountMatch = errorMsg.match(/account\s+([A-Z0-9]{58})/i);
        const assetsMatch = errorMsg.match(/\((\d+)\s+assets?\)/i);
        
        if (balanceMatch) {
          const currentBalance = parseInt(balanceMatch[1]);
          const minBalance = parseInt(balanceMatch[2]);
          const currentBalanceAlgo = (currentBalance / 1_000_000).toFixed(2);
          const minBalanceAlgo = (minBalance / 1_000_000).toFixed(2);
          const neededAlgo = ((minBalance - currentBalance) / 1_000_000).toFixed(2);
          const assetCount = assetsMatch ? assetsMatch[1] : 'multiple';
          
          // Check if this is about the contract account (not user's wallet)
          const isContractAccount = accountMatch && accountMatch[1] !== sender;
          
          if (isContractAccount) {
            throw new Error(`Contract account needs more ALGO: The farming pool contract account has ${currentBalanceAlgo} ALGO, but needs at least ${minBalanceAlgo} ALGO to hold ${assetCount} asset(s). The system will automatically send more ALGO to the contract, but you may need to ensure your wallet has enough ALGO to cover this. Please try again or add more ALGO to your wallet if the issue persists.`)
          } else {
            throw new Error(`Insufficient ALGO balance: The account has ${currentBalanceAlgo} ALGO, but needs at least ${minBalanceAlgo} ALGO to create a farming pool with ${assetCount} asset(s). Please ensure you have at least ${neededAlgo} more ALGO available.`)
          }
        }
      }
      
      // Re-throw with original message if it's already informative
      throw error
    }
    
    // For non-Error objects, convert to Error
    throw new Error(error?.toString() || 'Unknown error occurred during farming initialization')
  }
};

export const optInToContractAssets = async (
  sender: string,
  signer: TransactionSigner,
  appId: bigint,
  lpTokenA: bigint,
  lpTokenB: bigint,
  rewardToken: bigint
) => {
  const algodConfig = getAlgodConfigFromViteEnvironment();

  const algod = new algosdk.Algodv2(
    algodConfig.token as string | algosdk.AlgodTokenHeader,
    algodConfig.server,
    algodConfig.port
  );

  const suggestedParams = await algod.getTransactionParams().do();
  const appAddress = algosdk.getApplicationAddress(Number(appId));
  const mbrAmount = 100_000 * 5;

  const mbrPayTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: sender,
    to: appAddress,
    amount: mbrAmount,
    suggestedParams: {
      ...suggestedParams,
      fee: 4000,
      flatFee: true,
    },
  });

  const [signedTxn] = await signer([mbrPayTxn], [0]);
  await algod.sendRawTransaction(signedTxn).do();
    const appClient = new FryFarmingClient(
      {
        id: appId,
        sender: { addr: sender, signer },
        resolveBy: 'id',
      },
      algod
    );

  try {
    // Opt into LP tokens and reward token (first batch)
    await appClient.optInAsset([
      lpTokenA,
      lpTokenB,
      rewardToken,
      mbrPayTxn,
    ]);

    // Get FRY token ID and opt into it separately if it's different from reward token
    const fryTokenId = BigInt(import.meta.env.VITE_FRY_TOKEN_ID);
    if (fryTokenId !== rewardToken && fryTokenId !== 0n) {
      // Create a separate MBR payment for FRY token opt-in
      const fryMbrPayTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: sender,
        to: appAddress,
        amount: 100_000, // MBR for one asset
        suggestedParams: {
          ...suggestedParams,
          fee: 1000,
          flatFee: true,
        },
      });

      const [signedFryTxn] = await signer([fryMbrPayTxn], [0]);
      await algod.sendRawTransaction(signedFryTxn).do();

      // Opt into FRY token separately
      await appClient.optInAsset([
        fryTokenId,
        0n, // Skip second asset
        0n, // Skip third asset
        fryMbrPayTxn,
      ]);

    }
  } catch (err) {
    console.error('Contract asset opt-in failed:', err);
    throw err;
  }
};


// Function to opt-in to an asset (FRY token)
export const optInToAsset = async (
  assetId: bigint,  // Ensure assetId is bigint
  sender: string,
  signer: TransactionSigner,
  appId: bigint
) => {
  const algodConfig = getAlgodConfigFromViteEnvironment();
  const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig });

  try {
    // Opt-in to the FRY token directly for the user's wallet
    await algorandClient.transactions.assetOptIn({
      sender,
      signer,
      assetId: assetId,  // Now directly pass assetId as bigint
    });

    console.log(` Opted-in to asset ${assetId} for sender ${sender}`);
  } catch (err) {
    console.error('Opt-in failed:', err);
    throw err;
  }
};

// Function to send asset transfer (deduct fee from user's wallet)
// export const sendAssetTransfer = async (
//   sender: string,
//   signer: TransactionSigner,
//   rewardTokenId: number | bigint,  // Accept both number or bigint
//   amountToDeduct: bigint, // Amount to deduct from the user (e.g., fee amount)
//   appId: bigint // Add appId to target the app address for the fee transfer
// ) => {
//   try {
//     // Create the Algorand client
//     const algodConfig = getAlgodConfigFromViteEnvironment();
//     const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig });
//     algorandClient.setDefaultSigner(signer);

//     // Convert rewardTokenId to bigint if it's a number
//     const rewardTokenIdToUse = typeof rewardTokenId === 'number' ? BigInt(rewardTokenId) : rewardTokenId;

//     // Get the application's address
//     const appAddress = algosdk.getApplicationAddress(appId);

//     // Send the asset transfer directly from user to the application address (deducting fee)
//     const tx = await algorandClient.transactions.assetTransfer({
//       sender,
//       signer,
//       receiver: appAddress, // Send the fee to the application's address
//       amount: amountToDeduct, // Deduct the specified amount (e.g., fee)
//       assetId: rewardTokenIdToUse, // Use converted rewardTokenId as bigint
//     });

//     console.log('Asset transfer deducted successfully:', tx);
//     return tx;
//   } catch (error) {
//     console.error('Error sending asset transfer:', error);
//     throw error;
//   }
// };

export const sendAssetTransfer = async (
  sender: string,
  signer: TransactionSigner,
  rewardTokenId: number | bigint,
  amountToDeduct: bigint,
  appId: bigint
) => {
  try {
    const algodConfig = getAlgodConfigFromViteEnvironment();
    const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig });
    algorandClient.setDefaultSigner(signer);

    const rewardTokenIdToUse = typeof rewardTokenId === 'number' ? BigInt(rewardTokenId) : rewardTokenId;
    const appAddress = algosdk.getApplicationAddress(appId);

    const tx = rewardTokenIdToUse === 0n
      ? await algorandClient.send.payment({
        sender,
        signer,
        receiver: appAddress,
        amount: algokit.microAlgos(Number(amountToDeduct)),
      })
      : await algorandClient.send.assetTransfer({
        sender,
        signer,
        receiver: appAddress,
        amount: amountToDeduct,
        assetId: rewardTokenIdToUse,
      });

    return tx;
  } catch (error) {
    console.error('Error sending asset transfer:', error);
    throw error;
  }
};


// export const transferFryTokensToContract = async (
//   sender: string,
//   signer: TransactionSigner,
//   rewardToken: bigint,
//   amountToTransfer: bigint,
//   appId: bigint
// ) => {
//   const algodConfig = getAlgodConfigFromViteEnvironment();
//   const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig });
//   algorandClient.setDefaultSigner(signer);

//   try {
//     const appAddress = algosdk.getApplicationAddress(appId);
//     if (amountToTransfer <= 0n) {
//       throw new Error("Transfer amount must be greater than 0");
//     }

//     const gasFee = BigInt(import.meta.env.VITE_GAS_FEE);
//     const fryTokenId = BigInt(import.meta.env.VITE_FRY_TOKEN_ID);

//     const gasTx = await algorandClient.send.assetTransfer({
//       sender,
//       signer,
//       receiver: algosdk.getApplicationAddress(appId),
//       amount: gasFee,
//       assetId: fryTokenId,
//     });

//     const isAlgo = rewardToken === 0n;

//     // const tx = await algorandClient.send.assetTransfer({
//     //   sender,
//     //   signer,
//     //   receiver: algosdk.getApplicationAddress(appId),
//     //   amount: amountToTransfer, // 1 FRY assuming 6 decimals
//     //   assetId: rewardToken,
//     // });

//     const tx = isAlgo
//       ? await algorandClient.send.payment({
//         sender,
//         signer,
//         receiver: appAddress,
//         amount: amountToTransfer,
//       })
//       : await algorandClient.send.assetTransfer({
//         sender,
//         signer,
//         receiver: appAddress,
//         amount: amountToTransfer,
//         assetId: rewardToken,
//       });

//     console.log(' FRY Tokens transferred to the farming contract:', tx);
//     return tx;

//   } catch (error) {
//     console.error('Error transferring FRY tokens to contract:', error);
//     throw error;
//   }
// };

export const transferFryTokensToContract = async (
  sender: string,
  signer: TransactionSigner,
  rewardToken: bigint,
  amountToTransfer: bigint,
  appId: bigint
) => {
  const algodConfig = getAlgodConfigFromViteEnvironment();
  const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig });
  algorandClient.setDefaultSigner(signer);

  try {
    const appAddress = algosdk.getApplicationAddress(appId);

    if (amountToTransfer <= 0n) {
      throw new Error("Transfer amount must be greater than 0");
    }

    const gasFee = BigInt(import.meta.env.VITE_GAS_FEE);
    const fryTokenId = BigInt(import.meta.env.VITE_FRY_TOKEN_ID);

    // Send gas fee as ASA (FRY)
    await algorandClient.send.assetTransfer({
      sender,
      signer,
      receiver: appAddress,
      amount: gasFee,
      assetId: fryTokenId,
    });

    const isAlgo = rewardToken === 0n;

    const tx = isAlgo
      ? await algorandClient.send.payment({
        sender,
        signer,
        receiver: appAddress,
        amount: algokit.microAlgos(Number(amountToTransfer))
      })
      : await algorandClient.send.assetTransfer({
        sender,
        signer,
        receiver: appAddress,
        amount: amountToTransfer,
        assetId: rewardToken,
      });

    return tx;

  } catch (error) {
    console.error('Error transferring tokens to contract:', error);
    throw error;
  }
};


export const createFryFarmingClient = async (
  signer: TransactionSigner,
  activeAddress: string,
  appId: number
) => {
  // Configure Algorand client
  algokit.Config.configure({ populateAppCallResources: true });

  // Get Algorand configuration
  const algodConfig = getAlgodConfigFromViteEnvironment();
  const algorandClient: algokit.AlgorandClient = algokit.AlgorandClient.fromConfig({ algodConfig });
  algorandClient.setDefaultSigner(signer);

  // Set up the Algorand client for interaction
  const algodClient = algokit.getAlgoClient({
    server: algodConfig.server,
    port: algodConfig.port,
    token: algodConfig.token,
  });

  // Initialize the FryFarmingClient
  const farmingClient = new FryFarmingClient(
    {
      resolveBy: 'id',
      id: appId,  // The appId of the Fry Farming contract
      sender: { addr: activeAddress!, signer },
    },
    algorandClient.client.algod, // Use the client instance from the Algorand client
  );

  // Return the necessary clients and instances
  return { farmingClient, algorandClient, algodClient };
};

// export const stakeTokens = async (
//   stakingId: number,
//   stakeAmount: number,
//   sender: string,
//   signer: TransactionSigner
// ) => {
//   try {
//     // Step 1: Create the farming client
//     const { farmingClient, algorandClient } = await createFryFarmingClient(signer, sender, stakingId);

//     // Step 2: Get global state from the farming contract
//     const globalState = await farmingClient.getGlobalState();

//     // Step 3: Extract values with proper checks
//     const appAddress = algosdk.getApplicationAddress(stakingId);

//     const stakeTokenId = globalState.stakeToken?.asNumber();
//     const rewardAmount = globalState.rewardTokenAmount?.asNumber();
//     const currentTotalStaked = globalState.totalStaked?.asNumber();
//     const start = globalState.farmStartTime?.asNumber();
//     const end = globalState.farmEndTime?.asNumber();

//     if (
//       stakeTokenId === undefined ||
//       rewardAmount === undefined ||
//       currentTotalStaked === undefined ||
//       start === undefined ||
//       end === undefined
//     ) {
//       throw new Error('Missing required global state values');
//     }

//     const poolTime = end - start;
//     if (poolTime <= 0) throw new Error('Invalid farm duration');

//     // Step 4: Calculate updated APR
//     const updatedAprFloat =
//       (rewardAmount / (currentTotalStaked + stakeAmount)) * 100 * ((86400 * 360) / poolTime);
//     const updatedApr = Math.floor(updatedAprFloat * 100); // scale ×100 to keep 2 decimal places

//     // Step 5: Prepare the box payment transaction for storage
//     const boxTx = await algorandClient.transactions.payment({
//       sender,
//       receiver: appAddress,
//       amount: algokit.microAlgos(BOX_PRICE),
//     });

//     const gasFee = BigInt(import.meta.env.VITE_GAS_FEE);
//     const fryTokenId = BigInt(import.meta.env.VITE_FRY_TOKEN_ID);

//     const gasTx = await algorandClient.send.assetTransfer({
//       sender,
//       signer,
//       receiver: algosdk.getApplicationAddress(stakingId),
//       amount: gasFee,
//       assetId: fryTokenId,
//     });

//     try {
//       const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gasfee/add`, {
//         appId: stakingId,
//         userId: sender,
//         gasAmount: Number(gasFee),
//         gasType: 'farmingStake',
//       });

//       if (data.success) {
//         console.log('Gas fee logged:', data);
//       } else {
//         console.warn('Gas fee log response:', data.message);
//       }
//     } catch (err) {
//       console.error('Error logging gas fee:', err);
//     }

//     // Step 6: Prepare asset transfer transaction for staking
//     const stakeAxfer = await algorandClient.transactions.assetTransfer({
//       sender,
//       receiver: appAddress,
//       amount: BigInt(stakeAmount),
//       assetId: BigInt(stakeTokenId),
//     });

//     // Step 7: Call the smart contract method `stakeTokens`
//     const result = await farmingClient.stakeTokens({
//       stakeAmount: BigInt(stakeAmount),
//       updatedApr: BigInt(updatedApr),
//       stakeAxfer,
//       boxTx,
//     });

//     console.log(' Staking complete:', result);
//     return result;
//   } catch (error) {
//     console.error('Error during staking:', error);
//     throw error;
//   }
// };

export const stakeTokens = async (
  stakingId: number,
  stakeAmount: number,
  sender: string,
  signer: TransactionSigner
) => {
  try {
    const { farmingClient, algorandClient } = await createFryFarmingClient(signer, sender, stakingId);

    const globalState = await farmingClient.getGlobalState();
    console.log('DEBUG: Staking to appId:', stakingId);
    console.log('DEBUG: Fetched global state:', globalState);

    const appAddress = algosdk.getApplicationAddress(stakingId);
    const stakeTokenId = globalState.stake_token?.asNumber();
    const rewardAmount = globalState.reward_token_amount?.asNumber();
    const currentTotalStaked = globalState.total_staked?.asNumber();
    const start = globalState.farm_start_time?.asNumber();
    const end = globalState.farm_end_time?.asNumber();

    console.log('DEBUG: stakeTokenId:', stakeTokenId);
    console.log('DEBUG: rewardAmount:', rewardAmount);
    console.log('DEBUG: currentTotalStaked:', currentTotalStaked);
    console.log('DEBUG: start:', start);
    console.log('DEBUG: end:', end);
    console.log('DEBUG: sender:', sender);
    console.log('DEBUG: stakingId:', stakingId);
    console.log('DEBUG: stakeAmount:', stakeAmount);

    if (
      stakeTokenId === undefined ||
      rewardAmount === undefined ||
      currentTotalStaked === undefined ||
      start === undefined ||
      end === undefined
    ) {
      throw new Error('Missing required global state values');
    }

    // Additional check for invalid asset ID
    if (stakeTokenId !== 0 && (!Number.isInteger(stakeTokenId) || stakeTokenId <= 0)) {
      throw new Error(`Invalid stakeTokenId for ASA staking: ${stakeTokenId}`);
    }

    const poolTime = end - start;
    if (poolTime <= 0) throw new Error('Invalid farm duration');

    const updatedAprFloat =
      (rewardAmount / (currentTotalStaked + stakeAmount)) * 100 * ((86400 * 360) / poolTime);
    const updatedApr = Math.floor(updatedAprFloat * 100); // scale ×100 to keep 2 decimals

    const boxTx = await algorandClient.transactions.payment({
      sender,
      receiver: appAddress,
      amount: algokit.microAlgos(BOX_PRICE),
    });

    const gasFee = BigInt(import.meta.env.VITE_GAS_FEE);
    const fryTokenId = BigInt(import.meta.env.VITE_FRY_TOKEN_ID);

    await algorandClient.send.assetTransfer({
      sender,
      signer,
      receiver: appAddress,
      amount: gasFee,
      assetId: fryTokenId,
    });

    // Prepare stake_pay and stake_axfer according to the token type
    let stakePay, stakeAxfer;
    if (stakeTokenId === 0) {
      // ALGO staking: real payment only. For the dummy asset transfer, use a valid ASA the user is opted into (not assetId 1).
      stakePay = await algorandClient.transactions.payment({
        sender,
        receiver: appAddress,
        amount: algokit.microAlgos(Number(stakeAmount)),
        signer,
      });
      // Dummy asset transfer required by contract signature when staking ALGO.
      // Use the FRY token since users must be opted in to pay gas fees.
      const fryTokenId = BigInt(import.meta.env.VITE_FRY_TOKEN_ID);
      stakeAxfer = await algorandClient.transactions.assetTransfer({
        sender,
        receiver: appAddress,
        amount: 0n,
        assetId: fryTokenId,
        signer,
      });
    } else {
      // ASA staking: real asset transfer, dummy payment
      stakePay = await algorandClient.transactions.payment({
        sender,
        receiver: appAddress,
        amount: algokit.microAlgos(1000), // minimal payment
        signer,
      });
      stakeAxfer = await algorandClient.transactions.assetTransfer({
        sender,
        receiver: appAddress,
        amount: BigInt(stakeAmount),
        assetId: BigInt(stakeTokenId),
        signer,
      });
      console.log('DEBUG: ASA staking, stakePay and stakeAxfer prepared. assetId:', stakeTokenId);
    }

    const result = await farmingClient.stakeTokens({
      stake_amount: BigInt(stakeAmount),
      updated_apr: BigInt(updatedApr),
      stake_pay: stakePay,
      stake_axfer: stakeAxfer,
      box_tx: boxTx,
    });

    return result;
  } catch (error) {
    console.error('Error during staking:', error);
    throw error;
  }
};


export const getUserStakeForPool = async (
  appId: number,
  userAddress: string,
  signer: TransactionSigner
) => {
  const { farmingClient } = await createFryFarmingClient(signer, userAddress, appId);

  try {
    //  This is the ONLY correct way to encode the box name
    const boxName = algosdk.decodeAddress(userAddress).publicKey;

    const result = await farmingClient.getUserStake(
      { user: userAddress },
      {
        boxes: [
          {
            appId,
            name: boxName, // 🧠 Must be exactly 32-byte publicKey
          },
        ],
      }
    );

    if (!result.return) throw new Error('No return value from getUserStake');

    return {
      staked: Number(result.return[0]) / 1e6,
      time: Number(result.return[1]),
      reward: Number(result.return[2]) / 1e6,
    };
  } catch (err) {
    console.error(`Error fetching stake info for pool ${appId}:`, err);
    return null;
  }
};

export const getAlgodClient = () => {
  const config = getAlgodConfigFromViteEnvironment();
  return algokit.getAlgoClient({
    server: config.server,
    port: config.port,
    token: config.token,
  });
};

export const getUserData = async (appId: number, userAddress: string) => {
  const algod = await getAlgodClient();
  const boxes = await algod.getApplicationBoxes(appId).do();

  const box = boxes.boxes.find((b) => algosdk.encodeAddress(b.name) === userAddress);

  if (!box) return null;

  const boxValue = await algod.getApplicationBoxByName(appId, box.name).do();
  const bytes = boxValue.value;

  const stakedAmount = algosdk.decodeUint64(bytes.slice(0, 8), 'mixed');
  const stakeTime = algosdk.decodeUint64(bytes.slice(8, 16), 'mixed');
  const claimed = algosdk.decodeUint64(bytes.slice(16, 24), 'mixed');

  return {
    stakerId: userAddress,
    stakedAmount,
    stakeTime,
    claimed,
  };
};

export const unstakeTokens = async (
  farmingId: number,
  unstakeAmount: number,
  sender: string,
  signer: TransactionSigner
) => {
  try {
    const { farmingClient, algodClient } = await createFryFarmingClient(signer, sender, farmingId);

    // 1. Verify contract state
    const globalState = await farmingClient.getGlobalState();
    const stakeTokenId = globalState.stake_token?.asNumber();
    if (!stakeTokenId) throw new Error('Stake token not configured');

    const lockPeriod = globalState.lock_period?.asNumber();  // Lock period in seconds
    const poolStartTime = globalState.farm_start_time?.asNumber(); // Pool start time

    // 2. Check contract balance
    const appAddress = algosdk.getApplicationAddress(farmingId);
    const contractBalance = await algodClient.accountAssetInformation(appAddress, stakeTokenId).do();
    if (contractBalance.amount < unstakeAmount) {
      throw new Error(`Contract only has ${contractBalance.amount} tokens`);
    }

    const currentTime = Date.now() / 1000;  // Current time in seconds
    const lockEndTime = poolStartTime! + lockPeriod!; // Lock period end time
    if (currentTime < lockEndTime) {
      throw new Error(`The lock period has not ended. You can unstake after ${Math.floor(lockEndTime - currentTime)} seconds.`);
    }

    // 3. Get user's box data
    const boxName = algosdk.decodeAddress(sender).publicKey;
    console.log('Box name (base64):', Buffer.from(boxName).toString('base64'));

    // 4. Execute unstake with all required resources
    const tx = await farmingClient.unstakeTokens(
      { unstake_amount: BigInt(unstakeAmount) },
      {
        sendParams: {
          fee: algokit.microAlgos(4000), // Higher fee for box operations
          suppressLog: true
        },
        boxes: [
          {
            appId: farmingId,
            name: boxName
          }
        ],
        accounts: [sender],
        assets: [stakeTokenId],
        apps: [farmingId]
      }
    );

    console.log(' Unstake successful:', tx);
    return tx;

  } catch (e) {
    console.error('Unstaking failed:', e);
    throw new Error(`Unstaking failed: ${e instanceof Error ? e.message : String(e)}`);
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const claimRewards = async (
  farmingId: number,
  sender: string,
  signer: TransactionSigner
) => {
  try {
    const { farmingClient, algodClient, algorandClient } = await createFryFarmingClient(signer, sender, farmingId);
    const globalState = await farmingClient.getGlobalState();

    const rewardTokenId = globalState.reward_token?.asBigInt();
    const rewardTokenAmount = globalState.reward_token_amount?.asBigInt() ?? 0n;
    const farmStartTime = globalState.farm_start_time?.asBigInt() ?? 0n;
    const farmEndTime = globalState.farm_end_time?.asBigInt() ?? 0n;
    const apr = globalState.apr?.asBigInt() ?? 0n;
    const rewardDistributed = globalState.rewards_distributed?.asBigInt() ?? 0n;
    const rewardSchedule = globalState.reward_distribution_schedule?.asBigInt() ?? 0n;
    const rewardRate = globalState.reward_distribution_rate?.asBigInt() ?? 100n; // Assume 100% if not set

    // Allow 0 as valid rewardTokenId (ALGO)
    if (rewardTokenId === undefined || rewardTokenId === null) throw new Error('Missing rewardToken ID');

    const boxName = algosdk.decodeAddress(sender).publicKey;
    const boxRes = await algodClient.getApplicationBoxByName(farmingId, boxName).do();
    const bytes = boxRes.value;

    if (!bytes || bytes.length < 24) {
      throw new Error('No stake data found in user box');
    }

    const stakedAmount = algosdk.decodeUint64(bytes.slice(0, 8), 'mixed');
    const stakeTime = algosdk.decodeUint64(bytes.slice(8, 16), 'mixed');
    const lastClaimTime = bytes.length >= 32 ? algosdk.decodeUint64(bytes.slice(24, 32), 'mixed') : 0;

    const currentTime = Math.floor(Date.now() / 1000);

    //  Check claim eligibility
    if (BigInt(currentTime) <= BigInt(lastClaimTime) + rewardSchedule) {
      const wait = Number(BigInt(lastClaimTime) + rewardSchedule - BigInt(currentTime));
      throw new Error(`Claim not allowed yet. Try again in ${wait} seconds.`);
    }

    if (currentTime < Number(farmStartTime) || currentTime > Number(farmEndTime)) {
      throw new Error('Farm is not active');
    }

    const stakeDuration = BigInt(currentTime) - BigInt(stakeTime);
    let reward = (BigInt(stakedAmount) * apr * BigInt(stakeDuration)) / (1000000n * 31104000n);
    reward = (reward * rewardRate) / 100n;

    const remaining = rewardTokenAmount - rewardDistributed;
    const claimable = reward > remaining ? remaining : reward;

    console.log('Raw calculated reward (micro):', reward.toString());

    if (claimable <= 0n) {
      throw new Error('No claimable rewards available');
    }


    const gasFee = BigInt(import.meta.env.VITE_GAS_FEE);
    const fryTokenId = BigInt(import.meta.env.VITE_FRY_TOKEN_ID);

    const gasTx = await algorandClient.send.assetTransfer({
      sender,
      signer,
      receiver: algosdk.getApplicationAddress(farmingId),
      amount: gasFee,
      assetId: fryTokenId,
    });

    // Prepare assets array only if rewardTokenId is not 0 (ALGO)
    const assetsArray = rewardTokenId !== 0n ? [Number(rewardTokenId)] : undefined;

    // Call the smart contract method to claim rewards
    const tx = await farmingClient.claimRewards(
      {},
      {
        sendParams: {
          fee: algokit.microAlgos(4000), // Higher fee for box operations
          suppressLog: true
        },
        boxes: [
          {
            appId: farmingId,
            name: boxName
          }
        ],
        accounts: [sender],
        ...(assetsArray ? { assets: assetsArray } : {}),
        apps: [farmingId]
      }
    );

    return tx;
  } catch (e) {
    console.error('Claiming rewards failed:', e);
    throw new Error(`Claiming rewards failed: ${e instanceof Error ? e.message : String(e)}`);
  }
};
