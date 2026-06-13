import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "./use-supabase-auth";
import type { Post } from "@/lib/supabase-types";

const PAGE_SIZE = 8;
const FETCH_BATCH = 50; 
const MAX_SEEN = 1000;

const seenIdsKey = (userId?: string) => `daily_seen_${userId || "guest"}`;
const likedCatsKey = (userId?: string) => `daily_liked_cats_${userId || "guest"}`;

const POST_SELECT = `
  id, user_id, category, description, media_url, thumbnail_url,
  media_type, likes_count, comments_count, shares_count,
  created_at, location, is_private, linked_item_id, product_id, tags,
  profiles:user_id (
    id, username, display_name, avatar_url, profile_type, verified,
    latitude, longitude, whatsapp, whatsapp_clicks
  )
`;

// ─────────────────────────────────────────────────────────────────
// 🧠 ALGORITMO DAILY — "Business First" (Conexão de Negócios)
// ─────────────────────────────────────────────────────────────────
// FILOSOFIA: O Daily não é rede social de engajamento. É uma
// plataforma de RESULTADOS DE NEGÓCIO. O feed existe para conectar
// lojistas/profissionais a consumidores dentro do raio de atendimento.
//
// ORDEM DE PRIORIDADE:
// 1. PROXIMIDADE GEOGRÁFICA (mesmo bairro → cidade → estado → país)
// 2. CONTA COMERCIAL COM WHATSAPP (pode atender agora)
// 3. AFINIDADE DO USUÁRIO (categorias curtidas, contas seguidas)
// 4. QUALIDADE DO CONTEÚDO (engajamento real, cliques no zap)
// 5. NOVIDADE (conteúdo fresco primeiro)
// 6. DIVERSIDADE (hash determinístico para variedade estável)
// ─────────────────────────────────────────────────────────────────

function getHoursDiff(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
}

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Hash determinístico simples: dado um post.id + data do dia,
 * gera um número estável (0-15) que só muda a cada dia.
 * Isso garante variedade no feed SEM instabilidade na ordenação.
 */
function deterministicJitter(postId: string): number {
  const today = new Date().toISOString().slice(0, 10); // "2026-05-04"
  const seed = postId + today;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 16; // 0-15
}

interface ScoreContext {
  userLat?: number | null;
  userLon?: number | null;
  followingIds: Set<string>;
  /** Categorias que o usuário mais curtiu/interagiu { "unhas": 5, "cabelo": 2 } */
  likedCategories: Record<string, number>;
  /** Categorias dos perfis que o usuário segue */
  followingCategories: Set<string>;
  seenIds: Set<string>;
}

function scorePost(post: any, ctx: ScoreContext): number {
  let score = 0;
  const profile = post.profiles;
  const hoursOld = getHoursDiff(post.created_at);

  // ──────────────────────────────────────────────
  // 🚨 PENALIDADE DE VISTO (Carrossel infinito)
  // ──────────────────────────────────────────────
  if (ctx.seenIds.has(post.id)) {
    score -= 500;
  }

  // ──────────────────────────────────────────────
  // 📍 1. PROXIMIDADE GEOGRÁFICA (PESO MÁXIMO)
  // Conecta o consumidor ao profissional mais perto
  // Raio concêntrico: bairro → vizinhança → cidade → estado → país
  // ──────────────────────────────────────────────
  if (ctx.userLat && ctx.userLon && profile?.latitude && profile?.longitude) {
    const distKm = calcDistance(ctx.userLat, ctx.userLon, profile.latitude, profile.longitude);
    if (distKm <= 5)          score += 120;  // 🏠 Mesmo bairro / muito perto
    else if (distKm <= 15)    score += 100;  // 🏘️ Bairros vizinhos
    else if (distKm <= 50)    score +=  75;  // 🏙️ Mesma cidade
    else if (distKm <= 150)   score +=  50;  // 🗺️ Região metropolitana
    else if (distKm <= 500)   score +=  30;  // 📍 Mesmo estado (aprox)
    else                      score +=  10;  // 🇧🇷 Brasil (longe)
  } else if (!profile?.latitude || !profile?.longitude) {
    // Sem localização cadastrada: pequena penalidade (profissional deveria cadastrar)
    score -= 10;
  }

  // ──────────────────────────────────────────────
  // 💼 2. CONTA COMERCIAL (Business-Ready)
  // Profissionais e lojas são o coração do Daily.
  // WhatsApp cadastrado = pronto para atender
  // ──────────────────────────────────────────────
  if (profile?.profile_type === "professional" || profile?.profile_type === "store") {
    score += 60;  // Boost forte para contas comerciais

    if (profile.whatsapp) {
      score += 35;  // Tem WhatsApp = pode receber clientes AGORA
    }

    // WhatsApp clicks históricos = prova social de negócios reais
    const zapClicks = profile.whatsapp_clicks || 0;
    if (zapClicks >= 50)      score += 30;
    else if (zapClicks >= 20) score += 20;
    else if (zapClicks >= 5)  score += 10;
  }

  if (profile?.verified) score += 25;

  // Post com produto/serviço vinculado = conteúdo comercial direto
  if (post.product_id || post.linked_item_id) {
    score += 20;
  }

  // ──────────────────────────────────────────────
  // 🎯 3. AFINIDADE DO USUÁRIO (Personalização)
  // Adapta o feed ao comportamento do usuário
  // ──────────────────────────────────────────────
  const postCategory = (post.category || "").toLowerCase();

  // Categorias que o usuário já curtiu/interagiu
  if (postCategory && ctx.likedCategories[postCategory]) {
    const affinityCount = ctx.likedCategories[postCategory];
    score += Math.min(affinityCount * 5, 40); // Máximo +40
  }

  // Post de alguém que o usuário segue → relevância alta
  if (ctx.followingIds.has(post.user_id)) {
    score += 45;
  }

  // Categoria alinhada com quem o usuário segue
  if (postCategory && ctx.followingCategories.has(postCategory)) {
    score += 15;
  }

  // ──────────────────────────────────────────────
  // 📊 4. QUALIDADE DO CONTEÚDO (Engajamento real)
  // Pesos calibrados: comentários valem mais (intenção)
  // ──────────────────────────────────────────────
  const likes = post.likes_count || 0;
  const comments = post.comments_count || 0;
  const engScore = Math.min(likes * 1 + comments * 4, 60); // Cap em 60
  score += engScore;

  // ──────────────────────────────────────────────
  // ⏰ 5. NOVIDADE (Conteúdo fresco)
  // ──────────────────────────────────────────────
  if (hoursOld <= 6)        score += 30;  // Muito recente
  else if (hoursOld <= 24)  score += 20;  // Hoje
  else if (hoursOld <= 72)  score += 10;  // Esta semana
  // Posts antigos: sem bônus

  // ──────────────────────────────────────────────
  // 🎲 6. DIVERSIDADE (Hash determinístico)
  // Evita feed repetitivo, mas mantém ordem estável
  // ──────────────────────────────────────────────
  score += deterministicJitter(post.id);

  return score;
}

