# -*- coding: utf-8 -*-
"""Загрузка каталога из БД MySQL в доменные модели backend.

Соответствие со схемой ComPick:
- компоненты.components: строковые ID вида "db-{component_id}", характеристики
  подкласса — из JSON-колонки specifications (заполняет db/seed.py);
- цены store_offers -> PriceOffer(updated_at = checked_at);
- история цен, сборки, проверки и уведомления схемой предусмотрены, каркас их не читает.
"""
from __future__ import annotations

import json

from .db import get_connection
from .domain import (
    Availability, Component, ComponentCategory, MemoryModule, Motherboard,
    MotherboardCpuSupport, PCCase, PowerSupply, PriceOffer, Processor, Store,
    StorageDevice, SupportStatus, VideoCard,
)

CATEGORY_BY_NAME = {c.value: c for c in ComponentCategory}


def _component_from_row(row, category: ComponentCategory) -> Component:
    spec = row["specifications"] or {}
    if isinstance(spec, str):
        spec = json.loads(spec)
    common = dict(
        id=f"db-{row['component_id']}",
        name=row["model"],
        brand=row["manufacturer"],
        category=category,
        base_power_draw=spec.get("base_power_draw", 0),
    )
    if category == ComponentCategory.PROCESSOR:
        return Processor(**common, socket=row["socket"] or "",
                         tdp_watts=row["tdp_w"] or 0,
                         has_integrated_gpu=bool(spec.get("has_integrated_gpu", False)))
    if category == ComponentCategory.MOTHERBOARD:
        support = [MotherboardCpuSupport(
            cpu_id=f"db-{s['cpu_id']}",
            status=SupportStatus(s.get("status", "unknown")),
            min_bios_version=s.get("min_bios_version"),
        ) for s in spec.get("cpu_support", [])]
        return Motherboard(**common, socket=row["socket"] or "",
                           memory_type=row["memory_type"] or "DDR4",
                           memory_slots=spec.get("memory_slots", 4),
                           max_memory_gb=spec.get("max_memory_gb", 128),
                           max_memory_frequency_mhz=spec.get("max_memory_frequency_mhz", 3200),
                           form_factor=row["form_factor"] or "ATX",
                           cpu_support=support)
    if category == ComponentCategory.MEMORY:
        return MemoryModule(**common, memory_type=row["memory_type"] or "DDR4",
                            capacity_gb=spec.get("capacity_gb", 16),
                            modules_count=spec.get("modules_count", 2),
                            frequency_mhz=spec.get("frequency_mhz", 3200))
    if category == ComponentCategory.VIDEO_CARD:
        return VideoCard(**common, tdp_watts=row["tdp_w"] or 0,
                         length_mm=row["length_mm"] or 240)
    if category == ComponentCategory.POWER_SUPPLY:
        return PowerSupply(**common, wattage=spec.get("wattage", 550))
    if category == ComponentCategory.CASE:
        return PCCase(**common,
                      supported_form_factors=spec.get("supported_form_factors", ["ATX"]),
                      max_gpu_length_mm=spec.get("max_gpu_length_mm", 400))
    if category == ComponentCategory.STORAGE:
        return StorageDevice(**common, capacity_gb=spec.get("capacity_gb", 1000),
                             storage_type=spec.get("storage_type", "NVMe SSD"))
    return Component(**common)


def load_catalog() -> list[Component]:
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT category_id, name FROM component_categories")
        category_by_id = {r["category_id"]: CATEGORY_BY_NAME[r["name"]]
                          for r in cur.fetchall()}
        cur.execute("SELECT store_id, name FROM stores")
        stores = {r["store_id"]: Store(id=str(r["store_id"]), name=r["name"])
                  for r in cur.fetchall()}
        cur.execute(
            "SELECT component_id, category_id, manufacturer, model, socket, "
            "memory_type, form_factor, tdp_w, length_mm, specifications FROM components")
        components = [_component_from_row(r, category_by_id[r["category_id"]])
                      for r in cur.fetchall()]
        by_db_id = {int(c.id.removeprefix("db-")): c for c in components}
        cur.execute(
            "SELECT offer_id, component_id, store_id, price, availability, checked_at "
            "FROM store_offers")
        for r in cur.fetchall():
            offer = PriceOffer(
                id=f"db-offer-{r['offer_id']}",
                store=stores[r["store_id"]],
                component=by_db_id[r["component_id"]],
                price=r["price"],
                availability=Availability(r["availability"]),
                updated_at=r["checked_at"],
                is_demo=True,
            )
            by_db_id[r["component_id"]].offers.append(offer)
            stores[r["store_id"]]._offers.append(offer)
        return components
    finally:
        conn.close()
