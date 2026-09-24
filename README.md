# Sistem Manajemen Inventaris Gudang

Aplikasi web manajemen inventaris yang siap produksi, ramah mobile untuk merek pakaian menggunakan Next.js 16.3.3, Tailwind CSS 4, TypeScript, Lucide Icons, dan Supabase.

## 📋 Ringkasan Proyek

Sistem manajemen inventaris lengkap untuk warehouse management dengan fitur:
- ✅ Autentikasi multi-role (Admin, Staff, Viewer)
- ✅ Tracking stok real-time dengan threshold per produk
- ✅ QC inbound dengan cetak label QR Code
- ✅ Packing outbound dengan scan barcode (kamera & USB/Bluetooth)
- ✅ Manajemen retur dan barang rusak
- ✅ Analitik dengan visualisasi data
- ✅ Audit trail lengkap
- ✅ Import/Export Excel dan PDF
- ✅ Notifikasi stok rendah
- ✅ Dark/Light mode
- ✅ Fully responsive (mobile-first)

## 🏗️ Arsitektur Teknis

### Teknologi Stack
- **Frontend Framework**: Next.js 16.3.3 (App Router, Turbopack)
- **UI Framework**: React 18 dengan TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL 15+)
- **Authentication**: Custom session-based auth dengan Supabase
- **Icons**: Lucide React
- **PDF Generation**: jsPDF, jsPDF-autotable
- **QR Code**: react-qr-code, html5-qrcode
- **Charts**: Recharts
- **Excel**: xlsx
- **State Management**: React Context API
- **Font**: Plus Jakarta Sans (Google Fonts)

### Database Schema
- **products**: Master SKU dengan threshold per produk
- **inventory_logs**: Audit trail untuk semua transaksi
- **users**: User management dengan RBAC (Role-Based Access Control)
- **Fungsi RPC**: `deduct_product_stock` untuk atomic stock deduction

### Performance Optimizations
- In-memory caching dengan TTL (Products: 5min, Logs: 3min)
- Database indexes untuk query cepat
- Selective field selection
- Auto-clear expired cache
- Skeleton loading states

## 🎯 Fitur Lengkap

### 1. Autentikasi & Authorization
- **Multi-role system**: Admin, Staff, Viewer
- **Login page** dengan email dan password
- **Session management** dengan middleware protection
- **Cookie-based authentication** untuk security
- **RBAC enforcement** untuk akses halaman tertentu
- **User management** (admin only) untuk tambah/edit/hapus user
- Logout dengan session cleanup

### 2. Dasbor Utama (Dashboard)
- **Metrik real-time**:
  - Total produk
  - Produk stok menipis (di bawah threshold)
  - Produk stok habis
  - Retur barang bulan ini
  - Barang rusak bulan ini
- **Search functionality**: Cari berdasarkan Nama, SKU, Warna, Ukuran
- **Smart filters**: Semua, Stok Menipis, Stok Habis
- **Status indicators**: Aman (hijau), Menipis (kuning), Habis (merah)
- **Export Excel** untuk data stok
- **Browser notifications** untuk stok rendah
- **Mobile notification bell** di pojok kiri atas
- **Fully responsive** grid layout

### 3. QC Inbound (Barang Masuk)
- **Tambah stok** untuk produk yang ada
- **Batch mode**: Tambah multiple produk sekaligus
- **Validation**: SKU harus ada di database
- **Cetak label thermal** 40x20mm:
  - QR Code yang scannable
  - Nama produk
  - Warna dan ukuran
  - SKU
- **Audit trail otomatis** di inventory_logs
- **Caching** untuk performa
- **Staf-only access**

### 4. Packing Outbound (Barang Keluar)
- **Barcode scanning multi-mode**:
  - Mode Satu Pindai: Setiap scan mengurangi 1 unit
  - Mode Banyak Pindai: Masukkan jumlah, scan sekali
- **Scan methods**:
  - Kamera HP (QR Code detection)
  - Barcode scanner USB/Bluetooth
  - Manual input SKU
- **Performance optimizations**:
  - 30 FPS camera untuk detection cepat
  - 500ms auto-resume delay
  - Duplicate scan prevention (1 second cooldown)
- **Audio feedback**: Beep untuk sukses, error tone untuk gagal
- **Stock validation**: Mencegah overselling
- **Atomic operations** dengan database locking
- **Success modal** dengan sisa stok
- **Recently scanned list** (10 items terakhir)
- **Staf-only access**

