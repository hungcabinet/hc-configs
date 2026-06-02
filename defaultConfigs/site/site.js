function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
}

function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));

    document.cookie =
        `${name}=${value}; expires=${date.toUTCString()}; path=/`;
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';

    applyTheme(newTheme);
    setCookie('theme', newTheme);
}
function formatRelativeTime(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    const units = [
        { name: 'г.', seconds: 31536000 },
        { name: 'мес.', seconds: 2592000 },
        { name: 'д.', seconds: 86400 },
        { name: 'ч.', seconds: 3600 },
        { name: 'мин.', seconds: 60 }
    ];

    for (const unit of units) {
        const value = Math.floor(diff / unit.seconds);

        if (value >= 1) {
            return `${value}${unit.name}`;
        }
    }

    return '0мин.';
}

function updateRelativeDates() {
    const elements = document.querySelectorAll('.updated-at');

    elements.forEach(el => {
        const timestamp = Number(el.dataset.updated);

        if (!timestamp) return;

        el.textContent = formatRelativeTime(timestamp);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = getCookie('theme') || 'dark';

    applyTheme(savedTheme);

    document.querySelectorAll('.copy-link').forEach(el => el.addEventListener('click', async function() {
        const link = this.dataset.link;

        await navigator.clipboard.writeText(link);

        alert('Ссылка скопирована');
    }));

    document.querySelectorAll('.copy-content').forEach(el => el.addEventListener('click', async function() {
        const link = this.dataset.link;

        try {
            const response = await fetch(link);
            const text = await response.text();

            await navigator.clipboard.writeText(text);

            alert('Содержимое скопировано');
        } catch (err) {
            alert('Ошибка копирования');
        }
    }));

    updateRelativeDates();

    setInterval(updateRelativeDates, 60 * 1000);
});