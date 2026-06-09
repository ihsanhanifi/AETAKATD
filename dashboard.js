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

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const el = document.getElementById('currentDateTime');
    if (el) el.innerText = now.toLocaleDateString('id-ID', options);
}

function toggleMobileMenu() {
    document.getElementById('mobileNavTabs').classList.toggle('active');
}

// === LOGIN ===
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true, "Memverifikasi kredensial...");
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}?action=login&username=${username}&password=${password}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            currentUser = data.user;
            localStorage.setItem('etamu_user', JSON.stringify(currentUser));
            showDashboard();
        } else {
            showModal('error', 'Username atau password salah!');
        }
    } catch (err) {
        showModal('error', 'Gagal terhubung ke server.');
    } finally {
        showLoading(false);
    }
});

// === DASHBOARD ===
function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('userInfo').innerText = `${currentUser.username} (${currentUser.role === 'admin_utama' ? 'Admin Utama' : 'Admin Seksi: ' + currentUser.seksi})`;
    
    if (currentUser.role === 'admin_utama') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.getElementById('guestTableTitle').innerText = 'Daftar Seluruh Tamu';
        document.getElementById('printTitle').innerText = 'Laporan Data Tamu Kementerian Agama Kab. Tanah Datar';
    } else {
        document.getElementById('guestTableTitle').innerText = `Daftar Tamu Seksi: ${currentUser.seksi}`;
        document.getElementById('printTitle').innerText = `Laporan Data Tamu Seksi ${currentUser.seksi}`;
    }
    
    loadStats();
    loadGuests();
    if (currentUser.role === 'admin_utama') loadUsers();

    // 🆕 MULAI MONITORING IDLE
    startIdleMonitoring();
}

// === IDLE MONITORING (AUTO LOGOUT) ===
function startIdleMonitoring() {
    resetIdleTimer();
    
    // Event listener untuk semua jenis aktivitas user
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    
    // Throttle mousemove agar tidak terlalu sering (500ms)
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
    
    // Jika modal warning sedang muncul, sembunyikan dan batalkan countdown
    const idleModal = document.getElementById('idleWarningModal');
    if (!idleModal.classList.contains('hidden')) {
        hideIdleWarning();
    }
    
    // Reset timer utama
    if (idleTimer) clearTimeout(idleTimer);
    
    idleTimer = setTimeout(() => {
        showIdleWarning();
    }, IDLE_TIMEOUT - WARNING_BEFORE); // Warning muncul 30 detik sebelum timeout
}

function showIdleWarning() {
    const modal = document.getElementById('idleWarningModal');
    modal.classList.remove('hidden');
    modal.classList.add('animate-fade-in');
    
    countdownValue = WARNING_BEFORE / 1000; // 30 detik
    const countdownEl = document.getElementById('idleCountdown');
    countdownEl.innerText = countdownValue;
    
    // Mulai countdown
    countdownTimer = setInterval(() => {
        countdownValue--;
        countdownEl.innerText = countdownValue;
        
        if (countdownValue <= 0) {
            performIdleLogout();
        }
    }, 1000);
}

function hideIdleWarning() {
    const modal = document.getElementById('idleWarningModal');
    modal.classList.add('hidden');
    
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    
    // Mulai timer baru
    resetIdleTimer();
}

function continueSession() {
    hideIdleWarning();
    showModal('success', 'Sesi dilanjutkan. Anda masih login.');
}

function performIdleLogout() {
    stopIdleMonitoring();
    
    const modal = document.getElementById('idleWarningModal');
    modal.classList.add('hidden');
    
    // Tampilkan modal info logout
    showLoading(true, "Mengakhiri sesi karena tidak aktif...");
    
    setTimeout(() => {
        showLoading(false);
        localStorage.removeItem('etamu_user');
        
        // Tampilkan pesan logout
        showModal('success', 'Sesi Anda telah berakhir karena tidak aktif. Silakan login kembali.');
        
        // Redirect ke halaman login setelah modal ditutup
        setTimeout(() => {
            currentUser = null;
            document.getElementById('dashboardSection').classList.add('hidden');
            document.getElementById('loginSection').classList.remove('hidden');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        }, 500);
    }, 1000);
}

function logout() {

    stopIdleMonitoring(); // 🆕 Hentikan monitoring
    
    showLoading(true, "Logging out...");
    setTimeout(() => {
        localStorage.removeItem('etamu_user');
        location.reload();
    }, 500);
}

