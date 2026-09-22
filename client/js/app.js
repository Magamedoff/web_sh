document.addEventListener('DOMContentLoaded', () => {
    fetchSchedule();
    fetchSession(); 

    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');
    const headerActions = document.getElementById('headerActions');

    if (role && userId) {
        headerActions.innerHTML = '<button id="logoutBtn" class="btn-primary">Выйти</button>';
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.clear();
            window.location.reload();
        });

        // Динамическое добавление интерфейса успеваемости для студента
        if (role == 3) {
            const tabsContainer = document.querySelector('.tabs-container');
            const gradesBtn = document.createElement('button');
            gradesBtn.className = 'tab-btn';
            gradesBtn.setAttribute('data-target', 'grades');
            gradesBtn.innerText = 'Моя успеваемость';
            tabsContainer.appendChild(gradesBtn);

            const mainContent = document.querySelector('.main-content');
            const gradesContent = document.createElement('div');
            gradesContent.id = 'grades';
            gradesContent.className = 'tab-content hidden';
            gradesContent.innerHTML = `
                <h1>Результаты сессии</h1>
                <table id="gradesTable">
                    <thead>
                        <tr><th>Дата экзамена</th><th>Дисциплина</th><th>Преподаватель</th><th>Оценка</th></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            `;
            mainContent.appendChild(gradesContent);

            gradesBtn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => {
                    c.classList.remove('active');
                    c.classList.add('hidden');
                });
                gradesBtn.classList.add('active');
                gradesContent.classList.remove('hidden');
                gradesContent.classList.add('active');
            });

            fetchStudentGrades(userId);
        }
    }

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
        });
    });
});

async function fetchSchedule() {
    try {
        const response = await fetch('/api/schedule');
        const data = await response.json();
        const tbody = document.querySelector('#scheduleTable tbody');
        tbody.innerHTML = ''; 

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Занятий на эту неделю не найдено</td></tr>';
            return;
        }

        data.forEach(row => {
            const dateObj = new Date(row.Date);
            const formattedTime = row.Time.substring(0, 5);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dateObj.toLocaleDateString('ru-RU')}</td>
                <td>${formattedTime}</td>
                <td>${row.Group}</td>
                <td>${row.Subject}</td>
                <td>${row.Teacher}</td>
                <td>${row.Room || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        document.querySelector('#scheduleTable tbody').innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Ошибка сервера БД</td></tr>';
    }
}

async function fetchSession() {
    try {
        const response = await fetch('/api/session');
        const data = await response.json();
        const tbody = document.querySelector('#sessionTable tbody');
        tbody.innerHTML = ''; 

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Актуальных экзаменов не найдено</td></tr>';
            return;
        }

        data.forEach(row => {
            const dateObj = new Date(row.Date);
            const formattedTime = row.Time ? row.Time.substring(0, 5) : '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dateObj.toLocaleDateString('ru-RU')}</td>
                <td>${formattedTime}</td>
                <td>${row.Group}</td>
                <td>${row.Subject}</td>
                <td>${row.Teacher}</td>
                <td>${row.Room || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        document.querySelector('#sessionTable tbody').innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Ошибка сервера БД</td></tr>';
    }
}

async function fetchStudentGrades(userId) {
    try {
        const response = await fetch(`/api/student/grades/${userId}`);
        const data = await response.json();
        const tbody = document.querySelector('#gradesTable tbody');
        tbody.innerHTML = ''; 

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Нет данных об успеваемости</td></tr>';
            return;
        }

        data.forEach(row => {
            const dateObj = new Date(row.Date);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dateObj.toLocaleDateString('ru-RU')}</td>
                <td>${row.Subject}</td>
                <td>${row.Teacher}</td>
                <td style="font-weight:bold; color: #34495e;">${row.Grade}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        document.querySelector('#gradesTable tbody').innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Ошибка сервера БД</td></tr>';
    }
}