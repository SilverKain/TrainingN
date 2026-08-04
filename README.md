# Трекер тренировок

Простое браузерное приложение для:

- календаря тренировок;
- базы упражнений;
- прогресса по выполненным упражнениям;
- хранения данных локально или через Firebase.

## Локальный запуск

1. Откройте `index.html` в браузере.
2. Без Firebase все данные сохраняются в `localStorage` этого браузера.

## Подключение Firebase

В проект уже добавлены:

- `firebase-config.js` — рабочий файл конфигурации;
- `firebase-config.example.js` — пример заполнения;
- `firebase-service.js` — подключение анонимной авторизации и Firestore;
- `firestore.rules` — правила доступа к данным.

### Что нужно сделать

1. В Firebase Console создайте проект.
2. Добавьте Web App.
3. Скопируйте конфиг Firebase Web App в `firebase-config.js`.
4. Включите `Authentication -> Sign-in method -> Anonymous`.
5. Создайте базу `Firestore Database` в production или test mode.
6. Загрузите правила из `firestore.rules`.

### Где будут храниться данные

Данные сохраняются в Firestore по пути:

`users/{uid}/training/appState`

У каждого анонимного пользователя будет свой отдельный документ состояния.
