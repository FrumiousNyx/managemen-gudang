# Manajemen Gudang

Aplikasi web manajemen inventaris yang siap produksi, ramah mobile untuk merek pakaian menggunakan Next.js 16.3.3, Tailwind CSS 4, TypeScript, Lucide Icons, dan Supabase.

## Fitur Utama

### 📊 Dasbor Stok
- Metrik inventaris real-time dengan fungsi pencarian
- **Smart filters**: Semua, Stok Menipis, Stok Habis
- Filter berdasarkan Nama, SKU, Warna, atau Ukuran
- Indikator status stok (Aman/Menipis/Habis) berdasarkan threshold per produk
- **Export Excel** untuk data stok
- Notifikasi browser untuk stok rendah
- Tampilan cocok untuk desktop dan mobile
- Skeleton loading states untuk UX yang lebih baik

### 📥 Input Barang Masuk (QC Inbound)
- Tambah barang masuk ke stok gudang
- **Batch mode**: Tambah multiple produk sekaligus sebelum diproses
- Cetak label thermal 40x20mm (horizontal layout) dengan QR Code
- Label menampilkan: QR Code, Nama Produk, Warna/Ukuran, SKU
- Audit trail otomatis untuk setiap transaksi
- Caching untuk performa lebih cepat

### 📦 Pengemasan (Barang Keluar)
- Pemindaian barcode multi-mode (Satu/Banyak)
- Mode Satu Pindai: Setiap pindai mengurangi 1 unit
- Mode Banyak Pindai: Masukkan jumlah, pindai sekali untuk mengurangi banyak unit
- Operasi database aman untuk mencegah konflik
- Validasi stok real-time untuk mencegah overselling
- Feedback audio untuk sukses/error
- Support kamera dan barcode scanner USB/Bluetooth

### 📝 Master SKU (Produk)
- Kelola SKU produk dan informasi inventaris
- Tambah, edit, dan hapus produk
- **Stock threshold per produk**: Edit threshold minimum stok per produk
- Indikator status stok untuk setiap produk (berdasarkan threshold)
- **Bulk operations**: Hapus multiple produk sekaligus
- **Bulk stock update**: Update stok multiple produk sekaligus
- **Mandatory adjustment reasons**: Wajib pilih alasan (Restock, Salah input, Perbaikan)
- **Import Excel**: Batch import produk dari file Excel dengan template
- **Export Excel**: Export daftar produk ke Excel
- **Smart filters**: Semua, Stok Menipis, Stok Habis
- Custom sorting by name, color, and size
- Cetak label thermal per produk

### 📈 Analitik Penjualan
- Data penjualan real-time (Hari Ini, Minggu Ini, Bulan Ini)
- **Visual charts dengan Recharts**:
  - Line chart: Tren penjualan 7 hari terakhir
  - Bar chart: Top 5 produk terlaris
  - Pie chart: Breakdown warna dengan persentase
  - Bar chart: Breakdown ukuran
- Breakdown warna dan ukuran
- Filter berdasarkan rentang tanggal
- **Export PDF** untuk laporan penjualan

### 📜 Riwayat Inventaris
- Audit trail lengkap untuk semua transaksi
- **Adjustment reasons**: Catatan alasan penyesuaian stok
- Filter berdasarkan tipe (Masuk/Keluar) dan tanggal
- Pagination untuk data yang banyak
- **Export PDF** untuk laporan riwayat
- Bersihkan riwayat dengan konfirmasi

### 🔐 Keamanan & Autentikasi
- Sistem login admin dengan environment variables
- Session management dengan 24-hour expiration
- Cookie-based authentication untuk middleware
- Tidak ada hardcoded credentials di kode
- Ganti admin credentials default di production

### ⚡ Performance & Optimasi
- **Caching layer** dengan TTL support untuk response time lebih cepat
  - Products: 5 menit
  - Analytics logs: 3 menit
  - Inventory logs: 3 menit
- **Database index optimization** untuk query yang lebih efisien
- Selective field selection untuk mengurangi data transfer
- Auto-clear expired cache setiap 5 menit

### 🎨 UI/UX Modern
- **Plus Jakarta Sans font** untuk typography modern
- **Dark/Light theme toggle** dengan persistence
- Responsive design untuk semua device
- Skeleton loading states
- Toast notifications untuk feedback

## Teknologi

- **Framework**: Next.js 16.3.3 (App Router, Turbopack)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **PDF Generation**: jsPDF, jsPDF-autotable
- **QR Code**: react-qr-code, html5-qrcode
- **Charts**: Recharts
- **Excel Export**: xlsx
- **State Management**: React Context API
- **TypeScript**: Full type safety
- **Font**: Plus Jakarta Sans

## Memulai

### Prasyarat
- Node.js 18+ terinstall
- npm atau yarn package manager
- Akun Supabase (tier gratis bisa digunakan)

### Installation

1. Clone repository
```bash
git clone https://github.com/FrumiousNyx/managemen-gudang.git
cd inventory-app
```

2. Install dependencies
```bash
npm install
```

