'use strict';

/*
  ==================================================
  BUILDMIND ROAD KNOWLEDGE BASE — DEMO V1
  ==================================================

  База содержит предварительные инженерные шаблоны.

  Все рекомендации:
  - требуют проверки инженером;
  - не заменяют проектную документацию;
  - не являются официальными нормативами;
  - не разрешают автоматическую закупку или замену.
*/

const ROAD_KNOWLEDGE_BASE_VERSION =
  'road-demo-v1';

const ROAD_KNOWLEDGE_BASE = [
  {
    id: 'road-earthworks-trench',

    categoryId: 'earthworks',
    categoryName: 'Земляные работы',

    name: 'Разработка траншеи',

    aliases: [
      'разработка траншеи',
      'устройство траншеи',
      'рытье траншеи',
      'рытьё траншеи',
      'земляные работы под кабель',
      'траншея под кабельную канализацию'
    ],

    description:
      'Разработка грунта для размещения кабельной канализации, труб, футляров или инженерных сетей.',

    materials: [
      {
        id: 'sand',
        name: 'Песок',
        role: 'Подготовка основания и защитная засыпка',
        required: false
      },
      {
        id: 'warning-tape',
        name: 'Сигнальная лента',
        role: 'Обозначение подземной коммуникации',
        required: false
      },
      {
        id: 'geotextile',
        name: 'Геотекстиль',
        role: 'Разделение слоёв при необходимости',
        required: false
      }
    ],

    typicalMissing: [
      {
        name: 'Сигнальная лента',
        reason:
          'Может потребоваться для обозначения подземной коммуникации.'
      },
      {
        name: 'Материал защитной засыпки',
        reason:
          'В проекте может быть не выделен отдельной позицией.'
      },
      {
        name: 'Материалы временного ограждения',
        reason:
          'Часто относятся к организации работ и не попадают в основную спецификацию.'
      }
    ],

    tools: [
      {
        name: 'Лазерный нивелир',
        quantityHint: 1
      },
      {
        name: 'Ручной измерительный инструмент',
        quantityHint: 1
      },
      {
        name: 'Виброплита или ручная трамбовка',
        quantityHint: 1
      }
    ],

    equipment: [
      {
        name: 'Экскаватор',
        quantityHint: 1,
        purpose: 'Разработка грунта'
      },
      {
        name: 'Самосвал',
        quantityHint: 1,
        purpose: 'Вывоз или доставка грунта'
      }
    ],

    crew: {
      suggestedRoles: [
        {
          role: 'Машинист экскаватора',
          quantityHint: 1
        },
        {
          role: 'Дорожный рабочий',
          quantityHint: 2
        },
        {
          role: 'Геодезист',
          quantityHint: 1,
          temporary: true
        }
      ],

      note:
        'Состав зависит от объёма, грунтовых условий, глубины и ограничений участка.'
    },

    checks: [
      'Проверить наличие согласований на производство земляных работ.',
      'Проверить существующие подземные коммуникации.',
      'Проверить отметки дна траншеи.',
      'Проверить способ вывоза или временного хранения грунта.',
      'Проверить ограждение и безопасность зоны работ.'
    ],

    risks: [
      'Неучтённые подземные коммуникации.',
      'Несоответствие фактического грунта проектным данным.',
      'Недостаточное уплотнение обратной засыпки.',
      'Задержка работ из-за отсутствия места складирования грунта.'
    ],

    relatedWorkIds: [
      'road-underground-duct',
      'road-backfill-compaction'
    ]
  },

  {
    id: 'road-backfill-compaction',

    categoryId: 'earthworks',
    categoryName: 'Земляные работы',

    name: 'Обратная засыпка и уплотнение',

    aliases: [
      'обратная засыпка',
      'послойная засыпка',
      'уплотнение грунта',
      'засыпка траншеи',
      'восстановление траншеи'
    ],

    description:
      'Послойное заполнение траншеи с контролем материалов засыпки и качества уплотнения.',

    materials: [
      {
        id: 'sand-backfill',
        name: 'Песок для засыпки',
        role: 'Защитный и выравнивающий слой',
        required: false
      },
      {
        id: 'backfill-soil',
        name: 'Грунт обратной засыпки',
        role: 'Основной объём обратной засыпки',
        required: true
      }
    ],

    typicalMissing: [
      {
        name: 'Вода для увлажнения',
        reason:
          'Может потребоваться для достижения необходимого качества уплотнения.'
      },
      {
        name: 'Материалы восстановления покрытия',
        reason:
          'Иногда находятся в другом разделе проекта.'
      }
    ],

    tools: [
      {
        name: 'Виброплита',
        quantityHint: 1
      },
      {
        name: 'Измерительный инструмент',
        quantityHint: 1
      }
    ],

    equipment: [
      {
        name: 'Мини-погрузчик',
        quantityHint: 1,
        purpose: 'Подача и распределение материала'
      },
      {
        name: 'Поливомоечная машина',
        quantityHint: 1,
        purpose: 'Увлажнение материала при необходимости',
        optional: true
      }
    ],

    crew: {
      suggestedRoles: [
        {
          role: 'Машинист',
          quantityHint: 1
        },
        {
          role: 'Дорожный рабочий',
          quantityHint: 2
        }
      ],

      note:
        'Фактический состав определяется объёмом и применяемой механизацией.'
    },

    checks: [
      'Проверить разрешённый материал обратной засыпки.',
      'Проверить толщину уплотняемых слоёв.',
      'Проверить лабораторный контроль при его необходимости.',
      'Проверить восстановление покрытия и благоустройства.'
    ],

    risks: [
      'Просадка после завершения работ.',
      'Повреждение проложенных коммуникаций.',
      'Несвоевременное восстановление дорожного покрытия.'
    ],

    relatedWorkIds: [
      'road-earthworks-trench',
      'road-underground-duct'
    ]
  },

  {
    id: 'road-underground-duct',

    categoryId: 'cable-infrastructure',
    categoryName: 'Кабельная инфраструктура',

    name: 'Устройство подземной кабельной канализации',

    aliases: [
      'подземная кабельная канализация',
      'прокладка кабельной канализации',
      'прокладка труб в траншее',
      'устройство кабельной канализации',
      'кабельная канализация в грунте'
    ],

    description:
      'Монтаж труб, соединительных элементов, защитных слоёв и устройств доступа для последующей прокладки кабеля.',

    materials: [
      {
        id: 'duct-pipe',
        name: 'Труба кабельной канализации',
        role: 'Основной канал для кабеля',
        required: true
      },
      {
        id: 'duct-coupling',
        name: 'Муфта соединительная',
        role: 'Соединение труб',
        required: true
      },
      {
        id: 'duct-plug',
        name: 'Заглушка',
        role: 'Защита свободных концов',
        required: false
      },
      {
        id: 'pull-rope',
        name: 'Протяжка или трос',
        role: 'Последующая протяжка кабеля',
        required: false
      },
      {
        id: 'cable-well',
        name: 'Кабельный колодец',
        role: 'Доступ и протяжка кабеля',
        required: false
      }
    ],

    typicalMissing: [
      {
        name: 'Муфты',
        reason:
          'Количество труб иногда приводится без соединительных элементов.'
      },
      {
        name: 'Заглушки',
        reason:
          'Не всегда выделяются отдельной строкой спецификации.'
      },
      {
        name: 'Протяжка',
        reason:
          'Необходима для последующей прокладки кабеля.'
      },
      {
        name: 'Маркировка трассы',
        reason:
          'Может отсутствовать в материальной ведомости.'
      },
      {
        name: 'Герметизирующие материалы',
        reason:
          'Могут потребоваться для защиты вводов и соединений.'
      }
    ],

    tools: [
      {
        name: 'Ручной инструмент для соединения труб',
        quantityHint: 2
      },
      {
        name: 'Измерительный инструмент',
        quantityHint: 1
      },
      {
        name: 'Оборудование для проверки проходимости',
        quantityHint: 1
      }
    ],

    equipment: [
      {
        name: 'Манипулятор',
        quantityHint: 1,
        purpose: 'Разгрузка труб и колодцев',
        optional: true
      },
      {
        name: 'Экскаватор',
        quantityHint: 1,
        purpose: 'Подготовка траншеи',
        optional: true
      }
    ],

    crew: {
      suggestedRoles: [
        {
          role: 'Монтажник',
          quantityHint: 3
        },
        {
          role: 'Машинист',
          quantityHint: 1,
          temporary: true
        }
      ],

      note:
        'Количество монтажников зависит от диаметра труб, длины захватки и условий производства.'
    },

    checks: [
      'Проверить проектную отметку и уклон трассы.',
      'Проверить количество и диаметр труб.',
      'Проверить герметичность и целостность соединений.',
      'Проверить проходимость каждого канала.',
      'Проверить наличие протяжки.',
      'Проверить исполнительную съёмку до обратной засыпки.'
    ],

    risks: [
      'Непроходимость канала после обратной засыпки.',
      'Недостаток соединительных муфт.',
      'Повреждение труб при уплотнении.',
      'Отсутствие исполнительной фиксации скрытых работ.'
    ],

    relatedWorkIds: [
      'road-earthworks-trench',
      'road-backfill-compaction',
      'road-cable-installation'
    ]
  },

  {
    id: 'road-cable-installation',

    categoryId: 'cable-infrastructure',
    categoryName: 'Кабельная инфраструктура',

    name: 'Прокладка кабеля',

    aliases: [
      'прокладка кабеля',
      'протяжка кабеля',
      'монтаж кабельной линии',
      'кабельные работы',
      'прокладка силового кабеля',
      'прокладка оптического кабеля'
    ],

    description:
      'Протяжка, раскладка, маркировка и подготовка кабеля к подключению.',

    materials: [
      {
        id: 'cable',
        name: 'Кабель',
        role: 'Основной материал',
        required: true
      },
      {
        id: 'cable-label',
        name: 'Кабельная маркировка',
        role: 'Идентификация линии',
        required: true
      },
      {
        id: 'cable-tie',
        name: 'Кабельные стяжки или крепёж',
        role: 'Фиксация кабеля',
        required: false
      },
      {
        id: 'cable-lug',
        name: 'Кабельные наконечники',
        role: 'Подключение жил',
        required: false
      }
    ],

    typicalMissing: [
      {
        name: 'Кабельные наконечники',
        reason:
          'Часто рассчитываются отдельно от длины кабеля.'
      },
      {
        name: 'Маркировка',
        reason:
          'Может не попадать в основную спецификацию.'
      },
      {
        name: 'Материалы герметизации вводов',
        reason:
          'Необходимость появляется в местах входа в шкафы и корпуса.'
      },
      {
        name: 'Запас кабеля',
        reason:
          'Нужно проверить монтажный запас и запас на разделку.'
      }
    ],

    tools: [
      {
        name: 'Устройство для протяжки кабеля',
        quantityHint: 1
      },
      {
        name: 'Кабельные ролики',
        quantityHint: 6
      },
      {
        name: 'Инструмент для разделки кабеля',
        quantityHint: 2
      },
      {
        name: 'Измерительное оборудование',
        quantityHint: 1
      }
    ],

    equipment: [
      {
        name: 'Кабельный домкрат',
        quantityHint: 2,
        purpose: 'Установка барабана'
      },
      {
        name: 'Манипулятор',
        quantityHint: 1,
        purpose: 'Погрузка и установка кабельного барабана',
        optional: true
      }
    ],

    crew: {
      suggestedRoles: [
        {
          role: 'Электромонтажник',
          quantityHint: 4
        },
        {
          role: 'Мастер или производитель работ',
          quantityHint: 1
        }
      ],

      note:
        'Состав зависит от массы кабеля, длины захватки, числа поворотов и способа прокладки.'
    },

    checks: [
      'Проверить длину трассы и монтажный запас.',
      'Проверить допустимое тяговое усилие.',
      'Проверить минимальный радиус изгиба.',
      'Проверить маркировку обоих концов.',
      'Проверить результаты измерений после прокладки.'
    ],

    risks: [
      'Недостаточная длина кабеля.',
      'Повреждение оболочки при протяжке.',
      'Отсутствие кабельных наконечников.',
      'Отсутствие или несоответствие маркировки.'
    ],

    relatedWorkIds: [
      'road-underground-duct',
      'road-traffic-camera',
      'road-traffic-light'
    ]
  },

  {
    id: 'road-traffic-light',

    categoryId: 'traffic-management',
    categoryName: 'АСУДД и светофорные объекты',

    name: 'Монтаж светофорного объекта',

    aliases: [
      'монтаж светофора',
      'установка светофора',
      'светофорный объект',
      'монтаж светофорной колонки',
      'монтаж дорожного контроллера'
    ],

    description:
      'Монтаж светофоров, опорных конструкций, шкафов, кабелей и оборудования управления.',

    materials: [
      {
        id: 'traffic-light',
        name: 'Светофор',
        role: 'Основное оборудование',
        required: true
      },
      {
        id: 'traffic-controller',
        name: 'Дорожный контроллер',
        role: 'Управление светофорным объектом',
        required: true
      },
      {
        id: 'traffic-pole',
        name: 'Стойка или консоль',
        role: 'Установка оборудования',
        required: true
      },
      {
        id: 'traffic-cabinet',
        name: 'Шкаф управления',
        role: 'Размещение управляющего оборудования',
        required: false
      },
      {
        id: 'traffic-cable',
        name: 'Кабель',
        role: 'Питание и управление',
        required: true
      }
    ],

    typicalMissing: [
      {
        name: 'Анкерные элементы',
        reason:
          'Могут относиться к фундаменту и отсутствовать в спецификации оборудования.'
      },
      {
        name: 'Болты, гайки и шайбы',
        reason:
          'Крепёж нередко учитывается комплектно и не виден отдельной строкой.'
      },
      {
        name: 'Кабельные вводы',
        reason:
          'Необходимы для герметичного ввода кабелей в оборудование.'
      },
      {
        name: 'Маркировка',
        reason:
          'Требуется для кабелей, аппаратов и цепей.'
      },
      {
        name: 'ИБП или резервное питание',
        reason:
          'Следует проверить требования к бесперебойной работе.'
      }
    ],

    tools: [
      {
        name: 'Перфоратор',
        quantityHint: 2
      },
      {
        name: 'Шуруповёрт',
        quantityHint: 2
      },
      {
        name: 'Набор электромонтажного инструмента',
        quantityHint: 2
      },
      {
        name: 'Измерительное оборудование',
        quantityHint: 1
      }
    ],

    equipment: [
      {
        name: 'Автовышка',
        quantityHint: 1,
        purpose: 'Монтаж оборудования на высоте'
      },
      {
        name: 'Манипулятор',
        quantityHint: 1,
        purpose: 'Доставка и установка стоек или консолей',
        optional: true
      }
    ],

    crew: {
      suggestedRoles: [
        {
          role: 'Электромонтажник',
          quantityHint: 2
        },
        {
          role: 'Монтажник конструкций',
          quantityHint: 2
        },
        {
          role: 'Наладчик АСУДД',
          quantityHint: 1,
          temporary: true
        }
      ],

      note:
        'Демо-оценка. Фактический состав определяется проектом, схемой организации движения и объёмом объекта.'
    },

    checks: [
      'Проверить соответствие типов и секций светофоров проекту.',
      'Проверить опоры, консоли и фундаментные элементы.',
      'Проверить кабельные вводы и герметизацию.',
      'Проверить питание, защитные аппараты и заземление.',
      'Проверить программу контроллера и режимы работы.',
      'Проверить испытания и ввод в эксплуатацию.'
    ],

    risks: [
      'Отсутствие крепежа и переходных элементов.',
      'Несоответствие консоли фактическому месту установки.',
      'Отсутствие согласованной программы управления.',
      'Неготовность питания к моменту пусконаладки.'
    ],

    relatedWorkIds: [
      'road-cable-installation',
      'road-traffic-camera',
      'road-sign-installation'
    ]
  },

  {
    id: 'road-traffic-camera',

    categoryId: 'traffic-management',
    categoryName: 'АСУДД и видеонаблюдение',

    name: 'Монтаж дорожной камеры',

    aliases: [
      'монтаж камеры',
      'установка камеры',
      'камера видеонаблюдения',
      'камера асудд',
      'дорожная камера',
      'камера фиксации'
    ],

    description:
      'Установка камеры, кронштейна, линий питания и связи с последующей настройкой.',

    materials: [
      {
        id: 'camera',
        name: 'Камера',
        role: 'Основное оборудование',
        required: true
      },
      {
        id: 'camera-bracket',
        name: 'Кронштейн камеры',
        role: 'Крепление оборудования',
        required: true
      },
      {
        id: 'camera-cable',
        name: 'Кабель питания и связи',
        role: 'Подключение камеры',
        required: true
      },
      {
        id: 'camera-switch',
        name: 'Коммутатор',
        role: 'Передача данных',
        required: false
      },
      {
        id: 'camera-surge',
        name: 'Устройство защиты от перенапряжения',
        role: 'Защита оборудования',
        required: false
      }
    ],

    typicalMissing: [
      {
        name: 'Гермовводы',
        reason:
          'Необходимы для герметичного ввода кабеля.'
      },
      {
        name: 'Крепёж кронштейна',
        reason:
          'Может не входить в комплект поставки камеры.'
      },
      {
        name: 'Защита от перенапряжения',
        reason:
          'Следует проверить проектные требования к наружному оборудованию.'
      },
      {
        name: 'Патч-корды и коннекторы',
        reason:
          'Могут отсутствовать в основной спецификации.'
      }
    ],

    tools: [
      {
        name: 'Перфоратор',
        quantityHint: 1
      },
      {
        name: 'Ноутбук для настройки',
        quantityHint: 1
      },
      {
        name: 'Тестер линий связи',
        quantityHint: 1
      },
      {
        name: 'Набор электромонтажного инструмента',
        quantityHint: 1
      }
    ],

    equipment: [
      {
        name: 'Автовышка',
        quantityHint: 1,
        purpose: 'Монтаж и настройка камеры на высоте'
      }
    ],

    crew: {
      suggestedRoles: [
        {
          role: 'Монтажник',
          quantityHint: 2
        },
        {
          role: 'Инженер по системам связи',
          quantityHint: 1,
          temporary: true
        }
      ],

      note:
        'Фактическая потребность зависит от высоты установки и сложности подключения.'
    },

    checks: [
      'Проверить высоту и направление обзора.',
      'Проверить соответствие кронштейна.',
      'Проверить питание и защиту оборудования.',
      'Проверить линию связи.',
      'Проверить настройку изображения и передачу данных.'
    ],

    risks: [
      'Неучтённый крепёж.',
      'Отсутствие автовышки в необходимую дату.',
      'Неготовность канала связи.',
      'Несоответствие зоны обзора проектному решению.'
    ],

    relatedWorkIds: [
      'road-cable-installation',
      'road-traffic-light'
    ]
  },

  {
    id: 'road-sign-installation',

    categoryId: 'road-safety',
    categoryName: 'Обустройство и безопасность движения',

    name: 'Установка дорожного знака',

    aliases: [
      'установка дорожного знака',
      'монтаж дорожного знака',
      'установка знаков',
      'монтаж знаков',
      'дорожные знаки'
    ],

    description:
      'Установка опоры, креплений и дорожного знака с проверкой положения и видимости.',

    materials: [
      {
        id: 'road-sign',
        name: 'Дорожный знак',
        role: 'Основной элемент',
        required: true
      },
      {
        id: 'sign-post',
        name: 'Стойка дорожного знака',
        role: 'Несущая конструкция',
        required: true
      },
      {
        id: 'sign-clamp',
        name: 'Хомут крепления',
        role: 'Фиксация знака',
        required: true
      },
      {
        id: 'sign-foundation',
        name: 'Фундамент или фундаментный блок',
        role: 'Закрепление стойки',
        required: false
      }
    ],

    typicalMissing: [
      {
        name: 'Хомуты',
        reason:
          'Знак и стойка могут быть указаны без крепёжного комплекта.'
      },
      {
        name: 'Болты, гайки и шайбы',
        reason:
          'Могут входить в комплект, но это необходимо подтвердить.'
      },
      {
        name: 'Материалы фундамента',
        reason:
          'Иногда вынесены в отдельный раздел проекта.'
      }
    ],

    tools: [
      {
        name: 'Перфоратор или бур',
        quantityHint: 1
      },
      {
        name: 'Гаечный инструмент',
        quantityHint: 2
      },
      {
        name: 'Уровень',
        quantityHint: 1
      }
    ],

    equipment: [
      {
        name: 'Бурильная машина',
        quantityHint: 1,
        purpose: 'Подготовка места под стойку',
        optional: true
      },
      {
        name: 'Манипулятор',
        quantityHint: 1,
        purpose: 'Установка крупной опоры или рамы',
        optional: true
      }
    ],

    crew: {
      suggestedRoles: [
        {
          role: 'Дорожный рабочий',
          quantityHint: 2
        },
        {
          role: 'Машинист',
          quantityHint: 1,
          temporary: true
        }
      ],

      note:
        'Количество работников зависит от типа стойки, фундамента и места установки.'
    },

    checks: [
      'Проверить типоразмер и изображение знака.',
      'Проверить координаты и высоту установки.',
      'Проверить направление знака.',
      'Проверить комплект крепления.',
      'Проверить видимость знака после установки.'
    ],

    risks: [
      'Недостаток крепёжных элементов.',
      'Несоответствие стойки или хомута.',
      'Конфликт с существующими коммуникациями.',
      'Неправильное направление или высота установки.'
    ],

    relatedWorkIds: [
      'road-traffic-light',
      'road-road-marking'
    ]
  },

  {
    id: 'road-road-marking',

    categoryId: 'road-safety',
    categoryName: 'Обустройство и безопасность движения',

    name: 'Нанесение дорожной разметки',

    aliases: [
      'дорожная разметка',
      'нанесение разметки',
      'горизонтальная разметка',
      'термопластик',
      'нанесение термопластика'
    ],

    description:
      'Подготовка поверхности и нанесение разметочного материала с контролем геометрии и качества.',

    materials: [
      {
        id: 'marking-material',
        name: 'Разметочный материал',
        role: 'Формирование дорожной разметки',
        required: true
      },
      {
        id: 'glass-beads',
        name: 'Стеклошарики',
        role: 'Обеспечение световозвращения',
        required: false
      },
      {
        id: 'marking-primer',
        name: 'Грунтовочный материал',
        role: 'Подготовка поверхности',
        required: false
      }
    ],

    typicalMissing: [
      {
        name: 'Стеклошарики',
        reason:
          'Могут не быть указаны отдельно от разметочного состава.'
      },
      {
        name: 'Грунтовка',
        reason:
          'Необходимость зависит от технологии и основания.'
      },
      {
        name: 'Материалы временной организации движения',
        reason:
          'Ограждения и конусы часто не включаются в материальную ведомость.'
      }
    ],

    tools: [
      {
        name: 'Измерительный инструмент',
        quantityHint: 1
      },
      {
        name: 'Оборудование для разметки осей',
        quantityHint: 1
      }
    ],

    equipment: [
      {
        name: 'Разметочная машина',
        quantityHint: 1,
        purpose: 'Нанесение разметки'
      },
      {
        name: 'Машина прикрытия',
        quantityHint: 1,
        purpose: 'Безопасность производства работ',
        optional: true
      }
    ],

    crew: {
      suggestedRoles: [
        {
          role: 'Оператор разметочной машины',
          quantityHint: 1
        },
        {
          role: 'Дорожный рабочий',
          quantityHint: 3
        }
      ],

      note:
        'Производительность зависит от схемы разметки, материала, температуры и организации движения.'
    },

    checks: [
      'Проверить готовность и чистоту покрытия.',
      'Проверить погодные условия.',
      'Проверить геометрию и координаты линий.',
      'Проверить расход материала.',
      'Проверить световозвращающие свойства при необходимости.'
    ],

    risks: [
      'Неподходящие погодные условия.',
      'Неготовность дорожного покрытия.',
      'Недостаток разметочного материала.',
      'Отсутствие безопасной схемы производства работ.'
    ],

    relatedWorkIds: [
      'road-sign-installation'
    ]
  }
];

