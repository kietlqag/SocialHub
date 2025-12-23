import type { ComponentType, KeyboardEvent, MouseEvent } from "react";
import { ArrowRight, Share2, Star } from "lucide-react";
import { Button } from "../ui/button";

export type DashboardCardVariant = "grid" | "favorite" | "recent";

export type DashboardCardIconPreset = {
  Icon: ComponentType<{ className?: string }>;
  toneClass: string;
};

type DashboardCardProps = {
  id: string;
  title: string;
  typeLabel?: string;
  overviewCount: number;
  insightCount: number;
  tableCount: number;
  status?: string;
  isFavorite?: boolean;
  lastViewed?: string | null;
  variant?: DashboardCardVariant;
  icon: DashboardCardIconPreset;
  onOpen?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onShare?: (id: string) => void;
  shareLabel?: string;
};

export function DashboardCard({
  id,
  title,
  typeLabel,
  overviewCount,
  insightCount,
  tableCount,
  status = "Active",
  isFavorite = false,
  lastViewed,
  variant = "grid",
  icon,
  onOpen,
  onToggleFavorite,
  onShare,
  shareLabel = "Share",
}: DashboardCardProps) {
  const { Icon, toneClass } = icon;
  const metaChips = [
    { label: "Key metrics", value: overviewCount },
    { label: "Charts", value: insightCount },
    { label: "Tables", value: tableCount },
  ];

  const handleOpen = (event?: MouseEvent) => {
    event?.stopPropagation?.();
    onOpen?.(id);
  };

  const handleFavorite = (event: MouseEvent) => {
    event.stopPropagation();
    onToggleFavorite?.(id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen?.(id);
    }
  };

  if (variant === "recent") {
    return (
      <div
        className={`dashboard-card dashboard-card--recent ${isFavorite ? "is-favorite" : ""}`}
        onClick={() => onOpen?.(id)}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className={`dashboard-card__icon ${toneClass}`}>
          <Icon className="w-6 h-6 text-white drop-shadow" />
        </div>
        <div className="dashboard-card__body">
          <div className="dashboard-card__header-row">
            <div>
              {typeLabel && <p className="dashboard-card__type">{typeLabel}</p>}
              <h4 className="dashboard-card__title">{title}</h4>
            </div>
            <button type="button" className={`dashboard-card__favorite ${isFavorite ? "is-active" : ""}`} onClick={handleFavorite} aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}>
              <Star className="w-4 h-4" />
            </button>
          </div>
          <div className="dashboard-card__meta">
            {metaChips.map((chip) => (
              <span key={chip.label} className="dashboard-chip">
                <span>{chip.label}</span>
                <strong>{chip.value}</strong>
              </span>
            ))}
          </div>
          {lastViewed && <p className="dashboard-card__timestamp">Viewed {lastViewed}</p>}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button variant="ghost" className="dashboard-card__cta" onClick={handleOpen}>
            Open dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
          {onShare && (
            <Button variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onShare(id); }}>
              <Share2 className="w-4 h-4" />
              {shareLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dashboard-card ${variant === "favorite" ? "dashboard-card--favorite" : ""} ${isFavorite ? "is-favorite" : ""}`}
      onClick={() => onOpen?.(id)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="dashboard-card__header">
        <div className={`dashboard-card__icon ${toneClass}`}>
          <Icon className="w-6 h-6 text-white drop-shadow" />
        </div>
        <div className="dashboard-card__title-group">
          {typeLabel && <p className="dashboard-card__type">{typeLabel}</p>}
          <h4 className="dashboard-card__title">{title}</h4>
        </div>
        <div className="dashboard-card__header-actions">
          {status && <span className={`dashboard-status ${status.toLowerCase() === "active" ? "dashboard-status--active" : "dashboard-status--draft"}`}>{status}</span>}
          <button type="button" className={`dashboard-card__favorite ${isFavorite ? "is-active" : ""}`} onClick={handleFavorite} aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}>
            <Star className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="dashboard-card__meta">
        {metaChips.map((chip) => (
          <span key={chip.label} className="dashboard-chip">
            <span>{chip.label}</span>
            <strong>{chip.value}</strong>
          </span>
        ))}
      </div>

      <div className="dashboard-card__footer">
        {lastViewed && <p className="dashboard-card__timestamp">Updated {lastViewed}</p>}
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="dashboard-card__cta" onClick={handleOpen}>
            Open dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
          {onShare && (
            <Button variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onShare(id); }}>
              <Share2 className="w-4 h-4" />
              {shareLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardCard;
