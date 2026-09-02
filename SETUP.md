# Sistem Manajemen Inventaris - Instruksi Setup

Aplikasi web manajemen inventaris yang siap produksi, ramah mobile untuk merek pakaian menggunakan Next.js 14+, Tailwind CSS, TypeScript, Lucide Icons, dan Supabase.

## Prasyarat

- Node.js 18+ terinstall
- npm atau yarn package manager
- Akun Supabase (tier gratis bisa digunakan)
- Pemindai barcode USB/Bluetooth (untuk fungsi pengemasan)

## Langkah 1: Setup Proyek

Proyek sudah dibuat dengan Next.js 14+ dan semua dependensi yang diperlukan sudah terinstall.

Navigasi ke direktori proyek:
```bash
cd inventory-app
```

## Langkah 2: Setup Database Supabase

### 2.1 Buat Proyek Supabase

1. Buka [https://supabase.com](https://supabase.com)
2. Sign up atau log in
3. Klik "New Project"
4. Isi detail proyek:
   - Name: `inventory-management`
   - Database Password: (pilih password yang kuat)
   - Region: Pilih region terdekat dengan pengguna Anda
5. Tunggu proyek dibuat (2-3 menit)

### 2.2 Jalankan Skema SQL

1. Di dashboard proyek Supabase Anda, buka tab "SQL Editor"
2. Klik "New Query"
3. Copy isi dari `supabase-schema.sql` dari root proyek
4. Paste ke SQL editor
5. Klik "Run" untuk menjalankan skema

Ini akan membuat:
- Tabel `products` dengan data sampel
- Tabel `inventory_logs` untuk audit trail
- Index yang diperlukan untuk performa
- Fungsi helper untuk update stok (`update_stock_with_log`)
- Fungsi RPC atomik untuk pengurangan stok aman (`deduct_product_stock`) untuk mencegah race conditions

### 2.3 Dapatkan Kredensial Supabase

1. Di dashboard proyek Supabase Anda, buka "Settings" → "API"
2. Copy nilai berikut:
   - Project URL
   - anon/public key

## Langkah 3: Environment Variables

Buat file `.env.local` di root proyek:

```bash
# Konfigurasi Supabase
NEXT_PUBLIC_SUPABASE_URL=url-proyek-supabase-anda
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key-supabase-anda
```

Ganti nilai placeholder dengan kredensial Supabase Anda dari Langkah 2.3.

**Penting:** Jangan pernah commit `.env.local` ke version control. Sudah ada di `.gitignore`.

## Langkah 4: Jalankan Development Server

Jalankan development server:

```bash
npm run dev
```

Aplikasi akan tersedia di [http://localhost:3000](http://localhost:3000)

## Langkah 5: Fitur Aplikasi

### Dasbor Stok (Halaman Utama)
- Metrik inventaris real-time
- Fungsi pencarian berdasarkan Nama/SKU/Warna/Ukuran
- Indikator status stok (Aman/Menipis/Habis)
- Tabel data responsif

### Input QC (Masuk)
- Cari dan pilih SKU produk
- Masukkan jumlah barang yang lulus QC
- Penambahan stok otomatis dan logging audit
- Notifikasi toast untuk sukses/error

### Pindai Keluar (Pengemasan)
- **Pindai Multi-Mode**: Beralih antara mode Satu Pindai (-1) dan Banyak Pindai (-N)
- **Mode Satu Pindai**: Setiap pindai barcode mengurangi 1 unit dari stok (default)
- **Mode Banyak Pindai**: Masukkan jumlah terlebih dahulu, lalu pindai barcode sekali untuk mengurangi banyak unit
- **Keamanan Auto-Reset**: Jumlah otomatis reset ke 1 setiap setiap pindai banyak untuk mencegah error
- **Validasi Stok**: Mencegah overselling dengan pesan error yang jelas menampilkan sisa stok
- **Operasi Atomik**: Menggunakan Supabase RPC untuk mencegah race conditions di lingkungan multi-user
- Input auto-focused untuk pemindai barcode
- Feedback audio (beep sukses/error)
- Tampilan item yang baru dipindai dengan informasi jumlah
- Penanganan error untuk SKU yang hilang atau stok tidak cukup

### Manajemen Master SKU
- Tambah SKU produk baru dengan form modal
- Lihat semua produk dalam tabel
- Hapus produk (dengan konfirmasi)
- Indikator status stok

## Fitur Lanjutan

### Pindai Keluar Multi-Mode
Sistem pengemasan sekarang mendukung dua mode pemindaian untuk fleksibilitas operasional:

**Mode Satu Pindai (Default)**
- Terbaik untuk: Pengemasan item individu, pesanan e-commerce
- Perilaku: Setiap pindai barcode mengurangi tepat 1 unit
- Kasus penggunaan: Saat mengemas pesanan dengan SKU berbeda

**Mode Banyak Pindai**
- Terbaik untuk: Pesanan grosir, pemrosesan batch
- Perilaku: Masukkan jumlah sekali, pindai barcode sekali untuk mengurangi banyak unit
- Keamanan: Jumlah auto-reset ke 1 setiap setiap pindai sukses
- Kasus penggunaan: Saat mengemas 50 unit dari SKU yang sama

### Operasi Database Atomik
Sistem menggunakan row-level locking PostgreSQL melalui fungsi RPC Supabase untuk mencegah race conditions:

- **Masalah**: Beberapa staf memindai SKU yang sama secara bersamaan bisa menyebabkan stok menjadi negatif
- **Solusi**: Fungsi `deduct_product_stock` menggunakan `FOR UPDATE` untuk mengunci baris selama transaksi
- **Manfaat**: Menjamin stok tidak pernah di bawah nol, bahkan dengan pindai bersamaan
- **Implementasi**: Operasi atomik aman dengan penanganan error yang benar

### Validasi Stok
- Pengecekan stok real-time sebelum pengurangan
- Pesan error yang jelas menampilkan sisa stok saat tidak cukup
- Mencegah overselling dan menjaga akurasi inventaris
- Membedakan antara error "SKU tidak ditemukan" dan "stok tidak cukup"

## Langkah 6: Setup Pemindai Barcode

### Hardware yang Direkomendasikan
- Pemindai Barcode USB (bertindak sebagai input keyboard)
- Pemindai Barcode Bluetooth (opsi portabel)

### Konfigurasi
1. Hubungkan pemindai barcode Anda ke komputer
2. Pastikan dikonfigurasi untuk mengirim tombol "Enter" setiap setiap pindai
3. Sebagian besar pemindai bekerja langsung - cukup colok dan mainkan
4. Tes dengan memindai barcode di field teks apa pun

### Menggunakan Pemindai
1. Navigasi ke halaman "Pindai Keluar (Pengemasan)"
2. Pilih mode pemindaian Anda:
   - **Satu Pindai**: Untuk pengemasan item individu (default)
   - **Banyak Pindai**: Untuk memproses banyak unit dari SKU yang sama
3. Untuk mode Banyak Pindai:
   - Masukkan jumlah di field input (contoh: "15")
   - Pindai barcode sekali
   - Sistem akan mengurangi 15 unit dan reset jumlah ke 1
4. Untuk mode Satu Pindai:
   - Cukup pindai setiap barcode secara individu
   - Setiap pindai mengurangi 1 unit dari stok
5. Feedback audio mengkonfirmasi pindai sukses
6. Field input auto-focus untuk pindai berkelanjutan

## Langkah 7: Deployment Produksi

### Build untuk Produksi

```bash
npm run build
```

### Deploy ke Vercel (Direkomendasikan)

1. Push kode Anda ke GitHub
2. Buka [https://vercel.com](https://vercel.com)
3. Import repository Anda
4. Tambah environment variables di dashboard Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

### Opsi Deployment Alternatif

- **Netlify**: Hubungkan repository GitHub Anda dan tambah environment variables
- **Railway**: Deployment langsung dengan environment variables
- **Self-hosted**: Gunakan `npm start` setelah build

## Keamanan Database

Untuk penggunaan produksi, pertimbangkan untuk mengimplementasikan:

1. **Row Level Security (RLS)** di Supabase:
   ```sql
   -- Enable RLS
   ALTER TABLE products ENABLE ROW LEVEL SECURITY;
   ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
   
   -- Create policies (sesuaikan berdasarkan kebutuhan autentikasi Anda)
   CREATE POLICY "Public read access" ON products FOR SELECT USING (true);
   CREATE POLICY "Public read access" ON inventory_logs FOR SELECT USING (true);
   ```

2. **Autentikasi**: Tambah autentikasi user untuk membatasi akses
3. **API Keys**: Gunakan service role keys hanya untuk operasi sisi server

## Pemecahan Masalah

### Masalah Koneksi Database
- Verifikasi URL Supabase dan anon key Anda benar
- Periksa bahwa proyek Supabase Anda aktif
- Pastikan Anda telah menjalankan skema SQL

### Pemindai Barcode Tidak Berfungsi
- Verifikasi pemindai terhubung dengan benar
- Periksa bahwa mengirim tombol "Enter" setelah pindai
- Tes pemindai di text editor terlebih dahulu
- Pastikan field input difokuskan (seharusnya auto-focus)

### Error Build
- Bersihkan cache Next.js: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Periksa error TypeScript: `npm run build`

### Stok Tidak Update
- Periksa console browser untuk error
- Verifikasi permissions database
- Pastikan fungsi SQL `update_stock_with_log` dan `deduct_product_stock` ada
- Periksa bahwa fungsi RPC `deduct_product_stock` dibuat dengan benar di Supabase

### Masalah Pindai Banyak
- Verifikasi input jumlah tidak sengaja ditinggalkan dengan nilai tinggi
- Periksa bahwa jumlah reset ke 1 setiap setiap pindai sukses
- Pastikan validasi stok berfungsi (seharusnya menampilkan sisa stok pada error)
- Tes dengan mode pindai tunggal terlebih dahulu untuk mengisolasi masalah

### Error Race Condition
- Fungsi RPC atomik `deduct_product_stock` mencegah konflik pindai bersamaan
- Jika Anda melihat stok menjadi negatif, pastikan fungsi RPC disebarkan dengan benar
- Periksa bahwa row locking (`FOR UPDATE`) berfungsi di database PostgreSQL Anda

## Struktur File

```
inventory-app/
├── app/
│   ├── layout.tsx              # Root layout dengan navigasi
│   ├── page.tsx                # Dashboard
│   ├── qc-inbound/
│   │   └── page.tsx           # Form QC inbound
│   ├── packing-outbound/
│   │   └── page.tsx           # Pemindaian barcode
│   ├── products/
│   │   └── page.tsx           # Manajemen SKU
│   └── globals.css            # Global styles
├── components/
│   ├── navigation.tsx         # Komponen navigasi
│   ├── toast.tsx              # Notifikasi toast
│   └── toast-provider.tsx     # Provider konteks toast
├── lib/
│   └── supabase.ts            # Klien Supabase
├── supabase-schema.sql        # Skema database
├── package.json
├── tsconfig.json
└── SETUP.md                   # File ini
```

## Dukungan

Untuk masalah atau pertanyaan:
- Periksa dokumentasi Supabase: https://supabase.com/docs
- Dokumentasi Next.js: https://nextjs.org/docs
- Dokumentasi Tailwind CSS: https://tailwindcss.com/docs

## Lisensi

Proyek ini disediakan apa adanya untuk kebutuhan manajemen inventaris Anda.