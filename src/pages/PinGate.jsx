import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hashPin, verifyPin, DEFAULT_CATS } from '../lib/utils'
import { useWorkspace } from '../lib/useWorkspace'

const S = {
  page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f8f6', padding:'1rem' },
  card: { background:'#fff', borderRadius:16, padding:'2.5rem 2rem', width:'100%', maxWidth:420, boxShadow:'0 4px 32px rgba(0,0,0,.08)' },
  logo: { fontWeight:800, fontSize:26, color:'#1a1a1a', marginBottom:4 },
  sub:  { fontSize:13, color:'#888', marginBottom:'2rem' },
  label:{ fontSize:12, fontWeight:600, color:'#555', marginBottom:5, display:'block' },
  input:{ width:'100%', padding:'10px 12px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', marginBottom:12, letterSpacing:4 },
  inputText:{ letterSpacing:'normal' },
  btn:  { width:'100%', padding:'11px', background:'#1a1a1a', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:8, fontFamily:'inherit' },
  btn2: { width:'100%', padding:'11px', background:'transparent', color:'#1a1a1a', border:'1px solid #ddd', borderRadius:8, fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  err:  { background:'#fff0ed', color:'#993c1d', padding:'8px 12px', borderRadius:6, fontSize:12, marginBottom:12 },
  tabs: { display:'flex', marginBottom:'1.5rem', gap:4 },
  tab:  { flex:1, padding:'8px', border:'1px solid #e0e0e0', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:'inherit', background:'none', color:'#888' },
  tabOn:{ flex:1, padding:'8px', border:'1px solid #1a1a1a', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:'inherit', background:'#1a1a1a', color:'#fff', fontWeight:600 },
}

export function PinGate() {
  const [mode, setMode] = useState('enter')  // 'enter' | 'create'
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const navigate = useNavigate()
  const { setWorkspace } = useWorkspace()

  async function handleEnter(e) {
    e.preventDefault()
    if (pin.length < 4) { setErr('PIN must be at least 4 digits'); return }
    setLoading(true); setErr('')
    try {
      const { data: workspaces } = await supabase.from('workspaces').select('*')
      let found = null
      for (const ws of (workspaces || [])) {
        if (await verifyPin(pin, ws.pin_hash)) { found = ws; break }
      }
      if (!found) { setErr('Incorrect PIN or workspace not found'); setLoading(false); return }
      setWorkspace(found)
      navigate('/dashboard')
    } catch (ex) { setErr('Connection error: ' + ex.message) }
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) { setErr('Workspace name is required'); return }
    if (pin.length < 4) { setErr('PIN must be at least 4 digits'); return }
    setLoading(true); setErr('')
    try {
      const pin_hash = await hashPin(pin)
      const { data, error } = await supabase.from('workspaces').insert({
        name: name.trim(), pin_hash, owner_label: owner.trim() || name.trim()
      }).select().single()
      if (error) throw error

      // Seed default categories
      const cats = DEFAULT_CATS.map(n => ({ workspace_id: data.id, name: n }))
      await supabase.from('categories').insert(cats)

      setWorkspace(data)
      navigate('/dashboard')
    } catch (ex) { setErr('Error: ' + ex.message) }
    setLoading(false)
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>Ledger</div>
        <div style={S.sub}>Multi-bank personal finance tracker</div>

        <div style={S.tabs}>
          <button style={mode==='enter'?S.tabOn:S.tab} onClick={()=>{setMode('enter');setErr('')}}>Enter workspace</button>
          <button style={mode==='create'?S.tabOn:S.tab} onClick={()=>{setMode('create');setErr('')}}>Create new</button>
        </div>

        {err && <div style={S.err}>{err}</div>}

        {mode === 'enter' ? (
          <form onSubmit={handleEnter}>
            <label style={S.label}>Workspace PIN</label>
            <input style={S.input} type="password" inputMode="numeric" placeholder="• • • • • •"
              value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))}
              maxLength={8} autoFocus />
            <button style={S.btn} type="submit" disabled={loading}>{loading ? 'Verifying…' : 'Enter'}</button>
          </form>
        ) : (
          <form onSubmit={handleCreate}>
            <label style={S.label}>Workspace name</label>
            <input style={{...S.input,...S.inputText}} type="text" placeholder="e.g. Mie Joeng Harding 2026"
              value={name} onChange={e=>setName(e.target.value)} autoFocus />
            <label style={S.label}>Your name (optional)</label>
            <input style={{...S.input,...S.inputText}} type="text" placeholder="e.g. Mie Joeng Harding"
              value={owner} onChange={e=>setOwner(e.target.value)} />
            <label style={S.label}>Create PIN (4–8 digits)</label>
            <input style={S.input} type="password" inputMode="numeric" placeholder="• • • • • •"
              value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))}
              maxLength={8} />
            <button style={S.btn} type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create workspace'}</button>
          </form>
        )}

        <div style={{marginTop:'1.5rem', fontSize:11, color:'#bbb', textAlign:'center', lineHeight:1.6}}>
          Each workspace is PIN-protected and isolated.<br/>
          Share your PIN with collaborators to give access.
        </div>
      </div>
    </div>
  )
}
