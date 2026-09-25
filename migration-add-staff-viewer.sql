-- Migration: Add Staff and Viewer Users
-- This adds staff and viewer users to complement the existing admin user

-- Insert staff user
INSERT INTO users (email, password_hash, full_name, role) 
VALUES 
('staff@gudang.com', 'staff123', 'Staff Gudang', 'staff')
ON CONFLICT (email) DO NOTHING;

-- Insert viewer user
INSERT INTO users (email, password_hash, full_name, role) 
VALUES 
('viewer@gudang.com', 'viewer123', 'Viewer Gudang', 'viewer')
ON CONFLICT (email) DO NOTHING;

-- Note: For production, consider:
-- 1. Using bcrypt for password hashing instead of plain text
-- 2. Adding email verification
-- 3. Setting up proper RBAC policies
-- 4. Enabling Row Level Security (RLS)
