/*
  Выработка и технологические перерывы по типовым работам BuildMind.

  output — сколько единиц работы выполняет за смену (8 ч) бригада в составе
  из базы знаний (work.crew, без временных ролей вроде геодезиста). Если у
  работы несколько единиц, выработка задана для каждой.
  breakDays / breakReason — технологический перерыв после работы, пока
  нельзя начинать зависимые работы (бетон набирает прочность, стяжка сохнет).
  В это время бригада свободна — BuildMind предлагает, куда её перевести.

  Это ориентиры по типовой выработке механизированных бригад средней
  квалификации, а не сметные нормы (ГЭСН/ЕНиР). Компания задаёт свою
  выработку во вкладке «Люди и сроки» — она заменяет эти значения.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BuildMindProductivity = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CONCRETE_BREAK = 'Бетон набирает прочность перед распалубкой и нагружением (ориентир при +15…+20 °C; зимой — по прогреву и лаборатории)';

  const NORMS = {
    // Дороги и АСУДД (база ядра)
    'road-earthworks-trench': { output: { м3: 100 } },
    'road-backfill-compaction': { output: { м3: 80 } },
    'road-underground-duct': { output: { м: 80 } },
    'road-cable-installation': { output: { м: 400 } },
    'road-traffic-light': { output: { шт: 2 } },
    'road-traffic-camera': { output: { шт: 2 } },
    'road-sign-installation': { output: { шт: 8 } },
    'road-road-marking': { output: { м2: 500, м: 1500 } },
    'road-barrier-installation': { output: { м: 60 } },
    'road-pedestrian-fence': { output: { м: 40 } },
    'road-delineator-post': { output: { шт: 40 } },
    'road-curb-installation': { output: { м: 60 } },
    'road-lighting-pole': { output: { шт: 4 } },
    'road-cable-well': { output: { шт: 1 } },

    // Земляные работы
    'earth-pit-excavation': { output: { м3: 300 } },
    'earth-trench-excavation': { output: { м3: 120 } },
    'earth-backfill': { output: { м3: 100 } },
    'earth-sand-cushion': { output: { м3: 60 } },
    'earth-dewatering': { output: { сут: 1 } },
    'earth-sheet-piling': { output: { т: 10, м: 25 } },
    'earth-soil-haul': { output: { м3: 250, т: 400 } },

    // Фундаменты
    'found-driven-piles': { output: { шт: 12, м3: 10 } },
    'found-bored-piles': { output: { м3: 15, шт: 3 } },
    'found-pile-testing': { output: { шт: 0.5 } },
    'found-pile-cutting': { output: { шт: 10 } },
    'found-concrete-prep': { output: { м3: 25, м2: 250 }, breakDays: 2, breakReason: 'Бетонная подготовка набирает прочность перед гидроизоляцией и армированием' },
    'found-raft-grillage': { output: { м3: 12 }, breakDays: 7, breakReason: CONCRETE_BREAK },
    'found-waterproofing': { output: { м2: 120 } },

    // Монолит
    'mono-formwork': { output: { м2: 60 } },
    'mono-rebar': { output: { т: 1.5 } },
    'mono-concrete': { output: { м3: 60 }, breakDays: 7, breakReason: CONCRETE_BREAK },
    'mono-curing': { output: { м2: 300, м3: 100 } },
    'mono-embedded': { output: { шт: 30, т: 0.5 } },
    'mono-structures': { output: { м3: 10 }, breakDays: 7, breakReason: CONCRETE_BREAK },

    // Металлоконструкции
    'steel-anchors': { output: { шт: 20, м3: 2 } },
    'steel-erection': { output: { т: 8 } },
    'steel-hs-bolts': { output: { шт: 150 } },
    'steel-welding': { output: { м: 15, т: 1 } },
    'steel-anticorrosion': { output: { м2: 150, т: 5 } },
    'steel-fireproofing': { output: { м2: 60 } },
    'steel-deck': { output: { м2: 150 } },

    // Кладка
    'masonry-brick': { output: { м3: 12 } },
    'masonry-blocks': { output: { м3: 12 } },
    'masonry-partitions': { output: { м2: 30 } },
    'masonry-reinforcement': { output: { т: 0.2, м2: 150 } },
    'masonry-lintels': { output: { шт: 20 } },
    'masonry-facing': { output: { м2: 20, м3: 3 } },

    // Кровля
    'roof-vapor': { output: { м2: 400 } },
    'roof-insulation': { output: { м2: 300, м3: 40 } },
    'roof-slope-screed': { output: { м2: 80 }, breakDays: 7, breakReason: 'Стяжка набирает прочность и просыхает перед устройством кровельного ковра' },
    'roof-bitumen': { output: { м2: 250 } },
    'roof-membrane': { output: { м2: 250 } },
    'roof-pitched': { output: { м2: 80 } },
    'roof-drainage': { output: { шт: 6, м: 30 } },

    // Фасады
    'facade-ventilated': { output: { м2: 40 } },
    'facade-etics': { output: { м2: 30 } },
    'facade-insulation': { output: { м2: 50, м3: 7 } },
    'facade-windows': { output: { м2: 15, шт: 5 } },
    'facade-scaffolding': { output: { м2: 150 } },
    'facade-sealing': { output: { м: 60 } },

    // Отделка
    'fin-plaster': { output: { м2: 120 }, breakDays: 5, breakReason: 'Штукатурка просыхает перед шпатлёвкой и окраской' },
    'fin-paint': { output: { м2: 150 } },
    'fin-screed': { output: { м2: 150 }, breakDays: 7, breakReason: 'Стяжка набирает прочность и отдаёт влагу перед укладкой покрытий пола' },
    'fin-tile': { output: { м2: 15 } },
    'fin-drywall': { output: { м2: 30 } },
    'fin-ceilings': { output: { м2: 40 } },
    'fin-floor-finish': { output: { м2: 60 } },
    'fin-doors': { output: { шт: 6 } },

    // Водопровод и канализация
    'water-supply-pipes': { output: { м: 60 } },
    'water-sewer-pipes': { output: { м: 30 } },
    'water-fixtures': { output: { шт: 6, компл: 6 } },
    'water-meter-pumps': { output: { шт: 2, компл: 1 } },
    'water-fire-main': { output: { м: 30, шт: 4 } },

    // Отопление и вентиляция
    'hvac-heating-pipes': { output: { м: 50 } },
    'hvac-radiators': { output: { шт: 8 } },
    'hvac-ducts': { output: { м2: 40 } },
    'hvac-units': { output: { шт: 1, компл: 1 } },
    'hvac-cooling': { output: { шт: 2, компл: 1 } },
    'hvac-insulation': { output: { м2: 40, м: 80 } },
    'hvac-itp': { output: { компл: 0.1 } },
    'hvac-commissioning': { output: { компл: 0.2, система: 0.5 } },

    // Электромонтаж
    'el-cable-lines': { output: { м: 150 } },
    'el-trays': { output: { м: 40 } },
    'el-panels': { output: { шт: 2 } },
    'el-lighting': { output: { шт: 20 } },
    'el-wiring-devices': { output: { шт: 30 } },
    'el-grounding': { output: { м: 40, компл: 1 } },
    'el-testing': { output: { компл: 0.2 } },

    // Слаботочные системы
    'lc-fire-alarm': { output: { шт: 30, компл: 0.1 } },
    'lc-evacuation': { output: { шт: 20, компл: 0.1 } },
    'lc-extinguishing': { output: { м: 40, шт: 20 } },
    'lc-scs': { output: { м: 300, порт: 20 } },
    'lc-cctv': { output: { шт: 6, компл: 0.2 } },
    'lc-access': { output: { шт: 2, компл: 0.2 } },

    // Наружные сети
    'net-water-pipes': { output: { м: 40 } },
    'net-sewer-pipes': { output: { м: 30 } },
    'net-wells': { output: { шт: 1 } },
    'net-heating': { output: { м: 20 } },
    'net-gas': { output: { м: 30 } },
    'net-hdd': { output: { м: 60 } },
    'net-testing': { output: { м: 500, компл: 0.5 } },

    // Благоустройство
    'land-paving': { output: { м2: 60 } },
    'land-curbs': { output: { м: 40 } },
    'land-asphalt': { output: { м2: 1500 } },
    'land-lawn': { output: { м2: 300 } },
    'land-planting': { output: { шт: 8 } },
    'land-maf': { output: { шт: 6 } },
    'land-fence': { output: { м: 30 } },
  };

  return {
    version: 'productivity-v1',
    get: function (workId) { return NORMS[workId] || null; },
    ids: function () { return Object.keys(NORMS); },
  };
});