const ROAD_KNOWLEDGE_FAMILIES = [
  {
    id: 'cable-duct',
    name: 'Кабельная канализация',
    categoryId: 'cable-infrastructure',
    categoryName: 'Кабельная инфраструктура',

    base: {
      description:
        'Семейство работ по устройству кабельной канализации. Конкретный состав ресурсов зависит от варианта исполнения.',

      materials: [
        {
          id: 'duct-pipe-family',
          name: 'Труба кабельной канализации',
          aliases: [
            'труба',
            'трубы',
            'труба кабельной канализации'
          ],
          role:
            'Основной канал для последующей прокладки кабеля',
          required: true
        },
        {
          id: 'pull-rope-family',
          name: 'Протяжка или трос',
          aliases: [
            'протяжка',
            'трос'
          ],
          role:
            'Подготовка канала к последующей прокладке кабеля',
          required: false
        }
      ],

      typicalMissing: [
        {
          name: 'Маркировка трассы',
          reason:
            'Может отсутствовать отдельной строкой в материальной ведомости.'
        },
        {
          name: 'Материалы герметизации',
          reason:
            'Потребность зависит от вводов, соединений и проектных решений.'
        }
      ],

      tools: [
        {
          name: 'Измерительный инструмент',
          quantityHint: 1
        }
      ],

      equipment: [],

      crew: {
        suggestedRoles: [
          {
            role: 'Монтажник',
            quantityHint: 3
          }
        ],

        note:
          'Базовый состав является предварительным и уточняется по варианту исполнения и объёму работ.'
      },

      checks: [
        'Проверить трассу и фактическую длину кабельной канализации.',
        'Проверить количество каналов и диаметр труб.',
        'Проверить совместимость соединительных и крепёжных элементов.'
      ],

      risks: [
        'Неполная комплектность сопутствующих материалов.',
        'Несоответствие фактической трассы исходным проектным данным.'
      ]
    },

    variants: {
      underground: {
        id: 'underground',
        name: 'Подземное исполнение',
        legacyWorkId:
          'road-underground-duct'
      },

      overpass: {
        id: 'overpass',
        name: 'Эстакадное исполнение',

        materials: [
          {
            id:
              'duct-overpass-clamp',

            name:
              'Хомут крепления',

            aliases: [
              'хомут',
              'хомуты',
              'хомут крепления'
            ],

            role:
              'Фиксация трубы к несущей конструкции',

            required: true
          },

          {
            id:
              'duct-overpass-bracket',

            name:
              'Кронштейн или уголок',

            aliases: [
              'уголок',
              'кронштейн',
              'консоль'
            ],

            role:
              'Опорный элемент для крепления труб',

            required: true
          },

          {
            id:
              'duct-overpass-fastener',

            name:
              'Болтовой крепёж',

            aliases: [
              'болт',
              'болты',
              'гайка',
              'гайки',
              'шайба',
              'шайбы',
              'крепеж',
              'крепёж'
            ],

            role:
              'Соединение элементов крепления',

            required: false
          }
        ],

        typicalMissing: [
          {
            name:
              'Болты, гайки и шайбы',

            reason:
              'Крепёж может учитываться комплектно и отсутствовать отдельными строками.'
          },

          {
            name:
              'Антикоррозионные материалы',

            reason:
              'Следует проверить требования к защите крепёжных и металлических элементов.'
          }
        ],

        tools: [
          {
            name:
              'Гаечный инструмент',

            quantityHint:
              2
          },

          {
            name:
              'Перфоратор или дрель',

            quantityHint:
              1
          }
        ],

        equipment: [
          {
            name:
              'Автовышка',

            quantityHint:
              1,

            purpose:
              'Доступ к зоне монтажа на высоте',

            optional:
              true
          },

          {
            name:
              'Манипулятор',

            quantityHint:
              1,

            purpose:
              'Подача труб и металлоконструкций',

            optional:
              true
          }
        ],

        crew: {
          suggestedRoles: [
            {
              role:
                'Монтажник',

              quantityHint:
                3
            },

            {
              role:
                'Мастер или производитель работ',

              quantityHint:
                1
            }
          ],

          note:
            'Состав зависит от высоты, типа несущих конструкций, длины захватки и организации доступа.'
        },

        checks: [
          'Проверить тип и шаг крепления труб.',
          'Проверить несущие конструкции и точки крепления.',
          'Проверить доступ для подъёмной техники и организацию безопасной работы на высоте.'
        ],

        risks: [
          'Недостаток крепёжных элементов.',
          'Несоответствие фактического шага опор расчётной схеме.',
          'Отсутствие доступа для подъёмной техники в плановую дату.'
        ]
      },

      bridge: {
        id:
          'bridge',

        name:
          'Мостовое исполнение',

        materials: [
          {
            id:
              'duct-bridge-bracket',

            name:
              'Специальный мостовой кронштейн',

            aliases: [
              'мостовой кронштейн',
              'кронштейн'
            ],

            role:
              'Крепление трассы к мостовой конструкции',

            required:
              true
          },

          {
            id:
              'duct-bridge-corrosion',

            name:
              'Антикоррозионный материал',

            aliases: [
              'антикоррозионный материал',
              'антикоррозионное покрытие'
            ],

            role:
              'Защита металлических элементов',

            required:
              false
          }
        ],

        typicalMissing: [
          {
            name:
              'Компенсационные элементы',

            reason:
              'Необходимость зависит от длины трассы, деформационных швов и конструкции моста.'
          }
        ],

        tools: [],

        equipment: [],

        checks: [
          'Проверить точки крепления к мостовой конструкции.',
          'Проверить прохождение деформационных швов.',
          'Проверить требования к антикоррозионной защите.'
        ],

        risks: [
          'Конфликт трассы с элементами мостовой конструкции.',
          'Неучтённые перемещения в зоне деформационных швов.'
        ]
      },

      'above-ground': {
        id:
          'above-ground',

        name:
          'Надземное исполнение',

        materials: [
          {
            id:
              'duct-above-support',

            name:
              'Опорная конструкция',

            aliases: [
              'опора',
              'стойка',
              'опорная конструкция'
            ],

            role:
              'Поддержка надземной трассы',

            required:
              true
          },

          {
            id:
              'duct-above-bracket',

            name:
              'Кронштейн крепления',

            aliases: [
              'кронштейн',
              'консоль',
              'уголок'
            ],

            role:
              'Фиксация трубы на опорной конструкции',

            required:
              true
          }
        ],

        typicalMissing: [
          {
            name:
              'Крепёж опор и кронштейнов',

            reason:
              'Может учитываться комплектно и не выделяться отдельной строкой.'
          }
        ],

        tools: [],

        equipment: [],

        checks: [
          'Проверить шаг и устойчивость опор.',
          'Проверить защиту трассы от механических воздействий.'
        ],

        risks: [
          'Недостаточная жёсткость опорной системы.',
          'Неучтённый крепёж.'
        ]
      }
    }
  }
];

function normalizeRoadKnowledgeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRoadKnowledgeWorkById(workId) {
  return (
    ROAD_KNOWLEDGE_BASE.find(
      function (workItem) {
        return workItem.id === workId;
      }
    ) || null
  );
}

function findRoadKnowledgeWorkByName(value) {
  const normalizedValue =
    normalizeRoadKnowledgeText(value);

  if (!normalizedValue) {
    return null;
  }

  return (
    ROAD_KNOWLEDGE_BASE.find(
      function (workItem) {
        const searchableValues = [
          workItem.name,
          ...(workItem.aliases || [])
        ].map(
          normalizeRoadKnowledgeText
        );

        return searchableValues.some(
          function (searchableValue) {
            return (
              normalizedValue.includes(
                searchableValue
              ) ||
              searchableValue.includes(
                normalizedValue
              )
            );
          }
        );
      }
    ) || null
  );
}

function getRoadKnowledgeFamilyById(
  familyId
) {
  return (
    ROAD_KNOWLEDGE_FAMILIES.find(
      function (family) {
        return (
          family.id === familyId
        );
      }
    ) || null
  );
}


function mergeRoadKnowledgeObjectsByKey(
  baseItems,
  extraItems,
  keyName
) {
  const result = [];

  const seen =
    new Set();

  [
    ...(baseItems || []),
    ...(extraItems || [])
  ].forEach(
    function (item) {
      const key =
        normalizeRoadKnowledgeText(
          item &&
          item[keyName]
        );

      if (
        !key ||
        seen.has(key)
      ) {
        return;
      }

      seen.add(key);

      result.push({
        ...item
      });
    }
  );

  return result;
}


