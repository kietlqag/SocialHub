import { Star } from "lucide-react";
import styles from "./ReviewsSection.module.css";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  className?: string;
};

export function StarRating({ value, onChange, size = 18, className }: StarRatingProps) {
  return (
    <div className={`${styles.stars} ${className || ""}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            onClick={onChange ? () => onChange(star) : undefined}
            className={`${styles.star} ${active ? styles.starActive : ""}`}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <Star style={{ width: size, height: size }} />
          </button>
        );
      })}
    </div>
  );
}
