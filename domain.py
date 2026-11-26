from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional


class ComponentCategory(str, Enum):
    PROCESSOR = "processor"
    MOTHERBOARD = "motherboard"
    MEMORY = "memory"
    VIDEO_CARD = "video_card"
    POWER_SUPPLY = "power_supply"
    CASE = "case"
    STORAGE = "storage"
    COOLER = "cooler"


class Availability(str, Enum):
    IN_STOCK = "in_stock"
    OUT_OF_STOCK = "out_of_stock"
    UNKNOWN = "unknown"


class CompatibilityStatus(str, Enum):
    COMPATIBLE = "compatible"
    INCOMPATIBLE = "incompatible"
    UNKNOWN = "unknown"


class WarningSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class SupportStatus(str, Enum):
    COMPATIBLE = "compatible"
    INCOMPATIBLE = "incompatible"
    UNKNOWN = "unknown"


# --------- Цены и магазины -----
@dataclass
class Store:
    id: str
    name: str
    _offers: list["PriceOffer"] = field(default_factory=list, repr=False)

    def getOffers(self) -> list["PriceOffer"]:
        return list(self._offers)


@dataclass
class PriceOffer:
    id: str
    store: Store
    component: "Component"
    price: Decimal
    availability: Availability = Availability.IN_STOCK
    updated_at: datetime = field(default_factory=datetime.now)
    is_demo: bool = True

    def isAvailable(self) -> bool:
        return self.availability == Availability.IN_STOCK

    def getAgeHours(self, now: datetime) -> float:
        return (now - self.updated_at).total_seconds() / 3600

    def isStale(self, now: datetime, max_age_hours: int = 720) -> bool:
        """NFR-04: предел возраста цены — 30 дней (изменено 26.11:
        обновление цен раз в месяц, ранее было 24 часа)."""
        return self.getAgeHours(now) > max_age_hours


# ---------- Комплектующие ----------
@dataclass
class Component:
    id: str
    name: str
    brand: str
    category: ComponentCategory
    base_power_draw: int = 0  
    offers: list[PriceOffer] = field(default_factory=list, repr=False)
    is_preset: bool = False

    def getOffers(self) -> list[PriceOffer]:
        return list(self.offers)

    def getBestOffer(self, now: datetime, max_age_hours: int = 720) -> Optional[PriceOffer]:
        """Component.getBestOffer(now): лучшее актуальное предложение [0..1] (NFR-04,
        актуальность — 30 дней)."""
        candidates = [o for o in self.offers
                      if o.isAvailable() and not o.isStale(now, max_age_hours)]
        if not candidates:
            return None
        return min(candidates, key=lambda o: o.price)

    def getPowerDraw(self) -> int:
        """В базовом классе 0; Processor и VideoCard переопределяют (TDP)."""
        return self.base_power_draw


@dataclass
class Processor(Component):
    socket: str = ""
    tdp_watts: int = 0
    has_integrated_gpu: bool = False

    def getPowerDraw(self) -> int:
        return self.tdp_watts


@dataclass
class MotherboardCpuSupport:
    """Запись о поддержке процессора платой (чипсет/BIOS)."""
    cpu_id: str
    status: SupportStatus = SupportStatus.UNKNOWN
    min_bios_version: Optional[str] = None

    def isConfirmed(self) -> bool:
        """Только status=compatible считается подтверждением (FR-03)."""
        return self.status == SupportStatus.COMPATIBLE

    def requiresBiosUpdate(self) -> bool:
        return self.min_bios_version is not None


@dataclass
class Motherboard(Component):
    socket: str = ""
    memory_type: str = "DDR4"          # DDR4 / DDR5
    memory_slots: int = 4
    max_memory_gb: int = 128
    max_memory_frequency_mhz: int = 3200
    form_factor: str = "ATX"
    cpu_support: list[MotherboardCpuSupport] = field(default_factory=list, repr=False)

    def supportsProcessor(self, cpu: Processor) -> tuple[CompatibilityStatus, Optional[str]]:
        """Правило 2. Сокет не совпал — incompatible; есть подтверждённая запись —
        compatible (с пометкой о BIOS); записи нет — unknown, НЕ compatible (FR-03)."""
        if cpu.socket != self.socket:
            return CompatibilityStatus.INCOMPATIBLE, None
        record = next((s for s in self.cpu_support if s.cpu_id == cpu.id), None)
        if record is None:
            return CompatibilityStatus.UNKNOWN, None
        if record.isConfirmed():
            return CompatibilityStatus.COMPATIBLE, record.min_bios_version
        return CompatibilityStatus.INCOMPATIBLE, None

    def checkMemory(self, ram: "MemoryModule") -> tuple[CompatibilityStatus, list[str]]:
        """Правило 3: тип, число слотов, объём (ошибки); частота (предупреждение, 08.11)."""
        problems: list[str] = []
        if ram.memory_type != self.memory_type:
            problems.append(f"type:{ram.memory_type}!={self.memory_type}")
        if ram.modules_count > self.memory_slots:
            problems.append(f"slots:{ram.modules_count}>{self.memory_slots}")
        if ram.getTotalCapacityGb() > self.max_memory_gb:
            problems.append(f"capacity:{ram.getTotalCapacityGb()}>{self.max_memory_gb}")
        status = CompatibilityStatus.INCOMPATIBLE if problems else CompatibilityStatus.COMPATIBLE
        warnings = []
        if status == CompatibilityStatus.COMPATIBLE and ram.frequency_mhz > self.max_memory_frequency_mhz:
            warnings.append(f"frequency:{ram.frequency_mhz}>{self.max_memory_frequency_mhz}")
        return status, warnings


