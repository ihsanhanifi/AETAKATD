const API_URL = 'https://script.google.com/macros/s/AKfycbwuaPawE1a26fkcR8htUiU0X7rTyBeNIEBW12rI2hpE4XAw6SQuiJYS6Ym14sP1iTU8/exec';

let currentUser = null;
let allGuests = []; // Hanya menyimpan data periode yang sedang diminta (Sangat Ringan!)
let allUsers = [];
let currentFilter = { type: 'month', seksi: 'all' }; 

// === VARIABEL IDLE MONITORING ===
let idleTimer = null;
let countdownTimer = null;
let countdownValue = 30;
const IDLE_TIMEOUT = 120000;
const WARNING_BEFORE = 30000;
let lastActivityTime = Date.now();
let mouseMoveThrottle = null;

// === VARIABEL AUTO-REFRESH ===
let statsRefreshInterval = null;
const STATS_REFRESH_INTERVAL = 60000;

// === FUNGSI HELPER UNTUK TEXT-TO-SPEECH (SUARA) ===
function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
    }
}

// === 🆕 FUNGSI UNTUK MEMUAT BACKGROUND DINAMIS (SINKRON DENGAN DATABASE) ===
async function loadSavedBackground() {
    try {
        const res = await fetch(`${API_URL}?action=getBackgroundUrl`);
        const data = await res.json();
        if (data.status === 'success' && data.url) {
            // Tambahkan cache buster agar browser memuat gambar terbaru, bukan dari cache lama
            const cacheBuster = new Date().getTime();
            document.documentElement.style.setProperty('--bg-image', `url('${data.url}?t=${cacheBuster}')`);
        }
    } catch (err) {
        console.error('Gagal memuat background dinamis:', err);
    }
}

// === INISIALISASI ===
document.addEventListener('DOMContentLoaded', () => {
    // 🆕 1. Muat background dinamis dari server agar tidak kembali ke default saat refresh/logout
    loadSavedBackground();
    
    // 2. Inisialisasi waktu
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // 3. Cek sesi login
    const savedUser = localStorage.getItem('etamu_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showDashboard();
        } catch (e) {
            localStorage.removeItem('etamu_user');
        }
    }
    
    // 4. Inisialisasi filter tanggal
    populateYearOptions();
    const today = new Date().toISOString().split('T')[0];
    const filterDate = document.getElementById('filterDate');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    const filterMonth = document.getElementById('filterMonth');
    
    if (filterDate) filterDate.value = today;
    if (filterDateFrom) filterDateFrom.value = today;
    if (filterDateTo) filterDateTo.value = today;
    if (filterMonth) filterMonth.value = today.substring(0, 7); 
});

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const el = document.getElementById('currentDateTime');
    if (el) {
        el.innerText = now.toLocaleDateString('id-ID', options);
        el.classList.remove('animate-pulse-once');
        void el.offsetWidth;
        el.classList.add('animate-pulse-once');
    }
}

function toggleMobileMenu() {
    const navTabs = document.getElementById('mobileNavTabs');
    if (navTabs) navTabs.classList.toggle('active');
}

// === LOGIN ===
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true, "Memverifikasi kredensial...");
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            currentUser = data.user;
            localStorage.setItem('etamu_user', JSON.stringify(currentUser));
            
            const welcomeMsg = `Selamat datang, ${currentUser.username}. Terima Kasih Telah Menggunakan E-Tamu Kantor Kementerian Agama Kabupaten Tanah Datar`;
            showModal('success', welcomeMsg);
            speakText(welcomeMsg);
            
            setTimeout(() => {
                closeModal();
                showDashboard();
            }, 3500); 
        } else {
            showModal('error', data.message || 'Username atau password salah!');
        }
    } catch (err) {
        console.error('Login error:', err);
        showModal('error', 'Gagal terhubung ke server.');
    } finally {
        showLoading(false);
    }
});

// === 🚀 DASHBOARD: LAZY LOADING (INSTAN & MINIMALIS DATA) ===
async function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    const dashboardSection = document.getElementById('dashboardSection');
    dashboardSection.classList.add('animate-fade-in');
    
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        userInfoEl.innerText = `${currentUser.username} (${currentUser.role === 'admin_utama' ? 'Admin Utama' : 'Admin Seksi: ' + currentUser.seksi})`;
    }
    
    if (currentUser.role === 'admin_utama') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        const guestTableTitle = document.getElementById('guestTableTitle');
        if (guestTableTitle) guestTableTitle.innerText = 'Daftar Seluruh Tamu';
        const printTitle = document.getElementById('printTitle');
        if (printTitle) printTitle.innerText = 'Laporan Data Tamu Kementerian Agama Kab. Tanah Datar';
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        const guestTableTitle = document.getElementById('guestTableTitle');
        if (guestTableTitle) guestTableTitle.innerText = `Daftar Tamu Seksi: ${currentUser.seksi}`;
        const printTitle = document.getElementById('printTitle');
        if (printTitle) printTitle.innerText = `Laporan Data Tamu Seksi ${currentUser.seksi}`;
    }
    
    // 🚀 LAZY LOADING: Setup default filter, tapi JANGAN load data berat di sini.
    const filterTypeEl = document.getElementById('filterType');
    if (filterTypeEl) filterTypeEl.value = 'month';
    toggleFilterInputs();
    
    // Trigger tab default (guests) agar data diambil HANYA saat tab ini di-render
    const defaultTabBtn = Array.from(document.querySelectorAll('.nav-tab')).find(btn => btn.getAttribute('onclick').includes('guests'));
    if (defaultTabBtn) {
        switchTab('guests', defaultTabBtn);
    }

    startIdleMonitoring();
    startStatsAutoRefresh();
}

