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

  const handleKibisisConnect = async () => {
    try {
      await connectVoi()
    } catch (err: any) {
      console.error('Kibisis connection failed:', err.message)
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
              {isAlgorand && !activeAddress && (
                <>
                  {providers?.map((provider) => (
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
                  {isKibisisAvailable && (
                    <button
                      className="wltbtn py-3.5 px-6 bg-[var(--bg-secondary)] font-Roboto ex-small font-normal w-full flex justify-start items-center gap-5 border-solid border-2 border-[red]"
                      onClick={handleKibisisConnect}
                    >
                      <svg width="30" height="30" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="256" height="256" rx="48" fill="#6C3FC5"/>
                        <path d="M88 56L128 128L88 200H120L160 128L120 56H88Z" fill="white"/>
                        <path d="M136 56L176 128L136 200H168L208 128L168 56H136Z" fill="white" opacity="0.6"/>
                      </svg>
                      <span className="text-[var(--text-secondary)] font-Roboto">Kibisis</span>
                    </button>
                  )}
                </>
              )}

              {/* Voi wallets */}
              {!isAlgorand && !activeAddress && (
                <>
                  <button
                    className="wltbtn py-3.5 px-6 bg-[var(--bg-secondary)] font-Roboto ex-small font-normal w-full flex justify-start items-center gap-5 border-solid border-2 border-[#8B5CF6]"
                    onClick={handleKibisisConnect}
                  >
                    <svg width="30" height="30" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="256" height="256" rx="48" fill="#6C3FC5"/>
                      <path d="M88 56L128 128L88 200H120L160 128L120 56H88Z" fill="white"/>
                      <path d="M136 56L176 128L136 200H168L208 128L168 56H136Z" fill="white" opacity="0.6"/>
                    </svg>
                    <span className="text-[var(--text-secondary)] font-Roboto">Kibisis</span>
                  </button>
                  <a
                    href="https://lute.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wltbtn py-3.5 px-6 bg-[var(--bg-secondary)] font-Roboto ex-small font-normal w-full flex justify-start items-center gap-5 border-solid border-2 border-[#8B5CF6]"
                  >
                    <svg width="30" height="30" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="256" height="256" rx="40" fill="#2D1B69"/>
                      <ellipse cx="128" cy="155" rx="45" ry="55" fill="#E8A838"/>
                      <rect x="118" y="60" width="20" height="100" rx="4" fill="#E8A838"/>
                      <line x1="108" y1="70" x2="148" y2="70" stroke="#E8A838" strokeWidth="8" strokeLinecap="round"/>
                      <line x1="108" y1="85" x2="148" y2="85" stroke="#E8A838" strokeWidth="6" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[var(--text-secondary)] font-Roboto">Lute (Web Wallet)</span>
                  </a>
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
