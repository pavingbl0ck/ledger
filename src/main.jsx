import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { WorkspaceProvider } from './lib/useWorkspace'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </React.StrictMode>
)