@dataclass
class MemoryModule(Component):
    memory_type: str = "DDR4"
    capacity_gb: int = 16      # на планку (или на комплект — см. modules_count)
    modules_count: int = 2
    frequency_mhz: int = 3200

    def getTotalCapacityGb(self) -> int:
        return self.capacity_gb * self.modules_count


@dataclass
class VideoCard(Component):
    tdp_watts: int = 0
    length_mm: int = 240

    def getPowerDraw(self) -> int:
        return self.tdp_watts


@dataclass
class PowerSupply(Component):
    wattage: int = 550

    def hasEnoughPower(self, required_watts: int) -> bool:
        """Только сравнение с переданной мощностью; запас считает вызывающий код."""
        return self.wattage >= required_watts


@dataclass
class PCCase(Component):
    supported_form_factors: list[str] = field(default_factory=lambda: ["ATX"])
    max_gpu_length_mm: int = 400


@dataclass
class StorageDevice(Component):
    """Накопитель (SSD/HDD). Правил совместимости в MVP нет — важны ёмкость и тип."""
    capacity_gb: int = 1000
    storage_type: str = "NVMe SSD"      # NVMe SSD / SATA SSD / HDD


# ---------- Сборка ----------
@dataclass
class BuildItem:
    component: Component
    offer: Optional[PriceOffer] = None

    def getPrice(self) -> Optional[Decimal]:
        return self.offer.price if self.offer else None


# Корпус в первой версии из сборок исключён (решение 26.11): он не участвует
# в проверках совместимости MVP, а его цена только искажает подбор под бюджет.
REQUIRED_CATEGORIES = [
    ComponentCategory.PROCESSOR, ComponentCategory.MOTHERBOARD, ComponentCategory.MEMORY,
    ComponentCategory.VIDEO_CARD, ComponentCategory.POWER_SUPPLY, ComponentCategory.STORAGE,
]


@dataclass
class Build:
    id: str
    name: str = "Моя сборка"
    items: dict = field(default_factory=dict)  # category -> BuildItem (одна деталь на категорию)
    storage_items: list = field(default_factory=list)  # BuildItem: накопителей может быть несколько
    usage_profile_id: Optional[str] = None

    def setComponent(self, component: Component, offer: Optional[PriceOffer] = None) -> None:
        """FR-10: замена детали категории без пересборки; пересчёт — за сервисами.
        Накопители не заменяются, а добавляются (addStorage)."""
        if component.category == ComponentCategory.STORAGE:
            self.addStorage(component, offer)
            return
        self.items[component.category] = BuildItem(component=component, offer=offer)

    def addStorage(self, component: Component, offer: Optional[PriceOffer] = None) -> None:
        """Добавить накопитель к сборке — SSD и HDD можно совмещать (решение 26.11)."""
        self.storage_items.append(BuildItem(component=component, offer=offer))

    def removeStorageById(self, component_id: str) -> None:
        self.storage_items = [i for i in self.storage_items
                              if i.component.id != component_id]

    def getStorageItems(self) -> list:
        return list(self.storage_items)

    def removeComponent(self, category: ComponentCategory) -> None:
        self.items.pop(category, None)
        if category == ComponentCategory.STORAGE:
            self.storage_items.clear()

    def getComponent(self, category: ComponentCategory) -> Optional[Component]:
        if category == ComponentCategory.STORAGE:
            return self.storage_items[0].component if self.storage_items else None
        item = self.items.get(category)
        return item.component if item else None

    def hasCategory(self, category: ComponentCategory) -> bool:
        if category == ComponentCategory.STORAGE:
            return bool(self.storage_items)
        return category in self.items

    def getMissingCategories(self) -> list[ComponentCategory]:
        """FR-01: незаполненные категории видны на экране."""
        return [c for c in REQUIRED_CATEGORIES if not self.hasCategory(c)]

    def isComplete(self) -> bool:
        return all(self.hasCategory(c) for c in REQUIRED_CATEGORIES)

    def getTotalPrice(self, now: Optional[datetime] = None) -> Optional[Decimal]:
        """FR-02: сумма выбранных предложений; деталь без цены в сумму не входит,
        отсутствие цены показывается явно, а не как 0."""
        now = now or datetime.now()
        total = Decimal(0)
        for item in list(self.items.values()) + list(self.storage_items):
            price = item.getPrice()
            if price is None:
                continue
            total += price
        return total


# ---------- Подбор по назначению ----------
@dataclass
class UsageProfile:
    id: str
    name: str                      # «игры», «учёба», «работа», «монтаж видео», «программирование»
    priority_category: ComponentCategory = ComponentCategory.VIDEO_CARD

    def isPriority(self, category: ComponentCategory) -> bool:
        return category == self.priority_category
