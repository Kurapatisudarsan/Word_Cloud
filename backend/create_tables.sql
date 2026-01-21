-- Word Cloud Game Tables
-- Run this SQL script to create the necessary database tables

CREATE TABLE IF NOT EXISTS hackathon_gameround (
    id bigint AUTO_INCREMENT PRIMARY KEY,
    creator_id bigint NOT NULL,
    question TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_creator_created (creator_id, created_at DESC),
    INDEX idx_status_created (status, created_at DESC),
    FOREIGN KEY (creator_id) REFERENCES hackathon_appuser(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hackathon_response (
    id bigint AUTO_INCREMENT PRIMARY KEY,
    round_id bigint NOT NULL,
    member_id bigint NULL,
    word VARCHAR(100) NOT NULL,
    word_normalized VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_round_word (round_id, word_normalized),
    INDEX idx_round_created (round_id, created_at DESC),
    UNIQUE KEY unique_response_per_member (round_id, member_id),
    FOREIGN KEY (round_id) REFERENCES hackathon_gameround(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES hackathon_appusermember(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hackathon_shareevent (
    id bigint AUTO_INCREMENT PRIMARY KEY,
    round_id bigint NOT NULL,
    member_id bigint NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_round_member (round_id, member_id),
    INDEX idx_created (created_at DESC),
    FOREIGN KEY (round_id) REFERENCES hackathon_gameround(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES hackathon_appusermember(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hackathon_playerscore (
    id bigint AUTO_INCREMENT PRIMARY KEY,
    round_id bigint NOT NULL,
    member_id bigint NOT NULL,
    response_points INT NOT NULL DEFAULT 0,
    share_points INT NOT NULL DEFAULT 0,
    total_points INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_round_total (round_id, total_points DESC),
    UNIQUE KEY unique_score_per_member (round_id, member_id),
    FOREIGN KEY (round_id) REFERENCES hackathon_gameround(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES hackathon_appusermember(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
