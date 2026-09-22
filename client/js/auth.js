document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorDiv = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Удаляем случайные пробелы
            const login = document.getElementById('login').value.trim();
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login, password })
                });

                const data = await response.json();

                if (data.success) {
                    // Приводим роль к числу для гарантии срабатывания условий
                    const userRole = parseInt(data.user.role);
                    
                    localStorage.setItem('userRole', userRole);
                    localStorage.setItem('userId', data.user.id);
                    
                    // Перенаправление на основе роли
                    if (userRole === 1) {
                        window.location.href = 'admin.html';
                    } else if (userRole === 2) {
                        window.location.href = 'teacher.html';
                    } else if (userRole === 3) {
                        window.location.href = 'index.html'; 
                    }
                } else {
                    errorDiv.textContent = data.message;
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Ошибка при входе:', error);
                errorDiv.textContent = 'Ошибка связи с сервером';
                errorDiv.style.display = 'block';
            }
        });
    }
});