const API_URL = 'https://script.google.com/macros/s/AKfycbwnT4kw4BC60Mu1Bve525ARoilh-6I5aGdDFGOXVRMb1ypzxhROah2_ojrP2gqpWRw1/exec';
let currentUser = null;
let allGuests = [];
let allUsers = [];
let currentFilter = { type: 'all', seksi: 'all' };

// === VARIABEL IDLE MONITORING ===
let idleTimer = null;
let countdownTimer = null;
let countdownValue = 30;
const IDLE_TIMEOUT = 120000; // 2 menit = 120.000 ms
const WARNING_BEFORE = 30000; // Warning muncul 30 detik sebelum logout
let lastActivityTime = Date.now();
let mouseMoveThrottle = null;

// 🆕 VARIABEL AUTO-REFRESH
let statsRefreshInterval = null;
const STATS_REFRESH_INTERVAL = 60000; // Refresh statistik setiap 60 detik

// === INISIALISASI ===
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    const savedUser = localStorage.getItem('etamu_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
    
    // Inisialisasi Filter
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

// 🆕 FUNGSI UPDATE DATETIME DENGAN ANIMASI
function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    };
    const el = document.getElementById('currentDateTime');
    if (el) {
        el.innerText = now.toLocaleDateString('id-ID', options);
        
        // 🆕 Trigger animasi pulse setiap detik
        el.classList.remove('animate-pulse-once');
        void el.offsetWidth; // Force reflow untuk restart animasi
        el.classList.add('animate-pulse-once');
    }
}

function toggleMobileMenu() {
    const navTabs = document.getElementById('mobileNavTabs');
    if (navTabs) {
        navTabs.classList.toggle('active');
    }
}

// === LOGIN ===
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true, "Memverifikasi kredensial...");
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            currentUser = data.user;
            localStorage.setItem('etamu_user', JSON.stringify(currentUser));
            
            // 🆕 Animasi sukses sebelum masuk dashboard
            showModal('success', `Selamat datang, ${currentUser.username}!`);
            setTimeout(() => {
                closeModal();
                showDashboard();
            }, 1000);
        } else {
            showModal('error', 'Username atau password salah!');
        }
    } catch (err) {
        console.error('Login error:', err);
        showModal('error', 'Gagal terhubung ke server. Periksa koneksi internet Anda.');
    } finally {
        showLoading(false);
    }
});

// === DASHBOARD ===
function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    // 🆕 Trigger animasi header saat dashboard muncul
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
    
    loadStats();
    loadGuests();
    if (currentUser.role === 'admin_utama') loadUsers();

    // Mulai monitoring idle
    startIdleMonitoring();
    
    // 🆕 Mulai auto-refresh statistik
    startStatsAutoRefresh();
}

// 🆕 AUTO-REFRESH STATISTIK
function startStatsAutoRefresh() {
    if (statsRefreshInterval) {
        clearInterval(statsRefreshInterval);
    }
    
    statsRefreshInterval = setInterval(() => {
        // Hanya refresh jika tab statistik yang aktif
        const statsTab = document.getElementById('tab-stats');
        if (statsTab && !statsTab.classList.contains('hidden')) {
            loadStatsSilent(); // Refresh tanpa loading overlay
        }
    }, STATS_REFRESH_INTERVAL);
}

function stopStatsAutoRefresh() {
    if (statsRefreshInterval) {
        clearInterval(statsRefreshInterval);
        statsRefreshInterval = null;
    }
}

// 🆕 LOAD STATS TANPA LOADING OVERLAY (untuk auto-refresh)
async function loadStatsSilent() {
    try {
        const res = await fetch(`${API_URL}?action=getDetailedStats&role=${currentUser.role}&seksi=${currentUser.seksi || ''}`);
        const data = await res.json();
        
        if (data.status !== 'success') return;
        
        // Update hanya angka-angka tanpa animasi ulang
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
            // 🆕 Animasi flash saat nilai berubah
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
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    
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
    
    idleTimer = setTimeout(() => {
        showIdleWarning();
    }, IDLE_TIMEOUT - WARNING_BEFORE);
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
        
        if (countdownValue <= 0) {
            performIdleLogout();
        }
    }, 1000);
}

