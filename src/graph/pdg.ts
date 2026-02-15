/**
 * Program Dependence Graph (PDG) types for program slicing.
 *
 * PDG combines CFG (control flow) and DFG (data flow) to enable:
 * - backward_slice: Find what affects a specific line
 * - forward_slice: Find what a specific line affects
 */

import { parseFileCached } from '../ast/cache';
import type { CFGInfo } from './cfg';
import { buildFullCFG, findFunctionNode } from './cfg';
import type { DFGInfo } from './dfg';
import { extractDFG } from './dfg';

/**
 * A node in the PDG representing a statement or expression.
 *
 * Maps to CFG blocks but also tracks data flow through the node.
 */
export interface PDGNode {
  /** Unique identifier for this node */
  id: number;
  /** Type of node: 'statement', 'branch', 'loop', 'entry', 'exit' */
  nodeType: 'statement' | 'branch' | 'loop' | 'entry' | 'exit';
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** Variables defined at this node */
  definitions: string[];
  /** Variables used at this node */
  uses: string[];
  /** Reference to CFG block ID if applicable */
  cfgBlockId: number | null;
}

/**
 * An edge in the PDG with dependency type labeling.
 *
 * Edge types:
 * - "control": Control dependency (from CFG)
 *   - "true" / "false": Branch conditions
 *   - "unconditional": Sequential flow
 * - "data": Data dependency (from DFG)
 */
export interface PDGEdge {
  /** Source node ID */
  sourceId: number;
  /** Target node ID */
  targetId: number;
  /** Dependency type: 'control' or 'data' */
  depType: 'control' | 'data';
  /** Edge label: e.g., "true", "false", or variable name */
  label: string;
}

/**
 * Container for PDG with slicing operations.
 *
 * Combines CFG and DFG to provide unified program dependence analysis
 * and program slicing operations.
 */
export interface PDGInfo {
  /** Name of the function this PDG represents */
  functionName: string;
  /** Underlying Control Flow Graph */
  cfg: CFGInfo;
  /** Underlying Data Flow Graph */
  dfg: DFGInfo;
  /** All PDG nodes */
  nodes: PDGNode[];
  /** All PDG edges */
  edges: PDGEdge[];

  /**
   * Compute backward slice: all statements that can affect the given line.
   *
   * @param line - Line number to slice from
   * @param variable - Optional specific variable to trace (traces all if undefined)
   * @returns Array of line numbers in the backward slice
   */
  backward_slice(line: number, variable?: string): number[];

  /**
   * Compute forward slice: all statements that can be affected by the given line.
   *
   * @param line - Line number to slice from
   * @param variable - Optional specific variable to trace (traces all if undefined)
   * @returns Array of line numbers in the forward slice
   */
  forward_slice(line: number, variable?: string): number[];

  /**
   * Export PDG as dictionary for serialization.
   *
   * @returns Record containing PDG, CFG, and DFG data
   */
  toDict(): Record<string, unknown>;
}

/**
 * Get full type string like 'control:true' or 'data:x'.
 */
export function getFullEdgeType(edge: PDGEdge): string {
  return `${edge.depType}:${edge.label}`;
}

/**
 * Convert PDGNode to dictionary representation.
 */
export function pdgNodeToDict(node: PDGNode): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: node.id,
    type: node.nodeType,
    lines: [node.startLine, node.endLine],
  };
  if (node.definitions.length > 0) {
    result.defs = node.definitions;
  }
  if (node.uses.length > 0) {
    result.uses = node.uses;
  }
  return result;
}

/**
 * Convert PDGEdge to dictionary representation.
 */
export function pdgEdgeToDict(edge: PDGEdge): Record<string, unknown> {
  return {
    from: edge.sourceId,
    to: edge.targetId,
    type: edge.depType,
    label: edge.label,
  };
}

/**
 * Compute backward slice: all statements that can affect the given line.
 *
 * Uses BFS traversal following both control and data dependencies.
 *
 * @param pdg - The PDG to slice
 * @param line - Target line number
 * @param variable - Optional variable to filter by
 * @returns Array of line numbers in the backward slice
 */
