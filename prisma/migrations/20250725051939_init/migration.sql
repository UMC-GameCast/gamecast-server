-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sid` VARCHAR(191) NOT NULL,
    `data` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sid_key`(`sid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_users` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(255) NOT NULL,
    `nickname` VARCHAR(50) NOT NULL,
    `room_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_active_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,
    `user_settings` JSON NULL,

    UNIQUE INDEX `guest_users_session_id_key`(`session_id`),
    INDEX `idx_guest_users_expires_at`(`expires_at`),
    UNIQUE INDEX `idx_room_unique_nickname`(`room_id`, `nickname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` VARCHAR(191) NOT NULL,
    `room_code` VARCHAR(8) NOT NULL,
    `host_guest_id` VARCHAR(36) NULL,
    `room_name` VARCHAR(100) NOT NULL,
    `max_capacity` INTEGER NOT NULL DEFAULT 5,
    `current_capacity` INTEGER NOT NULL DEFAULT 0,
    `room_state` ENUM('waiting', 'active', 'recording', 'processing', 'completed', 'expired') NOT NULL DEFAULT 'waiting',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,
    `room_settings` JSON NULL,

    UNIQUE INDEX `rooms_room_code_key`(`room_code`),
    INDEX `idx_rooms_code`(`room_code`),
    INDEX `idx_rooms_expires_at`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_participants` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(36) NOT NULL,
    `guest_user_id` VARCHAR(36) NOT NULL,
    `role` ENUM('host', 'participant') NOT NULL DEFAULT 'participant',
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `left_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `preparation_status` JSON NULL,

    UNIQUE INDEX `room_participants_room_id_guest_user_id_key`(`room_id`, `guest_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(36) NOT NULL,
    `session_type` VARCHAR(20) NOT NULL DEFAULT 'voice_chat',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,
    `participant_count` INTEGER NULL,
    `session_metadata` JSON NULL,
    `recording_enabled` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_participants` (
    `session_id` VARCHAR(36) NOT NULL,
    `guest_user_id` VARCHAR(36) NOT NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `left_at` DATETIME(3) NULL,
    `audio_quality_stats` JSON NULL,

    PRIMARY KEY (`session_id`, `guest_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `character_categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `display_order` INTEGER NOT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `character_components` (
    `id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `asset_file_path` VARCHAR(512) NOT NULL,
    `preview_image_path` VARCHAR(512) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `metadata` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_characters` (
    `id` VARCHAR(191) NOT NULL,
    `guest_user_id` VARCHAR(36) NOT NULL,
    `room_id` VARCHAR(36) NOT NULL,
    `character_name` VARCHAR(100) NULL,
    `is_setup_complete` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `guest_characters_guest_user_id_room_id_key`(`guest_user_id`, `room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_character_customizations` (
    `character_id` VARCHAR(36) NOT NULL,
    `component_id` VARCHAR(36) NOT NULL,
    `customization_data` JSON NULL,
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`character_id`, `component_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recording_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(36) NOT NULL,
    `initiator_guest_id` VARCHAR(36) NULL,
    `session_name` VARCHAR(255) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,
    `duration_seconds` INTEGER NULL,
    `status` ENUM('recording', 'processing', 'completed', 'failed', 'expired') NOT NULL DEFAULT 'recording',
    `storage_path` VARCHAR(1024) NULL,
    `total_file_size_bytes` BIGINT NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NULL,
    `recording_settings` JSON NULL,

    INDEX `idx_recording_sessions_expires_at`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_assets` (
    `id` VARCHAR(191) NOT NULL,
    `recording_session_id` VARCHAR(36) NOT NULL,
    `guest_user_id` VARCHAR(36) NOT NULL,
    `asset_type` VARCHAR(50) NOT NULL,
    `original_filename` VARCHAR(512) NULL,
    `file_path` VARCHAR(1024) NOT NULL,
    `mime_type` VARCHAR(100) NULL,
    `file_size_bytes` BIGINT NULL,
    `duration_seconds` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processing_status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    `technical_metadata` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `highlight_analysis` (
    `id` VARCHAR(191) NOT NULL,
    `recording_session_id` VARCHAR(36) NOT NULL,
    `analysis_algorithm` VARCHAR(100) NOT NULL,
    `analysis_parameters` JSON NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `status` ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `highlight_clips` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(36) NOT NULL,
    `clip_name` VARCHAR(255) NULL,
    `start_timestamp` DECIMAL(10, 3) NOT NULL,
    `end_timestamp` DECIMAL(10, 3) NOT NULL,
    `confidence_score` DECIMAL(3, 2) NULL,
    `highlight_type` ENUM('voice_spike', 'laughter') NOT NULL,
    `detection_features` JSON NULL,
    `main_source_file_path` VARCHAR(1024) NULL,
    `is_selected` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `additional_source_clips` (
    `id` VARCHAR(191) NOT NULL,
    `highlight_clip_id` VARCHAR(36) NOT NULL,
    `guest_user_id` VARCHAR(36) NOT NULL,
    `source_file_path` VARCHAR(1024) NOT NULL,
    `added_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subtitle_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `highlight_clip_id` VARCHAR(36) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL DEFAULT 'ko',
    `stt_provider` VARCHAR(50) NOT NULL DEFAULT 'RTZR',
    `processing_status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subtitle_segments` (
    `id` VARCHAR(191) NOT NULL,
    `subtitle_session_id` VARCHAR(36) NOT NULL,
    `guest_user_id` VARCHAR(36) NOT NULL,
    `start_timestamp` DECIMAL(10, 3) NOT NULL,
    `end_timestamp` DECIMAL(10, 3) NOT NULL,
    `original_text` TEXT NULL,
    `edited_text` TEXT NULL,
    `confidence_score` DECIMAL(3, 2) NULL,
    `sequence_number` INTEGER NOT NULL,
    `subtitle_style` ENUM('standard', 'character', 'emotional') NOT NULL DEFAULT 'standard',
    `emotion_type` ENUM('joy', 'sad', 'angry', 'frustrated') NULL,
    `is_main_speaker` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_processing_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `recording_session_id` VARCHAR(36) NOT NULL,
    `job_type` VARCHAR(50) NOT NULL,
    `input_file_paths` JSON NOT NULL,
    `output_file_path` VARCHAR(1024) NULL,
    `ffmpeg_command` TEXT NULL,
    `processing_preset` VARCHAR(100) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'queued',
    `progress_percentage` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `client_session_id` VARCHAR(255) NULL,
    `error_log` TEXT NULL,
    `processing_metadata` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_evaluations` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(36) NOT NULL,
    `guest_user_id` VARCHAR(36) NOT NULL,
    `evaluator_role` ENUM('host', 'participant') NOT NULL,
    `overall_satisfaction` INTEGER NULL,
    `audio_quality_rating` INTEGER NULL,
    `video_quality_rating` INTEGER NULL,
    `ease_of_use_rating` INTEGER NULL,
    `editing_experience_rating` INTEGER NULL,
    `highlight_detection_accuracy` INTEGER NULL,
    `subtitle_quality_rating` INTEGER NULL,
    `positive_feedback` TEXT NULL,
    `improvement_suggestions` TEXT NULL,
    `session_duration_minutes` INTEGER NULL,
    `total_participants` INTEGER NULL,
    `technical_issues_encountered` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quality_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(36) NULL,
    `recording_session_id` VARCHAR(36) NULL,
    `metric_type` VARCHAR(50) NOT NULL,
    `metric_value` DECIMAL(10, 3) NOT NULL,
    `measurement_timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `context_data` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ip_access_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ip_address` VARCHAR(45) NOT NULL,
    `room_code` VARCHAR(8) NULL,
    `access_count` INTEGER NOT NULL DEFAULT 1,
    `first_access` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_access` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_blocked` BOOLEAN NOT NULL DEFAULT false,

    INDEX `idx_ip_access_log_ip`(`ip_address`),
    INDEX `idx_ip_access_log_blocked`(`is_blocked`),
    UNIQUE INDEX `idx_ip_room_unique`(`ip_address`, `room_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `guest_users` ADD CONSTRAINT `guest_users_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_host_guest_id_fkey` FOREIGN KEY (`host_guest_id`) REFERENCES `guest_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_participants` ADD CONSTRAINT `room_participants_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_participants` ADD CONSTRAINT `room_participants_guest_user_id_fkey` FOREIGN KEY (`guest_user_id`) REFERENCES `guest_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_sessions` ADD CONSTRAINT `voice_sessions_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `voice_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_guest_user_id_fkey` FOREIGN KEY (`guest_user_id`) REFERENCES `guest_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `character_components` ADD CONSTRAINT `character_components_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `character_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guest_characters` ADD CONSTRAINT `guest_characters_guest_user_id_fkey` FOREIGN KEY (`guest_user_id`) REFERENCES `guest_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guest_character_customizations` ADD CONSTRAINT `guest_character_customizations_character_id_fkey` FOREIGN KEY (`character_id`) REFERENCES `guest_characters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guest_character_customizations` ADD CONSTRAINT `guest_character_customizations_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `character_components`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recording_sessions` ADD CONSTRAINT `recording_sessions_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recording_sessions` ADD CONSTRAINT `recording_sessions_initiator_guest_id_fkey` FOREIGN KEY (`initiator_guest_id`) REFERENCES `guest_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_recording_session_id_fkey` FOREIGN KEY (`recording_session_id`) REFERENCES `recording_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_guest_user_id_fkey` FOREIGN KEY (`guest_user_id`) REFERENCES `guest_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `highlight_analysis` ADD CONSTRAINT `highlight_analysis_recording_session_id_fkey` FOREIGN KEY (`recording_session_id`) REFERENCES `recording_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `highlight_clips` ADD CONSTRAINT `highlight_clips_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `highlight_analysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `additional_source_clips` ADD CONSTRAINT `additional_source_clips_highlight_clip_id_fkey` FOREIGN KEY (`highlight_clip_id`) REFERENCES `highlight_clips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `additional_source_clips` ADD CONSTRAINT `additional_source_clips_guest_user_id_fkey` FOREIGN KEY (`guest_user_id`) REFERENCES `guest_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subtitle_sessions` ADD CONSTRAINT `subtitle_sessions_highlight_clip_id_fkey` FOREIGN KEY (`highlight_clip_id`) REFERENCES `highlight_clips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subtitle_segments` ADD CONSTRAINT `subtitle_segments_subtitle_session_id_fkey` FOREIGN KEY (`subtitle_session_id`) REFERENCES `subtitle_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_processing_jobs` ADD CONSTRAINT `video_processing_jobs_recording_session_id_fkey` FOREIGN KEY (`recording_session_id`) REFERENCES `recording_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_evaluations` ADD CONSTRAINT `service_evaluations_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_evaluations` ADD CONSTRAINT `service_evaluations_guest_user_id_fkey` FOREIGN KEY (`guest_user_id`) REFERENCES `guest_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quality_metrics` ADD CONSTRAINT `quality_metrics_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quality_metrics` ADD CONSTRAINT `quality_metrics_recording_session_id_fkey` FOREIGN KEY (`recording_session_id`) REFERENCES `recording_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
