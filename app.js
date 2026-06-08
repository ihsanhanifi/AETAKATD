const API_URL = 'https://script.google.com/macros/s/AKfycbwnT4kw4BC60Mu1Bve525ARoilh-6I5aGdDFGOXVRMb1ypzxhROah2_ojrP2gqpWRw1/exec'; // GANTI DENGAN URL ANDA

const guestForm = document.getElementById('guestForm');
const asalSelect = document.getElementById('asal');
const instansiGroup = document.getElementById('instansiGroup');
const namaInstansiInput = document.getElementById('namaInstansi');
const loadingOverlay = document.getElementById('loadingOverlay');
const notificationModal = document.getElementById('notificationModal');

const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const photoPreview = document.getElementById('photoPreview');
const btnStartCamera = document.getElementById('btnStartCamera');
const btnCapture = document.getElementById('btnCapture');
const btnRetake = document.getElementById('btnRetake');
const fotoSelfieInput = document.getElementById('fotoSelfie');

let stream = null;

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

btnStartCamera.addEventListener('click', async () => {
    showLoading(true, "Mengaktifkan kamera...");
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        videoElement.srcObject = stream;
        btnStartCamera.classList.add('hidden');
        btnCapture.classList.remove('hidden');
        btnCapture.classList.add('animate-fade-in');
    } catch (err) {
        showModal('error', 'Gagal mengakses kamera. Pastikan izin kamera diberikan.');
    } finally {
        showLoading(false);
    }
});

btnCapture.addEventListener('click', () => {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    canvasElement.getContext('2d').drawImage(videoElement, 0, 0);
    const base64Image = canvasElement.toDataURL('image/jpeg', 0.7);
    
    fotoSelfieInput.value = base64Image;
    photoPreview.src = base64Image;
    photoPreview.style.display = 'block';
    photoPreview.classList.add('animate-fade-in');
    videoElement.style.display = 'none';
    
    stream.getTracks().forEach(track => track.stop());
    
    btnCapture.classList.add('hidden');
    btnRetake.classList.remove('hidden');
    btnRetake.classList.add('animate-fade-in');
});

btnRetake.addEventListener('click', () => {
    fotoSelfieInput.value = '';
    photoPreview.style.display = 'none';
    videoElement.style.display = 'block';
    btnRetake.classList.add('hidden');
    btnStartCamera.classList.remove('hidden');
    btnStartCamera.click();
});

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
            guestForm.reset();
            fotoSelfieInput.value = '';
            photoPreview.style.display = 'none';
            videoElement.style.display = 'block';
            btnRetake.classList.add('hidden');
            btnStartCamera.classList.remove('hidden');
            instansiGroup.classList.add('hidden');
            if (stream) stream.getTracks().forEach(track => track.stop());
        } else {
            showModal('error', 'Gagal menyimpan data: ' + result.message);
        }
    } catch (error) {
        showModal('error', 'Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
        showLoading(false);
    }
});

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