// === AUTO-REFRESH STATISTIK ===
function startStatsAutoRefresh() {
    if (statsRefreshInterval) clearInterval(statsRefreshInterval);
    statsRefreshInterval = setInterval(() => {
        const statsTab = document.getElementById('tab-stats');
        if (statsTab && !statsTab.classList.contains('hidden')) {
            loadStatsSilent();
        }
    }, STATS_REFRESH_INTERVAL);
}

function stopStatsAutoRefresh() {
    if (statsRefreshInterval) {
        clearInterval(statsRefreshInterval);
        statsRefreshInterval = null;
    }
}

async function loadStatsSilent() {
    try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        const url = `${API_URL}?action=getDetailedStats&role=${currentUser.role}&seksi=${currentUser.seksi || ''}&month=${currentMonth}&year=${currentYear}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'success') return;
        
        updateStatCardValue('statsGrid', 0, data.today);
        updateStatCardValue('statsGrid', 1, data.total);
        updateStatCardValue('statsGrid', 2, data.averagePerDay);
        updateStatCardValue('statsGrid', 3, data.thisMonth);
    } catch (err) {
        console.error('Silent stats refresh error:', err);
    }
}

function updateStatCardValue(gridId, index, value) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const cards = grid.querySelectorAll('.stat-card');
    if (cards[index]) {
        const h3 = cards[index].querySelector('h3');
        if (h3 && h3.innerText !== value.toString()) {
            h3.innerText = value;
            cards[index].classList.add('stat-flash');
            setTimeout(() => cards[index].classList.remove('stat-flash'), 1000);
        }
    }
}

// === IDLE MONITORING (AUTO LOGOUT) ===
function startIdleMonitoring() {
    resetIdleTimer();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    document.addEventListener('mousemove', throttledMouseMove, { passive: true });
}

function stopIdleMonitoring() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove'];
    events.forEach(event => {
        document.removeEventListener(event, resetIdleTimer);
    });
    document.removeEventListener('mousemove', throttledMouseMove);
}

function throttledMouseMove(e) {
    const now = Date.now();
    if (!mouseMoveThrottle || now - mouseMoveThrottle > 500) {
        mouseMoveThrottle = now;
        resetIdleTimer();
    }
}

function resetIdleTimer() {
    lastActivityTime = Date.now();
    const idleModal = document.getElementById('idleWarningModal');
    if (idleModal && !idleModal.classList.contains('hidden')) {
        hideIdleWarning();
    }
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => showIdleWarning(), IDLE_TIMEOUT - WARNING_BEFORE);
}

function showIdleWarning() {
    const modal = document.getElementById('idleWarningModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('animate-fade-in');
    countdownValue = WARNING_BEFORE / 1000;
    const countdownEl = document.getElementById('idleCountdown');
    if (countdownEl) countdownEl.innerText = countdownValue;
    
    countdownTimer = setInterval(() => {
        countdownValue--;
        if (countdownEl) countdownEl.innerText = countdownValue;
        if (countdownValue <= 0) performIdleLogout();
    }, 1000);
}

function hideIdleWarning() {
    const modal = document.getElementById('idleWarningModal');
    if (modal) modal.classList.add('hidden');
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    resetIdleTimer();
}

function continueSession() {
    hideIdleWarning();
    showModal('success', '✅ Sesi dilanjutkan. Anda masih login.');
}

function performIdleLogout() {
    stopIdleMonitoring();
    stopStatsAutoRefresh();
    const modal = document.getElementById('idleWarningModal');
    if (modal) modal.classList.add('hidden');
    
    showLoading(true, "Mengakhiri sesi karena tidak aktif...");
    setTimeout(() => {
        showLoading(false);
        localStorage.removeItem('etamu_user');
        showModal('info', '⏰ Sesi Anda telah berakhir karena tidak aktif. Silakan login kembali.');
        setTimeout(() => {
            closeModal();
            currentUser = null;
            const dashboardSection = document.getElementById('dashboardSection');
            const loginSection = document.getElementById('loginSection');
            if (dashboardSection) dashboardSection.classList.add('hidden');
            if (loginSection) loginSection.classList.remove('hidden');
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
        }, 2000);
    }, 1000);
}

function logout() {
    if (!confirm('🚪 Apakah Anda yakin ingin logout?')) return;
    
    const goodbyeMsg = "Terima Kasih Telah Menggunakan E-Tamu Kantor Kementerian Agama Kabupaten Tanah Datar";
    showModal('info', goodbyeMsg);
    speakText(goodbyeMsg);
    
    stopIdleMonitoring();
    stopStatsAutoRefresh();
    showLoading(true, "Logging out...");
    
    setTimeout(() => {
        localStorage.removeItem('etamu_user');
        showLoading(false);
        location.reload();
    }, 3500); 
}

// === 🚀 SWITCH TAB: LAZY LOADING (AMBIL DATA HANYA SAAT DIMINTA) ===
function switchTab(tabName, btnElement) {
    const mobileNavTabs = document.getElementById('mobileNavTabs');
    if (mobileNavTabs) mobileNavTabs.classList.remove('active');
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.remove('animate-fade-in');
        void target.offsetWidth;
        target.classList.add('animate-fade-in');
    }
    
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    
    // 🚀 LAZY LOADING: Ambil data HANYA saat tab ini diklik
    if (tabName === 'guests') {
        applyFilter(); 
    } else if (tabName === 'stats') {
        loadStats(); 
    } else if (tabName === 'users') {
        loadUsers();
    }
}

// ============================================
// STATISTIK DETAIL LENGKAP
// ============================================
async function loadStats() {
    showLoading(true, "Mengambil data statistik...");
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    try {
        const url = `${API_URL}?action=getDetailedStats&role=${currentUser.role}&seksi=${currentUser.seksi || ''}&month=${currentMonth}&year=${currentYear}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'success') {
            showModal('error', 'Gagal memuat statistik');
            return;
        }
        renderStatsDashboard(data);
    } catch (err) {
        console.error('Error loading stats:', err);
        showModal('error', 'Gagal memuat statistik: ' + err.message);
    } finally {
        showLoading(false);
    }
}

