(function() {
    'use strict';

    const STORAGE_KEY = 'mmy_tasktime_data';
    const DEFAULT_TASKS = [
        { id: 'default_1', name: '外包跟进反馈', duration: 5, isLoop: false, isDefault: true },
        { id: 'default_2', name: 'Agent跟进', duration: 10, isLoop: true, isDefault: true },
        { id: 'default_3', name: '主任务跟进', duration: 30, isLoop: false, isDefault: true },
        { id: 'default_4', name: '间隔喝水', duration: 40, isLoop: false, isDefault: true }
    ];
    const DEFAULT_SETTINGS = {
        clockReminder: true,
        startTime: '09:30',
        endTime: '19:30',
        soundEnabled: true,
        notificationEnabled: true
    };

    let appData = {
        customTasks: [],
        settings: { ...DEFAULT_SETTINGS },
        stats: {}
    };

    let timerState = {
        isRunning: false,
        currentTask: null,
        totalSeconds: 0,
        remainingSeconds: 0,
        intervalId: null,
        isCompleted: false
    };

    let clockReminderState = {
        lastRemindedDate: null,
        lastStartReminded: false,
        lastEndReminded: false
    };

    let audioContext = null;

    function loadData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                appData.customTasks = parsed.customTasks || [];
                appData.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
                appData.stats = parsed.stats || {};
            }
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    }

    function generateId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatDuration(seconds) {
        if (seconds < 60) return seconds + '秒';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) {
            return h + 'h ' + m + 'm';
        }
        return m + 'm';
    }

    function getTodayString() {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }

    function getWeekDates() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        }
        return dates;
    }

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    function playDingSound() {
        if (!appData.settings.soundEnabled) return;
        initAudio();

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.8);

        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.frequency.setValueAtTime(1100, audioContext.currentTime);
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
            osc2.start(audioContext.currentTime);
            osc2.stop(audioContext.currentTime + 0.6);
        }, 200);
    }

    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function showNotification(title, body) {
        if (!appData.settings.notificationEnabled) return;
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>' });
        }
    }

    function initDrag() {
        const dragHandle = document.querySelector('.drag-handle');
        const appContainer = document.querySelector('.app-container');

        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        dragHandle.addEventListener('mousedown', function(e) {
            isDragging = true;
            const rect = appContainer.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            appContainer.style.transform = 'none';
            appContainer.style.left = rect.left + 'px';
            appContainer.style.top = rect.top + 'px';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - appContainer.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - appContainer.offsetHeight));
            appContainer.style.left = newLeft + 'px';
            appContainer.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
            }
        });
    }

    function initClock() {
        function updateClock() {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            document.getElementById('clock').textContent = h + ':' + m + ':' + s;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    function updateProgressBar() {
        const progressFill = document.getElementById('progressFill');
        if (timerState.totalSeconds > 0) {
            const progress = ((timerState.totalSeconds - timerState.remainingSeconds) / timerState.totalSeconds) * 100;
            progressFill.style.width = progress + '%';
        }
    }

    function updateActiveTaskUI() {
        const activeTaskEl = document.getElementById('activeTask');
        const activeTaskCard = activeTaskEl.querySelector('.active-task-card');
        const activeTaskName = document.getElementById('activeTaskName');
        const activeTimer = document.getElementById('activeTimer');
        const activeTaskStatus = document.getElementById('activeTaskStatus');
        const activeTaskControls = document.getElementById('activeTaskControls');
        const activeTaskCompleted = document.getElementById('activeTaskCompleted');

        if (!timerState.currentTask) {
            activeTaskEl.classList.remove('show');
            return;
        }

        activeTaskEl.classList.add('show');
        activeTaskName.textContent = timerState.currentTask.name;
        activeTimer.textContent = formatTime(timerState.remainingSeconds);

        activeTaskCard.classList.remove('loop', 'completed');
        activeTaskStatus.classList.remove('loop', 'completed');

        if (timerState.isCompleted) {
            activeTaskCard.classList.add('completed');
            activeTaskStatus.classList.add('completed');
            activeTaskStatus.textContent = '✓ 已完成';
            activeTaskControls.classList.remove('show');
            activeTaskCompleted.classList.add('show');
        } else if (timerState.isRunning) {
            if (timerState.currentTask.isLoop) {
                activeTaskCard.classList.add('loop');
                activeTaskStatus.classList.add('loop');
                activeTaskStatus.textContent = '↻ AI循环中...';
            } else {
                activeTaskStatus.textContent = '● 计时中...';
            }
            activeTaskControls.classList.add('show');
            activeTaskCompleted.classList.remove('show');
        }

        updateProgressBar();
    }

    function clearActiveButtons() {
        document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.task-start').forEach(b => {
            b.classList.remove('active', 'loop-active');
        });
        document.querySelectorAll('.task-item').forEach(i => i.classList.remove('active'));
    }

    function setActiveButton(taskId) {
        const quickBtn = document.querySelector('.quick-btn[data-id="' + taskId + '"]');
        if (quickBtn) {
            quickBtn.classList.add('active');
            return;
        }
        const taskItem = document.querySelector('.task-item[data-id="' + taskId + '"]');
        if (taskItem) {
            taskItem.classList.add('active');
            const startBtn = taskItem.querySelector('.task-start');
            const task = getAllTasks().find(t => t.id === taskId);
            if (task && task.isLoop) {
                startBtn.classList.add('loop-active');
            } else {
                startBtn.classList.add('active');
            }
        }
    }

    function stopTimer() {
        if (timerState.intervalId) {
            clearInterval(timerState.intervalId);
            timerState.intervalId = null;
        }
        timerState.isRunning = false;
    }

    function recordTaskCompletion(task) {
        if (task.isLoop) return;
        const today = getTodayString();
        if (!appData.stats[today]) {
            appData.stats[today] = {};
        }
        if (!appData.stats[today][task.name]) {
            appData.stats[today][task.name] = { count: 0, totalSeconds: 0 };
        }
        appData.stats[today][task.name].count++;
        appData.stats[today][task.name].totalSeconds += task.duration * 60;
        saveData();
    }

    function onTimerComplete() {
        const task = timerState.currentTask;
        if (task.isLoop) {
            playDingSound();
            showNotification('任务循环', task.name + ' 一轮完成，自动开始下一轮');
            timerState.remainingSeconds = timerState.totalSeconds;
            clearActiveButtons();
            setActiveButton(task.id);
            updateActiveTaskUI();
            startTimerInterval();
        } else {
            stopTimer();
            timerState.isCompleted = true;
            playDingSound();
            recordTaskCompletion(task);
            showNotification('任务完成', task.name + ' 已完成！');
            clearActiveButtons();
            updateActiveTaskUI();
        }
    }

    function startTimerInterval() {
        timerState.isRunning = true;
        timerState.intervalId = setInterval(() => {
            if (timerState.remainingSeconds > 0) {
                timerState.remainingSeconds--;
                const activeTimer = document.getElementById('activeTimer');
                if (activeTimer) {
                    activeTimer.textContent = formatTime(timerState.remainingSeconds);
                }
                updateProgressBar();
            } else {
                onTimerComplete();
            }
        }, 1000);
    }

    function startTask(task) {
        stopTimer();
        timerState.currentTask = task;
        timerState.totalSeconds = task.duration * 60;
        timerState.remainingSeconds = timerState.totalSeconds;
        timerState.isCompleted = false;

        clearActiveButtons();
        setActiveButton(task.id);
        updateActiveTaskUI();
        startTimerInterval();
    }

    function handleStop() {
        stopTimer();
        timerState.currentTask = null;
        timerState.isCompleted = false;
        clearActiveButtons();
        updateActiveTaskUI();
    }

    function handleRestart() {
        if (timerState.currentTask) {
            timerState.isCompleted = false;
            timerState.remainingSeconds = timerState.totalSeconds;
            clearActiveButtons();
            setActiveButton(timerState.currentTask.id);
            updateActiveTaskUI();
            startTimerInterval();
        }
    }

    function getAllTasks() {
        return [...DEFAULT_TASKS, ...appData.customTasks];
    }

    function renderQuickTasks() {
        const quickGrid = document.getElementById('quickGrid');
        quickGrid.innerHTML = '';
        DEFAULT_TASKS.forEach(task => {
            const btn = document.createElement('button');
            btn.className = 'quick-btn' + (task.isLoop && !task.isDefault ? ' loop-task' : '') + (task.isLoop && task.isDefault ? ' ai-task' : '');
            btn.dataset.id = task.id;
            btn.dataset.time = task.duration;
            btn.dataset.name = task.name;
            btn.dataset.loop = task.isLoop;
            btn.innerHTML =
                '<div class="quick-btn-time">' + task.duration + '分</div>' +
                '<div class="quick-btn-label">' + task.name + '</div>';
            btn.addEventListener('click', () => {
                initAudio();
                startTask(task);
            });
            quickGrid.appendChild(btn);
        });
    }

    function renderTaskList() {
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = '';
        appData.customTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item' + (task.isLoop ? ' loop-task' : '');
            item.dataset.id = task.id;
            item.innerHTML =
                '<button class="task-start"></button>' +
                '<div class="task-info">' +
                    '<div class="task-name">' + task.name + '</div>' +
                    '<div class="task-duration">' + task.duration + '分钟' + (task.isLoop ? ' (循环)' : '') + '</div>' +
                '</div>' +
                '<button class="task-delete">×</button>';

            const startBtn = item.querySelector('.task-start');
            const deleteBtn = item.querySelector('.task-delete');

            startBtn.addEventListener('click', () => {
                initAudio();
                startTask(task);
            });

            deleteBtn.addEventListener('click', () => {
                if (timerState.currentTask && timerState.currentTask.id === task.id) {
                    handleStop();
                }
                appData.customTasks = appData.customTasks.filter(t => t.id !== task.id);
                saveData();
                renderTaskList();
            });

            taskList.appendChild(item);
        });
    }

    function initTaskManagement() {
        const addTaskBtn = document.getElementById('addTaskBtn');
        const addTaskForm = document.getElementById('addTaskForm');
        const taskNameInput = document.getElementById('taskNameInput');
        const taskTimeInput = document.getElementById('taskTimeInput');
        const taskLoopInput = document.getElementById('taskLoopInput');
        const cancelAddBtn = document.getElementById('cancelAddBtn');
        const confirmAddBtn = document.getElementById('confirmAddBtn');

        addTaskBtn.addEventListener('click', () => {
            addTaskForm.classList.toggle('show');
            if (addTaskForm.classList.contains('show')) {
                taskNameInput.focus();
            }
        });

        cancelAddBtn.addEventListener('click', () => {
            addTaskForm.classList.remove('show');
            taskNameInput.value = '';
            taskTimeInput.value = '';
            taskLoopInput.checked = false;
        });

        confirmAddBtn.addEventListener('click', () => {
            const name = taskNameInput.value.trim();
            const time = parseInt(taskTimeInput.value);
            const isLoop = taskLoopInput.checked;

            if (!name) {
                alert('请输入任务名称');
                return;
            }
            if (!time || time < 1 || time > 180) {
                alert('请输入有效的时长（1-180分钟）');
                return;
            }
            if (appData.customTasks.length >= 10) {
                alert('任务列表最多10个自定义任务');
                return;
            }

            appData.customTasks.push({
                id: generateId(),
                name: name,
                duration: time,
                isLoop: isLoop
            });
            saveData();
            renderTaskList();

            taskNameInput.value = '';
            taskTimeInput.value = '';
            taskLoopInput.checked = false;
            addTaskForm.classList.remove('show');
        });

        taskTimeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmAddBtn.click();
            }
        });
        taskNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                taskTimeInput.focus();
            }
        });
    }

    function initModals() {
        const settingsBtn = document.getElementById('settingsBtn');
        const statsBtn = document.getElementById('statsBtn');

        settingsBtn.addEventListener('click', () => {
            loadSettingsToUI();
            document.getElementById('settingsModal').classList.add('show');
        });

        statsBtn.addEventListener('click', () => {
            updateStatsDisplay();
            document.getElementById('statsModal').classList.add('show');
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', function() {
                document.getElementById(this.dataset.modal).classList.remove('show');
            });
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('show');
                }
            });
        });
    }

    function loadSettingsToUI() {
        document.getElementById('clockReminderToggle').classList.toggle('on', appData.settings.clockReminder);
        document.getElementById('startTimeInput').value = appData.settings.startTime;
        document.getElementById('endTimeInput').value = appData.settings.endTime;
        document.getElementById('soundToggle').classList.toggle('on', appData.settings.soundEnabled);
        document.getElementById('notificationToggle').classList.toggle('on', appData.settings.notificationEnabled);
    }

    function initSettings() {
        const toggles = [
            { id: 'clockReminderToggle', key: 'clockReminder' },
            { id: 'soundToggle', key: 'soundEnabled' },
            { id: 'notificationToggle', key: 'notificationEnabled' }
        ];

        toggles.forEach(({ id, key }) => {
            document.getElementById(id).addEventListener('click', function() {
                this.classList.toggle('on');
                appData.settings[key] = this.classList.contains('on');
                saveData();
                if (key === 'notificationEnabled' && appData.settings[key]) {
                    requestNotificationPermission();
                }
            });
        });

        document.getElementById('startTimeInput').addEventListener('change', function() {
            appData.settings.startTime = this.value;
            saveData();
        });

        document.getElementById('endTimeInput').addEventListener('change', function() {
            appData.settings.endTime = this.value;
            saveData();
        });
    }

    function checkClockReminder() {
        if (!appData.settings.clockReminder) return;

        const now = new Date();
        const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const today = getTodayString();

        if (clockReminderState.lastRemindedDate !== today) {
            clockReminderState.lastRemindedDate = today;
            clockReminderState.lastStartReminded = false;
            clockReminderState.lastEndReminded = false;
        }

        if (currentTime === appData.settings.startTime && !clockReminderState.lastStartReminded) {
            clockReminderState.lastStartReminded = true;
            playDingSound();
            showNotification('上班提醒', '现在是上班时间 ' + appData.settings.startTime + '，开始专注工作吧！');
        }

        if (currentTime === appData.settings.endTime && !clockReminderState.lastEndReminded) {
            clockReminderState.lastEndReminded = true;
            playDingSound();
            showNotification('下班提醒', '现在是下班时间 ' + appData.settings.endTime + '，工作辛苦了！');
        }
    }

    function initClockReminder() {
        checkClockReminder();
        setInterval(checkClockReminder, 60000);
    }

    function calculateStats() {
        const today = getTodayString();
        const weekDates = getWeekDates();
        let todayDuration = 0;
        let todayCount = 0;
        let weekDuration = 0;
        let todayTasks = {};

        if (appData.stats[today]) {
            Object.keys(appData.stats[today]).forEach(taskName => {
                const data = appData.stats[today][taskName];
                todayCount += data.count;
                todayDuration += data.totalSeconds;
                todayTasks[taskName] = { ...data };
            });
        }

        weekDates.forEach(date => {
            if (appData.stats[date]) {
                Object.keys(appData.stats[date]).forEach(taskName => {
                    weekDuration += appData.stats[date][taskName].totalSeconds;
                });
            }
        });

        return { todayDuration, todayCount, weekDuration, todayTasks };
    }

    function updateStatsDisplay() {
        const stats = calculateStats();
        document.getElementById('todayDuration').textContent = formatDuration(stats.todayDuration);
        document.getElementById('todayCount').textContent = stats.todayCount;
        document.getElementById('weekDuration').textContent = formatDuration(stats.weekDuration);

        const statsDetail = document.getElementById('statsDetail');
        const taskNames = Object.keys(stats.todayTasks);
        if (taskNames.length > 0) {
            let html = '<div class="stats-detail-title">今日任务明细</div><div class="stats-detail-list">';
            taskNames.forEach(name => {
                const data = stats.todayTasks[name];
                html += '<div class="stats-detail-item">' +
                    '<span class="stats-detail-name">' + name + '</span>' +
                    '<span class="stats-detail-info">' + data.count + '次 · ' + formatDuration(data.totalSeconds) + '</span>' +
                '</div>';
            });
            html += '</div>';
            statsDetail.innerHTML = html;
        } else {
            statsDetail.innerHTML = '';
        }
    }

    function generateExportHTML() {
        const stats = calculateStats();
        const today = getTodayString();

        let detailRows = '';
        Object.keys(stats.todayTasks).forEach(name => {
            const data = stats.todayTasks[name];
            detailRows += '<tr>' +
                '<td>' + name + '</td>' +
                '<td>' + data.count + '</td>' +
                '<td>' + formatDuration(data.totalSeconds) + '</td>' +
            '</tr>';
        });

        let allStatsRows = '';
        const sortedDates = Object.keys(appData.stats).sort().reverse();
        sortedDates.forEach(date => {
            let dateDuration = 0;
            let dateCount = 0;
            Object.keys(appData.stats[date]).forEach(taskName => {
                dateCount += appData.stats[date][taskName].count;
                dateDuration += appData.stats[date][taskName].totalSeconds;
            });
            allStatsRows += '<tr>' +
                '<td>' + date + '</td>' +
                '<td>' + dateCount + '</td>' +
                '<td>' + formatDuration(dateDuration) + '</td>' +
            '</tr>';
        });

        return '<!DOCTYPE html>' +
'<html lang="zh-CN">' +
'<head>' +
    '<meta charset="UTF-8">' +
    '<title>MMY-TaskTime 数据报告</title>' +
    '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; padding: 40px 20px; }' +
        '.container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }' +
        'h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 8px; }' +
        '.subtitle { color: #999; font-size: 14px; margin-bottom: 24px; }' +
        '.stats-overview { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 32px; }' +
        '.stat-card { background: #f8f9fa; border-radius: 10px; padding: 20px; text-align: center; }' +
        '.stat-value { font-size: 24px; font-weight: 600; color: #1a1a1a; }' +
        '.stat-label { font-size: 12px; color: #999; margin-top: 4px; }' +
        'h2 { font-size: 16px; color: #333; margin-bottom: 12px; margin-top: 24px; }' +
        'table { width: 100%; border-collapse: collapse; margin-top: 12px; }' +
        'th, td { padding: 12px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }' +
        'th { color: #999; font-weight: 500; font-size: 12px; text-transform: uppercase; }' +
        'td { color: #333; }' +
        '.footer { margin-top: 32px; text-align: center; color: #ccc; font-size: 12px; }' +
    '</style>' +
'</head>' +
'<body>' +
    '<div class="container">' +
        '<h1>MMY-TaskTime 专注报告</h1>' +
        '<div class="subtitle">导出日期：' + today + '</div>' +
        '<div class="stats-overview">' +
            '<div class="stat-card"><div class="stat-value">' + formatDuration(stats.todayDuration) + '</div><div class="stat-label">今日专注</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + stats.todayCount + '</div><div class="stat-label">今日完成</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + formatDuration(stats.weekDuration) + '</div><div class="stat-label">本周专注</div></div>' +
        '</div>' +
        '<h2>今日任务明细</h2>' +
        '<table>' +
            '<thead><tr><th>任务名称</th><th>完成次数</th><th>总时长</th></tr></thead>' +
            '<tbody>' + (detailRows || '<tr><td colspan="3" style="text-align:center;color:#999;">暂无记录</td></tr>') + '</tbody>' +
        '</table>' +
        '<h2>历史记录</h2>' +
        '<table>' +
            '<thead><tr><th>日期</th><th>完成任务数</th><th>专注时长</th></tr></thead>' +
            '<tbody>' + (allStatsRows || '<tr><td colspan="3" style="text-align:center;color:#999;">暂无记录</td></tr>') + '</tbody>' +
        '</table>' +
        '<div class="footer">Generated by MMY-TaskTime</div>' +
    '</div>' +
'</body>' +
'</html>';
    }

    function initExport() {
        document.getElementById('exportBtn').addEventListener('click', () => {
            const html = generateExportHTML();
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'MMY-TaskTime-报告-' + getTodayString() + '.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function initActiveTaskControls() {
        document.getElementById('stopBtn').addEventListener('click', handleStop);
        document.getElementById('restartBtn').addEventListener('click', handleRestart);
    }

    function init() {
        loadData();
        requestNotificationPermission();
        initDrag();
        initClock();
        renderQuickTasks();
        renderTaskList();
        initTaskManagement();
        initModals();
        initSettings();
        initActiveTaskControls();
        initExport();
        initClockReminder();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
