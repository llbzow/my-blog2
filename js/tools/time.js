(function() {
    let timer = null;
    let isPaused = false;

    function initTimeTool() {
        const container = document.getElementById('tool-time-container');
        if (!container) return;

        container.addEventListener('click', (e) => e.stopPropagation());

        // Cleanup
        if (timer) clearInterval(timer);

        // DOM Elements
        const currentNow = document.getElementById('current-now');
        const unixS = document.getElementById('current-unix-s');
        const unixMs = document.getElementById('current-unix-ms');
        const toggleBtn = document.getElementById('toggle-pause');
        const inputTs = document.getElementById('input-timestamp');
        const btnConvertTs = document.getElementById('btn-convert-ts');
        const inputDate = document.getElementById('input-date');
        const btnConvertDate = document.getElementById('btn-convert-date');
        const copyBtns = document.querySelectorAll('.copy-btn');

        // Initial Setup
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        inputDate.value = now.toISOString().slice(0, 19);

        // Event Listeners
        toggleBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            toggleBtn.innerText = isPaused ? '▶️ 恢复更新' : '⏸️ 暂停更新';
        });

        btnConvertTs.addEventListener('click', convertTimestamp);
        btnConvertDate.addEventListener('click', convertDate);

        copyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-copy-target');
                const text = document.getElementById(targetId).innerText;
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = e.target.innerText;
                    e.target.innerText = '已复制';
                    setTimeout(() => e.target.innerText = originalText, 1000);
                });
            });
        });

        // Start Loop
        timer = setInterval(() => {
            if (isPaused) return;
            const d = new Date();
            currentNow.innerText = d.toLocaleString();
            unixS.innerText = Math.floor(d.getTime() / 1000);
            unixMs.innerText = d.getTime();
            updateWorldClocks(d);
        }, 1000);
        
        // Initial run
        currentNow.innerText = new Date().toLocaleString();
        updateWorldClocks(new Date());
    }

    function convertTimestamp() {
        let val = document.getElementById('input-timestamp').value.trim();
        if (!val) return;
        let unit = document.getElementById('timestamp-unit').value;
        let ts = parseInt(val);
        if (isNaN(ts)) return;

        if (unit === 'auto') {
            unit = String(ts).length > 11 ? 'ms' : 's';
        }
        const date = new Date(unit === 's' ? ts * 1000 : ts);
        document.getElementById('result-date').innerHTML = `
            <strong>北京时间:</strong> ${date.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}<br>
            <strong>UTC 时间:</strong> ${date.toUTCString()}<br>
            <strong>ISO 8601:</strong> ${date.toISOString()}
        `;
    }

    function convertDate() {
        const val = document.getElementById('input-date').value;
        if (!val) return;
        const date = new Date(val);
        const tsMs = date.getTime();
        const tsS = Math.floor(tsMs / 1000);
        document.getElementById('result-timestamp').innerHTML = `
            <strong>时间戳 (秒):</strong> ${tsS}<br>
            <strong>时间戳 (毫秒):</strong> ${tsMs}
        `;
    }

    function updateWorldClocks(now) {
        const grid = document.getElementById('world-clocks');
        if (!grid) return;
        const cities = [
            { name: '北京', tz: 'Asia/Shanghai' },
            { name: '伦敦', tz: 'Europe/London' },
            { name: '纽约', tz: 'America/New_York' },
            { name: '东京', tz: 'Asia/Tokyo' },
            { name: '巴黎', tz: 'Europe/Paris' },
            { name: '悉尼', tz: 'Australia/Sydney' },
            { name: '迪拜', tz: 'Asia/Dubai' },
            { name: '洛杉矶', tz: 'America/Los_Angeles' }
        ];
        let html = '';
        cities.forEach(city => {
            const timeStr = now.toLocaleTimeString('en-US', { timeZone: city.tz, hour12: false, hour: '2-digit', minute: '2-digit' });
            html += `
                <div class="clock-card" style="background:var(--card-bg, #f0f0f0); padding:10px; border-radius:4px; text-align:center;">
                    <div style="color:#666; font-size:0.9em;">${city.name}</div>
                    <div style="font-size:1.4em; font-weight:bold; color:#49b1f5;">${timeStr}</div>
                </div>
            `;
        });
        grid.innerHTML = html;
    }

    // Init
    document.addEventListener('DOMContentLoaded', initTimeTool);
    document.addEventListener('pjax:complete', initTimeTool);
})();