function renderStatsDashboard(data) {
    const grid = document.getElementById('statsGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="stat-card animate-slide-up"><div class="stat-icon">📅</div><h3>${data.today}</h3><p>Tamu Hari Ini</p></div>
            <div class="stat-card gold animate-slide-up" style="animation-delay: 0.1s;"><div class="stat-icon">👥</div><h3>${data.total}</h3><p>Total Keseluruhan Tamu</p></div>
            <div class="stat-card blue animate-slide-up" style="animation-delay: 0.2s;"><div class="stat-icon">📊</div><h3>${data.averagePerDay}</h3><p>Rata-rata Tamu/Hari</p></div>
            <div class="stat-card purple animate-slide-up" style="animation-delay: 0.3s;"><div class="stat-icon">📆</div><h3>${data.thisMonth}</h3><p>Tamu Bulan Ini</p></div>
        `;
    }
    
    const comparisonGrid = document.getElementById('comparisonGrid');
    if (comparisonGrid) {
        const dailyTrend = calculateTrend(data.today, data.yesterday);
        const weeklyTrend = calculateTrend(data.thisWeek, data.lastWeek);
        comparisonGrid.innerHTML = `
            <div class="comparison-card animate-fade-in">
                <div class="comparison-title">📅 Harian</div>
                <div class="comparison-values">
                    <div><div class="comparison-current">${data.today}</div><div class="comparison-previous">Hari ini</div></div>
                    <div style="text-align: right;"><div class="comparison-previous" style="font-size: 1.2rem; font-weight: bold;">${data.yesterday}</div><div class="comparison-previous">Kemarin</div></div>
                </div>
                <div class="comparison-trend ${dailyTrend.class}">${dailyTrend.icon} ${dailyTrend.text}</div>
            </div>
            <div class="comparison-card animate-fade-in" style="animation-delay: 0.1s;">
                <div class="comparison-title">📆 Mingguan</div>
                <div class="comparison-values">
                    <div><div class="comparison-current">${data.thisWeek}</div><div class="comparison-previous">Minggu ini</div></div>
                    <div style="text-align: right;"><div class="comparison-previous" style="font-size: 1.2rem; font-weight: bold;">${data.lastWeek}</div><div class="comparison-previous">Minggu lalu</div></div>
                </div>
                <div class="comparison-trend ${weeklyTrend.class}">${weeklyTrend.icon} ${weeklyTrend.text}</div>
            </div>
            <div class="comparison-card animate-fade-in" style="animation-delay: 0.2s;">
                <div class="comparison-title">🗓️ Bulanan</div>
                <div class="comparison-values">
                    <div><div class="comparison-current">${data.thisMonth}</div><div class="comparison-previous">Bulan ini</div></div>
                </div>
                <div style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">Total tamu pada bulan berjalan</div>
            </div>
        `;
    }
    
    const asalSection = document.getElementById('asalBreakdownSection');
    if (currentUser.role === 'admin_utama' && asalSection) {
        asalSection.classList.remove('hidden');
        const asalBreakdown = document.getElementById('asalBreakdown');
        if (asalBreakdown) {
            const totalAsal = data.instansiCount + data.umumCount;
            const instansiPercent = totalAsal > 0 ? ((data.instansiCount / totalAsal) * 100).toFixed(1) : 0;
            const umumPercent = totalAsal > 0 ? ((data.umumCount / totalAsal) * 100).toFixed(1) : 0;
            asalBreakdown.innerHTML = `
                <div class="asal-card animate-slide-up"><div class="asal-icon">🏢</div><div class="asal-count">${data.instansiCount}</div><div class="asal-label">Dari Instansi</div><div class="asal-percent">${instansiPercent}%</div></div>
                <div class="asal-card umum animate-slide-up" style="animation-delay: 0.1s;"><div class="asal-icon">👤</div><div class="asal-count">${data.umumCount}</div><div class="asal-label">Dari Umum</div><div class="asal-percent">${umumPercent}%</div></div>
            `;
        }
    } else if (asalSection) {
        asalSection.classList.add('hidden');
    }
    
    const topSeksiSection = document.getElementById('topSeksiSection');
    if (currentUser.role === 'admin_utama' && data.topSeksi && data.topSeksi.length > 0 && topSeksiSection) {
        topSeksiSection.classList.remove('hidden');
        const topSeksiContainer = document.getElementById('topSeksiContainer');
        if (topSeksiContainer) {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            topSeksiContainer.innerHTML = data.topSeksi.map((item, idx) => `
                <div class="top-seksi-item rank-${item.rank} animate-fade-in" style="animation-delay: ${idx * 0.1}s;">
                    <div class="top-seksi-rank">${medals[idx]}</div>
                    <div class="top-seksi-info">
                        <div class="top-seksi-name">${item.name}</div>
                        <div class="top-seksi-bar"><div class="top-seksi-bar-fill" style="width: ${item.percentage}%;"></div></div>
                        <div class="top-seksi-percent">${item.percentage}% dari total tamu</div>
                    </div>
                    <div class="top-seksi-count">${item.count}</div>
                </div>
            `).join('');
        }
    } else if (topSeksiSection) {
        topSeksiSection.classList.add('hidden');
    }
    
    const sectionStats = document.getElementById('sectionStats');
    if (currentUser.role === 'admin_utama' && data.perSeksi && Object.keys(data.perSeksi).length > 0 && sectionStats) {
        sectionStats.classList.remove('hidden');
        const tbody = document.querySelector('#sectionStatsTable tbody');
        if (tbody) {
            tbody.innerHTML = '';
            const sortedSeksi = Object.entries(data.perSeksi).sort((a, b) => b[1].count - a[1].count);
            let delay = 0;
            sortedSeksi.forEach(([seksi, stats], index) => {
                tbody.innerHTML += `
                    <tr class="animate-fade-in" style="animation-delay: ${delay}s">
                        <td style="text-align: center;">${index + 1}</td>
                        <td><strong>${seksi}</strong></td>
                        <td style="text-align: center; font-weight: bold; color: var(--kemenag-green);">${stats.count}</td>
                        <td style="text-align: center;">${stats.percentage}%</td>
                        <td><div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${stats.percentage}%;">${stats.percentage}%</div></div></td>
                    </tr>
                `;
                delay += 0.05;
            });
        }
    } else if (currentUser.role === 'admin_utama' && sectionStats) {
        sectionStats.classList.remove('hidden');
        const tbody = document.querySelector('#sectionStatsTable tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #9ca3af;"><div class="empty-stats-icon">📊</div>Belum ada data tamu</td></tr>`;
        }
    } else if (sectionStats) {
        sectionStats.classList.add('hidden');
    }
}

