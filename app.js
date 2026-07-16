const API_URL = 'https://script.google.com/macros/s/AKfycbwWYCnuJsrgFWeacZoyCzTqXyusE4_1YWA4a0uG0PXud2HD1-8R3Y3hll5IscG-3J88/exec';

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

// Klik placeholder untuk mulai kamera
cameraPlaceholder.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (cameraState === 'idle') {
        await startCamera();
    }
});

// Klik video untuk ambil foto
videoElement.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cameraState === 'active') {
        capturePhoto();
    }
});

// Klik preview untuk ulangi
photoPreview.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cameraState === 'captured') {
        retakePhoto();
    }
});

// 🆕 Klik cameraBox sebagai fallback (jika user tap di area kosong)
cameraBox.addEventListener('click', async (e) => {
    // Hanya trigger jika yang diklik adalah cameraBox itu sendiri (bukan child)
    if (e.target === cameraBox) {
        if (cameraState === 'idle') {
            await startCamera();
        } else if (cameraState === 'active') {
            capturePhoto();
        } else if (cameraState === 'captured') {
            retakePhoto();
        }
    }
});

// Fungsi mulai kamera
async function startCamera() {
    showLoading(true, "Mengaktifkan kamera...");
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        videoElement.srcObject = stream;
        
        // 🆕 Pastikan semua elemen dalam state yang benar
        cameraPlaceholder.classList.add('hidden');
        photoPreview.classList.add('hidden'); // 🆕 FIX: Sembunyikan preview jika ada
        videoElement.classList.remove('hidden');
        cameraBox.classList.add('active');
        
        // Tampilkan overlay dengan instruksi
        cameraOverlay.classList.remove('hidden');
        cameraOverlayIcon.innerText = '📸';
        cameraOverlayText.innerText = 'Tap untuk ambil foto';
        
        cameraState = 'active';
        
        // 🆕 Flash effect saat kamera nyala
        flashCameraBox();
    } catch (err) {
        console.error('Camera error:', err);
        let errorMsg = 'Gagal mengakses kamera. ';
        if (err.name === 'NotAllowedError') {
            errorMsg += 'Izin kamera ditolak. Silakan izinkan akses kamera di browser Anda.';
        } else if (err.name === 'NotFoundError') {
            errorMsg += 'Kamera tidak ditemukan pada perangkat ini.';
        } else {
            errorMsg += 'Pastikan izin kamera diberikan.';
        }
        showModal('error', errorMsg);
    } finally {
        showLoading(false);
    }
}

// Fungsi ambil foto
function capturePhoto() {
    // 🆕 Validasi video sudah siap
    if (videoElement.readyState < 2) {
        showModal('error', 'Kamera belum siap. Silakan coba lagi.');
        return;
    }
    
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    canvasElement.getContext('2d').drawImage(videoElement, 0, 0);
    const base64Image = canvasElement.toDataURL('image/jpeg', 0.7);
    
    fotoSelfieInput.value = base64Image;
    photoPreview.src = base64Image;
    
    // 🆕 Atur tampilan dengan urutan yang benar
    videoElement.classList.add('hidden');
    photoPreview.classList.remove('hidden');
    photoPreview.classList.add('animate-fade-in');
    
    // Hentikan stream kamera untuk menghemat baterai
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Update overlay untuk state captured
    cameraOverlayIcon.innerText = '🔄';
    cameraOverlayText.innerText = 'Tap untuk ulangi foto';
    
    cameraState = 'captured';
    
    // 🆕 Flash effect saat foto diambil
    flashCameraBox();
}

// Fungsi ulangi foto
async function retakePhoto() {
    // 🆕 Reset state dengan benar
    fotoSelfieInput.value = '';
    photoPreview.src = '';
    photoPreview.classList.add('hidden');
    photoPreview.classList.remove('animate-fade-in');
    
    videoElement.classList.add('hidden');
    cameraOverlay.classList.add('hidden');
    cameraBox.classList.remove('active');
    
    cameraState = 'idle';
    
    // Mulai kamera lagi
    await startCamera();
}

// 🆕 Fungsi flash effect untuk feedback visual
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
            console.log(`✅ Berhasil memuat ${guestNamesData.length} nama tamu`);
        }
    } catch (err) {
        console.log('⚠️ Gagal memuat daftar nama:', err);
    }
}

namaInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    autofillNotice.classList.add('hidden');
    
    debounceTimer = setTimeout(() => {
        const query = this.value.trim();
        if (query.length >= 2) {
            showAutocomplete(query);
        } else {
            hideAutocomplete();
        }
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
    const matches = guestNamesData
        .filter(g => g.nama.toLowerCase().includes(lowerQuery))
        .slice(0, 5);
    
    if (matches.length === 0) {
        autocompleteDropdown.innerHTML = '<div class="autocomplete-empty">Tidak ada saran nama</div>';
        autocompleteDropdown.classList.remove('hidden');
        autocompleteIndex = -1;
        return;
    }
    
    autocompleteDropdown.innerHTML = matches.map((g, idx) => {
        const highlightedName = highlightMatch(g.nama, query);
        const info = g.asal === 'Instansi' ? g.namaInstansi : g.asal;
        
        return `
            <div class="autocomplete-item" data-index="${idx}" data-nama='${encodeURIComponent(JSON.stringify(g))}'>
                <span class="name">${highlightedName}</span>
                <span class="info">${info}</span>
            </div>
        `;
    }).join('');
    
    autocompleteDropdown.classList.remove('hidden');
    autocompleteIndex = -1;
    
    autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', function() {
            const data = JSON.parse(decodeURIComponent(this.dataset.nama));
            selectAutocompleteItem(data);
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
    
    // Set asal dan trigger change event
    document.getElementById('asal').value = data.asal || '';
    const event = new Event('change');
    document.getElementById('asal').dispatchEvent(event);
    
    // Auto-fill instansi jika ada
    if (data.asal === 'Instansi' && data.namaInstansi && data.namaInstansi !== '-') {
        setTimeout(() => {
            document.getElementById('namaInstansi').value = data.namaInstansi;
        }, 100);
    }
    
    // 🆕 Auto-fill alamat (dengan validasi)
    if (data.alamat && data.alamat !== '-') {
        document.getElementById('alamat').value = data.alamat;
    }
    
    // Auto-fill field lainnya
    if (data.tujuan) {
        document.getElementById('tujuan').value = data.tujuan;
    }
    
    if (data.keperluan) {
        document.getElementById('keperluan').value = data.keperluan;
    }
    
    if (data.noHp) {
        document.getElementById('noHp').value = data.noHp;
    }
    
    autofillNotice.classList.remove('hidden');
    hideAutocomplete();
    
    // Fokus ke field keperluan untuk UX lebih baik
    setTimeout(() => {
        document.getElementById('keperluan').focus();
    }, 200);
}

function hideAutocomplete() {
    autocompleteDropdown.classList.add('hidden');
    autocompleteIndex = -1;
}

// Tutup dropdown saat klik di luar
document.addEventListener('click', function(e) {
    if (!e.target.closest('.autocomplete-container')) {
        hideAutocomplete();
    }
});

// ============================================
// SUBMIT FORM
// ============================================

guestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 🆕 Validasi semua field required
    const nama = document.getElementById('nama').value.trim();
    const asal = asalSelect.value;
    const namaInstansi = namaInstansiInput.value.trim();
    const alamat = document.getElementById('alamat').value.trim();
    const tujuan = document.getElementById('tujuan').value;
    const keperluan = document.getElementById('keperluan').value.trim();
    const noHp = document.getElementById('noHp').value.trim();
    
    if (!nama) {
        showModal('error', 'Nama lengkap wajib diisi!');
        document.getElementById('nama').focus();
        return;
    }
    
    if (asal === 'Instansi' && !namaInstansi) {
        showModal('error', 'Nama instansi wajib diisi!');
        namaInstansiInput.focus();
        return;
    }
    
    if (!alamat) {
        showModal('error', 'Alamat wajib diisi!');
        document.getElementById('alamat').focus();
        return;
    }
    
    if (!tujuan) {
        showModal('error', 'Tujuan kunjungan wajib dipilih!');
        document.getElementById('tujuan').focus();
        return;
    }
    
    if (!keperluan) {
        showModal('error', 'Keperluan wajib diisi!');
        document.getElementById('keperluan').focus();
        return;
    }
    
    if (!noHp) {
        showModal('error', 'Nomor Handphone/Whatsapp wajib diisi!');
        document.getElementById('noHp').focus();
        return;
    }
    
    // Validasi format nomor HP (opsional)
    if (!/^[0-9+\-\s()]{8,20}$/.test(noHp)) {
        showModal('error', 'Format nomor handphone tidak valid!');
        document.getElementById('noHp').focus();
        return;
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
        fotoSelfie: fotoSelfieInput.value || 'Tidak ada foto'
    };

    try {
        const response = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify(formData) 
        });
        const result = await response.json();

        if (result.status === 'success') {
            showModal('success', 'Terima kasih! Data tamu berhasil disimpan.');
            resetForm();
            loadGuestNames(); // Refresh daftar nama untuk autocomplete
        } else {
            showModal('error', 'Gagal menyimpan data: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Submit error:', error);
        showModal('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
        showLoading(false);
    }
});

// 🆕 Fungsi reset form yang lebih lengkap
function resetForm() {
    // Reset form HTML
    guestForm.reset();
    
    // Reset kamera ke state idle
    fotoSelfieInput.value = '';
    
    // Sembunyikan semua elemen kamera
    photoPreview.classList.add('hidden');
    photoPreview.classList.remove('animate-fade-in');
    photoPreview.src = '';
    
    videoElement.classList.add('hidden');
    videoElement.srcObject = null;
    
    cameraPlaceholder.classList.remove('hidden');
    cameraBox.classList.remove('active');
    cameraOverlay.classList.add('hidden');
    
    // Reset instansi group
    instansiGroup.classList.add('hidden');
    
    // Reset state kamera
    cameraState = 'idle';
    
    // Hentikan stream kamera jika masih aktif
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Reset autocomplete
    hideAutocomplete();
    autofillNotice.classList.add('hidden');
    autocompleteIndex = -1;
    
    // 🆕 Scroll ke atas form
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
    document.getElementById('modalTitle').innerText = type === 'success' ? 'Berhasil' : 'Gagal';
    document.getElementById('modalMessage').innerText = message;
    notificationModal.classList.remove('hidden');
}

function closeModal() {
    notificationModal.classList.add('hidden');
}
