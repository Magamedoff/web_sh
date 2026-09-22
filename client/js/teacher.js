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
    loadSelectOptions().then(() => {
        fetchTeacherArchive(userId); 
    });

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            targetContent.classList.remove('hidden');
            targetContent.classList.add('active');
        });
    });

    document.getElementById('btnLoadArchive').addEventListener('click', () => {
        fetchTeacherArchive(userId);
    });

    document.getElementById('btnPrintArchive').addEventListener('click', () => {
        printArchive();
    });

    const examModal = document.getElementById('examModal');
    document.getElementById('addExamBtn').addEventListener('click', () => {
        examModal.classList.remove('hidden');
    });
    document.getElementById('closeExamModal').addEventListener('click', () => {
        examModal.classList.add('hidden');
    });

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
            const res = await fetch('/api/teacher/exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                msgDiv.style.color = 'green';
                msgDiv.textContent = 'Успешно!';
                setTimeout(() => { 
                    examModal.classList.add('hidden'); 
                    msgDiv.textContent = '';
                    fetchTeacherSession(userId); 
                }, 1500);
            } else {
                msgDiv.style.color = 'red';
                msgDiv.textContent = data.message;
            }
        } catch (err) {
            msgDiv.style.color = 'red';
            msgDiv.textContent = 'Ошибка сервера';
        }
    });

    // Функция закрытия ведомости и обновления архива
    const closeGradeModalFunc = () => {
        document.getElementById('gradeModal').classList.add('hidden');
        fetchTeacherArchive(userId);
    };

    // Привязываем и к крестику, и к нижней кнопке
    document.getElementById('closeGradeModal').addEventListener('click', closeGradeModalFunc);
    document.getElementById('closeGradeModalBottomBtn').addEventListener('click', closeGradeModalFunc);
});

async function loadSelectOptions() {
    try {
        const [gr, sub] = await Promise.all([
            fetch('/api/admin/groups'), 
            fetch('/api/teacher/subjects')
        ]);
        const groups = await gr.json();
        const subjects = await sub.json();
        
        const gSelect = document.getElementById('examGroup');
        const sSelect = document.getElementById('examSubject');
        const arcGSelect = document.getElementById('archiveGroup');
        const arcSSelect = document.getElementById('archiveSubject');
        
        const defaultOption = '<option value="">-- Все --</option>';
        const defaultOptionReq = '<option value="">-- Выберите --</option>';
        
        gSelect.innerHTML = defaultOptionReq;
        sSelect.innerHTML = defaultOptionReq;
        arcGSelect.innerHTML = defaultOption;
        arcSSelect.innerHTML = defaultOption;

        groups.forEach(g => {
            const opt = `<option value="${g.id}">${g.group_nm}</option>`;
            gSelect.innerHTML += opt;
            arcGSelect.innerHTML += opt;
        });
        
        subjects.forEach(s => {
            const opt = `<option value="${s.id}">${s.subject_nm}</option>`;
            sSelect.innerHTML += opt;
            arcSSelect.innerHTML += opt;
        });
    } catch (err) { console.error(err); }
}

