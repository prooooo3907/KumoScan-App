import {
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

const APK_FILE_NAME = "com.kumoscan.app(1.1.0.beta).apk";
const DOWNLOAD_URL = `app/${APK_FILE_NAME}`;
const DEVICE_COLLECTION = "deviceLogs";
const toast = document.querySelector("#toast");

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3500);
};

const ensureVisitorAuth = async () => {
  if (auth.currentUser?.isAnonymous) return auth.currentUser;
  if (auth.currentUser) await signOut(auth);
  const credential = await signInAnonymously(auth);
  return credential.user;
};

const detectBrowser = (userAgent) => {
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/OPR\//.test(userAgent) || /Opera/.test(userAgent)) return "Opera";
  if (/SamsungBrowser\//.test(userAgent)) return "Samsung Internet";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/CriOS\//.test(userAgent)) return "Chrome على iOS";
  if (/Chrome\//.test(userAgent)) return "Google Chrome";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "متصفح غير معروف";
};

const detectDevice = async () => {
  const userAgent = navigator.userAgent || "";
  const uaData = navigator.userAgentData;
  let highEntropy = {};

  if (uaData?.getHighEntropyValues) {
    try {
      highEntropy = await uaData.getHighEntropyValues(["model", "platform", "platformVersion"]);
    } catch (error) {
      console.debug("لا تتوفر بيانات متقدمة للجهاز.", error);
    }
  }

  const androidModelMatch = userAgent.match(/Android[^;)]*;\s*(?:[a-z]{2}-[A-Z]{2};\s*)?([^;)]+?)(?:\s+Build\/|;\s*wv|\))/i);
  const androidModel = androidModelMatch?.[1]?.trim() || "";
  const model = highEntropy.model || androidModel || (/(iPhone)/i.test(userAgent) ? "iPhone" : /(iPad)/i.test(userAgent) ? "iPad" : "غير متاح");
  const knownBrand = userAgent.match(/Xiaomi|Redmi|POCO|OPPO|OnePlus|Samsung|HUAWEI|HONOR|vivo|realme|Google|Nokia|Sony|Motorola|Infinix|Tecno|Apple/i)?.[0];
  const brand = /iPhone|iPad|Macintosh/i.test(userAgent) ? "Apple" : knownBrand || (model !== "غير متاح" ? model.split(" ")[0] : "غير متاح");
  const deviceType = /iPad|Tablet/i.test(userAgent) ? "جهاز لوحي" : /Mobi|Android|iPhone/i.test(userAgent) ? "هاتف" : "سطح مكتب";
  const locale = navigator.language || "غير متاح";
  let country = null;

  try {
    country = new Intl.Locale(locale).region || null;
  } catch (error) {
    console.debug("تعذر تحديد رمز الدولة من لغة المتصفح.", error);
  }

  return {
    deviceType,
    deviceBrand: brand,
    deviceModel: model,
    platform: highEntropy.platform || navigator.platform || "غير متاح",
    browser: detectBrowser(userAgent),
    language: locale,
    languages: navigator.languages?.join(", ") || locale,
    country,
    countrySource: country ? "لغة المتصفح" : "غير متاح",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "غير متاح"
  };
};

let visitorId = "";
let deviceInfoPromise = null;
const getDeviceInfo = () => {
  if (!deviceInfoPromise) deviceInfoPromise = detectDevice();
  return deviceInfoPromise;
};

const writeDeviceLog = async (eventType) => {
  const visitor = await ensureVisitorAuth();
  visitorId = visitor.uid;
  const deviceInfo = await getDeviceInfo();
  const reference = doc(db, DEVICE_COLLECTION, visitorId);
  const clientTime = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    const previous = existing.exists() ? existing.data() : {};
    const isDownload = eventType === "download_request";

    const update = {
      ...deviceInfo,
      visitorId,
      lastVisit: serverTimestamp(),
      lastVisitClient: clientTime,
      visitCount: (Number(previous.visitCount) || 0) + (eventType === "site_visit" ? 1 : 0),
      updatedAt: serverTimestamp()
    };

    if (!existing.exists()) {
      update.firstVisit = serverTimestamp();
      update.firstVisitClient = clientTime;
      update.downloadCount = 0;
    }

    if (isDownload) {
      update.downloadCount = (Number(previous.downloadCount) || 0) + 1;
      update.lastDownload = serverTimestamp();
      update.lastDownloadClient = clientTime;
      update.lastDownloadedFile = APK_FILE_NAME;
    }

    transaction.set(reference, update, { merge: true });
  });
};

const recordVisit = async () => {
  if (sessionStorage.getItem("kumoscan_visit_recorded")) return;

  try {
    await writeDeviceLog("site_visit");
    sessionStorage.setItem("kumoscan_visit_recorded", "true");
  } catch (error) {
    console.error("تعذر تسجيل زيارة الجهاز في Firestore.", error);
  }
};

const recordDownload = async () => {
  try {
    await writeDeviceLog("download_request");
  } catch (error) {
    console.error("تعذر تسجيل طلب التحميل في Firestore.", error);
  }
};

const waitForDownloadLog = () => Promise.race([
  recordDownload(),
  new Promise((resolve) => window.setTimeout(resolve, 800))
]);

document.querySelectorAll("#android-download, #android-download-bottom").forEach((button) => {
  button.href = DOWNLOAD_URL;
  button.download = APK_FILE_NAME;
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    await waitForDownloadLog();
    const downloadLink = document.createElement("a");
    downloadLink.href = DOWNLOAD_URL;
    downloadLink.download = APK_FILE_NAME;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  });
});

document.querySelectorAll("[data-screenshot]").forEach((image) => {
  const slot = image.closest(".screenshot-slot");
  image.addEventListener("load", () => slot.classList.add("has-image"));
  image.addEventListener("error", () => slot.classList.remove("has-image"));
  if (image.complete && image.naturalWidth > 0) slot.classList.add("has-image");
});

document.querySelector("#year").textContent = new Date().getFullYear();
recordVisit();

window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.code?.startsWith?.("permission-denied")) {
    showToast("يلزم ضبط قواعد Firestore حتى يعمل تسجيل الزيارات.");
  }
});
