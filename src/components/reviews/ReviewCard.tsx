import { Card, CardContent } from "../ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import type { ReviewItem } from "../../services/reviews";
import { StarRating } from "./StarRating";
import styles from "./ReviewsSection.module.css";

const getInitials = (name?: string | null, email?: string | null) => {
  const base = name || email || "Anonymous";
  const parts = base.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
};

export function ReviewCard({ review }: { review: ReviewItem }) {
  const displayName = review.name || review.email || "Anonymous";
  const initials = getInitials(review.name, review.email);
  const dateLabel = formatDate(review.createdAt);

  return (
    <Card className={styles.reviewItem}>
      <CardContent className={styles.reviewContent}>
        <StarRating value={review.rating} />
        <p className={styles.reviewMessage}>"{review.message}"</p>
        <div className={styles.reviewMeta}>
          <Avatar className={styles.reviewAvatar}>
            <AvatarImage src="" alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className={styles.reviewName}>{displayName}</p>
            {dateLabel ? <p className={styles.reviewDate}>{dateLabel}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
