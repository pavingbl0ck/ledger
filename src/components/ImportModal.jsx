import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { MONTH_NAMES } from '../lib/utils'

const MONTH_MAP = { JANUARI:0,FEBRUARI:1,MARET:2,APRIL:3,MEI:4,JUNI:5,
  JULI:6,AGUSTUS:7,SEPTEMBER:8,OKTOBER:9,NOVEMBER:10,DESEMBER:11,
  JANUARY:0,FEBRUARY:1,MARCH:2,APRIL:3,MAY:4,JUNE:5,
  JULY:6,AUGUST:7,SEPTEMBER:8,OCTOBER:9,NOVEMBER:10,DECEMBER:11 }

// Parse BCA-style statement text
function parseBCAText(text, bankName, accountNo) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const txns = []
  let year = new Date().getFullYear()
  let month = 'Jan'

  // Detect period line: "PERIODE : JANUARI 2026"
  for (const line of lines) {
    const m = line.match(/PERIODE\s*:\s*(\w+)\s+(\d{4})/i)
    if (m) {
      const mo = MONTH_MAP[m[1].toUpperCase()]
      if (mo !== undefined) month = MONTH_NAMES[mo]
      year = parseInt(m[2])
      break
    }
  }

  // Row pattern: DD/MM  DESCRIPTION  AMOUNT DB|CR
  const rowRe = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d.,]+(?:\.\d{2})?)\s+(DB|CR)\s*$/
  const amtRe = /^[\d.,]+(?:\.\d{2})?$/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(rowRe)
    if (!m) continue
    const [, date, desc, amtRaw, type] = m
    const amount = parseFloat(amtRaw.replace(/\./g,'').replace(',','.'))
    if (!isNaN(amount) && amount > 0) {
      txns.push({ date, description: desc.trim(), type, amount, month, year, bank_name: bankName, account_no: accountNo, category_name: 'Uncategorized', note: '' })
    }
  }

  // Fallback: try to parse tables where date, desc, amount are on separate lines
  if (txns.length === 0) {
    let i = 0
    while (i < lines.length) {
      const dateM = lines[i].match(/^(\d{2}\/\d{2})$/)
      if (dateM && i + 1 < lines.length) {
        const date = dateM[1]
        // collect desc lines until we hit a line ending in DB/CR + amount
        let desc = ''
        let j = i + 1
        while (j < lines.length) {
          const amtLine = lines[j].match(/([\d.,]+(?:\.\d{2})?)\s+(DB|CR)/)
          if (amtLine) {
            const amount = parseFloat(amtLine[1].replace(/\./g,'').replace(',','.'))
            const type = amtLine[2]
            if (!isNaN(amount) && amount > 0) {
              txns.push({ date, description: (desc + ' ' + lines[j].replace(amtLine[0],'')).trim().replace(/\s+/g,' '), type, amount, month, year, bank_name: bankName, account_no: accountNo, category_name:'Uncategorized', note:'' })
            }
            j++; break
          }
          desc += (desc ? ' ' : '') + lines[j]; j++
        }
        i = j
      } else { i++ }
    }
  }

  return txns
}

const OVERLAY = { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }
const BOX = { background:'#fff', borderRadius:16, padding:'1.5rem', width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }
const INPUT = { width:'100%', padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }
const BTN = (c='#1a1a1a',t='#fff') => ({ padding:'8px 18px', background:c, color:t, border:`1px solid ${c}`, borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 })
const LABEL = { fontSize:11, fontWeight:600, color:'#555', marginBottom:3, display:'block' }

