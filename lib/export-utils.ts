import * as XLSX from 'xlsx'

export interface ExportData {
  [key: string]: any
}

/**
 * Export data to Excel file
 */
export function exportToExcel(data: ExportData[], filename: string, sheetName: string = 'Sheet1') {
  if (!data || data.length === 0) {
    console.warn('No data to export')
    return
  }

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fullFilename = `${filename}_${timestamp}.xlsx`
  
  XLSX.writeFile(workbook, fullFilename)
}

/**
 * Export data to CSV file
 */
export function exportToCSV(data: ExportData[], filename: string) {
  if (!data || data.length === 0) {
    console.warn('No data to export')
    return
  }

  const worksheet = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fullFilename = `${filename}_${timestamp}.csv`
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', fullFilename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Format product data for export
 */
export function formatProductDataForExport(products: any[]) {
  return products.map(product => ({
    SKU: product.sku,
    'Nama Produk': product.name,
    Warna: product.color,
    Ukuran: product.size,
    Stok: product.stock,
    'Status': product.stock === 0 ? 'Habis' : product.stock < 40 ? 'Menipis' : 'Aman',
    'Dibuat': new Date(product.created_at).toLocaleDateString('id-ID')
  }))
}

/**
 * Format inventory log data for export
 */
export function formatLogDataForExport(logs: any[]) {
  return logs.map(log => ({
    Tanggal: new Date(log.created_at).toLocaleDateString('id-ID'),
    Waktu: new Date(log.created_at).toLocaleTimeString('id-ID'),
    Tipe: log.type === 'INBOUND_QC' ? 'Barang Masuk' : 'Barang Keluar',
    SKU: log.product?.sku || '-',
    'Nama Produk': log.product?.name || '-',
    Warna: log.product?.color || '-',
    Ukuran: log.product?.size || '-',
    Jumlah: Math.abs(log.qty),
    Catatan: log.notes || '-'
  }))
}
