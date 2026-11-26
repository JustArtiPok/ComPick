from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from .domain import (
    Availability, Component, ComponentCategory, MemoryModule, Motherboard,
    MotherboardCpuSupport, PCCase, PowerSupply, PriceOffer, Processor, StorageDevice,
    Store, SupportStatus, UsageProfile, VideoCard,
)

NOW = datetime.now()
DEMO_DATE = NOW - timedelta(hours=3)  


def _store(sid: str, name: str) -> Store:
    return Store(id=sid, name=name)


DNS = _store("dns", "DNS")
CITILINK = _store("citilink", "Ситилинк")
REGARD = _store("regard", "Регард")


def _component(cls, cid, name, brand, category, base=0, offers=(), **kwargs):
    c = cls(id=cid, name=name, brand=brand, category=category, base_power_draw=base, **kwargs)
    for store, price in offers:
        offer = PriceOffer(id=f"offer-{cid}-{store.id}", store=store, component=c,
                           price=Decimal(price), availability=Availability.IN_STOCK,
                           updated_at=DEMO_DATE, is_demo=True)
        c.offers.append(offer)
        store._offers.append(offer)
    return c


def build_catalog() -> list[Component]:
    catalog: list[Component] = []

    # --- Процессоры ---
    cpus = [
        _component(Processor, "cpu-5600", "AMD Ryzen 5 5600", "AMD", ComponentCategory.PROCESSOR,
                   offers=[(DNS, 9499), (CITILINK, 9699), (REGARD, 9350)],
                   socket="AM4", tdp_watts=65, has_integrated_gpu=False),
        _component(Processor, "cpu-7600", "AMD Ryzen 5 7600", "AMD", ComponentCategory.PROCESSOR,
                   offers=[(DNS, 13999), (CITILINK, 14499), (REGARD, 13850)],
                   socket="AM5", tdp_watts=105, has_integrated_gpu=True),
        _component(Processor, "cpu-7500f", "AMD Ryzen 5 7500F", "AMD", ComponentCategory.PROCESSOR,
                   offers=[(DNS, 12499), (CITILINK, 12999)],
                   socket="AM5", tdp_watts=105, has_integrated_gpu=False),
        _component(Processor, "cpu-13400f", "Intel Core i5-13400F", "Intel", ComponentCategory.PROCESSOR,
                   offers=[(DNS, 13499), (CITILINK, 13999), (REGARD, 13350)],
                   socket="LGA1700", tdp_watts=148, has_integrated_gpu=False),
        _component(Processor, "cpu-12100f", "Intel Core i3-12100F", "Intel", ComponentCategory.PROCESSOR,
                   offers=[(DNS, 7999), (CITILINK, 8299)],
                   socket="LGA1700", tdp_watts=89, has_integrated_gpu=False),
        _component(Processor, "cpu-245k", "Intel Core Ultra 5 245K", "Intel", ComponentCategory.PROCESSOR,
                   offers=[(DNS, 25999), (CITILINK, 26499)],
                   socket="LGA1851", tdp_watts=125, has_integrated_gpu=True),
    ]

    # --- Материнские платы ---
    mbs = [
        _component(Motherboard, "mb-b550-tomahawk", "MSI MAG B550 TOMAHAWK", "MSI",
                   ComponentCategory.MOTHERBOARD, base=40,
                   offers=[(DNS, 12999), (CITILINK, 13499), (REGARD, 12850)],
                   socket="AM4", memory_type="DDR4", memory_slots=4, max_memory_gb=128,
                   max_memory_frequency_mhz=4866, form_factor="ATX",
                   cpu_support=[MotherboardCpuSupport("cpu-5600", SupportStatus.COMPATIBLE)]),
        _component(Motherboard, "mb-b450-tomahawk", "MSI B450 TOMAHAWK", "MSI",
                   ComponentCategory.MOTHERBOARD, base=35,
                   offers=[(DNS, 8999), (CITILINK, 9299)],
                   socket="AM4", memory_type="DDR4", memory_slots=4, max_memory_gb=128,
                   max_memory_frequency_mhz=3466, form_factor="ATX",
                   cpu_support=[MotherboardCpuSupport("cpu-5600", SupportStatus.COMPATIBLE,
                                                      min_bios_version="7C02v1H")]),
        _component(Motherboard, "mb-b650-pro", "MSI PRO B650-S WIFI", "MSI",
                   ComponentCategory.MOTHERBOARD, base=45,
                   offers=[(DNS, 13499), (CITILINK, 13999), (REGARD, 13350)],
                   socket="AM5", memory_type="DDR5", memory_slots=4, max_memory_gb=128,
                   max_memory_frequency_mhz=6400, form_factor="ATX",
                   cpu_support=[MotherboardCpuSupport("cpu-7600", SupportStatus.COMPATIBLE)]),
        _component(Motherboard, "mb-b650-gaming-plus", "MSI B650 GAMING PLUS WIFI", "MSI",
                   ComponentCategory.MOTHERBOARD, base=45,
                   offers=[(DNS, 12499), (CITILINK, 12999)],
                   socket="AM5", memory_type="DDR5", memory_slots=4, max_memory_gb=128,
                   max_memory_frequency_mhz=6000, form_factor="ATX",
                   cpu_support=[MotherboardCpuSupport("cpu-7600", SupportStatus.COMPATIBLE)]),
        _component(Motherboard, "mb-a620m-hdv", "ASRock A620M-HDV/M.2", "ASRock",
                   ComponentCategory.MOTHERBOARD, base=40,
                   offers=[(DNS, 7499), (CITILINK, 7899)],
                   socket="AM5", memory_type="DDR5", memory_slots=2, max_memory_gb=64,
                   max_memory_frequency_mhz=5600, form_factor="Micro-ATX",
                   cpu_support=[MotherboardCpuSupport("cpu-7600", SupportStatus.COMPATIBLE)]),
        _component(Motherboard, "mb-b760-p", "MSI PRO B760-P WIFI", "MSI",
                   ComponentCategory.MOTHERBOARD, base=45,
                   offers=[(DNS, 12999), (CITILINK, 13499)],
                   socket="LGA1700", memory_type="DDR5", memory_slots=4, max_memory_gb=128,
                   max_memory_frequency_mhz=6000, form_factor="ATX",
                   cpu_support=[MotherboardCpuSupport("cpu-13400f", SupportStatus.COMPATIBLE)]),
        _component(Motherboard, "mb-b760-p-ddr4", "MSI PRO B760-P WIFI DDR4", "MSI",
                   ComponentCategory.MOTHERBOARD, base=45,
                   offers=[(DNS, 11499), (CITILINK, 11999)],
                   socket="LGA1700", memory_type="DDR4", memory_slots=4, max_memory_gb=128,
                   max_memory_frequency_mhz=3200, form_factor="ATX",
                   cpu_support=[MotherboardCpuSupport("cpu-12100f", SupportStatus.COMPATIBLE)]),
        _component(Motherboard, "mb-z890-p", "MSI PRO Z890-P WIFI", "MSI",
                   ComponentCategory.MOTHERBOARD, base=50,
                   offers=[(DNS, 17999), (CITILINK, 18499)],
                   socket="LGA1851", memory_type="DDR5", memory_slots=4, max_memory_gb=192,
                   max_memory_frequency_mhz=6400, form_factor="ATX",
                   cpu_support=[MotherboardCpuSupport("cpu-245k", SupportStatus.COMPATIBLE)]),
    ]

    # --- Память ---
    rams = [
        _component(MemoryModule, "ram-d4-16-3200", "16 ГБ DDR4-3200 (2×8)", "Kingston",
                   ComponentCategory.MEMORY, base=8,
                   offers=[(DNS, 2999), (CITILINK, 3199), (REGARD, 2890)],
                   memory_type="DDR4", capacity_gb=8, modules_count=2, frequency_mhz=3200),
        _component(MemoryModule, "ram-d4-32-3200", "32 ГБ DDR4-3200 (2×16)", "Kingston",
                   ComponentCategory.MEMORY, base=8,
                   offers=[(DNS, 5499), (CITILINK, 5699)],
                   memory_type="DDR4", capacity_gb=16, modules_count=2, frequency_mhz=3200),
        _component(MemoryModule, "ram-d5-32-6000", "32 ГБ DDR5-6000 (2×16)", "Kingston",
                   ComponentCategory.MEMORY, base=8,
                   offers=[(DNS, 8499), (CITILINK, 8899), (REGARD, 8390)],
                   memory_type="DDR5", capacity_gb=16, modules_count=2, frequency_mhz=6000),
        _component(MemoryModule, "ram-d5-32-6400", "32 ГБ DDR5-6400 (2×16)", "Corsair",
                   ComponentCategory.MEMORY, base=8,
                   offers=[(DNS, 9499), (CITILINK, 9799)],
                   memory_type="DDR5", capacity_gb=16, modules_count=2, frequency_mhz=6400),
        _component(MemoryModule, "ram-d5-64-5200", "64 ГБ DDR5-5200 (4×16)", "Kingston",
                   ComponentCategory.MEMORY, base=10,
                   offers=[(DNS, 15999), (CITILINK, 16499)],
                   memory_type="DDR5", capacity_gb=16, modules_count=4, frequency_mhz=5200),
        _component(MemoryModule, "ram-d5-192-5600", "192 ГБ DDR5-5600 (4×48)", "Corsair",
                   ComponentCategory.MEMORY, base=10,
                   offers=[(DNS, 42999), (CITILINK, 43999)],
                   memory_type="DDR5", capacity_gb=48, modules_count=4, frequency_mhz=5600),
        _component(MemoryModule, "ram-d5-32-7200", "32 ГБ DDR5-7200 (2×16)", "Corsair",
                   ComponentCategory.MEMORY, base=8,
                   offers=[(DNS, 11999), (CITILINK, 12499)],
                   memory_type="DDR5", capacity_gb=16, modules_count=2, frequency_mhz=7200),
    ]

    # --- Видеокарты ---
    gpus = [
        _component(VideoCard, "gpu-rtx3050", "GeForce RTX 3050 6GB", "Palit",
                   ComponentCategory.VIDEO_CARD,
                   offers=[(DNS, 15999), (CITILINK, 16499), (REGARD, 15690)],
                   tdp_watts=70, length_mm=200),
        _component(VideoCard, "gpu-rtx4060", "MSI GeForce RTX 4060 Ventus 2X 8G", "MSI",
                   ComponentCategory.VIDEO_CARD,
                   offers=[(DNS, 26999), (CITILINK, 27999), (REGARD, 26690)],
                   tdp_watts=115, length_mm=242),
        _component(VideoCard, "gpu-rtx4070s", "GeForce RTX 4070 SUPER", "Palit",
                   ComponentCategory.VIDEO_CARD,
                   offers=[(DNS, 61999), (CITILINK, 63499), (REGARD, 61490)],
                   tdp_watts=220, length_mm=305),
        _component(VideoCard, "gpu-rx7600", "AMD Radeon RX 7600", "Sapphire",
                   ComponentCategory.VIDEO_CARD,
                   offers=[(DNS, 24999), (CITILINK, 25999)],
                   tdp_watts=165, length_mm=240),
    ]

    # --- Блоки питания ---
    psus = [
        _component(PowerSupply, "psu-500", "500W 80+ (учебный заниженный)", "DeepCool",
                   ComponentCategory.POWER_SUPPLY,
                   offers=[(DNS, 2999), (CITILINK, 3199)], wattage=500),
        _component(PowerSupply, "psu-550", "be quiet! System Power 10 550W", "be quiet!",
                   ComponentCategory.POWER_SUPPLY,
                   offers=[(DNS, 4499), (CITILINK, 4699), (REGARD, 4390)], wattage=550),
        _component(PowerSupply, "psu-650", "650W 80+ Bronze", "DeepCool",
                   ComponentCategory.POWER_SUPPLY,
                   offers=[(DNS, 5499), (CITILINK, 5699), (REGARD, 5390)], wattage=650),
        _component(PowerSupply, "psu-750", "750W 80+ Gold", "be quiet!",
                   ComponentCategory.POWER_SUPPLY,
                   offers=[(DNS, 8499), (CITILINK, 8799)], wattage=750),
        _component(PowerSupply, "psu-850", "850W 80+ Gold", "be quiet!",
                   ComponentCategory.POWER_SUPPLY,
                   offers=[(DNS, 10999), (CITILINK, 11299)], wattage=850),
    ]

    # --- Корпуса (правила приоритета 2 — в MVP не проверяются) ---
    cases = [
        _component(PCCase, "case-pop-air", "Fractal Design Pop Air", "Fractal Design",
                   ComponentCategory.CASE, base=10,
                   offers=[(DNS, 6999), (CITILINK, 7299)],
                   supported_form_factors=["ATX", "Micro-ATX", "Mini-ITX"], max_gpu_length_mm=400),
        _component(PCCase, "case-air-100", "Montech AIR 100 ARGB", "Montech",
                   ComponentCategory.CASE, base=10,
                   offers=[(DNS, 4999), (CITILINK, 5299)],
                   supported_form_factors=["Micro-ATX", "Mini-ITX"], max_gpu_length_mm=330),
        _component(PCCase, "case-ch370", "DeepCool CH370", "DeepCool",
                   ComponentCategory.CASE, base=10,
                   offers=[(DNS, 5499), (CITILINK, 5699)],
                   supported_form_factors=["Micro-ATX", "Mini-ITX"], max_gpu_length_mm=320),
    ]

    # --- Накопители (правил совместимости в MVP нет) ---
    storages = [
        _component(StorageDevice, "ssd-nv2-500", "Kingston NV2 500 ГБ (NVMe)", "Kingston",
                   ComponentCategory.STORAGE, base=5,
                   offers=[(DNS, 3499), (CITILINK, 3699), (REGARD, 3390)],
                   capacity_gb=500, storage_type="NVMe SSD"),
        _component(StorageDevice, "ssd-nv2-1tb", "Kingston NV2 1 ТБ (NVMe)", "Kingston",
                   ComponentCategory.STORAGE, base=5,
                   offers=[(DNS, 5499), (CITILINK, 5699), (REGARD, 5390)],
                   capacity_gb=1000, storage_type="NVMe SSD"),
        _component(StorageDevice, "ssd-870evo-1tb", "Samsung 870 EVO 1 ТБ (SATA)", "Samsung",
                   ComponentCategory.STORAGE, base=4,
                   offers=[(DNS, 7999), (CITILINK, 8299)],
                   capacity_gb=1000, storage_type="SATA SSD"),
        _component(StorageDevice, "ssd-990pro-2tb", "Samsung 990 PRO 2 ТБ (NVMe)", "Samsung",
                   ComponentCategory.STORAGE, base=6,
                   offers=[(DNS, 16999), (CITILINK, 17499), (REGARD, 16850)],
                   capacity_gb=2000, storage_type="NVMe SSD"),
        _component(StorageDevice, "hdd-barracuda-2tb", "Seagate BarraCuda 2 ТБ (HDD)", "Seagate",
                   ComponentCategory.STORAGE, base=8,
                   offers=[(DNS, 5999), (CITILINK, 6299)],
                   capacity_gb=2000, storage_type="HDD"),
    ]

    catalog = cpus + mbs + rams + gpus + psus + cases + storages
    return catalog


PROFILES = [
    UsageProfile(id="gaming", name="игры", priority_category=ComponentCategory.VIDEO_CARD),
    UsageProfile(id="study", name="учёба", priority_category=ComponentCategory.PROCESSOR),
    UsageProfile(id="work", name="работа", priority_category=ComponentCategory.MEMORY),
    UsageProfile(id="video", name="монтаж видео", priority_category=ComponentCategory.VIDEO_CARD),
    UsageProfile(id="dev", name="программирование", priority_category=ComponentCategory.PROCESSOR),
]
