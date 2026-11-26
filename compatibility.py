from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from ..domain import (
    Build, CompatibilityStatus, Component, ComponentCategory, Motherboard,
    PowerSupply, Processor, VideoCard, WarningSeverity,
)

# Зафиксировано 08.11: < +20 % — ошибка; +20–30 % — предупреждение о малом запасе; > +30 % — норма
POWER_RESERVE_MIN = 0.20
POWER_RESERVE_MAX = 0.30
BASE_OTHER_WATTS = 100  # плата, память, накопители, вентиляторы и т.п.


@dataclass
class CompatibilityWarning:
    """FR-05/NFR-02: деталь + причина + действие. Без них — ошибка правила."""
    code: str
    severity: WarningSeverity
    component: str       # проблемная деталь
    reason: str          # почему возникает проблема
    action: str          # что можно сделать

    def isComplete(self) -> bool:
        return bool(self.component and self.reason and self.action)


@dataclass
class CompatibilityResult:
    status: CompatibilityStatus
    warnings: list = field(default_factory=list)

    def isCompatible(self) -> bool:
        """Только status=compatible; unknown — НЕ подтверждённая совместимость (FR-03)."""
        return self.status == CompatibilityStatus.COMPATIBLE

    def hasWarnings(self) -> bool:
        return any(w.severity == WarningSeverity.WARNING for w in self.warnings)

    def errors(self) -> list:
        return [w for w in self.warnings if w.severity == WarningSeverity.ERROR]


