export type LoadingContext =
  | 'app_start'
  | 'route'
  | 'dashboard'
  | 'students'
  | 'faculty'
  | 'classes'
  | 'requests'
  | 'reports'
  | 'timetable'
  | 'assignments'
  | 'materials'
  | 'chat'
  | 'notifications'
  | 'results'
  | 'history'
  | 'live_monitor'
  | 'academics'
  | 'attendance_roster'
  | 'advisees'
  | 'gps_session'
  | 'attendance_history'
  | 'skip_calculator'
  | 'settings'
  | 'devices'
  | 'ai_assistant';

export interface LoadingTextPair {
  primary: string;
  helper: string;
}

export type AppLang = 'en' | 'ta';

// Thirukkural 391, 1, 2, 314 — two lines each
export const KURALS: ReadonlyArray<readonly [string, string]> = [
  ['கற்க கசடறக் கற்பவை கற்றபின்', 'நிற்க அதற்குத் தக'],
  ['அகர முதல எழுத்தெல்லாம் ஆதி', 'பகவன் முதற்றே உலகு'],
  ['கற்றதனால் ஆய பயனென்கொல்', 'வாலறிவன் நற்றாள் தொழாஅர் எனின்'],
  ['இன்னா செய்தாரை ஒறுத்தல் அவர்நாண', 'நன்னயம் செய்து விடல்'],
];

