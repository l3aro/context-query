import { extractDFG } from '../graph/dfg';

export function runDfg(filePath: string, functionName: string): void {
  const dfg = extractDFG(filePath, functionName);

  const result = {
    function: dfg.functionName,
    variables: Array.from(dfg.variables().keys()),
    refs: dfg.varRefs.map((ref) => ({
      name: ref.name,
      type: ref.type,
      line: ref.line,
      column: ref.column,
    })),
    edges: dfg.dataflowEdges.map((edge) => ({
      var: edge.varName,
      defLine: edge.def.line,
      useLine: edge.use.line,
    })),
  };

  console.log(JSON.stringify(result, null, 2));
}
