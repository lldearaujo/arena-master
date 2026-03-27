import Constants from "expo-constants";

function isLikelyExpoGo(): boolean {
  // Em Expo Go, costuma ser "expo". Em alguns cenários pode ser "guest".
  // Para o nosso objetivo (evitar warning do expo-notifications), tratamos ambos como Expo Go.
  return Constants.appOwnership === "expo" || Constants.appOwnership === "guest";
}

export async function configurePushNotificationsIfAvailable(): Promise<void> {
  // No Expo Go (SDK 53+), push remoto não é suportado e o import dispara warning.
  if (isLikelyExpoGo()) return;

  const Notifications: any = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
