import React, { useState } from 'react'
import { exportPDF } from '../lib/pdf'

const OVERLAY = { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }
const BOX = { background:'#fff', borderRadius:16, padding:'1.5rem', width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }
const BTN = (c='#1a1a1a',t='#fff') => ({ padding:'8px 18px', background:c, color:t, border:`1px solid ${c==='#f5f5f3'?'#ddd':c}`, borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 })
const CHK = { marginRight:7, width:14, height:14, cursor:'pointer', accentColor:'#1a1a1a' }

export function ExportModal({ transactions, workspaceName, ownerLabel, onClose }) {
  const allMonths = [...new Set(transactions.map(t => `${t.month} ${t.year}`))].sort((a,b) => {
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const [am,ay]=a.split(' '), [bm,by]=b.split(' ')
    return (+ay - +by)||(mo.indexOf(am)-mo.indexOf(bm))
  })
  const allCats = [...new Set(transactions.map(t => t.category_name))].sort()

  const [selMonths, setSelMonths] = useState(new Set(allMonths))
  const [hideCats, setHideCats] = useState(new Set())
  const [loading, setLoading] = useState(false)

  function toggleMonth(m) { setSelMonths(s => { const n=new Set(s); n.has(m)?n.delete(m):n.add(m); return n }) }
  function toggleCat(c)   { setHideCats(s  => { const n=new Set(s); n.has(c)?n.delete(c):n.add(c); return n }) }

  function doExport() {
    setLoading(true)
    try {
      exportPDF({
        transactions,
        workspaceName,
        ownerLabel,
        filters: {
          months: selMonths.size < allMonths.length ? [...selMonths] : undefined,
          hideCategories: hideCats.size ? [...hideCats] : undefined,
        }
      })
    } catch(e) { alert('PDF error: '+e.message) }
    setLoading(false)
    onClose()
  }

  return (
    <div style={OVERLAY} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={BOX}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <strong style={{ fontSize:16 }}>Export PDF Statement</strong>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888' }}>×</button>
        </div>

        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:8, textTransform:'uppercase', letterSpacing:'.04em' }}>
            Include months ({selMonths.size}/{allMonths.length})
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {allMonths.map(m => (
              <label key={m} style={{ display:'flex', alignItems:'center', fontSize:12, cursor:'pointer', padding:'4px 10px', borderRadius:20, border:`1px solid ${selMonths.has(m)?'#1a1a1a':'#ddd'}`, background: selMonths.has(m)?'#1a1a1a':'#fff', color: selMonths.has(m)?'#fff':'#888' }}>
                <input type="checkbox" style={{ display:'none' }} checked={selMonths.has(m)} onChange={()=>toggleMonth(m)} />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:8, textTransform:'uppercase', letterSpacing:'.04em' }}>
            Hide categories from PDF ({hideCats.size} hidden)
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {allCats.map(c => (
              <label key={c} style={{ display:'flex', alignItems:'center', fontSize:12, cursor:'pointer', padding:'3px 0' }}>
                <input type="checkbox" style={CHK} checked={hideCats.has(c)} onChange={()=>toggleCat(c)} />
                <span style={{ color: hideCats.has(c)?'#bbb':'#1a1a1a', textDecoration: hideCats.has(c)?'line-through':'none' }}>{c}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ background:'#f8f8f6', borderRadius:8, padding:'10px 12px', fontSize:11, color:'#888', lineHeight:1.7 }}>
          PDF will include: monthly summary, category breakdown with rata-rata, and full transaction detail for selected months. Hidden categories are excluded from all tables.
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button style={BTN('#f5f5f3','#1a1a1a')} onClick={onClose}>Cancel</button>
          <button style={BTN('#0f6e56')} onClick={doExport} disabled={loading||!selMonths.size}>
            {loading ? 'Building…' : `Export PDF (${selMonths.size} month${selMonths.size!==1?'s':''})`}
          </button>
        </div>
      </div>
    </div>
  )
}
