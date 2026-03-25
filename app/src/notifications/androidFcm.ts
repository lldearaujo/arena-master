import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "../api/client";

const CHANNEL_ID = "default";

function storageKeyForUser(userId: number): string {
  return `@arena_fcm_token_${userId}`;
}

export function isLikelyExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Avisos",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export type RegisterFcmResult =
  | { ok: true; token: string }
  | { ok: false; reason: "not_android" | "expo_go" | "simulator" | "permission_denied" | "no_token" | "sync_failed" };

/**
 * Obtém o token FCM nativo no Android (compatível com o endpoint legado do backend)
 * e envia-o para a API quando mudar em relação ao último registo local.
 */
export async function registerAndroidFcmAndSync(userId: number): Promise<RegisterFcmResult> {
  if (Platform.OS !== "android") {
    return { ok: false, reason: "not_android" };
  }
  if (isLikelyExpoGo()) {
    return { ok: false, reason: "expo_go" };
  }
  if (!Device.isDevice) {
    return { ok: false, reason: "simulator" };
  }

  await ensureAndroidNotificationChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return { ok: false, reason: "permission_denied" };
  }

  const devicePush = await Notifications.getDevicePushTokenAsync();
  if (devicePush.type !== "android" || !devicePush.data) {
    return { ok: false, reason: "no_token" };
  }
  const token = String(devicePush.data);

  const storageKey = storageKeyForUser(userId);
  const last = await AsyncStorage.getItem(storageKey);
  if (last === token) {
    return { ok: true, token };
  }

  try {
    await api.patch("/api/users/me", { fcm_token: token });
    await AsyncStorage.setItem(storageKey, token);
  } catch {
    return { ok: false, reason: "sync_failed" };
  }

  return { ok: true, token };
}
