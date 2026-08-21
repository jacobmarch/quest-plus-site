"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SkillRow } from "@/lib/database.types";
import { buildEdges, type SkillNodeState } from "@/lib/skills";

export type SkillNodeData = {
  name: string;
  state: SkillNodeState;
  rank: number;
  maxRank: number;
  cost: number;
};

export type SkillNodeType = Node<SkillNodeData, "skill">;

const STATE_STYLES: Record<
  SkillNodeState,
  { border: string; bg: string; text: string }
> = {
  learned: {
    border: "border-primary",
    bg: "bg-primary text-primary-foreground",
    text: "",
  },
  available: {
    border: "border-foreground/50",
    bg: "bg-card",
    text: "text-card-foreground",
  },
  locked: {
    border: "border-border",
    bg: "bg-muted text-muted-foreground opacity-70",
    text: "",
  },
};

function SkillNode({ data }: NodeProps<SkillNodeType>) {
  const style = STATE_STYLES[data.state];
  return (
    <div
      className={`min-w-[140px] rounded-lg border-2 px-3 py-2 shadow-sm ${style.border} ${style.bg}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground"
      />
      <p className="text-sm font-semibold leading-tight">{data.name}</p>
      <p className={`text-xs ${style.text || "opacity-80"}`}>
        Rank {data.rank}/{data.maxRank} · {data.cost} pt(s)
      </p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground"
      />
    </div>
  );
}

const nodeTypes = { skill: SkillNode };

export function SkillTreeCanvas({
  skills,
  ranksById,
  editable = false,
  onNodeClick,
  onConnectPrereq,
  onDisconnectPrereq,
  onMoveNode,
}: {
  skills: SkillRow[];
  ranksById: Map<string, number>;
  editable?: boolean;
  onNodeClick?: (skillId: string) => void;
  onConnectPrereq?: (skillId: string, prereqId: string) => void;
  onDisconnectPrereq?: (skillId: string, prereqId: string) => void;
  onMoveNode?: (skillId: string, x: number, y: number) => void;
}) {
  const learnedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const skill of skills) {
      if ((ranksById.get(skill.id) ?? 0) > 0) ids.add(skill.id);
    }
    return ids;
  }, [skills, ranksById]);

  const initialNodes = useMemo<SkillNodeType[]>(
    () =>
      skills.map((skill) => {
        const rank = ranksById.get(skill.id) ?? 0;
        const state: SkillNodeState =
          rank > 0
            ? "learned"
            : skill.prereq_skill_ids.every((id) => learnedIds.has(id))
              ? "available"
              : "locked";
        return {
          id: skill.id,
          type: "skill" as const,
          position: { x: skill.x, y: skill.y },
          data: {
            name: skill.name,
            state,
            rank,
            maxRank: skill.max_rank,
            cost: Number(skill.cost_per_rank),
          },
        };
      }),
    [skills, ranksById, learnedIds],
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      buildEdges(skills).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [skills],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_: unknown, node: SkillNodeType) => onNodeClick?.(node.id),
    [onNodeClick],
  );

  const handleNodeDragStop = useCallback(
    (_: unknown, node: SkillNodeType) =>
      onMoveNode?.(node.id, node.position.x, node.position.y),
    [onMoveNode],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (
        connection.source &&
        connection.target &&
        connection.source !== connection.target
      ) {
        onConnectPrereq?.(connection.target, connection.source);
      }
    },
    [onConnectPrereq],
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        onDisconnectPrereq?.(edge.target, edge.source);
      }
    },
    [onDisconnectPrereq],
  );

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-lg border">
      <ReactFlow<SkillNodeType>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeDragStop={editable ? handleNodeDragStop : undefined}
        nodesDraggable={editable}
        nodesConnectable={editable}
        onConnect={editable ? handleConnect : undefined}
        onEdgesDelete={editable ? handleEdgesDelete : undefined}
        deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
