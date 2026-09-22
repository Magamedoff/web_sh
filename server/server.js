const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); 

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); 

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

app.use(express.static(path.join(__dirname, '../client')));

// --- ЭНДПОИНТЫ РАСПИСАНИЯ (Общие) ---

app.get('/api/schedule', async (req, res) => {
    try {
        const query = `
            SELECT * FROM groupweeklyschedule
            WHERE "Date" >= CURRENT_DATE 
              AND "Date" < CURRENT_DATE + INTERVAL '7 days'
            ORDER BY "Date", "Time", "Group"
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка БД:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.get('/api/session', async (req, res) => {
    try {
        const query = `
            SELECT * FROM groupsessionschedule
            WHERE "Date" >= CURRENT_DATE 
            ORDER BY "Date", "Time"
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка БД:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// --- АВТОРИЗАЦИЯ И УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ---

app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    // Очищаем логин от случайных пробелов
    const login = req.body.login.trim(); 
    const passHash = crypto.createHash('sha512').update(password).digest('hex');

    try {
        const query = `
            SELECT id, role, student_id, teacher_id 
            FROM users 
            WHERE login = $1 AND pass_hash = $2
        `;
        const result = await pool.query(query, [login, passHash]);

        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
        }
    } catch (err) {
        console.error('Ошибка БД при авторизации:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.post('/api/admin/register', async (req, res) => {
    const { password, role, personId } = req.body;
    // Очищаем логин от случайных пробелов перед записью в БД
    const login = req.body.login.trim(); 
    const passHash = crypto.createHash('sha512').update(password).digest('hex');
    
    try {
        const maxIdResult = await pool.query('SELECT COALESCE(MAX(id), 0) as max_id FROM users');
        const nextId = parseInt(maxIdResult.rows[0].max_id) + 1;

        let studentId = null;
        let teacherId = null;

        if (role === 2) teacherId = personId;
        if (role === 3) studentId = personId;

        const query = `
            INSERT INTO users (id, login, pass_hash, role, student_id, teacher_id)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await pool.query(query, [nextId, login, passHash, role, studentId, teacherId]);
        res.json({ success: true, message: 'Учетная запись успешно создана' });
    } catch (err) {
        console.error('Ошибка создания пользователя:', err);
        if (err.code === '23505') res.status(400).json({ error: 'Пользователь уже существует' });
        else res.status(500).json({ error: 'Ошибка при создании' });
    }
});

// Получение списка всех пользователей
app.get('/api/admin/users', async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.login, u.role,
                   s.last_name AS s_last, s.first_name AS s_first, s.middle_name AS s_middle,
                   t.last_name AS t_last, t.first_name AS t_first, t.middle_name AS t_middle
            FROM users u
            LEFT JOIN students s ON u.student_id = s.id
            LEFT JOIN teachers t ON u.teacher_id = t.id
            ORDER BY u.role, u.login
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Удаление пользователя
app.delete('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка удаления пользователя:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/teachers', async (req, res) => {
    try {
        const query = `
            SELECT t.id, t.last_name, t.first_name, t.middle_name, d.short_dg_nm, r.short_rn_nm
            FROM teachers t, academicdegrees d, academicranks r
            WHERE t.degree_id = d.id AND t.rank_id = r.id
            ORDER BY t.last_name, t.first_name
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/admin/groups', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, group_nm FROM groups ORDER BY group_nm');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/admin/students/:groupId', async (req, res) => {
    try {
        const query = `SELECT id, last_name, first_name, middle_name FROM students WHERE group_id = $1 ORDER BY last_name`;
        const result = await pool.query(query, [req.params.groupId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/teacher/subjects', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, subject_nm FROM subjects ORDER BY subject_nm');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// --- ЛОГИКА ПРЕПОДАВАТЕЛЯ ---

app.get('/api/teacher/schedule/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const query = `
            SELECT g.group_nm AS "Group", s.lesson_dt AS "Date", s.lesson_tm AS "Time",
                   sub.subject_nm AS "Subject", s.room AS "Room"
            FROM schedules s, groups g, subjects sub, users u
            WHERE s.group_id = g.id AND s.subject_id = sub.id AND s.teacher_id = u.teacher_id
              AND u.id = $1 AND s.lesson_dt >= CURRENT_DATE AND s.lesson_dt < CURRENT_DATE + INTERVAL '7 days'
            ORDER BY s.lesson_dt, s.lesson_tm
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/teacher/session/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const query = `
            SELECT "ScheduleID" AS id, "Group", "Date", "Time", "Subject", "Room"
            FROM teachersessionschedule
            WHERE "UserID" = $1 AND "Date" >= CURRENT_DATE
            ORDER BY "Date", "Time"
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/teacher/exams', async (req, res) => {
    const { groupId, subjectId, examDt, examTm, room, userId } = req.body;
    try {
        const teacherRes = await pool.query(`SELECT teacher_id FROM users WHERE id = $1`, [userId]);
        const teacherId = teacherRes.rows[0].teacher_id;

        const checkQuery = `
            SELECT id FROM examschedules
            WHERE exam_dt = $1 AND exam_tm = $2 
              AND (teacher_id = $3 OR group_id = $4 OR room = $5)
        `;
        const checkResult = await pool.query(checkQuery, [examDt, examTm, teacherId, groupId, room]);

        if (checkResult.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Наложение: группа, преподаватель или аудитория уже заняты.' });
        }

        const maxIdResult = await pool.query('SELECT COALESCE(MAX(id), 0) as max_id FROM examschedules');
        const nextId = parseInt(maxIdResult.rows[0].max_id) + 1;

        const insertQuery = `
            INSERT INTO examschedules (id, group_id, subject_id, exam_dt, exam_tm, teacher_id, room)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await pool.query(insertQuery, [nextId, groupId, subjectId, examDt, examTm, teacherId, room]);
        res.json({ success: true, message: 'Экзамен добавлен в расписание.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при добавлении экзамена' });
    }
});

app.get('/api/teacher/exam-students/:scheduleId', async (req, res) => {
    const { scheduleId } = req.params;
    try {
        const studentsQuery = `
            SELECT s.id, s.last_name, s.first_name, s.middle_name
            FROM students s, examschedules es
            WHERE s.group_id = es.group_id AND es.id = $1
            ORDER BY s.last_name
        `;
        const studentsResult = await pool.query(studentsQuery, [scheduleId]);

        const gradesQuery = `
            SELECT student_id, grade FROM examresults WHERE schedule_id = $1
        `;
        const gradesResult = await pool.query(gradesQuery, [scheduleId]);

        const gradesMap = {};
        gradesResult.rows.forEach(r => { gradesMap[r.student_id] = r.grade; });

        const finalData = studentsResult.rows.map(s => ({
            ...s,
            grade: gradesMap[s.id] || ''
        }));

        res.json(finalData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/teacher/grades', async (req, res) => {
    const { scheduleId, studentId, grade } = req.body;
    try {
        const query = `
            INSERT INTO examresults (schedule_id, student_id, grade)
            VALUES ($1, $2, $3)
            ON CONFLICT (schedule_id, student_id) 
            DO UPDATE SET grade = EXCLUDED.grade
        `;
        await pool.query(query, [scheduleId, studentId, grade]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

app.delete('/api/teacher/grades', async (req, res) => {
    const { scheduleId, studentId } = req.body;
    try {
        const query = `DELETE FROM examresults WHERE schedule_id = $1 AND student_id = $2`;
        await pool.query(query, [scheduleId, studentId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});

app.get('/api/teacher/archive/:userId', async (req, res) => {
    const { userId } = req.params;
    const { groupId, subjectId } = req.query;

    try {
        let query = `
            SELECT s.last_name, s.first_name, s.middle_name, er.grade, es.exam_dt,
                   g.group_nm, sub.subject_nm
            FROM examresults er, examschedules es, students s, users u, groups g, subjects sub
            WHERE er.schedule_id = es.id 
              AND er.student_id = s.id 
              AND es.teacher_id = u.teacher_id 
              AND es.group_id = g.id
              AND es.subject_id = sub.id
              AND u.id = $1 
        `;

        const params = [userId];
        let paramIndex = 2;

        if (groupId) {
            query += ` AND es.group_id = $${paramIndex}`;
            params.push(groupId);
            paramIndex++;
        }

        if (subjectId) {
            query += ` AND es.subject_id = $${paramIndex}`;
            params.push(subjectId);
            paramIndex++;
        }

        query += ` ORDER BY es.exam_dt DESC, g.group_nm ASC, sub.subject_nm ASC, s.last_name ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка загрузки архива ведомостей:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// --- ЛОГИКА СТУДЕНТА ---

app.get('/api/student/grades/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const query = `
            SELECT "Subject", "Grade", "Date", "Teacher"
            FROM studentexamgrades
            WHERE "UserID" = $1
            ORDER BY "Date" DESC
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка БД (успеваемость):', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// --- РЕЗЕРВНОЕ КОПИРОВАНИЕ ---
app.get('/api/admin/backup', (req, res) => {
    // Получаем метку даты, выбранную пользователем 
    const customDate = req.query.customDate;
    
    // Системное время для уникальности
    const timeStr = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Формируем финальное имя файла
    let fileNameStr = timeStr;
    if (customDate) {
        fileNameStr = `${customDate}_${timeStr}`;
    }
    
    const fileName = `SH_BD_backup_${fileNameStr}.sql`;
    const filePath = path.join(__dirname, fileName);

    // Получаем команду из файла .env (или используем дефолтную pg_dump)
    const pgDumpCommand = process.env.PG_DUMP_CMD || 'pg_dump';

    // Оборачиваем путь к pg_dump в кавычки для корректной работы в Windows
    const command = `"${pgDumpCommand}" -U ${process.env.DB_USER} -h ${process.env.DB_HOST} -p ${process.env.DB_PORT} -F p -f "${filePath}" ${process.env.DB_NAME}`;

    // Передаем пароль через переменную окружения PGPASSWORD для безопасности
    exec(command, { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } }, (error) => {
        if (error) {
            console.error(`Ошибка при создании резервной копии: ${error.message}`);
            return res.status(500).json({ error: 'Ошибка при создании резервной копии на сервере' });
        }
        
        // Отправляем файл клиенту, браузер сам спросит путь для сохранения
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Ошибка при отправке файла:', err);
            }
            // Удаляем временный файл sql с сервера после скачивания
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.error('Ошибка при удалении временного файла:', unlinkErr);
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Сервер работает. Откройте в браузере: http://localhost:${port}`);
});