function hideIdleWarning() {
    const modal = document.getElementById('idleWarningModal');
    if (modal) modal.classList.add('hidden');
    
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    
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

// 🆕 LOGOUT DENGAN KONFIRMASI
function logout() {
    if (!confirm('🚪 Apakah Anda yakin ingin logout?')) {
        return;
    }
    
    stopIdleMonitoring();
    stopStatsAutoRefresh();
    showLoading(true, "Logging out...");
    
    setTimeout(() => {
        localStorage.removeItem('etamu_user');
        showLoading(false);
        location.reload();
    }, 500);
}

function switchTab(tabName, btnElement) {
    const mobileNavTabs = document.getElementById('mobileNavTabs');
    if (mobileNavTabs) mobileNavTabs.classList.remove('active');
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
        target.classList.remove('hidden');
        // 🆕 Animasi masuk yang lebih halus
        target.classList.remove('animate-fade-in');
        void target.offsetWidth; // Force reflow
        target.classList.add('animate-fade-in');
    }
    
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    
    // Load data sesuai tab
    if (tabName === 'guests') loadGuests();
    if (tabName === 'stats') loadStats();
    if (tabName === 'users') loadUsers();
}

// ============================================
// STATISTIK DETAIL LENGKAP (getDetailedStats)
// ============================================