function calculateTrend(current, previous) {
    if (previous === 0) {
        if (current > 0) return { class: 'trend-up', icon: '📈', text: `+${current} dari kemarin` };
        return { class: 'trend-neutral', icon: '➖', text: 'Tidak ada perubahan' };
    }
    const change = ((current - previous) / previous) * 100;
    if (change > 0) return { class: 'trend-up', icon: '📈', text: `+${change.toFixed(1)}% dari periode lalu` };
    if (change < 0) return { class: 'trend-down', icon: '📉', text: `${change.toFixed(1)}% dari periode lalu` };
    return { class: 'trend-neutral', icon: '➖', text: 'Tidak ada perubahan' };
}

// ============================================
// 🚀 DATA TAMU (SERVER-SIDE FILTERING)
// ============================================

async function loadGuests(params = {}, skipRender = false) {
    if (!skipRender) showLoading(true, "Mengambil data tamu...");
    try {
        let url = `${API_URL}?action=getGuests&role=${currentUser.role}&seksi=${currentUser.seksi || ''}`;
        
        // 🚀 Kirim parameter ke server agar difilter di sumber (Sangat Cepat & Ringan!)
        if (params.month && params.year) {
            url += `&month=${params.month}&year=${params.year}`;
        } else if (params.targetDate) {
            url += `&targetDate=${params.targetDate}`;
        } else if (params.startDate && params.endDate) {
            url += `&startDate=${params.startDate}&endDate=${params.endDate}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        allGuests = data.guests || [];
        
        if (!skipRender) {
            renderGuestsTable(allGuests);
        }
        
        if (currentUser.role === 'admin_utama') {
            const filterSeksiRow = document.getElementById('filterSeksiRow');
            if (filterSeksiRow) filterSeksiRow.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error loading guests:', err);
        showModal('error', 'Gagal memuat data tamu');
    } finally {
        if (!skipRender) showLoading(false);
    }
}

function renderGuestsTable(guests) {
    const tbody = document.querySelector('#guestsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (guests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">Belum ada data tamu pada periode ini.</td></tr>';
        return;
    }
    
    const fallbackImg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZjBmMGYwIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==";
    
    guests.forEach((g, index) => {
        const date = new Date(g.timestamp).toLocaleString('id-ID');
        let photoCell = '';
        const fotoVal = String(g.fotoSelfie || '').trim();
        
        if (fotoVal !== 'Tidak ada foto' && fotoVal.length > 20 && (fotoVal.startsWith('data:image') || fotoVal.includes('googleusercontent.com') || fotoVal.includes('drive.google.com'))) {
            const safeName = g.nama.replace(/'/g, "\\'");
            photoCell = `
                <td class="no-print" style="text-align: center;">
                    <img src="${fotoVal}" alt="Foto ${safeName}" class="photo-thumbnail" crossorigin="anonymous"
                         onerror="this.onerror=null; this.src='${fallbackImg}'; this.style.border='2px dashed #ccc'; this.style.cursor='default'; this.onclick=null;"
                         onclick="openLightbox('${fotoVal}', '${safeName} - ${date}')">
                </td>`;
        } else {
            photoCell = `<td class="no-print" style="text-align: center;"><div class="no-photo" title="Tidak ada foto">📷</div></td>`;
        }
        
        tbody.innerHTML += `
            <tr class="animate-fade-in" style="animation-delay: ${index * 0.05}s">
                <td style="text-align: center;">${index + 1}</td>
                <td>${date}</td>
                <td>${g.nama}</td>
                <td>${g.asal === 'Instansi' ? g.namaInstansi : 'Umum'}</td>
                <td>${g.alamat || '-'}</td>
                <td>${g.tujuan}</td>
                <td>${g.keperluan}</td>
                <td>${g.noHp}</td>
                ${photoCell}
            </tr>
        `;
    });
}

// ============================================
// EXPORT EXCEL FUNCTIONS
// ============================================
async function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        showModal('error', 'Library Excel belum dimuat.');
        return;
    }
    
    const dataToExport = getFilteredData();
    
    if (!dataToExport || dataToExport.length === 0) {
        showModal('error', 'Tidak ada data untuk di-export pada filter ini!');
        return;
    }
    
    const btn = document.getElementById('btnExportExcel');
    if (btn) { btn.classList.add('loading'); btn.disabled = true; }
    showLoading(true, "Mempersiapkan data Excel...");
    
    try {
        const excelData = dataToExport.map((g, index) => {
            const date = new Date(g.timestamp);
            const fotoVal = String(g.fotoSelfie || '');
            return {
                'No': index + 1,
                'Tanggal': date.toLocaleDateString('id-ID'),
                'Waktu': date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                'Nama Lengkap': g.nama || '-',
                'Berasal Dari': g.asal === 'Instansi' ? g.namaInstansi : 'Umum',
                'Alamat': g.alamat || '-',
                'Tujuan Seksi': g.tujuan || '-',
                'Keperluan': g.keperluan || '-',
                'No. HP/WA': g.noHp || '-',
                'Foto': (fotoVal !== 'Tidak ada foto' && fotoVal.length > 10) ? 'Ada' : 'Tidak Ada'
            };
        });
        
        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(excelData);
        ws1['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
        
        const headerRange = XLSX.utils.decode_range(ws1['!ref']);
        for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws1[cellAddress]) ws1[cellAddress] = {};
            ws1[cellAddress].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "006A4E" } }, alignment: { horizontal: "center", vertical: "center" } };
        }
        ws1['!autofilter'] = { ref: ws1['!ref'] };
        
        XLSX.utils.book_append_sheet(wb, ws1, "Data Tamu");
        
        const now = new Date();
        const fileName = `Laporan_Tamu_${now.toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showModal('success', `✅ Excel berhasil di-export!\n\n📊 ${dataToExport.length} data`);
    } catch (err) {
        console.error('Export Excel error:', err);
        showModal('error', 'Gagal export Excel: ' + err.message);
    } finally {
        if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
        showLoading(false);
    }
}

function getFilteredData() {
    let filtered = [...allGuests];
    
    if (currentUser.role === 'admin_utama' && currentFilter.seksi !== 'all') {
        filtered = filtered.filter(g => g.tujuan === currentFilter.seksi);
    }
    
    return filtered;
}

// ============================================
// LIGHTBOX & FILTER
// ============================================
function openLightbox(imageSrc, caption) {
    const lightbox = document.getElementById('photoLightbox');
    const img = document.getElementById('lightboxImage');
    const cap = document.getElementById('lightboxCaption');
    if (!lightbox || !img || !cap) return;
    img.src = imageSrc;
    cap.innerText = caption;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox(event) {
    if (event && event.target !== event.currentTarget && !event.target.classList.contains('lightbox-close')) return;
    const lightbox = document.getElementById('photoLightbox');
    if (lightbox) { lightbox.classList.add('hidden'); document.body.style.overflow = ''; }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeLightbox();
});

function populateYearOptions() {
    const yearSelect = document.getElementById('filterYear');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '<option value="">-- Pilih Tahun --</option>';
    for (let year = currentYear + 1; year >= 2024; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
}

function toggleFilterInputs() {
    const filterType = document.getElementById('filterType').value;
    const specificRow = document.getElementById('filterSpecificRow');
    const specificLabel = document.getElementById('filterSpecificLabel');
    if (!specificRow) return;
    
    document.getElementById('filterDate').style.display = 'none';
    document.getElementById('filterMonth').style.display = 'none';
    document.getElementById('filterYear').style.display = 'none';
    document.getElementById('filterRange').style.display = 'none';
    
    if (filterType === 'specific_date') {
        specificRow.style.display = 'flex'; specificLabel.innerText = '📅 Pilih Tanggal:'; document.getElementById('filterDate').style.display = 'block';
    } else if (filterType === 'specific_month') {
        specificRow.style.display = 'flex'; specificLabel.innerText = '📅 Pilih Bulan:'; document.getElementById('filterMonth').style.display = 'block';
    } else if (filterType === 'specific_year') {
        specificRow.style.display = 'flex'; specificLabel.innerText = '📅 Pilih Tahun:'; document.getElementById('filterYear').style.display = 'block';
    } else if (filterType === 'range') {
        specificRow.style.display = 'flex'; specificLabel.innerText = '📅 Rentang Tanggal:'; document.getElementById('filterRange').style.display = 'flex';
    } else {
        specificRow.style.display = 'none';
    }
}

// 🚀 APPLY FILTER YANG CERDAS (Server-Side Filtering Utama)
async function applyFilter() {
    showLoading(true, "Menerapkan filter data...");
    
    const filterType = document.getElementById('filterType').value;
    const filterSeksi = document.getElementById('filterSeksi').value;
    currentFilter = { type: filterType, seksi: filterSeksi };
    
    const now = new Date();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    let summaryText = "";
    const fetchParams = {};
    
    if (filterType === 'today') {
        fetchParams.targetDate = now.toISOString().split('T')[0];
        summaryText = `Hari Ini (${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()})`;
    } else if (filterType === 'specific_date') {
        const selectedDate = document.getElementById('filterDate').value;
        if (!selectedDate) { showModal('error', 'Silakan pilih tanggal terlebih dahulu!'); showLoading(false); return; }
        fetchParams.targetDate = selectedDate;
        const selected = new Date(selectedDate);
        summaryText = `Hari Tertentu: ${selected.getDate()} ${months[selected.getMonth()]} ${selected.getFullYear()}`;
    } else if (filterType === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        fetchParams.startDate = weekAgo.toISOString().split('T')[0];
        fetchParams.endDate = now.toISOString().split('T')[0];
        summaryText = `Minggu Ini`;
    } else if (filterType === 'month') {
        fetchParams.month = now.getMonth() + 1;
        fetchParams.year = now.getFullYear();
        summaryText = `Bulan Ini: ${months[now.getMonth()]} ${now.getFullYear()}`;
    } else if (filterType === 'specific_month') {
        const val = document.getElementById('filterMonth').value;
        if (!val) { showModal('error', 'Silakan pilih bulan terlebih dahulu!'); showLoading(false); return; }
        const [y, m] = val.split('-').map(Number);
        fetchParams.month = m;
        fetchParams.year = y;
        summaryText = `Bulan Tertentu: ${months[m - 1]} ${y}`;
    } else if (filterType === 'year') {
        fetchParams.startDate = `${now.getFullYear()}-01-01`;
        fetchParams.endDate = `${now.getFullYear()}-12-31`;
        summaryText = `Tahun Ini (${now.getFullYear()})`;
    } else if (filterType === 'specific_year') {
        const selectedYear = parseInt(document.getElementById('filterYear').value);
        if (!selectedYear) { showModal('error', 'Silakan pilih tahun terlebih dahulu!'); showLoading(false); return; }
        fetchParams.startDate = `${selectedYear}-01-01`;
        fetchParams.endDate = `${selectedYear}-12-31`;
        summaryText = `Tahun Tertentu: ${selectedYear}`;
    } else if (filterType === 'range') {
        fetchParams.startDate = document.getElementById('filterDateFrom').value;
        fetchParams.endDate = document.getElementById('filterDateTo').value;
        if (!fetchParams.startDate || !fetchParams.endDate) { showModal('error', 'Silakan pilih rentang tanggal!'); showLoading(false); return; }
        const from = new Date(fetchParams.startDate);
        const to = new Date(fetchParams.endDate);
        to.setHours(23, 59, 59, 999);
        if (from > to) { showModal('error', 'Tanggal "Dari" tidak boleh lebih besar dari "Sampai"!'); showLoading(false); return; }
        summaryText = `Rentang: ${from.getDate()} ${months[from.getMonth()]} ${from.getFullYear()} s/d ${to.getDate()} ${months[to.getMonth()]} ${to.getFullYear()}`;
    } else if (filterType === 'all') {
        summaryText = "Semua Data";
    }
    
    // 🚀 Fetch data dari server berdasarkan parameter (Sangat Cepat!)
    await loadGuests(fetchParams, true);
    
    let filtered = [...allGuests];
    if (currentUser.role === 'admin_utama' && filterSeksi !== 'all') {
        filtered = filtered.filter(g => g.tujuan === filterSeksi);
        summaryText += ` | Seksi: ${filterSeksi}`;
    }
    
    renderGuestsTable(filtered);
    updateFilterSummary(summaryText);
    updatePrintHeaderForFilter(filterType, summaryText);
    
    setTimeout(() => showLoading(false), 300);
}

function resetFilter() {
    document.getElementById('filterType').value = 'month';
    document.getElementById('filterSeksi').value = 'all';
    toggleFilterInputs();
    currentFilter = { type: 'month', seksi: 'all' };
    
    applyFilter();
}

function updateFilterSummary(text) {
    const summary = document.getElementById('filterSummary');
    const summaryText = document.getElementById('filterSummaryText');
    if (!summary || !summaryText) return;
    if (text) { summaryText.innerText = text; summary.classList.add('active'); } 
    else { summary.classList.remove('active'); }
}

function updatePrintHeaderForFilter(filterType, summaryText) {
    const now = new Date();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    let periodText = filterType === 'all' ? `Laporan Keseluruhan - Dicetak: ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}` : summaryText;
    const printPeriod = document.getElementById('printPeriod');
    if (printPeriod) printPeriod.innerText = periodText;
}

function updatePrintHeader(filter) {
    const now = new Date();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    let periodText = "";
    if (filter === 'today') periodText = `Laporan Harian - Tanggal: ${now.getDate()}, Bulan: ${months[now.getMonth()]}, Tahun: ${now.getFullYear()}`;
    else if (filter === 'month') periodText = `Laporan Bulanan - Bulan: ${months[now.getMonth()]}, Tahun: ${now.getFullYear()}`;
    else periodText = `Laporan Keseluruhan - Dicetak pada: ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    
    const printPeriod = document.getElementById('printPeriod');
    if (printPeriod) printPeriod.innerText = periodText;
}

function printReport() {
    showLoading(true, "Menyiapkan dokumen cetak...");
    const filterSummaryText = document.getElementById('filterSummaryText');
    updatePrintHeaderForFilter(currentFilter.type, filterSummaryText ? filterSummaryText.innerText : 'Semua Data');
    setTimeout(() => { showLoading(false); window.print(); }, 800);
}

// ============================================
// USER MANAGEMENT
// ============================================
async function loadUsers() {
    showLoading(true, "Mengambil data user...");
    try {
        const res = await fetch(`${API_URL}?action=getUsers`);
        const data = await res.json();
        allUsers = data.users || [];
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        allUsers.forEach((u, index) => {
            tbody.innerHTML += `
                <tr class="animate-fade-in" style="animation-delay: ${index * 0.05}s">
                    <td>${u.username}</td>
                    <td>${u.role === 'admin_utama' ? 'Admin Utama' : 'Admin Seksi'}</td>
                    <td>${u.seksi || '-'}</td>
                    <td>
                        <button class="btn-sm btn-secondary" onclick="editUser('${u.username}')">✏️ Edit</button>
                        <button class="btn-sm btn-danger" onclick="deleteUser('${u.username}')">🗑️ Hapus</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Error loading users:', err);
        showModal('error', 'Gagal memuat data user');
    } finally {
        showLoading(false);
    }
}

function editUser(username) {
    const user = allUsers.find(u => u.username === username);
    if (user) showUserModal(user);
    else showModal('error', 'Data user tidak ditemukan');
}

function showUserModal(user = null) {
    const modal = document.getElementById('userModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('animate-fade-in');
    
    if (user) {
        document.getElementById('userModalTitle').innerText = 'Edit User';
        document.getElementById('editUsername').value = user.username;
        document.getElementById('newUsername').value = user.username;
        document.getElementById('newUsername').readOnly = true;
        document.getElementById('newPassword').value = '';
        document.getElementById('newRole').value = user.role;
        document.getElementById('newSeksi').value = user.seksi || '';
        toggleSeksiInput();
    } else {
        document.getElementById('userModalTitle').innerText = 'Tambah User';
        document.getElementById('editUsername').value = '';
        document.getElementById('newUsername').value = '';
        document.getElementById('newUsername').readOnly = false;
        document.getElementById('newPassword').value = '';
        document.getElementById('newRole').value = 'admin_utama';
        toggleSeksiInput();
    }
}

function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (modal) modal.classList.add('hidden');
}

function toggleSeksiInput() {
    const role = document.getElementById('newRole').value;
    const seksiInputGroup = document.getElementById('seksiInputGroup');
    if (!seksiInputGroup) return;
    if (role === 'admin_seksi') {
        seksiInputGroup.classList.remove('hidden');
        seksiInputGroup.classList.add('animate-fade-in');
    } else {
        seksiInputGroup.classList.add('hidden');
    }
}

async function saveUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const seksi = role === 'admin_seksi' ? document.getElementById('newSeksi').value : '';
    const editUsername = document.getElementById('editUsername').value;

    if (!username || (!editUsername && !password)) {
        showModal('error', 'Username dan Password wajib diisi!');
        return;
    }

    showLoading(true, "Menyimpan data user...");
    try {
        const payload = { action: editUsername ? 'updateUser' : 'addUser', username, password, role, seksi, editUsername };
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
            showModal('success', 'User berhasil disimpan!');
            closeUserModal();
            loadUsers();
        } else {
            showModal('error', result.message || 'Gagal menyimpan user');
        }
    } catch (err) {
        console.error('Error saving user:', err);
        showModal('error', 'Gagal menyimpan data user');
    } finally {
        showLoading(false);
    }
}

