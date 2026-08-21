# إعداد Firebase لسجل أجهزة KumoScan

> **هذه الخطوات مطلوبة مرة واحدة** قبل نشر الملفات. لقد وُضع إعداد مشروع Firebase الذي أرسلته داخل `firebase-config.js`.

## 1. تفعيل الخدمات

افتح [Firebase Console](https://console.firebase.google.com/) لمشروع **kumoscan-9a38c** ثم نفّذ الآتي:

| الخدمة | الإجراء المطلوب |
|---|---|
| Cloud Firestore | أنشئ قاعدة بيانات Firestore إن لم تكن منشأة مسبقًا. اختر موقع القاعدة المناسب قبل البدء. |
| Authentication | من **Sign-in method** فعّل **Email/Password** وفعّل **Anonymous**. |
| Users | أضف مستخدمًا جديدًا بالبيانات التالية: البريد `admin@kumoscan.local`، وكلمة المرور `KumoScan`. |

اسم المستخدم الذي يظهر في صفحة `dashboard.html` هو **admin**. عند الدخول، تُحوَّل بياناته داخليًا إلى بريد المدير أعلاه عبر Firebase Authentication، ولا تُخزَّن كلمة المرور في ملفات الموقع.

## 2. قواعد Firestore الآمنة

من صفحة **Firestore Database → Rules** استبدل القواعد الحالية بالنص التالي ثم اضغط **Publish**:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn() && request.auth.token.email == 'admin@kumoscan.local';
    }

    match /deviceLogs/{deviceId} {
      // يسمح للجهاز المجهول بإنشاء سجله باسم معرّف Firebase الخاص به فقط.
      allow create: if signedIn()
                    && request.auth.uid == deviceId
                    && request.resource.data.visitorId == request.auth.uid;

      // يسمح للجهاز بتحديث سجله فقط، ولا يحق له تغيير المعرّف.
      allow update: if signedIn()
                    && request.auth.uid == deviceId
                    && resource.data.visitorId == request.auth.uid
                    && request.resource.data.visitorId == request.auth.uid;

      // المدير يقرأ جميع البيانات؛ والجهاز يقرأ سجله عند تنفيذ معاملة Firestore.
      allow get: if isAdmin() || (signedIn() && request.auth.uid == deviceId);
      allow list: if isAdmin();

      // لا يسمح بحذف السجلات من المتصفح.
      allow delete: if false;
    }
  }
}
```

هذه القواعد تمنع الزوار من قراءة قائمة الأجهزة أو سجلات الأجهزة الأخرى، بينما تسمح للوحة التحكم بالقراءة بعد مصادقة المدير. لا تستخدم قاعدة اختبار عامة مثل `allow read, write: if true` في بيئة الإنتاج.

## 3. بنية السجل

يكتب الموقع مستندًا واحدًا لكل جهاز/متصفح مصادَق مجهولًا داخل مجموعة `deviceLogs`. ويشمل الحقول التالية:

| الحقل | الوصف |
|---|---|
| `deviceBrand` و`deviceModel` | الشركة والموديل عندما يوفرهما المتصفح، مثل Xiaomi أو OPPO Reno 2. |
| `deviceType` و`platform` | نوع الجهاز والمنصة. |
| `browser` | اسم المتصفح المكتشف. |
| `language` و`languages` | لغة المتصفح واللغات المفضلة. |
| `country` | رمز بلد مستنتج من إعداد اللغة فقط عند توفره؛ لا يُستخلص موقع جغرافي دقيق. |
| `lastVisit` و`lastVisitClient` | آخر وقت دخول، مع وقت خادم Firestore ونسخة وقت العميل. |
| `visitCount` | عدد الزيارات المسجّلة للجهاز. |
| `downloadCount` و`lastDownload` | عدد ضغطات طلب التحميل وآخر وقت لها. |

لا يمكن للمتصفحات الحديثة دائمًا كشف موديل الجهاز بسبب ضوابط الخصوصية؛ وعند عدم توفره تعرض اللوحة **غير متاح**. كما أن **تحميلات اللوحة** تعني ضغط المستخدم على رابط تنزيل APK، ولا تعني تأكيد تثبيت التطبيق على الهاتف.

## 4. النشر والاستخدام

ارفع محتويات هذا المجلد إلى استضافة HTTPS تدعم الملفات الثابتة، مع الاحتفاظ بالمسارات كما هي. بعد النشر:

1. افتح `index.html` أو رابط الصفحة الرئيسية، وسيُسجل الجهاز تلقائيًا في Firestore.
2. اضغط زر تنزيل Android لتسجيل طلب تحميل التطبيق.
3. افتح `https://اسم-نطاقك/dashboard.html` للدخول إلى اللوحة باسم المستخدم `admin` وكلمة المرور `KumoScan`.

تضم الصفحة الرئيسية إشعارًا قصيرًا عن تسجيل بيانات تقنية غير تعريفية. تأكد من مواءمة سياسة الخصوصية العامة للموقع مع قوانين بلد جمهورك قبل النشر.
