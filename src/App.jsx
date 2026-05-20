import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PinGate } from './pages/PinGate'
import { Dashboard } from './pages/Dashboard'
import { useWorkspace } from './lib/useWorkspace'

function ProtectedRoute({ children }) {
  const { workspace } = useWorkspace()
  if (!workspace) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PinGate />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}