export function backwardSlice(pdg: PDGInfo, line: number, variable?: string): number[] {
  // Find nodes at the target line
  const targetNodes = pdg.nodes.filter((n) => n.startLine <= line && line <= n.endLine);
  if (targetNodes.length === 0) {
    return [];
  }

  // Build reverse edge map (target -> incoming edges)
  const incoming = new Map<number, PDGEdge[]>();
  for (const edge of pdg.edges) {
    const existing = incoming.get(edge.targetId) ?? [];
    existing.push(edge);
    incoming.set(edge.targetId, existing);
  }

  // BFS backward through dependencies
  const sliceLines = new Set<number>();
  const visited = new Set<number>();
  const worklist: number[] = [...targetNodes.map((n) => n.id)];

  while (worklist.length > 0) {
    const nodeId = worklist.pop();
    if (nodeId === undefined || visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    // Add this node's lines to slice
    const node = pdg.nodes.find((n) => n.id === nodeId);
    if (node) {
      for (let lineNum = node.startLine; lineNum <= node.endLine; lineNum++) {
        sliceLines.add(lineNum);
      }
    }

    // Follow incoming edges
    const edges = incoming.get(nodeId) ?? [];
    for (const edge of edges) {
      // If filtering by variable, only follow relevant data edges
      if (variable && edge.depType === 'data' && edge.label !== variable) {
        continue;
      }
      if (!visited.has(edge.sourceId)) {
        worklist.push(edge.sourceId);
      }
    }
  }

  return Array.from(sliceLines).sort((a, b) => a - b);
}

/**
 * Compute forward slice: all statements that can be affected by the given line.
 *
 * Uses BFS traversal following both control and data dependencies.
 *
 * @param pdg - The PDG to slice
 * @param line - Source line number
 * @param variable - Optional variable to filter by
 * @returns Array of line numbers in the forward slice
 */
export function forwardSlice(pdg: PDGInfo, line: number, variable?: string): number[] {
  // Find nodes at the source line
  const sourceNodes = pdg.nodes.filter((n) => n.startLine <= line && line <= n.endLine);
  if (sourceNodes.length === 0) {
    return [];
  }

  // Build forward edge map (source -> outgoing edges)
  const outgoing = new Map<number, PDGEdge[]>();
  for (const edge of pdg.edges) {
    const existing = outgoing.get(edge.sourceId) ?? [];
    existing.push(edge);
    outgoing.set(edge.sourceId, existing);
  }

  // BFS forward through dependencies
  const sliceLines = new Set<number>();
  const visited = new Set<number>();
  const worklist: number[] = [...sourceNodes.map((n) => n.id)];

  while (worklist.length > 0) {
    const nodeId = worklist.pop();
    if (nodeId === undefined || visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    // Add this node's lines to slice
    const node = pdg.nodes.find((n) => n.id === nodeId);
    if (node) {
      for (let lineNum = node.startLine; lineNum <= node.endLine; lineNum++) {
        sliceLines.add(lineNum);
      }
    }

    // Follow outgoing edges
    const edges = outgoing.get(nodeId) ?? [];
    for (const edge of edges) {
      // If filtering by variable, only follow relevant data edges
      if (variable && edge.depType === 'data' && edge.label !== variable) {
        continue;
      }
      if (!visited.has(edge.targetId)) {
        worklist.push(edge.targetId);
      }
    }
  }

  return Array.from(sliceLines).sort((a, b) => a - b);
}

/**
 * Get all dependencies for a line.
 *
 * @param pdg - The PDG to query
 * @param line - Line number to get dependencies for
 * @returns Record with control_in, control_out, data_in, data_out arrays
 */
export function getDependencies(
  pdg: PDGInfo,
  line: number,
): Record<string, Record<string, unknown>[]> {
  // Find nodes at the line
  const targetNodes = pdg.nodes.filter((n) => n.startLine <= line && line <= n.endLine);
  if (targetNodes.length === 0) {
    return {
      control_in: [],
      control_out: [],
      data_in: [],
      data_out: [],
    };
  }

  const targetIds = new Set(targetNodes.map((n) => n.id));

  const result: Record<string, Record<string, unknown>[]> = {
    control_in: [],
    control_out: [],
    data_in: [],
    data_out: [],
  };

  for (const edge of pdg.edges) {
    const edgeDict = pdgEdgeToDict(edge);

    if (targetIds.has(edge.targetId)) {
      const key = `${edge.depType}_in` as keyof typeof result;
      result[key]?.push(edgeDict);
    }

    if (targetIds.has(edge.sourceId)) {
      const key = `${edge.depType}_out` as keyof typeof result;
      result[key]?.push(edgeDict);
    }
  }

  return result;
}

/**
 * Convert PDG to dictionary representation for serialization.
 *
 * @param pdg - The PDG to convert
 * @returns Record containing PDG, CFG, and DFG data
 */
export function pdgToDict(pdg: PDGInfo): Record<string, unknown> {
  return {
    function: pdg.functionName,
    pdg: {
      nodes: pdg.nodes.map(pdgNodeToDict),
      edges: pdg.edges.map(pdgEdgeToDict),
    },
  };
}

/**
 * Extract PDG (Program Dependence Graph) from a TypeScript/JavaScript file for a specific function.
 * Combines CFG (control flow) and DFG (data flow) into a unified graph.
 *
 * @param filePath - Path to the source file
 * @param functionName - Name of the function to analyze
 * @returns PDGInfo object or null if function not found
 */
export function extractPDG(filePath: string, functionName: string): PDGInfo | null {
  // 1. Parse the file
  const tree = parseFileCached(filePath);
  if (!tree) return null;

  // 2. Find the function
  const funcInfo = findFunctionNode(tree, functionName);
  if (!funcInfo) return null;

  // 3. Get CFG (control flow) - using buildFullCFG to get edges
  const cfgInfo = buildFullCFG(filePath, functionName);
  // 4. Get DFG (data flow)
  const dfgInfo = extractDFG(filePath, functionName);

  if (!cfgInfo) return null;

  // 5. Build PDG nodes from CFG blocks with DFG variable info
  const nodes: PDGNode[] = [];
  const edges: PDGEdge[] = [];

  // Create a map from line to variable definitions and uses
  const lineToDefs = new Map<number, string[]>();
  const lineToUses = new Map<number, string[]>();

  for (const ref of dfgInfo.varRefs) {
    if (ref.type === 'definition' || ref.type === 'update') {
      const defs = lineToDefs.get(ref.line) ?? [];
      defs.push(ref.name);
      lineToDefs.set(ref.line, defs);
    } else if (ref.type === 'use') {
      const uses = lineToUses.get(ref.line) ?? [];
      uses.push(ref.name);
      lineToUses.set(ref.line, uses);
    }
  }

  // Create PDG nodes from CFG blocks
  for (const block of cfgInfo.blocks) {
    const definitions = lineToDefs.get(block.startLine) ?? [];
    const uses = lineToUses.get(block.startLine) ?? [];

    let nodeType: PDGNode['nodeType'];
    if (block.type === 'entry') {
      nodeType = 'entry';
    } else if (block.type === 'exit') {
      nodeType = 'exit';
    } else if (block.type === 'branch') {
      nodeType = 'branch';
    } else {
      nodeType = 'statement';
    }

    nodes.push({
      id: block.id,
      nodeType,
      startLine: block.startLine,
      endLine: block.endLine,
      definitions,
      uses,
      cfgBlockId: block.id,
    });
  }

  // 6. Add control edges from CFG
  for (const edge of cfgInfo.edges) {
    edges.push({
      sourceId: edge.from,
      targetId: edge.to,
      depType: 'control',
      label: edge.type,
    });
  }

  // 7. Add data edges from DFG def-use chains
  for (const dfEdge of dfgInfo.dataflowEdges) {
    // Find the PDG nodes for the definition and use lines
    const defNode = nodes.find((n) => n.startLine === dfEdge.def.line);
    const useNode = nodes.find((n) => n.startLine === dfEdge.use.line);

    if (defNode && useNode && defNode.id !== useNode.id) {
      edges.push({
        sourceId: defNode.id,
        targetId: useNode.id,
        depType: 'data',
        label: dfEdge.varName,
      });
    }
  }

  // Create the PDGInfo object with slicing methods
  const pdg: PDGInfo = {
    functionName,
    cfg: cfgInfo,
    dfg: dfgInfo,
    nodes,
    edges,
    backward_slice(line: number, variable?: string): number[] {
      return backwardSlice(this, line, variable);
    },
    forward_slice(line: number, variable?: string): number[] {
      return forwardSlice(this, line, variable);
    },
    toDict(): Record<string, unknown> {
      return pdgToDict(this);
    },
  };

  return pdg;
}