async function fetchTeacherSchedule(userId) {
    try {
        const response = await fetch(`/api/teacher/schedule/${userId}`);
        const data = await response.json();
        const tbody = document.querySelector('#teacherScheduleTable tbody');
        tbody.innerHTML = ''; 

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">У вас нет пар на этой неделе</td></tr>';
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
                <td>${row.Room || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        document.querySelector('#teacherScheduleTable tbody').innerHTML = 
            '<tr><td colspan="5" style="text-align:center; color:red;">Ошибка связи с сервером</td></tr>';
    }
}

async function fetchTeacherSession(userId) {
    try {
        const response = await fetch(`/api/teacher/session/${userId}`);
        const data = await response.json();
        const tbody = document.querySelector('#teacherSessionTable tbody');
        tbody.innerHTML = ''; 

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">У вас нет запланированных экзаменов</td></tr>';
            return;
        }

        data.forEach(row => {
            const dateObj = new Date(row.Date);
            const formattedTime = row.Time ? row.Time.substring(0, 5) : '-';

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'Нажмите, чтобы выставить оценки';
            tr.innerHTML = `
                <td>${dateObj.toLocaleDateString('ru-RU')}</td>
                <td>${formattedTime}</td>
                <td>${row.Group}</td>
                <td>${row.Subject}</td>
                <td>${row.Room || '-'}</td>
            `;
            tr.addEventListener('click', () => openGradeModal(row.id));
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        document.querySelector('#teacherSessionTable tbody').innerHTML = 
            '<tr><td colspan="5" style="text-align:center; color:red;">Ошибка связи с сервером</td></tr>';
    }
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
        
        tbody.innerHTML = '';
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Оценки не найдены</td></tr>';
            return;
        }

        data.forEach(row => {
            const name = `${row.last_name} ${row.first_name} ${row.middle_name || ''}`;
            const dateObj = new Date(row.exam_dt).toLocaleDateString('ru-RU');
            
            tbody.innerHTML += `
                <tr>
                    <td>${dateObj}</td>
                    <td>${row.group_nm}</td>
                    <td>${row.subject_nm}</td>
                    <td>${name.trim()}</td>
                    <td style="font-weight:bold; color: #34495e;">${row.grade}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Ошибка связи с сервером</td></tr>';
    }
}

function printArchive() {
    const printContent = document.getElementById('printArea').innerHTML;
    const groupName = document.getElementById('archiveGroup').options[document.getElementById('archiveGroup').selectedIndex].text;
    const subjectName = document.getElementById('archiveSubject').options[document.getElementById('archiveSubject').selectedIndex].text;

    let titleText = 'Ведомость оценок';
    if (groupName !== '-- Все --') titleText += ` (Группа: ${groupName})`;
    if (subjectName !== '-- Все --') titleText += ` (Предмет: ${subjectName})`;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Печать ведомости</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: Arial, sans-serif; padding: 20px; }');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
    printWindow.document.write('th, td { border: 1px solid #000; padding: 8px; text-align: left; }');
    printWindow.document.write('th { background-color: #f2f2f2; }');
    printWindow.document.write('h2 { text-align: center; }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<h2>${titleText}</h2>`);
    printWindow.document.write(printContent);
    printWindow.document.write('<div style="margin-top: 50px; display: flex; justify-content: space-between;">');
    printWindow.document.write('<span>Подпись преподавателя: _____________________</span>');
    printWindow.document.write(`<span>Дата печати: ${new Date().toLocaleDateString('ru-RU')}</span>`);
    printWindow.document.write('</div>');
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

async function openGradeModal(scheduleId) {
    const modal = document.getElementById('gradeModal');
    const tbody = document.querySelector('#gradeTable tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Загрузка...</td></tr>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`/api/teacher/exam-students/${scheduleId}`);
        const students = await res.json();
        tbody.innerHTML = '';

        if(students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">В группе нет студентов</td></tr>';
            return;
        }

        students.forEach(s => {
            const name = `${s.last_name} ${s.first_name} ${s.middle_name || ''}`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${name}</td>
                <td>
                    <input type="number" min="2" max="5" value="${s.grade}" id="gr_${s.id}" style="width: 80px; padding: 5px;">
                </td>
                <td style="display: flex; gap: 5px;">
                    <button class="btn-primary" style="padding: 5px 15px; font-size: 14px;" onclick="saveGrade(${scheduleId}, ${s.id})">Сохранить</button>
                    <button class="btn-primary" style="padding: 5px 15px; font-size: 14px; background-color: #c41230;" onclick="clearGrade(${scheduleId}, ${s.id})">Очистить</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { 
        console.error(err); 
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Ошибка загрузки списка студентов</td></tr>';
    }
}

async function saveGrade(scheduleId, studentId) {
    const grade = document.getElementById(`gr_${studentId}`).value;
    if (!grade || grade < 2 || grade > 5) { 
        alert('Оценка должна быть числом от 2 до 5'); 
        return; 
    }

    try {
        const res = await fetch('/api/teacher/grades', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ scheduleId, studentId, grade })
        });
        const data = await res.json();
        if(data.success) {
            alert('Оценка успешно сохранена');
        }
    } catch (err) { 
        console.error(err); 
        alert('Ошибка при сохранении оценки');
    }
}

async function clearGrade(scheduleId, studentId) {
    try {
        const res = await fetch('/api/teacher/grades', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ scheduleId, studentId })
        });
        const data = await res.json();
        if(data.success) {
            document.getElementById(`gr_${studentId}`).value = '';
            alert('Оценка очищена');
        }
    } catch (err) { 
        console.error(err); 
        alert('Ошибка при удалении оценки');
    }
}