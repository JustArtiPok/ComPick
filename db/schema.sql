-- ============================================================
-- Конфигуратор ПК: схема БД для MySQL 8.0+
-- ============================================================
-- Файл проекта команды. DROP-ы добавлены, чтобы схему можно было
-- пересоздавать при разработке (python db/seed.py --schema).

DROP DATABASE IF EXISTS ComPick;

CREATE DATABASE IF NOT EXISTS ComPick
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ComPick;

-- ------------------------------------------------------------
-- Пользователи
-- ------------------------------------------------------------
CREATE TABLE users (
    user_id        INT           NOT NULL AUTO_INCREMENT,
    email          VARCHAR(255)  NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Категории комплектующих
-- ------------------------------------------------------------
CREATE TABLE component_categories (
    category_id  INT           NOT NULL AUTO_INCREMENT,
    name         VARCHAR(100)  NOT NULL,
    description  VARCHAR(255)  NULL,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_component_categories_name (name)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Комплектующие
-- ------------------------------------------------------------
CREATE TABLE components (
    component_id    INT           NOT NULL AUTO_INCREMENT,
    category_id     INT           NOT NULL,
    manufacturer    VARCHAR(100)  NOT NULL,
    model           VARCHAR(255)  NOT NULL,
    socket          VARCHAR(20)   NULL,
    memory_type     VARCHAR(10)   NULL,
    form_factor     VARCHAR(20)   NULL,
    tdp_w           INT           NULL,
    length_mm       INT           NULL,
    specifications  JSON          NULL,
    PRIMARY KEY (component_id),
    KEY idx_components_category (category_id),
    KEY idx_components_socket (socket),
    CONSTRAINT fk_components_category
        FOREIGN KEY (category_id) REFERENCES component_categories (category_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Магазины
-- ------------------------------------------------------------
CREATE TABLE stores (
    store_id   INT           NOT NULL AUTO_INCREMENT,
    name       VARCHAR(150)  NOT NULL,
    base_url   VARCHAR(255)  NULL,
    is_active  TINYINT(1)    NOT NULL DEFAULT 1,
    PRIMARY KEY (store_id),
    UNIQUE KEY uq_stores_name (name)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Предложения магазинов (цена комплектующего в магазине)
-- ------------------------------------------------------------
CREATE TABLE store_offers (
    offer_id      INT            NOT NULL AUTO_INCREMENT,
    component_id  INT            NOT NULL,
    store_id      INT            NOT NULL,
    price         DECIMAL(10,2)  NOT NULL,
    currency      CHAR(3)        NOT NULL DEFAULT 'RUB',
    availability  ENUM('in_stock','out_of_stock','preorder') NOT NULL DEFAULT 'in_stock',
    product_url   VARCHAR(255)   NULL,
    checked_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (offer_id),
    KEY idx_store_offers_component (component_id),
    KEY idx_store_offers_store (store_id),
    CONSTRAINT fk_store_offers_component
        FOREIGN KEY (component_id) REFERENCES components (component_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_store_offers_store
        FOREIGN KEY (store_id) REFERENCES stores (store_id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- История цен по предложениям
-- ------------------------------------------------------------
CREATE TABLE offer_price_history (
    history_id    INT            NOT NULL AUTO_INCREMENT,
    offer_id      INT            NOT NULL,
    price         DECIMAL(10,2)  NOT NULL,
    availability  ENUM('in_stock','out_of_stock','preorder') NOT NULL,
    recorded_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (history_id),
    KEY idx_offer_price_history_offer_time (offer_id, recorded_at),
    CONSTRAINT fk_offer_price_history_offer
        FOREIGN KEY (offer_id) REFERENCES store_offers (offer_id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Конфигурации ПК (user_id может быть NULL — гостевая сборка)
-- ------------------------------------------------------------
CREATE TABLE pc_configurations (
    configuration_id  INT            NOT NULL AUTO_INCREMENT,
    user_id           INT            NULL,
    name              VARCHAR(150)   NOT NULL,
    target_budget     DECIMAL(10,2)  NULL,
    currency          CHAR(3)        NOT NULL DEFAULT 'RUB',
    created_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (configuration_id),
    KEY idx_pc_configurations_user (user_id),
    CONSTRAINT fk_pc_configurations_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Состав конфигурации
-- ------------------------------------------------------------
CREATE TABLE configuration_items (
    configuration_item_id  INT  NOT NULL AUTO_INCREMENT,
    configuration_id       INT  NOT NULL,
    component_id           INT  NOT NULL,
    quantity               INT  NOT NULL DEFAULT 1,
    PRIMARY KEY (configuration_item_id),
    KEY idx_configuration_items_configuration (configuration_id),
    KEY idx_configuration_items_component (component_id),
    CONSTRAINT chk_configuration_items_quantity CHECK (quantity > 0),
    CONSTRAINT fk_configuration_items_configuration
        FOREIGN KEY (configuration_id) REFERENCES pc_configurations (configuration_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_configuration_items_component
        FOREIGN KEY (component_id) REFERENCES components (component_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Проверки совместимости
-- ------------------------------------------------------------
CREATE TABLE compatibility_checks (
    check_id          INT          NOT NULL AUTO_INCREMENT,
    configuration_id  INT          NOT NULL,
    status            ENUM('compatible','warning','incompatible') NOT NULL,
    checked_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rule_set_version  VARCHAR(30)  NULL,
    PRIMARY KEY (check_id),
    KEY idx_compatibility_checks_configuration (configuration_id),
    CONSTRAINT fk_compatibility_checks_configuration
        FOREIGN KEY (configuration_id) REFERENCES pc_configurations (configuration_id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Проблемы совместимости, найденные при проверке
-- ------------------------------------------------------------
CREATE TABLE compatibility_issues (
    issue_id        INT           NOT NULL AUTO_INCREMENT,
    check_id        INT           NOT NULL,
    component_a_id  INT           NULL,
    component_b_id  INT           NULL,
    issue_code      VARCHAR(50)   NOT NULL,
    severity        ENUM('info','warning','error') NOT NULL,
    message         VARCHAR(255)  NOT NULL,
    PRIMARY KEY (issue_id),
    KEY idx_compatibility_issues_check (check_id),
    KEY idx_compatibility_issues_component_a (component_a_id),
    KEY idx_compatibility_issues_component_b (component_b_id),
    CONSTRAINT fk_compatibility_issues_check
        FOREIGN KEY (check_id) REFERENCES compatibility_checks (check_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_compatibility_issues_component_a
        FOREIGN KEY (component_a_id) REFERENCES components (component_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_compatibility_issues_component_b
        FOREIGN KEY (component_b_id) REFERENCES components (component_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Уведомления о цене
-- ------------------------------------------------------------
CREATE TABLE price_alerts (
    alert_id      INT            NOT NULL AUTO_INCREMENT,
    user_id       INT            NOT NULL,
    component_id  INT            NOT NULL,
    target_price  DECIMAL(10,2)  NOT NULL,
    is_active     TINYINT(1)     NOT NULL DEFAULT 1,
    PRIMARY KEY (alert_id),
    KEY idx_price_alerts_user (user_id),
    KEY idx_price_alerts_component (component_id),
    CONSTRAINT fk_price_alerts_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_price_alerts_component
        FOREIGN KEY (component_id) REFERENCES components (component_id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
