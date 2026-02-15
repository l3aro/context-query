/**
 * Data Flow Graph (DFG) types for tracking variable definitions, uses, and data flow edges.
 *
 * These types model how data flows through a function - tracking where variables
 * are defined, updated, and used to understand data dependencies.
 */

/**
 * Represents a variable reference in the code.
 * Tracks where a variable is defined, updated, or used.
 */
export interface VarRef {
  /** The variable name */
  name: string;
  /** The type of reference: 'definition' (first assignment), 'update' (subsequent assignment), 'use' (read) */
  type: 'definition' | 'update' | 'use';
  /** Line number where this reference occurs (1-indexed) */
  line: number;
  /** Column number where this reference occurs (0-indexed) */
  column: number;
}

/**
 * Represents a data flow edge connecting a variable definition/update to its use.
 * Models the dependency between where a variable is written and where it's read.
 */
export interface DataflowEdge {
  /** The definition or update reference */
  def: VarRef;
  /** The use reference */
  use: VarRef;
  /** Getter property that returns the variable name from the definition reference */
  get varName(): string;
}

/**
 * Container for all data flow information within a function.
 * Groups variable references and data flow edges together.
 */
export interface DFGInfo {
  /** The name of the function this DFG represents */
  functionName: string;
  /** All variable references found in the function */
  varRefs: VarRef[];
  /** All data flow edges connecting definitions to uses */
  dataflowEdges: DataflowEdge[];
  /**
   * Helper method that groups variable references by variable name.
   * Returns a map where keys are variable names and values are arrays of VarRef.
   */
  variables: () => Map<string, VarRef[]>;
}

import type { SyntaxNode } from 'tree-sitter';
import { getLanguageFromExtension, parseFile } from '../ast/parser';
import { findFunctionNode } from './cfg';

/**
 * Keywords to filter out when identifying identifier uses.
 * These are reserved words that should not be treated as variable references.
 */
const RESERVED_KEYWORDS = new Set([
  'if',
  'else',
  'for',
  'while',
  'return',
  'function',
  'const',
  'let',
  'var',
  'true',
  'false',
  'null',
  'undefined',
  'this',
  'super',
  'new',
  'class',
  'extends',
  'import',
  'export',
  'from',
  'default',
  'try',
  'catch',
  'finally',
  'throw',
  'break',
  'continue',
  'switch',
  'case',
  'typeof',
  'instanceof',
  'void',
  'delete',
  'in',
  'of',
  'await',
  'async',
  'yield',
  'static',
  'public',
  'private',
  'protected',
]);

/**
 * Node types that represent function parameters.
 */
const PARAMETER_NODE_TYPES = new Set([
  'formal_parameters',
  'required_parameter',
  'optional_parameter',
]);

/**
 * DefUseVisitor walks a tree-sitter AST to identify variable definitions,
 * updates, and uses within a function body.
 */
export class DefUseVisitor {
  private varRefs: VarRef[] = [];
  private definedNames: Set<string> = new Set();

  /**
   * Visit a syntax node and extract variable references.
   * @param node - The tree-sitter syntax node to visit
   */
  visit(node: SyntaxNode): void {
    this.walk(node);
  }

  /**
   * Get all variable references collected during the visit.
   * @returns Array of VarRef objects
   */
  getVarRefs(): VarRef[] {
    return this.varRefs;
  }

