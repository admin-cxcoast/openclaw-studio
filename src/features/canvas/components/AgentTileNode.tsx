"use client";

import { NodeResizer, type NodeProps } from "@xyflow/react";
import type { AgentTile as AgentTileType, TileSize } from "@/features/canvas/state/store";
import { AgentTile, MIN_TILE_SIZE } from "./AgentTile";

export type AgentTileNodeData = {
  tile: AgentTileType;
  canSend: boolean;
  onResize: (size: TileSize) => void;
  onDelete: () => void;
  onNameChange: (name: string) => Promise<boolean>;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
};

export const AgentTileNode = ({ data, selected }: NodeProps<AgentTileNodeData>) => {
  const {
    tile,
    canSend,
    onResize,
    onDelete,
    onNameChange,
    onDraftChange,
    onSend,
    onModelChange,
    onThinkingChange,
  } = data;

  return (
    <div className="h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_TILE_SIZE.width}
        minHeight={MIN_TILE_SIZE.height}
        handleClassName="tile-resize-handle"
        onResizeEnd={(_, params) => {
          onResize({ width: params.width, height: params.height });
        }}
      />
      <AgentTile
        tile={tile}
        isSelected={selected}
        canSend={canSend}
        onDelete={onDelete}
        onNameChange={onNameChange}
        onDraftChange={onDraftChange}
        onSend={onSend}
        onModelChange={onModelChange}
        onThinkingChange={onThinkingChange}
      />
    </div>
  );
};
