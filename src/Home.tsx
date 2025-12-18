import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import AdminDashboard from './adminDashboard/admindashboard'
import AdminDashboardoutlet from './adminDashboard/dashboardoutlet'
import Farming from './adminDashboard/Farming/farming'
// import FarmingStatistics from './adminDashboard/Farming/farmingStatistics'
import Home from './adminDashboard/Home/home'
import GeneralSetting from './adminDashboard/Settings/generalSetting'
import ProfileSetting from './adminDashboard/Settings/profileSetting'
import Settings from './adminDashboard/Settings/settings'
// import Staking from './adminDashboard/Staking/staking'
// import StakingStatistics from './adminDashboard/Staking/stakingStatistics'
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
const AppNew = () => {
  return (
    <>
      <Outlet />
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
    path: '/',
    element: <AdminDashboard />,
    children: [
      {
        path: '/admin-dashboard',
        element: <AdminDashboardoutlet />,
        children: [
          {
            path: '/admin-dashboard',
            element: <Home />,
          },
        ],
      },
      {
        path: '/users',
        element: <Users />,
      },
      {
        path: '/user-detail',
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
        path: '/user-transactions-history',
        element: <UserDetailTransactionHistory />,
      },
      // {
      //   path: '/staking',
      //   element: <Staking />,
      // },
      // {
      //   path: '/staking-statistics',
      //   element: <StakingStatistics />,
      // },
      // {
      //   path: '/farming',
      //   element: <Farming />,
      // },
      // {
      //   path: '/farming-statistics',
      //   element: <FarmingStatistics />,
      // },
      {
        path: '/setting',
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
