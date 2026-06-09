const API_URL = 'https://script.google.com/macros/s/AKfycbwnT4kw4BC60Mu1Bve525ARoilh-6I5aGdDFGOXVRMb1ypzxhROah2_ojrP2gqpWRw1/exec';

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
const btnStartCamera = document.getElementById('btnStartCamera');
const btnCapture = document.getElementById('btnCapture');
const btnRetake = document.getElementById('btnRetake');
const fotoSelfieInput = document.getElementById('fotoSelfie');

// Elemen Autocomplete
const namaInput = document.getElementById('nama');
const autocompleteDropdown = document.getElementById('autocompleteDropdown');
const autofillNotice = document.getElementById('autofillNotice');

// === VARIABEL GLOBAL ===
let stream = null;
let guestNamesData = [];
let autocompleteIndex = -1;
let debounceTimer = null;

// === INISIALISASI SAAT HALAMAN DIMUAT ===
document.addEventListener('DOMContentLoaded', () => {
    loadGuestNames(); // 🆕 PANGGIL FUNGSI INI agar autocomplete berfungsi
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

// === KAMERA FUNCTIONS ===

// 1. Aktifkan Kamera
btnStartCamera.addEventListener('click', async () => {
    showLoading(true, "Mengaktifkan kamera...");
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        videoElement.srcObject = stream;
        
        cameraPlaceholder.classList.add('hidden');
        videoElement.classList.remove('hidden');
        cameraBox.classList.add('active');
        
        btnStartCamera.classList.add('hidden');
        btnCapture.classList.remove('hidden');
        btnCapture.classList.add('animate-fade-in');
    } catch (err) {
        showModal('error', 'Gagal mengakses kamera. Pastikan izin kamera diberikan.');
    } finally {
        showLoading(false);
    }
});

// 2. Ambil Foto
btnCapture.addEventListener('click', () => {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    canvasElement.getContext('2d').drawImage(videoElement, 0, 0);
    const base64Image = canvasElement.toDataURL('image/jpeg', 0.7);
    
    fotoSelfieInput.value = base64Image;
    photoPreview.src = base64Image;
    
    videoElement.classList.add('hidden');
    photoPreview.classList.remove('hidden');
    photoPreview.classList.add('animate-fade-in');
    
    stream.getTracks().forEach(track => track.stop());
    
    btnCapture.classList.add('hidden');
    btnRetake.classList.remove('hidden');
    btnRetake.classList.add('animate-fade-in');
});

// 3. Ulangi Foto
btnRetake.addEventListener('click', () => {
    fotoSelfieInput.value = '';
    photoPreview.classList.add('hidden');
    videoElement.classList.remove('hidden');
    cameraPlaceholder.classList.add('hidden');
    
    btnRetake.classList.add('hidden');
    btnStartCamera.classList.remove('hidden');
    
    btnStartCamera.click();
});

// === AUTOCOMPLETE & AUTO-FILL FUNCTIONS ===

// Ambil daftar nama tamu saat halaman dimuat
async function loadGuestNames() {
    try {
        const res = await fetch(`${API_URL}?action=getGuestNames`);
        const data = await res.json();
        if (data.status === 'success') {
            guestNamesData = data.names || [];
            console.log(`✅ Berhasil memuat ${guestNamesData.length} nama tamu untuk autocomplete`);
        }
    } catch (err) {
        console.log('⚠️ Gagal memuat daftar nama:', err);
    }
}

// Event listener untuk input nama (Autocomplete)
namaInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    
    // Sembunyikan notifikasi auto-fill saat user mulai mengetik
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

// Navigasi keyboard pada dropdown
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

// Tampilkan dropdown autocomplete
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

// Pilih item dari autocomplete dan auto-fill
function selectAutocompleteItem(data) {
    namaInput.value = data.nama;
    
    document.getElementById('asal').value = data.asal || '';
    const event = new Event('change');
    document.getElementById('asal').dispatchEvent(event);
    
    if (data.asal === 'Instansi' && data.namaInstansi && data.namaInstansi !== '-') {
        setTimeout(() => {
            document.getElementById('namaInstansi').value = data.namaInstansi;
        }, 100);
    }
    
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

// === SUBMIT FORM ===
guestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (asalSelect.value === 'Instansi' && !namaInstansiInput.value.trim()) {
        showModal('error', 'Nama instansi wajib diisi!');
        return;
    }

    showLoading(true, "Menyimpan data tamu...");

    const formData = {
        action: 'addGuest',
        nama: document.getElementById('nama').value,
        asal: asalSelect.value,
        namaInstansi: asalSelect.value === 'Instansi' ? namaInstansiInput.value : '-',
        tujuan: document.getElementById('tujuan').value,
        keperluan: document.getElementById('keperluan').value,
        noHp: document.getElementById('noHp').value,
        fotoSelfie: fotoSelfieInput.value || 'Tidak ada foto'
    };

    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(formData) });
        const result = await response.json();

        if (result.status === 'success') {
            showModal('success', 'Terima kasih! Data tamu berhasil disimpan.');
            
            // Reset Form & Kamera ke kondisi awal
            resetForm();
            
            // 🆕 Refresh daftar nama tamu agar nama yang baru saja mengisi bisa muncul di autocomplete
            loadGuestNames();
        } else {
            showModal('error', 'Gagal menyimpan data: ' + result.message);
        }
    } catch (error) {
        showModal('error', 'Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
        showLoading(false);
    }
});

// 🆕 Fungsi baru untuk reset form secara lengkap
function resetForm() {
    guestForm.reset();
    
    // Reset kamera
    fotoSelfieInput.value = '';
    photoPreview.classList.add('hidden');
    videoElement.classList.add('hidden');
    cameraPlaceholder.classList.remove('hidden');
    cameraBox.classList.remove('active');
    
    btnRetake.classList.add('hidden');
    btnStartCamera.classList.remove('hidden');
    instansiGroup.classList.add('hidden');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // 🆕 Reset autocomplete state
    hideAutocomplete();
    autofillNotice.classList.add('hidden');
    autocompleteIndex = -1;
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