  /**
   * Recursively walk the AST and identify variable references.
   * @param node - The current syntax node
   * @param inDefinitionContext - Whether we're in a definition context (e.g., left side of assignment)
   */
  private walk(node: SyntaxNode, inDefinitionContext = false): void {
    if (!node) return;

    // Handle variable declarations (const, let, var)
    if (node.type === 'variable_declaration' || node.type === 'lexical_declaration') {
      this.handleVariableDeclaration(node);
      return;
    }

    // Handle assignment expressions (=, +=, -=, etc.)
    if (node.type === 'assignment_expression') {
      this.handleAssignmentExpression(node);
      return;
    }

    // Handle augmented assignment expressions (+=, -=, *=, etc.)
    if (node.type === 'augmented_assignment_expression') {
      this.handleAugmentedAssignmentExpression(node);
      return;
    }

    // Handle function parameters
    if (node.type === 'formal_parameters') {
      this.handleFormalParameters(node);
      return; // Don't walk children - parameters handled as definitions
    } else if (node.type === 'required_parameter' || node.type === 'optional_parameter') {
      this.handleParameter(node);
    }

    // Handle identifiers (variable uses or definitions)
    if (node.type === 'identifier' && !inDefinitionContext) {
      // Skip identifiers that are children of formal_parameters - those are handled by handleFormalParameters
      const parent = node.parent;
      if (parent) {
        // Skip function name (field 'name' of function_declaration/function_expression)
        if (parent.type === 'function_declaration' || parent.type === 'function_expression') {
          const nameField = parent.childForFieldName('name');
          if (nameField === node) {
            return; // Skip function name
          }
        }
        // Skip parameters - already handled as definitions
        if (parent.type === 'formal_parameters') {
          return;
        }
      }
      this.handleIdentifierUse(node);
    }

    // Walk children
    for (const child of node.children ?? []) {
      this.walk(child, inDefinitionContext);
    }
  }

  /**
   * Handle variable declarations like: const x = 5, let y = 10, var z = 20
   */
  private handleVariableDeclaration(node: SyntaxNode): void {
    // Variable declarations have declarators as children
    for (const child of node.children ?? []) {
      if (child.type === 'variable_declarator') {
        this.handleVariableDeclarator(child);
      }
    }
  }

  /**
   * Handle a single variable declarator like: x = 5
   */
  private handleVariableDeclarator(node: SyntaxNode): void {
    const nameNode = node.childForFieldName('name');
    const valueNode = node.childForFieldName('value');

    if (nameNode && nameNode.type === 'identifier') {
      const name = nameNode.text;
      this.definedNames.add(name);

      this.varRefs.push({
        name,
        type: 'definition',
        line: nameNode.startPosition.row + 1,
        column: nameNode.startPosition.column,
      });
    }

    // Walk the value side to find uses of other variables
    if (valueNode) {
      this.walk(valueNode, false);
    }
  }

  /**
   * Handle assignment expressions like: x = 5
   */
  private handleAssignmentExpression(node: SyntaxNode): void {
    const leftNode = node.childForFieldName('left');
    const rightNode = node.childForFieldName('right');

    // Left side is a definition or update
    if (leftNode) {
      this.handleAssignmentTarget(leftNode);
    }

    // Right side may contain uses
    if (rightNode) {
      this.walk(rightNode, false);
    }
  }

  /**
   * Handle augmented assignment expressions like: x += 5, x -= 10
   * These are both a use (reading the current value) and an update (writing new value).
   */
  private handleAugmentedAssignmentExpression(node: SyntaxNode): void {
    const leftNode = node.childForFieldName('left');
    const rightNode = node.childForFieldName('right');

    if (leftNode && leftNode.type === 'identifier') {
      const name = leftNode.text;

      // Augmented assignment is both a use (read) and an update (write)
      // First, record the use (reading the current value)
      this.varRefs.push({
        name,
        type: 'use',
        line: leftNode.startPosition.row + 1,
        column: leftNode.startPosition.column,
      });

      // Then record the update (writing the new value)
      this.varRefs.push({
        name,
        type: 'update',
        line: leftNode.startPosition.row + 1,
        column: leftNode.startPosition.column,
      });
    }

    // Walk the right side to find other variable uses
    if (rightNode) {
      this.walk(rightNode, false);
    }
  }

  /**
   * Handle the left side of an assignment (definition or update).
   */
  private handleAssignmentTarget(node: SyntaxNode): void {
    if (node.type === 'identifier') {
      const name = node.text;

      // Check if this is a new definition or an update to an existing variable
      const refType: 'definition' | 'update' = this.definedNames.has(name)
        ? 'update'
        : 'definition';
      this.definedNames.add(name);

      this.varRefs.push({
        name,
        type: refType,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
      });
    } else if (node.type === 'array_pattern' || node.type === 'object_pattern') {
      // Handle destructuring patterns
      for (const child of node.children ?? []) {
        this.handleAssignmentTarget(child);
      }
    } else {
      // Walk other left-hand side expressions without marking as definition
      for (const child of node.children ?? []) {
        this.walk(child, false);
      }
    }
  }

