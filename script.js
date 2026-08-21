
const APK_FILE_NAME = 'com.kumoscan.app(1.1.0.beta).apk';
const DOWNLOAD_URL = `app/${APK_FILE_NAME}`;

const toast = document.querySelector('#toast');
const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3500);
};

document.querySelectorAll('#android-download, #android-download-bottom').forEach((button) => {
  button.href = DOWNLOAD_URL;
  button.download = APK_FILE_NAME;
});

document.querySelectorAll('[data-screenshot]').forEach((image) => {
  const slot = image.closest('.screenshot-slot');
  image.addEventListener('load', () => slot.classList.add('has-image'));
  image.addEventListener('error', () => slot.classList.remove('has-image'));
  if (image.complete && image.naturalWidth > 0) slot.classList.add('has-image');
});

document.querySelector('#year').textContent = new Date().getFullYear();
