# managemen-gudang

A production-ready, mobile-friendly inventory management web application for clothing brands using Next.js 14+, Tailwind CSS, TypeScript, Lucide Icons, and Supabase.

## Features

- **Dashboard Stok**: Real-time inventory metrics with search functionality
- **QC Inbound**: Add products that passed quality control to warehouse stock
- **Packing Outbound**: Multi-mode barcode scanning (Single/Bulk) with atomic database operations
- **Master SKU**: Manage product SKUs and inventory information
- **Modern UI/UX**: Apple/Tesla Dashboard aesthetic with dark mode support

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Font**: Inter (Google Fonts)

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Supabase database using `supabase-schema.sql`
4. Configure environment variables in `.env.local`
5. Run development server: `npm run dev`

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Setup Instructions

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Database Schema

The application uses Supabase PostgreSQL with the following tables:
- `products`: Product information and stock levels
- `inventory_logs`: Audit trail for all inventory transactions

See [supabase-schema.sql](./supabase-schema.sql) for the complete database schema.
