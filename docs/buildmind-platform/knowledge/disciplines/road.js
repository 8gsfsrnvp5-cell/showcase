/*
  Дорожные работы, АСУДД и наружное освещение.
  Сами типовые работы — в дорожной базе знаний ядра (roadKnowledgeBase.js);
  здесь — профильный агент, нормативы, акты и правила комплектности.
*/
(function (pack) {
  if (typeof module === 'object' && module.exports) module.exports = pack;
  else self.BuildMindDisciplines.addPack(pack);
})({
  id: 'road',
  order: 1,
  name: 'Дорожные работы и АСУДД',
  shortName: 'Дороги',
  monogram: 'ДР',
  color: '#475569',
  description: 'Кабельная канализация, светофорные объекты, знаки, разметка, ограждения, освещение улиц.',
  usesCoreRoadKnowledge: true,
  agent: {
    name: 'Агент «Дороги и АСУДД»',
    role: 'Инженер ПТО по дорожным работам и организации движения',
    focus: [
      'Сопоставление ГПР и ВОР по дорожным работам',
      'Последовательность: траншея → канализация → кабель → оборудование',
      'Комплектность кабельной канализации и колодцев',
    ],
  },
  normativeRefs: ['sp34', 'sp78', 'gost52289', 'gost52290', 'gost51256', 'pr344'],
  executiveDocs: [
    'Исполнительные геодезические схемы трасс и установленного оборудования',
    'Акты освидетельствования скрытых работ',
    'Общий журнал работ',
  ],
  workExtras: {
    'road-earthworks-trench': {
      hiddenWorksActs: ['Акт освидетельствования основания (дна) траншеи'],
      normativeRefs: ['sp45', 'sp126'],
    },
    'road-backfill-compaction': {
      hiddenWorksActs: ['Акт освидетельствования обратной засыпки с результатами контроля уплотнения'],
      normativeRefs: ['sp45', 'sp78'],
    },
    'road-underground-duct': {
      hiddenWorksActs: ['Акт освидетельствования укладки труб кабельной канализации до засыпки'],
      normativeRefs: ['sp76'],
    },
    'road-cable-installation': {
      hiddenWorksActs: ['Акт освидетельствования прокладки кабеля в канализации/траншее'],
      executiveDocs: ['Протокол измерения сопротивления изоляции кабеля'],
      normativeRefs: ['pue', 'sp76'],
    },
    'road-cable-well': {
      hiddenWorksActs: ['Акт освидетельствования основания и установки колодца'],
      normativeRefs: ['sp45'],
    },
    'road-traffic-light': {
      hiddenWorksActs: ['Акт освидетельствования фундамента опоры светофора'],
      executiveDocs: ['Протокол проверки заземления', 'Акт пусконаладки светофорного объекта'],
      normativeRefs: ['gost52289', 'pue'],
    },
    'road-sign-installation': { normativeRefs: ['gost52289', 'gost52290'] },
    'road-road-marking': { normativeRefs: ['gost52289', 'gost51256'] },
    'road-curb-installation': {
      hiddenWorksActs: ['Акт освидетельствования основания под бортовой камень'],
      normativeRefs: ['sp78', 'sp82'],
    },
    'road-lighting-pole': {
      hiddenWorksActs: ['Акт освидетельствования фундамента опоры освещения'],
      executiveDocs: ['Протокол проверки заземления опор'],
      normativeRefs: ['pue', 'sp52'],
    },
  },
  companionRules: [
    {
      id: 'duct-needs-trench',
      ifWork: 'road-underground-duct',
      expect: ['road-earthworks-trench', 'road-backfill-compaction'],
      message: 'Кабельная канализация есть, а разработки траншеи или обратной засыпки в документах нет — проверьте, не учтены ли они в другой позиции.',
    },
    {
      id: 'traffic-light-needs-cable',
      ifWork: 'road-traffic-light',
      expect: ['road-cable-installation'],
      message: 'Светофорный объект есть, а прокладки кабеля питания и управления нет — проверьте ВОР.',
    },
  ],
  works: [],
});
