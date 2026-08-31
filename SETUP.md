# Inventory Management System - Setup Instructions

A production-ready, mobile-friendly inventory management web application for clothing brands using Next.js 14+, Tailwind CSS, TypeScript, Lucide Icons, and Supabase.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works)
- USB/Bluetooth barcode scanner (for packing functionality)

## Step 1: Project Setup

The project has already been created with Next.js 14+ and all required dependencies installed.

Navigate to the project directory:
```bash
cd inventory-app
```

## Step 2: Supabase Database Setup

### 2.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in the project details:
   - Name: `inventory-management`
   - Database Password: (choose a strong password)
   - Region: Choose the closest region to your users
5. Wait for the project to be created (2-3 minutes)

### 2.2 Run the SQL Schema

1. In your Supabase project dashboard, go to the "SQL Editor" tab
2. Click "New Query"
3. Copy the contents of `supabase-schema.sql` from the project root
4. Paste it into the SQL editor
5. Click "Run" to execute the schema

This will create:
- `products` table with sample data
- `inventory_logs` table for audit trail
- Necessary indexes for performance
- Helper functions for stock updates (`update_stock_with_log`)
- Atomic RPC function for safe stock deduction (`deduct_product_stock`) to prevent race conditions

### 2.3 Get Supabase Credentials

1. In your Supabase project dashboard, go to "Settings" → "API"
2. Copy the following values:
   - Project URL
   - anon/public key

## Step 3: Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Replace the placeholder values with your actual Supabase credentials from Step 2.3.

**Important:** Never commit `.env.local` to version control. It's already in `.gitignore`.

## Step 4: Run the Development Server

Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Step 5: Application Features

### Dashboard Stok (Home Page)
- Real-time inventory metrics
- Search functionality by Name/SKU/Color/Size
- Stock status indicators (Aman/Menipis/Habis)
- Responsive data table

### Input QC (Inbound)
- Search and select product SKUs
- Enter quantity of items that passed QC
- Automatic stock addition and audit logging
- Toast notifications for success/error

### Scan Outbound (Packing)
- **Multi-Mode Scanning**: Switch between Single Scan (-1) and Bulk Scan (-N) modes
- **Single Scan Mode**: Each barcode scan deducts 1 unit from stock (default)
- **Bulk Scan Mode**: Enter quantity first, then scan barcode once to deduct multiple units
- **Auto-Reset Safety**: Quantity automatically resets to 1 after each bulk scan to prevent errors
- **Stock Validation**: Prevents overselling with clear error messages showing remaining stock
- **Atomic Operations**: Uses Supabase RPC to prevent race conditions in multi-user environments
- Auto-focused input for barcode scanners
- Audio feedback (success/error beeps)
- Recently scanned items display with quantity information
- Error handling for missing SKUs or insufficient stock

### Master SKU Management
- Add new product SKUs with modal form
- View all products in a table
- Delete products (with confirmation)
- Stock status indicators

## Advanced Features

### Multi-Mode Outbound Scanning
The packing system now supports two scanning modes for operational flexibility:

**Single Scan Mode (Default)**
- Best for: Individual item packing, e-commerce orders
- Behavior: Each barcode scan deducts exactly 1 unit
- Use case: When packing orders with different SKUs

**Bulk Scan Mode**
- Best for: Wholesale orders, batch processing
- Behavior: Enter quantity once, scan barcode once to deduct multiple units
- Safety: Quantity auto-resets to 1 after each successful scan
- Use case: When packing 50 units of the same SKU

### Atomic Database Operations
The system uses PostgreSQL row-level locking via Supabase RPC functions to prevent race conditions:

- **Problem**: Multiple staff scanning the same SKU simultaneously could cause stock to go negative
- **Solution**: `deduct_product_stock` function uses `FOR UPDATE` to lock rows during transactions
- **Benefit**: Guarantees stock never goes below zero, even with concurrent scans
- **Implementation**: Safe atomic operations with proper error handling

### Stock Validation
- Real-time stock checking before deduction
- Clear error messages showing remaining stock when insufficient
- Prevents overselling and maintains inventory accuracy
- Differentiates between "SKU not found" and "insufficient stock" errors