function mergeRoadKnowledgeStrings(
  baseItems,
  extraItems
) {
  return Array.from(
    new Set([
      ...(baseItems || []),
      ...(extraItems || [])
    ])
  );
}


function resolveRoadKnowledgeFamilyVariant(
  familyId,
  variantId
) {
  const family =
    getRoadKnowledgeFamilyById(
      familyId
    );

  if (!family) {
    return null;
  }

  const variant =
    family.variants &&
    variantId
      ? family.variants[
          variantId
        ]
      : null;

  if (
    variantId &&
    !variant
  ) {
    return null;
  }

  /*
    Для подземной версии у нас уже
    существует старая рабочая запись.

    Поэтому пока используем её
    как совместимый legacy-слой.
  */

  if (
    variant &&
    variant.legacyWorkId
  ) {
    const legacyWork =
      getRoadKnowledgeWorkById(
        variant.legacyWorkId
      );

    if (legacyWork) {
      return {
        ...legacyWork,

        familyId:
          family.id,

        familyName:
          family.name,

        variantId:
          variant.id,

        variantName:
          variant.name,

        knowledgeMode:
          'family-variant',

        legacyWorkId:
          legacyWork.id
      };
    }
  }

  const base =
    family.base || {};

  const variantData =
    variant || {};

  const baseCrew =
    base.crew || {};

  const variantCrew =
    variantData.crew || {};

  return {
    id:
      `family-${family.id}-` +
      `${variant ? variant.id : 'generic'}`,

    familyId:
      family.id,

    familyName:
      family.name,

    variantId:
      variant
        ? variant.id
        : null,

    variantName:
      variant
        ? variant.name
        : '',

    knowledgeMode:
      'family-variant',

    categoryId:
      family.categoryId,

    categoryName:
      family.categoryName,

    name:
      variant
        ? `${family.name} — ${variant.name}`
        : family.name,

    aliases: [],

    description:
      [
        base.description || '',
        variantData.description || ''
      ]
        .filter(Boolean)
        .join(' '),

    materials:
      mergeRoadKnowledgeObjectsByKey(
        base.materials,
        variantData.materials,
        'id'
      ),

    typicalMissing:
      mergeRoadKnowledgeObjectsByKey(
        base.typicalMissing,
        variantData.typicalMissing,
        'name'
      ),

    tools:
      mergeRoadKnowledgeObjectsByKey(
        base.tools,
        variantData.tools,
        'name'
      ),

    equipment:
      mergeRoadKnowledgeObjectsByKey(
        base.equipment,
        variantData.equipment,
        'name'
      ),

    crew: {
      suggestedRoles:
        mergeRoadKnowledgeObjectsByKey(
          baseCrew.suggestedRoles,
          variantCrew.suggestedRoles,
          'role'
        ),

      note:
        variantCrew.note ||
        baseCrew.note ||
        ''
    },

    checks:
      mergeRoadKnowledgeStrings(
        base.checks,
        variantData.checks
      ),

    risks:
      mergeRoadKnowledgeStrings(
        base.risks,
        variantData.risks
      ),

    relatedWorkIds:
      mergeRoadKnowledgeStrings(
        base.relatedWorkIds,
        variantData.relatedWorkIds
      )
  };
}

