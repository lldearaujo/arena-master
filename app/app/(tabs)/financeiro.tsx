import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  Clipboard,
  useWindowDimensions,
} from "react-native";
import { Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api/client";
import { tokens } from "../../src/ui/tokens";
import { useAuthStore } from "../../src/store/auth";

type FinanceSummarySubscription = {
  id: number;
  plan_name: string;
  status: "pending_payment" | "active" | "expired" | "canceled";
  start_date: string | null;
  end_date: string | null;
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
};

type FinancePaymentSummary = {
  id: number;
  amount: number;
  status: "pending_confirmation" | "confirmed" | "rejected";
  created_at: string;
  payment_date: string | null;
  confirmed_at: string | null;
  plan_name?: string | null;
  end_date?: string | null;
  receipt_path?: string | null;
};

type PixConfig = {
  dojo_id: number;
  key_type: string;
  key_value: string;
  recipient_name?: string | null;
  bank_name?: string | null;
  instructions?: string | null;
  static_qr_image_path?: string | null;
};

type FinanceSummary = {
  active_subscription: FinanceSummarySubscription | null;
  subscriptions: FinanceSummarySubscription[];
  payments: FinancePaymentSummary[];
  pix_config: PixConfig | null;
};

type Dojo = {
  id: number;
  name: string;
  logo_url: string | null;
};

export default function FinanceiroScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploadingPaymentId, setUploadingPaymentId] = useState<number | null>(
    null,
  );
  const [isPickingReceipt, setIsPickingReceipt] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["finance-summary"],
    queryFn: async () => {
      const res = await api.get<FinanceSummary>("/api/finance/me/summary");
      return res.data;
    },
    // Mantém o status financeiro atualizado sem precisar reabrir o app
    refetchInterval: 30_000, // 30s
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const token = useAuthStore((state) => state.token);

  const uploadReceiptMutation = useMutation({
    mutationFn: async (payload: { paymentId: number; formData: FormData }) => {
      await api.post(
        `/api/finance/me/payments/${payload.paymentId}/receipt`,
        payload.formData,
        token
          ? {
              headers: {
                Authorization: `Bearer ${token}`,
                // Garante que o backend reconheça como multipart
                "Content-Type": "multipart/form-data",
              },
            }
          : {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
  });

  async function handleAttachReceipt(paymentId: number) {
    if (isPickingReceipt || uploadingPaymentId !== null) return;
    setIsPickingReceipt(true);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const msg =
          "Permita acesso à galeria para anexar o comprovante de pagamento.";
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          alert(msg);
        } else {
          Alert.alert("Permissão necessária", msg);
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // Usa apenas a API estável compatível com sua versão
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];

      setUploadingPaymentId(paymentId);
      try {
        const form = new FormData();
        if (Platform.OS === "web") {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          form.append("file", blob, "comprovante.jpg");
        } else {
          form.append("file", {
            // @ts-expect-error - React Native FormData file (native)
            uri: asset.uri,
            name: "comprovante.jpg",
            type: asset.mimeType ?? "image/jpeg",
          });
        }

        await uploadReceiptMutation.mutateAsync({ paymentId, formData: form });

        if (Platform.OS !== "web") {
          Alert.alert(
            "Comprovante enviado",
            "Seu comprovante foi anexado com sucesso e aguarda confirmação do professor.",
          );
        }
      } catch (err) {
        const detailedMessage =
          err instanceof Error
            ? (err as any)?.response?.data?.detail ?? err.message
            : "Não foi possível enviar o comprovante. Tente novamente.";

        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          alert(detailedMessage);
        } else {
          Alert.alert("Erro ao enviar comprovante", detailedMessage);
        }
      } finally {
        setUploadingPaymentId(null);
      }
    } finally {
      setIsPickingReceipt(false);
    }
  }

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const { data: dojo } = useQuery({
    queryKey: ["dojo-me"],
    queryFn: async () => {
      const res = await api.get<Dojo>("/api/dojos/me");
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const active = data?.active_subscription;
  const payments = data?.payments ?? [];
  const nextInvoice = payments.find((p) => p.status === "pending_confirmation");

  // Cores dinâmicas para o card do plano atual
  let planoBgColor = "#d4af37";
  let planoTextColor = "#1e293b";
  if (active?.end_date) {
    const today = new Date();
    const end = new Date(active.end_date);
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const endStart = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
    ).getTime();
    const diffDays = Math.ceil((endStart - todayStart) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // Vencido
      planoBgColor = "#b91c1c"; // vermelho
      planoTextColor = "#fef2f2";
    } else if (diffDays <= 5) {
      // Faltam 5 dias ou menos
      planoBgColor = "#f97316"; // laranja
      planoTextColor = "#fff7ed";
    } else {
      // Em dia
      planoBgColor = "#166534"; // verde
      planoTextColor = "#dcfce7";
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      {/* Header com logo do Dojo (padrão das outras abas) */}
      <View
        style={{
          backgroundColor: tokens.color.bgCard,
          borderBottomLeftRadius: tokens.radius.lg * 2,
          borderBottomRightRadius: tokens.radius.lg * 2,
          paddingTop: insets.top + tokens.space.md,
          paddingBottom: tokens.space.xl,
          paddingHorizontal: tokens.space.lg,
          alignItems: "center",
          shadowColor: tokens.color.textPrimary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        {dojo?.logo_url ? (
          <Image
            source={{
              uri: (() => {
                const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
                if (dojo.logo_url!.startsWith("http")) {
                  if (
                    dojo.logo_url!.includes("localhost") ||
                    dojo.logo_url!.includes("127.0.0.1")
                  ) {
                    const path = dojo.logo_url!.replace(/^https?:\/\/[^/]+/, "");
                    return `${base}${path}`;
                  }
                  return dojo.logo_url!;
                }
                return `${base}${
                  dojo.logo_url!.startsWith("/") ? "" : "/"
                }${dojo.logo_url}`;
              })(),
            }}
            style={{
              width: Math.min(screenWidth - tokens.space.lg * 4, 260),
              height: Math.min(screenWidth * 0.35, 140),
              resizeMode: "contain",
            }}
          />
        ) : (
          dojo?.name && (
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.xl,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              {dojo.name}
            </Text>
          )
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: tokens.space.lg,
          paddingBottom: tokens.space.xl + 80,
          gap: tokens.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: tokens.color.textPrimary,
            fontSize: tokens.text.lg,
            fontWeight: "700",
            marginBottom: tokens.space.xs,
          }}
        >
          Financeiro
        </Text>
        <Text
          style={{
            color: tokens.color.textMuted,
            fontSize: tokens.text.sm,
            marginBottom: tokens.space.lg,
          }}
        >
          Seu plano, faturas e pagamentos via PIX.
        </Text>

        {isLoading && (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: tokens.space.lg,
            }}
          >
            <ActivityIndicator color={tokens.color.primary} />
          </View>
        )}

        {error && (
          <Text
            style={{
              color: tokens.color.error,
              fontSize: tokens.text.sm,
            }}
          >
            Não foi possível carregar seu resumo financeiro. Tente novamente mais
            tarde.
          </Text>
        )}

        {active && (
          <View
            style={{
              backgroundColor: tokens.color.bgBody,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.md,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
            }}
          >
            <Text
              style={{
                fontSize: tokens.text.sm,
                fontWeight: "700",
                color: tokens.color.textPrimary,
                marginBottom: tokens.space.xs,
              }}
            >
              Meu plano atual
            </Text>
            <View
              style={{
                backgroundColor: planoBgColor,
                borderRadius: tokens.radius.lg,
                padding: tokens.space.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: tokens.space.md,
              }}
            >
              <View style={{ flex: 1.5 }}>
                <Text
                  style={{
                    fontSize: tokens.text.md,
                    fontWeight: "700",
                    color: planoTextColor,
                    marginBottom: 4,
                  }}
                >
                  {active.plan_name}
                </Text>
                {active.end_date && (
                  <Text
                    style={{
                      fontSize: tokens.text.sm,
                      color: planoTextColor,
                    }}
                  >
                    Vencimento:{" "}
                    {new Date(active.end_date).toLocaleDateString("pt-BR")}
                  </Text>
                )}
                <Text
                  style={{
                    fontSize: tokens.text.sm,
                    color: planoTextColor,
                    marginTop: 2,
                  }}
                >
                  Status:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {active.status === "active"
                      ? "Ativo e em dia"
                      : active.status === "pending_payment"
                      ? "Pendente de pagamento"
                      : active.status === "expired"
                      ? "Vencido"
                      : "Cancelado"}
                  </Text>
                </Text>
                <Text
                  style={{
                    fontSize: tokens.text.xs,
                    color: planoTextColor,
                    marginTop: 2,
                  }}
                >
                  Créditos: {active.credits_remaining} de {active.credits_total}
                </Text>
                <Text
                  style={{
                    fontSize: tokens.text.xs,
                    color: planoTextColor,
                    marginTop: 2,
                  }}
                >
                  Pagamento: Pix manual
                </Text>
              </View>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: tokens.color.textOnPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: tokens.color.textOnPrimary,
                    fontSize: 20,
                    fontWeight: "700",
                  }}
                >
                  ✓
                </Text>
              </View>
            </View>
          </View>
        )}

        {nextInvoice && (
          <View
            style={{
              backgroundColor: tokens.color.bgCard,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.md,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
            }}
          >
            <Text
              style={{
                fontSize: tokens.text.sm,
                fontWeight: "700",
                color: tokens.color.textOnPrimary,
                marginBottom: tokens.space.xs,
              }}
            >
              Próxima fatura
            </Text>
            <View
              style={{
                backgroundColor: tokens.color.bgBody,
                borderRadius: tokens.radius.lg,
                padding: tokens.space.md,
              }}
            >
              <Text
                style={{
                  fontSize: tokens.text.sm,
                  color: tokens.color.textPrimary,
                }}
              >
                Sua próxima fatura de{" "}
                <Text style={{ fontWeight: "700" }}>
                  R$ {nextInvoice.amount.toFixed(2)}
                </Text>{" "}
                vence em{" "}
                <Text style={{ fontWeight: "700" }}>
                  {nextInvoice.end_date
                    ? new Date(nextInvoice.end_date).toLocaleDateString("pt-BR")
                    : "—"}
                </Text>
                .
              </Text>
            </View>
          </View>
        )}

        {data?.pix_config && (
          <View
            style={{
              backgroundColor: tokens.color.bgCard,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.md,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
            }}
          >
            <Text
              style={{
                fontSize: tokens.text.md,
                fontWeight: "700",
                color: tokens.color.textOnPrimary,
              }}
            >
              Pagamento via PIX
            </Text>
            <Text
              style={{
                fontSize: tokens.text.xs,
                color: tokens.color.textOnPrimary,
                marginTop: tokens.space.xs,
              }}
            >
              Use a chave abaixo para pagar seu plano e envie o comprovante para liberação.
            </Text>
            <View
              style={{
                flexDirection: screenWidth > 480 ? "row" : "column",
                gap: tokens.space.md,
                marginTop: tokens.space.md,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: tokens.color.bgBody,
                  borderRadius: tokens.radius.lg,
                  padding: tokens.space.md,
                  borderWidth: 1,
                  borderColor: tokens.color.borderSubtle,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: tokens.space.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: tokens.text.sm,
                      fontWeight: "700",
                      color: tokens.color.textPrimary,
                    }}
                  >
                    Dados para pagamento
                  </Text>
                  {data.pix_config.key_value && (
                    <Pressable
                      onPress={async () => {
                        const value = data.pix_config!.key_value;
                        try {
                          if (Platform.OS === "web" && navigator.clipboard) {
                            await navigator.clipboard.writeText(value);
                          } else {
                            Clipboard.setString(value);
                          }
                          if (Platform.OS !== "web") {
                            Alert.alert(
                              "PIX copiado",
                              "Chave PIX copiada para a área de transferência.",
                            );
                          }
                        } catch {
                          if (Platform.OS !== "web") {
                            Alert.alert(
                              "Erro ao copiar",
                              "Não foi possível copiar a chave PIX. Copie manualmente.",
                            );
                          }
                        }
                      }}
                      style={{
                        paddingHorizontal: tokens.space.sm,
                        paddingVertical: 4,
                        borderRadius: tokens.radius.full,
                        borderWidth: 1,
                        borderColor: tokens.color.borderStrong,
                        backgroundColor: tokens.color.bgBody,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: tokens.text.xs,
                          color: tokens.color.primary,
                          fontWeight: "600",
                        }}
                      >
                        Copiar chave
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: tokens.text.sm,
                    color: tokens.color.textPrimary,
                  }}
                >
                  Tipo de chave: {data.pix_config.key_type}
                </Text>
                <Text
                  style={{
                    fontSize: tokens.text.sm,
                    color: tokens.color.textPrimary,
                    marginTop: 2,
                  }}
                >
                  Chave: {data.pix_config.key_value}
                </Text>
                {data.pix_config.recipient_name && (
                  <Text
                    style={{
                      fontSize: tokens.text.sm,
                      color: tokens.color.textPrimary,
                      marginTop: tokens.space.xs,
                    }}
                  >
                    Favorecido: {data.pix_config.recipient_name}
                  </Text>
                )}
                {data.pix_config.bank_name && (
                  <Text
                    style={{
                      fontSize: tokens.text.sm,
                      color: tokens.color.textPrimary,
                      marginTop: 2,
                    }}
                  >
                    Banco: {data.pix_config.bank_name}
                  </Text>
                )}
                {data.pix_config.instructions && (
                  <Text
                    style={{
                      fontSize: tokens.text.xs,
                      color: tokens.color.textMuted,
                      marginTop: tokens.space.sm,
                    }}
                  >
                    {data.pix_config.instructions}
                  </Text>
                )}
                {data.pix_config.static_qr_image_path && (
                  <View
                    style={{
                      marginTop: tokens.space.md,
                      alignItems: "center",
                    }}
                  >
                    <Image
                      source={{
                        uri: (() => {
                          const base =
                            api.defaults.baseURL?.replace(/\/$/, "") ?? "";
                          const path = data.pix_config!.static_qr_image_path!;
                          if (path.startsWith("http")) return path;
                          return `${base}${
                            path.startsWith("/") ? "" : "/"
                          }${path}`;
                        })(),
                      }}
                      style={{
                        width: 140,
                        height: 140,
                        resizeMode: "contain",
                      }}
                    />
                  </View>
                )}
              </View>

              {nextInvoice && (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: tokens.color.bgBody,
                    borderRadius: tokens.radius.lg,
                    padding: tokens.space.md,
                    borderWidth: 1,
                    borderColor: tokens.color.borderSubtle,
                    justifyContent: "space-between",
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: tokens.text.sm,
                        fontWeight: "700",
                        color: tokens.color.textPrimary,
                        marginBottom: tokens.space.xs,
                      }}
                    >
                      Enviar comprovante
                    </Text>
                    <Text
                      style={{
                        fontSize: tokens.text.sm,
                        color: tokens.color.textPrimary,
                      }}
                    >
                      Anexe o comprovante do pagamento desta fatura para que o
                      professor possa confirmar.
                    </Text>
                    <Text
                      style={{
                        fontSize: tokens.text.xs,
                        color: tokens.color.textMuted,
                        marginTop: tokens.space.sm,
                      }}
                    >
                      Valor: R$ {nextInvoice.amount.toFixed(2)}{" "}
                      {nextInvoice.end_date && (
                        <>· Venc.:{" "}
                        {new Date(nextInvoice.end_date).toLocaleDateString(
                          "pt-BR",
                        )}</>
                      )}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      void handleAttachReceipt(nextInvoice.id);
                    }}
                    disabled={uploadingPaymentId === nextInvoice.id}
                    style={{
                      marginTop: tokens.space.md,
                      backgroundColor: tokens.color.primary,
                      borderRadius: tokens.radius.full,
                      paddingVertical: 10,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                      opacity:
                        uploadingPaymentId === nextInvoice.id ? 0.8 : 1,
                    }}
                  >
                    {uploadingPaymentId === nextInvoice.id && (
                      <ActivityIndicator
                        size="small"
                        color={tokens.color.textOnPrimary}
                      />
                    )}
                    <Text
                      style={{
                        color: tokens.color.textOnPrimary,
                        fontSize: tokens.text.sm,
                        fontWeight: "700",
                      }}
                    >
                      {uploadingPaymentId === nextInvoice.id
                        ? "Enviando comprovante..."
                        : "Enviar comprovante"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {data?.payments?.length ? (
          <View
            style={{
              backgroundColor: tokens.color.bgCard,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.md,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
            }}
          >
            <Text
              style={{
                fontSize: tokens.text.md,
                fontWeight: "700",
                color: tokens.color.textOnPrimary,
                marginBottom: tokens.space.sm,
              }}
            >
              Pagamentos
            </Text>
            {data.payments.map((p) => {
              const isPendingReceipt = p.status === "pending_confirmation";
              const paymentDate = new Date(
                (p.payment_date ?? p.created_at) as string,
              ).toLocaleDateString("pt-BR");
              const dueDate =
                p.end_date != null
                  ? new Date(p.end_date).toLocaleDateString("pt-BR")
                  : null;

              return (
                <View
                  key={p.id}
                  style={{
                    paddingVertical: tokens.space.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: tokens.color.borderStrong,
                    flexDirection: "row",
                    gap: tokens.space.md,
                  }}
                >
                  <View style={{ flex: 1.1 }}>
                    <Text
                      style={{
                        fontSize: tokens.text.sm,
                        fontWeight: "700",
                        color: tokens.color.textOnPrimary,
                      }}
                    >
                      R$ {p.amount.toFixed(2)}
                    </Text>
                    <Text
                      style={{
                        fontSize: tokens.text.xs,
                        color: tokens.color.textOnPrimary,
                      }}
                    >
                      {p.plan_name ? `Plano ${p.plan_name}` : "Pagamento avulso"}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    {dueDate && (
                      <Text
                        style={{
                          fontSize: tokens.text.xs,
                          color: tokens.color.textOnPrimary,
                        }}
                      >
                        Venc.: {dueDate}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontSize: tokens.text.xs,
                        color: tokens.color.textOnPrimary,
                        marginTop: 2,
                      }}
                    >
                      Pago em: {paymentDate}
                    </Text>
                    <View
                      style={{
                        marginTop: 4,
                        alignSelf: "flex-start",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: tokens.radius.full,
                        backgroundColor:
                          p.status === "confirmed"
                            ? "#16653433"
                            : p.status === "pending_confirmation"
                            ? "#fbbf2433"
                            : "#b91c1c33",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: tokens.text.xs,
                          fontWeight: "600",
                          color:
                            p.status === "confirmed"
                              ? "#bbf7d0"
                              : p.status === "pending_confirmation"
                              ? "#fef9c3"
                              : "#fecaca",
                        }}
                      >
                        {p.status === "pending_confirmation"
                          ? "Aguardando"
                          : p.status === "confirmed"
                          ? "Pago"
                          : "Rejeitado"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      alignItems: "flex-end",
                      justifyContent: "center",
                      gap: tokens.space.xs,
                    }}
                  >
                    {p.receipt_path && (
                      <Pressable
                        onPress={() => {
                          const base =
                            api.defaults.baseURL?.replace(/\/$/, "") ?? "";
                          let path = p.receipt_path!;
                          if (!path.startsWith("http")) {
                            if (!path.startsWith("/static")) {
                              path = `/static/receipts/${path.replace(
                                /^\/+/,
                                "",
                              )}`;
                            }
                            path = `${base}${
                              path.startsWith("/") ? "" : "/"
                            }${path}`;
                          }
                          const url = path;
                          if (Platform.OS === "web") {
                            try {
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = "comprovante.jpg";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            } catch {
                              // @ts-expect-error window global no web
                              window.location.href = url;
                            }
                          } else {
                            Linking.openURL(url).catch(() => {
                              Alert.alert(
                                "Erro ao abrir comprovante",
                                "Não foi possível abrir o comprovante. Tente novamente.",
                              );
                            });
                          }
                        }}
                        style={{
                          paddingHorizontal: tokens.space.md,
                          paddingVertical: 6,
                          borderRadius: tokens.radius.full,
                          borderWidth: 1,
                          borderColor: tokens.color.borderStrong,
                          backgroundColor: tokens.color.bgBody,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: tokens.text.xs,
                            color: tokens.color.primary,
                            fontWeight: "700",
                          }}
                        >
                          Comprovante
                        </Text>
                      </Pressable>
                    )}
                    {isPendingReceipt && (
                      <Pressable
                        onPress={() => {
                          void handleAttachReceipt(p.id);
                        }}
                        disabled={uploadingPaymentId === p.id}
                        style={{
                          paddingHorizontal: tokens.space.md,
                          paddingVertical: 6,
                          borderRadius: tokens.radius.full,
                          backgroundColor: tokens.color.primary,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {uploadingPaymentId === p.id && (
                          <ActivityIndicator
                            size="small"
                            color={tokens.color.textOnPrimary}
                          />
                        )}
                        <Text
                          style={{
                            color: tokens.color.textOnPrimary,
                            fontSize: tokens.text.xs,
                            fontWeight: "700",
                          }}
                        >
                          {uploadingPaymentId === p.id
                            ? "Enviando..."
                            : "Anexar"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View
            style={{
              backgroundColor: tokens.color.bgCard,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.md,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
            }}
          >
            <Text
              style={{
                fontSize: tokens.text.sm,
                color: tokens.color.textOnPrimary,
              }}
            >
              Nenhum pagamento registrado ainda.
            </Text>
          </View>
        )}

        <View style={{ gap: tokens.space.md, marginTop: tokens.space.md }}>
          <Pressable
            onPress={() => router.push("/(tabs)/alterar-plano")}
            style={{
              backgroundColor: tokens.color.primary,
              borderRadius: tokens.radius.md,
              paddingVertical: tokens.space.md,
              paddingHorizontal: tokens.space.lg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.sm,
                fontWeight: "700",
              }}
            >
              Alterar plano
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Alert.alert(
                  "Cancelar matrícula",
                  "Entre em contato com o dojo para cancelar sua matrícula.",
                  [{ text: "OK" }]
                );
              } else {
                alert("Entre em contato com o dojo para cancelar sua matrícula.");
              }
            }}
            style={{
              backgroundColor: "transparent",
              borderRadius: tokens.radius.md,
              paddingVertical: tokens.space.md,
              paddingHorizontal: tokens.space.lg,
              alignItems: "center",
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
            }}
          >
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: tokens.text.sm,
                fontWeight: "700",
              }}
            >
              Cancelar matrícula
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