async function deleteUser(username) {
    if (!confirm(`🗑️ Yakin ingin menghapus user "${username}"?`)) return;
    showLoading(true, "Menghapus data user...");
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteUser', username }) });
        const result = await res.json();
        if (result.status === 'success') {
            showModal('success', 'User berhasil dihapus!');
            loadUsers();
        } else {
            showModal('error', result.message || 'Gagal menghapus user');
        }
    } catch (err) {
        console.error('Error deleting user:', err);
        showModal('error', 'Gagal menghapus data user');
    } finally {
        showLoading(false);
    }
}

// ============================================
// 🆕 PENGATURAN: UPLOAD BACKGROUND DARI LAPTOP (DENGAN CACHE BUSTER)
// ============================================
async function saveBackgroundImage() {
    const fileInput = document.getElementById('bgFileInput');
    const file = fileInput.files[0];

    if (!file) {
        showModal('error', 'Silakan pilih file gambar terlebih dahulu!');
        return;
    }

    // Batasi ukuran file maksimal 5MB untuk mencegah timeout Google Apps Script
    if (file.size > 5 * 1024 * 1024) {
        showModal('error', 'Ukuran file terlalu besar! Maksimal 5MB.');
        return;
    }

    showLoading(true, "Sedang mengupload gambar ke Google Drive...");

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result;
        
        // Buat nama file unik agar tidak menimpa file lama
        const extension = file.name.split('.').pop();
        const uniqueFileName = `bg_dashboard_${new Date().getTime()}.${extension}`;
        
        const payload = {
            action: 'uploadBackground',
            base64Data: base64Data,
            fileName: uniqueFileName
        };

        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await res.json();

            if (result.status === 'success') {
                // 🔥 PERBAIKAN KRUSIAL: Tambahkan timestamp (cache buster) ke URL
                // Ini memaksa browser mengunduh gambar baru, bukan menggunakan cache lama yang "Access Denied"
                const cacheBuster = new Date().getTime();
                const finalUrl = `${result.url}?t=${cacheBuster}`;
                
                // Langsung update variabel CSS agar perubahan terlihat instan
                document.documentElement.style.setProperty('--bg-image', `url('${finalUrl}')`);
                
                showModal('success', '✅ ' + result.message + '\n\n💡 Catatan: Jika background masih tidak muncul, pastikan Anda telah membuka Google Drive, klik kanan pada file gambar tersebut, pilih "Bagikan", dan ubah aksesnya menjadi "Siapa saja yang memiliki link".');
                fileInput.value = ''; // Reset input file
            } else {
                showModal('error', result.message || 'Gagal menyimpan pengaturan');
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            showModal('error', 'Gagal terhubung ke server saat upload.');
        } finally {
            showLoading(false);
        }
    };
    
    // Mulai proses pembacaan file menjadi Base64
    reader.readAsDataURL(file);
}

// ============================================
// UTILITIES
// ============================================
function togglePassword() {
    const input = document.getElementById('password');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function showLoading(show, text = "Loading / Mengambil data...") {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) return;
    const textEl = loadingOverlay.querySelector('.loading-text');
    if (textEl) textEl.innerText = text;
    if (show) loadingOverlay.classList.remove('hidden');
    else loadingOverlay.classList.add('hidden');
}

function showModal(type, message) {
    const modal = document.getElementById('notificationModal');
    if (!modal) return;
    modal.className = `modal ${type} animate-fade-in`;
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    if (modalTitle) {
        if (type === 'success') modalTitle.innerText = '✅ Berhasil';
        else if (type === 'error') modalTitle.innerText = '❌ Gagal';
        else if (type === 'info') modalTitle.innerText = 'ℹ️ Informasi';
        else modalTitle.innerText = 'Notifikasi';
    }
    if (modalMessage) modalMessage.innerText = message;
    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) modal.classList.add('hidden');
}

window.addEventListener('beforeunload', () => {
    stopIdleMonitoring();
    stopStatsAutoRefresh();
});
