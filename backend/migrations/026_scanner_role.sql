ALTER TABLE admins MODIFY role ENUM('super_admin', 'staff', 'scanner') NOT NULL DEFAULT 'staff';