function switchTab(tabName, btnElement) {
    document.getElementById('mobileNavTabs').classList.remove('active');
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabName}`);
    target.classList.remove('hidden');
    target.classList.add('animate-fade-in');
    
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    
    if (tabName === 'guests') loadGuests();
    if (tabName === 'stats') loadStats();
    if (tabName === 'users') loadUsers();
}

// === STATISTIK ===
async function loadStats() {
    showLoading(true, "Mengambil data statistik...");
    try {
        const res = await fetch(`${API_URL}?action=getStats&role=${currentUser.role}&seksi=${currentUser.seksi || ''}`);
        const data = await res.json();
        
        const grid = document.getElementById('statsGrid');
        grid.innerHTML = `
            <div class="stat-card animate-slide-up"><h3>${data.today}</h3><p>Tamu Hari Ini</p></div>
            <div class="stat-card animate-slide-up" style="animation-delay: 0.1s;"><h3>${data.total}</h3><p>Total Keseluruhan Tamu</p></div>
        `;
        
        if (currentUser.role === 'admin_utama' && data.perSeksi) {
            document.getElementById('sectionStats').classList.remove('hidden');
            const tbody = document.querySelector('#sectionStatsTable tbody');
            tbody.innerHTML = '';
            let delay = 0;
            for (const [seksi, count] of Object.entries(data.perSeksi)) {
                tbody.innerHTML += `<tr class="animate-fade-in" style="animation-delay: ${delay}s"><td>${seksi}</td><td>${count}</td></tr>`;
                delay += 0.05;
            }
        } else {
            document.getElementById('sectionStats').classList.add('hidden');
        }
    } catch (err) {
        showModal('error', 'Gagal memuat statistik');
    } finally {
        showLoading(false);
    }
}

// === DATA TAMU ===
async function loadGuests() {
    showLoading(true, "Mengambil data tamu...");
    try {
        const res = await fetch(`${API_URL}?action=getGuests&role=${currentUser.role}&seksi=${currentUser.seksi || ''}`);
        const data = await res.json();
        allGuests = data.guests || [];
        renderGuestsTable(allGuests);
        
        // Tampilkan filter seksi hanya untuk admin utama
        if (currentUser.role === 'admin_utama') {
            const filterSeksiRow = document.getElementById('filterSeksiRow');
            if (filterSeksiRow) filterSeksiRow.classList.remove('hidden');
        }
    } catch (err) {
        showModal('error', 'Gagal memuat data tamu');
    } finally {
        showLoading(false);
    }
}

function renderGuestsTable(guests) {
    const tbody = document.querySelector('#guestsTable tbody');
    tbody.innerHTML = '';
    
    if (guests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">Belum ada data tamu pada periode ini.</td></tr>';
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
                <td>${g.tujuan}</td>
                <td>${g.keperluan}</td>
                <td>${g.noHp}</td>
                ${photoCell}
            </tr>
        `;
    });
}

// === LIGHTBOX ===
function openLightbox(imageSrc, caption) {
    const lightbox = document.getElementById('photoLightbox');
    const img = document.getElementById('lightboxImage');
    const cap = document.getElementById('lightboxCaption');
    
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
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeLightbox();
    }
});

// === FILTER FUNCTIONS (BARU) ===
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
    
    // Filter berdasarkan Tipe Tanggal
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
    
    // Filter berdasarkan Seksi (hanya untuk Admin Utama)
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
    
    document.getElementById('printPeriod').innerText = periodText;
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

    document.getElementById('printPeriod').innerText = periodText;
}

function printReport() {
    showLoading(true, "Menyiapkan dokumen cetak...");
    
    // Gunakan filter yang sedang aktif
    updatePrintHeaderForFilter(currentFilter.type, document.getElementById('filterSummaryText').innerText || 'Semua Data');
    
    setTimeout(() => {
        showLoading(false);
        window.print();
    }, 800);
}

// === USER MANAGEMENT ===
async function loadUsers() {
    showLoading(true, "Mengambil data user...");
    try {
        const res = await fetch(`${API_URL}?action=getUsers`);
        const data = await res.json();
        allUsers = data.users || [];
        
        const tbody = document.querySelector('#usersTable tbody');
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
    document.getElementById('userModal').classList.add('hidden');
}

function toggleSeksiInput() {
    const role = document.getElementById('newRole').value;
    if (role === 'admin_seksi') {
        document.getElementById('seksiInputGroup').classList.remove('hidden');
        document.getElementById('seksiInputGroup').classList.add('animate-fade-in');
    } else {
        document.getElementById('seksiInputGroup').classList.add('hidden');
    }
}

async function saveUser() {
    const username = document.getElementById('newUsername').value;
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
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        showModal('success', 'User berhasil disimpan!');
        closeUserModal();
        loadUsers();
    } finally {
        showLoading(false);
    }
}

async function deleteUser(username) {
    if (!confirm(`Yakin ingin menghapus user ${username}?`)) return;
    showLoading(true, "Menghapus data user...");
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteUser', username }) });
        showModal('success', 'User berhasil dihapus!');
        loadUsers();
    } finally {
        showLoading(false);
    }
}

async function saveSettings() {
    const bgUrl = document.getElementById('bgUrlInput').value;
    if (!bgUrl) {
        showModal('error', 'URL Background tidak boleh kosong');
        return;
    }
    showLoading(true, "Menyimpan pengaturan...");
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveSetting', key: 'bg_image', value: bgUrl }) });
        document.documentElement.style.setProperty('--bg-image', `url('${bgUrl}')`);
        showModal('success', 'Pengaturan background berhasil disimpan!');
    } finally {
        showLoading(false);
    }
}

// === UTILITIES ===
function togglePassword() {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function showLoading(show, text = "Loading / Mengambil data...") {
    const textEl = document.getElementById('loadingOverlay').querySelector('.loading-text');
    if (textEl) textEl.innerText = text;
    if (show) document.getElementById('loadingOverlay').classList.remove('hidden');
    else document.getElementById('loadingOverlay').classList.add('hidden');
}

function showModal(type, message) {
    const modal = document.getElementById('notificationModal');
    modal.className = `modal ${type} animate-fade-in`;
    document.getElementById('modalTitle').innerText = type === 'success' ? 'Berhasil' : 'Gagal';
    document.getElementById('modalMessage').innerText = message;
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('notificationModal').classList.add('hidden');
}