async function loadStats() {
    showLoading(true, "Mengambil data statistik lengkap...");
    try {
        const res = await fetch(`${API_URL}?action=getDetailedStats&role=${currentUser.role}&seksi=${currentUser.seksi || ''}`);
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

// 🆕 FUNGSI TERPISAH UNTUK RENDER STATS (bisa digunakan ulang)
function renderStatsDashboard(data) {
    // === Section 1: 4 Kartu Statistik Utama ===
    const grid = document.getElementById('statsGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="stat-card animate-slide-up">
                <div class="stat-icon">📅</div>
                <h3>${data.today}</h3>
                <p>Tamu Hari Ini</p>
            </div>
            <div class="stat-card gold animate-slide-up" style="animation-delay: 0.1s;">
                <div class="stat-icon">👥</div>
                <h3>${data.total}</h3>
                <p>Total Keseluruhan Tamu</p>
            </div>
            <div class="stat-card blue animate-slide-up" style="animation-delay: 0.2s;">
                <div class="stat-icon">📊</div>
                <h3>${data.averagePerDay}</h3>
                <p>Rata-rata Tamu/Hari</p>
            </div>
            <div class="stat-card purple animate-slide-up" style="animation-delay: 0.3s;">
                <div class="stat-icon">📆</div>
                <h3>${data.thisMonth}</h3>
                <p>Tamu Bulan Ini</p>
            </div>
        `;
    }
    
    // === Section 2: Perbandingan Periode ===
    const comparisonGrid = document.getElementById('comparisonGrid');
    if (comparisonGrid) {
        const dailyTrend = calculateTrend(data.today, data.yesterday);
        const weeklyTrend = calculateTrend(data.thisWeek, data.lastWeek);
        
        comparisonGrid.innerHTML = `
            <div class="comparison-card animate-fade-in">
                <div class="comparison-title">📅 Harian</div>
                <div class="comparison-values">
                    <div>
                        <div class="comparison-current">${data.today}</div>
                        <div class="comparison-previous">Hari ini</div>
                    </div>
                    <div style="text-align: right;">
                        <div class="comparison-previous" style="font-size: 1.2rem; font-weight: bold;">${data.yesterday}</div>
                        <div class="comparison-previous">Kemarin</div>
                    </div>
                </div>
                <div class="comparison-trend ${dailyTrend.class}">
                    ${dailyTrend.icon} ${dailyTrend.text}
                </div>
            </div>
            
            <div class="comparison-card animate-fade-in" style="animation-delay: 0.1s;">
                <div class="comparison-title">📆 Mingguan</div>
                <div class="comparison-values">
                    <div>
                        <div class="comparison-current">${data.thisWeek}</div>
                        <div class="comparison-previous">Minggu ini</div>
                    </div>
                    <div style="text-align: right;">
                        <div class="comparison-previous" style="font-size: 1.2rem; font-weight: bold;">${data.lastWeek}</div>
                        <div class="comparison-previous">Minggu lalu</div>
                    </div>
                </div>
                <div class="comparison-trend ${weeklyTrend.class}">
                    ${weeklyTrend.icon} ${weeklyTrend.text}
                </div>
            </div>
            
            <div class="comparison-card animate-fade-in" style="animation-delay: 0.2s;">
                <div class="comparison-title">🗓️ Bulanan</div>
                <div class="comparison-values">
                    <div>
                        <div class="comparison-current">${data.thisMonth}</div>
                        <div class="comparison-previous">Bulan ini</div>
                    </div>
                </div>
                <div style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">
                    Total tamu pada bulan berjalan
                </div>
            </div>
        `;
    }
    
    // === Section 3: Breakdown Asal Tamu (Admin Utama Only) ===
    const asalSection = document.getElementById('asalBreakdownSection');
    if (currentUser.role === 'admin_utama' && asalSection) {
        asalSection.classList.remove('hidden');
        const asalBreakdown = document.getElementById('asalBreakdown');
        if (asalBreakdown) {
            const totalAsal = data.instansiCount + data.umumCount;
            const instansiPercent = totalAsal > 0 ? ((data.instansiCount / totalAsal) * 100).toFixed(1) : 0;
            const umumPercent = totalAsal > 0 ? ((data.umumCount / totalAsal) * 100).toFixed(1) : 0;
            
            asalBreakdown.innerHTML = `
                <div class="asal-card animate-slide-up">
                    <div class="asal-icon">🏢</div>
                    <div class="asal-count">${data.instansiCount}</div>
                    <div class="asal-label">Dari Instansi</div>
                    <div class="asal-percent">${instansiPercent}%</div>
                </div>
                <div class="asal-card umum animate-slide-up" style="animation-delay: 0.1s;">
                    <div class="asal-icon">👤</div>
                    <div class="asal-count">${data.umumCount}</div>
                    <div class="asal-label">Dari Umum</div>
                    <div class="asal-percent">${umumPercent}%</div>
                </div>
            `;
        }
    } else if (asalSection) {
        asalSection.classList.add('hidden');
    }
    
    // === Section 4: Top 5 Seksi Teramai (Admin Utama Only) ===
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
                        <div class="top-seksi-bar">
                            <div class="top-seksi-bar-fill" style="width: ${item.percentage}%;"></div>
                        </div>
                        <div class="top-seksi-percent">${item.percentage}% dari total tamu</div>
                    </div>
                    <div class="top-seksi-count">${item.count}</div>
                </div>
            `).join('');
        }
    } else if (topSeksiSection) {
        topSeksiSection.classList.add('hidden');
    }
    
    // === Section 5: Detail Lengkap per Seksi (Admin Utama Only) ===
    const sectionStats = document.getElementById('sectionStats');
    if (currentUser.role === 'admin_utama' && data.perSeksi && Object.keys(data.perSeksi).length > 0 && sectionStats) {
        sectionStats.classList.remove('hidden');
        const tbody = document.querySelector('#sectionStatsTable tbody');
        if (tbody) {
            tbody.innerHTML = '';
            
            const sortedSeksi = Object.entries(data.perSeksi)
                .sort((a, b) => b[1].count - a[1].count);
            
            let delay = 0;
            sortedSeksi.forEach(([seksi, stats], index) => {
                tbody.innerHTML += `
                    <tr class="animate-fade-in" style="animation-delay: ${delay}s">
                        <td style="text-align: center;">${index + 1}</td>
                        <td><strong>${seksi}</strong></td>
                        <td style="text-align: center; font-weight: bold; color: var(--kemenag-green);">${stats.count}</td>
                        <td style="text-align: center;">${stats.percentage}%</td>
                        <td>
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill" style="width: ${stats.percentage}%;">
                                    ${stats.percentage}%
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
                delay += 0.05;
            });
        }
    } else if (currentUser.role === 'admin_utama' && sectionStats) {
        sectionStats.classList.remove('hidden');
        const tbody = document.querySelector('#sectionStatsTable tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #9ca3af;">
                        <div class="empty-stats-icon">📊</div>
                        Belum ada data tamu
                    </td>
                </tr>
            `;
        }
    } else if (sectionStats) {
        sectionStats.classList.add('hidden');
    }
}

// Helper: Hitung trend perbandingan
function calculateTrend(current, previous) {
    if (previous === 0) {
        if (current > 0) {
            return {
                class: 'trend-up',
                icon: '📈',
                text: `+${current} dari kemarin`
            };
        }
        return {
            class: 'trend-neutral',
            icon: '➖',
            text: 'Tidak ada perubahan'
        };
    }
    
    const change = ((current - previous) / previous) * 100;
    
    if (change > 0) {
        return {
            class: 'trend-up',
            icon: '📈',
            text: `+${change.toFixed(1)}% dari periode lalu`
        };
    } else if (change < 0) {
        return {
            class: 'trend-down',
            icon: '📉',
            text: `${change.toFixed(1)}% dari periode lalu`
        };
    } else {
        return {
            class: 'trend-neutral',
            icon: '➖',
            text: 'Tidak ada perubahan'
        };
    }
}

// ============================================
// DATA TAMU
// ============================================

async function loadGuests() {
    showLoading(true, "Mengambil data tamu...");
    try {
        const res = await fetch(`${API_URL}?action=getGuests&role=${currentUser.role}&seksi=${currentUser.seksi || ''}`);
        const data = await res.json();
        allGuests = data.guests || [];
        renderGuestsTable(allGuests);
        
        if (currentUser.role === 'admin_utama') {
            const filterSeksiRow = document.getElementById('filterSeksiRow');
            if (filterSeksiRow) filterSeksiRow.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error loading guests:', err);
        showModal('error', 'Gagal memuat data tamu');
    } finally {
        showLoading(false);
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
    
    guests.forEach((g, index) => {
        const date = new Date(g.timestamp).toLocaleString('id-ID');
        
        let photoCell = '';
        if (g.fotoSelfie && g.fotoSelfie !== 'Tidak ada foto' && g.fotoSelfie.startsWith('data:image')) {
            photoCell = `
                <td class="no-print" style="text-align: center;">
                    <img src="${g.fotoSelfie}" alt="Foto ${g.nama}" class="photo-thumbnail" 
                         onclick="openLightbox('${g.fotoSelfie}', '${g.nama} - ${date}')">
                </td>
            `;
        } else {
            photoCell = `
                <td class="no-print" style="text-align: center;">
                    <div class="no-photo" title="Tidak ada foto">📷</div>
                </td>
            `;
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
// LIGHTBOX
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
    if (event && event.target !== event.currentTarget && !event.target.classList.contains('lightbox-close')) {
        return;
    }
    
    const lightbox = document.getElementById('photoLightbox');
    if (lightbox) {
        lightbox.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeLightbox();
    }
});

// ============================================
// FILTER FUNCTIONS
// ============================================

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
        specificRow.style.display = 'flex';
        specificLabel.innerText = '📅 Pilih Tanggal:';
        document.getElementById('filterDate').style.display = 'block';
    } else if (filterType === 'specific_month') {
        specificRow.style.display = 'flex';
        specificLabel.innerText = '📅 Pilih Bulan:';
        document.getElementById('filterMonth').style.display = 'block';
    } else if (filterType === 'specific_year') {
        specificRow.style.display = 'flex';
        specificLabel.innerText = '📅 Pilih Tahun:';
        document.getElementById('filterYear').style.display = 'block';
    } else if (filterType === 'range') {
        specificRow.style.display = 'flex';
        specificLabel.innerText = '📅 Rentang Tanggal:';
        document.getElementById('filterRange').style.display = 'flex';
    } else {
        specificRow.style.display = 'none';
    }
}

function applyFilter() {
    showLoading(true, "Menerapkan filter data...");
    
    const filterType = document.getElementById('filterType').value;
    const filterSeksi = document.getElementById('filterSeksi').value;
    
    currentFilter = {
        type: filterType,
        seksi: filterSeksi
    };
    
    let filtered = [...allGuests];
    const now = new Date();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", 
                    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    let summaryText = "";
    
    if (filterType === 'today') {
        filtered = filtered.filter(g => new Date(g.timestamp).toDateString() === now.toDateString());
        summaryText = `Hari Ini (${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()})`;
    } 
    else if (filterType === 'specific_date') {
        const selectedDate = document.getElementById('filterDate').value;
        if (!selectedDate) {
            showModal('error', 'Silakan pilih tanggal terlebih dahulu!');
            showLoading(false);
            return;
        }
        const selected = new Date(selectedDate);
        filtered = filtered.filter(g => {
            const gDate = new Date(g.timestamp);
            return gDate.toDateString() === selected.toDateString();
        });
        summaryText = `Hari Tertentu: ${selected.getDate()} ${months[selected.getMonth()]} ${selected.getFullYear()}`;
    } 
    else if (filterType === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(g => new Date(g.timestamp) >= weekAgo);
        summaryText = `Minggu Ini (${weekAgo.getDate()} ${months[weekAgo.getMonth()]} s/d ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()})`;
    } 
    else if (filterType === 'month') {
        filtered = filtered.filter(g => {
            const gDate = new Date(g.timestamp);
            return gDate.getMonth() === now.getMonth() && gDate.getFullYear() === now.getFullYear();
        });
        summaryText = `Bulan Ini (${months[now.getMonth()]} ${now.getFullYear()})`;
    } 
    else if (filterType === 'specific_month') {
        const selectedMonth = document.getElementById('filterMonth').value;
        if (!selectedMonth) {
            showModal('error', 'Silakan pilih bulan terlebih dahulu!');
            showLoading(false);
            return;
        }
        const [year, month] = selectedMonth.split('-').map(Number);
        filtered = filtered.filter(g => {
            const gDate = new Date(g.timestamp);
            return gDate.getMonth() === (month - 1) && gDate.getFullYear() === year;
        });
        summaryText = `Bulan Tertentu: ${months[month - 1]} ${year}`;
    } 
    else if (filterType === 'year') {
        filtered = filtered.filter(g => new Date(g.timestamp).getFullYear() === now.getFullYear());
        summaryText = `Tahun Ini (${now.getFullYear()})`;
    } 
    else if (filterType === 'specific_year') {
        const selectedYear = parseInt(document.getElementById('filterYear').value);
        if (!selectedYear) {
            showModal('error', 'Silakan pilih tahun terlebih dahulu!');
            showLoading(false);
            return;
        }
        filtered = filtered.filter(g => new Date(g.timestamp).getFullYear() === selectedYear);
        summaryText = `Tahun Tertentu: ${selectedYear}`;
    } 
    else if (filterType === 'range') {
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        
        if (!dateFrom || !dateTo) {
            showModal('error', 'Silakan pilih rentang tanggal (dari dan sampai)!');
            showLoading(false);
            return;
        }
        
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        
        if (from > to) {
            showModal('error', 'Tanggal "Dari" tidak boleh lebih besar dari "Sampai"!');
            showLoading(false);
            return;
        }
        
        filtered = filtered.filter(g => {
            const gDate = new Date(g.timestamp);
            return gDate >= from && gDate <= to;
        });
        summaryText = `Rentang: ${from.getDate()} ${months[from.getMonth()]} ${from.getFullYear()} s/d ${to.getDate()} ${months[to.getMonth()]} ${to.getFullYear()}`;
    } 
    else {
        summaryText = "Semua Data";
    }
    
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
    document.getElementById('filterType').value = 'all';
    document.getElementById('filterSeksi').value = 'all';
    toggleFilterInputs();
    
    currentFilter = { type: 'all', seksi: 'all' };
    
    renderGuestsTable(allGuests);
    updateFilterSummary('');
    updatePrintHeader('all');
}

function updateFilterSummary(text) {
    const summary = document.getElementById('filterSummary');
    const summaryText = document.getElementById('filterSummaryText');
    
    if (!summary || !summaryText) return;
    
    if (text) {
        summaryText.innerText = text;
        summary.classList.add('active');
    } else {
        summary.classList.remove('active');
    }
}

function updatePrintHeaderForFilter(filterType, summaryText) {
    const now = new Date();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", 
                    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    let periodText = "";
    
    if (filterType === 'all') {
        periodText = `Laporan Keseluruhan - Dicetak: ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    } else {
        periodText = summaryText;
    }
    
    const printPeriod = document.getElementById('printPeriod');
    if (printPeriod) printPeriod.innerText = periodText;
}

function updatePrintHeader(filter) {
    const now = new Date();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    let periodText = "";

    if (filter === 'today') {
        periodText = `Laporan Harian - Tanggal: ${now.getDate()}, Bulan: ${months[now.getMonth()]}, Tahun: ${now.getFullYear()}`;
    } else if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodText = `Laporan Mingguan - Periode: ${weekAgo.getDate()} ${months[weekAgo.getMonth()]} s/d ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    } else if (filter === 'month') {
        periodText = `Laporan Bulanan - Bulan: ${months[now.getMonth()]}, Tahun: ${now.getFullYear()}`;
    } else if (filter === 'year') {
        periodText = `Laporan Tahunan - Tahun: ${now.getFullYear()}`;
    } else {
        periodText = `Laporan Keseluruhan - Dicetak pada: ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    const printPeriod = document.getElementById('printPeriod');
    if (printPeriod) printPeriod.innerText = periodText;
}

function printReport() {
    showLoading(true, "Menyiapkan dokumen cetak...");
    
    const filterSummaryText = document.getElementById('filterSummaryText');
    updatePrintHeaderForFilter(currentFilter.type, filterSummaryText ? filterSummaryText.innerText : 'Semua Data');
    
    setTimeout(() => {
        showLoading(false);
        window.print();
    }, 800);
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

async function saveSettings() {
    const bgUrl = document.getElementById('bgUrlInput').value.trim();
    if (!bgUrl) {
        showModal('error', 'URL Background tidak boleh kosong');
        return;
    }
    
    // Validasi URL
    try {
        new URL(bgUrl);
    } catch (err) {
        showModal('error', 'URL tidak valid. Pastikan format URL benar (https://...)');
        return;
    }
    
    showLoading(true, "Menyimpan pengaturan...");
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveSetting', key: 'bg_image', value: bgUrl }) });
        const result = await res.json();
        
        if (result.status === 'success') {
            document.documentElement.style.setProperty('--bg-image', `url('${bgUrl}')`);
            showModal('success', '✅ Pengaturan background berhasil disimpan!');
        } else {
            showModal('error', result.message || 'Gagal menyimpan pengaturan');
        }
    } catch (err) {
        console.error('Error saving settings:', err);
        showModal('error', 'Gagal menyimpan pengaturan');
    } finally {
        showLoading(false);
    }
}

// ============================================
// UTILITIES
// ============================================

function togglePassword() {
    const input = document.getElementById('password');
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

function showLoading(show, text = "Loading / Mengambil data...") {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) return;
    
    const textEl = loadingOverlay.querySelector('.loading-text');
    if (textEl) textEl.innerText = text;
    
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
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

// 🆕 CLEANUP saat halaman ditutup
window.addEventListener('beforeunload', () => {
    stopIdleMonitoring();
    stopStatsAutoRefresh();
});
