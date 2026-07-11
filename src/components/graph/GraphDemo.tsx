import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphScenarios } from "../../data/graphScenarios";
import {
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  type GraphNode,
  type NodeType,
  type RelationshipType,
} from "../../types/graph";
import { ForceGraph, type ForceGraphHandle } from "./ForceGraph";
import { GraphControls } from "./GraphControls";
import { GraphInspector } from "./GraphInspector";
import { GraphSidebar } from "./GraphSidebar";

function countByType<T extends string>(values: readonly T[]) {
  return values.reduce<Partial<Record<T, number>>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function GraphDemo() {
  const graphRef = useRef<ForceGraphHandle>(null);
  const [scenarioId, setScenarioId] = useState(graphScenarios[0]?.id ?? "");
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<NodeType>>(
    () => new Set(NODE_TYPES),
  );
  const [enabledRelationshipTypes, setEnabledRelationshipTypes] = useState<
    Set<RelationshipType>
  >(() => new Set(RELATIONSHIP_TYPES));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [comparisonActive, setComparisonActive] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [isCompact, setIsCompact] = useState(false);

  const scenario =
    graphScenarios.find((item) => item.id === scenarioId) ?? graphScenarios[0];

  useEffect(() => {
    const media = window.matchMedia("(max-width: 999px)");
    const sync = (matches: boolean) => {
      setIsCompact(matches);
      setSidebarOpen(!matches);
      setInspectorOpen(!matches);
    };

    sync(media.matches);
    const onChange = (event: MediaQueryListEvent) => sync(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const nodeTypeCounts = useMemo(
    () => countByType(scenario.nodes.map((node) => node.type)),
    [scenario],
  );
  const relationshipTypeCounts = useMemo(
    () => countByType(scenario.edges.map((edge) => edge.type)),
    [scenario],
  );

  const visibleNodes = useMemo(
    () => scenario.nodes.filter((node) => enabledNodeTypes.has(node.type)),
    [enabledNodeTypes, scenario],
  );
  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );
  const visibleEdges = useMemo(
    () =>
      scenario.edges.filter(
        (edge) =>
          enabledRelationshipTypes.has(edge.type) &&
          visibleNodeIds.has(edge.source) &&
          visibleNodeIds.has(edge.target),
      ),
    [enabledRelationshipTypes, scenario, visibleNodeIds],
  );

  const selectedNode = useMemo(
    () => scenario.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [scenario, selectedNodeId],
  );
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return scenario.nodes
      .filter((node) => node.label.toLocaleLowerCase().includes(query))
      .slice(0, 7);
  }, [scenario, searchQuery]);
  const uncoveredNodeIds = useMemo(
    () =>
      scenario.nodes
        .filter((node) => node.status === "uncovered")
        .map((node) => node.id),
    [scenario],
  );

  const handleScenarioChange = useCallback((nextScenarioId: string) => {
    setScenarioId(nextScenarioId);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setSearchQuery("");
    setComparisonActive(false);
    setEnabledNodeTypes(new Set(NODE_TYPES));
    setEnabledRelationshipTypes(new Set(RELATIONSHIP_TYPES));
    requestAnimationFrame(() => graphRef.current?.fitView());
  }, []);

  const handleNodeTypeToggle = useCallback(
    (type: NodeType, enabled: boolean) => {
      setEnabledNodeTypes((current) => {
        const next = new Set(current);
        enabled ? next.add(type) : next.delete(type);
        return next;
      });
      if (!enabled && selectedNode?.type === type) setSelectedNodeId(null);
      if (!enabled && type === "candidate-product") setComparisonActive(false);
    },
    [selectedNode],
  );

  const handleRelationshipTypeToggle = useCallback(
    (type: RelationshipType, enabled: boolean) => {
      setEnabledRelationshipTypes((current) => {
        const next = new Set(current);
        enabled ? next.add(type) : next.delete(type);
        return next;
      });
    },
    [],
  );

  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNodeId(node?.id ?? null);
    if (node && window.matchMedia("(max-width: 999px)").matches) {
      setInspectorOpen(true);
      setSidebarOpen(false);
    }
  }, []);

  const handleInspectorSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    graphRef.current?.centerNode(nodeId);
  }, []);

  const handleSearchSelect = useCallback(
    (nodeId: string) => {
      const node = scenario.nodes.find((item) => item.id === nodeId);
      if (!node) return;
      setEnabledNodeTypes((current) => new Set(current).add(node.type));
      setSelectedNodeId(nodeId);
      setSearchQuery("");
      if (isCompact) {
        setSidebarOpen(false);
        setInspectorOpen(true);
      }
      requestAnimationFrame(() => graphRef.current?.centerNode(nodeId));
    },
    [isCompact, scenario],
  );

  const handleComparisonChange = useCallback(
    (active: boolean) => {
      setComparisonActive(active);
      if (active) {
        setEnabledNodeTypes(new Set(NODE_TYPES));
        setEnabledRelationshipTypes(new Set(RELATIONSHIP_TYPES));
        setSelectedNodeId(scenario.candidateId);
        requestAnimationFrame(() => graphRef.current?.centerNode(scenario.candidateId));
      }
    },
    [scenario],
  );

  const resetLayout = useCallback(() => {
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setComparisonActive(false);
    graphRef.current?.resetLayout();
  }, []);

  return (
    <div className="fg-app">
      <a className="fg-skip-link" href="#graph-canvas">
        Skip to graph canvas
      </a>

      <header className="fg-topbar">
        <div className="fg-topbar__identity">
          <span className="fg-topbar__mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <div>
            <p className="fg-topbar__name">FunctionGraph</p>
            <p className="fg-topbar__context">Capability comparison workspace</p>
          </div>
        </div>
        <div className="fg-topbar__scenario" aria-live="polite">
          <span className="fg-topbar__live-dot" aria-hidden="true" />
          <span>{scenario.name}</span>
        </div>
        <div className="fg-topbar__actions">
          <button
            className="fg-topbar__button fg-topbar__button--quiet"
            type="button"
            onClick={resetLayout}
            data-testid="header-reset-layout"
          >
            <span aria-hidden="true">↻</span> Reset
          </button>
          <button
            className="fg-topbar__button"
            type="button"
            onClick={() => graphRef.current?.fitView()}
          >
            <span aria-hidden="true">⌗</span> Fit view
          </button>
        </div>
      </header>

      <div className="fg-workspace">
        <GraphSidebar
          className={sidebarOpen ? "fg-sidebar--open" : "fg-sidebar--closed"}
          scenarios={graphScenarios}
          selectedScenarioId={scenario.id}
          onScenarioChange={handleScenarioChange}
          searchQuery={searchQuery}
          searchResults={searchResults}
          onSearchQueryChange={setSearchQuery}
          onSearchResultSelect={handleSearchSelect}
          enabledNodeTypes={enabledNodeTypes}
          nodeTypeCounts={nodeTypeCounts}
          onNodeTypeToggle={handleNodeTypeToggle}
          enabledRelationshipTypes={enabledRelationshipTypes}
          relationshipTypeCounts={relationshipTypeCounts}
          onRelationshipTypeToggle={handleRelationshipTypeToggle}
          showEdgeLabels={showEdgeLabels}
          onShowEdgeLabelsChange={setShowEdgeLabels}
          nodeTotal={visibleNodes.length}
          edgeTotal={visibleEdges.length}
          comparisonPathActive={comparisonActive}
          onComparisonPathChange={handleComparisonChange}
          legendCollapsed={legendCollapsed}
          onLegendCollapsedChange={setLegendCollapsed}
          onRequestClose={isCompact ? () => setSidebarOpen(false) : undefined}
        />

        <main className="fg-canvas" id="graph-canvas">
          <div className="fg-canvas__meta">
            <div>
              <p className="fg-canvas__eyebrow">Live capability map</p>
              <h1>{scenario.title}</h1>
            </div>
            <span className="fg-canvas__count">
              {visibleNodes.length} nodes · {visibleEdges.length} links
            </span>
          </div>

          <ForceGraph
            ref={graphRef}
            className="fg-force-graph"
            nodes={visibleNodes}
            edges={visibleEdges}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            showEdgeLabels={showEdgeLabels}
            comparisonActive={comparisonActive}
            comparisonNodeIds={scenario.comparisonPath.nodeIds}
            comparisonEdgeIds={scenario.comparisonPath.edgeIds}
            uncoveredNodeIds={uncoveredNodeIds}
            onSelectNode={handleNodeSelect}
            onHoverNode={(node) => setHoveredNodeId(node?.id ?? null)}
            ariaLabel={`${scenario.title} force-directed capability graph`}
          />

          <section className="fg-metrics" aria-label="Comparison summary">
            <div className="fg-metrics__score">
              <strong>{scenario.metrics.overlapScore}%</strong>
              <span>functional overlap</span>
            </div>
            <div className="fg-metrics__copy">
              <span className="fg-metrics__classification">
                {scenario.metrics.classification}
              </span>
              <ul>
                <li>
                  <span className="fg-metrics__dot fg-metrics__dot--covered" />
                  {scenario.metrics.coveredCapabilities} capabilities covered
                </li>
                <li>
                  <span className="fg-metrics__dot fg-metrics__dot--partial" />
                  {scenario.metrics.partiallyCoveredCapabilities} partially covered
                </li>
                <li>
                  <span className="fg-metrics__dot fg-metrics__dot--missing" />
                  {scenario.metrics.missingCapabilities} critical capabilities missing
                </li>
              </ul>
            </div>
          </section>

          <GraphControls
            className="fg-controls--floating"
            onFitView={() => graphRef.current?.fitView()}
            onResetLayout={resetLayout}
            onZoomIn={() => graphRef.current?.zoomIn()}
            onZoomOut={() => graphRef.current?.zoomOut()}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            onToggleInspector={() => setInspectorOpen((open) => !open)}
            isSidebarOpen={sidebarOpen}
            isInspectorOpen={inspectorOpen}
          />

          <p className="fg-canvas__hint">
            <span aria-hidden="true">⌁</span> Drag to arrange · Scroll to zoom · Click
            empty space to clear
          </p>
        </main>

        <GraphInspector
          className={inspectorOpen ? "fg-inspector--open" : "fg-inspector--closed"}
          selectedNode={selectedNode}
          nodes={scenario.nodes}
          edges={scenario.edges}
          onSelectNode={handleInspectorSelect}
          onClearSelection={() => setSelectedNodeId(null)}
          onRequestClose={isCompact ? () => setInspectorOpen(false) : undefined}
        />

        {isCompact && (sidebarOpen || inspectorOpen) ? (
          <button
            className="fg-panel-scrim"
            type="button"
            aria-label="Close open panel"
            onClick={() => {
              setSidebarOpen(false);
              setInspectorOpen(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
