import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import AdminDashboard from './adminDashboard/admindashboard'
import AdminDashboardoutlet from './adminDashboard/dashboardoutlet'
import Farming from './adminDashboard/Farming/farming'
import FarmingStatistics from './adminDashboard/Farming/farmingStatistics'
import Home from './adminDashboard/Home/home'
import GeneralSetting from './adminDashboard/Settings/generalSetting'
import ProfileSetting from './adminDashboard/Settings/profileSetting'
import Settings from './adminDashboard/Settings/settings'
import Staking from './adminDashboard/Staking/staking'
import StakingStatistics from './adminDashboard/Staking/stakingStatistics'
import UserDetail from './adminDashboard/Users/userDetail/userDetail'
import UserDetailFarming from './adminDashboard/Users/userDetail/userDetailFarming'
import UserDetailStaking from './adminDashboard/Users/userDetail/userDetailStaking'
import Users from './adminDashboard/Users/users'
import UserDetailTransactionHistory from './adminDashboard/Users/userTransactionHistory/userDetailTransactionHistory'
import IntegrationTesting from "./Integration-testing"
import AdminLogin from './pages/adminLogin'
import Farm from './pages/farm'
import FarmPoolStats from './pages/farmPoolStats'
import Profile from './pages/profile'
import Stake from './pages/stake'
import StakePoolStats from './pages/stakePoolStats'
import Swap from './pages/swap'
import TransactionHistory from './pages/transactionHistory'

const AppLayout = () => {
  return (
    <>
      <RouterProvider router={appRouter} />
    </>
  )
}

const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <Swap />,
  },
  {
    path: '/stake',
    element: <Stake />,
  },
  {
    path: '/farm',
    element: <Farm />,
  },
  {
    path: '/profile',
    element: <Profile />,
  },
  {
    path: '/stake-pool-stats',
    element: <StakePoolStats />,
  },
  {
    path: '/farm-pool-stats',
    element: <FarmPoolStats />,
  },
  {
    path: '/transaction-history',
    element: <TransactionHistory />,
  },
  {
    path: '/admin-login',
    element: <AdminLogin />,
  },
  {
    path: '/admin',
    element: <AdminDashboard />,
    children: [
      {
        path: '/admin/dashboard',
        element: <AdminDashboardoutlet />,
        children: [
          {
            index: true,
            element: <Home />,
          },
        ],
      },
      {
        path: '/admin/users',
        element: <Users />,
      },
      {
        path: '/admin/user-detail',
        element: <UserDetail />,
        children: [
          {
            path: 'staking',
            element: <UserDetailStaking />,
          },
          {
            path: 'farming',
            element: <UserDetailFarming />,
          },
        ],
      },
      {
        path: '/admin/user-transactions-history',
        element: <UserDetailTransactionHistory />,
      },
      {
        path: '/admin/staking',
        element: <Staking />,
      },
      {
        path: '/admin/staking-statistics',
        element: <StakingStatistics />,
      },
      {
        path: '/admin/farming',
        element: <Farming />,
      },
      {
        path: '/admin/farming-statistics',
        element: <FarmingStatistics />,
      },
      {
        path: '/admin/setting',
        element: <Settings />,
        children: [
          {
            path: 'profile',
            element: <ProfileSetting />,
          },
          {
            path: 'general',
            element: <GeneralSetting />,
          },
        ],
      },
    ],
  },
  {
    path: '/integration',
    element: <IntegrationTesting />,
  },
])

export default AppLayout
