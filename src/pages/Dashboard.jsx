import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/useWorkspace'
import { fmt, fmts, MONTH_NAMES } from '../lib/utils'
import { ImportModal } from '../components/ImportModal'
import { ExportModal } from '../components/ExportModal'

// ── Styles ────────────────────────────────────────────────────────────────────
const c = {
  page:   { minHeight:'100vh', background:'#f8f8f6' },
  nav:    { background:'#1a1a1a', padding:'0 1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between', height:52 },
  navL:   { color:'#fff', fontWeight:800, fontSize:18, letterSpacing:'-.5px' },
  navR:   { display:'flex', gap:8, alignItems:'center' },
  navBtn: { padding:'5px 12px', background:'transparent', color:'#aaa', border:'1px solid #444', borderRadius:7, fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  main:   { maxWidth:1300, margin:'0 auto', padding:'1.25rem' },
  metrics:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:'1.25rem' },
  mc:     { background:'#fff', borderRadius:10, padding:'12px 14px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' },
  ml:     { fontSize:11, color:'#999', marginBottom:3 },
  mv:     { fontSize:18, fontWeight:700 },
  tabs:   { display:'flex', gap:4, marginBottom:'1rem', flexWrap:'wrap' },
  tab:    { padding:'5px 14px', fontSize:12, borderRadius:7, cursor:'pointer', border:'1px solid transparent', color:'#888', background:'none', fontFamily:'inherit' },
  tabOn:  { padding:'5px 14px', fontSize:12, borderRadius:7, cursor:'pointer', border:'1px solid #ddd', background:'#fff', color:'#1a1a1a', fontWeight:600, fontFamily:'inherit' },
  toolbar:{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' },
  fsel:   { fontSize:12, padding:'4px 8px', border:'1px solid #e0e0e0', borderRadius:7, background:'#fff', fontFamily:'inherit', cursor:'pointer' },
  tblWrap:{ overflowX:'auto', borderRadius:10, boxShadow:'0 1px 4px rgba(0,0,0,.05)' },
  tbl:    { width:'100%', borderCollapse:'collapse', fontSize:12, background:'#fff' },
  th:     { padding:'6px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'#999', borderBottom:'1px solid #f0f0f0', background:'#fafaf8', whiteSpace:'nowrap' },
  td:     { padding:'0', borderBottom:'1px solid #f8f8f6', verticalAlign:'middle' },
  divRow: { background:'#1a1a1a', color:'#fff', fontSize:11, fontWeight:700 },
  inp:    { width:'100%', padding:'5px 8px', border:'1px solid #e0e0e0', borderRadius:6, fontSize:11, fontFamily:'inherit', background:'#fff', outline:'none' },
  inpFoc: { borderColor:'#378add' },
  sel:    { width:'100%', padding:'4px 6px', border:'1px solid #e0e0e0', borderRadius:6, fontSize:11, fontFamily:'inherit', background:'#fff', cursor:'pointer', outline:'none' },
  note:   { width:'100%', padding:'4px 6px', border:'1px solid #e0e0e0', borderRadius:6, fontSize:11, fontFamily:'inherit', background:'#fff', resize:'none', height:28, outline:'none' },
  btn:    (bg='#1a1a1a',fg='#fff',bd=null) => ({ padding:'5px 12px', background:bg, color:fg, border:`1px solid ${bd||bg}`, borderRadius:7, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600, whiteSpace:'nowrap' }),
  topbtn: { padding:'6px 13px', background:'#fff', color:'#1a1a1a', border:'1px solid #ddd', borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600, display:'flex', alignItems:'center', gap:5 },
  pdbbtn: { padding:'6px 13px', background:'#0f6e56', color:'#fff', border:'1px solid #0f6e56', borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600, display:'flex', alignItems:'center', gap:5 },
  avgTbl: { width:'100%', borderCollapse:'collapse', fontSize:12, background:'#fff', borderRadius:10, overflow:'hidden' },
  sumgrid:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:'1.25rem' },
  sc:     { background:'#fff', border:'1px solid #f0f0f0', borderRadius:10, padding:'10px 14px' },
  sbar:   { height:4, borderRadius:2, background:'#f0f0f0', marginTop:6, overflow:'hidden' },
}

export function Dashboard() {
  const { workspace, setWorkspace } = useWorkspace()
  const navigate = useNavigate()

  const [txns, setTxns]       = useState([])
  const [cats, setCats]       = useState([])
  const [loading, setLoading] = useState(true)
  const [curMo, setCurMo]     = useState('all')
  const [curBank, setCurBank] = useState('all')
  const [filterCat, setFilterCat] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [activeTab, setActiveTab] = useState('txn')
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [saving, setSaving]   = useState({})   // id -> true while saving

  const wsId = workspace?.id

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('transactions').select('*').eq('workspace_id', wsId).order('year').order('month').order('date'),
      supabase.from('categories').select('*').eq('workspace_id', wsId).order('name'),
    ])
    setTxns(t || [])
    setCats(c || [])
    setLoading(false)
  }, [wsId])

  useEffect(() => { load() }, [load])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const months = [...new Set(txns.map(t => `${t.month} ${t.year}`))].sort((a,b)=>{
    const mo=MONTH_NAMES; const [am,ay]=a.split(' '), [bm,by]=b.split(' ')
    return (+ay - +by)||(mo.indexOf(am)-mo.indexOf(bm))
  })
  const banks = [...new Set(txns.map(t => t.bank_name))].sort()
  const catNames = cats.map(c => c.name)

  const filtered = txns.filter(t => {
    if (curMo !== 'all' && `${t.month} ${t.year}` !== curMo) return false
    if (curBank !== 'all' && t.bank_name !== curBank) return false
    if (filterCat !== 'all' && t.category_name !== filterCat) return false
    if (filterType !== 'all' && t.type !== filterType) return false
    return true
  })

  const totalCR = filtered.filter(t=>t.type==='CR').reduce((s,t)=>s+Number(t.amount),0)
  const totalDB = filtered.filter(t=>t.type==='DB').reduce((s,t)=>s+Number(t.amount),0)

  // ── Inline edit ─────────────────────────────────────────────────────────────
  async function saveField(id, field, value) {
    setSaving(s => ({...s, [id]: true}))
    setTxns(prev => prev.map(t => t.id===id ? {...t, [field]:value} : t))
    await supabase.from('transactions').update({ [field]: value }).eq('id', id)
    setSaving(s => { const n={...s}; delete n[id]; return n })
  }

  async function deleteRow(id) {
    if (!confirm('Delete this transaction?')) return
    setTxns(prev => prev.filter(t => t.id !== id))
    await supabase.from('transactions').delete().eq('id', id)
  }

  async function addManualRow() {
    const now = new Date()
    const month = MONTH_NAMES[now.getMonth()]
    const year = now.getFullYear()
    const { data } = await supabase.from('transactions').insert({
      workspace_id: wsId, bank_name: banks[0] || 'Bank',
      account_no: '', month, year,
      date: '', description: 'New transaction',
      type: 'DB', amount: 0,
      category_name: 'Uncategorized', note: '',
    }).select().single()
    if (data) setTxns(prev => [...prev, data])
  }

  // ── Category management ─────────────────────────────────────────────────────
  async function addCat(name) {
    if (!name.trim() || catNames.includes(name.trim())) return
    const { data } = await supabase.from('categories').insert({ workspace_id: wsId, name: name.trim() }).select().single()
    if (data) setCats(prev => [...prev, data])
  }
  async function deleteCat(id, name) {
    if (!confirm(`Remove "${name}"? Transactions will be set to Uncategorized.`)) return
    await supabase.from('transactions').update({ category_name: 'Uncategorized' }).eq('workspace_id', wsId).eq('category_name', name)
    await supabase.from('categories').delete().eq('id', id)
    setTxns(prev => prev.map(t => t.category_name===name ? {...t, category_name:'Uncategorized'} : t))
    setCats(prev => prev.filter(c => c.id !== id))
  }

  function logout() { setWorkspace(null); navigate('/') }

  // ── Render helpers ──────────────────────────────────────────────────────────
  function Cell({ children, style }) { return <td style={{ ...c.td, ...style }}><div style={{ padding:'4px 8px' }}>{children}</div></td> }

  function TxnRow({ t }) {
    const isSaving = saving[t.id]
    return (
      <tr style={{ opacity: isSaving?0.6:1 }}>
        <Cell><input style={c.inp} defaultValue={t.date} onBlur={e=>saveField(t.id,'date',e.target.value)} /></Cell>
        <Cell><input style={c.inp} defaultValue={t.month+' '+t.year} onBlur={e=>{
          const parts = e.target.value.trim().split(' ')
          if(parts.length===2 && MONTH_NAMES.includes(parts[0]) && !isNaN(parts[1])) {
            saveField(t.id,'month',parts[0]); saveField(t.id,'year',parseInt(parts[1]))
          }
        }} /></Cell>
        <Cell style={{ maxWidth:130 }}><input style={c.inp} defaultValue={t.bank_name} onBlur={e=>saveField(t.id,'bank_name',e.target.value)} /></Cell>
        <Cell style={{ minWidth:220 }}><input style={c.inp} defaultValue={t.description} onBlur={e=>saveField(t.id,'description',e.target.value)} /></Cell>
        <Cell>
          <select style={c.sel} value={t.category_name} onChange={e=>saveField(t.id,'category_name',e.target.value)}>
            {catNames.map(cn => <option key={cn}>{cn}</option>)}
          </select>
        </Cell>
        <Cell>
          <select style={{...c.sel,width:52}} value={t.type} onChange={e=>saveField(t.id,'type',e.target.value)}>
            <option>DB</option><option>CR</option>
          </select>
        </Cell>
        <Cell>
          <input style={{...c.inp,textAlign:'right'}} type="number" defaultValue={t.amount}
            onBlur={e=>saveField(t.id,'amount',parseFloat(e.target.value)||0)} />
        </Cell>
        <Cell style={{ minWidth:120 }}>
          <textarea style={c.note} defaultValue={t.note}
            onBlur={e=>saveField(t.id,'note',e.target.value)}
            onFocus={e=>{e.target.style.height='50px'}}
            placeholder="Note…" />
        </Cell>
        <Cell><button style={c.btn('#fff','#993c1d','#993c1d')} onClick={()=>deleteRow(t.id)}>✕</button></Cell>
      </tr>
    )
  }

  // ── Grouped by month rows ────────────────────────────────────────────────────
  function renderTxnRows() {
    const showDiv = curMo==='all' && curBank==='all' && filterCat==='all' && filterType==='all'
    let lastMo = null
    const rows = []
    for (const t of filtered) {
      const mo = `${t.month} ${t.year}`
      if (showDiv && mo !== lastMo) {
        const mTxns = txns.filter(x=>`${x.month} ${x.year}`===mo)
        const mCr = mTxns.filter(x=>x.type==='CR').reduce((s,x)=>s+Number(x.amount),0)
        const mDb = mTxns.filter(x=>x.type==='DB').reduce((s,x)=>s+Number(x.amount),0)
        const mBanks = [...new Set(mTxns.map(x=>x.bank_name))].join(', ')
        rows.push(
          <tr key={'div-'+mo} style={c.divRow}>
            <td colSpan={9} style={{ padding:'6px 10px', fontSize:11 }}>
              <span style={{ fontWeight:800 }}>{mo}</span>
              <span style={{ marginLeft:16, fontWeight:400, color:'#aaa', fontSize:10 }}>
                {mBanks} &nbsp;·&nbsp; In: +{fmts(mCr)} &nbsp;·&nbsp; Out: −{fmts(mDb)} &nbsp;·&nbsp; Closing: {fmts(mCr-mDb+(MONTH_NAMES.indexOf(t.month)>=0?0:0))}
              </span>
            </td>
          </tr>
        )
        lastMo = mo
      }
      rows.push(<TxnRow key={t.id} t={t} />)
    }
    return rows
  }

  // ── Summary tab ─────────────────────────────────────────────────────────────
  function renderSummary() {
    const scope = curMo==='all' ? txns : txns.filter(t=>`${t.month} ${t.year}`===curMo)
    const bycat = {}
    scope.forEach(t => {
      if(!bycat[t.category_name]) bycat[t.category_name]={db:0,cr:0}
      if(t.type==='DB') bycat[t.category_name].db+=Number(t.amount)
      else bycat[t.category_name].cr+=Number(t.amount)
    })
    const outEntries = Object.entries(bycat).filter(([,v])=>v.db>0).sort((a,b)=>b[1].db-a[1].db)
    const inEntries  = Object.entries(bycat).filter(([,v])=>v.cr>0).sort((a,b)=>b[1].cr-a[1].cr)
    const maxOut = outEntries[0]?.[1].db || 1, maxIn = inEntries[0]?.[1].cr || 1
    return (
      <>
        <div style={{ ...c.sumgrid }}>
          {outEntries.map(([cat,v]) => (
            <div key={cat} style={c.sc}>
              <div style={{ fontSize:10, color:'#999' }}>{cat}</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#993c1d' }}>− {fmts(v.db)}</div>
              <div style={c.sbar}><div style={{ height:'100%', width:`${(v.db/maxOut*100).toFixed(1)}%`, background:'#d85a30', borderRadius:2 }} /></div>
            </div>
          ))}
        </div>
        {inEntries.length>0 && <>
          <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:8 }}>Incoming</div>
          <div style={c.sumgrid}>
            {inEntries.map(([cat,v]) => (
              <div key={cat} style={c.sc}>
                <div style={{ fontSize:10, color:'#999' }}>{cat}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f6e56' }}>+ {fmts(v.cr)}</div>
                <div style={c.sbar}><div style={{ height:'100%', width:`${(v.cr/maxIn*100).toFixed(1)}%`, background:'#1d9e75', borderRadius:2 }} /></div>
              </div>
            ))}
          </div>
        </>}
      </>
    )
  }

  // ── Rata-rata tab ────────────────────────────────────────────────────────────
  function renderAvg() {
    const cm = {}
    txns.filter(t=>t.type==='DB').forEach(t=>{
      const mo=`${t.month} ${t.year}`
      if(!cm[t.category_name]) cm[t.category_name]={}
      cm[t.category_name][mo]=(cm[t.category_name][mo]||0)+Number(t.amount)
    })
    const n = months.length || 1
    const rows = Object.entries(cm).map(([cat,bm])=>{
      const vals=months.map(mo=>bm[mo]||0); const tot=vals.reduce((a,b)=>a+b,0)
      return {cat,vals,tot,avg:tot/n}
    }).sort((a,b)=>b.tot-a.tot)
    const totC=months.map((_,i)=>rows.reduce((s,r)=>s+r.vals[i],0)), grand=totC.reduce((a,b)=>a+b,0)
    const th = { padding:'5px 8px', textAlign:'left', fontSize:10, fontWeight:700, color:'#fff', background:'#1a1a1a', whiteSpace:'nowrap' }
    const td = (align='left',bold=false,color='#1a1a1a') => ({ padding:'4px 8px', textAlign:align, fontSize:11, fontWeight:bold?700:400, color, borderBottom:'1px solid #f5f5f3', whiteSpace:'nowrap' })
    return (
      <div style={{ overflowX:'auto', borderRadius:10, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={c.avgTbl}>
          <thead>
            <tr>
              <th style={th}>Category</th>
              {months.map(m=><th key={m} style={{...th,textAlign:'right'}}>{m}</th>)}
              <th style={{...th,textAlign:'right',background:'#2c2c2c'}}>YTD Total</th>
              <th style={{...th,textAlign:'right',background:'#0f6e56'}}>Rata-rata/mo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.cat}>
                <td style={td()}>{r.cat}</td>
                {r.vals.map((v,i)=><td key={i} style={td('right',false,v>0?'#1a1a1a':'#ccc')}>{v>0?fmts(v):'—'}</td>)}
                <td style={td('right',true,'#993c1d')}>{fmts(r.tot)}</td>
                <td style={td('right',true,'#0f6e56')}>{fmts(r.avg)}</td>
              </tr>
            ))}
            <tr style={{ background:'#f5f5f3' }}>
              <td style={{...td(),fontWeight:700}}>TOTAL</td>
              {totC.map((v,i)=><td key={i} style={td('right',true,'#993c1d')}>{fmts(v)}</td>)}
              <td style={td('right',true,'#993c1d')}>{fmts(grand)}</td>
              <td style={td('right',true,'#0f6e56')}>{fmts(grand/n)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // ── Categories tab ──────────────────────────────────────────────────────────
  function renderCats() {
    const [newCat, setNewCat] = React.useState('')
    return (
      <div style={{ maxWidth:560 }}>
        <div style={{ background:'#fff', borderRadius:10, padding:'1rem', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:'1rem' }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Manage categories</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
            {cats.map(cat => (
              <div key={cat.id} style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', background:'#f5f5f3', border:'1px solid #e5e5e5', borderRadius:20, fontSize:12 }}>
                {cat.name}
                {cat.name !== 'Uncategorized' &&
                  <button onClick={()=>deleteCat(cat.id,cat.name)} style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb', fontSize:14, padding:0, lineHeight:1 }}>×</button>}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input style={{ ...c.inp, flex:1 }} placeholder="New category name…" value={newCat}
              onChange={e=>setNewCat(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'){addCat(newCat);setNewCat('')} }} />
            <button style={c.btn('#0f6e56')} onClick={()=>{addCat(newCat);setNewCat('')}}>+ Add</button>
          </div>
        </div>
        <div style={{ fontSize:11, color:'#999', lineHeight:1.7 }}>
          Categories are shared across all months and banks in this workspace. Deleting a category resets affected transactions to Uncategorized.
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#999', fontSize:14 }}>Loading workspace…</div>

  return (
    <div style={c.page}>
      {/* Nav */}
      <nav style={c.nav}>
        <span style={c.navL}>Ledger</span>
        <div style={c.navR}>
          <span style={{ color:'#aaa', fontSize:12 }}>{workspace.owner_label || workspace.name}</span>
          <button style={c.navBtn} onClick={()=>setShowImport(true)}>+ Import statement</button>
          <button style={{ ...c.navBtn, background:'#0f6e56', borderColor:'#0f6e56', color:'#fff' }} onClick={()=>setShowExport(true)}>Export PDF</button>
          <button style={c.navBtn} onClick={logout}>Exit</button>
        </div>
      </nav>

      <div style={c.main}>
        {/* Metrics */}
        <div style={c.metrics}>
          <div style={c.mc}><div style={c.ml}>Transactions</div><div style={c.mv}>{filtered.length}</div></div>
          <div style={c.mc}><div style={c.ml}>Banks</div><div style={c.mv}>{banks.length || 1}</div></div>
          <div style={c.mc}><div style={c.ml}>Total in</div><div style={{ ...c.mv, color:'#0f6e56' }}>+ {fmts(totalCR)}</div></div>
          <div style={c.mc}><div style={c.ml}>Total out</div><div style={{ ...c.mv, color:'#993c1d' }}>− {fmts(totalDB)}</div></div>
          <div style={c.mc}><div style={c.ml}>Net</div><div style={{ ...c.mv, color:(totalCR-totalDB)>=0?'#0f6e56':'#993c1d' }}>{totalCR-totalDB>=0?'+':''}{fmts(totalCR-totalDB)}</div></div>
        </div>

        {/* Tabs */}
        <div style={c.tabs}>
          {[['txn','Transactions'],['sum','Summary'],['avg','Rata-rata'],['cats','Categories']].map(([k,l]) => (
            <button key={k} style={activeTab===k?c.tabOn:c.tab} onClick={()=>setActiveTab(k)}>{l}</button>
          ))}
        </div>

        {/* Transactions tab */}
        {activeTab==='txn' && <>
          <div style={c.toolbar}>
            {/* Month pills */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {['all',...months].map(m=>(
                <button key={m} onClick={()=>setCurMo(m)}
                  style={{ padding:'3px 10px', fontSize:11, borderRadius:20, border:`1px solid ${curMo===m?'#1a1a1a':'#ddd'}`, background:curMo===m?'#1a1a1a':'#fff', color:curMo===m?'#fff':'#888', cursor:'pointer', fontFamily:'inherit' }}>
                  {m==='all'?'All':m}
                </button>
              ))}
            </div>
            <select style={c.fsel} value={curBank} onChange={e=>setCurBank(e.target.value)}>
              <option value="all">All banks</option>
              {banks.map(b=><option key={b}>{b}</option>)}
            </select>
            <select style={c.fsel} value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="all">All types</option>
              <option value="DB">Outgoing</option>
              <option value="CR">Incoming</option>
            </select>
            <select style={c.fsel} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="all">All categories</option>
              {catNames.map(n=><option key={n}>{n}</option>)}
            </select>
          </div>

          {txns.length === 0 ? (
            <div style={{ background:'#fff', borderRadius:12, padding:'3rem', textAlign:'center', color:'#aaa' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📂</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#555', marginBottom:6 }}>No transactions yet</div>
              <div style={{ fontSize:13, marginBottom:20 }}>Import a bank statement to get started</div>
              <button style={{ ...c.btn(), padding:'10px 24px', fontSize:14 }} onClick={()=>setShowImport(true)}>Import statement</button>
            </div>
          ) : (
            <>
              <div style={c.tblWrap}>
                <table style={c.tbl}>
                  <thead>
                    <tr>
                      {['Date','Period','Bank','Description','Category','Type','Amount','Note',''].map(h=>(
                        <th key={h} style={c.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {renderTxnRows()}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                <span style={{ fontSize:11, color:'#999' }}>{filtered.length} of {txns.length} rows</span>
                <button style={c.btn('#fff','#0f6e56','#0f6e56')} onClick={addManualRow}>+ Add row</button>
              </div>
            </>
          )}
        </>}

        {activeTab==='sum' && (
          <>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:'1rem' }}>
              {['all',...months].map(m=>(
                <button key={m} onClick={()=>setCurMo(m)}
                  style={{ padding:'3px 10px', fontSize:11, borderRadius:20, border:`1px solid ${curMo===m?'#1a1a1a':'#ddd'}`, background:curMo===m?'#1a1a1a':'#fff', color:curMo===m?'#fff':'#888', cursor:'pointer', fontFamily:'inherit' }}>
                  {m==='all'?'All':m}
                </button>
              ))}
            </div>
            {renderSummary()}
          </>
        )}

        {activeTab==='avg' && renderAvg()}
        {activeTab==='cats' && renderCats()}
      </div>

      {showImport && <ImportModal workspaceId={wsId} onClose={()=>setShowImport(false)} onImported={()=>{setShowImport(false);load()}} />}
      {showExport && <ExportModal transactions={txns} workspaceName={workspace.name} ownerLabel={workspace.owner_label} onClose={()=>setShowExport(false)} />}
    </div>
  )
}
