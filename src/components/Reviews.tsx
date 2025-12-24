import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Star } from "lucide-react";
import { fetchReviews, type ReviewItem } from "../services/reviews";

const fallbackTestimonials = [
  {
    name: "Sarah Chen",
    title: "Operations Manager",
    org: "RetailCorp",
    avatar: "SC",
    content:
      "SocialHub has transformed how we track our store performance. The custom dashboards give us real-time insights that have improved our efficiency by 40%.",
    rating: 5,
  },
  {
    name: "Michael Rodriguez",
    title: "CEO",
    org: "Growth Ventures",
    avatar: "MR",
    content:
      "The drag-and-drop dashboard builder is incredible. We can now visualize all our business metrics in one place without needing a developer.",
    rating: 5,
  },
  {
    name: "Emily Watson",
    title: "Finance Director",
    org: "TechStart Inc.",
    avatar: "EW",
    content:
      "SocialHub's data integration capabilities saved us weeks of manual reporting. Everything syncs automatically and the insights are invaluable.",
    rating: 5,
  },
];

const getInitials = (name?: string | null, email?: string | null) => {
  const base = name || email || "Anonymous";
  const parts = base.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export function Reviews() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetchReviews(9);
        if (!mounted) return;
        setItems(res.items || []);
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const testimonials = useMemo(() => {
    if (!items.length) return [];
    return items.map((review) => ({
      id: review.id,
      name: review.name || review.email || "Anonymous",
      title: review.name ? "SocialHub user" : "Guest reviewer",
      org: review.email ? review.email : "Community",
      avatar: getInitials(review.name, review.email),
      content: review.message,
      rating: review.rating,
    }));
  }, [items]);

  const isSlider = testimonials.length > 3;

  return (
    <section id="testimonials" className="testimonials-section py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          <h2 className="section-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900">
            Trusted by thousands of businesses
          </h2>
          <p className="section-subtitle mt-4 max-w-2xl mx-auto text-xl">
            See what our customers are saying about SocialHub
          </p>
        </div>

        {loading ? (
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="testimonial-card h-64 animate-pulse rounded-3xl bg-white/60" />
            ))}
          </div>
        ) : testimonials.length ? (
          <div className={isSlider ? "mt-16 testimonial-slider" : "mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3"}>
            {testimonials.map((testimonial, index) => (
              <Card key={testimonial.id || index} className={`testimonial-card ${isSlider ? "testimonial-slide" : ""}`}>
                <CardContent className="testimonial-card__content">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="quote-text mb-6 text-base leading-relaxed">"{testimonial.content}"</p>
                  <div className="flex items-center">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src="" alt={testimonial.name} />
                      <AvatarFallback>{testimonial.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="ml-3">
                      <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
                      <p className="text-sm text-slate-500">
                        {testimonial.title}, {testimonial.org}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
