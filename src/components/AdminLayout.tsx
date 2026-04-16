import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import { AppStoreInitializer } from '../store/useAppStoreInit'

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <AppStoreInitializer />
      <Outlet />
      <BottomNav />
    </div>
  )
}