class CompatibilityService:
    """Правила 1–4 (приоритет 1, MVP): сокет, поддержка CPU платой, память, мощность БП."""

    def checkCompatibility(self, build: Build,
                           new_component: Optional[Component] = None) -> CompatibilityResult:
        """Если new_component задан — проверка сборки вместе с новой деталью до
        сохранения (сценарий «Добавление детали»); иначе — вся текущая сборка."""
        items = {cat: (it.component if hasattr(it, "component") else it)
                 for cat, it in build.items.items()}
        if new_component is not None:
            items[new_component.category] = new_component  # проверка до сохранения

        warnings: list[CompatibilityWarning] = []
        has_unknown = False

        cpu = items.get(ComponentCategory.PROCESSOR)
        mb = items.get(ComponentCategory.MOTHERBOARD)
        ram = items.get(ComponentCategory.MEMORY)
        gpu = items.get(ComponentCategory.VIDEO_CARD)
        psu = items.get(ComponentCategory.POWER_SUPPLY)

        # Правило 1: сокет процессора и платы
        if isinstance(cpu, Processor) and isinstance(mb, Motherboard) and cpu.socket != mb.socket:
            warnings.append(CompatibilityWarning(
                code="socket_mismatch", severity=WarningSeverity.ERROR,
                component=f"{cpu.name} ↔ {mb.name}",
                reason=f"сокет процессора ({cpu.socket}) не совпадает с сокетом платы ({mb.socket})",
                action="выберите процессор или плату с одинаковым сокетом",
            ))

        # Правило 2: поддержка процессора платой (чипсет/BIOS)
        if isinstance(cpu, Processor) and isinstance(mb, Motherboard) and cpu.socket == mb.socket:
            status, min_bios = mb.supportsProcessor(cpu)
            if status == CompatibilityStatus.INCOMPATIBLE:
                warnings.append(CompatibilityWarning(
                    code="cpu_not_supported", severity=WarningSeverity.ERROR,
                    component=f"{cpu.name} ↔ {mb.name}",
                    reason="плата официально не поддерживает этот процессор (чипсет/BIOS)",
                    action="выберите другую плату или процессор из списка поддерживаемых",
                ))
            elif status == CompatibilityStatus.UNKNOWN:
                has_unknown = True
                warnings.append(CompatibilityWarning(
                    code="cpu_support_unknown", severity=WarningSeverity.WARNING,
                    component=f"{cpu.name} ↔ {mb.name}",
                    reason="нет записи о поддержке этого процессора платой, совместимость не подтверждена",
                    action="проверьте список CPU Support на сайте производителя платы",
                ))
            elif min_bios:
                warnings.append(CompatibilityWarning(
                    code="bios_update_required", severity=WarningSeverity.WARNING,
                    component=f"{cpu.name} ↔ {mb.name}",
                    reason=f"процессор поддерживается платой только с BIOS не ниже {min_bios}",
                    action=f"обновите BIOS до версии {min_bios} или выберите плату с поддержкой «из коробки»",
                ))

        # Правило 3: оперативная память
        if isinstance(mb, Motherboard) and ram is not None:
            status, freq_warnings = mb.checkMemory(ram)
            problems = self._memory_problems(ram, mb)
            if status == CompatibilityStatus.INCOMPATIBLE:
                text = {
                    "type": f"плата поддерживает {mb.memory_type}, а выбрана память {ram.memory_type}",
                    "slots": f"планок {ram.modules_count}, а слотов на плате {mb.memory_slots}",
                    "capacity": f"объём {ram.getTotalCapacityGb()} ГБ превышает максимум платы ({mb.max_memory_gb} ГБ)",
                }
                for key in problems:
                    warnings.append(CompatibilityWarning(
                        code=f"memory_{key}", severity=WarningSeverity.ERROR,
                        component=f"{ram.name} ↔ {mb.name}",
                        reason=text.get(key, key),
                        action="выберите память, подходящую плате по типу, числу планок и объёму",
                    ))
            for key in freq_warnings:
                warnings.append(CompatibilityWarning(
                    code="memory_frequency", severity=WarningSeverity.WARNING,
                    component=f"{ram.name} ↔ {mb.name}",
                    reason=f"частота памяти ({ram.frequency_mhz} МГц) выше поддерживаемой платой ({mb.max_memory_frequency_mhz} МГц)",
                    action="память заработает на пониженной частоте — подойдёт, но можно взять дешевле",
                ))

        # Правило 4: мощность блока питания (запас 20–30 % зафиксирован 08.11)
        if isinstance(psu, PowerSupply) and (isinstance(cpu, Processor) or isinstance(gpu, VideoCard)):
            required = self.calculateRequiredPower(items)
            min_required = int(required * (1 + POWER_RESERVE_MIN))
            max_required = int(required * (1 + POWER_RESERVE_MAX))
            if psu.wattage < min_required:
                warnings.append(CompatibilityWarning(
                    code="psu_insufficient", severity=WarningSeverity.ERROR,
                    component=psu.name,
                    reason=f"мощности БП ({psu.wattage} Вт) недостаточно: расчётная нагрузка {required} Вт + запас 20 % = от {min_required} Вт",
                    action=f"выберите блок питания от {min_required} Вт и выше",
                ))
            elif psu.wattage < max_required:
                warnings.append(CompatibilityWarning(
                    code="psu_low_reserve", severity=WarningSeverity.WARNING,
                    component=psu.name,
                    reason=f"запас мощности мал: {psu.wattage} Вт при рекомендуемых {max_required}+ Вт (нагрузка {required} Вт + 30 %)",
                    action="сборка заработает, но для апгрейда лучше блок помощнее",
                ))

        if any(w.severity == WarningSeverity.ERROR for w in warnings):
            status = CompatibilityStatus.INCOMPATIBLE
        elif has_unknown:
            status = CompatibilityStatus.UNKNOWN
        else:
            status = CompatibilityStatus.COMPATIBLE
        return CompatibilityResult(status=status, warnings=[w for w in warnings if w.isComplete()])

    def calculateRequiredPower(self, items) -> int:
        """Требуемая мощность = TDP процессора + TDP видеокарты + базовое
        потребление остальных узлов (BASE_OTHER_WATTS). Запас в результат
        не входит (FR-04, таблица методов)."""
        total = BASE_OTHER_WATTS
        for item in items.values():
            component = item.component if hasattr(item, "component") else item
            if component.category in (ComponentCategory.PROCESSOR,
                                      ComponentCategory.VIDEO_CARD):
                total += component.getPowerDraw()
        return total

    def checkPowerSupply(self, build: Build) -> Optional[CompatibilityWarning]:
        """Отдельная проверка БП; если проблемы нет — None (таблица методов)."""
        result = self.checkCompatibility(build)
        return next((w for w in result.warnings if w.code.startswith("psu_")), None)

    @staticmethod
    def _memory_problems(ram, mb) -> list:
        problems = []
        if ram.memory_type != mb.memory_type:
            problems.append("type")
        if ram.modules_count > mb.memory_slots:
            problems.append("slots")
        if ram.getTotalCapacityGb() > mb.max_memory_gb:
            problems.append("capacity")
        return problems
