import type { SyntaxNode, Tree } from 'tree-sitter';
import { parseFileCached } from '../ast/cache';
import { getLanguageFromExtension } from '../ast/parser';

export interface CFGBlock {
  id: number;
  startLine: number;
  endLine: number;
  type: 'entry' | 'body' | 'branch' | 'exit';
}

export interface CFGEdge {
  from: number;
  to: number;
  type: 'sequential' | 'branch' | 'merge';
}

export interface CFGInfo {
  blocks: CFGBlock[];
  edges: CFGEdge[];
  entryBlockId: number;
  exitBlockId: number;
}

export interface CFGResult {
  function: string;
  file: string;
  complexity: number;
  blockCount: number;
  blocks: CFGBlock[];
}

// Node types that represent decision points for cyclomatic complexity
const DECISION_NODE_TYPES = new Set([
  'if_statement',
  'for_statement',
  'for_in_statement',
  'for_of_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
  'conditional_expression', // ternary
]);

// Binary operators that add complexity
const COMPLEXITY_OPERATORS = new Set(['&&', '||']);

// Function node types to search for
const FUNCTION_NODE_TYPES = new Set([
  'function_declaration',
  'function_expression',
  'method_definition',
  'arrow_function',
]);

/**
 * Find a function node by name in the AST
 */
export function findFunctionNode(
  tree: Tree,
  functionName: string,
): { node: SyntaxNode; type: string } | null {
  function walk(node: SyntaxNode): { node: SyntaxNode; type: string } | null {
    // Check if this is a function node
    if (FUNCTION_NODE_TYPES.has(node.type)) {
      const nameNode = node.childForFieldName('name');
      if (nameNode && nameNode.text === functionName) {
        return { node, type: node.type };
      }
    }

    // Check class methods
    if (node.type === 'class_declaration') {
      const classBody = node.childForFieldName('body');
      if (classBody) {
        for (const child of classBody.children || []) {
          if (child.type === 'method_definition') {
            const nameNode = child.childForFieldName('name');
            if (nameNode && nameNode.text === functionName) {
              return { node: child, type: 'method_definition' };
            }
          }
          const result = walk(child);
          if (result) return result;
        }
      }
    }

    // Continue searching in children
    for (const child of node.children || []) {
      const result = walk(child);
      if (result) return result;
    }

    return null;
  }

  return walk(tree.rootNode);
}

/**
 * Get the body node of a function
 */
function getFunctionBody(functionNode: SyntaxNode): SyntaxNode | null {
  // Try to get the body field
  const body = functionNode.childForFieldName('body');
  if (body) return body;

  // For arrow functions with expression body (no braces)
  // The body is the last child
  const children = functionNode.children ?? [];
  if (children.length > 0) {
    const lastChild = children[children.length - 1];
    if (lastChild && lastChild.type !== '=>' && lastChild.type !== 'formal_parameters') {
      return lastChild;
    }
  }

  return null;
}

/**
 * Count decision points within a node for cyclomatic complexity
 */
function countDecisionPoints(node: SyntaxNode): number {
  let count = 0;

  function walk(n: SyntaxNode) {
    if (!n) return;

    // Decision point nodes
    if (DECISION_NODE_TYPES.has(n.type)) {
      if (n.type === 'switch_statement') {
        // Count each case clause as a decision point
        const cases = n.children?.filter(
          (child: SyntaxNode) => child.type === 'switch_case' || child.type === 'switch_default',
        );
        count += cases?.length || 1;
      } else {
        count += 1;
      }
    }

    // Binary expressions with && or ||
    if (n.type === 'binary_expression') {
      const operator = n.childForFieldName('operator');
      if (operator && COMPLEXITY_OPERATORS.has(operator.text)) {
        count += 1;
      }
    }

    // Walk children
    for (const child of n.children || []) {
      walk(child);
    }
  }

  walk(node);
  return count;
}

/**
 * Count basic blocks within a function body
 */
function countBlocks(node: SyntaxNode): number {
  let blockCount = 2; // Entry + Exit blocks

  function walk(n: SyntaxNode) {
    if (!n) return;

    // Each control flow structure adds blocks
    if (n.type === 'if_statement') {
      blockCount += 1; // Then block
      const elseClause = n.children?.find((child: SyntaxNode) => child.type === 'else_clause');
      if (elseClause) {
        blockCount += 1; // Else block
      }
    } else if (
      n.type === 'for_statement' ||
      n.type === 'for_in_statement' ||
      n.type === 'for_of_statement' ||
      n.type === 'while_statement' ||
      n.type === 'do_statement'
    ) {
      blockCount += 1; // Loop body block
    } else if (n.type === 'switch_statement') {
      const cases = n.children?.filter(
        (child: SyntaxNode) => child.type === 'switch_case' || child.type === 'switch_default',
      );
      blockCount += cases?.length || 0;
    }

    // Walk children
    for (const child of n.children ?? []) {
      walk(child);
    }
  }

  walk(node);
  return blockCount;
}

/**
 * Build basic blocks from function body
 */
