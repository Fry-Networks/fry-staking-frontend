import { Icon } from '@iconify/react'
import { useWallet } from '@txnlab/use-wallet'
import { Drawer } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import ConnectWallet from '../ConnectWallet'
import Button from '../shared/button'
import Transact from '../Transact'

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [open, setOpen] = useState<boolean>(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [placement] = useState<'left'>('left')
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false);
  const [openDemoModal, setOpenDemoModal] = useState<boolean>(false);
  const { activeAddress } = useWallet();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleDropdown = () => setIsOpen((prev) => !prev)

  const showDrawer = () => setOpen(true)
  const onClose = () => setOpen(false)

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal);
    onClose()
  }

  return (
    <>
      <nav className="max-md:hidden max-xxxl:w-[95%] w-[80%] relative z-[4] m-auto pt-[27px]">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <NavLink to="/">
              <img src="../../assets/images/logo.svg" alt="Logo" className="w-[100px] h-[97px]" />
            </NavLink>
          </div>

          <ul className="md:flex space-x-10 max-xxl:space-x-5">
            <li className="uppercase large text-black font-bold font-apex">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `cursor-pointer p-[10px] uppercase ${isActive ? 'text-secondary border-solid border-b-2 border-[#DE0308]' : ''}`
                }
              >
                Swap
              </NavLink>
            </li>
            <li className="uppercase large text-black font-bold font-apex">
              <NavLink
                to="/stake"
                className={({ isActive }) =>
                  `cursor-pointer p-[10px] uppercase ${isActive ? 'text-secondary border-solid border-b-2 border-[#DE0308]' : ''}`
                }
              >
                Stake
              </NavLink>
            </li>
            <li className="uppercase large text-black font-bold font-apex">
              <NavLink
                to="/farm"
                className={({ isActive }) =>
                  `cursor-pointer p-[10px] uppercase ${isActive ? 'text-secondary border-solid border-b-2 border-[#DE0308]' : ''}`
                }
              >
                Farm
              </NavLink>
            </li>
            <li className="uppercase large text-black font-bold font-apex">
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `cursor-pointer p-[10px] uppercase ${isActive ? 'text-secondary border-solid border-b-2 border-[#DE0308]' : ''}`
                }
              >
                Profile
              </NavLink>
            </li>
          </ul>

          <div className="button flex items-center">
            {!activeAddress ? (
              <Button
                text="Connect Wallet"
                className="button btn-primary"
                height={53}
                width={186}
                onClick={() => toggleWalletModal()}
              />
            ) : (
              <div ref={dropdownRef} className="relative inline-block text-left" onClick={() => toggleWalletModal()} >
                <div
                  className="flex items-center justify-center gap-[10px] cursor-pointer w-[186px] h-[53px] rounded-[8px] p-[8px] border-solid border-[2px] border-red bg-transparent"
                  onClick={toggleDropdown}
                >
                  <p className="font-medium large text-darkRed capitalize">{activeAddress ? activeAddress.slice(0, 6) + "...." + activeAddress.slice(-6) : "Connect Wallet"}</p>
                  {/* <Icon
                    icon={isOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                    width={26}
                    height={26}
                    color="#F00"
                    className="sm-s:h-[22px] sm-s:w-[22px]"
                  /> */}
                </div>
                {/* {isOpen && (
                  <div className="absolute right-0 mt-2 w-[244px] bg-white rounded-[8px] shadow-lg z-10">
                    <ul className="py-1">
                      <p
                        className="elarge border-solid border-b-2 border-b-[#D9D9D9] font-medium text-text_clr py-[18px] pl-[19px] cursor-pointer"
                        onClick={() => {
                          navigate('/transaction-history')
                        }}
                      >
                        Transaction History
                      </p>

                      <p
                        className="elarge font-medium text-darkRed py-[18px] pl-[19px] cursor-pointer"
                        onClick={() => {
                          setWalletConnected(false)
                          setIsOpen(false)
                        }}
                      >
                        Disconnect
                      </p>
                    </ul>
                  </div>
                )} */}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="mobile-navbar w-[90%] m-auto hidden max-md:flex justify-between items-center pt-[20px]">
        <NavLink to="/">
          <img src="../../assets/logo.png" alt="Logo" className="w-[70px] h-[67px]" />
        </NavLink>

        <Icon icon="pajamas:hamburger" style={{ color: 'black' }} onClick={() => setOpen(!open)} width={22} className="cursor-pointer" />

        <Drawer placement={placement} closable={false} onClose={onClose} open={open} key={placement} width="80%" className="p-[30px]">
          <div className="flex justify-between items-center">
            <NavLink to="/">
              <img src="../../logo.png" alt="Logo" className="w-[55px] h-[45px] my-[10px] mx-[20px]" onClick={onClose} />
            </NavLink>
            <Icon
              color="black"
              icon="charm:cross"
              className="cursor-pointer"
              width={24}
              height={24}
              onClick={() => {
                setOpen(false)
              }}
            />
          </div>

          <ul className="flex flex-col space-y-9 p-[20px]">
            <li className="uppercase large text-black font-bold font-apex">
              <NavLink
                to="/"
                onClick={onClose}
                className={({ isActive }) =>
                  `cursor-pointer p-[10px] uppercase ${isActive ? 'text-secondary border-solid border-b-2 border-[#DE0308]' : ''}`
                }
              >
                Swap
              </NavLink>
            </li>
            <li className="uppercase large text-black font-bold font-apex">
              <NavLink
                to="/stake"
                onClick={onClose}
                className={({ isActive }) =>
                  `cursor-pointer p-[10px] uppercase ${isActive ? 'text-secondary border-solid border-b-2 border-[#DE0308]' : ''}`
                }
              >
                Stake
              </NavLink>
            </li>
            <li className="uppercase large text-black font-bold font-apex">
              <NavLink
                to="/farm"
                onClick={onClose}
                className={({ isActive }) =>
                  `cursor-pointer p-[10px] uppercase ${isActive ? 'text-secondary border-solid border-b-2 border-[#DE0308]' : ''}`
                }
              >
                Farm
              </NavLink>
            </li>
            <li className="uppercase large text-black font-bold font-apex">
              <NavLink
                to="/profile"
                onClick={onClose}
                className={({ isActive }) =>
                  `cursor-pointer p-[10px] uppercase ${isActive ? 'text-secondary border-solid border-b-2 border-[#DE0308]' : ''}`
                }
              >
                Profile
              </NavLink>
            </li>
          </ul>

          <div className="button flex items-center mt-[10px]">
            {!activeAddress ? (
              <Button
                text="Connect Wallet"
                className="button btn-primary"
                height={53}
                width={186}
                onClick={() => toggleWalletModal()}
              />
            ) : (
              <div ref={dropdownRef} className="relative inline-block text-left" onClick={() => toggleWalletModal()}>
                <div
                  className="flex items-center justify-center gap-[10px] cursor-pointer w-[186px] h-[53px] rounded-[8px] p-[8px] border-solid border-[2px] border-red bg-transparent"
                  onClick={toggleDropdown}
                >
                  <p className="font-medium large text-darkRed capitalize">{activeAddress ? activeAddress.slice(0, 6) + "...." + activeAddress.slice(-6) : "Connect Wallet"}</p>
                  {/* <Icon
                    icon={isOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                    width={26}
                    height={26}
                    color="#F00"
                    className="sm-s:h-[22px] sm-s:w-[22px]"
                  /> */}
                </div>
                {/* {isOpen && (
                  <div className="absolute right-[-35%] mt-2 w-[244px] bg-white rounded-[8px] shadow-lg z-10">
                    <ul className="py-1">
                      <p
                        className="elarge border-solid border-b-2 border-b-[#D9D9D9] font-medium text-text_clr py-[18px] pl-[19px] cursor-pointer"
                        onClick={() => {
                          navigate('/transaction-history')
                          onClose()
                        }}
                      >
                        Transaction History
                      </p>

                      <p
                        className="elarge font-medium text-darkRed py-[18px] pl-[19px] cursor-pointer"
                        onClick={() => {
                          setWalletConnected(false)
                          setIsOpen(false)
                        }}
                      >
                        Disconnect
                      </p>
                    </ul>
                  </div>
                )} */}
              </div>
            )}
          </div>
        </Drawer>
      </div>
      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      <Transact openModal={openDemoModal} setModalState={setOpenDemoModal} />
    </>
  )
}

export default Navbar
