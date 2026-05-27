import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { MONTH_NAMES } from '../lib/utils'

const OVERLAY = { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }
const BOX = { background:'#fff', borderRadius:16, padding:'1.5rem', width:'100%', maxWidth:600, maxHeight:'92vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }
const INPUT = { width:'100%', padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }
const BTN = (c='#1a1a1a',t='#fff') => ({ padding:'9px 20px', background:c, color:t, border:`1px solid ${c==='#f5f5f3'?'#ddd':c}`, borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 })
const LABEL = { fontSize:11, fontWeight:600, color:'#555', marginBottom:4, display:'block' }

async function parsePDFWithClaude(base64PDF, bankName, accountNo) {
  const prompt = `You are a bank statement parser. Extract ALL transactions from this ${bankName} bank statement PDF.

Return ONLY a valid JSON array with no explanation, no markdown, no code fences. Each object must have exactly these fields:
- date: string "DD/MM" format
- description: string (the full transaction description)  
- type: "DB" for debit/outgoing or "CR" for credit/incoming
- amount: number (positive, no currency symbols, no dots as thousand separators - e.g. 5500000 not 5.500.000)
- month: string 3-letter month abbreviation e.g. "Jan", "Feb", "Mar", "Apr"
- year: number e.g. 2026
- bank_name: "${bankName}"
- account_no: "${accountNo}"
- category_name: "Uncategorized"
- note: ""

Important:
- Indonesian months: JANUARI=Jan, FEBRUARI=Feb, MARET=Mar, APRIL=Apr, MEI=May, JUNI=Jun, JULI=Jul, AGUSTUS=Aug, SEPTEMBER=Sep, OKTOBER=Oct, NOVEMBER=Nov, DESEMBER=Dec
- Detect the month/year from the PERIODE line in the statement
- Skip opening balance (SALDO AWAL) and closing balance (SALDO AKHIR) lines
- Skip MUTASI CR/DB summary lines
- Include interest (BUNGA) and fees (BIAYA ADM, PAJAK BUNGA)
- For Indonesian amounts: periods are thousand separators, comma is decimal. So 5.500.000,00 = 5500000
- Return ONLY the JSON array, nothing else`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [{
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64PDF }
        }, {
          type: 'text',
          text: prompt
        }]
      }]
    })
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || `API error ${response.status}`)
  }

  const data = await response.json()
  const text = data.content.map(b => b.text || '').join('').trim()
  
  // Strip any accidental markdown fences
  const clean = text.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()
  
  try {
    const txns = JSON.parse(clean)
    if (!Array.isArray(txns)) throw new Error('Response is not an array')
    return txns
  } catch(e) {
    throw new Error('Could not parse Claude response as JSON. Try again.')
  }
}