### 5. Master SKU (Produk)
- **CRUD operations**: Tambah, edit, hapus produk
- **Product variants**: Nama, SKU, Warna, Ukuran, Stok, Threshold
- **Stock threshold per produk**: Editable per item
- **Status indicators**: Aman/Menipis/Habis berdasarkan threshold
- **Bulk operations**:
  - Bulk delete (multiple selection)
  - Bulk stock update
- **Mandatory adjustment reasons**: Restock, Salah input, Perbaikan
- **Excel integration**:
  - Import batch produk dengan template
  - Export daftar produk
- **Smart filters**: Semua, Stok Menipis, Stok Habis
- **Custom sorting**: By name, color, size
- **Cetak label** per produk
- **Pagination** untuk data yang banyak
- **Staf-only access**

### 6. Retur & Barang Rusak
- **Pencatatan retur** dengan alasan:
  - Salah kirim
  - Kualitas buruk
  - Salah size
  - Lainnya
- **Pencatatan barang rusak** dengan tipe:
  - Sobek
  - Kotor
  - Rusak lainnya
- **Filter by type**: Semua, Retur saja, Barang rusak saja
- **Date range filter**
- **Breakdown alasan/tipe** dengan statistik
- **Export PDF** untuk laporan
- **Auto-stock adjustment** (add back for returns)
- **Audit trail** di inventory_logs
- **Staf-only access**

### 7. Analitik
- **Metrik penjualan**:
  - Retur (filter tanggal atau bulan ini)
  - Barang rusak (filter tanggal atau bulan ini)
- **Date range filter** untuk data custom
- **Visual charts** (Recharts):
  - Line chart: Tren penjualan 7 hari terakhir
  - Bar chart: Top 5 produk terlaris
  - Pie chart: Breakdown warna dengan persentase
  - Bar chart: Breakdown ukuran
- **Breakdown alasan retur** (top 5)
- **Breakdown tipe kerusakan** (top 5)
- **Export PDF** untuk laporan lengkap
- **Refresh button** untuk data real-time
- **Responsive chart layout**
- **Viewer-only access**

### 8. Riwayat Inventaris
- **Audit trail lengkap** untuk semua transaksi:
  - INBOUND_QC (Barang masuk)
  - OUTBOUND_PACKING (Barang keluar)
  - RETURN (Retur)
  - DAMAGE (Barang rusak)
- **Filter by type**: Semua, Masuk, Keluar, Retur, Rusak
- **Date range filter**
- **Search by SKU/nama produk**
- **Adjustment reasons display**
- **Pagination** (20 items per page)
- **Export PDF** untuk laporan
- **Auto-refresh** setiap 30 detik
- **Clear history** dengan konfirmasi
- **Viewer-only access**

### 9. User Management (Admin Only)
- **Add user**: Email, password, full name, role
- **Edit user**: Update informasi user
- **Delete user**: Hapus user account
- **Role assignment**: Admin, Staff, Viewer
- **User list** dengan filtering
- **Role-based permissions enforcement**

### 10. UI/UX Features
- **Dark/Light theme toggle**:
  - Persistence di localStorage
  - Toggle di navigasi desktop dan mobile
  - Direct access di mobile (tanpa hamburger menu)
- **Responsive design**:
  - Mobile-first approach
  - Hamburger menu dengan toggle behavior
  - Compact layout untuk mobile
  - Touch-friendly buttons
- **Skeleton loading states** untuk semua halaman
- **Toast notifications** untuk feedback
- **Modal dialogs** untuk konfirmasi dan input
- **Smooth animations** dan transitions
- **Accessibility**: ARIA labels, keyboard navigation

## 🛠️ Teknologi

### Frontend
- **Framework**: Next.js 16.3.3 (App Router, Turbopack)
- **Language**: TypeScript (full type safety)
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **State Management**: React Context API
- **Font**: Plus Jakarta Sans (Google Fonts)

### Backend & Database
- **Database**: Supabase (PostgreSQL 15+)
- **ORM**: Supabase Client SDK
- **RPC Functions**: Custom database functions untuk atomic operations
- **Row Level Security (RLS)**: Production-ready security

