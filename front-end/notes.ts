// some notes were taken during creating the project: 
// 1- design note : 
// ==      <div className="[]_section min-h-screen py-16 md:py-24 font-manrope" id = "[]_section">
// ==          <div className="container mx-auto px-4" >
// ==          </div>
// ==      </div>


// 2 - RHF
// List of validation rules supported:

// required

// min

// max

// minLength

// maxLength

// pattern

// validate



// ============================================
// ============================================
// ============================================
// ============================================
// token rotation مع ال   protected routes مشكلة ال 
// public routes ( sign in / up ) : 
// في حال لا يوجد اكسس توكن ويوجد ريفريش توكن >> يعني اليوزر مسجل فبالتالي يتم توجيه للبروفايل ومن هناك يطلب ريكوست فيعطيه 401 ثم يعمل ريفريش 
// في حال لا يوجد ريفريش توكن يعني مش مسجل >> يبقى ولا يتم توجيهه 

// protected routes (dashboard) : 
// في حال لا يوجد اكسس توكن ويوجد ريفريش توكن >> يعني اليوزر مسجل فبالتالي يبقى ومن هناك يطلب ريكوست فيعطيه 401 ثم يعمل ريفريش 
// في حال لا يوجد ريفريش توكن يعني مش مسجل >> يتم توجيهه لللوجين او الساين ان  


// القاعدة العامة : 
// accessToken || refreshToken : يعتبر اليوزر مسجل دخول اذا 
// !refreshToken && !accessToken :  لا يعتبر مسجل دخول اذا  

// الحالة 1: Public Routes

// مثل:

// /login
// /register
// السيناريو 1
// access_token موجود

// المستخدم مسجل دخول.

// إذن:

// redirect → dashboard
// السيناريو 2
// access_token غير موجود
// refresh_token موجود

// هذا يعني غالبًا:

// access expired
// user still authenticated

// إذن:

// redirect → dashboard

// لأن الداشبورد سيعمل request → refresh.

// السيناريو 3
// لا access
// لا refresh

// هذا مستخدم غير مسجل.

// إذن:

// allow
// الحالة 2: Protected Routes

// مثل:

// /dashboard
// /profile
// /settings
// السيناريو 1
// access_token موجود

// يسمح بالدخول.

// السيناريو 2
// access_token غير موجود
// refresh_token موجود

// هذا غالبًا:

// access expired

// لكن المستخدم ما زال مسجل.

// إذن:

// allow

// ثم الصفحة ستفعل:

// request → 401 → refresh
// السيناريو 3
// لا access
// لا refresh

// مستخدم غير مسجل.

// إذن:

// redirect → login
// القاعدة الذهبية

// الميدل وير يعتمد فقط على:

// refresh_token

// لتحديد إن كان المستخدم قد يكون مسجل دخول.