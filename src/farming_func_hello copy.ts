
import * as algokit from '@algorandfoundation/algokit-utils'
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'
import { AppDetails } from '@algorandfoundation/algokit-utils/types/app-client'
import algosdk, { TransactionSigner, ABIContract } from 'algosdk'
// import { FryFarmingClient } from './contracts/FryFarming'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
import type { AppSpec } from '@algorandfoundation/algokit-utils/types/app-spec'
import { mnemonicAccount } from '@algorandfoundation/algokit-utils'


import { HelloContractClient  } from './contracts/HelloContract'

const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '')
const indexer = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', '') // ✅ Required for findExistingUsing

// export const APP_SPEC: AppSpec = {
//     "hints": {
//       "hello()string": {
//         "call_config": {
//           "no_op": "CALL"
//         }
//       }
//     },
//     "source": {
//       "approval": "I3ByYWdtYSB2ZXJzaW9uIDEwCiNwcmFnbWEgdHlwZXRyYWNrIGZhbHNlCgovLyBhbGdvcHkuYXJjNC5BUkM0Q29udHJhY3QuYXBwcm92YWxfcHJvZ3JhbSgpIC0+IHVpbnQ2NDoKbWFpbjoKICAgIHR4biBOdW1BcHBBcmdzCiAgICBieiBtYWluX2JhcmVfcm91dGluZ0A2CiAgICBwdXNoYnl0ZXMgMHhhYjA2YzFhOCAvLyBtZXRob2QgImhlbGxvKClzdHJpbmciCiAgICB0eG5hIEFwcGxpY2F0aW9uQXJncyAwCiAgICBtYXRjaCBtYWluX2hlbGxvX3JvdXRlQDMKCm1haW5fYWZ0ZXJfaWZfZWxzZUAxMDoKICAgIHB1c2hpbnQgMCAvLyAwCiAgICByZXR1cm4KCm1haW5faGVsbG9fcm91dGVAMzoKICAgIHR4biBPbkNvbXBsZXRpb24KICAgICEKICAgIGFzc2VydCAvLyBPbkNvbXBsZXRpb24gaXMgbm90IE5vT3AKICAgIHR4biBBcHBsaWNhdGlvbklECiAgICBhc3NlcnQgLy8gY2FuIG9ubHkgY2FsbCB3aGVuIG5vdCBjcmVhdGluZwogICAgcHVzaGJ5dGVzIDB4MTUxZjdjNzUwMDBmNDg2NTZjNmM2ZjJjMjA0MTZjNjc2ZjRiNjk3NDIxCiAgICBsb2cKICAgIHB1c2hpbnQgMSAvLyAxCiAgICByZXR1cm4KCm1haW5fYmFyZV9yb3V0aW5nQDY6CiAgICB0eG4gT25Db21wbGV0aW9uCiAgICBibnogbWFpbl9hZnRlcl9pZl9lbHNlQDEwCiAgICB0eG4gQXBwbGljYXRpb25JRAogICAgIQogICAgYXNzZXJ0IC8vIGNhbiBvbmx5IGNhbGwgd2hlbiBjcmVhdGluZwogICAgcHVzaGludCAxIC8vIDEKICAgIHJldHVybgo=",
//       "clear": "I3ByYWdtYSB2ZXJzaW9uIDEwCiNwcmFnbWEgdHlwZXRyYWNrIGZhbHNlCgovLyBhbGdvcHkuYXJjNC5BUkM0Q29udHJhY3QuY2xlYXJfc3RhdGVfcHJvZ3JhbSgpIC0+IHVpbnQ2NDoKbWFpbjoKICAgIHB1c2hpbnQgMSAvLyAxCiAgICByZXR1cm4K"
//     },
//     "state": {
//       "global": {
//         "num_byte_slices": 0,
//         "num_uints": 0
//       },
//       "local": {
//         "num_byte_slices": 0,
//         "num_uints": 0
//       }
//     },
//     "schema": {
//       "global": {
//         "declared": {},
//         "reserved": {}
//       },
//       "local": {
//         "declared": {},
//         "reserved": {}
//       }
//     },
//     "contract": {
//       "name": "HelloContract",
//       "methods": [
//         {
//           "name": "hello",
//           "args": [],
//           "readonly": false,
//           "returns": {
//             "type": "string"
//           }
//         }
//       ],
//       "networks": {}
//     },
//     "bare_call_config": {
//       "no_op": "CREATE"
//     }
//   }

  const account = mnemonicAccount("lawsuit analyst pupil accuse upgrade worry have almost cheap model horn labor joy ancient favorite thing virus jewel now deny expect edit glow ability crane")
