const API_URL = 'https://script.google.com/macros/s/AKfycbwuaPawE1a26fkcR8htUiU0X7rTyBeNIEBW12rI2hpE4XAw6SQuiJYS6Ym14sP1iTU8/exec';

// === ELEMEN DOM ===
const guestForm = document.getElementById('guestForm');
const asalSelect = document.getElementById('asal');
const instansiGroup = document.getElementById('instansiGroup');
const namaInstansiInput = document.getElementById('namaInstansi');
const loadingOverlay = document.getElementById('loadingOverlay');
const notificationModal = document.getElementById('notificationModal');

// Elemen Kamera
const cameraBox = document.getElementById('cameraBox');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const photoPreview = document.getElementById('photoPreview');
const fotoSelfieInput = document.getElementById('fotoSelfie');
const cameraOverlay = document.getElementById('cameraOverlay');
const cameraOverlayIcon = document.getElementById('cameraOverlayIcon');
const cameraOverlayText = document.getElementById('cameraOverlayText');

// Elemen Autocomplete
const namaInput = document.getElementById('nama');
const autocompleteDropdown = document.getElementById('autocompleteDropdown');
const autofillNotice = document.getElementById('autofillNotice');

// === VARIABEL GLOBAL ===
let stream = null;
let guestNamesData = [];
let autocompleteIndex = -1;
let debounceTimer = null;
let cameraState = 'idle'; // 'idle', 'active', 'captured'

// === INISIALISASI ===
document.addEventListener('DOMContentLoaded', () => {
    loadGuestNames();
});

// === TOGGLE INSTANSI INPUT ===
asalSelect.addEventListener('change', function() {
    if (this.value === 'Instansi') {
        instansiGroup.classList.remove('hidden');
        instansiGroup.classList.add('animate-fade-in');
        namaInstansiInput.setAttribute('required', 'required');
    } else {
        instansiGroup.classList.add('hidden');
        namaInstansiInput.removeAttribute('required');
        namaInstansiInput.value = '';
    }
});

// ============================================
// KAMERA INTERAKTIF (TAP LANGSUNG DI AREA)
// ============================================

cameraPlaceholder.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (cameraState === 'idle') await startCamera();
});

videoElement.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cameraState === 'active') capturePhoto();
});

photoPreview.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cameraState === 'captured') retakePhoto();
});

cameraBox.addEventListener('click', async (e) => {
    if (e.target === cameraBox) {
        if (cameraState === 'idle') await startCamera();
        else if (cameraState === 'active') capturePhoto();
        else if (cameraState === 'captured') retakePhoto();
    }
});

async function startCamera() {
    showLoading(true, "Mengaktifkan kamera...");
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        videoElement.srcObject = stream;
        
        cameraPlaceholder.classList.add('hidden');
        photoPreview.classList.add('hidden');
        videoElement.classList.remove('hidden');
        cameraBox.classList.add('active');
        
        cameraOverlay.classList.remove('hidden');
        cameraOverlayIcon.innerText = '📸';
        cameraOverlayText.innerText = 'Tap untuk ambil foto';
        
        cameraState = 'active';
        flashCameraBox();
    } catch (err) {
        console.error('Camera error:', err);
        let errorMsg = 'Gagal mengakses kamera. ';
        if (err.name === 'NotAllowedError') errorMsg += 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.';
        else if (err.name === 'NotFoundError') errorMsg += 'Kamera tidak ditemukan pada perangkat ini.';
        else if (err.name === 'NotReadableError') errorMsg += 'Kamera sedang digunakan oleh aplikasi lain.';
        else errorMsg += 'Pastikan perangkat Anda memiliki kamera dan izin telah diberikan.';
        showModal('error', errorMsg);
    } finally {
        showLoading(false);
    }
}

function capturePhoto() {
    if (videoElement.readyState < 2) {
        showModal('error', 'Kamera belum siap. Silakan tunggu sebentar dan coba lagi.');
        return;
    }
    
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    canvasElement.getContext('2d').drawImage(videoElement, 0, 0);
    const base64Image = canvasElement.toDataURL('image/jpeg', 0.7);
    
    fotoSelfieInput.value = base64Image;
    photoPreview.src = base64Image;
    
    videoElement.classList.add('hidden');
    photoPreview.classList.remove('hidden');
    photoPreview.classList.add('animate-fade-in');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    cameraOverlayIcon.innerText = '🔄';
    cameraOverlayText.innerText = 'Tap untuk ulangi foto';
    cameraState = 'captured';
    flashCameraBox();
}

