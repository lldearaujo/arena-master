import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api/client";
import { tokens } from "../../src/ui/tokens";

type Plan = {
  id: number;
  dojo_id: number;
  name: string;
  description: string | null;
  price: number;
  credits_total: number;
  validity_days: number;
  active: boolean;
};

type FinanceSummary = {
  active_subscription: {
    id: number;
    plan_id: number;
    plan_name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    credits_total: number;
    credits_used: number;
    credits_remaining: number;
  } | null;
  subscriptions: unknown[];
  payments: unknown[];
  pix_config: unknown;
};

type Dojo = {
  id: number;
  name: string;
  logo_url: string | null;
};

export default function AlterarPlanoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const { data: summary } = useQuery({
    queryKey: ["finance-summary"],
    queryFn: async () => {
      const res = await api.get<FinanceSummary>("/api/finance/me/summary");
      return res.data;
    },
  });

  const { data: plans, isLoading, error } = useQuery({
    queryKey: ["finance-me-plans"],
    queryFn: async () => {
      const res = await api.get<Plan[]>("/api/finance/me/plans");
      return res.data;
    },
  });

  const { data: dojo } = useQuery({
    queryKey: ["dojo-me"],
    queryFn: async () => {
      const res = await api.get<Dojo>("/api/dojos/me");
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const changePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      await api.post("/api/finance/me/change-plan", { plan_id: planId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      if (Platform.OS !== "web") {
        Alert.alert(
          "Plano alterado",
          "Seu plano foi alterado. Envie o comprovante do novo valor na seção Financeiro.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        alert("Plano alterado. Envie o comprovante do novo valor na seção Financeiro.");
        router.back();
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Não foi possível alterar o plano. Tente novamente.";
      if (Platform.OS !== "web") {
        Alert.alert("Erro", msg);
      } else {
        alert(msg);
      }
    },
  });

  const currentPlanId = summary?.active_subscription?.plan_id ?? null;

  const handleSelectPlan = (plan: Plan) => {
    if (currentPlanId === plan.id) return;
    if (Platform.OS !== "web") {
      Alert.alert(
        "Alterar plano",
        `Deseja alterar para "${plan.name}"? Será gerada uma nova cobrança de R$ ${plan.price.toFixed(2)}.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Confirmar",
            onPress: () => changePlanMutation.mutate(plan.id),
          },
        ]
      );
    } else {
      if (confirm(`Alterar para "${plan.name}"? Nova cobrança de R$ ${plan.price.toFixed(2)}.`)) {
        changePlanMutation.mutate(plan.id);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      <View
        style={{
          backgroundColor: tokens.color.primary,
          borderBottomLeftRadius: tokens.radius.lg * 2,
          borderBottomRightRadius: tokens.radius.lg * 2,
          paddingTop: insets.top + tokens.space.md,
          paddingBottom: tokens.space.xl,
          paddingHorizontal: tokens.space.lg,
          alignItems: "center",
          shadowColor: tokens.color.textPrimary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        {dojo?.logo_url ? (
          <Image
            source={{
              uri: (() => {
                const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
                if (dojo.logo_url!.startsWith("http")) {
                  if (dojo.logo_url!.includes("localhost") || dojo.logo_url!.includes("127.0.0.1")) {
                    const path = dojo.logo_url!.replace(/^https?:\/\/[^/]+/, "");
                    return `${base}${path}`;
                  }
                  return dojo.logo_url!;
                }
                return `${base}${dojo.logo_url!.startsWith("/") ? "" : "/"}${dojo.logo_url}`;
              })(),
            }}
            style={{
              width: Math.min(screenWidth - tokens.space.lg * 4, 220),
              height: Math.min(screenWidth * 0.3, 120),
              resizeMode: "contain",
              marginBottom: tokens.space.lg,
            }}
          />
        ) : (
          dojo?.name && (
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.lg,
                fontWeight: "700",
                marginBottom: tokens.space.lg,
              }}
            >
              {dojo.name}
            </Text>
          )
        )}

        <View style={{ width: "100%" }}>
          <Pressable
            onPress={() => router.back()}
            style={{ alignSelf: "flex-start", marginBottom: tokens.space.sm }}
          >
            <Text
              style={{
                color: tokens.color.bgBody,
                fontSize: tokens.text.sm,
                fontWeight: "700",
              }}
            >
              ← Voltar
            </Text>
          </Pressable>
          <Text
            style={{
              color: tokens.color.bgBody,
              fontSize: tokens.text["2xl"],
              fontWeight: "800",
            }}
          >
            Alterar plano
          </Text>
          <Text
            style={{
              color: "#FDFCF7",
              fontSize: tokens.text.sm,
              marginTop: tokens.space.xs,
            }}
          >
            Escolha um plano. Será gerada uma nova cobrança para você enviar o comprovante.
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: tokens.space.lg,
          paddingBottom: tokens.space.xl + 80,
        }}
      >
        {isLoading && (
          <View style={{ alignItems: "center", paddingVertical: tokens.space.xl }}>
            <ActivityIndicator color={tokens.color.primary} />
          </View>
        )}
        {error && (
          <Text style={{ color: tokens.color.error, marginBottom: tokens.space.md }}>
            Não foi possível carregar os planos. Tente novamente.
          </Text>
        )}
        {plans?.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          return (
            <View
              key={plan.id}
              style={{
                backgroundColor: "#FEFBF2",
                borderRadius: tokens.radius.lg,
                padding: tokens.space.lg,
                marginBottom: tokens.space.md,
                borderWidth: 1,
                borderColor: "#E5D9B8",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: tokens.text.md,
                      fontWeight: "700",
                      color: tokens.color.textPrimary,
                    }}
                  >
                    {plan.name}
                  </Text>
                  {plan.description ? (
                    <Text
                      style={{
                        fontSize: tokens.text.sm,
                        color: tokens.color.textMuted,
                        marginTop: 4,
                      }}
                    >
                      {plan.description}
                    </Text>
                  ) : null}
                  <Text
                    style={{
                      fontSize: tokens.text.sm,
                      color: tokens.color.textPrimary,
                      marginTop: tokens.space.xs,
                    }}
                  >
                    R$ {plan.price.toFixed(2)} · {plan.credits_total} créditos · {plan.validity_days} dias
                  </Text>
                </View>
                {isCurrent ? (
                  <View
                    style={{
                      backgroundColor: "#FDF7E6",
                      paddingHorizontal: tokens.space.sm,
                      paddingVertical: 4,
                      borderRadius: tokens.radius.full,
                      borderWidth: 1,
                      borderColor: tokens.color.primary,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: tokens.text.xs,
                        fontWeight: "700",
                        color: tokens.color.primary,
                      }}
                    >
                      Plano atual
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => handleSelectPlan(plan)}
                    disabled={changePlanMutation.isPending}
                    style={{
                      backgroundColor: tokens.color.primary,
                      paddingHorizontal: tokens.space.md,
                      paddingVertical: tokens.space.sm,
                      borderRadius: tokens.radius.full,
                    }}
                  >
                    {changePlanMutation.isPending ? (
                      <ActivityIndicator size="small" color={tokens.color.textOnPrimary} />
                    ) : (
                      <Text
                        style={{
                          fontSize: tokens.text.sm,
                          fontWeight: "700",
                          color: tokens.color.textOnPrimary,
                        }}
                      >
                        Selecionar
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
        {plans?.length === 0 && !isLoading && (
          <Text style={{ color: tokens.color.textMuted, textAlign: "center" }}>
            Nenhum plano disponível no momento.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
