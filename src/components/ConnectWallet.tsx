import { Provider, useWallet } from '@txnlab/use-wallet'
import { Modal } from 'antd'
import Account from './Account'
import { useAuth } from '../hooks/useAuth'
import { useChain } from '../context/ChainContext'
import { useMultiChainWallet } from '../hooks/useMultiChainWallet'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { providers } = useWallet()
  const { activeAddress, isKibisisAvailable, connectVoi, disconnectVoi } = useMultiChainWallet()
  const { clearAuth } = useAuth()
  const { chainId, activeChain } = useChain()
  const isAlgorand = chainId === 'algorand-mainnet'

  const isKmd = (provider: Provider) => provider.metadata.name.toLowerCase() === 'kmd'

  const handleOk = () => {
    closeModal()
  }

  const handleVoiConnect = async () => {
    try {
      await connectVoi()
    } catch (err: any) {
      console.error('Voi wallet connection failed:', err.message)
    }
  }

  const handleVoiDisconnect = () => {
    clearAuth()
    disconnectVoi()
  }

  const handleAlgorandLogout = () => {
    clearAuth()
    if (providers) {
      const activeProvider = providers.find((p) => p.isActive)
      if (activeProvider) {
        activeProvider.disconnect()
        Object.keys(localStorage)
          .filter(k => k.startsWith('wc@') || k === 'walletconnect' || k === 'WALLETCONNECT_DEEPLINK_CHOICE')
          .forEach(k => localStorage.removeItem(k))
      } else {
        localStorage.removeItem('txnlab-use-wallet')
        window.location.reload()
      }
    }
  }

  return (
    <Modal open={openModal} onOk={handleOk} onCancel={closeModal} centered={true} width={415} footer={null} zIndex={10000}>
      <form method="dialog" className="relative modal-box bg-[var(--modal-bg)] max-w-md px-6 py-5 rounded-3xl">
        <div className="w-full flex flex-col items-center justify-center gap-6 mt-5">
          <h3 className="text-[var(--text-heading)] uppercase text-2xl text-center font-apex walletText">
            {activeAddress ? 'Wallet Is Connected' : `Connect ${activeChain.displayName} Wallet`}
          </h3>
          <img className="max-w-[106px] max-h-[80px] w-full h-full object-cover" src="/assets/logo.png" alt="fry-logo" />
          <img src="/assets/redLine.png" alt="redline" />
          <div className="grid mb-2 w-full">
            {activeAddress && (
              <Account />
            )}
            <div className="innerContent flex flex-col items-center gap-4 mt-4">
              {/* Algorand wallets */}
              {isAlgorand && !activeAddress &&
                providers?.map((provider) => (
                  <button
                    data-test-id={`${provider.metadata.id}-connect`}
                    className="wltbtn py-3.5 px-6 bg-[var(--bg-secondary)] font-Roboto ex-small font-normal w-full flex justify-start items-center gap-5 border-solid border-2 border-[red]"
                    key={`provider-${provider.metadata.id}`}
                    onClick={() => provider.connect()}
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

              {/* Voi wallets */}
              {!isAlgorand && !activeAddress && (
                <>
                  {isKibisisAvailable ? (
                    <button
                      className="wltbtn py-3.5 px-6 bg-[var(--bg-secondary)] font-Roboto ex-small font-normal w-full flex justify-start items-center gap-5 border-solid border-2 border-[#8B5CF6]"
                      onClick={handleVoiConnect}
                    >
                      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                        <circle cx="15" cy="15" r="14" fill="#8B5CF6" />
                        <text x="15" y="20" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">K</text>
                      </svg>
                      <span className="text-[var(--text-secondary)] font-Roboto">Kibisis</span>
                    </button>
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-[var(--text-secondary)] mb-3">
                        Install a Voi wallet to connect
                      </p>
                      <a
                        href="https://kibis.is"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wltbtn py-3.5 px-6 bg-[var(--bg-secondary)] font-Roboto ex-small font-normal w-full flex justify-center items-center gap-3 border-solid border-2 border-[#8B5CF6]"
                      >
                        <span className="text-[#8B5CF6] font-Roboto">Get Kibisis Wallet</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M6 3L11 8L6 13" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="modal-action !mt-0">
            {activeAddress && isAlgorand && (
              <button
                className="bg-gradient-to-r from-[#FF9292] to-[#FD0000] text-white p-3"
                data-test-id="logout"
                onClick={handleAlgorandLogout}
              >
                Logout
              </button>
            )}
            {activeAddress && !isAlgorand && (
              <button
                className="bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6] text-white p-3"
                onClick={handleVoiDisconnect}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  )
}
export default ConnectWallet