## Step 6: Barcode Scanner Setup

### Recommended Hardware
- USB Barcode Scanner (acts as keyboard input)
- Bluetooth Barcode Scanner (portable option)

### Configuration
1. Connect your barcode scanner to the computer
2. Ensure it's configured to send "Enter" key after each scan
3. Most scanners work out of the box - just plug and play
4. Test by scanning a barcode in any text field

### Using the Scanner
1. Navigate to "Scan Outbound (Packing)" page
2. Choose your scanning mode:
   - **Single Scan**: For individual item packing (default)
   - **Bulk Scan**: For processing multiple units of the same SKU
3. For Bulk Scan mode:
   - Enter the quantity in the input field (e.g., "15")
   - Scan the barcode once
   - System will deduct 15 units and reset quantity to 1
4. For Single Scan mode:
   - Simply scan each barcode individually
   - Each scan deducts 1 unit from stock
5. Audio feedback confirms successful scans
6. Input field auto-focuses for continuous scanning

## Step 7: Production Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [https://vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

### Alternative Deployment Options

- **Netlify**: Connect your GitHub repository and add environment variables
- **Railway**: Direct deployment with environment variables
- **Self-hosted**: Use `npm start` after building

## Database Security

For production use, consider implementing:

1. **Row Level Security (RLS)** in Supabase:
   ```sql
   -- Enable RLS
   ALTER TABLE products ENABLE ROW LEVEL SECURITY;
   ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
   
   -- Create policies (customize based on your authentication needs)
   CREATE POLICY "Public read access" ON products FOR SELECT USING (true);
   CREATE POLICY "Public read access" ON inventory_logs FOR SELECT USING (true);
   ```

2. **Authentication**: Add user authentication to restrict access
3. **API Keys**: Use service role keys for server-side operations only

## Troubleshooting

### Database Connection Issues
- Verify your Supabase URL and anon key are correct
- Check that your Supabase project is active
- Ensure you've run the SQL schema

### Barcode Scanner Not Working
- Verify the scanner is properly connected
- Check that it sends "Enter" key after scans
- Test the scanner in a text editor first
- Ensure the input field is focused (it should auto-focus)

### Build Errors
- Clear Next.js cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run build`

### Stock Not Updating
- Check browser console for errors
- Verify database permissions
- Ensure the SQL functions `update_stock_with_log` and `deduct_product_stock` exist
- Check that the RPC function `deduct_product_stock` is properly created in Supabase

### Bulk Scan Issues
- Verify quantity input is not accidentally left at a high value
- Check that quantity resets to 1 after each successful scan
- Ensure stock validation is working (should show remaining stock on error)
- Test with single scan mode first to isolate issues

### Race Condition Errors
- The atomic RPC function `deduct_product_stock` prevents concurrent scan conflicts
- If you see stock going negative, ensure the RPC function is properly deployed
- Check that row locking (`FOR UPDATE`) is working in your PostgreSQL database

## File Structure

```
inventory-app/
├── app/
│   ├── layout.tsx              # Root layout with navigation
│   ├── page.tsx                # Dashboard
│   ├── qc-inbound/
│   │   └── page.tsx           # QC inbound form
│   ├── packing-outbound/
│   │   └── page.tsx           # Barcode scanning
│   ├── products/
│   │   └── page.tsx           # SKU management
│   └── globals.css            # Global styles
├── components/
│   ├── navigation.tsx         # Navigation component
│   ├── toast.tsx              # Toast notification
│   └── toast-provider.tsx     # Toast context provider
├── lib/
│   └── supabase.ts            # Supabase client
├── supabase-schema.sql        # Database schema
├── package.json
├── tsconfig.json
└── SETUP.md                   # This file
```

## Support

For issues or questions:
- Check the Supabase documentation: https://supabase.com/docs
- Next.js documentation: https://nextjs.org/docs
- Tailwind CSS documentation: https://tailwindcss.com/docs

## License

This project is provided as-is for your inventory management needs.