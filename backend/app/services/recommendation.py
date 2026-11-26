from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional

from .compatibility import CompatibilityService
from ..domain import (
    Build, CompatibilityStatus, Component, ComponentCategory, UsageProfile,
)


@dataclass
class RecommendedBuild:
    build: Build
    total_price: Decimal
    compatible: bool
    score: int = 0


class RecommendationService:
    def __init__(self, catalog: list[Component], compatibility: CompatibilityService):
        self.catalog = catalog
        self.compatibility = compatibility

    def _by_category(self, category: ComponentCategory) -> list[Component]:
        return [c for c in self.catalog if c.category == category]

    def _candidates(self) -> list[Build]:
        """Полный набор сборок из каталога (каталог MVP мал — перебор допустим,
        см. риск В-1 и NFR-03: кэш и замер производительности)."""
        cpus = self._by_category(ComponentCategory.PROCESSOR)
        mbs = self._by_category(ComponentCategory.MOTHERBOARD)
        rams = self._by_category(ComponentCategory.MEMORY)
        gpus = self._by_category(ComponentCategory.VIDEO_CARD)
        psus = self._by_category(ComponentCategory.POWER_SUPPLY)
        storages = self._by_category(ComponentCategory.STORAGE)
        now = datetime.now()
        builds = []
        n = 0
        for cpu in cpus:
            for mb in mbs:
                if getattr(mb, "socket", None) != getattr(cpu, "socket", None):
                    continue  # предфильтрация по сокету до комбинаторики
                for ram in rams:
                    if getattr(ram, "memory_type", None) != getattr(mb, "memory_type", None):
                        continue
                    for gpu in gpus:
                        for psu in psus:
                            for storage in storages:
                                n += 1
                                b = Build(id=f"cand-{n}")
                                for c in (cpu, mb, ram, gpu, psu):
                                    b.setComponent(c, c.getBestOffer(now))
                                b.addStorage(storage, storage.getBestOffer(now))
                                builds.append(b)
        return builds

    def _rank(self, builds: list[RecommendedBuild], profile: Optional[UsageProfile] = None,
              priorities: Optional[list[ComponentCategory]] = None,
              budget: Optional[Decimal] = None) -> list[RecommendedBuild]:
        for rb in builds:
            score = 0
            if profile:
                for cat, item in rb.build.items.items():
                    if profile.isPriority(cat):
                        score += 3
            for cat in (priorities or []):
                if cat in rb.build.items:
                    score += 2
            rb.score = score
        if budget is not None:
            # Сначала — подтверждённо совместимые сборки (unknown только если
            # ничего подтверждённого не нашлось, FR-03). Дальше целимся в бюджет:
            # чем ближе цена сборки к бюджету снизу, тем выше. Внутри шага
            # в 5 000 ₽ предпочитаем сборку с более дорогой приоритетной
            # деталью профиля (для «игр» — видеокарта и т.д.).
            def key(rb: RecommendedBuild):
                gap = budget - rb.total_price  # всегда >= 0 (более дорогие отсеяны)
                bucket = int(gap // 5000)
                priority_price = Decimal(0)
                if profile:
                    item = rb.build.items.get(profile.priority_category)
                    if item is not None and item.getPrice() is not None:
                        priority_price = item.getPrice()
                return (not rb.compatible, bucket, -priority_price, -rb.total_price)
            return sorted(builds, key=key)
        # без бюджета — как раньше: приоритет профиля, затем дешевле
        return sorted(builds, key=lambda rb: (-rb.score, rb.total_price))

    def recommendByBudget(self, budget: Decimal, limit: int = 3) -> list[RecommendedBuild]:
        """FR-08: сборки в пределах бюджета; пустой список = подходящей нет,
        интерфейс показывает понятное сообщение."""
        result = []
        for build in self._candidates():
            total = build.getTotalPrice()
            if total is None or total > budget:
                continue
            check = self.compatibility.checkCompatibility(build)
            if check.status == CompatibilityStatus.INCOMPATIBLE:
                continue
            result.append(RecommendedBuild(build=build, total_price=total,
                                           compatible=check.isCompatible()))
        return self._rank(result, budget=budget)[:limit]

    def recommendByPurpose(self, profile: UsageProfile,
                           budget: Optional[Decimal] = None,
                           priorities: Optional[list[ComponentCategory]] = None,
                           limit: int = 3) -> list[RecommendedBuild]:
        """FR-09: подбор под назначение; бюджет опционален. Ранжирование учитывает
        приоритетную деталь профиля (UsageProfile.priorityCategory) и приоритеты пользователя."""
        result = []
        for build in self._candidates():
            total = build.getTotalPrice()
            if total is None or (budget is not None and total > budget):
                continue
            check = self.compatibility.checkCompatibility(build)
            if check.status == CompatibilityStatus.INCOMPATIBLE:
                continue
            result.append(RecommendedBuild(build=build, total_price=total,
                                           compatible=check.isCompatible()))
        return self._rank(result, profile=profile, priorities=priorities,
                          budget=budget)[:limit]