async function loadSeenIds(userId?: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(seenIdsKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

async function saveSeenIds(ids: Set<string>, userId?: string): Promise<void> {
  try {
    let arr = Array.from(ids);
    if (arr.length > MAX_SEEN) arr = arr.slice(-MAX_SEEN);
    await AsyncStorage.setItem(seenIdsKey(userId), JSON.stringify(arr));
  } catch {}
}

/**
 * Carrega categorias que o usuário mais curtiu (salvo localmente)
 */
async function loadLikedCategories(userId?: string): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(likedCatsKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveLikedCategories(cats: Record<string, number>, userId?: string): Promise<void> {
  try {
    await AsyncStorage.setItem(likedCatsKey(userId), JSON.stringify(cats));
  } catch {}
}


export const usePosts = (
  category?: string,
  externalCoords?: { latitude: number; longitude: number } | null,
  initialPostId?: string | null,
  searchQuery?: string
) => {
  const { user, profile } = useSupabaseAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const offsetRef = useRef(0);
  const rankedPoolRef = useRef<any[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const followingIds = useRef<Set<string>>(new Set());
  const followingCategories = useRef<Set<string>>(new Set());
  const likedCategories = useRef<Record<string, number>>({});
  const isLoadingRef = useRef(false);
  const seenLoadedRef = useRef(false);

  const ensureSeenLoaded = useCallback(async () => {
    if (seenLoadedRef.current) return;
    const saved = await loadSeenIds(user?.id);
    saved.forEach((id) => seenIds.current.add(id));
    
    // Carrega categorias curtidas do storage
    const savedCats = await loadLikedCategories(user?.id);
    likedCategories.current = savedCats;

    // Carrega IDs de quem o usuário segue + suas categorias
    if (user?.id) {
      try {
        const { data: followData } = await supabase
          .from("follows" as any)
          .select("following_id")
          .eq("follower_id", user.id);
        
        if (followData) {
          const fIds = (followData as any[]).map((f: any) => f.following_id);
          fIds.forEach((id: string) => followingIds.current.add(id));
          
          // Busca categorias dos posts das contas seguidas (afinidade indireta)
          if (fIds.length > 0) {
            const { data: followPosts } = await supabase
              .from("posts")
              .select("category")
              .in("user_id", fIds.slice(0, 50)) // Limita para performance
              .not("category", "is", null)
              .limit(100);
            
            if (followPosts) {
              (followPosts as any[]).forEach((p: any) => {
                if (p.category) followingCategories.current.add(p.category.toLowerCase());
              });
            }
          }
        }
      } catch {}
    }
    
    seenLoadedRef.current = true;
  }, [user?.id]);

  const markAsSeen = useCallback((ids: string[]) => {
    ids.forEach((id) => seenIds.current.add(id));
    saveSeenIds(seenIds.current, user?.id);
  }, [user?.id]);

  /**
   * Registra interação do usuário com uma categoria (curtida, clique, visualização longa).
   * O feed aprende com o tempo quais categorias o usuário prefere.
   */
  const trackInteraction = useCallback((postCategory: string) => {
    if (!postCategory) return;
    const cat = postCategory.toLowerCase();
    likedCategories.current[cat] = (likedCategories.current[cat] || 0) + 1;
    saveLikedCategories(likedCategories.current, user?.id);
  }, [user?.id]);

  const fetchAndRank = useCallback(async (currentOffset: number): Promise<{ ranked: any[]; fetchedCount: number }> => {
    let query = supabase.from("posts").select(POST_SELECT).or('is_private.eq.false,is_private.is.null').not('media_url', 'is', null);

    if (category && category !== "all" && category !== "Para Você") {
      const catLower = category.toLowerCase();
      query = query.or(`category.ilike.%${catLower}%,and(tags.not.is.null,tags.cs.{"${catLower}"})`);
    }

    if (searchQuery && searchQuery.trim() !== "") {
      const q = searchQuery.trim();
      
      // Primeiro, busca IDs de perfis que batem com o texto
      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`display_name.ilike.%${q}%,business_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(30);
        
      const matchedIds = matchedProfiles?.map(p => p.id) || [];
      
      if (matchedIds.length > 0) {
        query = query.or(`description.ilike.%${q}%,user_id.in.(${matchedIds.join(',')})`);
      } else {
        query = query.ilike('description', `%${q}%`);
      }
    }

    const { data, error } = await query.order("created_at", { ascending: false }).range(currentOffset, currentOffset + FETCH_BATCH - 1);
    if (error || !data) return { ranked: [], fetchedCount: 0 };

    const valid = (data as any[]).map((p) => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
    }));

    const ctx: ScoreContext = {
      userLat: externalCoords?.latitude ?? (profile as any)?.latitude,
      userLon: externalCoords?.longitude ?? (profile as any)?.longitude,
      followingIds: followingIds.current,
      followingCategories: followingCategories.current,
      likedCategories: likedCategories.current,
      seenIds: seenIds.current,
    };

    // Ranking business-first: profissionais perto + whatsapp + afinidade
    const ranked = valid.sort((a, b) => scorePost(b, ctx) - scorePost(a, ctx));
    return { ranked, fetchedCount: data.length };
  }, [category, externalCoords, profile, searchQuery]);

  const deliverNextPage = useCallback((isFirstLoad: boolean) => {
    const pool = rankedPoolRef.current;
    if (pool.length === 0) return false;
    const page = pool.splice(0, PAGE_SIZE);
    markAsSeen(page.map((p) => p.id));
    setPosts((prev) => (isFirstLoad ? page : [...prev, ...page]));
    return true;
  }, [markAsSeen]);

  const refresh = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    offsetRef.current = 0;
    rankedPoolRef.current = [];

    await ensureSeenLoaded();
    
    const { ranked, fetchedCount } = await fetchAndRank(0);

    rankedPoolRef.current = ranked;
    offsetRef.current = FETCH_BATCH;
    setHasMore(fetchedCount === FETCH_BATCH);
    deliverNextPage(true);
    setLoading(false);
    isLoadingRef.current = false;
  }, [fetchAndRank, deliverNextPage, ensureSeenLoaded]);

  const fetchMore = useCallback(async () => {
    if (loadingMore || isLoadingRef.current) return;
    if (rankedPoolRef.current.length >= PAGE_SIZE) {
      deliverNextPage(false);
      return;
    }
    if (!hasMore) return;

    setLoadingMore(true);
    isLoadingRef.current = true;
    const { ranked, fetchedCount } = await fetchAndRank(offsetRef.current);

    rankedPoolRef.current.push(...ranked);
    offsetRef.current += FETCH_BATCH;
    setHasMore(fetchedCount === FETCH_BATCH);

    deliverNextPage(false);
    setLoadingMore(false);
    isLoadingRef.current = false;
  }, [loadingMore, hasMore, fetchAndRank, deliverNextPage]);

  useEffect(() => { refresh(); }, [category, initialPostId]); // eslint-disable-line react-hooks/exhaustive-deps

  const createPost = async (postData: any) => {
    if (!user) return { error: new Error("Não autenticado") };
    const { data, error } = await supabase.from("posts").insert({ ...postData, user_id: user.id }).select().single();
    if (!error) refresh();
    return { data, error };
  };

  return { posts, loading, loadingMore, hasMore, refresh, fetchMore, createPost, trackInteraction };

};

export const useUserPosts = (userId?: string) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("id, thumbnail_url, media_url, media_type, is_private, description, category, likes_count, comments_count")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPosts(data as any[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return { posts, loading, fetchPosts };
};