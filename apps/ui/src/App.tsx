import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { BoardsHomePage } from './pages/BoardsHomePage'
import { ProjectBoard } from './pages/ProjectBoard'
import { SettingsPage } from './pages/SettingsPage'
import { SystemPage } from './pages/SystemPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<BoardsHomePage />} />
        <Route path="b/:boardId" element={<ProjectBoard />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
