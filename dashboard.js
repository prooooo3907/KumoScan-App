import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL = "admin@kumoscan.local";
const DEVICE_COLLECTION = "deviceLogs";

const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#login-button");
const loginError = document.querySelector("#login-error");
const refreshButton = document.querySelector("#refresh-button");
const logoutButton = document.querySelector("#logout-button");
const dashboardStatus = document.querySelector("#dashboard-status");
const tableBody = document.querySelector("#device-table-body");

const isAdmin = (user) => user?.email?.toLowerCase() === ADMIN_EMAIL;

const setLoginError = (message = "") => {
  loginError.textContent = message;
};

const setStatus = (message, type = "") => {
  dashboardStatus.textContent = message;
  dashboardStatus.className = `status-message ${type}`.trim();
};

const formatDate = (timestamp) => {
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : null;
  if (!date || Number.isNaN(date.getTime())) return "غير متاح";

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
};

const safeText = (value) => value || "غير متاح";

const createCell = (content, className = "") => {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = content;
  return cell;
};

const renderRows = (rows) => {
  tableBody.replaceChildren();

  if (!rows.length) {
    const emptyRow = document.createElement("tr");
    const emptyCell = createCell("لا توجد سجلات أجهزة بعد.", "empty-cell");
    emptyCell.colSpan = 7;
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
    return;
  }

  rows.forEach((documentSnapshot) => {
    const item = documentSnapshot.data();
    const row = document.createElement("tr");
    const deviceLabel = [item.deviceBrand, item.deviceModel]
      .filter((value, index, values) => value && value !== "غير متاح" && values.indexOf(value) === index)
      .join(" — ") || "غير متاح";
    const localeLabel = [item.language, item.country]
      .filter(Boolean)
      .join(" / ") || "غير متاح";

    row.append(
      createCell(deviceLabel, "device-name"),
      createCell(`${safeText(item.deviceType)} / ${safeText(item.platform)}`),
      createCell(safeText(item.browser)),
      createCell(localeLabel),
      createCell(formatDate(item.lastVisit || item.lastVisitClient), "date-cell"),
      createCell(String(Number(item.visitCount) || 0), "number-cell"),
      createCell(String(Number(item.downloadCount) || 0), "number-cell download-count")
    );

    tableBody.appendChild(row);
  });
};

const renderErrorRow = (message) => {
  tableBody.replaceChildren();
  const row = document.createElement("tr");
  const cell = createCell(message, "empty-cell error-cell");
  cell.colSpan = 7;
  row.appendChild(cell);
  tableBody.appendChild(row);
};

const loadDashboard = async () => {
  if (!isAdmin(auth.currentUser)) return;

  refreshButton.disabled = true;
  setStatus("جارٍ تحديث بيانات Firestore…");

  try {
    const logsReference = collection(db, DEVICE_COLLECTION);
    const downloadDevicesQuery = query(logsReference, where("downloadCount", ">", 0));
    const latestLogsQuery = query(logsReference, orderBy("lastVisit", "desc"), limit(100));

    const [allDevices, downloadDevices, latestLogs] = await Promise.all([
      getCountFromServer(logsReference),
      getCountFromServer(downloadDevicesQuery),
      getDocs(latestLogsQuery)
    ]);

    const recentDownloadRequests = latestLogs.docs.reduce(
      (total, item) => total + (Number(item.data().downloadCount) || 0),
      0
    );

    document.querySelector("#total-devices").textContent = allDevices.data().count.toLocaleString("ar-EG");
    document.querySelector("#downloading-devices").textContent = downloadDevices.data().count.toLocaleString("ar-EG");
    document.querySelector("#download-requests").textContent = recentDownloadRequests.toLocaleString("ar-EG");
    document.querySelector("#last-updated").textContent = `آخر تحديث: ${formatDate(new Date())}`;
    renderRows(latestLogs.docs);
    setStatus("تم تحديث البيانات بنجاح.", "success");
  } catch (error) {
    console.error("تعذر جلب بيانات Firestore.", error);
    const permissionMessage = error.code === "permission-denied"
      ? "لا توجد صلاحية للقراءة. راجع إعداد حساب المدير وقواعد Firestore في ملف FIRESTORE_SETUP.md."
      : "تعذر تحميل البيانات حاليًا. تحقق من اتصال الإنترنت وإعداد Firebase.";
    renderErrorRow(permissionMessage);
    setStatus(permissionMessage, "error");
  } finally {
    refreshButton.disabled = false;
  }
};

const showLogin = () => {
  dashboardView.hidden = true;
  loginView.hidden = false;
  passwordInput.value = "";
};

const showDashboard = () => {
  loginView.hidden = true;
  dashboardView.hidden = false;
  loadDashboard();
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError();

  if (usernameInput.value.trim().toLowerCase() !== ADMIN_USERNAME) {
    setLoginError("اسم المستخدم غير صحيح.");
    return;
  }

  if (!passwordInput.value) {
    setLoginError("أدخل كلمة المرور.");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "جارٍ التحقق…";

  try {
    const credential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, passwordInput.value);
    if (!isAdmin(credential.user)) {
      await signOut(auth);
      throw new Error("unauthorized-admin-account");
    }
  } catch (error) {
    console.error("فشل دخول المدير.", error);
    const message = error.code === "auth/invalid-credential"
      ? "اسم المستخدم أو كلمة المرور غير صحيحين."
      : error.message === "unauthorized-admin-account"
        ? "هذا الحساب غير مصرح له بعرض لوحة التحكم."
        : "تعذر تسجيل الدخول. تأكد من تفعيل Email/Password وإنشاء حساب المدير في Firebase.";
    setLoginError(message);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "دخول آمن";
  }
});

refreshButton.addEventListener("click", loadDashboard);
logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (isAdmin(user)) {
    showDashboard();
  } else {
    showLogin();
  }
});
