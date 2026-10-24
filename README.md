# Showcase — живые демо проектов

Сайт: https://8gsfsrnvp5-cell.github.io/showcase/

Каждый проект собран в статическую демо-версию: серверная часть работает
прямо в браузере посетителя (Service Worker или скрипт на странице), данные —
в `localStorage`/IndexedDB браузера. Хостинг — GitHub Pages из папки `docs/`.

| Путь | Проект | Как собирается |
|---|---|---|
| `/yobanda/` | yobanda | `PAGES_BASE=/showcase/yobanda/ npm run build:pages` (ветка `demo/pages`) |
| `/skyseal-cargo/` | skyseal-cargo | `PAGES_BASE=/showcase/skyseal-cargo/ npm run build:demo` (ветка `demo/pages`) |
| `/kopilka/` | kopilka-gruppy-1 | `node scripts/build-demo.mjs` (ветка `demo/pages`) |
| `/kopilka-lite/` | kopilka-gruppy + демо-бэкенд из kopilka-gruppy-1 | собирает `assemble.mjs` |
| `/buildmind/` | buildmind-core (ветка `agent/core-truth-contract-v1`) | статические файлы как есть |
| `/procurement/`, `/procurement-v1/` | buildmind-procurement-mvp2, архив из BuildMind-procurement-mvp | статические файлы как есть |

## Обновление

1. Склонировать проекты в `repos/` и собрать демо (см. таблицу).
2. `node assemble.mjs` — копирует сборки в `docs/`, добавляет `noindex`,
   главную страницу и `404.html` (возвращает глубокие ссылки в SPA).
3. `node serve.mjs` — локальная проверка на http://localhost:4600/showcase/
   с теми же правилами, что у GitHub Pages.
4. Закоммитить и отправить `docs/`.
