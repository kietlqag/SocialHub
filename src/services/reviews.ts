import { api } from "./api";

export type ReviewItem = {
  id: string;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  rating: number;
  message: string;
  source?: string | null;
  createdAt?: string | null;
};

export type ReviewStats = {
  avgRating: number;
  total: number;
};

export type SubmitReviewPayload = {
  rating: number;
  message: string;
  name?: string;
  email?: string;
  source?: string;
};

export async function fetchReviewStats() {
  return api.get<ReviewStats>("/api/reviews/stats");
}

export async function fetchReviews(limit = 6) {
  return api.get<{ items: ReviewItem[] }>(`/api/reviews?limit=${limit}`);
}

export async function submitReview(payload: SubmitReviewPayload, token?: string) {
  return api.post<{ review: ReviewItem }>("/api/reviews", payload, token);
}

export async function fetchMyReview(token: string) {
  return api.get<{ review: ReviewItem | null }>("/api/reviews/me", token);
}

export async function updateReview(id: string, payload: SubmitReviewPayload, token: string) {
  return api.patch<{ review: ReviewItem }>(`/api/reviews/${id}`, payload, token);
}
