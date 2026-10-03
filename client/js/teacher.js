document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    if (role != 2 || !userId) { 
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    fetchTeacherSchedule(userId);
    fetchTeacherSession(userId);
    loadSelectOptions().then(() => fetchTeacherArchive(userId));

    // --- Исправленная логика переключения вкладок ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Убираем активность со всех кнопок
            tabBtns.forEach(b => b.classList.remove('active'));
            // Скрываем все вкладки
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });
            
            // Делаем активной нажатую кнопку и соответствующую вкладку
            btn.classList.add('active');
            const targetContent = document.getElementById(btn.getAttribute('data-target'));
            targetContent.classList.remove('hidden');
            targetContent.classList.add('active');
        });
    });

    // --- Управление занятиями (Classes) ---
    const classModal = document.getElementById('classModal');
    
    document.getElementById('addClassBtn').addEventListener('click', () => {
        document.getElementById('addClassForm').reset();
        document.getElementById('classId').value = '';
        document.getElementById('classModalTitle').textContent = 'Назначить занятие';
        document.getElementById('classSubmitBtn').textContent = 'Добавить';
        classModal.classList.remove('hidden');
    });

    document.getElementById('closeClassModal').addEventListener('click', () => classModal.classList.add('hidden'));

    document.getElementById('addClassForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgDiv = document.getElementById('classMsg');
        const id = document.getElementById('classId').value;
        const payload = {
            groupId: document.getElementById('classGroup').value,
            subjectId: document.getElementById('classSubject').value,
            lessonDt: document.getElementById('classDate').value,
            lessonTm: document.getElementById('classTime').value,
            room: document.getElementById('classRoom').value,
            userId: userId
        };

        try {
            const url = id ? `/api/teacher/classes/${id}` : '/api/teacher/classes';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            
            msgDiv.style.color = data.success ? 'green' : 'red';
            msgDiv.textContent = data.message;
            if (data.success) {
                setTimeout(() => { classModal.classList.add('hidden'); msgDiv.textContent = ''; fetchTeacherSchedule(userId); }, 1500);
            }
        } catch (err) { msgDiv.style.color = 'red'; msgDiv.textContent = 'Ошибка сервера'; }
    });

    window.editClass = (id, gId, sId, dateRaw, timeRaw, room) => {
        document.getElementById('classId').value = id;
        document.getElementById('classGroup').value = gId;
        document.getElementById('classSubject').value = sId;
        document.getElementById('classDate').value = dateRaw;
        document.getElementById('classTime').value = timeRaw;
        document.getElementById('classRoom').value = room;
        document.getElementById('classModalTitle').textContent = 'Редактировать занятие';
        document.getElementById('classSubmitBtn').textContent = 'Сохранить';
        classModal.classList.remove('hidden');
    };

    window.deleteClass = async (id) => {
        if (!confirm('Удалить занятие?')) return;
        try {
            const res = await fetch(`/api/teacher/classes/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: localStorage.getItem('userId') })
            });
            const data = await res.json();
            if (data.success) fetchTeacherSchedule(localStorage.getItem('userId'));
            else alert('Ошибка удаления');
        } catch (e) { alert('Ошибка сети'); }
    };

    // --- Управление экзаменами ---
    const examModal = document.getElementById('examModal');
    document.getElementById('addExamBtn').addEventListener('click', () => examModal.classList.remove('hidden'));
    document.getElementById('closeExamModal').addEventListener('click', () => examModal.classList.add('hidden'));

    document.getElementById('addExamForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgDiv = document.getElementById('examMsg');
        const payload = {
            groupId: document.getElementById('examGroup').value,
            subjectId: document.getElementById('examSubject').value,
            examDt: document.getElementById('examDate').value,
            examTm: document.getElementById('examTime').value,
            room: document.getElementById('examRoom').value,
            userId: userId
        };

        try {
            const res = await fetch('/api/teacher/exams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            msgDiv.style.color = data.success ? 'green' : 'red';
            msgDiv.textContent = data.message;
            if (data.success) {
                setTimeout(() => { examModal.classList.add('hidden'); msgDiv.textContent = ''; fetchTeacherSession(userId); }, 1500);
            }
        } catch (err) { msgDiv.style.color = 'red'; msgDiv.textContent = 'Ошибка сервера'; }
    });

    // --- Архив и ведомости ---
    const closeGradeModalFunc = () => { document.getElementById('gradeModal').classList.add('hidden'); fetchTeacherArchive(userId); };
    document.getElementById('closeGradeModal').addEventListener('click', closeGradeModalFunc);
    document.getElementById('closeGradeModalBottomBtn').addEventListener('click', closeGradeModalFunc);
    document.getElementById('btnLoadArchive').addEventListener('click', () => fetchTeacherArchive(userId));
    document.getElementById('btnPrintArchive').addEventListener('click', printArchive);
});

async function loadSelectOptions() {
    try {
        const [gr, sub] = await Promise.all([fetch('/api/admin/groups'), fetch('/api/teacher/subjects')]);
        const [groups, subjects] = await Promise.all([gr.json(), sub.json()]);
        
        const grpHTML = groups.map(g => `<option value="${g.id}">${g.group_nm}</option>`).join('');
        const subHTML = subjects.map(s => `<option value="${s.id}">${s.subject_nm}</option>`).join('');
        
        ['examGroup', 'classGroup'].forEach(id => document.getElementById(id).innerHTML = '<option value="">-- Выберите --</option>' + grpHTML);
        ['examSubject', 'classSubject'].forEach(id => document.getElementById(id).innerHTML = '<option value="">-- Выберите --</option>' + subHTML);
        
        document.getElementById('archiveGroup').innerHTML = '<option value="">-- Все --</option>' + grpHTML;
        document.getElementById('archiveSubject').innerHTML = '<option value="">-- Все --</option>' + subHTML;
    } catch (err) { console.error(err); }
}

async function fetchTeacherSchedule(userId) {
    try {
        const response = await fetch(`/api/teacher/schedule/${userId}`);
        const data = await response.json();
        const tbody = document.querySelector('#teacherScheduleTable tbody');
        tbody.innerHTML = ''; 

        if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">У вас нет пар</td></tr>';

        data.forEach(row => {
            const dateStr = new Date(row.DateRaw).toLocaleDateString('ru-RU');
            const timeStr = row.TimeRaw.substring(0, 5);
            const pureDateRaw = row.DateRaw.split('T')[0];

            tbody.innerHTML += `
                <tr>
                    <td>${dateStr}</td><td>${timeStr}</td><td>${row.Group}</td><td>${row.Subject}</td><td>${row.Room || '-'}</td>
                    <td style="display:flex; justify-content:center; gap:5px;">
                        <button class="btn-primary" style="padding: 5px 10px; font-size:12px;" onclick="editClass(${row.id}, ${row.group_id}, ${row.subject_id}, '${pureDateRaw}', '${timeStr}', '${row.Room}')">Изменить</button>
                        <button class="btn-primary" style="background-color: #c41230; padding: 5px 10px; font-size:12px;" onclick="deleteClass(${row.id})">Удалить</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) { document.querySelector('#teacherScheduleTable tbody').innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Ошибка сервера</td></tr>'; }
}

async function fetchTeacherSession(userId) {
    try {
        const response = await fetch(`/api/teacher/session/${userId}`);
        const data = await response.json();
        const tbody = document.querySelector('#teacherSessionTable tbody');
        tbody.innerHTML = ''; 

        if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">У вас нет запланированных экзаменов</td></tr>';

        data.forEach(row => {
            const dateStr = new Date(row.Date).toLocaleDateString('ru-RU');
            const timeStr = row.Time ? row.Time.substring(0, 5) : '-';
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'Нажмите, чтобы выставить оценки';
            tr.innerHTML = `<td>${dateStr}</td><td>${timeStr}</td><td>${row.Group}</td><td>${row.Subject}</td><td>${row.Room || '-'}</td>`;
            tr.addEventListener('click', () => openGradeModal(row.id));
            tbody.appendChild(tr);
        });
    } catch (error) { document.querySelector('#teacherSessionTable tbody').innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Ошибка сервера</td></tr>'; }
}

async function fetchTeacherArchive(userId) {
    const groupId = document.getElementById('archiveGroup').value;
    const subjectId = document.getElementById('archiveSubject').value;
    const tbody = document.querySelector('#archiveTable tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Загрузка...</td></tr>';

    try {
        let url = `/api/teacher/archive/${userId}?`;
        if (groupId) url += `groupId=${groupId}&`;
        if (subjectId) url += `subjectId=${subjectId}`;

        const res = await fetch(url);
        const data = await res.json();
        
        if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Оценки не найдены</td></tr>';

        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${new Date(row.exam_dt).toLocaleDateString('ru-RU')}</td>
                <td>${row.group_nm}</td><td>${row.subject_nm}</td>
                <td>${`${row.last_name} ${row.first_name}${row.middle_name || ''}`.trim()}</td>
                <td style="font-weight:bold; color: #34495e;">${row.grade}</td>
            </tr>
        `).join('');
    } catch (err) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Ошибка сервера</td></tr>'; }
}

function printArchive() {
    const printContent = document.getElementById('printArea').innerHTML;
    const groupName = document.getElementById('archiveGroup').options[document.getElementById('archiveGroup').selectedIndex].text;
    const subjectName = document.getElementById('archiveSubject').options[document.getElementById('archiveSubject').selectedIndex].text;

    let titleText = 'Ведомость оценок';
    if (groupName !== '-- Все --') titleText += ` (Группа: ${groupName})`;
    if (subjectName !== '-- Все --') titleText += ` (Предмет: ${subjectName})`;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
        <html><head><title>Печать ведомости</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h2 { text-align: center; }
        </style>
        </head><body>
        <h2>${titleText}</h2>
        ${printContent}
        <div style="margin-top: 50px; display: flex; justify-content: space-between;">
            <span>Подпись преподавателя: _____________________</span>
            <span>Дата печати: ${new Date().toLocaleDateString('ru-RU')}</span>
        </div>
        </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
}

async function openGradeModal(scheduleId) {
    const modal = document.getElementById('gradeModal');
    const tbody = document.querySelector('#gradeTable tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Загрузка...</td></tr>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`/api/teacher/exam-students/${scheduleId}`);
        const students = await res.json();
        
        if(students.length === 0) return tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">В группе нет студентов</td></tr>';

        tbody.innerHTML = students.map(s => `
            <tr>
                <td>${`${s.last_name} ${s.first_name}${s.middle_name || ''}`.trim()}</td>
                <td><input type="number" min="2" max="5" value="${s.grade}" id="gr_${s.id}" style="width: 80px; padding: 5px;"></td>
                <td style="display: flex; gap: 5px;">
                    <button class="btn-primary" style="padding: 5px 15px; font-size: 14px;" onclick="saveGrade(${scheduleId}, ${s.id})">Сохранить</button>
                    <button class="btn-primary" style="padding: 5px 15px; font-size: 14px; background-color: #c41230;" onclick="clearGrade(${scheduleId}, ${s.id})">Очистить</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Ошибка</td></tr>'; }
}

async function saveGrade(scheduleId, studentId) {
    const grade = document.getElementById(`gr_${studentId}`).value;
    if (!grade || grade < 2 || grade > 5) return alert('Оценка должна быть числом от 2 до 5'); 

    try {
        const res = await fetch('/api/teacher/grades', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ scheduleId, studentId, grade }) });
        if((await res.json()).success) alert('Оценка успешно сохранена');
    } catch (err) { alert('Ошибка при сохранении оценки'); }
}

async function clearGrade(scheduleId, studentId) {
    try {
        const res = await fetch('/api/teacher/grades', { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ scheduleId, studentId }) });
        if((await res.json()).success) { document.getElementById(`gr_${studentId}`).value = ''; alert('Оценка очищена'); }
    } catch (err) { alert('Ошибка при удалении оценки'); }
}