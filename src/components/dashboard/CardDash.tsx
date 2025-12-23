import type { KeyboardEvent, MouseEvent } from "react";
import { ArrowRight, Share2, Star } from "lucide-react";
import { Button } from "../ui/button";
import { domainVisuals } from "./dashboardCardUtils";
import type { DashboardCardIconPreset } from "./DashboardCard";

export type CardDashProps = {
  id: string;
  title: string;
  domainLabel?: string;
  typeLabel?: string;
  overviewCount?: number;
  chartsCount?: number;
  tableCount?: number;
  status?: string;
  lastUpdatedLabel?: string | null;
  isFavorite?: boolean;
  iconPreset?: DashboardCardIconPreset | keyof typeof domainVisuals;
  icon?: DashboardCardIconPreset | keyof typeof domainVisuals;
  createdBy?: string;
  hideStats?: boolean;
  onOpen?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onShare?: (id: string) => void;
  onUseTemplate?: (id: string) => void;
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
  icon,
  onOpen,
  onToggleFavorite,
  onShare,
  onUseTemplate,
  createdBy,
  hideStats = false,
}: CardDashProps) => {
  const { Icon, toneClass } = resolveIconPreset(iconPreset ?? icon);
  const metaChips = [
    { label: "Key metrics", value: overviewCount },
    { label: "Tables", value: tableCount },
  ];
  const isLocked = String(status || "").toLowerCase() === "locked";

  const handleOpen = (event?: MouseEvent | KeyboardEvent) => {
    event?.stopPropagation?.();
    if (isLocked) return;
    onOpen?.(id);
  };

  const handleShare = (event?: MouseEvent | KeyboardEvent) => {
    event?.stopPropagation?.();
    onShare?.(id);
  };

  const handleUseTemplate = (event?: MouseEvent | KeyboardEvent) => {
    event?.stopPropagation?.();
    onUseTemplate?.(id);
  };

  return (
    <div
      className={`dashboard-card ${isFavorite ? "is-favorite" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isLocked) return;
        onOpen?.(id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isLocked) return;
          onOpen?.(id);
        }
      }}
      style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
    >
      <div className="dashboard-card__header">
        <div className={`dashboard-card__icon ${toneClass}`}>
          <Icon className="w-6 h-6 text-white drop-shadow" />
        </div>
        <div className="dashboard-card__title-group">
          {(domainLabel || typeLabel) && <p className="dashboard-card__type">{domainLabel || typeLabel}</p>}
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
        {createdBy && (
          <div className="dashboard-card__created-row">
            <p className="text-sm text-slate-500">
              Created by <span className="text-indigo-600 font-medium">{createdBy}</span>
            </p>
            {hideStats && (
              <Button variant="ghost" className="dashboard-card__cta dashboard-card__created-cta" onClick={handleOpen}>
                Open dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {!hideStats && (
        <div className="dashboard-card__meta-row">
          <div className="dashboard-card__meta">
            {metaChips.map((chip) => (
              <span key={chip.label} className="dashboard-chip">
                <span>{chip.label}</span>
                <strong>{chip.value}</strong>
              </span>
            ))}
          </div>
          <Button
            variant="ghost"
            className="dashboard-card__cta dashboard-card__meta-action"
            onClick={handleOpen}
          >
            Open dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="dashboard-card__footer">
        {lastUpdatedLabel && <p className="dashboard-card__timestamp">Updated {lastUpdatedLabel}</p>}
        <div className="dashboard-card__actions">
          {onShare && (
            <Button variant="outline" size="sm" className="dashboard-card__cta dashboard-card__cta--share" onClick={handleShare}>
              Share
              <Share2 className="w-4 h-4" />
            </Button>
          )}
          {onUseTemplate && (
            <Button
              variant="outline"
              size="sm"
              className="dashboard-card__cta dashboard-card__cta--template"
              onClick={handleUseTemplate}
            >
              Use template
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardDash;