function getRoadKnowledgeCategories() {
  const categories = new Map();

  ROAD_KNOWLEDGE_BASE.forEach(
    function (workItem) {
      if (
        !categories.has(
          workItem.categoryId
        )
      ) {
        categories.set(
          workItem.categoryId,
          {
            id: workItem.categoryId,
            name: workItem.categoryName,
            worksCount: 0
          }
        );
      }

      categories.get(
        workItem.categoryId
      ).worksCount += 1;
    }
  );

  return Array.from(
    categories.values()
  );
}

function getRoadKnowledgeSummary() {
  const categories =
    getRoadKnowledgeCategories();

  const materialsCount =
    ROAD_KNOWLEDGE_BASE.reduce(
      function (
        total,
        workItem
      ) {
        return (
          total +
          (
            workItem.materials ||
            []
          ).length
        );
      },
      0
    );

  const missingChecksCount =
    ROAD_KNOWLEDGE_BASE.reduce(
      function (
        total,
        workItem
      ) {
        return (
          total +
          (
            workItem.typicalMissing ||
            []
          ).length
        );
      },
      0
    );

  return {
    version:
      ROAD_KNOWLEDGE_BASE_VERSION,

    worksCount:
      ROAD_KNOWLEDGE_BASE.length,

    categoriesCount:
      categories.length,

    materialsCount,

    missingChecksCount,

    familiesCount:
      ROAD_KNOWLEDGE_FAMILIES.length,

    familyVariantsCount:
      ROAD_KNOWLEDGE_FAMILIES.reduce(
        function (
          total,
          family
        ) {
          return (
            total +
            Object.keys(
              family.variants ||
              {}
            ).length
          );
        },
        0
      ),

    categories
  };
}

window.BuildMindRoadKnowledge = {
  version:
    ROAD_KNOWLEDGE_BASE_VERSION,

  works:
    ROAD_KNOWLEDGE_BASE,

  families:
    ROAD_KNOWLEDGE_FAMILIES,

  normalizeText:
    normalizeRoadKnowledgeText,

  getWorkById:
    getRoadKnowledgeWorkById,

  findWorkByName:
    findRoadKnowledgeWorkByName,

  getFamilyById:
    getRoadKnowledgeFamilyById,

  resolveFamilyVariant:
    resolveRoadKnowledgeFamilyVariant,

  getCategories:
    getRoadKnowledgeCategories,

  getSummary:
    getRoadKnowledgeSummary
};

console.info(
  'BuildMind Road Knowledge Base загружена:',
  getRoadKnowledgeSummary()
);
