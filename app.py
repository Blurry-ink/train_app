from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
CORS(app)  # Включаем CORS для всех маршрутов

# Конфигурация базы данных
db_config = {
    'user': 'revatech',
    'password': 'q-0xnKXxnKX0',
    'host': 'mysql-revatech.alwaysdata.net',
    'database': 'revatech_train_bot'
}

# Функция для подключения к базе данных
def get_db_connection():
    conn = mysql.connector.connect(**db_config)
    return conn

# Маршрут для получения данных пользователя по username
@app.route('/user_by_name/<username>', methods=['GET'])
def get_user_by_name(username):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Получаем пользователя по имени
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    if user:
        return jsonify({"user": user})
    else:
        return jsonify({"user": None})

# Маршрут для создания нового пользователя
@app.route('/create_user', methods=['POST'])
def create_user():
    data = request.json
    username = data['username']
    
    conn = get_db_connection()
    cursor = conn.cursor()

    # Создаем нового пользователя с начальными значениями
    cursor.execute("""
        INSERT INTO users (username, current_level, current_experience, experience_for_next_level)
        VALUES (%s, %s, %s, %s)
    """, (username, 1, 0, 1000))
    conn.commit()
    
    # Возвращаем ID нового пользователя
    user_id = cursor.lastrowid
    cursor.close()
    conn.close()
    
    return jsonify({"id": user_id})

# Маршрут для получения данных пользователя по его ID
@app.route('/user/<int:user_id>', methods=['GET'])
def get_user_data(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Получаем данные пользователя
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user_data = cursor.fetchone()

    # Получаем данные о тренировках
    cursor.execute("SELECT * FROM training_log WHERE user_id = %s", (user_id,))
    training_log = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return jsonify({'user': user_data, 'training_log': training_log})

# Маршрут для обновления данных о тренировке
@app.route('/update_training', methods=['POST'])
def update_training():
    data = request.json
    user_id = data['user_id']
    date = data['date']

    # Преобразуем данные в целые числа, если они переданы правильно
    try:
        press = int(data['press'])
        squat = int(data['squat'])
        pushup = int(data['pushup'])
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid data provided'}), 400  # Возвращаем ошибку, если данные неверны

    completed = data['completed']

    # Подключение к базе данных
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Проверка существования пользователя
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()

    if user is None:
        cursor.close()
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    # Преобразуем значения в целые числа
    current_experience = int(user['current_experience'])
    current_level = int(user['current_level'])
    experience_for_next_level = int(user['experience_for_next_level'])

    # Проверка наличия предыдущей записи о тренировке за текущий день
    cursor.execute("SELECT * FROM training_log WHERE user_id = %s AND date = %s", (user_id, date))
    previous_training = cursor.fetchone()

    # Если запись о тренировке уже существует, вычисляем разницу
    if previous_training:
        previous_press = int(previous_training['press'])
        previous_squat = int(previous_training['squat'])
        previous_pushup = int(previous_training['pushup'])

        # Разница между новыми и старыми значениями
        press_diff = press - previous_press
        squat_diff = squat - previous_squat
        pushup_diff = pushup - previous_pushup
    else:
        # Если предыдущей записи нет, считаем всю тренировку как новую
        press_diff = press
        squat_diff = squat
        pushup_diff = pushup

    # Начисление опыта только за новую разницу
    xp_gain = (max(press_diff, 0) + max(squat_diff, 0) + max(pushup_diff, 0)) * 10
    current_experience += xp_gain

    # Экспоненциальная формула для расчета опыта для следующего уровня
    def calculate_experience_for_next_level(level, base_xp=1000, growth_rate=1.5):
        return int(base_xp * (growth_rate ** (level - 1)))

    # Проверка на повышение уровня
    while current_experience >= experience_for_next_level:
        current_experience -= experience_for_next_level
        current_level += 1
        experience_for_next_level = calculate_experience_for_next_level(current_level)

    # Обновляем данные пользователя
    cursor.execute("""
        UPDATE users
        SET current_experience = %s, current_level = %s, experience_for_next_level = %s
        WHERE id = %s
    """, (current_experience, current_level, experience_for_next_level, user_id))

    # Вставка или обновление данных тренировки в таблицу training_log
    cursor.execute("""
        INSERT INTO training_log (user_id, date, press, squat, pushup, completed)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE press = VALUES(press), squat = VALUES(squat), pushup = VALUES(pushup), completed = VALUES(completed)
    """, (user_id, date, press, squat, pushup, completed))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'message': 'Training updated successfully', 'current_level': current_level, 'current_experience': current_experience})

if __name__ == '__main__':
    app.run(debug=True)