3. Setup Database Supabase
- Buat proyek baru di [Supabase](https://supabase.com)
- Jalankan skema SQL dari `supabase-schema.sql` di SQL Editor
- Dapatkan Project URL dan anon key dari Settings → API

4. Konfigurasi environment variables
```bash
# Copy dari .env.example
cp .env.example .env.local
```

Edit `.env.local`:
```bash
# Konfigurasi Supabase
NEXT_PUBLIC_SUPABASE_URL=url-proyek-supabase-anda
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key-supabase-anda

# Konfigurasi Admin Login
# Ganti dengan username dan password yang aman
NEXT_PUBLIC_ADMIN_USERNAME=admin
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
```

5. Jalankan development server
```bash
npm run dev
```

Aplikasi akan tersedia di [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Deskripsi | Default |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek Supabase | - |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase | - |
| `NEXT_PUBLIC_ADMIN_USERNAME` | Username untuk login admin | admin |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | Password untuk login admin | admin |

## Skema Database

Aplikasi menggunakan Supabase PostgreSQL dengan tabel berikut:

### `products`
- `id`: UUID (Primary Key)
- `sku`: TEXT (Unique) - SKU produk
- `name`: TEXT - Nama produk
- `color`: TEXT - Warna produk
- `size`: TEXT - Ukuran produk
- `stock`: INTEGER - Jumlah stok
- `stock_threshold`: INTEGER - Threshold minimum stok (DEFAULT 40, CHECK > 0)
- `created_at`: TIMESTAMP - Waktu dibuat

### `inventory_logs`
- `id`: UUID (Primary Key)
- `product_id`: UUID (Foreign Key ke products)
- `type`: TEXT - Tipe transaksi (INBOUND_QC/OUTBOUND_PACKING)
- `qty`: INTEGER - Jumlah perubahan stok
- `notes`: TEXT - Catatan transaksi (termasuk alasan penyesuaian)
- `created_at`: TIMESTAMP - Waktu transaksi

### Database Functions
- `update_stock_with_log`: Update stok dan log transaksi
- `deduct_product_stock`: Fungsi aman untuk pengurangan stok dengan row locking

### Migration
Untuk database yang sudah ada, jalankan migration ini di Supabase SQL Editor:
```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_threshold INTEGER DEFAULT 40 CHECK (stock_threshold > 0);
```

### Indexes
- `idx_products_sku`: Index untuk pencarian SKU
- `idx_products_name`: Index untuk pencarian nama
- `idx_products_stock`: Index untuk filtering stok
- `idx_products_name_color_size`: Composite index untuk pencarian kompleks
- `idx_inventory_logs_product_id`: Index untuk join ke products
- `idx_inventory_logs_type`: Index untuk filtering tipe
- `idx_inventory_logs_created_at`: Index untuk sorting tanggal
- `idx_inventory_logs_type_created_at`: Composite index untuk query analitik
- `idx_inventory_logs_product_created_at`: Composite index untuk history queries

Lihat [supabase-schema.sql](./supabase-schema.sql) untuk skema database lengkap.

## Fitur Unggulan

### Stock Threshold Configuration
- Set threshold minimum stok per produk
- Status stok otomatis berdasarkan threshold (Aman/Menipis/Habis)
- Edit threshold di modal adjustment stok
- Fallback ke logic nama-based untuk data legacy
- Import/Export Excel mendukung kolom threshold

### Mandatory Adjustment Reasons
- Alasan penyesuaian stok wajib untuk audit trail
- Kategori: Restock, Salah input, Perbaikan
- Diterapkan ke individual dan bulk stock adjustment
- Alasan dicatat di inventory_logs

### Smart Search & Filters
- **Dashboard**: Quick filters (Semua, Stok Menipis, Stok Habis)
- **Products**: Status filters + search by SKU/nama/warna/ukuran
- Filters bekerja bersama dengan sorting dan export

### Batch QC Inbound
- Toggle batch mode untuk tambah multiple produk sekaligus
- List batch items dengan quantity dan remove option
- Process semua items sekaligus dengan "Proses Semua Batch"
- Success/failure reporting untuk batch operations

### Bulk Operations
- **Bulk Delete**: Hapus multiple produk sekaligus
- **Bulk Stock Update**: Update stok multiple produk sekaligus
- Validasi dan mandatory reason untuk semua bulk operations

### Excel Integration
- **Export Excel**: Export data dari Dashboard dan Products
- **Import Excel**: Batch import produk dengan template
- Support kolom: SKU, Nama, Warna, Ukuran, Stok, Threshold
- Template Excel tersedia untuk download

### Notifications
- Browser notifications untuk stok rendah
- Permission management dengan tombol aktifasi
- Summary notification untuk semua produk stok rendah

### Visual Analytics
- Line chart: Tren penjualan 7 hari terakhir
- Bar chart: Top 5 produk terlaris
- Pie chart: Breakdown warna dengan persentase
- Bar chart: Breakdown ukuran
- Responsive dan support dark mode

## Instruksi Setup Detail

Lihat [SETUP.md](./SETUP.md) untuk instruksi setup detail termasuk:
- Setup proyek Supabase
- Konfigurasi pemindai barcode
- Deployment ke produksi
- Pemecahan masalah

## Build untuk Produksi

```bash
npm run build
npm start
```

## Deployment

### Vercel (Recommended)
1. Push kode ke GitHub
2. Import repository di [Vercel](https://vercel.com)
3. Tambah environment variables di dashboard Vercel
4. Deploy

### Opsi Lainnya
- Netlify
- Railway
- Self-hosted dengan Docker

## Security Notes

- Ganti admin credentials default di production
- Gunakan Supabase service role keys hanya untuk server-side operations
- Implement Row Level Security (RLS) di Supabase untuk production
- Jangan commit `.env.local` ke version control

## Performance Features

- **Caching**: In-memory cache dengan TTL (5 menit untuk products, 3 menit untuk logs)
- **Database Indexes**: Optimized indexes untuk query yang sering digunakan
- **Query Optimization**: Selective field selection untuk mengurangi data transfer
- **Auto-clear Cache**: Cache expired di-clear otomatis setiap 5 menit

## Support

Untuk masalah atau pertanyaan:
- Dokumentasi Supabase: https://supabase.com/docs
- Dokumentasi Next.js: https://nextjs.org/docs
- Dokumentasi Tailwind CSS: https://tailwindcss.com/docs

## License

Proyek ini disediakan apa adanya untuk kebutuhan manajemen inventaris Anda.
