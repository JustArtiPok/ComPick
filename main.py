# -*- coding: utf-8 -*-
"""API-слой ComPick (FastAPI) — эндпоинты по sequence-диаграмме и UC1–UC17 MVP.

Запуск: uvicorn app.main:app --reload
Документация (контракт API, риск А-5): /docs
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .catalog_data import PROFILES, build_catalog
from .domain import (
    Component, ComponentCategory, Motherboard, PowerSupply, Processor,
    StorageDevice, UsageProfile, VideoCard, CompatibilityStatus,
)
from .services.compatibility import CompatibilityService, CompatibilityResult
from .services.recommendation import RecommendationService

app = FastAPI(title="ComPick API", version="0.1.0-mvp")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- Состояние приложения (заглушка БД: в MVP — в памяти, риск/контракт 02.2) ---
catalog: list[Component] = build_catalog()
compat = CompatibilityService()
recommender = RecommendationService(catalog, compat)
builds: dict = {}
profiles: dict = {p.id: p for p in PROFILES}
now = datetime.now


# ---------- Сериализация ----------
def offer_to_dict(o):
    return {
        "store_id": o.store.id, "store_name": o.store.name,
        "price": float(o.price), "availability": o.availability.value,
        "updated_at": o.updated_at.isoformat(),
        "age_hours": round(o.getAgeHours(now()), 1),
        "is_stale": o.isStale(now()),
        "is_demo": o.is_demo,
    }


def component_to_dict(c: Component, with_offers: bool = False):
    best = c.getBestOffer(now())
    d = {
        "id": c.id, "name": c.name, "brand": c.brand,
        "category": c.category.value,
        "best_price": float(best.price) if best else None,
        "price_source": ({"store": best.store.name, "updated_at": best.updated_at.isoformat(),
                          "is_demo": best.is_demo} if best else None),
        "power_draw_wt": c.getPowerDraw(),
    }
    if isinstance(c, Processor):
        d.update(socket=c.socket, tdp_watts=c.tdp_watts, has_integrated_gpu=c.has_integrated_gpu)
    if isinstance(c, Motherboard):
        d.update(socket=c.socket, memory_type=c.memory_type, memory_slots=c.memory_slots,
                 max_memory_gb=c.max_memory_gb,
                 max_memory_frequency_mhz=c.max_memory_frequency_mhz)
    if c.category == ComponentCategory.MEMORY:
        d.update(memory_type=c.memory_type, capacity_gb=c.capacity_gb,
                 modules_count=c.modules_count, frequency_mhz=c.frequency_mhz)
    if isinstance(c, VideoCard):
        d.update(tdp_watts=c.tdp_watts, length_mm=c.length_mm)
    if isinstance(c, PowerSupply):
        d.update(wattage=c.wattage)
    if isinstance(c, StorageDevice):
        d.update(capacity_gb=c.capacity_gb, storage_type=c.storage_type)
    if with_offers:
        d["offers"] = [offer_to_dict(o) for o in c.getOffers()]
    return d


def result_to_dict(r: CompatibilityResult):
    return {
        "status": r.status.value,
        "is_compatible": r.isCompatible(),
        "warnings": [{
            "code": w.code, "severity": w.severity.value,
            "component": w.component, "reason": w.reason, "action": w.action,
        } for w in r.warnings],
    }


def build_item_to_dict(item):
    return {
        "component": component_to_dict(item.component),
        "price": float(item.getPrice()) if item.getPrice() is not None else None,
    }


def build_to_dict(b, with_check: bool = False):
    items = {cat.value: build_item_to_dict(item) for cat, item in b.items.items()}
    storages = b.getStorageItems()
    # «storage» в items — основной (первый) накопитель; полный список — в storage_items
    if storages:
        items[ComponentCategory.STORAGE.value] = build_item_to_dict(storages[0])
    d = {
        "id": b.id, "name": b.name,
        "items": items,
        "storage_items": [build_item_to_dict(i) for i in storages],
        "missing_categories": [c.value for c in b.getMissingCategories()],
        "is_complete": b.isComplete(),
        "total_price": float(b.getTotalPrice(now())) if b.getTotalPrice(now()) is not None else None,
    }
    if with_check:
        d["compatibility"] = result_to_dict(compat.checkCompatibility(b))
    return d


def find_component(cid: str) -> Component:
    c = next((x for x in catalog if x.id == cid), None)
    if c is None:
        raise HTTPException(404, f"комплектующая не найдена: {cid}")
    return c


# ---------- Каталог (UC1, UC2, FR-01) ----------
@app.get("/api/components")
def list_components(category: Optional[ComponentCategory] = None,
                    socket: Optional[str] = None,
                    memory_type: Optional[str] = None,
                    q: Optional[str] = Query(default=None, description="поиск по названию")):
    items = catalog
    if category:
        items = [c for c in items if c.category == category]
    if socket:
        items = [c for c in items if getattr(c, "socket", None) == socket]
    if memory_type:
        items = [c for c in items if getattr(c, "memory_type", None) == memory_type]
    if q:
        items = [c for c in items if q.lower() in c.name.lower()]
    return {"count": len(items), "items": [component_to_dict(c) for c in items]}


# ---------- Карточка детали с предложениями (UC3, FR-07) ----------
@app.get("/api/components/{cid}")
def component_detail(cid: str):
    return component_to_dict(find_component(cid), with_offers=True)


# ---------- Сборки (UC7–UC13) ----------
@app.post("/api/builds", status_code=201)
def create_build():
    from .domain import Build
    b = Build(id=f"build-{uuid.uuid4().hex[:8]}")
    builds[b.id] = b
    return build_to_dict(b)


@app.get("/api/builds/{bid}")
def get_build(bid: str):
    if bid not in builds:
        raise HTTPException(404, "сборка не найдена")
    return build_to_dict(builds[bid], with_check=True)


class AddComponentRequest(BaseModel):
    component_id: str


@app.post("/api/builds/{bid}/components")
def add_component(bid: str, body: AddComponentRequest):
    """Сценарий «Добавление детали» (sequence-диаграмма): проверка до сохранения,
    затем сохранение, пересчёт стоимости и предупреждений."""
    if bid not in builds:
        raise HTTPException(404, "сборка не найдена")
    component = find_component(body.component_id)
    build = builds[bid]
    check = compat.checkCompatibility(build, new_component=component)
    if check.status != CompatibilityStatus.INCOMPATIBLE:
        build.setComponent(component, component.getBestOffer(now()))
    return {
        "saved": check.status != CompatibilityStatus.INCOMPATIBLE,
        "build": build_to_dict(build),
        "compatibility": result_to_dict(check),
    }


@app.delete("/api/builds/{bid}/components/{category}")
def remove_component(bid: str, category: ComponentCategory):
    if bid not in builds:
        raise HTTPException(404, "сборка не найдена")
    builds[bid].removeComponent(category)
    return build_to_dict(builds[bid], with_check=True)


@app.delete("/api/builds/{bid}/storage/{component_id}")
def remove_one_storage(bid: str, component_id: str):
    """Убрать один накопитель из сборки (накопителей может быть несколько)."""
    if bid not in builds:
        raise HTTPException(404, "сборка не найдена")
    builds[bid].removeStorageById(component_id)
    return build_to_dict(builds[bid], with_check=True)


# ---------- Подбор (UC4, UC5, FR-08, FR-09) ----------
class BudgetRequest(BaseModel):
    budget_rub: int


@app.post("/api/recommendations/budget")
def recommend_by_budget(body: BudgetRequest):
    found = recommender.recommendByBudget(Decimal(body.budget_rub))
    if not found:
        return {"message": "подходящей сборки в рамках бюджета не найдено — попробуйте увеличить бюджет",
                "items": []}
    return {"items": [{"build": build_to_dict(rb.build), "total_price": float(rb.total_price),
                       "score": rb.score} for rb in found]}


class PurposeRequest(BaseModel):
    purpose: str
    budget_rub: Optional[int] = None
    priorities: Optional[list[ComponentCategory]] = None


@app.post("/api/recommendations/purpose")
def recommend_by_purpose(body: PurposeRequest):
    profile: Optional[UsageProfile] = next((p for p in PROFILES if p.name == body.purpose), None)
    if profile is None:
        profile = profiles.get(body.purpose)
    if profile is None:
        raise HTTPException(404, f"назначение не найдено: {body.purpose}")
    budget = Decimal(body.budget_rub) if body.budget_rub else None
    found = recommender.recommendByPurpose(profile, budget=budget, priorities=body.priorities)
    if not found:
        return {"message": "подходящей сборки под это назначение не найдено", "items": []}
    return {"purpose": profile.name, "priority_category": profile.priority_category.value,
            "items": [{"build": build_to_dict(rb.build), "total_price": float(rb.total_price),
                       "score": rb.score} for rb in found]}


@app.get("/api/profiles")
def list_profiles():
    return [{"id": p.id, "name": p.name, "priority_category": p.priority_category.value}
            for p in PROFILES]


@app.get("/health")
def health():
    return {"status": "ok", "components": len(catalog), "builds": len(builds)}
