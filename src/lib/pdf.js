import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmt, fmtShort } from './utils'

export function exportPDF({ transactions, workspaceName, ownerLabel, filters = {} }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, PL = 14, PR = 14, CW = W - PL - PR

  // Apply filters
  let txns = [...transactions]
  if (filters.months?.length) txns = txns.filter(t => filters.months.includes(t.month + ' ' + t.year))
  if (filters.hideCategories?.length) txns = txns.filter(t => !filters.hideCategories.includes(t.category_name))

  const months = [...new Set(txns.map(t => `${t.month} ${t.year}`))].sort((a, b) => {
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const [am, ay] = a.split(' '); const [bm, by] = b.split(' ')
    return (+ay - +by) || (mo.indexOf(am) - mo.indexOf(bm))
  })

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.setFillColor(26, 26, 26)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold')
  doc.text('Personal Financial Statement', PL, 11)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(`${ownerLabel || workspaceName}  ·  ${months[0] || ''} – ${months[months.length-1] || ''}  ·  Generated ${new Date().toLocaleDateString('en-GB')}`, PL, 18)

  let y = 34

  // ── Monthly summary ────────────────────────────────────────────────────────
  doc.setTextColor(26, 26, 26)
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.text('Monthly Summary', PL, y); y += 4

  const monthSummary = months.map(mo => {
    const [m, yr] = mo.split(' ')
    const mTxns = txns.filter(t => t.month === m && String(t.year) === yr)
    const cr = mTxns.filter(t => t.type === 'CR').reduce((s, t) => s + Number(t.amount), 0)
    const db = mTxns.filter(t => t.type === 'DB').reduce((s, t) => s + Number(t.amount), 0)
    const banks = [...new Set(mTxns.map(t => t.bank_name))].join(', ')
    return [mo, banks, `+ ${fmtShort(cr)}`, `− ${fmtShort(db)}`, fmtShort(cr - db)]
  })

  autoTable(doc, {
    startY: y,
    head: [['Period', 'Banks', 'Total In', 'Total Out', 'Net']],
    body: monthSummary,
    margin: { left: PL, right: PR },
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [26,26,26], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 55 },
      2: { cellWidth: 33, halign: 'right', textColor: [15, 110, 86] },
      3: { cellWidth: 33, halign: 'right', textColor: [153, 60, 29] },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [250, 250, 248] },
  })

  y = doc.lastAutoTable.finalY + 8

  // ── Category breakdown with rata-rata ─────────────────────────────────────
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.text('Expenditure by Category — Rata-rata (Monthly Average)', PL, y); y += 4

  const catMap = {}
  txns.filter(t => t.type === 'DB').forEach(t => {
    const mo = `${t.month} ${t.year}`
    if (!catMap[t.category_name]) catMap[t.category_name] = {}
    catMap[t.category_name][mo] = (catMap[t.category_name][mo] || 0) + Number(t.amount)
  })

  const nMonths = months.length || 1
  const catRows = Object.entries(catMap)
    .map(([cat, byMo]) => {
      const vals = months.map(mo => byMo[mo] || 0)
      const total = vals.reduce((a, b) => a + b, 0)
      return { cat, vals, total, avg: total / nMonths }
    })
    .sort((a, b) => b.total - a.total)

  const catHead = ['Category', ...months, 'YTD Total', 'Monthly Avg']
  const catBody = catRows.map(r => [
    r.cat,
    ...r.vals.map(v => v > 0 ? fmtShort(v) : '—'),
    fmtShort(r.total),
    fmtShort(r.avg),
  ])
  const totVals = months.map((_, i) => catRows.reduce((s, r) => s + r.vals[i], 0))
  const grandTotal = totVals.reduce((a, b) => a + b, 0)
  catBody.push(['TOTAL', ...totVals.map(v => fmtShort(v)), fmtShort(grandTotal), fmtShort(grandTotal / nMonths)])

  const moColW = Math.min(24, (CW - 40 - 28 - 28) / Math.max(nMonths, 1))
  autoTable(doc, {
    startY: y,
    head: [catHead],
    body: catBody,
    margin: { left: PL, right: PR },
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [26,26,26], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 40 },
      ...months.reduce((o, _, i) => ({ ...o, [i+1]: { cellWidth: moColW, halign: 'right' } }), {}),
      [months.length+1]: { cellWidth: 28, halign: 'right', textColor: [153,60,29], fontStyle: 'bold' },
      [months.length+2]: { cellWidth: 28, halign: 'right', textColor: [15,110,86], fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [250,250,248] },
    didParseCell(data) {
      if (data.row.index === catBody.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [240,240,238]
      }
    }
  })

  y = doc.lastAutoTable.finalY + 8

  // ── Transaction detail by month ────────────────────────────────────────────
  for (const mo of months) {
    const [m, yr] = mo.split(' ')
    const mTxns = txns
      .filter(t => t.month === m && String(t.year) === yr)
      .sort((a, b) => {
        const [ad, am] = (a.date || '01/01').split('/')
        const [bd, bm] = (b.date || '01/01').split('/')
        return (+am - +bm) || (+ad - +bd)
      })

    if (!mTxns.length) continue

    // Check if we need a new page
    if (y > 240) { doc.addPage(); y = 14 }

    doc.setFillColor(44, 44, 44)
    doc.rect(PL - 2, y - 4, CW + 4, 9, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    const moCr = mTxns.filter(t=>t.type==='CR').reduce((s,t)=>s+Number(t.amount),0)
    const moDB = mTxns.filter(t=>t.type==='DB').reduce((s,t)=>s+Number(t.amount),0)
    doc.text(`${mo}`, PL, y + 1)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(180,180,180)
    doc.text(`In: +${fmtShort(moCr)}   Out: −${fmtShort(moDB)}   ${[...new Set(mTxns.map(t=>t.bank_name))].join(', ')}`, PL + 18, y + 1)
    y += 7

    const rows = mTxns.map(t => [
      t.date || '',
      t.bank_name || '',
      (t.description || '').substring(0, 55),
      t.category_name || '',
      t.note || '',
      t.type === 'DB' ? fmt(t.amount) : '',
      t.type === 'CR' ? fmt(t.amount) : '',
    ])

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Bank', 'Description', 'Category', 'Note', 'Debit', 'Credit']],
      body: rows,
      margin: { left: PL, right: PR },
      styles: { fontSize: 7, cellPadding: 1.8 },
      headStyles: { fillColor: [26,26,26], textColor: 255, fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 20 },
        2: { cellWidth: 58 },
        3: { cellWidth: 28 },
        4: { cellWidth: 28 },
        5: { cellWidth: 22, halign: 'right', textColor: [153,60,29] },
        6: { cellWidth: 22, halign: 'right', textColor: [15,110,86] },
      },
      alternateRowStyles: { fillColor: [250,250,248] },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // ── Footer on each page ────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(170,170,170)
    doc.text(`Ledger · ${workspaceName} · Page ${i} of ${pages} · For personal record-keeping only`, W/2, 293, { align: 'center' })
  }

  const fileName = `statement_${(months[0]||'').replace(' ','_')}_${(months[months.length-1]||'').replace(' ','_')}.pdf`
  doc.save(fileName)
}
