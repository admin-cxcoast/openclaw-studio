"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  type Node,
  type OnMove,
  type ReactFlowInstance,
} from "@xyflow/react";
import type {
  AgentTile,
  CanvasTransform,
  TilePosition,
  TileSize,
} from "@/features/canvas/state/store";
import { AgentTileNode, type AgentTileNodeData } from "./AgentTileNode";

type CanvasFlowProps = {
  tiles: AgentTile[];
  transform: CanvasTransform;
  viewportRef?: React.MutableRefObject<HTMLDivElement | null>;
  selectedTileId: string | null;
  canSend: boolean;
  onSelectTile: (id: string | null) => void;
  onMoveTile: (id: string, position: TilePosition) => void;
  onResizeTile: (id: string, size: TileSize) => void;
  onDeleteTile: (id: string) => void;
  onRenameTile: (id: string, name: string) => Promise<boolean>;
  onDraftChange: (id: string, value: string) => void;
  onSend: (id: string, sessionKey: string, message: string) => void;
  onModelChange: (id: string, sessionKey: string, value: string | null) => void;
  onThinkingChange: (id: string, sessionKey: string, value: string | null) => void;
  onUpdateTransform: (patch: Partial<CanvasTransform>) => void;
  onInit?: (instance: ReactFlowInstance) => void;
};

type TileNode = Node<AgentTileNodeData>;

const CanvasFlowInner = ({
  tiles,
  transform,
  viewportRef,
  selectedTileId,
  canSend,
  onSelectTile,
  onMoveTile,
  onResizeTile,
  onDeleteTile,
  onRenameTile,
  onDraftChange,
  onSend,
  onModelChange,
  onThinkingChange,
  onUpdateTransform,
  onInit,
}: CanvasFlowProps) => {
  const nodeTypes = useMemo(() => ({ agentTile: AgentTileNode }), []);
  const handlersRef = useRef({
    onMoveTile,
    onResizeTile,
    onDeleteTile,
    onRenameTile,
    onDraftChange,
    onSend,
    onModelChange,
    onThinkingChange,
  });

  useEffect(() => {
    handlersRef.current = {
      onMoveTile,
      onResizeTile,
      onDeleteTile,
      onRenameTile,
      onDraftChange,
      onSend,
      onModelChange,
      onThinkingChange,
    };
  }, [
    onMoveTile,
    onResizeTile,
    onDeleteTile,
    onRenameTile,
    onDraftChange,
    onSend,
    onModelChange,
    onThinkingChange,
  ]);

  const nodesFromTiles = useMemo<TileNode[]>(
    () =>
      tiles.map((tile) => ({
        id: tile.id,
        type: "agentTile",
        position: tile.position,
        width: tile.size.width,
        height: tile.size.height,
        dragHandle: "[data-drag-handle]",
        data: {
          tile,
          canSend,
          onResize: (size) => handlersRef.current.onResizeTile(tile.id, size),
          onDelete: () => handlersRef.current.onDeleteTile(tile.id),
          onNameChange: (name) => handlersRef.current.onRenameTile(tile.id, name),
          onDraftChange: (value) => handlersRef.current.onDraftChange(tile.id, value),
          onSend: (message) =>
            handlersRef.current.onSend(tile.id, tile.sessionKey, message),
          onModelChange: (value) =>
            handlersRef.current.onModelChange(tile.id, tile.sessionKey, value),
          onThinkingChange: (value) =>
            handlersRef.current.onThinkingChange(tile.id, tile.sessionKey, value),
        },
      })),
    [canSend, tiles]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesFromTiles);

  useEffect(() => {
    setNodes(nodesFromTiles);
  }, [nodesFromTiles, setNodes]);

  const handleMove: OnMove = useCallback(
    (_event, viewport) => {
      onUpdateTransform({
        zoom: viewport.zoom,
        offsetX: viewport.x,
        offsetY: viewport.y,
      });
    },
    [onUpdateTransform]
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: TileNode) => {
      onMoveTile(node.id, node.position);
    },
    [onMoveTile]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: TileNode) => {
      if (node.id === selectedTileId) return;
      onSelectTile(node.id);
    },
    [onSelectTile, selectedTileId]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: TileNode[] }) => {
      const nextSelection = selectedNodes[0]?.id ?? null;
      if (nextSelection === selectedTileId) return;
      onSelectTile(nextSelection);
    },
    [onSelectTile, selectedTileId]
  );

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (viewportRef) {
        viewportRef.current = node;
      }
    },
    [viewportRef]
  );

  return (
    <ReactFlow
      ref={setViewportRef}
      className="canvas-surface h-full w-full"
      data-canvas-viewport
      nodes={nodes}
      edges={[]}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={handleNodeDragStop}
      onNodeClick={handleNodeClick}
      onSelectionChange={handleSelectionChange}
      onPaneClick={() => {
        if (selectedTileId !== null) {
          onSelectTile(null);
        }
      }}
      onMove={handleMove}
      onInit={onInit}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      defaultViewport={{
        x: transform.offsetX,
        y: transform.offsetY,
        zoom: transform.zoom,
      }}
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
};

export const CanvasFlow = (props: CanvasFlowProps) => (
  <ReactFlowProvider>
    <CanvasFlowInner {...props} />
  </ReactFlowProvider>
);
