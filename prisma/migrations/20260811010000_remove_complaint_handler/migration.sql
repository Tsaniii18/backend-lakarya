ALTER TABLE `complaints`
  DROP FOREIGN KEY `complaints_handler_id_fkey`;

DROP INDEX `complaints_handler_id_idx` ON `complaints`;

ALTER TABLE `complaints`
  DROP COLUMN `handler_id`;
