# Bells Attend - Codebase Map

This document provides a comprehensive mapping of the "Bells Attend" codebase as of its current state in Expo (React Native), preparing for refactoring to a Progressive Web App (PWA).

## 1. Directory Tree

```
.
├── app/
│   ├── login/
│   │   └── index.tsx                 # Login Screen
│   ├── signup/
│   │   └── index.tsx                 # Signup Screen
│   ├── student/
│   │   ├── index.tsx                 # Student Dashboard
│   │   └── AvailableBroadcastScreen.tsx # Join Broadcast Scanning
│   ├── teacher/
│   │   ├── index.tsx                 # Teacher Dashboard
│   │   └── BroadcastScreen.tsx      # Broadcast Management
│   └── index.tsx                     # Main Entry & Navigation Stack
├── assets/                           # Images, icons, and static assets
├── config/
│   ├── appwriteConfig.js             # Appwrite Client Initialization
│   └── firebaseconfig.js             # Firebase Auth & Firestore Initialization
├── hooks/                            # Custom React Hooks
│   ├── useColorScheme.ts
│   ├── useColorScheme.web.ts
│   └── useThemeColor.ts
├── utils/                            # Shared Utilities
│   ├── fileExport.tsx                # PDF/XML Export Helpers
│   └── locationHelpers.tsx           # Geolocation & Distance Logic
├── app.json                          # Expo Configuration
├── package.json                      # Dependencies & Scripts
├── tsconfig.json                     # TypeScript Configuration
└── tailwind.config.js                # NativeWind/Tailwind Configuration
```

## 2. File Directory

### `/app` (Navigation & Screens)
- **`index.tsx`**: The root component. It defines the `NavigationContainer` and a `NativeStack` containing all primary routes (`Login`, `SignUp`, `TeacherScreen`, `StudentScreen`, etc.).
- **`login/index.tsx`**: Handles user authentication via Firebase. It identifies if the user is a student or teacher by checking respective Firestore collections (`students`/`teachers`) and routes them to the correct dashboard.
- **`signup/index.tsx`**: Allows new users to register. Collects role-specific data (Matric Number for students, Teacher ID for teachers) and stores it in Firestore.
- **`student/index.tsx` (Dashboard)**: Displays student-specific information, past attendance history fetched from Firestore, and provides a navigation button to find active broadcasts.
- **`student/AvailableBroadcastScreen.tsx`**: The "Scanning" interface. It uses geolocation to find active broadcasts within a specific radius and allows the student to check-in.
- **`teacher/index.tsx` (Dashboard)**: Displays teacher-specific info, a list of past broadcasts (active and ended), and tools to export attendance records to PDF.
- **`teacher/BroadcastScreen.tsx`**: The control center for teachers to start a new attendance session. Sets the "Radius" for check-in and monitors joined students in real-time.

### `/config` (Infrastructure)
- **`firebaseconfig.js`**: Core backend configuration. Initializes Firebase App, Auth, and Firestore. This is the primary data persistence layer.
- **`appwriteConfig.js`**: Configuration for Appwrite. While initialized, Firestore appears to be the primary database used in the current screen implementations.

### `/utils` (Helpers)
- **`locationHelpers.tsx`**: Wrapper for `expo-location`. Provides `getCurrentLocation()` and a geofencing utility `isWithinRadius()` using `geolib`.
- **`fileExport.tsx`**: Contains logic for generating PDF and XML files from attendance data, leveraging `jspdf`.

---

## 3. Component & Function Mapping

### Core UI Components
- **Dashboard Cards**: Custom `View` containers with `StyleSheet` for displaying broadcast details.
- **Scanning Animation**: SVG-based animated radar in `AvailableBroadcastScreen.tsx`.
- **Modals**: Used for profile editing and confirmation dialogs across all dashboards.
- **Custom Alert Box**: A custom UI implementation of alerts used in `AvailableBroadcastScreen.tsx` and `BroadcastScreen.tsx`.

### Key Hooks
- **`useState` / `useEffect`**: Extensively used for local state (broadcast lists, user data, loading states) and lifecycle events (fetching data on mount).
- **`useRouter` (expo-router)**: Used for navigation between screens.
- **`useColorScheme`**: Custom hook for theme management (light/dark mode).

### Core Functions & Implementation Details

#### 1. Geolocation (`expo-location`)
- **`getCurrentLocation` (`utils/locationHelpers.tsx`)**:
  - Requests foreground permissions.
  - Returns `latitude` and `longitude`.
- **Usage**:
  - **Teacher**: Used in `startBroadcast` to pin the teacher's current location to the broadcast document in Firestore.
  - **Student**: Used in `fetchNearbyBroadcasts` to calculate the distance from available broadcasts.

#### 2. Attendance Check-in State Management
- **Teacher Action**: Calls `addDoc` to the `broadcasts` collection.
- **Real-time Monitoring**: `BroadcastScreen.tsx` uses a `setInterval` (1 second) to re-fetch and update participant counts for active broadcasts.
- **Student Action**: Calls `setDoc` to `broadcasts/{broadcastId}/participants/{userId}`. This creates a sub-collection entry representing a successful sign-in.

#### 3. API & Database
- **Auth**: Firebase Authentication (`auth`).
- **Database**: Firestore (`firestore`/`db`).
- **Storage**: Appwrite is configured but Firestore sub-collections are primarily used for data structure.
- **PDF Export**: `jsPDF` is used to build the document structure, and `expo-sharing`/`expo-file-system` handle the native file save/share on mobile.

---

## 4. Refactor Target Notes (Expo to PWA)

To transition from Expo to a PWA, the following modules must be replaced with Web Standard equivalents:

| Expo/Native Module | Web PWA Equivalent | Refactor Notes |
| :--- | :--- | :--- |
| `expo-location` | `navigator.geolocation` | Need to handle permission states in the browser. |
| `expo-notifications` | `Service Workers` + `Push API` | Mobile-style local notifications need browser notification permissions. |
| `expo-print` / `expo-sharing` | `window.print()` / `Blob` | Replace `Sharing.shareAsync` with direct file downloads via `<a>` tags or `saveAs`. |
| `@react-native-async-storage` | `localStorage` | Direct replacement for persistent session keys. |
| `react-native-svg` | Standard `<svg>` | Remove native-specific wrapper components. |
| `expo-router` / `NativeStack` | `React Router` | PWA needs URL support for bookmarking and history. |
| `react-native` UI | HTML5 / CSS3 (Tailwind) | Replace `View`, `Text`, `TouchableOpacity` with semantic HTML. |

### Architecture Shift: From Native to Web
- **Routing**: Shift from stack-based navigation to URL-based routing.
- **Permissions**: Browsers are stricter with Location and Notifications; must handle "denied" or "ignored" states more gracefully.
- **Styling**: NativeWind is used; this can be easily transitioned to standard Tailwind CSS for Web.
- **Data Fetching**: The Firestore Web SDK (Modular v9+) should be used to minimize bundle size.
