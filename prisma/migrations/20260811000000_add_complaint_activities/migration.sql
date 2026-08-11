CREATE TABLE `complaint_activities` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `complaint_id` INTEGER NOT NULL,
  `actor_id` INTEGER NOT NULL,
  `from_status` ENUM('TERBUKA', 'DIPROSES', 'SELESAI', 'DITUTUP') NULL,
  `to_status` ENUM('TERBUKA', 'DIPROSES', 'SELESAI', 'DITUTUP') NOT NULL,
  `note` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `complaint_activities_complaint_id_idx`(`complaint_id`),
  INDEX `complaint_activities_actor_id_idx`(`actor_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `complaint_activities` (
  `complaint_id`,
  `actor_id`,
  `from_status`,
  `to_status`,
  `note`,
  `created_at`
)
SELECT
  `id`,
  COALESCE(`handler_id`, `reporter_id`),
  NULL,
  `status`,
  CASE
    WHEN NULLIF(TRIM(`resolution_note`), '') IS NOT NULL THEN `resolution_note`
    ELSE 'Riwayat awal sebelum pencatatan aktivitas.'
  END,
  CASE
    WHEN `status` <> 'TERBUKA' AND `reviewed_at` IS NOT NULL THEN `reviewed_at`
    ELSE `created_at`
  END
FROM `complaints`;

ALTER TABLE `complaint_activities`
  ADD CONSTRAINT `complaint_activities_complaint_id_fkey`
  FOREIGN KEY (`complaint_id`) REFERENCES `complaints`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `complaint_activities`
  ADD CONSTRAINT `complaint_activities_actor_id_fkey`
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
