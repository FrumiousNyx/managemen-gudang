# managemen-gudang

Aplikasi web manajemen inventaris yang siap produksi, ramah mobile untuk merek pakaian menggunakan Next.js 14+, Tailwind CSS, TypeScript, Lucide Icons, dan Supabase.

## Fitur

- **Dasbor Stok**: Metrik inventaris real-time dengan fungsi pencarian
- **Input QC**: Tambah produk yang lulus quality control ke stok gudang
- **Pengemasan**: Pemindaian barcode multi-mode (Satu/Banyak) dengan operasi database atomik
- **Master SKU**: Kelola SKU produk dan informasi inventaris
- **UI/UX Modern**: Estetika Dashboard Apple/Tesla dengan dukungan mode gelap

## Teknologi

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Font**: Inter (Google Fonts)

## Memulai

1. Clone repository
2. Install dependencies: `npm install`
3. Set up database Supabase menggunakan `supabase-schema.sql`
4. Konfigurasi environment variables di `.env.local`
5. Jalankan development server: `npm run dev`

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=url-proyek-supabase-anda
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key-supabase-anda
```

## Instruksi Setup

Lihat [SETUP.md](./SETUP.md) untuk instruksi setup detail.

## Skema Database

Aplikasi menggunakan Supabase PostgreSQL dengan tabel berikut:
- `products`: Informasi produk dan level stok
- `inventory_logs`: Audit trail untuk semua transaksi inventaris

Lihat [supabase-schema.sql](./supabase-schema.sql) untuk skema database lengkap.
