CREATE DATABASE IF NOT EXISTS compick
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE compick;

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB;

-- 2. Категории комплектующих
CREATE TABLE IF NOT EXISTS component_categories (
    category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    PRIMARY KEY (category_id),
    CONSTRAINT uq_component_categories_name UNIQUE (name)
) ENGINE=InnoDB;

-- 3. Комплектующие
CREATE TABLE IF NOT EXISTS components (
    component_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id BIGINT UNSIGNED NOT NULL,
    manufacturer VARCHAR(150) NULL,
    model VARCHAR(200) NOT NULL,
    socket VARCHAR(100) NULL,
    memory_type VARCHAR(50) NULL,
    form_factor VARCHAR(100) NULL,
    tdp_w DECIMAL(8,2) NULL,
    length_mm DECIMAL(8,2) NULL,
    specifications JSON NULL,
    PRIMARY KEY (component_id),
    KEY idx_components_category_id (category_id),
    CONSTRAINT fk_components_category
        FOREIGN KEY (category_id)
        REFERENCES component_categories (category_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4. Конфигурации ПК
-- user_id допускает NULL: сборку можно создать без регистрации.
CREATE TABLE IF NOT EXISTS pc_configurations (
    configuration_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    name VARCHAR(200) NULL,
    target_budget DECIMAL(12,2) NULL,
    currency CHAR(3) NOT NULL DEFAULT 'RUB',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (configuration_id),
    KEY idx_pc_configurations_user_id (user_id),
    CONSTRAINT fk_pc_configurations_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. Комплектующие в составе конфигураций
-- Один и тот же компонент не дублируется в сборке: для этого есть quantity.
-- Составной UNIQUE начинается с configuration_id, поэтому обслуживает и FK
-- на pc_configurations (отдельный индекс по configuration_id не нужен).
CREATE TABLE IF NOT EXISTS configuration_items (
    configuration_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    configuration_id BIGINT UNSIGNED NOT NULL,
    component_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (configuration_item_id),
    CONSTRAINT uq_configuration_items_config_component
        UNIQUE (configuration_id, component_id),
    KEY idx_configuration_items_component_id (component_id),
    CONSTRAINT chk_configuration_items_quantity CHECK (quantity >= 1),
    CONSTRAINT fk_configuration_items_configuration
        FOREIGN KEY (configuration_id)
        REFERENCES pc_configurations (configuration_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_configuration_items_component
        FOREIGN KEY (component_id)
        REFERENCES components (component_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 6. Проверки совместимости конфигураций
CREATE TABLE IF NOT EXISTS compatibility_checks (
    check_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    configuration_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(30) NOT NULL,
    checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rule_set_version VARCHAR(50) NULL,
    PRIMARY KEY (check_id),
    KEY idx_compatibility_checks_configuration_id (configuration_id),
    CONSTRAINT fk_compatibility_checks_configuration
        FOREIGN KEY (configuration_id)
        REFERENCES pc_configurations (configuration_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Проблемы, найденные при проверке совместимости
-- component_a_id и component_b_id ссылаются на components.component_id.
CREATE TABLE IF NOT EXISTS compatibility_issues (
    issue_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    check_id BIGINT UNSIGNED NOT NULL,
    component_a_id BIGINT UNSIGNED NULL,
    component_b_id BIGINT UNSIGNED NULL,
    issue_code VARCHAR(100) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    PRIMARY KEY (issue_id),
    KEY idx_compatibility_issues_check_id (check_id),
    KEY idx_compatibility_issues_component_a (component_a_id),
    KEY idx_compatibility_issues_component_b (component_b_id),
    CONSTRAINT fk_compatibility_issues_check
        FOREIGN KEY (check_id)
        REFERENCES compatibility_checks (check_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_compatibility_issues_component_a
        FOREIGN KEY (component_a_id)
        REFERENCES components (component_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_compatibility_issues_component_b
        FOREIGN KEY (component_b_id)
        REFERENCES components (component_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. Магазины
CREATE TABLE IF NOT EXISTS stores (
    store_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    base_url VARCHAR(2048) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (store_id),
    CONSTRAINT uq_stores_name UNIQUE (name)
) ENGINE=InnoDB;

-- 9. Предложения магазинов
CREATE TABLE IF NOT EXISTS store_offers (
    offer_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    component_id BIGINT UNSIGNED NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'RUB',
    availability VARCHAR(50) NULL,
    product_url VARCHAR(2048) NULL,
    checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (offer_id),
    KEY idx_store_offers_component_id (component_id),
    KEY idx_store_offers_store_id (store_id),
    CONSTRAINT chk_store_offers_price CHECK (price >= 0),
    CONSTRAINT fk_store_offers_component
        FOREIGN KEY (component_id)
        REFERENCES components (component_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_store_offers_store
        FOREIGN KEY (store_id)
        REFERENCES stores (store_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 10. История цен предложений
CREATE TABLE IF NOT EXISTS offer_price_history (
    history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    offer_id BIGINT UNSIGNED NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    availability VARCHAR(50) NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (history_id),
    KEY idx_offer_price_history_offer_id (offer_id),
    CONSTRAINT chk_offer_price_history_price CHECK (price >= 0),
    CONSTRAINT fk_offer_price_history_offer
        FOREIGN KEY (offer_id)
        REFERENCES store_offers (offer_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Уведомления о целевой цене
CREATE TABLE IF NOT EXISTS price_alerts (
    alert_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    component_id BIGINT UNSIGNED NOT NULL,
    target_price DECIMAL(12,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (alert_id),
    KEY idx_price_alerts_user_id (user_id),
    KEY idx_price_alerts_component_id (component_id),
    CONSTRAINT chk_price_alerts_target_price CHECK (target_price >= 0),
    CONSTRAINT fk_price_alerts_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_price_alerts_component
        FOREIGN KEY (component_id)
        REFERENCES components (component_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Отзывы о магазинах
-- Один пользователь оставляет не более одного отзыва на магазин.
-- Составной UNIQUE начинается с user_id, поэтому обслуживает и FK на users.
CREATE TABLE IF NOT EXISTS store_reviews (
    review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NULL,
    PRIMARY KEY (review_id),
    CONSTRAINT uq_store_reviews_user_store UNIQUE (user_id, store_id),
    KEY idx_store_reviews_store_id (store_id),
    CONSTRAINT chk_store_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_store_reviews_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_store_reviews_store
        FOREIGN KEY (store_id)
        REFERENCES stores (store_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;
