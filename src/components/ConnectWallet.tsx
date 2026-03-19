import { Provider, useWallet } from '@txnlab/use-wallet'
import { Modal } from 'antd'
import Account from './Account'
import { useAuth } from '../hooks/useAuth'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { providers, activeAddress } = useWallet()
  const { clearAuth } = useAuth()

  const isKmd = (provider: Provider) => provider.metadata.name.toLowerCase() === 'kmd'

  // console.log(isKmd, 'testing is kmd')

  const handleOk = () => {
    closeModal()
  }
  return (
    <Modal open={openModal} onOk={handleOk} onCancel={closeModal} centered={true} width={415} footer={null} zIndex={10000}>
      <form method="dialog" className="relative modal-box bg-[var(--modal-bg)] max-w-md px-6 py-5 rounded-3xl">
        <div className="w-full flex flex-col items-center justify-center gap-6 mt-5">
          <h3 className="text-[var(--text-heading)] uppercase text-2xl text-center font-apex walletText">
            {activeAddress ? 'Wallet Is Connected' : 'Connect Your Wallet'}
          </h3>
          <img className="max-w-[106px] max-h-[80px] w-full h-full object-cover" src="/assets/logo.png" alt="fry-logo" />
          <img src="/assets/redLine.png" alt="redline" />
          <div className="grid mb-2 w-full">
            {activeAddress && (
              <>
                <Account />
                {/* <div className="divider" /> */}
              </>
            )}
            <div className="innerContent flex flex-col items-center gap-4 mt-4 ">
              {!activeAddress &&
                providers?.map((provider) => (
                  <button
                    data-test-id={`${provider.metadata.id}-connect`}
                    className="wltbtn py-3.5 px-6 bg-[var(--bg-secondary)] font-Roboto ex-small font-normal w-full flex justify-start items-center gap-5 border-solid border-2 border-[red]"
                    key={`provider-${provider.metadata.id}`}
                    onClick={() => {
                      return provider.connect()
                    }}
                  >
                    {!isKmd(provider) && (
                      <img
                        alt={`wallet_icon_${provider.metadata.id}`}
                        src={provider.metadata.icon}
                        style={{ objectFit: 'contain', width: '30px', height: 'auto' }}
                      />
                    )}
                    <span className="text-[var(--text-secondary)] font-Roboto">{isKmd(provider) ? 'LocalNet Wallet' : provider.metadata.name}</span>
                  </button>
                ))}
            </div>
          </div>

          <div className="modal-action !mt-0 ">
            {activeAddress && (
              <button
                className="bg-gradient-to-r from-[#FF9292] to-[#FD0000] text-white p-3"
                data-test-id="logout"
                onClick={() => {
                  clearAuth()
                  if (providers) {
                    const activeProvider = providers.find((p) => p.isActive)
                    if (activeProvider) {
                      activeProvider.disconnect()
                      // Clear stale WalletConnect sessions (Pera SDK bug on desktop)
                      Object.keys(localStorage)
                        .filter(k => k.startsWith('wc@') || k === 'walletconnect' || k === 'WALLETCONNECT_DEEPLINK_CHOICE')
                        .forEach(k => localStorage.removeItem(k))
                    } else {
                      // Required for logout/cleanup of inactive providers
                      // For instance, when you login to localnet wallet and switch network
                      // to testnet/mainnet or vice verse.
                      localStorage.removeItem('txnlab-use-wallet')
                      window.location.reload()
                    }
                  }
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  )
}
export default ConnectWallet