export function ImportModal({ workspaceId, onClose, onImported }) {
  const [bankName, setBankName] = useState('BCA')
  const [accountNo, setAccountNo] = useState('')
  const [parsed, setParsed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    if (file.type !== 'application/pdf') { setErr('Please upload a PDF file'); return }
    if (file.size > 10 * 1024 * 1024) { setErr('File too large — max 10MB'); return }
    
    setFileName(file.name)
    setErr(''); setParsed(null); setSuccess('')
    setLoading(true)
    setLoadingMsg('Reading PDF…')

    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      setLoadingMsg('Sending to Claude AI to extract transactions…')
      const txns = await parsePDFWithClaude(base64, bankName || 'Unknown Bank', accountNo)
      
      if (!txns.length) throw new Error('No transactions found in this PDF')
      setParsed(txns)
    } catch(ex) {
      setErr('Error: ' + ex.message)
    }
    setLoading(false)
    setLoadingMsg('')
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  async function handleImport() {
    if (!parsed?.length) return
    setLoading(true); setLoadingMsg('Saving to database…'); setErr('')
    try {
      const rows = parsed.map(t => ({ ...t, workspace_id: workspaceId }))
      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase.from('transactions').insert(rows.slice(i, i+50))
        if (error) throw error
      }
      setSuccess(`✓ Imported ${rows.length} transactions from ${bankName}`)
      setParsed(null); setFileName('')
      setTimeout(() => { onImported(); onClose() }, 1200)
    } catch (ex) { setErr('Import failed: ' + ex.message) }
    setLoading(false); setLoadingMsg('')
  }

  return (
    <div style={OVERLAY} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={BOX}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <strong style={{ fontSize:16 }}>Import Bank Statement</strong>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888', lineHeight:1 }}>×</button>
        </div>

        {/* Bank details */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={LABEL}>Bank name</label>
            <input style={INPUT} value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="e.g. BCA, Mandiri, BRI" />
          </div>
          <div>
            <label style={LABEL}>Account number (optional)</label>
            <input style={INPUT} value={accountNo} onChange={e=>setAccountNo(e.target.value)} placeholder="e.g. 7720962068" />
          </div>
        </div>

        {/* PDF drop zone */}
        {!parsed && !loading && (
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={onDrop}
            onClick={()=>fileRef.current.click()}
            style={{
              border: `2px dashed ${dragOver?'#1a1a1a':'#ddd'}`,
              borderRadius: 12,
              padding: '2.5rem 1rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? '#f5f5f3' : '#fafaf8',
              transition: 'all .15s'
            }}
          >
            <div style={{ fontSize:36, marginBottom:10 }}>📄</div>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:5 }}>
              {fileName ? fileName : 'Drop your PDF here or click to browse'}
            </div>
            <div style={{ fontSize:12, color:'#999' }}>
              BCA, Mandiri, BRI, or any Indonesian bank statement · Max 10MB
            </div>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display:'none' }}
              onChange={e=>handleFile(e.target.files[0])} />
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign:'center', padding:'2rem', background:'#f5f5f3', borderRadius:12 }}>
            <div style={{ fontSize:28, marginBottom:10 }}>⏳</div>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:5 }}>{loadingMsg}</div>
            <div style={{ fontSize:12, color:'#999' }}>Claude AI is reading your PDF — this takes 10–20 seconds</div>
          </div>
        )}

        {/* Preview */}
        {parsed && !loading && (
          <div>
            <div style={{ fontSize:13, color:'#0f6e56', fontWeight:600, marginBottom:8 }}>
              ✓ Found {parsed.length} transactions — preview (first 6):
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead>
                <tr style={{ background:'#f5f5f3' }}>
                  {['Date','Month','Description','Type','Amount'].map(h =>
                    <th key={h} style={{ padding:'5px 7px', textAlign:'left', color:'#888', fontWeight:600, fontSize:10, textTransform:'uppercase' }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0,6).map((t,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f5f5f3' }}>
                    <td style={{ padding:'4px 7px' }}>{t.date}</td>
                    <td style={{ padding:'4px 7px', color:'#888' }}>{t.month} {t.year}</td>
                    <td style={{ padding:'4px 7px', maxWidth:220, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{t.description}</td>
                    <td style={{ padding:'4px 7px', color: t.type==='DB'?'#993c1d':'#0f6e56', fontWeight:600 }}>{t.type}</td>
                    <td style={{ padding:'4px 7px', textAlign:'right' }}>Rp {Number(t.amount).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                {parsed.length > 6 && (
                  <tr><td colSpan={5} style={{ padding:'5px 7px', color:'#999', fontSize:11, fontStyle:'italic' }}>…and {parsed.length-6} more transactions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {err && <div style={{ background:'#fff0ed', color:'#993c1d', padding:'9px 12px', borderRadius:8, fontSize:12 }}>{err}</div>}
        {success && <div style={{ background:'#e8f5ee', color:'#0f6e56', padding:'9px 12px', borderRadius:8, fontSize:12, fontWeight:600 }}>{success}</div>}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button style={BTN('#f5f5f3','#1a1a1a')} onClick={onClose}>Cancel</button>
          {parsed && !loading && <>
            <button style={BTN('#f5f5f3','#1a1a1a')} onClick={()=>{setParsed(null);setFileName('')}}>Upload different file</button>
            <button style={BTN('#0f6e56')} onClick={handleImport}>
              Import {parsed.length} transactions
            </button>
          </>}
        </div>
      </div>
    </div>
  )
}