async function retakePhoto() {
    fotoSelfieInput.value = '';
    photoPreview.src = '';
    photoPreview.classList.add('hidden');
    photoPreview.classList.remove('animate-fade-in');
    videoElement.classList.add('hidden');
    cameraOverlay.classList.add('hidden');
    cameraBox.classList.remove('active');
    cameraState = 'idle';
    await startCamera();
}

function flashCameraBox() {
    cameraBox.style.transition = 'none';
    cameraBox.style.boxShadow = '0 0 0 4px var(--kemenag-gold)';
    setTimeout(() => {
        cameraBox.style.transition = 'box-shadow 0.5s ease-out';
        cameraBox.style.boxShadow = '';
    }, 50);
}

// ============================================
// AUTOCOMPLETE & AUTO-FILL
// ============================================

async function loadGuestNames() {
    try {
        const res = await fetch(`${API_URL}?action=getGuestNames`);
        const data = await res.json();
        if (data.status === 'success') {
            guestNamesData = data.names || [];
            console.log(`✅ Berhasil memuat ${guestNamesData.length} nama tamu untuk autocomplete`);
        }
    } catch (err) {
        console.warn('⚠️ Gagal memuat daftar nama:', err);
    }
}

namaInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    autofillNotice.classList.add('hidden');
    debounceTimer = setTimeout(() => {
        const query = this.value.trim();
        if (query.length >= 2) showAutocomplete(query);
        else hideAutocomplete();
    }, 300);
});

namaInput.addEventListener('keydown', function(e) {
    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocompleteIndex = Math.min(autocompleteIndex + 1, items.length - 1);
        updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocompleteIndex = Math.max(autocompleteIndex - 1, 0);
        updateActiveItem(items);
    } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
        e.preventDefault();
        items[autocompleteIndex].click();
    } else if (e.key === 'Escape') {
        hideAutocomplete();
    }
});

