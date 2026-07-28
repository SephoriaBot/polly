export interface GroqDailyArticle {
  headline: string;
  summary: string;
  source_name: string;
  source_url: string;
  published: string;
}

export interface GroqDailySubject {
  id: string;
  subject: string;
  sort_order: number;
  created_at: string;
}

export interface GroqDailyCacheEntry {
  subject: string;
  articles: GroqDailyArticle[];
  fetched_at: string;
}
