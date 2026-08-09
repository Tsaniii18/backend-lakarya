CREATE TABLE `roles` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` ENUM('STAF', 'MANAJER') NOT NULL,
  `description` VARCHAR(255) NULL,
  UNIQUE INDEX `roles_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `departments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  UNIQUE INDEX `departments_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `department_id` INTEGER NOT NULL,
  `role_id` INTEGER NOT NULL,
  `employee_number` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `account_status` ENUM('MENUNGGU', 'AKTIF', 'DITANGGUHKAN', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
  `profile_pict_url` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_employee_number_key`(`employee_number`),
  UNIQUE INDEX `users_email_key`(`email`),
  INDEX `users_department_id_idx`(`department_id`),
  INDEX `users_role_id_idx`(`role_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `users_session` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `ip` VARCHAR(45) NULL,
  `device` VARCHAR(150) NULL,
  `agent` VARCHAR(500) NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  INDEX `users_session_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `leaves_balance` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `employee_id` INTEGER NOT NULL,
  `year` INTEGER NOT NULL,
  `total_days` INTEGER NOT NULL,
  `reserved_days` INTEGER NOT NULL DEFAULT 0,
  `used_days` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `leaves_balance_employee_id_year_key`(`employee_id`, `year`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `requests` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `requester_id` INTEGER NOT NULL,
  `type` ENUM('CUTI', 'IZIN', 'PENGGANTIAN_BIAYA') NOT NULL,
  `status` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN') NOT NULL DEFAULT 'MENUNGGU',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `completed_at` DATETIME(3) NULL,
  INDEX `requests_requester_id_idx`(`requester_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `leave_requests` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `request_id` INTEGER NOT NULL,
  `leave_type` ENUM('TAHUNAN', 'KHUSUS') NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `leave_requests_request_id_key`(`request_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `permission_requests` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `request_id` INTEGER NOT NULL,
  `permission_type` ENUM('HARIAN', 'JAM') NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `total_days` DECIMAL(5, 2) NOT NULL,
  `start_time` TIME(0) NULL,
  `end_time` TIME(0) NULL,
  `reason` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `permission_requests_request_id_key`(`request_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reimbursement_requests` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `request_id` INTEGER NOT NULL,
  `expense_type` ENUM('TRANSPORTASI', 'KONSUMSI', 'OPERASIONAL', 'LAINNYA') NOT NULL,
  `expense_date` DATE NOT NULL,
  `expense_amount` DECIMAL(14, 2) NOT NULL,
  `description` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `reimbursement_requests_request_id_key`(`request_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `request_approvals` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `request_id` INTEGER NOT NULL,
  `approver_id` INTEGER NOT NULL,
  `step_order` INTEGER NOT NULL,
  `status` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
  `review_note` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `reviewed_at` DATETIME(3) NULL,
  UNIQUE INDEX `request_approvals_request_id_approver_id_key`(`request_id`, `approver_id`),
  UNIQUE INDEX `request_approvals_request_id_step_order_key`(`request_id`, `step_order`),
  INDEX `request_approvals_approver_id_idx`(`approver_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `complaints` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reporter_id` INTEGER NOT NULL,
  `handler_id` INTEGER NULL,
  `subject` VARCHAR(191) NOT NULL,
  `category` ENUM('PERORANGAN', 'FASILITAS', 'LAINNYA') NOT NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('TERBUKA', 'DIPROSES', 'SELESAI', 'DITUTUP') NOT NULL DEFAULT 'TERBUKA',
  `resolution_note` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewed_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `complaints_reporter_id_idx`(`reporter_id`),
  INDEX `complaints_handler_id_idx`(`handler_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `attachment_files` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `complaint_id` INTEGER NULL,
  `request_id` INTEGER NULL,
  `cdn_public_id` VARCHAR(255) NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_byte` INTEGER NOT NULL,
  `attachment_type` ENUM('PENGAJUAN', 'KELUHAN') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `attachment_files_complaint_id_idx`(`complaint_id`),
  INDEX `attachment_files_request_id_idx`(`request_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `users` ADD CONSTRAINT `users_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `users_session` ADD CONSTRAINT `users_session_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `leaves_balance` ADD CONSTRAINT `leaves_balance_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `requests` ADD CONSTRAINT `requests_requester_id_fkey` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `permission_requests` ADD CONSTRAINT `permission_requests_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `reimbursement_requests` ADD CONSTRAINT `reimbursement_requests_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `request_approvals` ADD CONSTRAINT `request_approvals_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `request_approvals` ADD CONSTRAINT `request_approvals_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `complaints` ADD CONSTRAINT `complaints_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `complaints` ADD CONSTRAINT `complaints_handler_id_fkey` FOREIGN KEY (`handler_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `attachment_files` ADD CONSTRAINT `attachment_files_complaint_id_fkey` FOREIGN KEY (`complaint_id`) REFERENCES `complaints`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `attachment_files` ADD CONSTRAINT `attachment_files_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
