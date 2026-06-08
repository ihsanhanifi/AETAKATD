const API_URL = 'https://script.google.com/macros/s/AKfycbwnT4kw4BC60Mu1Bve525ARoilh-6I5aGdDFGOXVRMb1ypzxhROah2_ojrP2gqpWRw1/exec'; // GANTI DENGAN URL ANDA
let currentUser = null;
let allGuests = [];
let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    const savedUser = localStorage.getItem('etamu_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
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
}

function logout() {
    showLoading(true, "Logging out...");
    setTimeout(() => {
        localStorage.removeItem('etamu_user');
        location.reload();
    }, 500);
}

function switchTab(tabName, btnElement) {
    document.getElementById('mobileNavTabs').classList.remove('active'); // Tutup menu mobile saat diklik
    
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

async function loadGuests() {
    showLoading(true, "Mengambil data tamu...");
    try {
        const res = await fetch(`${API_URL}?action=getGuests&role=${currentUser.role}&seksi=${currentUser.seksi || ''}`);
        const data = await res.json();
        allGuests = data.guests || [];
        renderGuestsTable(allGuests);
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
        
        // Cek apakah ada foto
        let photoCell = '';
        if (g.fotoSelfie && g.fotoSelfie !== 'Tidak ada foto' && g.fotoSelfie.startsWith('data:image')) {
            // Ada foto - tampilkan thumbnail yang bisa diklik
            photoCell = `
                <td class="no-print" style="text-align: center;">
                    <img src="${g.fotoSelfie}" alt="Foto ${g.nama}" class="photo-thumbnail" 
                         onclick="openLightbox('${g.fotoSelfie}', '${g.nama} - ${date}')">
                </td>
            `;
        } else {
            // Tidak ada foto
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

// === FUNGSI LIGHTBOX ===
function openLightbox(imageSrc, caption) {
    const lightbox = document.getElementById('photoLightbox');
    const img = document.getElementById('lightboxImage');
    const cap = document.getElementById('lightboxCaption');
    
    img.src = imageSrc;
    cap.innerText = caption;
    lightbox.classList.remove('hidden');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function closeLightbox(event) {
    // Jika event ada dan bukan dari background atau tombol close, jangan tutup
    if (event && event.target !== event.currentTarget && !event.target.classList.contains('lightbox-close')) {
        return;
    }
    
    const lightbox = document.getElementById('photoLightbox');
    lightbox.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
}

// Tutup lightbox dengan tombol ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeLightbox();
    }
});
// FUNGSI BARU: Update Header Cetak dengan Periode Dinamis
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

// Perbarui fungsi printReport untuk memastikan header ter-update sebelum mencetak
function printReport() {
    showLoading(true, "Menyiapkan dokumen cetak...");
    
    // Pastikan header diperbarui dengan filter yang sedang aktif
    const currentFilter = document.getElementById('reportFilter').value;
    updatePrintHeader(currentFilter);
    
    setTimeout(() => {
        showLoading(false);
        window.print();
    }, 800);
}

// --- USER MANAGEMENT ---
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
                        <button class="btn-secondary" onclick="editUser('${u.username}')">Edit</button>
                        <button class="btn-danger" onclick="deleteUser('${u.username}')">Hapus</button>
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

// Utilities
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