function updateActiveItem(items) {
    items.forEach((item, idx) => {
        if (idx === autocompleteIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function showAutocomplete(query) {
    const lowerQuery = query.toLowerCase();
    const matches = guestNamesData.filter(g => g.nama.toLowerCase().includes(lowerQuery)).slice(0, 5);
    
    if (matches.length === 0) {
        autocompleteDropdown.innerHTML = '<div class="autocomplete-empty">Tidak ada saran nama</div>';
        autocompleteDropdown.classList.remove('hidden');
        autocompleteIndex = -1;
        return;
    }
    
    autocompleteDropdown.innerHTML = matches.map((g) => {
        const highlightedName = highlightMatch(g.nama, query);
        const info = g.asal === 'Instansi' ? (g.namaInstansi || 'Instansi') : 'Umum';
        const safeNama = g.nama.replace(/"/g, '&quot;');
        return `<div class="autocomplete-item" data-nama="${safeNama}"><span class="name">${highlightedName}</span><span class="info">${info}</span></div>`;
    }).join('');
    
    autocompleteDropdown.classList.remove('hidden');
    autocompleteIndex = -1;
    
    autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', function() {
            const clickedNama = this.dataset.nama;
            const data = guestNamesData.find(g => g.nama === clickedNama);
            if (data) selectAutocompleteItem(data);
        });
    });
}

function highlightMatch(text, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectAutocompleteItem(data) {
    namaInput.value = data.nama;
    asalSelect.value = data.asal || '';
    asalSelect.dispatchEvent(new Event('change'));
    
    if (data.asal === 'Instansi' && data.namaInstansi && data.namaInstansi !== '-') {
        setTimeout(() => { namaInstansiInput.value = data.namaInstansi; }, 100);
    }
    
    const alamatInput = document.getElementById('alamat');
    if (alamatInput && data.alamat && data.alamat !== '-') alamatInput.value = data.alamat;
    
    const tujuanInput = document.getElementById('tujuan');
    if (tujuanInput && data.tujuan) tujuanInput.value = data.tujuan;
    
    const keperluanInput = document.getElementById('keperluan');
    if (keperluanInput && data.keperluan) keperluanInput.value = data.keperluan;
    
    const noHpInput = document.getElementById('noHp');
    if (noHpInput && data.noHp) noHpInput.value = data.noHp;
    
    autofillNotice.classList.remove('hidden');
    hideAutocomplete();
    setTimeout(() => { if (keperluanInput) keperluanInput.focus(); }, 200);
}

function hideAutocomplete() {
    autocompleteDropdown.classList.add('hidden');
    autocompleteIndex = -1;
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.autocomplete-container')) hideAutocomplete();
});

// ============================================
// SUBMIT FORM (DENGAN SAFEGUARD FOTO)
// ============================================

guestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nama = document.getElementById('nama').value.trim();
    const asal = asalSelect.value;
    const namaInstansi = namaInstansiInput.value.trim();
    const alamat = document.getElementById('alamat').value.trim();
    const tujuan = document.getElementById('tujuan').value;
    const keperluan = document.getElementById('keperluan').value.trim();
    const noHp = document.getElementById('noHp').value.trim();
    
    if (!nama) { showModal('error', 'Nama lengkap wajib diisi!'); document.getElementById('nama').focus(); return; }
    if (asal === 'Instansi' && !namaInstansi) { showModal('error', 'Nama instansi wajib diisi!'); namaInstansiInput.focus(); return; }
    if (!alamat) { showModal('error', 'Alamat wajib diisi!'); document.getElementById('alamat').focus(); return; }
    if (!tujuan) { showModal('error', 'Tujuan kunjungan wajib dipilih!'); document.getElementById('tujuan').focus(); return; }
    if (!keperluan) { showModal('error', 'Keperluan wajib diisi!'); document.getElementById('keperluan').focus(); return; }
    if (!noHp) { showModal('error', 'Nomor Handphone/Whatsapp wajib diisi!'); document.getElementById('noHp').focus(); return; }
    if (!/^[0-9+\-\s()]{8,20}$/.test(noHp)) { showModal('error', 'Format nomor handphone tidak valid! (Contoh: 08123456789)'); document.getElementById('noHp').focus(); return; }

    // 🛡️ SAFEGUARD FOTO: Validasi ketat sebelum dikirim
    let rawFoto = fotoSelfieInput.value;
    let fotoToSend = 'Tidak ada foto'; // Default aman
    
    // Hanya terima jika benar-benar string, panjangnya > 100 karakter (base64 minimal), dan mengandung 'base64,'
    if (typeof rawFoto === 'string' && rawFoto.length > 100 && rawFoto.includes('base64,')) {
        fotoToSend = rawFoto;
    } else {
        console.log("ℹ️ [FRONTEND] Foto tidak valid atau kosong, akan dikirim sebagai 'Tidak ada foto'");
    }

    showLoading(true, "Menyimpan data tamu...");

    const formData = {
        action: 'addGuest',
        nama: nama,
        asal: asal,
        namaInstansi: asal === 'Instansi' ? namaInstansi : '-',
        alamat: alamat,
        tujuan: tujuan,
        keperluan: keperluan,
        noHp: noHp,
        fotoSelfie: fotoToSend // Nilai ini dijamin aman
    };

    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(formData) });
        const result = await response.json();

        if (result.status === 'success') {
            showModal('success', 'Terima kasih! Data tamu berhasil disimpan.');
            resetForm();
            loadGuestNames(); 
        } else {
            showModal('error', 'Gagal menyimpan data: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Submit error:', error);
        showModal('error', 'Terjadi kesalahan jaringan. Silakan periksa koneksi internet Anda.');
    } finally {
        showLoading(false);
    }
});

function resetForm() {
    guestForm.reset();
    fotoSelfieInput.value = '';
    
    photoPreview.classList.add('hidden');
    photoPreview.classList.remove('animate-fade-in');
    photoPreview.src = '';
    
    videoElement.classList.add('hidden');
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    
    cameraPlaceholder.classList.remove('hidden');
    cameraBox.classList.remove('active');
    cameraOverlay.classList.add('hidden');
    
    instansiGroup.classList.add('hidden');
    namaInstansiInput.removeAttribute('required');
    
    cameraState = 'idle';
    stream = null;
    
    hideAutocomplete();
    autofillNotice.classList.add('hidden');
    autocompleteIndex = -1;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === UTILITY FUNCTIONS ===
function showLoading(show, text = "Loading / Mengambil data...") {
    const textEl = loadingOverlay.querySelector('.loading-text');
    if (textEl) textEl.innerText = text;
    if (show) loadingOverlay.classList.remove('hidden');
    else loadingOverlay.classList.add('hidden');
}

function showModal(type, message) {
    notificationModal.className = `modal ${type} animate-fade-in`;
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    
    if (modalTitle) {
        if (type === 'success') modalTitle.innerText = '✅ Berhasil';
        else if (type === 'error') modalTitle.innerText = '❌ Gagal';
        else modalTitle.innerText = 'Notifikasi';
    }
    if (modalMessage) modalMessage.innerText = message;
    notificationModal.classList.remove('hidden');
}

function closeModal() {
    notificationModal.classList.add('hidden');
}