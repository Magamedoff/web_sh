document.addEventListener('DOMContentLoaded', async () => {
    // Проверка прав 
    const role = localStorage.getItem('userRole');
    if (role != 1) { 
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // --- ЛОГИКА ВКЛАДОК ---
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
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
        });
    });

    const regRole = document.getElementById('regRole');
    const teacherSelectGroup = document.getElementById('teacherSelectGroup');
    const studentSelectGroup = document.getElementById('studentSelectGroup');
    
    const teacherIdSelect = document.getElementById('teacherId');
    const groupIdSelect = document.getElementById('groupId');
    const studentIdSelect = document.getElementById('studentId');
    
    const regForm = document.getElementById('adminRegForm');
    const msgDiv = document.getElementById('regMessage');

    const filterRole = document.getElementById('filterRole');
    let allUsers = [];

    // Функция форматирования ФИО
    const formatName = (p) => `${p.last_name} ${p.first_name} ${p.middle_name || ''}`.trim();

    // Загрузка списков преподавателей и групп при старте
    try {
        const [teachersRes, groupsRes] = await Promise.all([
            fetch('/api/admin/teachers'),
            fetch('/api/admin/groups')
        ]);
        
        const teachers = await teachersRes.json();
        const groups = await groupsRes.json();

        teacherIdSelect.innerHTML = '<option value="">-- Выберите преподавателя --</option>';
        teachers.forEach(t => {
            const fullName = formatName(t);
            const credentials = [];
            if (t.short_dg_nm) credentials.push(t.short_dg_nm);
            if (t.short_rn_nm) credentials.push(t.short_rn_nm);
            const credString = credentials.length > 0 ? ` (${credentials.join(', ')})` : '';
            teacherIdSelect.innerHTML += `<option value="${t.id}">${fullName}${credString}</option>`;
        });

        groups.forEach(g => {
            groupIdSelect.innerHTML += `<option value="${g.id}">${g.group_nm}</option>`;
        });
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
    }

    // Переключение интерфейса между ролями
    regRole.addEventListener('change', () => {
        if (regRole.value == '1') {
            teacherSelectGroup.style.display = 'none';
            studentSelectGroup.style.display = 'none';
        } else if (regRole.value == '2') {
            teacherSelectGroup.style.display = 'block';
            studentSelectGroup.style.display = 'none';
        } else {
            teacherSelectGroup.style.display = 'none';
            studentSelectGroup.style.display = 'block';
        }
    });

    regRole.dispatchEvent(new Event('change'));

    // Загрузка студентов при выборе группы
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
            students.forEach(s => {
                studentIdSelect.innerHTML += `<option value="${s.id}">${formatName(s)}</option>`;
            });
        } catch (err) {
            console.error('Ошибка загрузки студентов:', err);
        }
    });

    // Обработка отправки формы
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const roleValue = parseInt(regRole.value);
        let personId = null;

        if (roleValue === 2) {
            personId = parseInt(teacherIdSelect.value);
            if (!personId) {
                msgDiv.style.color = 'red';
                msgDiv.textContent = 'Пожалуйста, выберите преподавателя';
                return;
            }
        } else if (roleValue === 3) {
            personId = parseInt(studentIdSelect.value);
            if (!personId) {
                msgDiv.style.color = 'red';
                msgDiv.textContent = 'Пожалуйста, выберите студента';
                return;
            }
        } else if (roleValue === 1) {
            personId = null;
        }

        // Очищаем логин от лишних пробелов на клиенте
        const login = document.getElementById('regLogin').value.trim();
        const password = document.getElementById('regPassword').value;
        const passwordConfirm = document.getElementById('regPasswordConfirm').value;

        if (password !== passwordConfirm) {
            msgDiv.style.color = 'red';
            msgDiv.textContent = 'Пароли не совпадают!';
            return;
        }

        try {
            const response = await fetch('/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: roleValue, personId, login, password })
            });

            const data = await response.json();

            if (data.success) {
                msgDiv.style.color = 'green';
                msgDiv.textContent = data.message;
                
                document.getElementById('regLogin').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regPasswordConfirm').value = '';
                
                loadUsers(); // Обновляем список пользователей
            } else {
                msgDiv.style.color = 'red';
                msgDiv.textContent = data.error || 'Ошибка при регистрации';
            }
        } catch (error) {
            console.error('Ошибка запроса:', error);
            msgDiv.style.color = 'red';
            msgDiv.textContent = 'Сбой сети или сервера';
        }
    });

    // ====== ЛОГИКА УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ======

    async function loadUsers() {
        try {
            const res = await fetch('/api/admin/users');
            allUsers = await res.json();
            renderUsers();
        } catch (err) {
            console.error('Ошибка загрузки пользователей:', err);
            document.querySelector('#usersTable tbody').innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Ошибка загрузки</td></tr>';
        }
    }

    function renderUsers() {
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        
        const filterVal = filterRole.value;
        const filteredUsers = filterVal ? allUsers.filter(u => u.role == filterVal) : allUsers;

        if (filteredUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Пользователи не найдены</td></tr>';
            return;
        }

        filteredUsers.forEach(u => {
            let roleName = '';
            if (u.role === 1) roleName = 'Администратор';
            else if (u.role === 2) roleName = 'Преподаватель';
            else if (u.role === 3) roleName = 'Студент';

            let personName = 'Без привязки';
            if (u.role === 2 && u.t_last) {
                personName = `${u.t_last} ${u.t_first} ${u.t_middle || ''}`.trim();
            } else if (u.role === 3 && u.s_last) {
                personName = `${u.s_last} ${u.s_first} ${u.s_middle || ''}`.trim();
            }

            const isCurrentUser = (u.id == localStorage.getItem('userId'));
            const deleteBtnHtml = isCurrentUser 
                ? '<span style="color: grey; font-size: 12px;">(Вы)</span>' 
                : `<button class="btn-primary" style="background-color: #c41230; padding: 5px 15px; font-size: 13px;" onclick="deleteUser(${u.id})">Удалить</button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold;">${u.login}</td>
                <td>${roleName}</td>
                <td>${personName}</td>
                <td style="text-align: center;">${deleteBtnHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.deleteUser = async function(id) {
        if (!confirm('Внимание! Вы уверены, что хотите удалить этого пользователя?')) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadUsers();
            } else {
                alert(data.error || 'Ошибка удаления');
            }
        } catch (err) {
            console.error(err);
            alert('Сбой сети или сервера');
        }
    };

    filterRole.addEventListener('change', renderUsers);
    loadUsers();

    // ====== ЛОГИКА РЕЗЕРВНОГО КОПИРОВАНИЯ ======
    const doBackupBtn = document.getElementById('doBackupBtn');
    if (doBackupBtn) {
        doBackupBtn.addEventListener('click', async () => {
            const dateVal = document.getElementById('backupDate').value;
            const msgDiv = document.getElementById('backupMessage');

            msgDiv.style.color = '#333';
            msgDiv.textContent = 'Формирование резервной копии... Пожалуйста, подождите.';

            try {
                // Добавляем параметр даты к запросу, если он выбран
                let url = '/api/admin/backup';
                if (dateVal) {
                    url += `?customDate=${encodeURIComponent(dateVal)}`;
                }

                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error('Ошибка при генерации файла на сервере');
                }

                // Пытаемся получить имя файла из заголовков ответа
                let filename = 'backup.sql';
                const disposition = response.headers.get('Content-Disposition');
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }

                // Создаем Blob для скачивания файла (вызовет диалог "Сохранить как...")
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);

                msgDiv.style.color = 'green';
                msgDiv.textContent = 'Резервная копия успешно сформирована и скачана!';
                
            } catch (err) {
                console.error(err);
                msgDiv.style.color = 'red';
                msgDiv.textContent = 'Не удалось создать резервную копию.';
            }
        });
    }
});