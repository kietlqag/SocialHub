import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Send } from "lucide-react";
import { StarRating } from "./StarRating";
import { ReviewCard } from "./ReviewCard";
import { fetchMyReview, submitReview, updateReview, type ReviewItem } from "../../services/reviews";
import { getCurrentSession, type AuthUser } from "../../services/auth";
import styles from "./ReviewsSection.module.css";

type ReviewFormState = {
  rating: number;
  message: string;
  name: string;
  email: string;
};

const initialForm: ReviewFormState = {
  rating: 5,
  message: "",
  name: "",
  email: "",
};

export function ReviewsSection({ currentUser }: { currentUser?: AuthUser | null }) {
  const [existingReview, setExistingReview] = useState<ReviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ReviewFormState>(initialForm);

  const isGuest = !currentUser;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      const session = getCurrentSession();
      if (!session?.token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchMyReview(session.token);
        if (!mounted) return;
        setExistingReview(res.review || null);
        if (res.review) {
          setForm({
            rating: res.review.rating || 5,
            message: res.review.message || "",
            name: res.review.name || "",
            email: res.review.email || "",
          });
        }
      } catch {
        if (mounted) setExistingReview(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  const handleChange = (key: keyof ReviewFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.rating < 1 || form.rating > 5) {
      toast.error("Please select a rating.");
      return;
    }
    if (form.message.trim().length < 10) {
      toast.error("Message must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const session = getCurrentSession();
      const payload = {
        rating: form.rating,
        message: form.message.trim(),
        name: isGuest ? form.name.trim() || undefined : undefined,
        email: isGuest ? form.email.trim() || undefined : undefined,
        source: "contact_page",
      };
      if (existingReview && session?.token) {
        const res = await updateReview(existingReview.id, payload, session.token);
        setExistingReview(res.review);
        setEditing(false);
        toast.success("Your review has been updated.");
      } else {
        const res = await submitReview(payload, session?.token);
        setExistingReview(res.review || null);
        setEditing(false);
        toast.success("Thank you! Your review was saved.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.reviewsSection}>
      <div className={styles.reviewsHeader}>
        <h2 className={styles.reviewsTitle}>What users say about SocialHub</h2>
        <p className={styles.reviewsSubtitle}>Share your experience and read community feedback.</p>
      </div>

      <div className={styles.reviewsCard}>
        <p className={styles.reviewsLabel}>{existingReview ? "Your review" : "Share your review"}</p>
        <h3 className={styles.reviewsHeading}>{existingReview ? "Thanks for your feedback!" : "Tell us what you think"}</h3>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.skeleton} />
            <div className={`${styles.skeleton} ${styles.skeletonLarge}`} />
            <div className={`${styles.skeleton} ${styles.skeletonBlock}`} />
          </div>
        ) : existingReview && !editing ? (
          <div className={styles.reviewActions}>
            <ReviewCard review={existingReview} />
            <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>
              Edit review
              <Pencil className={styles.editIcon} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <form className={styles.reviewsForm} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label}>Rating</label>
              <StarRating value={form.rating} onChange={(value) => setForm((prev) => ({ ...prev, rating: value }))} size={20} />
            </div>
            {isGuest ? (
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Name (optional)</label>
                  <input
                    className={styles.input}
                    placeholder="Your name"
                    value={form.name}
                    onChange={handleChange("name")}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email (optional)</label>
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange("email")}
                  />
                </div>
              </div>
            ) : null}
            <div className={styles.field}>
              <label className={styles.label}>Message</label>
              <textarea
                className={styles.textarea}
                placeholder="Share your experience with SocialHub."
                value={form.message}
                onChange={handleChange("message")}
              />
            </div>
            <button
              type="submit"
              className={`${styles.submitBtn} ${submitting ? styles.submitBtnLoading : ""}`}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : existingReview ? "Update review" : "Submit review"}
              <Send className={styles.submitIcon} aria-hidden="true" />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
