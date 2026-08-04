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
- `firebase-service.js` — подключение Google Sign-In и Firestore;
- `firestore.rules` — правила доступа к данным.

### Что нужно сделать в Firebase Console

1. Создайте проект Firebase.
2. Добавьте `Web App`.
3. Скопируйте конфиг Firebase Web App в `firebase-config.js`.
4. Включите `Authentication -> Sign-in method -> Google`.
5. В `Authentication -> Settings -> Authorized domains` добавьте:
   - `silverkain.github.io`
6. Создайте `Firestore Database`.
7. Опубликуйте правила из `firestore.rules`.

### Как это работает

- На ПК вход открывается через popup Google.
- На телефоне вход идёт через redirect Google.
- После входа один и тот же аккаунт сможет использовать приложение и на ПК, и на телефоне.

### Где будут храниться данные

Данные сохраняются в Firestore по пути:

`users/{uid}/training/appState`

У каждого Google-аккаунта будет свой отдельный документ состояния.