### Libraries & Integrations
- **PDF Generation**: jsPDF, jsPDF-autotable
- **QR Code**: react-qr-code, html5-qrcode
- **Charts**: Recharts
- **Excel**: xlsx
- **Barcode Scanning**: html5-qrcode (camera + USB/Bluetooth)
- **Authentication**: Custom session-based with cookies

### Performance
- **Caching**: In-memory cache dengan TTL
- **Optimization**: Database indexes, selective field selection
- **Build**: Turbopack untuk build times cepat

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ atau 20+
- npm, yarn, atau pnpm package manager
- Akun Supabase (tier gratis bisa digunakan)
- Git untuk version control

### Installation Steps

1. **Clone repository**
```bash
git clone https://github.com/FrumiousNyx/managemen-gudang.git
cd inventory-app
```

2. **Install dependencies**
```bash
npm install
# atau
yarn install
# atau
pnpm install
```

3. **Setup Database Supabase**
- Buat proyek baru di [Supabase](https://supabase.com)
- Jalankan skema SQL dari `supabase-schema.sql` di SQL Editor
- Buat RPC function `deduct_product_stock`
- Dapatkan Project URL dan anon key dari Settings → API

4. **Configure environment variables**
```bash
# Copy dari .env.example
cp .env.example .env.local
```

Edit `.env.local`:
```bash
# Konfigurasi Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

5. **Run development server**
```bash
npm run dev
```

Aplikasi akan tersedia di [http://localhost:3000](http://localhost:3000)

### Default Users
```
Admin: tenze@gudang.com / tenzeid
Viewer: tonzc@gudang.com / tonzcid
```

## 🔐 Security Features

### Authentication
- **Custom session-based authentication** dengan cookies
- **Middleware protection** untuk semua protected routes
- **24-hour session expiration**
- **RBAC (Role-Based Access Control)**:
  - Admin: Full access (products, users, semua operasi)
  - Staff: QC inbound, packing outbound, retur, products
  - Viewer: Dashboard, analytics, history (read-only)

### Data Security
- **No hardcoded credentials** di source code
- **Environment variables** untuk sensitive data
- **Row Level Security (RLS)** recommended untuk production
- **Atomic database operations** untuk prevent race conditions
- **Audit trail** untuk semua inventory changes

### Best Practices
- Ganti default credentials di production
- Gunakan Supabase service role keys hanya server-side
- Enable RLS policies di Supabase
- Regular database backups
- Monitor dan rotate API keys

## Environment Variables

| Variable | Deskripsi | Required |
|----------|-----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek Supabase | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase | ✅ Yes |

## 🗄️ Database Schema

Aplikasi menggunakan Supabase PostgreSQL dengan tabel berikut:

### `products`
Master SKU dan informasi produk
- `id`: UUID (Primary Key)
- `sku`: TEXT (Unique) - SKU produk
- `name`: TEXT - Nama produk
- `color`: TEXT - Warna produk
- `size`: TEXT - Ukuran produk
- `stock`: INTEGER - Jumlah stok
- `stock_threshold`: INTEGER - Threshold minimum stok (DEFAULT 40, CHECK > 0)
- `created_at`: TIMESTAMP - Waktu dibuat

### `inventory_logs`
Audit trail untuk semua transaksi
- `id`: UUID (Primary Key)
- `product_id`: UUID (Foreign Key ke products)
- `type`: TEXT - Tipe transaksi (INBOUND_QC, OUTBOUND_PACKING, RETURN, DAMAGE)
- `qty`: INTEGER - Jumlah perubahan stok
- `notes`: TEXT - Catatan transaksi (termasuk alasan penyesuaian)
- `return_reason`: TEXT - Alasan retur (untuk type RETURN)
- `damage_type`: TEXT - Tipe kerusakan (untuk type DAMAGE)
- `created_at`: TIMESTAMP - Waktu transaksi

### `users`
User management dengan RBAC
- `id`: UUID (Primary Key)
- `email`: TEXT (Unique) - Email user
- `password_hash`: TEXT - Hash password
- `full_name`: TEXT - Nama lengkap
- `role`: TEXT - Role user (admin, staff, viewer)
- `created_at`: TIMESTAMP - Waktu dibuat

### Database Functions
- `deduct_product_stock`: Fungsi aman untuk pengurangan stok dengan row locking dan validation

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
- `idx_users_email`: Index untuk lookup user by email

Lihat [supabase-schema.sql](./supabase-schema.sql) untuk skema database lengkap.



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
