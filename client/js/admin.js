document.addEventListener('DOMContentLoaded', async () => {
    const role = localStorage.getItem('userRole');
    if (role != 1) { 
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    const formatName = (p) => `${p.last_name} ${p.first_name} ${p.middle_name || ''}`.trim();

    // --- ЛОГИКА ВКЛАДОК ---
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

            if (targetId === 'admin-schedule') {
                loadScheduleFormOptions();
                fetchAdminSchedules();
            }
        });
    });

    // --- УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ---
    const regRole = document.getElementById('regRole');
    const teacherSelectGroup = document.getElementById('teacherSelectGroup');
    const studentSelectGroup = document.getElementById('studentSelectGroup');
    const teacherIdSelect = document.getElementById('teacherId');
    const groupIdSelect = document.getElementById('groupId');
    const studentIdSelect = document.getElementById('studentId');
    const filterRole = document.getElementById('filterRole');
    let allUsers = [];

    try {
        const [teachersRes, groupsRes] = await Promise.all([fetch('/api/admin/teachers'), fetch('/api/admin/groups')]);
        const teachers = await teachersRes.json();
        const groups = await groupsRes.json();

        teacherIdSelect.innerHTML = '<option value="">-- Выберите преподавателя --</option>';
        teachers.forEach(t => {
            const creds = [];
            if (t.short_dg_nm) creds.push(t.short_dg_nm);
            if (t.short_rn_nm) creds.push(t.short_rn_nm);
            teacherIdSelect.innerHTML += `<option value="${t.id}">${formatName(t)} ${creds.length ? `(${creds.join(', ')})` : ''}</option>`;
        });

        groupIdSelect.innerHTML = '<option value="">-- Выберите группу --</option>';
        groups.forEach(g => { groupIdSelect.innerHTML += `<option value="${g.id}">${g.group_nm}</option>`; });
    } catch (err) { console.error(err); }

    regRole.addEventListener('change', () => {
        teacherSelectGroup.style.display = regRole.value == '2' ? 'block' : 'none';
        studentSelectGroup.style.display = regRole.value == '3' ? 'block' : 'none';
    });
    regRole.dispatchEvent(new Event('change'));

    groupIdSelect.addEventListener('change', async () => {
        const groupId = groupIdSelect.value;
        if (!groupId) {
            studentIdSelect.innerHTML = '<option value="">-- Сначала выберите группу --</option>';
            return;
        }
        try {
            const res = await fetch(`/api/admin/students/${groupId}`);
            const students = await res.json();
            studentIdSelect.innerHTML = '<option value="">-- Выберите студента --</option>';
            students.forEach(s => { studentIdSelect.innerHTML += `<option value="${s.id}">${formatName(s)}</option>`; });
        } catch (err) { console.error(err); }
    });

    document.getElementById('adminRegForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgDiv = document.getElementById('regMessage');
        const roleValue = parseInt(regRole.value);
        let personId = null;

        if (roleValue === 2) {
            personId = parseInt(teacherIdSelect.value);
            if (!personId) return msgDiv.textContent = 'Пожалуйста, выберите преподавателя', msgDiv.style.color = 'red';
        } else if (roleValue === 3) {
            personId = parseInt(studentIdSelect.value);
            if (!personId) return msgDiv.textContent = 'Пожалуйста, выберите студента', msgDiv.style.color = 'red';
        }

        const login = document.getElementById('regLogin').value.trim();
        const password = document.getElementById('regPassword').value;
        if (password !== document.getElementById('regPasswordConfirm').value) return msgDiv.textContent = 'Пароли не совпадают!', msgDiv.style.color = 'red';

        try {
            const response = await fetch('/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: roleValue, personId, login, password })
            });
            const data = await response.json();
            msgDiv.style.color = data.success ? 'green' : 'red';
            msgDiv.textContent = data.message || data.error;
            if (data.success) {
                document.getElementById('regLogin').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regPasswordConfirm').value = '';
                loadUsers(); 
            }
        } catch (error) { msgDiv.textContent = 'Сбой сети', msgDiv.style.color = 'red'; }
    });

    async function loadUsers() {
        try {
            const res = await fetch('/api/admin/users');
            allUsers = await res.json();
            renderUsers();
        } catch (err) { document.querySelector('#usersTable tbody').innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Ошибка загрузки</td></tr>'; }
    }

    function renderUsers() {
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        const filterVal = filterRole.value;
        const filteredUsers = filterVal ? allUsers.filter(u => u.role == filterVal) : allUsers;

        if (filteredUsers.length === 0) return tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Пользователи не найдены</td></tr>';

        filteredUsers.forEach(u => {
            const roleName = u.role === 1 ? 'Администратор' : (u.role === 2 ? 'Преподаватель' : 'Студент');
            const personName = u.role === 2 && u.t_last ? `${u.t_last} ${u.t_first} ${u.t_middle || ''}`.trim() : 
                              (u.role === 3 && u.s_last ? `${u.s_last} ${u.s_first} ${u.s_middle || ''}`.trim() : 'Без привязки');
            const isCurrentUser = u.id == localStorage.getItem('userId');
            const deleteBtn = isCurrentUser ? '<span style="color: grey;">(Вы)</span>' : 
                `<button class="btn-primary" style="background-color: #c41230; padding: 5px 15px;" onclick="deleteUser(${u.id})">Удалить</button>`;
            
            tbody.innerHTML += `<tr><td><strong>${u.login}</strong></td><td>${roleName}</td><td>${personName}</td><td style="text-align: center;">${deleteBtn}</td></tr>`;
        });
    }

    window.deleteUser = async function(id) {
        if (!confirm('Удалить пользователя?')) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) loadUsers(); else alert(data.error);
        } catch (err) { alert('Ошибка сервера'); }
    };

    filterRole.addEventListener('change', renderUsers);
    loadUsers();

    // --- УПРАВЛЕНИЕ РАСПИСАНИЕМ ---
    async function loadScheduleFormOptions() {
        if(document.getElementById('schGroup').options.length > 1) return;
        try {
            const [grRes, subRes, tRes] = await Promise.all([fetch('/api/admin/groups'), fetch('/api/teacher/subjects'), fetch('/api/admin/teachers')]);
            const [groups, subjects, teachers] = await Promise.all([grRes.json(), subRes.json(), tRes.json()]);

            document.getElementById('schGroup').innerHTML = '<option value="">-- Выберите группу --</option>' + groups.map(g => `<option value="${g.id}">${g.group_nm}</option>`).join('');
            document.getElementById('schSubject').innerHTML = '<option value="">-- Выберите дисциплину --</option>' + subjects.map(s => `<option value="${s.id}">${s.subject_nm}</option>`).join('');
            document.getElementById('schTeacher').innerHTML = '<option value="">-- Выберите преподавателя --</option>' + teachers.map(t => `<option value="${t.id}">${formatName(t)}</option>`).join('');
        } catch (err) { console.error(err); }
    }

    async function fetchAdminSchedules() {
        try {
            const response = await fetch('/api/admin/schedule-list');
            const data = await response.json();
            const tbody = document.querySelector('#adminScheduleListTable tbody');
            tbody.innerHTML = '';
            
            if(data.length === 0) return tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Занятий не найдено</td></tr>';

            data.forEach(row => {
                const dateStr = new Date(row.lesson_dt).toLocaleDateString('ru-RU');
                const timeStr = row.lesson_tm.substring(0, 5);
                const rawDate = row.lesson_dt.split('T')[0];

                tbody.innerHTML += `
                    <tr>
                        <td>${dateStr}</td><td>${timeStr}</td><td>${row.group_nm}</td>
                        <td>${row.subject_nm}</td><td>${row.last_name} ${row.first_name}</td><td>${row.room}</td>
                        <td style="display:flex; gap:5px; justify-content:center;">
                            <button class="btn-primary" style="padding: 5px 10px; font-size:12px;" onclick="editAdminSch(${row.id}, ${row.group_id}, ${row.subject_id}, ${row.teacher_id}, '${rawDate}', '${timeStr}', '${row.room}')">Изменить</button>
                            <button class="btn-primary" style="background-color: #c41230; padding: 5px 10px; font-size:12px;" onclick="deleteAdminSch(${row.id})">Удалить</button>
                        </td>
                    </tr>
                `;
            });
        } catch (e) { console.error(e); }
    }

    document.getElementById('adminScheduleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgDiv = document.getElementById('schMsg');
        const id = document.getElementById('schId').value;
        const payload = {
            groupId: document.getElementById('schGroup').value,
            subjectId: document.getElementById('schSubject').value,
            teacherId: document.getElementById('schTeacher').value,
            lessonDt: document.getElementById('schDate').value,
            lessonTm: document.getElementById('schTime').value,
            room: document.getElementById('schRoom').value
        };

        try {
            const url = id ? `/api/admin/schedule/${id}` : '/api/admin/schedule';
            const method = id ? 'PUT' : 'POST';
            
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            
            msgDiv.style.color = data.success ? 'green' : 'red';
            msgDiv.textContent = data.message;
            if(data.success) {
                cancelSchEdit();
                fetchAdminSchedules();
                setTimeout(() => { msgDiv.textContent = ''; }, 3000);
            }
        } catch (err) { msgDiv.textContent = 'Ошибка связи', msgDiv.style.color = 'red'; }
    });

    window.editAdminSch = (id, gId, sId, tId, d, t, r) => {
        document.getElementById('schId').value = id;
        document.getElementById('schGroup').value = gId;
        document.getElementById('schSubject').value = sId;
        document.getElementById('schTeacher').value = tId;
        document.getElementById('schDate').value = d;
        document.getElementById('schTime').value = t;
        document.getElementById('schRoom').value = r;
        document.getElementById('schSubmitBtn').textContent = 'Сохранить';
        document.getElementById('schCancelBtn').style.display = 'block';
        document.getElementById('schFormTitle').textContent = 'Редактировать занятие';
        window.scrollTo(0, 0);
    };

    const cancelSchEdit = () => {
        document.getElementById('adminScheduleForm').reset();
        document.getElementById('schId').value = '';
        document.getElementById('schSubmitBtn').textContent = 'Добавить';
        document.getElementById('schCancelBtn').style.display = 'none';
        document.getElementById('schFormTitle').textContent = 'Добавить учебное занятие';
    };

    document.getElementById('schCancelBtn').addEventListener('click', cancelSchEdit);

    window.deleteAdminSch = async (id) => {
        if(!confirm('Удалить это занятие?')) return;
        try {
            await fetch(`/api/admin/schedule/${id}`, { method: 'DELETE' });
            fetchAdminSchedules();
        } catch(e) { alert('Ошибка сети'); }
    };

    // --- БЕКАП ---
    document.getElementById('doBackupBtn').addEventListener('click', async () => {
        const msgDiv = document.getElementById('backupMessage');
        msgDiv.textContent = 'Формирование...'; msgDiv.style.color = '#333';
        try {
            let url = '/api/admin/backup';
            if (document.getElementById('backupDate').value) url += `?customDate=${document.getElementById('backupDate').value}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = 'backup.sql';
            a.click();
            msgDiv.textContent = 'Успешно!'; msgDiv.style.color = 'green';
        } catch (err) { msgDiv.textContent = 'Ошибка', msgDiv.style.color = 'red'; }
    });
});