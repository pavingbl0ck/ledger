import { createContext, useContext, useState, useEffect } from 'react'

const WorkspaceCtx = createContext(null)

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspaceState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ledger_workspace')) } catch { return null }
  })

  const setWorkspace = (ws) => {
    setWorkspaceState(ws)
    if (ws) sessionStorage.setItem('ledger_workspace', JSON.stringify(ws))
    else sessionStorage.removeItem('ledger_workspace')
  }

  return (
    <WorkspaceCtx.Provider value={{ workspace, setWorkspace }}>
      {children}
    </WorkspaceCtx.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceCtx)
}
