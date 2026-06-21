import { supabase } from "@/lib/supabase";

export async function executeCreatorAnalyticsTool(
  toolName: string,
  args: any,
  creatorId: string
): Promise<any> {
  switch (toolName) {

    case "get_post_performance": {
      const days = args.period_days || 30;
      const limit = args.limit || 10;
      const since = new Date(
        Date.now() - days * 86400000
      ).toISOString();

      // Busca posts do criador com métricas
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id, description, category, 
          likes_count, comments_count, 
          created_at, thumbnail_url
        `)
        .eq("user_id", creatorId)
        .gte("created_at", since)
        .order("likes_count", { ascending: false })
        .limit(limit);
      const posts = postsData as any[];

      // Busca watch_seconds médio por post
      const { data: viewsData } = await supabase
        .from("post_views")
        .select("post_id, watch_seconds")
        .in("post_id", (posts || []).map(p => p.id));
      const views = viewsData as any[];

      // Cruza dados
      const enriched = (posts || []).map(post => {
        const postViews = (views || [])
          .filter(v => v.post_id === post.id);
        const avgWatch = postViews.length
          ? postViews.reduce((a, b) => 
              a + (b.watch_seconds || 0), 0) / postViews.length
          : 0;

        return {
          ...post,
          view_count: postViews.length,
          avg_watch_seconds: Math.round(avgWatch),
        };
      });

      return { success: true, posts: enriched };
    }

    case "get_best_posting_time": {
      // Busca todas as visualizações dos posts do criador
      const { data: postsData } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", creatorId);
      const posts = postsData as any[];

      const postIds = (posts || []).map(p => p.id);
      if (postIds.length === 0) {
        return { 
          success: false, 
          message: "Ainda não temos dados suficientes. Poste mais e volte em breve." 
        };
      }

      const { data: viewsData } = await supabase
        .from("post_views")
        .select("viewed_at")
        .in("post_id", postIds);
      const views = viewsData as any[];

      if (!views || views.length < 20) {
        return {
          success: false,
          message: "Precisamos de pelo menos 20 visualizações para calcular o melhor horário. Continue postando!"
        };
      }

      // Agrupa por dia da semana e hora
      const buckets: Record<string, number> = {};
      views.forEach(v => {
        const d = new Date(v.viewed_at);
        const day = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        const hour = d.getHours();
        const key = `${day} às ${hour}h`;
        buckets[key] = (buckets[key] || 0) + 1;
      });

      const sorted = Object.entries(buckets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      return { success: true, best_times: sorted };
    }

    case "get_follower_growth": {
      const weeks = args.weeks || 4;

      // Busca follows por semana
      const { data: followsData } = await supabase
        .from("follows")
        .select("created_at")
        .eq("following_id", creatorId)
        .gte("created_at", new Date(
          Date.now() - weeks * 7 * 86400000
        ).toISOString());
      const data = followsData as any[];

      // Agrupa por semana
      const byWeek: Record<string, number> = {};
      (data || []).forEach(f => {
        const week = getWeekLabel(new Date(f.created_at));
        byWeek[week] = (byWeek[week] || 0) + 1;
      });

      return { success: true, growth_by_week: byWeek };
    }

    default:
      return { success: false, message: "Função não encontrada." };
  }
}

function getWeekLabel(date: Date): string {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return `Semana de ${start.toLocaleDateString('pt-BR')}`;
}
