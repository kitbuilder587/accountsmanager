import { useState } from 'react';
import type { DetectedRegion, RegionAction } from '../../shared/reel.js';
import { getReelMediaUrl } from '../api.js';

interface RegionEditorProps {
  reelId: string;
  regions: DetectedRegion[];
  onRegionsChange: (regions: DetectedRegion[]) => void;
}

const ACTION_COLORS: Record<RegionAction, string> = {
  replace: '#22c55e',
  mask: '#ef4444',
  keep: '#6b7280',
};

const ACTION_LABELS: Record<RegionAction, string> = {
  replace: 'Replace text',
  mask: 'Mask/hide',
  keep: 'Keep as is',
};

export function RegionEditor({ reelId, regions, onRegionsChange }: RegionEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const frameUrl = getReelMediaUrl(reelId, 'frames/mid_frame.png');

  function handleActionChange(regionId: string, action: RegionAction) {
    onRegionsChange(
      regions.map(r => r.id === regionId ? { ...r, action } : r),
    );
  }

  return (
    <div className="region-editor">
      <div className="region-editor__frame-container">
        <img
          src={frameUrl}
          alt="Video frame"
          className="region-editor__frame"
          onError={(e) => {
            // Fallback to thumbnail if mid_frame not available
            (e.target as HTMLImageElement).src = getReelMediaUrl(reelId, 'thumbnail.jpg');
          }}
        />
        {/* Overlay bounding boxes */}
        <svg className="region-editor__overlay" viewBox="0 0 720 1280" preserveAspectRatio="none">
          {regions.filter(r => r.w > 0).map(region => (
            <g key={region.id} onClick={() => setSelectedId(region.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={region.x}
                y={region.y}
                width={region.w}
                height={region.h}
                fill="transparent"
                stroke={ACTION_COLORS[region.action]}
                strokeWidth={region.id === selectedId ? 4 : 2}
                strokeDasharray={region.action === 'keep' ? '8 4' : 'none'}
              />
              <text
                x={region.x + 4}
                y={region.y - 4}
                fill={ACTION_COLORS[region.action]}
                fontSize="18"
                fontWeight="bold"
              >
                {region.action.toUpperCase()}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="region-editor__list">
        <p className="panel-kicker">Detected regions ({regions.length})</p>
        {regions.map(region => (
          <div
            key={region.id}
            className={`region-item ${region.id === selectedId ? 'region-item--selected' : ''}`}
            onClick={() => setSelectedId(region.id)}
            style={{ borderLeftColor: ACTION_COLORS[region.action] }}
          >
            <div className="region-item__header">
              <span className="region-item__text">"{region.text}"</span>
              <span className="region-item__conf">{Math.round(region.confidence * 100)}%</span>
            </div>
            {region.w > 0 && (
              <div className="region-item__pos">
                x={region.x} y={region.y} {region.w}x{region.h}
              </div>
            )}
            {region.reason && (
              <div className="region-item__reason">{region.reason}</div>
            )}
            <div className="region-item__actions">
              {(['replace', 'mask', 'keep'] as RegionAction[]).map(action => (
                <button
                  key={action}
                  type="button"
                  className={`region-action-btn ${region.action === action ? 'region-action-btn--active' : ''}`}
                  style={{
                    borderColor: ACTION_COLORS[action],
                    backgroundColor: region.action === action ? ACTION_COLORS[action] : 'transparent',
                    color: region.action === action ? 'white' : ACTION_COLORS[action],
                  }}
                  onClick={(e) => { e.stopPropagation(); handleActionChange(region.id, action); }}
                >
                  {ACTION_LABELS[action]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
