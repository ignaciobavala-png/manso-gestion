import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import Background from './Background'
import { AppStoreInitializer } from '../store/useAppStoreInit'

export default function AdminLayout() {
  return (
    <Background>
      <AppStoreInitializer />
      <Outlet />
      <BottomNav />
    </Background>
  )
}