export function ImportModal({ workspaceId, onClose, onImported }) {
  const [bankName, setBankName] = useState('BCA')
  const [accountNo, setAccountNo] = useState('')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [manualMonth, setManualMonth] = useState('')
  const [manualYear, setManualYear] = useState(String(new Date().getFullYear()))

  function handleParse() {
    setErr(''); setSuccess('')
    if (!text.trim()) { setErr('Paste statement text first'); return }
    const txns = parseBCAText(text, bankName || 'Unknown Bank', accountNo)

    // Override month/year if manually set
    if (manualMonth) {
      txns.forEach(t => { t.month = manualMonth; t.year = parseInt(manualYear) || t.year })
    }
    if (txns.length === 0) setErr('No transactions found. Make sure the text is from a BCA statement (with dates like 01/01 and amounts ending in DB/CR).')
    else setParsed(txns)
  }

  async function handleImport() {
    if (!parsed?.length) return
    setLoading(true); setErr('')
    try {
      const rows = parsed.map(t => ({ ...t, workspace_id: workspaceId }))
      const { error } = await supabase.from('transactions').insert(rows)
      if (error) throw error
      setSuccess(`✓ Imported ${rows.length} transactions from ${bankName}`)
      setParsed(null); setText('')
      onImported()
    } catch (ex) { setErr('Import failed: ' + ex.message) }
    setLoading(false)
  }

  return (
    <div style={OVERLAY} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={BOX}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <strong style={{ fontSize:16 }}>Import Bank Statement</strong>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888' }}>×</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
          <div style={{ gridColumn:'1/3' }}>
            <label style={LABEL}>Bank name</label>
            <input style={INPUT} value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="e.g. BCA, Mandiri, BRI" />
          </div>
          <div style={{ gridColumn:'3/5' }}>
            <label style={LABEL}>Account number</label>
            <input style={INPUT} value={accountNo} onChange={e=>setAccountNo(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={LABEL}>Override month</label>
            <select style={INPUT} value={manualMonth} onChange={e=>setManualMonth(e.target.value)}>
              <option value="">Auto-detect</option>
              {MONTH_NAMES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Year</label>
            <input style={INPUT} type="number" value={manualYear} onChange={e=>setManualYear(e.target.value)} placeholder="2026" />
          </div>
        </div>

        <div>
          <label style={LABEL}>Paste statement text (copy from PDF / internet banking)</label>
          <textarea style={{ ...INPUT, height:160, resize:'vertical', lineHeight:1.5 }}
            value={text} onChange={e=>setText(e.target.value)}
            placeholder="Paste the raw text of your bank statement here. The parser looks for lines with dates (DD/MM), descriptions, amounts and DB/CR markers." />
        </div>

        {err && <div style={{ background:'#fff0ed', color:'#993c1d', padding:'8px 12px', borderRadius:6, fontSize:12 }}>{err}</div>}
        {success && <div style={{ background:'#e8f5ee', color:'#0f6e56', padding:'8px 12px', borderRadius:6, fontSize:12 }}>{success}</div>}

        {parsed && (
          <div>
            <div style={{ fontSize:12, color:'#0f6e56', fontWeight:600, marginBottom:6 }}>
              Found {parsed.length} transactions · Preview (first 5):
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead>
                <tr style={{ background:'#f5f5f3' }}>
                  {['Date','Description','Type','Amount'].map(h => <th key={h} style={{ padding:'4px 6px', textAlign:'left', color:'#888', fontWeight:600 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0,5).map((t,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
                    <td style={{ padding:'3px 6px' }}>{t.date}</td>
                    <td style={{ padding:'3px 6px', maxWidth:200, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{t.description}</td>
                    <td style={{ padding:'3px 6px', color: t.type==='DB'?'#993c1d':'#0f6e56', fontWeight:600 }}>{t.type}</td>
                    <td style={{ padding:'3px 6px', textAlign:'right' }}>Rp {Number(t.amount).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                {parsed.length > 5 && <tr><td colSpan={4} style={{ padding:'4px 6px', color:'#888', fontSize:11 }}>…and {parsed.length-5} more</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button style={BTN('#f5f5f3','#1a1a1a')} onClick={onClose}>Cancel</button>
          {!parsed
            ? <button style={BTN()} onClick={handleParse}>Parse statement</button>
            : <>
                <button style={BTN('#f5f5f3','#1a1a1a')} onClick={()=>setParsed(null)}>Re-parse</button>
                <button style={BTN('#0f6e56')} onClick={handleImport} disabled={loading}>
                  {loading ? 'Importing…' : `Import ${parsed.length} rows`}
                </button>
              </>
          }
        </div>
      </div>
    </div>
  )
}