function buildBlocks(node: SyntaxNode, startLine: number, endLine: number): CFGBlock[] {
  const blocks: CFGBlock[] = [];
  let blockId = 0;

  // Entry block
  blocks.push({
    id: blockId++,
    startLine,
    endLine: startLine,
    type: 'entry',
  });

  // Count and add branch blocks for control flow structures
  function addBranchBlocks(n: SyntaxNode) {
    if (!n) return;

    if (n.type === 'if_statement') {
      blocks.push({
        id: blockId++,
        startLine: n.startPosition.row + 1,
        endLine: n.endPosition.row + 1,
        type: 'branch',
      });
    } else if (
      n.type === 'for_statement' ||
      n.type === 'for_in_statement' ||
      n.type === 'for_of_statement' ||
      n.type === 'while_statement' ||
      n.type === 'do_statement'
    ) {
      blocks.push({
        id: blockId++,
        startLine: n.startPosition.row + 1,
        endLine: n.endPosition.row + 1,
        type: 'branch',
      });
    } else if (n.type === 'switch_statement') {
      const cases = n.children?.filter(
        (child: SyntaxNode) => child.type === 'switch_case' || child.type === 'switch_default',
      );
      for (const caseNode of cases ?? []) {
        blocks.push({
          id: blockId++,
          startLine: caseNode.startPosition.row + 1,
          endLine: caseNode.endPosition.row + 1,
          type: 'branch',
        });
      }
    }

    for (const child of n.children ?? []) {
      addBranchBlocks(child);
    }
  }

  addBranchBlocks(node);

  // Body block (simplified - main function body)
  blocks.push({
    id: blockId++,
    startLine,
    endLine,
    type: 'body',
  });

  // Exit block
  blocks.push({
    id: blockId++,
    startLine: endLine,
    endLine,
    type: 'exit',
  });

  return blocks;
}

/**
 * Extract CFG information for a specific function in a file
 */
export function extractCFG(filePath: string, functionName: string): CFGResult {
  const language = getLanguageFromExtension(filePath);
  if (!language || (language !== 'typescript' && language !== 'javascript')) {
    return {
      function: functionName,
      file: filePath,
      complexity: 0,
      blockCount: 0,
      blocks: [],
    };
  }

  const tree = parseFileCached(filePath);
  if (!tree) {
    return {
      function: functionName,
      file: filePath,
      complexity: 0,
      blockCount: 0,
      blocks: [],
    };
  }

  const functionInfo = findFunctionNode(tree, functionName);
  if (!functionInfo) {
    return {
      function: functionName,
      file: filePath,
      complexity: 0,
      blockCount: 0,
      blocks: [],
    };
  }

  const bodyNode = getFunctionBody(functionInfo.node);
  if (!bodyNode) {
    return {
      function: functionName,
      file: filePath,
      complexity: 1,
      blockCount: 2,
      blocks: [
        {
          id: 0,
          startLine: functionInfo.node.startPosition.row + 1,
          endLine: functionInfo.node.startPosition.row + 1,
          type: 'entry',
        },
        {
          id: 1,
          startLine: functionInfo.node.endPosition.row + 1,
          endLine: functionInfo.node.endPosition.row + 1,
          type: 'exit',
        },
      ],
    };
  }

  const decisionPoints = countDecisionPoints(bodyNode);
  const complexity = decisionPoints + 1;
  const blockCount = countBlocks(bodyNode);

  const blocks = buildBlocks(
    bodyNode,
    functionInfo.node.startPosition.row + 1,
    functionInfo.node.endPosition.row + 1,
  );

  return {
    function: functionName,
    file: filePath,
    complexity,
    blockCount,
    blocks,
  };
}

/**
 * Build full CFG with edges (for future use)
 */
export function buildFullCFG(filePath: string, functionName: string): CFGInfo | null {
  const language = getLanguageFromExtension(filePath);
  if (!language || (language !== 'typescript' && language !== 'javascript')) {
    return null;
  }

  const tree = parseFileCached(filePath);
  if (!tree) return null;

  const functionInfo = findFunctionNode(tree, functionName);
  if (!functionInfo) return null;

  const bodyNode = getFunctionBody(functionInfo.node);
  if (!bodyNode) {
    return {
      blocks: [
        {
          id: 0,
          startLine: functionInfo.node.startPosition.row + 1,
          endLine: functionInfo.node.startPosition.row + 1,
          type: 'entry',
        },
        {
          id: 1,
          startLine: functionInfo.node.endPosition.row + 1,
          endLine: functionInfo.node.endPosition.row + 1,
          type: 'exit',
        },
      ],
      edges: [{ from: 0, to: 1, type: 'sequential' }],
      entryBlockId: 0,
      exitBlockId: 1,
    };
  }

  const result = extractCFG(filePath, functionName);
  const edges: CFGEdge[] = [];

  for (let i = 0; i < result.blocks.length - 1; i++) {
    const fromBlock = result.blocks[i];
    const toBlock = result.blocks[i + 1];
    if (fromBlock && toBlock) {
      edges.push({
        from: fromBlock.id,
        to: toBlock.id,
        type: 'sequential',
      });
    }
  }

  return {
    blocks: result.blocks,
    edges,
    entryBlockId: 0,
    exitBlockId: result.blocks.length > 0 ? result.blocks.length - 1 : 0,
  };
}
