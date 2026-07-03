# 📲 Health Ecosystem Integration: HealthKit & Google Fit

Nutrio synchronizes biometric and activity data from external health providers to eliminate manual entry and increase tracking accuracy.

---

## 1. Integration Architecture
Nutrio uses a **Bridged Sync Pattern** to handle the differences between iOS (Apple Health) and Android (Google Fit).

### 🔄 The Sync Pipeline
`External Provider` $\rightarrow$ `Capacitor Plugin` $\rightarrow$ `Normalized Data Object` $\rightarrow$ `Supabase Table`.

### ⚙️ Provider-Specific Implementation
- **Apple Health (HealthKit)**: 
  - Uses a "Permission Request" flow to access specifically requested read/write keys.
  - Syncs Steps, Active Energy Burned, and Sleep data.
- **Google Fit**:
  - Uses OAuth2.0 to authenticate with the Google Health Connect API.
  - Syncs Steps, Heart Rate, and Distance.

---

## 2. Data Normalization & Mapping
Because different providers report data in different formats, Nutrio uses a transformation layer.

| External Key | Target Nutrio Table | Mapping Logic |
| :--- | :--- | :--- |
| `steps` | `daily_activity` | $\sum$ steps per UTC day $\rightarrow$ total_steps |
| `energy_burned` | `daily_activity` | kcal $\rightarrow$ activity_calories |
| `weight` | `weight_tracking` | lb/kg $\rightarrow$ normalized_kg |
| `sleep_duration` | `sleep_logs` | seconds $\rightarrow$ hours/minutes |

---

## 3. The Sync Engine Logic

### 🕒 Synchronization Cadence
To avoid battery drain and API rate limiting, Nutrio employs a **Tiered Sync Strategy**:
- **Immediate Sync**: Triggered when the user manually opens the `/step-counter` or `/tracker` pages.
- **Background Sync**: Triggered every 4 hours via a background task (if permitted by the OS).
- **On-Event Sync**: Triggered when the app moves from background to foreground.

### 🛠️ Collision Handling
When a manual entry conflicts with a synced value:
- **Weight**: Manual entry takes precedence over synced data (as users provide the most accurate scale readings).
- **Steps**: The system takes the **maximum** value between the manual entry and the synced provider to prevent under-counting.

---

## 4. Privacy & Security
- **Explicit Consent**: Users must explicitly grant permission for each specific metric.
- **Zero-Plaintext Storage**: Biometric data is stored using RLS-protected tables, ensuring no third-party access beyond the user and their assigned coach.
- **Encryption**: All data transmitted between the Health Providers and Supabase is encrypted via HTTPS.

`💡 Developer Note: When debugging sync issues, check the Capacitor logs for "Permission Denied" errors, as OS-level updates frequently reset HealthKit/Google Fit permissions.`