  /**
   * Handle formal parameters node which contains all function parameters.
   */
  private handleFormalParameters(node: SyntaxNode): void {
    for (const child of node.children ?? []) {
      if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
        this.handleParameter(child);
      }
    }
  }

  /**
   * Handle a single parameter node (required or optional).
   */
  private handleParameter(node: SyntaxNode): void {
    // Try to get the pattern (name) field
    const patternNode = node.childForFieldName('pattern');
    if (patternNode) {
      if (patternNode.type === 'identifier') {
        this.handleParameterIdentifier(patternNode);
      } else if (patternNode.type === 'array_pattern' || patternNode.type === 'object_pattern') {
        // Destructured parameters
        this.handleDestructuredParameter(patternNode);
      }
    } else {
      // Some parameter nodes have the identifier directly as a child
      for (const child of node.children ?? []) {
        if (child.type === 'identifier') {
          this.handleParameterIdentifier(child);
          break;
        }
      }
    }

    // Walk default value if present
    const valueNode = node.childForFieldName('value');
    if (valueNode) {
      this.walk(valueNode, false);
    }
  }

  /**
   * Handle destructured parameters like: function foo([a, b]) or function bar({x, y})
   */
  private handleDestructuredParameter(node: SyntaxNode): void {
    for (const child of node.children ?? []) {
      if (child.type === 'identifier') {
        this.handleParameterIdentifier(child);
      } else if (child.type === 'shorthand_property_identifier_pattern') {
        // Object destructuring shorthand: { x } means x
        this.handleParameterIdentifier(child);
      } else if (child.type === 'pair_pattern') {
        // Object destructuring with rename: { x: y }
        const valueNode = child.childForFieldName('value');
        if (valueNode && valueNode.type === 'identifier') {
          this.handleParameterIdentifier(valueNode);
        }
      }
    }
  }

  /**
   * Handle a parameter identifier - adds it as a definition.
   */
  private handleParameterIdentifier(node: SyntaxNode): void {
    const name = node.text;
    this.definedNames.add(name);

    this.varRefs.push({
      name,
      type: 'definition',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    });
  }

  /**
   * Handle identifier uses - identifiers that are not in definition context.
   * Filters out reserved keywords.
   */
  private handleIdentifierUse(node: SyntaxNode): void {
    const name = node.text;

    // Filter out reserved keywords
    if (RESERVED_KEYWORDS.has(name)) {
      return;
    }

    this.varRefs.push({
      name,
      type: 'use',
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    });
  }

  /**
   * Check if a node type represents an assignment expression.
   * @param nodeType - The tree-sitter node type
   * @returns true if the node is an assignment expression
   */
  static isAssignmentExpression(nodeType: string): boolean {
    return nodeType === 'assignment_expression' || nodeType === 'augmented_assignment_expression';
  }

  /**
   * Check if a node type represents a variable declaration.
   * @param nodeType - The tree-sitter node type
   * @returns true if the node is a variable declaration
   */
  static isVariableDeclaration(nodeType: string): boolean {
    return nodeType === 'variable_declaration' || nodeType === 'lexical_declaration';
  }

  /**
   * Check if a node type represents a parameter.
   * @param nodeType - The tree-sitter node type
   * @returns true if the node is a parameter
   */
  static isParameter(nodeType: string): boolean {
    return PARAMETER_NODE_TYPES.has(nodeType);
  }

  /**
   * Check if an identifier is a reserved keyword.
   * @param name - The identifier name
   * @returns true if the name is a reserved keyword
   */
  static isReservedKeyword(name: string): boolean {
    return RESERVED_KEYWORDS.has(name);
  }
}

class DataflowEdgeImpl implements DataflowEdge {
  constructor(
    public def: VarRef,
    public use: VarRef,
  ) {}

