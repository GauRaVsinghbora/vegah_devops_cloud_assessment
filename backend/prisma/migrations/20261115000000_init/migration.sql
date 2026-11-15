CREATE TABLE `users` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `urls` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `original_url` TEXT NOT NULL,
    `short_code` VARCHAR(16) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `urls_short_code_key`(`short_code`),
    INDEX `urls_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `urls_status_short_code_idx`(`status`, `short_code`),
    PRIMARY KEY (`id`),
    CONSTRAINT `urls_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
