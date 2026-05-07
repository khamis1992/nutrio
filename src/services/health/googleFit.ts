/**
 * Google Fit Integration Service
 * Fetches workout data from Google Fit API
 * 
 * Supports:
 * - Native Android (via @capacitor/google-fit plugin)
 * - Web (via Google Fit REST API)
 */

import { isNative, isAndroid, isWeb } from "@/lib/capacitor";
import { WorkoutData } from "@/hooks/useHealthIntegration";

export interface GoogleFitAuth {
  accessToken: string;
  expiresAt: number;
}

// Google Fit API configuration
const GOOGLE_FIT_SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.location.read",
];

// Workout type mapping from Google Fit to our format
const WORKOUT_TYPE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Running",
  2: "Cycling",
  3: "Walking",
  4: "Hiking",
  5: "Swimming",
  6: "Workout",
  7: "Yoga",
  8: "Pilates",
  9: "Strength Training",
  10: "CrossFit",
  11: "HIIT",
  12: "Dance",
  13: "Sports",
  14: "Winter Sports",
  15: "Water Sports",
  16: "Martial Arts",
  17: "Boxing",
  18: "Rowing",
  19: "Elliptical",
  20: "Stair Climb",
  21: "Sports",
};

/**
 * Check if Google Fit is available
 */
export async function isAvailable(): Promise<boolean> {
  if (!isNative) {
    // For web, check if Google Fit API is accessible
    return isWeb;
  }
  
  if (!isAndroid) {
    return false;
  }
  
  try {
    // Check if Google Fit plugin is available
    const { GoogleFit } = await import("@capacitor-community/google-fit");
    return await GoogleFit.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Request permissions for Google Fit data
 */
export async function requestPermissions(requested: {
  activity?: boolean;
  body?: boolean;
  location?: boolean;
}): Promise<{ activity: boolean; body: boolean; location: boolean } | null> {
  if (isAndroid && isNative) {
    try {
      const { GoogleFit } = await import("@capacitor-community/google-fit");
      const result = await GoogleFit.requestPermissions({
        readPermissions: Object.keys(requested),
      });
      return {
        activity: result.activity ?? false,
        body: result.body ?? false,
        location: result.location ?? false,
      };
    } catch {
      return null;
    }
  }
  
  // For web, we'll need OAuth flow
  return null;
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

async function base64urlEncode(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hash = await sha256(codeVerifier);
  return base64urlEncode(hash);
}

/**
 * Get Google Fit OAuth URL for web with PKCE
 */
export async function getAuthUrl(clientId: string, redirectUri: string): Promise<string> {
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  sessionStorage.setItem('google_oauth_state', state);
  sessionStorage.setItem('google_code_verifier', codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_FIT_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleFitAuth | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch workouts from Google Fit API
 */
export async function getWorkouts(
  auth: GoogleFitAuth,
  startTime: Date,
  endTime: Date
): Promise<WorkoutData[]> {
  const startMillis = startTime.getTime();
  const endMillis = endTime.getTime();
  
  try {
    // Use Google Fit REST API
    const response = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aggregateBy: [
            {
              dataTypeName: "com.google.activity.segment",
            },
            {
              dataTypeName: "com.google.calories.expended",
            },
            {
              dataTypeName: "com.google.duration",
            },
          ],
          startTimeMillis: startMillis,
          endTimeMillis: endMillis,
          bucketByActivityType: {
            activityType: 1, // Group by activity type
          },
        }),
      }
    );
    
    if (!response.ok) {
      console.error("Google Fit API error:", await response.text());
      return [];
    }
    
    const data = await response.json();
    const workouts: WorkoutData[] = [];
    
    if (data.bucket) {
      for (const bucket of data.bucket) {
        if (!bucket.dataset) continue;
        
        const activityDataset = bucket.dataset.find(
          (d: any) => d.point && d.point.length > 0
        );
        
        if (!activityDataset?.point?.[0]) continue;
        
        const point = activityDataset.point[0];
        const activityType = point.value?.[0]?.intVal || 0;
        
        // Get duration
        const durationDataset = bucket.dataset.find(
          (d: any) => d.dataSourceId?.includes("duration")
        );
        const duration = durationDataset?.point?.[0]?.value?.[0]?.intVal || 0;
        
        // Get calories
        const caloriesDataset = bucket.dataset.find(
          (d: any) => d.dataSourceId?.includes("calories")
        );
        const calories = caloriesDataset?.point?.[0]?.value?.[0]?.fpVal || 0;
        
        const startTimeDate = new Date(bucket.startTimeMillis);
        const endTimeDate = new Date(bucket.endTimeMillis);
        
        workouts.push({
          id: `google-fit-${bucket.startTimeMillis}`,
          type: WORKOUT_TYPE_MAP[activityType] || "Workout",
          startTime: startTimeDate.toISOString(),
          endTime: endTimeDate.toISOString(),
          calories: Math.round(calories),
          duration: Math.round(duration / 60000), // Convert ms to minutes
        });
      }
    }
    
    return workouts;
  } catch (error) {
    console.error("Failed to fetch Google Fit workouts:", error);
    return [];
  }
}

/**
 * Get health data for a date range (wrapper for full sync)
 */
export async function getHealthData(dateRange: {
  start: Date;
  end: Date;
}): Promise<{
  steps?: number;
  caloriesBurned?: number;
  activeMinutes?: number;
  workouts?: WorkoutData[];
  date: string;
} | null> {
  // This would need proper OAuth setup
  // For now, return null to fall back to other methods
  console.warn("Google Fit web integration requires OAuth setup");
  return null;
}

/**
 * Write nutrition data to Google Fit
 */
export async function writeNutritionData(_data: {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: Date;
}): Promise<boolean> {
  // Would require write permissions and OAuth
  console.warn("Google Fit write requires OAuth setup");
  return false;
}