  get varName(): string {
    return this.def.name;
  }
}

export class ReachingDefsAnalyzer {
  private varRefs: VarRef[];
  private defsByLine: Map<number, VarRef[]> = new Map();
  private usesByLine: Map<number, VarRef[]> = new Map();

  constructor(varRefs: VarRef[]) {
    this.varRefs = varRefs;
    this.groupRefsByLine();
  }

  private groupRefsByLine(): void {
    for (const ref of this.varRefs) {
      const line = ref.line;

      if (ref.type === 'definition' || ref.type === 'update') {
        const defs = this.defsByLine.get(line) ?? [];
        defs.push(ref);
        this.defsByLine.set(line, defs);
      } else if (ref.type === 'use') {
        const uses = this.usesByLine.get(line) ?? [];
        uses.push(ref);
        this.usesByLine.set(line, uses);
      }
    }
  }

  analyze(): DataflowEdge[] {
    const edges: DataflowEdge[] = [];
    const activeDefs = new Map<string, VarRef>();
    const allLines = this.getAllLines();

    for (const line of allLines) {
      // Process defs FIRST (so new definitions are active for uses on same line)
      const defs = this.defsByLine.get(line) ?? [];
      for (const def of defs) {
        activeDefs.set(def.name, def);
      }

      // Then process uses (link to active definitions)
      const uses = this.usesByLine.get(line) ?? [];
      for (const use of uses) {
        const activeDef = activeDefs.get(use.name);
        if (activeDef) {
          edges.push(new DataflowEdgeImpl(activeDef, use));
        }
      }
    }

    return edges;
  }

  private getAllLines(): number[] {
    const lines = new Set<number>();

    for (const line of this.defsByLine.keys()) {
      lines.add(line);
    }

    for (const line of this.usesByLine.keys()) {
      lines.add(line);
    }

    return Array.from(lines).sort((a, b) => a - b);
  }

  getDefsByLine(): Map<number, VarRef[]> {
    return new Map(this.defsByLine);
  }

  getUsesByLine(): Map<number, VarRef[]> {
    return new Map(this.usesByLine);
  }
}

/**
 * Extract Data Flow Graph (DFG) information for a specific function in a file.
 *
 * This function parses a source file, finds a function by name, and analyzes
 * the data flow within that function to identify variable definitions, uses,
 * and the data flow edges between them.
 *
 * @param filePath - Path to the source file
 * @param functionName - Name of the function to analyze
 * @returns DFGInfo object containing variable references and data flow edges
 */
export function extractDFG(filePath: string, functionName: string): DFGInfo {
  const language = getLanguageFromExtension(filePath);
  if (!language || (language !== 'typescript' && language !== 'javascript')) {
    return {
      functionName: functionName,
      varRefs: [],
      dataflowEdges: [],
      variables: () => new Map(),
    };
  }

  const tree = parseFile(filePath);
  if (!tree) {
    return {
      functionName: functionName,
      varRefs: [],
      dataflowEdges: [],
      variables: () => new Map(),
    };
  }

  const functionInfo = findFunctionNode(tree, functionName);
  if (!functionInfo) {
    return {
      functionName: functionName,
      varRefs: [],
      dataflowEdges: [],
      variables: () => new Map(),
    };
  }

  const bodyNode = functionInfo.node.childForFieldName('body');
  if (!bodyNode) {
    return {
      functionName: functionName,
      varRefs: [],
      dataflowEdges: [],
      variables: () => new Map(),
    };
  }

  const visitor = new DefUseVisitor();
  visitor.visit(functionInfo.node);
  const varRefs = visitor.getVarRefs();

  const analyzer = new ReachingDefsAnalyzer(varRefs);
  const dataflowEdges = analyzer.analyze();

  return {
    functionName: functionName,
    varRefs,
    dataflowEdges,
    variables: () => {
      const map = new Map<string, VarRef[]>();
      for (const ref of varRefs) {
        const existing = map.get(ref.name) ?? [];
        existing.push(ref);
        map.set(ref.name, existing);
      }
      return map;
    },
  };
}
