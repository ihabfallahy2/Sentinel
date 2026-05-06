import { Navigate, Route, Routes } from 'react-router-dom'
import { GlobalBoard } from './pages/GlobalBoard'
import { ProjectBoard } from './pages/ProjectBoard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GlobalBoard />} />
      <Route path="/b/:boardId" element={<ProjectBoard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