// const sender = {
//   addr: account.addr,
//   signer: account.signer,
// }

// export const helloClient = new HelloContractClient(
//     {
//       sender: account,
//       resolveBy: 'creatorAndName',
//       name: 'hello-contract',
//       creatorAddress: account.addr,
//       findExistingUsing: indexer,
//     },
//     algod
//   )

export const helloClient = new HelloContractClient(
    {
      sender: account,
      resolveBy: 'id',
      id: 736339569, // ✅ your actual deployed app ID
    },
    algod
  )

// export const helloClient = new HelloContractClient(
//     {
//       sender: account,
//       resolveBy: 'creatorAndName',
//       name: 'hello-contract',
//       creatorAddress: account.addr, // ✅ Required in v5.8.0
//       findExistingUsing: indexer, // ✅ Use 'indexer' or 'algod'
//     },
//     algod
//   )
//   const result = await helloClient.hello([])
// console.log('🎉 Hello result:', result.return) 
  
  // 4. Call the hello() method
//   const result = await helloClient.hello([])

// const contract = new ABIContract(APP_SPEC.contract)


// const algodConfig = getAlgodConfigFromViteEnvironment()

// const algorandClient = algokit.AlgorandClient.fromConfig({
//   algodConfig, // ✅ wrap it into the expected object
// })

// const getAlgodClient = async () => {
//   const algodConfig = getAlgodConfigFromViteEnvironment()
//   return algokit.getAlgoClient({
//     server: algodConfig.server,
//     port: algodConfig.port,
//     token: algodConfig.token,
//   })
// }

// const getIndexerClient = async () => {
//   const algodConfig = getAlgodConfigFromViteEnvironment()
//   return algokit.getAlgoIndexerClient({
//     server: algodConfig.server,
//     port: algodConfig.port,
//     token: algodConfig.token,
//   })
// }

// const createFryFarmingClient = async (
//     signer: TransactionSigner,
//     activeAddress: string,
//     appId: number
//   ) => {
//     algokit.Config.configure({ populateAppCallResources: true })
  
//     const algodConfig = getAlgodConfigFromViteEnvironment()
//     const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig }) // ✅ fixed
  
//     algorandClient.setDefaultSigner(signer)
  
//     const farmingClient = new FryFarmingClient({
//       resolveBy: 'id',
//       id: appId,
//       sender: { addr: activeAddress, signer },
//       client: algorandClient.client.algod, 
//     })
  
//     return { farmingClient, algorandClient }
//   }
  
  
  

//   export const initFarming = async (
//     lpTokenA: number,
//     lpTokenB: number,
//     rewardTokenId: number,
//     rewardAmount: number,
//     startTime: number,
//     endTime: number,
//     lockPeriod: number,
//     farmEntryFee: number,
//     fryFeeWallet: string,
//     rewardDistributionRate: number,
//     rewardDistributionSchedule: number,
//     fryRewardFee: number,
//     sender: string,
//     signer: TransactionSigner
//   ) => {
//     try {
//       const indexer = await getIndexerClient()
//       const algodClient = await getAlgodClient()
  
//       const farming = new FryFarmingClient({
//         resolveBy: 'creatorAndName',
//         sender: { signer, addr: sender },
//         creatorAddress: sender,
//         findExistingUsing: indexer,
//         client: algodClient,
//       })
  
//       const result = await farming.appClient.create({
//         method: 'init_farming',
//         methodArgs: [
//           sender,
//           lpTokenA,
//           lpTokenB,
//           rewardTokenId,
//           BigInt(rewardAmount),
//           BigInt(startTime),
//           BigInt(endTime),
//           BigInt(lockPeriod),
//           BigInt(farmEntryFee),
//           fryFeeWallet,
//           BigInt(rewardDistributionRate),
//           BigInt(rewardDistributionSchedule),
//           BigInt(fryRewardFee),
//         ],
//       })
  
//       const { farmingClient, algorandClient } = await createFryFarmingClient(signer, sender, result.appId)
  
//       await algorandClient.send.assetTransfer({
//         sender,
//         signer,
//         assetId: BigInt(rewardTokenId),
//         amount: BigInt(rewardAmount),
//         receiver: algosdk.getApplicationAddress(result.appId),
//       })
  
//       return result.appId
//     } catch (e) {
//       console.error('initFarming error:', e)
//       throw e
//     }
//   }
  

