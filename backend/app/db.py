# -*- coding: utf-8 -*-
"""Подключение к MySQL (схема ComPick).

Настройки — переменные окружения MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PWD
(по умолчанию root без пароля на localhost:3306).
"""
from __future__ import annotations

import os

import mysql.connector

DATABASE = "ComPick"


def get_connection():
    return mysql.connector.connect(
        host=os.environ.get("MYSQL_HOST", "localhost"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "root"),
        password=os.environ.get("MYSQL_PWD", ""),
        database=DATABASE,
    )
