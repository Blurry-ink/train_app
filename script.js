document.addEventListener('DOMContentLoaded', function () {
    const currentDate = new Date().toISOString().split('T')[0];  // Текущая дата
    let currentLimit = 15;  // Начальный лимит
    let userId = null;  // Переменная для хранения ID пользователя

    document.getElementById('current-date').textContent = currentDate;

    // Проверяем наличие имени пользователя в localStorage
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
        console.log(`Имя пользователя найдено в localStorage: ${savedUsername}`);
        checkAndLoadUser(savedUsername);  // Проверяем и загружаем пользователя
    } else {
        console.log('Имя пользователя не найдено, отображаем поле ввода');
        // Показываем поле для ввода имени, если username нет в localStorage
        document.getElementById('username-container').style.display = 'block';
        document.getElementById('content').style.display = 'none';  // Прячем основной контент
    }

    // ОБРАБОТЧИК КНОПКИ "СОХРАНИТЬ"
    document.getElementById('save-username-btn').addEventListener('click', function () {
        const username = document.getElementById('username').value;
        console.log(`Сохранение имени пользователя: ${username}`);  // Лог для отладки
        if (username) {
            localStorage.setItem('username', username);  // Сохраняем username в localStorage
            document.getElementById('username-container').style.display = 'none';  // Скрываем поле для ввода
            document.getElementById('content').style.display = 'block';  // Показываем основной контент
            checkAndLoadUser(username);  // Проверяем и загружаем пользователя
        } else {
            alert('Пожалуйста, введите имя пользователя');  // Показываем ошибку, если имя пустое
        }
    });

    // Функция для проверки наличия пользователя в базе и загрузки его данных
    async function checkAndLoadUser(username) {
        try {
            console.log(`Проверяем наличие пользователя с именем: ${username}`);
            const response = await fetch(`http://127.0.0.1:5000/user_by_name/${username}`);
            const data = await response.json();

            if (data.user) {
                userId = data.user.id;  // Пользователь найден, сохраняем ID
                document.getElementById('content').style.display = 'block';  // Показываем основной контент
                loadUserData();  // Загружаем данные пользователя
            } else {
                console.log(`Пользователь не найден, создаем нового с именем: ${username}`);
                // Если пользователь не найден, создаем нового
                const createResponse = await fetch('http://127.0.0.1:5000/create_user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: username
                    }),
                });

                const newUser = await createResponse.json();
                userId = newUser.id;  // Сохраняем ID нового пользователя
                document.getElementById('content').style.display = 'block';  // Показываем основной контент
                loadUserData();  // Загружаем данные пользователя
            }
        } catch (error) {
            console.error('Ошибка при проверке или создании пользователя:', error);
        }
    }

    // Функция для получения данных пользователя и тренировок
    async function loadUserData() {
        try {
            const response = await fetch(`http://127.0.0.1:5000/user/${userId}`);
            const data = await response.json();

            if (data.user) {
                // Обновляем данные на странице
                document.getElementById('current-level').textContent = data.user.current_level;
                document.getElementById('current-experience').textContent = data.user.current_experience;
                updateProgressBar(data.user.current_experience, data.user.experience_for_next_level);

                // Обновляем календарь с тренировочными днями
                updateCalendar(data.training_log);
            } else {
                console.error('Пользователь не найден или данные отсутствуют.');
            }
        } catch (error) {
            console.error('Ошибка при получении данных:', error);
        }
    }

    // Функция для обновления календаря
    function updateCalendar(trainingLog) {
        const events = [];
        let limit = 15;  // Лимит начинается с 15

        const today = new Date();
        const todayString = today.toISOString().split('T')[0];

        trainingLog.forEach(log => {
            const logDate = new Date(log.date);
            const logDateString = logDate.toISOString().split('T')[0];

            if (logDate > today) {
                // Не окрашиваем дни в будущем
                return;
            }

            let color = 'red';  // По умолчанию день считается пропущенным (красный)
            if (log.press >= limit && log.squat >= limit && log.pushup >= limit) {
                color = 'green';  // Тренировка выполнена (зелёный)
                limit++;  // Увеличиваем лимит только если тренировка выполнена
            } else if (log.press > 0 || log.squat > 0 || log.pushup > 0) {
                color = 'yellow';  // Частичная тренировка (жёлтый)
            }

            // Добавляем событие в календарь
            events.push({
                title: `Жим: ${log.press}, Присед: ${log.squat}, Пресс: ${log.pushup}`,
                start: logDateString,
                backgroundColor: color,
                allDay: true,
                description: `Жим: ${log.press}, Присед: ${log.squat}, Пресс: ${log.pushup}`  // Полный текст для всплывающей подсказки
            });
        });

        // Добавляем события в календарь
        const calendarEl = document.getElementById('calendar');
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            events: events
        });
        calendar.render();
    }

    // Функция для обновления тренировки
    document.getElementById('submit-btn').addEventListener('click', function () {
        const press = document.getElementById('press').value;
        const squat = document.getElementById('squat').value;
        const pushup = document.getElementById('pushup').value;

        // Отправляем данные на сервер
        updateTraining(press, squat, pushup);
    });

    // Функция для отправки данных на сервер
    async function updateTraining(press, squat, pushup) {
        try {
            const response = await fetch('http://127.0.0.1:5000/update_training', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    date: currentDate,
                    press: press,
                    squat: squat,
                    pushup: pushup,
                    completed: press >= currentLimit && squat >= currentLimit && pushup >= currentLimit
                }),
            });

            const data = await response.json();
            console.log('Тренировка обновлена успешно:', data);

            // После обновления тренировки, обновляем календарь
            loadUserData();
        } catch (error) {
            console.error('Ошибка при обновлении тренировки:', error);
        }
    }

    // Функция для обновления прогресс-бара
    function updateProgressBar(currentXP, nextLevelXP) {
        const progressPercentage = (currentXP / nextLevelXP) * 100;
        document.getElementById('progress').style.width = `${progressPercentage}%`;
    }
});
