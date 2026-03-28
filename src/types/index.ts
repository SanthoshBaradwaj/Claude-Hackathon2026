export interface User {
  id: string;
  created_at: string;
  session_id: string;
  age_band?: string;
  gender?: string;
  location?: string;
  pronouns?: string;
  responses_count: number;
  is_unlocked: boolean;
}

export interface Article {
  id: string;
  headline: string;
  description?: string;
  source?: string;
  published_at?: string;
  image_url?: string;
  article_url: string;
  category?: string;
  ingested_at: string;
}

export interface Prompt {
  id: string;
  article_id: string;
  balanced_prompt: string;
  specific_prompt?: string;
  emotional_prompt?: string;
  factual_prompt?: string;
  safety_category: string;
  neutral_summary: string;
  active_prompt_type: string;
  created_at: string;
  article?: Article;
}

export interface Response {
  id: string;
  user_id: string;
  prompt_id: string;
  raw_text: string;
  input_method: string;
  created_at: string;
}

export interface ExtractedFactors {
  id: string;
  response_id: string;
  stance: number;
  sentiment: number;
  emotion: string;
  certainty: number;
  primary_concern: string;
  primary_value: string;
  trust_level: number;
  urgency: number;
  policy_preference?: string;
  normalized_summary: string;
  keywords: string[];
  feature_vector: number[];
}

export interface Cluster {
  id: string;
  prompt_id: string;
  cluster_index: number;
  label: string;
  centroid: number[];
  member_count: number;
  percentage: number;
  representative_summary?: string;
  computed_at: string;
}

export interface UserClusterAssignment {
  id: string;
  user_id: string;
  response_id: string;
  cluster_id: string;
  distance_to_centroid?: number;
}

// Raw article shapes from external news APIs
export interface RawGNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: { name: string; url: string };
}

export interface RawNewsAPIArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: { id: string | null; name: string };
}
