/* eslint-disable */
/**
 * AI Chat Screen — Chat completo com a Consultora Daily
 *
 * Interface de chat moderna com:
 * - Bolhas de mensagem estilizadas
 * - Avatar da consultora
 * - Indicador "digitando..."
 * - Ações inline nas respostas
 * - Histórico persistido
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Dimensions, Alert, Modal
} from "react-native";
import Animated, { FadeInDown, FadeIn, FadeInRight } from "react-native-reanimated";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useAIChat, type ChatMessage } from "@/hooks/use-ai-chat";
import { trackAIFeedback } from "@/lib/ai";
import { supabase } from "@/lib/supabase";

const AI_AVATAR = require('@/assets/images/ai-avatar.jpg');

const { width: W } = Dimensions.get("window");

// ─── Quick Action Suggestions ────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { emoji: "💡", label: "Dica de post", prompt: "Me dá uma ideia de post pra eu publicar hoje que vai atrair clientes" },
  { emoji: "💰", label: "Sugerir preço", prompt: "Me ajuda a definir um preço justo pros meus serviços" },
  { emoji: "📣", label: "Criar promoção", prompt: "Quero criar uma promoção pra atrair mais clientes essa semana" },
  { emoji: "📈", label: "Crescer perfil", prompt: "Como posso crescer meu perfil e ganhar mais seguidores?" },
  { emoji: "📝", label: "Legenda pronta", prompt: "Cria uma legenda chamativa pra eu postar no meu perfil" },
  { emoji: "🗓️", label: "Dica de agenda", prompt: "Como posso organizar melhor minha agenda pra não perder clientes?" },
];

// ─── Appointment Action Card ──────────────────────────────────────────────────
function AppointmentActionCard({ appointment, professionalId, colors }: { appointment: any, professionalId: string, colors: any }) {
  const router = useRouter();
  const [isHighlighted, setIsHighlighted] = useState(true);
  const [status, setStatus] = useState<'active' | 'cancelled' | 'confirmed'>('active');
  const [hasTrackedAccepted, setHasTrackedAccepted] = useState(false);

  useEffect(() => {
    // Degradação visual após 10 segundos + tracking silencioso de 'accepted'
    const timer = setTimeout(() => {
      setIsHighlighted(false);
      if (status === 'active' && !hasTrackedAccepted) {
        setHasTrackedAccepted(true);
        trackAIFeedback(professionalId, 'create_appointment', 'accepted').catch(() => {});
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [status, hasTrackedAccepted, professionalId]);

  const handleCancel = async () => {
    setStatus('cancelled');
    await trackAIFeedback(professionalId, 'create_appointment', 'cancelled');
    
    // Deleta o agendamento real do banco de dados
    if (appointment.id) {
      await supabase.from('appointments').delete().eq('id', appointment.id);
    }
  };

  const handleConfirm = async () => {
    setStatus('confirmed');
    await trackAIFeedback(professionalId, 'create_appointment', 'accepted');
  };

  if (status === 'cancelled') {
    return (
      <View style={{ marginTop: 8, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, opacity: 0.6 }}>
        <Text style={{ color: colors.muted, textDecorationLine: 'line-through' }}>Agendamento de {appointment.client_name} cancelado.</Text>
      </View>
    );
  }

  // Se confirmado, mostra feedback visual e botão para abrir a agenda
  if (status === 'confirmed') {
    return (
      <Animated.View entering={FadeInDown} style={{ marginTop: 8, padding: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: "#22c55e" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 20 }}>✅</Text>
          <Text style={{ fontWeight: "800", color: "#16a34a", fontSize: 16 }}>Agendamento Salvo!</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 16 }}>
          {appointment.client_name} ({appointment.service}) agendado para {appointment.date?.split("-")?.reverse()?.join("/")} às {appointment.time}.
        </Text>
        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/shop')} 
          style={{ backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 12, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Ir para a Agenda</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (!isHighlighted) {
    return (
      <View style={{ marginTop: 8, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 4 }}>🗓️ {appointment.service} - {appointment.client_name}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>{appointment.date.split("-").reverse().join("/")} às {appointment.time}</Text>
        
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity onPress={handleCancel} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, borderRadius: 8, alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleConfirm} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, borderRadius: 8, alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 8, width: "100%", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#22c55e", backgroundColor: "rgba(34, 197, 94, 0.1)" }}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 20 }}>❓</Text>
          <Text style={{ fontWeight: "900", color: "#16a34a", fontSize: 16, letterSpacing: 0.5 }}>SUGESTÃO DE AGENDAMENTO</Text>
        </View>
        
        <View style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(34, 197, 94, 0.2)" }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 2 }}>👤 {appointment.client_name}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 6 }}>💅 {appointment.service}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>📅 {appointment.date.split("-").reverse().join("/")}</Text>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>⏰ {appointment.time}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <TouchableOpacity onPress={handleCancel} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#ef4444", paddingVertical: 10, borderRadius: 12, alignItems: "center" }}>
            <Text style={{ color: "#ef4444", fontWeight: "800", fontSize: 14 }}>❌ Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleConfirm} style={{ flex: 1, backgroundColor: "#22c55e", paddingVertical: 10, borderRadius: 12, alignItems: "center", shadowColor: "#22c55e", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>✅ Confirmar</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: "center", color: colors.muted, fontSize: 11, marginTop: 12, fontStyle: "italic" }}>
          A IA sugere este agendamento. Clique em confirmar para salvar ou cancelar para descartar.
        </Text>
      </View>
    </View>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message, colors, index, professionalId }: { message: ChatMessage; colors: any; index: number; professionalId: string }) {
  const isUser = message.role === "user";
  const router = useRouter();

  // Simple markdown-like rendering (bold with **)
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <Text key={i} style={{ fontWeight: "800" }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <Text key={i} style={{ fontStyle: "italic", color: colors.muted }}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      return <Text key={i}>{part}</Text>;
    });
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(Math.min(index * 50, 200))}
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: W * 0.78,
        marginBottom: 10,
      }}
    >
      {/* Consultant avatar for AI messages */}
      {!isUser && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden"
            }}
          >
            <Image source={AI_AVATAR} style={{ width: 24, height: 24 }} contentFit="cover" />
          </View>
          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700" }}>Consultora Daily</Text>
        </View>
      )}

      <View
        style={{
          backgroundColor: isUser ? colors.primary : (colors.primary + "12"), // Subtle primary tint for AI
          borderRadius: 20,
          borderTopRightRadius: isUser ? 4 : 20,
          borderTopLeftRadius: isUser ? 20 : 4,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: isUser ? 0 : 1,
          borderColor: isUser ? "transparent" : (colors.primary + "25"),
          shadowColor: isUser ? colors.primary : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isUser ? 0.25 : 0.04,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Text
          style={{
            color: isUser ? "#fff" : colors.foreground,
            fontSize: 15,
            lineHeight: 23,
            letterSpacing: 0.2,
            fontWeight: isUser ? "500" : "400",
            opacity: isUser ? 1 : 0.9, // Slightly softer text for AI
          }}
        >
          {renderContent(message.content)}
        </Text>
      </View>

      {/* Renderização de Action Cards se houver dados de ação da IA */}
      {message.actionData && (
        <>
          {message.actionData.action_type === "APPOINTMENT_CREATED" && message.actionData.appointment && (
            <AppointmentActionCard 
              appointment={message.actionData.appointment} 
              professionalId={professionalId} 
              colors={colors} 
            />
          )}

          {message.actionData.action_type !== "APPOINTMENT_CREATED" && (
            <View style={{ marginTop: 8, width: "100%", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              
              {message.actionData.action_type === "POST_DRAFT_READY" && message.actionData.draft && (
                <View>
                  <Image source={{ uri: message.actionData.draft.image_url }} style={{ width: "100%", height: 160, backgroundColor: colors.border }} contentFit="cover" />
                  <View style={{ padding: 12 }}>
                    <Text style={{ fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>Post Publicado! ✨</Text>
                    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={3}>{message.actionData.draft.caption}</Text>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/create', params: { initialCaption: message.actionData.draft.caption, initialImageUrl: message.actionData.draft.image_url } })} style={{ backgroundColor: colors.primary, paddingVertical: 8, borderRadius: 12, alignItems: "center", marginTop: 10 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Ver Postagem</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {message.actionData.action_type === "PRICE_SUGGESTION" && (
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Text style={{ fontSize: 18 }}>💰</Text>
                    <Text style={{ fontWeight: "800", color: colors.foreground }}>Sugestão de Preço</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "900", marginVertical: 4 }}>{message.actionData.suggested_price ? `R$ ${message.actionData.suggested_price}` : "..."}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Faixa ideal: {message.actionData.range}</Text>
                  {message.actionData.justification && (
                    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{message.actionData.justification}</Text>
                  )}
                </View>
              )}

              {message.actionData.action_type === "ANALYTICS_FETCHED" && message.actionData.metrics && (
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Text style={{ fontSize: 18 }}>📊</Text>
                    <Text style={{ fontWeight: "800", color: colors.foreground }}>Resumo ({message.actionData.period_days} dias)</Text>
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 14, marginBottom: 4 }}>👁️ Visitas no perfil: <Text style={{ fontWeight: "800" }}>{message.actionData.metrics.total_profile_views}</Text></Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, marginBottom: 4 }}>📲 Cliques no WhatsApp: <Text style={{ fontWeight: "800" }}>{message.actionData.metrics.whatsapp_clicks}</Text></Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, marginBottom: 4 }}>🗓️ Agendamentos ativos: <Text style={{ fontWeight: "800" }}>{message.actionData.metrics.total_appointments}</Text></Text>
                </View>
              )}

              {message.actionData.action_type === "CALENDAR_GENERATED" && message.actionData.preview && (
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Text style={{ fontSize: 18 }}>📅</Text>
                    <Text style={{ fontWeight: "800", color: colors.foreground }}>Calendário Gerado</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>{message.actionData.posts_count} posts programados.</Text>
                  
                  {message.actionData.preview.map((p: any, idx: number) => (
                    <View key={idx} style={{ backgroundColor: colors.background, padding: 8, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{p.date.split('-').reverse().join('/')}</Text>
                        <Text style={{ fontSize: 10, color: colors.muted, textTransform: "uppercase" }}>{p.type.replace(/_/g, ' ')}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.foreground }} numberOfLines={2}>{p.caption_preview}</Text>
                    </View>
                  ))}
                  
                  <TouchableOpacity onPress={() => router.push('/(tabs)/shop' as any)} style={{ backgroundColor: colors.primary, paddingVertical: 8, borderRadius: 12, alignItems: "center", marginTop: 10 }}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Ver Calendário</Text>
                  </TouchableOpacity>
                </View>
              )}
          
            </View>
          )}
        </>
      )}

      <Text
        style={{
          fontSize: 9,
          color: colors.muted,
          marginTop: 3,
          alignSelf: isUser ? "flex-end" : "flex-start",
          paddingHorizontal: 4,
        }}
      >
        {new Date(message.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </Animated.View>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator({ colors }: { colors: any }) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.primary,
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden"
        }}
      >
        <Image source={AI_AVATAR} style={{ width: 24, height: 24 }} contentFit="cover" />
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 4,
          backgroundColor: colors.surface,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={{ color: colors.muted, fontSize: 13, fontStyle: "italic", marginLeft: 6 }}>
          Pensando...
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AIChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { messages, isLoading, sendMessage, addLocalMessage, clearChat } = useAIChat(user?.id);
  const { initialPrompt } = useLocalSearchParams<{ initialPrompt?: string }>();

  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const initialPromptSent = useRef(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingInput, setPricingInput] = useState("");

  // Auto-send initialPrompt (from notifications / lead alerts)
  useEffect(() => {
    if (initialPrompt && !initialPromptSent.current && messages.length <= 1 && !isLoading) {
      initialPromptSent.current = true;
      setTimeout(() => sendMessage(initialPrompt), 500);
    }
  }, [initialPrompt, messages.length, isLoading]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isLoading]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(input.trim());
    setInput("");
  }, [input, isLoading, sendMessage]);

  const handlePricingSubmit = useCallback(async () => {
    setShowPricingModal(false);
    if (!pricingInput.trim()) return;
    const service_name = pricingInput.trim();
    setPricingInput("");
    
    const { executeSuggestPrice } = await import('@/lib/ai/tools/pricing.tools');
    const result = await executeSuggestPrice({ service_name, region_type: "popular" });
    if (result.success) {
       addLocalMessage(`Aqui está uma estimativa para **${service_name}**:\n\n💰 **Preço sugerido:** R$ ${result.suggested_price}\n📊 **Faixa:** ${result.range}\n\n${result.justification}`, result);
    }
  }, [pricingInput, addLocalMessage]);

  const handleQuickAction = useCallback(
    (action: typeof QUICK_ACTIONS[0]) => {
      if (isLoading) return;
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // FASE 2A: Quick Actions 100% Nativas
      if (action.label === "Sugerir preço") {
        setShowPricingModal(true);
        return;
      }

      if (action.label === "Dica de agenda") {
        router.push("/(tabs)/shop" as any);
        return;
      }

      // Fallback para as outras actions
      sendMessage(action.prompt);
    },
    [isLoading, sendMessage, router, addLocalMessage],
  );

  const handleClear = () => {
    Alert.alert("Limpar conversa", "Deseja apagar todo o histórico com a consultora?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: () => {
          clearChat();
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden"
              }}
            >
              <Image source={AI_AVATAR} style={{ width: 36, height: 36 }} contentFit="cover" />
            </View>
            <View>
              <Text style={{ fontFamily: "PlayfairDisplay_700Bold", fontWeight: "800", fontSize: 16, color: colors.foreground }}>
                Consultora Daily
              </Text>
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>
                💼 Sua parceira de vendas
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleClear} style={{ padding: 6 }}>
            <IconSymbol name="trash" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Chat Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome message if no messages */}
          {messages.length === 0 && !isLoading && (
            <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center", paddingVertical: 30 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.primary + "15",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 16,
                  overflow: "hidden"
                }}
              >
                <Image source={require('@/assets/images/ai-avatar.jpg')} style={{ width: 72, height: 72 }} contentFit="cover" />
              </View>
              <Text style={{ fontFamily: "PlayfairDisplay_700Bold", fontWeight: "800", fontSize: 18, color: colors.foreground, textAlign: "center" }}>
                Olá! Sou a Consultora Daily 👋
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 8,
                  lineHeight: 20,
                  paddingHorizontal: 20,
                }}
              >
                Estou aqui pra te ajudar a vender mais e crescer seu negócio.
                Me faz uma pergunta ou escolhe uma das opções abaixo!
              </Text>

              {/* Quick actions */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 20,
                  paddingHorizontal: 10,
                }}
              >
                {QUICK_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    onPress={() => handleQuickAction(action)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: colors.surface,
                      borderRadius: 20,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{action.emoji}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} colors={colors} index={i} professionalId={user?.id || ""} />
          ))}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator colors={colors} />}

          {/* Quick actions after a few messages */}
          {messages.length > 0 && messages.length < 6 && !isLoading && (
            <View style={{ marginTop: 8, marginBottom: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} contentContainerStyle={{ gap: 8 }}>
                {QUICK_ACTIONS.slice(0, 4).map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    onPress={() => handleQuickAction(action)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: colors.primary + "10",
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: colors.primary + "30",
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>{action.emoji}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: Math.max(10, Platform.OS === "ios" ? 20 : 24), // Ajuste para barra de navegação
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "flex-end",
              backgroundColor: colors.surface,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 16,
              paddingVertical: Platform.OS === "ios" ? 10 : 8,
              minHeight: 44,
              maxHeight: 120,
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Pergunte algo..."
              placeholderTextColor={colors.muted}
              multiline
              style={{
                flex: 1,
                color: colors.foreground,
                fontSize: 15,
                maxHeight: 100,
              }}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              editable={!isLoading}
              returnKeyType="send"
              enterKeyHint="send"
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: input.trim() && !isLoading ? colors.primary : colors.surface,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: input.trim() ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <IconSymbol
                name="paperplane.fill"
                size={18}
                color={input.trim() ? "#fff" : colors.muted}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modal de Preço */}
      <Modal visible={showPricingModal} transparent animationType="fade" onRequestClose={() => setShowPricingModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ backgroundColor: colors.background, padding: 20, borderRadius: 16, width: "100%", maxWidth: 400, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Calculadora de Preço</Text>
            <Text style={{ color: colors.muted, marginBottom: 16, fontSize: 14 }}>Qual serviço você quer precificar? (ex: Manicure, Corte)</Text>
            <TextInput
              value={pricingInput}
              onChangeText={setPricingInput}
              placeholder="Ex: Alongamento de unhas"
              placeholderTextColor={colors.muted}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, marginBottom: 16, fontSize: 16 }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handlePricingSubmit}
            />
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "flex-end" }}>
              <TouchableOpacity onPress={() => setShowPricingModal(false)} style={{ padding: 10 }}>
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 14 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePricingSubmit} style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Calcular</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}
