(function() {
    'use strict';

    const STORAGE_KEY = 'mmy_tasktime_data';

    const QUICK_TASKS = [
        { id: 'q5', time: 5, name: '外包跟进反馈', loop: false, color: '#007AFF', type: 'normal' },
        { id: 'q10', time: 10, name: 'Agent跟进', loop: true, color: '#FF9500', type: 'loop' },
        { id: 'q30', time: 30, name: '主任务跟进', loop: false, color: '#007AFF', type: 'normal' },
        { id: 'q40', time: 40, name: '间隔喝水', loop: true, color: '#34C759', type: 'water' }
    ];

    const DEFAULT_SETTINGS = {
        clockReminder: true,
        startTime: '09:30',
        endTime: '19:30',
        soundEnabled: true,
        notificationEnabled: true
    };

    let data = {
        customTasks: [],
        settings: { ...DEFAULT_SETTINGS },
        stats: {}
    };

    let tasks = {};
    let isMini = false;
    let dragState = { dragging: false, ox: 0, oy: 0 };
    let clockReminderFired = { date: '', type: '' };
    let audioCtx = null;

    function init() {
        load();
        initTasks();
        bindEvents();
        initNotification();
        updateClock();
        renderAll();
        setInterval(updateClock, 1000);
        setInterval(tick, 1000);
        setInterval(checkClockReminder, 60000);
        checkClockReminder();
    }

    function load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                data.customTasks = parsed.customTasks || [];
                data.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
                data.stats = parsed.stats || {};
            }
        } catch (e) {
            console.error('Load error:', e);
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Save error:', e);
        }
    }

    function initTasks() {
        tasks = {};
        QUICK_TASKS.forEach(t => {
            tasks[t.id] = {
                ...t,
                remaining: 0,
                total: t.time * 60,
                running: false,
                isPrimary: false
            };
        });
        data.customTasks.forEach(t => {
            tasks[t.id] = {
                id: t.id,
                name: t.name,
                time: t.duration,
                loop: t.isLoop,
                color: t.isLoop ? '#FF9500' : '#007AFF',
                type: t.isLoop ? 'loop' : 'normal',
                isCustom: true,
                remaining: 0,
                total: t.duration * 60,
                running: false,
                isPrimary: false
            };
        });
    }

    function initNotification() {
        if (data.settings.notificationEnabled && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }

    function playDing() {
        if (!data.settings.soundEnabled) return;
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtx;
            const playTone = (freq, startTime, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.3, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };
            const now = ctx.currentTime;
            playTone(880, now, 0.3);
            playTone(1100, now + 0.15, 0.4);
        } catch (e) {
            console.error('Sound error:', e);
        }
    }

    function showNotification(title, body) {
        if (!data.settings.notificationEnabled) return;
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>' });
        }
    }

    function checkClockReminder() {
        if (!data.settings.clockReminder) return;
        const now = new Date();
        const dateStr = formatDate(now);
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        if (timeStr === data.settings.startTime && clockReminderFired.date !== dateStr + '-start') {
            clockReminderFired = { date: dateStr + '-start', type: 'start' };
            playDing();
            showNotification('上班打卡提醒', '现在是上班时间 ' + data.settings.startTime + '，开始专注工作吧！');
        }
        if (timeStr === data.settings.endTime && clockReminderFired.date !== dateStr + '-end') {
            clockReminderFired = { date: dateStr + '-end', type: 'end' };
            playDing();
            showNotification('下班打卡提醒', '现在是下班时间 ' + data.settings.endTime + '，辛苦了！');
        }
    }

    function formatDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function getAllTasks() {
        return Object.values(tasks);
    }

    function getPrimaryTask() {
        return getAllTasks().find(t => t.isPrimary && t.running);
    }

    function setPrimary(id) {
        Object.keys(tasks).forEach(k => tasks[k].isPrimary = false);
        if (tasks[id] && tasks[id].running) {
            tasks[id].isPrimary = true;
        }
        renderAll();
    }

    function toggleTask(id) {
        const t = tasks[id];
        if (!t) return;

        if (t.running) {
            if (t.isPrimary) {
                stopTask(id);
            } else {
                setPrimary(id);
            }
        } else {
            startTask(id);
        }
    }

    function startTask(id) {
        const t = tasks[id];
        if (!t) return;
        t.running = true;
        t.remaining = t.total;
        const hasPrimary = getAllTasks().some(x => x.isPrimary && x.running);
        t.isPrimary = !hasPrimary;
        renderAll();
    }

    function stopTask(id) {
        const t = tasks[id];
        if (!t) return;
        const wasPrimary = t.isPrimary;
        t.running = false;
        t.remaining = 0;
        t.isPrimary = false;
        if (wasPrimary) {
            const next = getAllTasks().find(x => x.running);
            if (next) next.isPrimary = true;
        }
        renderAll();
    }

    function recordTaskCompletion(task) {
        if (task.loop) return;
        const today = formatDate(new Date());
        if (!data.stats[today]) data.stats[today] = {};
        if (!data.stats[today][task.name]) {
            data.stats[today][task.name] = { count: 0, totalSeconds: 0 };
        }
        data.stats[today][task.name].count++;
        data.stats[today][task.name].totalSeconds += task.total;
        save();
    }

    function tick() {
        let needNotify = null;
        getAllTasks().forEach(t => {
            if (!t.running) return;
            t.remaining--;
            if (t.remaining <= 0) {
                if (t.loop) {
                    t.remaining = t.total;
                    needNotify = t;
                } else {
                    t.running = false;
                    t.remaining = 0;
                    recordTaskCompletion(t);
                    needNotify = t;
                    if (t.isPrimary) {
                        t.isPrimary = false;
                        const next = getAllTasks().find(x => x.running);
                        if (next) next.isPrimary = true;
                    }
                }
            }
        });
        if (needNotify) {
            playDing();
            showNotification('任务完成', needNotify.name + ' 时间到！');
        }
        renderPrimary();
        renderQuickGrid();
        renderRunningBar();
    }

    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('clock').textContent = h + ':' + m + ':' + s;
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m + ':' + String(s).padStart(2, '0');
    }

    function getTaskTypeClass(task) {
        if (task.type === 'loop') return 'loop';
        if (task.type === 'water') return 'water';
        return '';
    }

    function renderAll() {
        renderQuickGrid();
        renderTaskList();
        renderRunningBar();
        renderPrimary();
        updateIdleClass();
    }

    function updateIdleClass() {
        const app = document.getElementById('app');
        const hasRunning = getAllTasks().some(t => t.running);
        if (isMini) {
            app.classList.toggle('idle', !hasRunning);
        } else {
            app.classList.remove('idle');
        }
    }

    function renderQuickGrid() {
        const grid = document.getElementById('quickGrid');
        const runningTasks = getAllTasks().filter(t => t.running);
        const bgRunningCount = runningTasks.filter(t => !t.isPrimary).length;

        const quickIds = QUICK_TASKS.map(t => t.id);

        if (isMini) {
            grid.innerHTML = QUICK_TASKS.map(t => {
                const task = tasks[t.id];
                let pct = task.running ? ((task.total - task.remaining) / task.total) * 100 : 0;
                const circ = 2 * Math.PI * 15;
                const dash = circ * (pct / 100);
                const typeClass = getTaskTypeClass(t);
                const multiDot = (bgRunningCount > 0 && task.running && !task.isPrimary) ? '<div class="multi-dot"></div>' : '';
                const ring = task.running ? `
                    <div class="qb-ring">
                        <svg viewBox="0 0 36 36">
                            <circle class="ring-bg" cx="18" cy="18" r="15"/>
                            <circle class="ring-fg" cx="18" cy="18" r="15"
                                stroke-dasharray="${dash} ${circ}"
                                style="stroke:${t.color}"/>
                        </svg>
                    </div>` : '';
                const cls = ['quick-btn'];
                if (task.running) cls.push('running');
                if (typeClass) cls.push(typeClass);
                if (task.isPrimary) cls.push('primary-active');
                return `<button class="${cls.join(' ')}" data-id="${t.id}">
                    ${ring}
                    ${multiDot}
                    <span class="qb-time">${t.time}</span>
                </button>`;
            }).join('');
        } else {
            grid.innerHTML = QUICK_TASKS.map(t => {
                const task = tasks[t.id];
                let pct = task.running ? ((task.total - task.remaining) / task.total) * 100 : 0;
                const circ = 2 * Math.PI * 8;
                const dash = circ * (pct / 100);
                const typeClass = getTaskTypeClass(t);
                const ring = task.running ? `
                    <div class="qb-ring">
                        <svg viewBox="0 0 20 20">
                            <circle class="ring-bg" cx="10" cy="10" r="8"/>
                            <circle class="ring-fg" cx="10" cy="10" r="8"
                                stroke-dasharray="${dash} ${circ}"
                                style="stroke:${t.color}"/>
                        </svg>
                    </div>` : '';
                const cls = ['quick-btn'];
                if (task.running) cls.push('running');
                if (typeClass) cls.push(typeClass);
                if (task.isPrimary) cls.push('primary-active');
                return `<button class="${cls.join(' ')}" data-id="${t.id}">
                    ${ring}
                    <div class="qb-time">${t.time}分</div>
                    <div class="qb-label">${t.name}</div>
                </button>`;
            }).join('');
        }

        grid.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleTask(btn.dataset.id));
        });
    }

    function renderRunningBar() {
        const bar = document.getElementById('runningBar');
        if (isMini) {
            bar.style.display = 'none';
            return;
        }
        const running = getAllTasks().filter(t => t.running);
        if (running.length <= 1) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        bar.innerHTML = running.map(t => {
            const typeClass = getTaskTypeClass(t);
            const cls = ['running-chip'];
            if (typeClass) cls.push(typeClass);
            if (t.isPrimary) cls.push('primary');
            return `<div class="${cls.join(' ')}" data-id="${t.id}" style="cursor:pointer">
                <span class="chip-dot"></span>${t.name} · ${formatTime(t.remaining)}
            </div>`;
        }).join('');
        bar.querySelectorAll('.running-chip').forEach(chip => {
            chip.addEventListener('click', () => setPrimary(chip.dataset.id));
        });
    }

    function renderPrimary() {
        const primary = getPrimaryTask();
        const card = document.getElementById('primaryCard');
        const nameEl = document.getElementById('primaryName');
        const timerEl = document.getElementById('primaryTimer');
        const fill = document.getElementById('progressFill');

        card.classList.remove('loop', 'water');

        if (!primary) {
            card.className = 'primary-card idle';
            nameEl.textContent = 'MMY-TaskTime';
            timerEl.textContent = isMini ? '选择任务' : '点击下方任务开始';
            fill.style.width = '0%';
            return;
        }

        const typeClass = getTaskTypeClass(primary);
        card.className = 'primary-card' + (typeClass ? ' ' + typeClass : '');
        nameEl.textContent = primary.name;
        timerEl.textContent = formatTime(primary.remaining);
        const pct = ((primary.total - primary.remaining) / primary.total) * 100;
        fill.style.width = pct + '%';
        fill.style.background = primary.color;
    }

    function renderTaskList() {
        const list = document.getElementById('taskList');
        const customTasks = data.customTasks;

        list.innerHTML = customTasks.map(t => {
            const task = tasks[t.id];
            const typeClass = t.isLoop ? 'loop' : '';
            const runningCls = task && task.running ? 'running' : '';
            return `
                <div class="task-item">
                    <button class="task-start ${runningCls} ${typeClass}" data-cid="${t.id}">${task && task.running ? '⏸' : '▶'}</button>
                    <div class="task-info">
                        <div class="task-name">${t.name}${t.isLoop ? ' 🔄' : ''}</div>
                        <div class="task-duration">${t.duration}分钟</div>
                    </div>
                    <button class="task-delete" data-del="${t.id}">×</button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.task-start').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleTask(btn.dataset.cid);
            });
        });

        list.querySelectorAll('.task-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCustomTask(btn.dataset.del);
            });
        });
    }

    function showAddForm() {
        document.getElementById('addTaskForm').style.display = 'block';
        document.getElementById('taskNameInput').value = '';
        document.getElementById('taskDurationInput').value = '15';
        document.getElementById('taskLoopCheck').checked = false;
        document.getElementById('taskNameInput').focus();
    }

    function hideAddForm() {
        document.getElementById('addTaskForm').style.display = 'none';
    }

    function addCustomTask() {
        const name = document.getElementById('taskNameInput').value.trim();
        const duration = parseInt(document.getElementById('taskDurationInput').value) || 15;
        const isLoop = document.getElementById('taskLoopCheck').checked;

        if (!name) {
            alert('请输入任务名称');
            return;
        }
        if (duration < 1 || duration > 180) {
            alert('时长请设置1-180分钟');
            return;
        }

        const id = 'c_' + Date.now();
        data.customTasks.push({ id, name, duration, isLoop });
        save();
        initTasks();
        hideAddForm();
        renderAll();
    }

    function deleteCustomTask(id) {
        if (tasks[id] && tasks[id].running) {
            stopTask(id);
        }
        data.customTasks = data.customTasks.filter(t => t.id !== id);
        delete tasks[id];
        save();
        renderAll();
    }

    function getTodayStats() {
        const today = formatDate(new Date());
        const dayStats = data.stats[today] || {};
        let totalSeconds = 0;
        let totalCount = 0;
        Object.values(dayStats).forEach(s => {
            totalSeconds += s.totalSeconds;
            totalCount += s.count;
        });
        return { totalSeconds, totalCount, details: dayStats };
    }

    function getWeekStats() {
        let totalSeconds = 0;
        const now = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = formatDate(d);
            const dayStats = data.stats[dateStr] || {};
            Object.values(dayStats).forEach(s => {
                totalSeconds += s.totalSeconds;
            });
        }
        return totalSeconds;
    }

    function formatDuration(seconds) {
        if (seconds < 60) return seconds + '秒';
        const m = Math.floor(seconds / 60);
        if (m < 60) return m + '分';
        const h = Math.floor(m / 60);
        const rm = m % 60;
        return h + '时' + (rm > 0 ? rm + '分' : '');
    }

    function renderStats() {
        const today = getTodayStats();
        const weekSec = getWeekStats();

        document.getElementById('todayDuration').textContent = formatDuration(today.totalSeconds);
        document.getElementById('todayCount').textContent = today.totalCount;
        document.getElementById('weekDuration').textContent = formatDuration(weekSec);

        const list = document.getElementById('statsList');
        const entries = Object.entries(today.details);
        if (entries.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#999;font-size:12px;padding:20px;">今日暂无记录</div>';
        } else {
            list.innerHTML = entries.map(([name, s]) => `
                <div class="stats-item">
                    <span class="stats-item-name">${name}</span>
                    <span class="stats-item-info">${s.count}次 · ${formatDuration(s.totalSeconds)}</span>
                </div>
            `).join('');
        }
    }

    function openModal(id) {
        document.getElementById(id).style.display = 'flex';
        if (id === 'settingsModal') {
            loadSettingsToForm();
        } else if (id === 'statsModal') {
            renderStats();
        }
    }

    function closeModal(id) {
        document.getElementById(id).style.display = 'none';
    }

    function loadSettingsToForm() {
        document.getElementById('clockReminderToggle').checked = data.settings.clockReminder;
        document.getElementById('startTimeInput').value = data.settings.startTime;
        document.getElementById('endTimeInput').value = data.settings.endTime;
        document.getElementById('soundToggle').checked = data.settings.soundEnabled;
        document.getElementById('notificationToggle').checked = data.settings.notificationEnabled;
    }

    function updateSettings() {
        data.settings.clockReminder = document.getElementById('clockReminderToggle').checked;
        data.settings.startTime = document.getElementById('startTimeInput').value;
        data.settings.endTime = document.getElementById('endTimeInput').value;
        data.settings.soundEnabled = document.getElementById('soundToggle').checked;
        data.settings.notificationEnabled = document.getElementById('notificationToggle').checked;
        save();
        if (data.settings.notificationEnabled) {
            initNotification();
        }
    }

    function exportHTML() {
        const today = formatDate(new Date());
        const todayStats = getTodayStats();
        const weekSec = getWeekStats();

        let allHistory = '';
        const dates = Object.keys(data.stats).sort().reverse();
        dates.forEach(date => {
            const dayData = data.stats[date];
            let rows = '';
            Object.entries(dayData).forEach(([name, s]) => {
                rows += `<tr><td>${name}</td><td>${s.count}次</td><td>${formatDuration(s.totalSeconds)}</td></tr>`;
            });
            allHistory += `
                <div class="history-day">
                    <h4>${date}</h4>
                    <table>
                        <thead><tr><th>任务</th><th>完成次数</th><th>总时长</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        });

        let todayRows = '';
        Object.entries(todayStats.details).forEach(([name, s]) => {
            todayRows += `<tr><td>${name}</td><td>${s.count}次</td><td>${formatDuration(s.totalSeconds)}</td></tr>`;
        });
        if (!todayRows) {
            todayRows = '<tr><td colspan="3" style="text-align:center;color:#999;">暂无记录</td></tr>';
        }

        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>MMY-TaskTime 统计报告 - ${today}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f7; padding: 40px 20px; color: #1a1a1a; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
        .subtitle { color: #999; font-size: 14px; margin-bottom: 24px; }
        .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
        .card { background: #f8f9fa; border-radius: 12px; padding: 16px; text-align: center; }
        .card-value { font-size: 22px; font-weight: 600; color: #007AFF; margin-bottom: 4px; }
        .card-label { font-size: 12px; color: #999; }
        h2 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; color: #333; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
        th { color: #999; font-weight: 500; background: #fafafa; }
        .history-day { margin-top: 16px; }
        .history-day h4 { font-size: 13px; color: #666; margin-bottom: 8px; }
        .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #ccc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>MMY-TaskTime 统计报告</h1>
        <div class="subtitle">导出时间：${new Date().toLocaleString('zh-CN')}</div>
        <div class="cards">
            <div class="card">
                <div class="card-value">${formatDuration(todayStats.totalSeconds)}</div>
                <div class="card-label">今日时长</div>
            </div>
            <div class="card">
                <div class="card-value">${todayStats.totalCount}</div>
                <div class="card-label">今日完成</div>
            </div>
            <div class="card">
                <div class="card-value">${formatDuration(weekSec)}</div>
                <div class="card-label">本周时长</div>
            </div>
        </div>
        <h2>今日明细</h2>
        <table>
            <thead><tr><th>任务</th><th>完成次数</th><th>总时长</th></tr></thead>
            <tbody>${todayRows}</tbody>
        </table>
        <h2>历史记录</h2>
        ${allHistory || '<div style="color:#999;font-size:13px;">暂无历史记录</div>'}
        <div class="footer">Generated by MMY-TaskTime v2.0</div>
    </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'MMY-TaskTime-统计-' + today + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function toggleMode() {
        isMini = !isMini;
        const app = document.getElementById('app');
        const toggle = document.getElementById('modeToggle');
        app.classList.toggle('full-mode', !isMini);
        app.classList.toggle('mini-mode', isMini);
        toggle.textContent = isMini ? '↗' : '↙';
        toggle.title = isMini ? '展开完整模式' : '切换精简模式';

        if (isMini) {
            app.style.top = '28px';
            app.style.left = 'auto';
            app.style.right = '28px';
            app.style.transform = 'none';
        } else {
            app.style.top = '50%';
            app.style.left = '50%';
            app.style.right = 'auto';
            app.style.transform = 'translate(-50%, -50%)';
        }
        hideAddForm();
        renderAll();
    }

    function bindEvents() {
        document.getElementById('modeToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMode();
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            const primary = getPrimaryTask();
            if (primary) toggleTask(primary.id);
        });

        document.getElementById('addTaskBtn').addEventListener('click', showAddForm);
        document.getElementById('cancelAddBtn').addEventListener('click', hideAddForm);
        document.getElementById('confirmAddBtn').addEventListener('click', addCustomTask);

        document.getElementById('taskNameInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addCustomTask();
            if (e.key === 'Escape') hideAddForm();
        });
        document.getElementById('taskDurationInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addCustomTask();
        });

        document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
        document.getElementById('statsBtn').addEventListener('click', () => openModal('statsModal'));
        document.getElementById('exportBtn').addEventListener('click', exportHTML);

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.dataset.modal));
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                }
            });
        });

        ['clockReminderToggle', 'startTimeInput', 'endTimeInput', 'soundToggle', 'notificationToggle'].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('change', updateSettings);
            if (el.tagName === 'INPUT' && el.type === 'time') {
                el.addEventListener('input', updateSettings);
            }
        });

        const dh = document.getElementById('dragHandle');
        const app = document.getElementById('app');

        dh.addEventListener('mousedown', (e) => {
            if (e.target.closest('.mode-toggle')) return;
            dragState.dragging = true;
            const r = app.getBoundingClientRect();
            dragState.ox = e.clientX - r.left;
            dragState.oy = e.clientY - r.top;
            app.style.left = r.left + 'px';
            app.style.top = r.top + 'px';
            app.style.right = 'auto';
            if (!isMini) app.style.transform = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragState.dragging) return;
            let nl = e.clientX - dragState.ox;
            let nt = e.clientY - dragState.oy;
            nl = Math.max(0, Math.min(nl, window.innerWidth - app.offsetWidth));
            nt = Math.max(0, Math.min(nt, window.innerHeight - app.offsetHeight));
            app.style.left = nl + 'px';
            app.style.top = nt + 'px';
        });

        document.addEventListener('mouseup', () => {
            dragState.dragging = false;
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal('settingsModal');
                closeModal('statsModal');
                hideAddForm();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