// export const farm = async (
//   farmingId: number,
//   lpAmount: number,
//   sender: string,
//   signer: TransactionSigner
// ) => {
//   try {
//     const { farmingClient, algorandClient } = await createFryFarmingClient(signer, sender, farmingId)
//     const globalState: any = await farmingClient.getGlobalState()

//     const tx = await algorandClient.transactions.assetTransfer({
//       sender,
//       signer,
//       assetId: globalState.lpToken?.asNumber(),
//       amount: BigInt(lpAmount),
//       receiver: algosdk.getApplicationAddress(farmingId),
//     })

//     const call = await farmingClient.farm({
//       amount: lpAmount,
//       lpTransfer: tx,
//     })

//     return call
//   } catch (e) {
//     console.error('farm error:', e)
//     return e
//   }
// }

// export const claimRewards = async (
//   farmingId: number,
//   sender: string,
//   signer: TransactionSigner
// ) => {
//   try {
//     const { farmingClient } = await createFryFarmingClient(signer, sender, farmingId)
//     const globalState: any = await farmingClient.getGlobalState()
//     const userData = await getFarmerData(farmingId, sender)

//     const reward =
//       userData.lpAmount *
//       (globalState.apr?.asNumber() / 10000) *
//       ((Math.floor(Date.now() / 1000) - userData.farmTime) / 31104000)

//     const updatedApr =
//       ((globalState.rewardAmount?.asNumber() - reward) / globalState.totalFarming?.asNumber()) *
//       100 *
//       ((86400 * 360) / globalState.duration.asNumber())

//     const result = await farmingClient.claimRewards({
//       updatedApr: Math.floor(updatedApr * 100),
//     })

//     return {
//       tx: result,
//       rewardClaimed: Number((reward / 1_000_000).toFixed(3)),
//     }
//   } catch (e) {
//     console.error('claimRewards error:', e)
//     return e
//   }
// }

// export const unfarm = async (
//   farmingId: number,
//   lpAmount: number,
//   sender: string,
//   signer: TransactionSigner
// ) => {
//   try {
//     const { farmingClient } = await createFryFarmingClient(signer, sender, farmingId)
//     const globalState: any = await farmingClient.getGlobalState()
//     const userData = await getFarmerData(farmingId, sender)

//     const reward =
//       lpAmount *
//       (globalState.apr?.asNumber() / 10000) *
//       ((Math.floor(Date.now() / 1000) - userData.farmTime) / 31104000)

//     const updatedApr =
//       ((globalState.rewardAmount?.asNumber() - reward) / (globalState.totalFarming?.asNumber() - lpAmount)) *
//       100 *
//       ((86400 * 360) / globalState.duration.asNumber())

//     const tx = await farmingClient.unfarm({
//       amount: lpAmount,
//       updatedApr: Math.floor(updatedApr * 100),
//     })

//     return tx
//   } catch (e) {
//     console.error('unfarm error:', e)
//     return e
//   }
// }

// export const getFarmerData = async (farmingId: number, farmer: string) => {
//   const algod = await getAlgodClient()
//   const boxes = await algokit.getAppBoxNames(farmingId, algod)
//   const farmerBox = boxes.find((box) => algosdk.encodeAddress(box.nameRaw) === farmer)

//   if (!farmerBox) throw new Error('Farmer not found')

//   const data = await algokit.getAppBoxValue(farmingId, farmerBox.nameRaw, algod)
//   const lpAmount = algosdk.decodeUint64(data.slice(0, 8), 'mixed')
//   const farmTime = algosdk.decodeUint64(data.slice(8, 16), 'mixed')
//   const claimed = algosdk.decodeUint64(data.slice(16, 24), 'mixed')

//   return { farmer, lpAmount, farmTime, claimed }
// }

// export const getFarmingState = async (farmingId: number, sender: string, signer: TransactionSigner) => {
//   const { farmingClient } = await createFryFarmingClient(signer, sender, farmingId)
//   const global = await farmingClient.getGlobalState()
//   return {
//     apr: global.apr?.asNumber(),
//     lpToken: global.lpToken?.asNumber(),
//     rewardToken: global.rewardToken?.asNumber(),
//     rewardAmount: global.rewardAmount?.asNumber(),
//     duration: global.duration?.asNumber(),
//     farmingStart: global.farmingStart?.asNumber(),
//     farmingEnd: global.farmingEnd?.asNumber(),
//     totalFarming: global.totalFarming?.asNumber(),
//   }
// }