const CONTEXT_MESSAGES: Record<AppLang, Record<LoadingContext, LoadingTextPair>> = {
  en: {
    app_start: { primary: 'Loading Velan AI', helper: 'Checking your saved sign-in.' },
    route: { primary: 'Opening page', helper: 'Preparing the next view.' },
    dashboard: { primary: 'Loading your workspace', helper: 'Getting your overview ready.' },
    students: { primary: 'Loading students', helper: 'Sorted by register number.' },
    faculty: { primary: 'Loading faculty', helper: 'Fetching department directory.' },
    classes: { primary: 'Loading classes', helper: 'Fetching sections, advisors and mentors.' },
    requests: { primary: 'Loading requests', helper: 'Checking pending approvals.' },
    reports: { primary: 'Loading reports', helper: 'Preparing attendance summaries.' },
    timetable: { primary: 'Loading timetable', helper: 'Fetching class schedule slots.' },
    assignments: { primary: 'Loading assignments', helper: 'Fetching tasks and due dates.' },
    materials: { primary: 'Loading materials', helper: 'Fetching notes, slides and resources.' },
    chat: { primary: 'Loading class chat', helper: 'Fetching recent messages.' },
    notifications: { primary: 'Loading notifications', helper: 'Checking recent updates.' },
    results: { primary: 'Loading results', helper: 'Fetching grades and SGPA records.' },
    history: { primary: 'Loading attendance history', helper: 'Fetching saved class sessions.' },
    live_monitor: { primary: 'Loading live monitor', helper: 'Checking active sessions and status.' },
    academics: { primary: 'Loading academics', helper: 'Fetching semesters, grades and CGPA.' },
    attendance_roster: { primary: 'Loading class roster', helper: 'Fetching students for attendance.' },
    advisees: { primary: 'Loading advisees', helper: 'Fetching your mentored students.' },
    gps_session: { primary: 'Checking attendance session', helper: 'Looking for an active session in your class.' },
    attendance_history: { primary: 'Loading your attendance', helper: 'Fetching subject-wise percentages.' },
    skip_calculator: { primary: 'Calculating skip margins', helper: 'Checking your timetable and attendance.' },
    settings: { primary: 'Loading settings', helper: 'Fetching your profile and preferences.' },
    devices: { primary: 'Loading devices', helper: 'Checking registered devices.' },
    ai_assistant: { primary: 'Loading study assistant', helper: 'Preparing your study workspace.' },
  },
  ta: {
    app_start: { primary: 'வேலன் AI ஏற்றப்படுகிறது', helper: 'உங்கள் உள்நுழைவு சரிபார்க்கப்படுகிறது.' },
    route: { primary: 'பக்கம் திறக்கப்படுகிறது', helper: 'அடுத்த திரை தயாராகிறது.' },
    dashboard: { primary: 'முகப்பு ஏற்றப்படுகிறது', helper: 'உங்கள் விவரங்கள் தயாராகின்றன.' },
    students: { primary: 'மாணவர்கள் ஏற்றப்படுகின்றனர்', helper: 'பதிவு எண் வரிசையில்.' },
    faculty: { primary: 'ஆசிரியர்கள் ஏற்றப்படுகின்றனர்', helper: 'துறை விவரங்கள் பெறப்படுகின்றன.' },
    classes: { primary: 'வகுப்புகள் ஏற்றப்படுகின்றன', helper: 'பிரிவுகள் மற்றும் ஆலோசகர் விவரங்கள்.' },
    requests: { primary: 'கோரிக்கைகள் ஏற்றப்படுகின்றன', helper: 'நிலுவையில் உள்ள கோரிக்கைகள்.' },
    reports: { primary: 'அறிக்கைகள் ஏற்றப்படுகின்றன', helper: 'வருகைப் பதிவு சுருக்கம்.' },
    timetable: { primary: 'நேர அட்டவணை ஏற்றப்படுகிறது', helper: 'வகுப்பு நேரங்கள் பெறப்படுகின்றன.' },
    assignments: { primary: 'பணிகள் ஏற்றப்படுகின்றன', helper: 'பாடப் பணிகள் மற்றும் கடைசித் தேதி.' },
    materials: { primary: 'பாடக் குறிப்புகள் ஏற்றப்படுகின்றன', helper: 'குறிப்புகள் மற்றும் கோப்புகள்.' },
    chat: { primary: 'வகுப்பு உரையாடல் ஏற்றப்படுகிறது', helper: 'சமீபத்திய செய்திகள் பெறப்படுகின்றன.' },
    notifications: { primary: 'அறிவிப்புகள் ஏற்றப்படுகின்றன', helper: 'சமீபத்திய தகவல்கள்.' },
    results: { primary: 'மதிப்பெண்கள் ஏற்றப்படுகின்றன', helper: 'தரநிலை மற்றும் SGPA விவரங்கள்.' },
    history: { primary: 'வருகை வரலாறு ஏற்றப்படுகிறது', helper: 'சேமிக்கப்பட்ட வகுப்புப் பதிவுகள்.' },
    live_monitor: { primary: 'நேரடி கண்காணிப்பு ஏற்றப்படுகிறது', helper: 'நடப்பு வகுப்புகள் சரிபார்க்கப்படுகின்றன.' },
    academics: { primary: 'கல்வி விவரங்கள் ஏற்றப்படுகின்றன', helper: 'பருவங்கள் மற்றும் CGPA.' },
    attendance_roster: { primary: 'மாணவர் பட்டியல் ஏற்றப்படுகிறது', helper: 'வருகைப் பதிவிற்கு தயாராகிறது.' },
    advisees: { primary: 'வழிகாட்டு மாணவர்கள் ஏற்றப்படுகின்றனர்', helper: 'மாணவர் விவரங்கள் பெறப்படுகின்றன.' },
    gps_session: { primary: 'வருகை அமர்வு சரிபார்க்கப்படுகிறது', helper: 'நடப்பு வகுப்பு அமர்வு தேடப்படுகிறது.' },
    attendance_history: { primary: 'உங்கள் வருகைப் பதிவு ஏற்றப்படுகிறது', helper: 'பாட வாரியான சதவீதம்.' },
    skip_calculator: { primary: 'விடுப்புக் கணக்கீடு தயாராகிறது', helper: 'நேர அட்டவணை சரிபார்க்கப்படுகிறது.' },
    settings: { primary: 'அமைப்புகள் ஏற்றப்படுகின்றன', helper: 'சுயவிவரம் பெறப்படுகிறது.' },
    devices: { primary: 'சாதனங்கள் ஏற்றப்படுகின்றன', helper: 'பதிவு செய்யப்பட்ட சாதனங்கள்.' },
    ai_assistant: { primary: 'படிப்பு உதவியாளர் ஏற்றப்படுகிறது', helper: 'உங்கள் படிப்புத் தளம் தயாராகிறது.' },
  },
};

