import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle, 
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- Custom Node Component ---
const TaskNode = ({ data }: NodeProps<{
  label: string;
  responsible: string;
  start: string;
  finish: string;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  float: number;
  is_critical: boolean;
  status: string;
}>) => {
  const fillcolor = data.status === 'Complete' ? '#10b981' : (data.status === 'Active' ? '#f59e0b' : '#f8fafc');
  const fontcolor = (data.status === 'Complete' || data.status === 'Active') ? 'white' : '#1e293b';
  const borderColor = data.is_critical ? '#ef4444' : '#cbd5e1';
  const borderWidth = data.is_critical ? '3px' : '1px';

  return (
    <div 
      className="bg-white rounded shadow-xl overflow-hidden text-center flex flex-col"
      style={{ width: 220, border: `${borderWidth} solid ${borderColor}` }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      {/* Header */}
      <div className="p-3" style={{ backgroundColor: fillcolor, color: fontcolor }}>
        <p className="text-[11px] font-bold uppercase truncate">{data.label}</p>
        <p className="text-[8px] opacity-80 uppercase tracking-tighter">Assigned: {data.responsible}</p>
      </div>

      {/* Dates */}
      <div className="p-1 border-b border-slate-100">
        <p className="text-[8px] font-bold text-slate-500 uppercase">{data.start} to {data.finish}</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 text-[8px] font-bold text-slate-400">
        <div className="p-1 border-r border-b border-slate-100 uppercase">ES: {data.es}</div>
        <div className="p-1 border-b border-slate-100 uppercase">EF: {data.ef}</div>
        <div className="p-1 border-r border-slate-100 uppercase">LS: {data.ls}</div>
        <div className="p-1 uppercase">LF: {data.lf}</div>
      </div>

      {/* Footer (Float) */}
      <div 
        className="p-1 text-[9px] font-bold uppercase"
        style={{ 
          backgroundColor: data.is_critical ? '#ef4444' : '#f8fafc',
          color: data.is_critical ? 'white' : '#64748b'
        }}
      >
        FLOAT: {data.float}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

const nodeTypes = {
  task: TaskNode,
};

interface NetworkDiagramProps {
  data: {
    nodes: Record<string, any>;
    critical_path_ids: number[];
  };
}

export const NetworkDiagram: React.FC<NetworkDiagramProps> = ({ data }) => {
  const initialNodes: Node[] = useMemo(() => {
    return Object.values(data.nodes).map((n, index) => ({
      id: n.activity_id.toString(),
      type: 'task',
      data: { 
        label: n.activity_name,
        responsible: n.responsible_name,
        start: n.planned_start,
        finish: n.planned_finish,
        es: n.es,
        ef: n.ef,
        ls: n.ls,
        lf: n.lf,
        float: n.float,
        is_critical: n.is_critical,
        status: n.status
      },
      // Simple layout logic: horizontal spacing based on ES, vertical based on order
      position: { x: n.es * 150, y: index * 120 },
    }));
  }, [data]);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    Object.values(data.nodes).forEach(n => {
      n.successors.forEach((succId: number) => {
        const isCritical = data.critical_path_ids.includes(n.activity_id) && 
                          data.critical_path_ids.includes(succId);
        edges.push({
          id: `e-${n.activity_id}-${succId}`,
          source: n.activity_id.toString(),
          target: succId.toString(),
          animated: isCritical,
          style: { 
            stroke: isCritical ? '#ef4444' : '#cbd5e1', 
            strokeWidth: isCritical ? 3 : 1 
          },
        });
      });
    });
    return edges;
  }, [data]);

  return (
    <div className="h-[600px] w-full bg-slate-950/50 rounded-3xl border border-white/5 overflow-hidden shadow-inner">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
      >
        <Background color="#334155" variant="dots" gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};
