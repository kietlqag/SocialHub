import type { KeyboardEvent, MouseEvent } from "react";
import { ArrowRight, Star } from "lucide-react";
import { Button } from "../ui/button";
import { domainVisuals } from "./dashboardCardUtils";
import type { DashboardCardIconPreset } from "./DashboardCard";

export type CardDashProps = {
  id: string;
  title: string;
  domainLabel?: string;
  overviewCount?: number;
  chartsCount?: number;
  tableCount?: number;
  status?: string;
  lastUpdatedLabel?: string | null;
  isFavorite?: boolean;
  iconPreset?: DashboardCardIconPreset | keyof typeof domainVisuals;
  onOpen?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
};

const resolveIconPreset = (preset?: DashboardCardIconPreset | keyof typeof domainVisuals): DashboardCardIconPreset => {
  if (preset && typeof preset === "object" && "Icon" in preset && "toneClass" in preset) {
    return preset as DashboardCardIconPreset;
  }
  if (preset && typeof preset === "string" && preset in domainVisuals) {
    return domainVisuals[preset as keyof typeof domainVisuals];
  }
  return domainVisuals.general;
};

export const CardDash = ({
  id,
  title,
  domainLabel,
  overviewCount = 0,
  chartsCount = 0,
  tableCount = 0,
  status = "Active",
  lastUpdatedLabel,
  isFavorite = false,
  iconPreset,
  onOpen,
  onToggleFavorite,
}: CardDashProps) => {
  const { Icon, toneClass } = resolveIconPreset(iconPreset);
  const metaChips = [
    { label: "Key metrics", value: overviewCount },
    { label: "Charts", value: chartsCount },
    { label: "Tables", value: tableCount },
  ];

  const handleOpen = (event?: MouseEvent | KeyboardEvent) => {
    event?.stopPropagation?.();
    onOpen?.(id);
  };

  return (
    <div
      className={`dashboard-card ${isFavorite ? "is-favorite" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(id);
        }
      }}
    >
      <div className="dashboard-card__header">
        <div className={`dashboard-card__icon ${toneClass}`}>
          <Icon className="w-6 h-6 text-white drop-shadow" />
        </div>
        <div className="dashboard-card__title-group">
          {domainLabel && <p className="dashboard-card__type">{domainLabel}</p>}
          <h4 className="dashboard-card__title">{title}</h4>
        </div>
        <div className="dashboard-card__header-actions">
          {status && <span className={`dashboard-status ${status.toLowerCase() === "active" ? "dashboard-status--active" : "dashboard-status--draft"}`}>{status}</span>}
          {onToggleFavorite && (
            <button
              type="button"
              className={`dashboard-card__favorite ${isFavorite ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(id);
              }}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className="w-4 h-4" />
            </button>
          )}
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
        {lastUpdatedLabel && <p className="dashboard-card__timestamp">Updated {lastUpdatedLabel}</p>}
        <Button variant="ghost" className="dashboard-card__cta" onClick={handleOpen}>
          Open dashboard
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CardDash;