const ROLE_DASHBOARD_OVERRIDE: Record<AppLang, Record<string, LoadingTextPair>> = {
  en: {
    STUDENT: { primary: 'Loading your attendance', helper: 'Your classes, timetable and attendance percentage.' },
    FACULTY: { primary: 'Loading your classes', helper: "Today's periods and attendance sessions." },
    ADMIN: { primary: 'Loading the admin dashboard', helper: 'Live attendance, classes and alerts.' },
  },
  ta: {
    STUDENT: { primary: 'உங்கள் வருகைப் பதிவு ஏற்றப்படுகிறது', helper: 'வகுப்புகள், நேர அட்டவணை மற்றும் சதவீதம்.' },
    FACULTY: { primary: 'உங்கள் வகுப்புகள் ஏற்றப்படுகின்றன', helper: 'இன்றைய பாடவேளைகள் மற்றும் வருகைப் பதிவு.' },
    ADMIN: { primary: 'நிர்வாக முகப்பு ஏற்றப்படுகிறது', helper: 'நேரடி வருகை, வகுப்புகள் மற்றும் அறிவிப்புகள்.' },
  },
};

export const ELAPSED_STAGE_MESSAGES: Record<AppLang, Record<'data' | 'waking' | 'slow' | 'offline' | 'error_timeout' | 'error_reach', LoadingTextPair>> = {
  en: {
    data: { primary: 'Getting your data ready', helper: 'Fetching your latest records.' },
    waking: { primary: 'Waking up the server', helper: 'Free servers can take a little while to start.' },
    slow: { primary: 'Still working on it', helper: 'The server is slow right now. This can take up to a minute.' },
    offline: { primary: 'You are offline. Reconnecting...', helper: 'Waiting for your connection to return.' },
    error_timeout: { primary: 'This is taking too long', helper: 'Your session is safe. Please try again in a moment.' },
    error_reach: { primary: 'We could not reach the server', helper: 'Your session is safe. Please try again in a moment.' },
  },
  ta: {
    data: { primary: 'தரவு தயாராகிறது', helper: 'உங்கள் சமீபத்திய பதிவுகள் பெறப்படுகின்றன.' },
    waking: { primary: 'சேவையகம் தொடங்கப்படுகிறது', helper: 'இலவச சேவையகம் தொடங்க சற்று நேரம் ஆகலாம்.' },
    slow: { primary: 'தொடர்ந்து முயற்சிக்கிறது', helper: 'சேவையகம் இப்போது மெதுவாக உள்ளது. ஒரு நிமிடம் வரை ஆகலாம்.' },
    offline: { primary: 'இணைய இணைப்பு இல்லை...', helper: 'இணைப்பு திரும்பியவுடன் தொடரும்.' },
    error_timeout: { primary: 'மிக நீண்ட நேரம் எடுக்கிறது', helper: 'உங்கள் அமர்வு பாதுகாப்பாக உள்ளது. மீண்டும் முயற்சிக்கவும்.' },
    error_reach: { primary: 'சேவையகத்தைத் தொடர்பு கொள்ள முடியவில்லை', helper: 'உங்கள் அமர்வு பாதுகாப்பாக உள்ளது. மீண்டும் முயற்சிக்கவும்.' },
  },
};

export function getAppLanguage(): AppLang {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('velan_lang') || document.documentElement.lang || 'en';
  return stored.toLowerCase().startsWith('ta') ? 'ta' : 'en';
}

export function getContextMessage(context: LoadingContext, role?: string, lang: AppLang = getAppLanguage()): LoadingTextPair {
  if (context === 'dashboard' && role && ROLE_DASHBOARD_OVERRIDE[lang][role]) {
    return ROLE_DASHBOARD_OVERRIDE[lang][role];
  }
  return CONTEXT_MESSAGES[lang][context] || CONTEXT_MESSAGES[lang].dashboard;
}
