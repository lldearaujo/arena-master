import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "./tokens";

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, tokens.space.sm);

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: tokens.color.bgCard,
        borderTopLeftRadius: tokens.radius.lg,
        borderTopRightRadius: tokens.radius.lg,
        paddingTop: tokens.space.md,
        paddingBottom: bottomPadding,
        minHeight: 56 + bottomPadding,
        alignItems: "center",
        justifyContent: "space-around",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 12,
      }}
    >
      {state.routes
        .filter((route) => route.name !== "turma-checkins/[id]")
        .map((route) => {
          const { options } = descriptors[route.key];
          const label =
            (options.tabBarLabel as string) ??
            options.title ??
            route.name;
          const focusedRoute = state.routes[state.index];
          const isFocused = focusedRoute?.key === route.key;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: Platform.OS === "ios" ? 0 : tokens.space.xs,
              }}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarAccessibilityLabel ?? String(label)
              }
            >
              <View
                style={{
                  borderBottomWidth: isFocused ? 3 : 0,
                  borderBottomColor: tokens.color.primary,
                  paddingBottom: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: tokens.text.xs,
                    fontWeight: "600",
                    color: isFocused
                      ? tokens.color.primary
                      : tokens.color.textOnPrimary,
                  }}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
    </View>
  );
}
