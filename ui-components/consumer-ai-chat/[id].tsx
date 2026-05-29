import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Dimensions, Alert, Linking
} from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useConsumerAIChat, type ChatMessage } from "@/hooks/use-consumer-ai-chat";
import { supabase } from "@/lib/supabase";

const { width: W } = Dimensions.get("window");

function MessageBubble({ message, colors, index }: { message: ChatMessage; colors: any; index: number }) {
  const isUser = message.role === "user";

  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|https:\/\/wa\.me\/\d+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <Text key={i} style={{ fontWeight: "800" }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      if (part.startsWith("https://wa.me/")) {
        return (
          <Text 
            key={i} 
            style={{ color: isUser ? "#fff" : colors.primary, textDecorationLine: "underline", fontWeight: "800" }} 
            onPress={() => Linking.openURL(part)}
          >
            Falar no WhatsApp
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
      {!isUser && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
            <Image source={require('@/assets/images/ai-avatar.jpg')} style={{ width: 24, height: 24 }} contentFit="cover" />
          </View>
          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700" }}>Delta da Daily</Text>
        </View>
      )}

      <View
        style={{
          backgroundColor: isUser ? colors.primary : colors.surface,
          borderRadius: 18,
          borderTopRightRadius: isUser ? 4 : 18,
          borderTopLeftRadius: isUser ? 18 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: isUser ? 0 : 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        }}
      >
        <Text style={{ color: isUser ? "#fff" : colors.foreground, fontSize: 14, lineHeight: 21 }}>
          {renderContent(message.content)}
        </Text>
      </View>
      <Text style={{ fontSize: 9, color: colors.muted, marginTop: 3, alignSelf: isUser ? "flex-end" : "flex-start", paddingHorizontal: 4 }}>
        {new Date(message.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </Animated.View>
  );
}

function TypingIndicator({ colors }: { colors: any }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 10 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
        <Image source={require('@/assets/images/ai-avatar.jpg')} style={{ width: 24, height: 24 }} contentFit="cover" />
      </View>
      <View style={{ flexDirection: "row", gap: 4, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={{ color: colors.muted, fontSize: 13, fontStyle: "italic", marginLeft: 6 }}>Digitando...</Text>
      </View>
    </Animated.View>
  );
}

export default function ConsumerAIChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { messages, isLoading, sendMessage } = useConsumerAIChat(id, user?.id);

  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const [proName, setProName] = useState("Loja");

  useEffect(() => {
    if (id) {
      supabase.from("profiles").select("display_name, business_name, username").eq("id", id).single()
        .then(({ data }) => setProName((data as any)?.business_name || (data as any)?.display_name || (data as any)?.username || "Loja"));
    }
  }, [id]);

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

  const QUICK_ACTIONS = [
    { emoji: "🗓️", label: "Agendar horário", prompt: "Quero agendar um horário" },
    { emoji: "💇", label: "Ver serviços", prompt: "Quais serviços vocês oferecem?" },
    { emoji: "🕒", label: "Horários de hoje", prompt: "Tem horário pra hoje?" },
  ];

  return (
    <ScreenContainer edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
              <Image source={require('@/assets/images/ai-avatar.jpg')} style={{ width: 36, height: 36 }} contentFit="cover" />
            </View>
            <View>
              <Text style={{ fontWeight: "800", fontSize: 16, color: colors.foreground }}>Delta da Daily</Text>
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Assistente virtual de {proName.split(" ")[0]}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} colors={colors} index={i} />
          ))}

          {isLoading && <TypingIndicator colors={colors} />}

          {messages.length === 1 && !isLoading && (
            <View style={{ marginTop: 8, marginBottom: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {QUICK_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    onPress={() => sendMessage(action.prompt)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary + "10", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.primary + "30" }}
                  >
                    <Text style={{ fontSize: 12 }}>{action.emoji}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(10, Platform.OS === "ios" ? 20 : 24), borderTopWidth: 0.5, borderTopColor: colors.border, backgroundColor: colors.background, gap: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: Platform.OS === "ios" ? 10 : 8, minHeight: 44, maxHeight: 120 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Digite sua mensagem..."
              placeholderTextColor={colors.muted}
              multiline
              style={{ flex: 1, color: colors.foreground, fontSize: 15, maxHeight: 100 }}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || isLoading}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() && !isLoading ? colors.primary : colors.surface, justifyContent: "center", alignItems: "center", borderWidth: input.trim() ? 0 : 1, borderColor: colors.border }}
          >
            {isLoading ? <ActivityIndicator size="small" color={colors.muted} /> : <IconSymbol name="arrow.up" size={18} color={input.trim() ? "#fff" : colors.muted} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
