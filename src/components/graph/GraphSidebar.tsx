import { useId } from "react";
import type {
  GraphNode,
  GraphScenario,
  NodeType,
  RelationshipType,
} from "../../types/graph";
import {
  GraphLegend,
  NODE_TYPE_ORDER,
  NODE_TYPE_PRESENTATION,
  RELATIONSHIP_TYPE_ORDER,
  RELATIONSHIP_TYPE_PRESENTATION,
} from "./GraphLegend";

export interface GraphSidebarProps {
  scenarios: readonly GraphScenario[];
  selectedScenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  searchQuery: string;
  searchResults: readonly GraphNode[];
  onSearchQueryChange: (query: string) => void;
  onSearchResultSelect: (nodeId: string) => void;
  enabledNodeTypes: ReadonlySet<NodeType>;
  nodeTypeCounts: Readonly<Partial<Record<NodeType, number>>>;
  onNodeTypeToggle: (type: NodeType, enabled: boolean) => void;
  enabledRelationshipTypes: ReadonlySet<RelationshipType>;
  relationshipTypeCounts: Readonly<Partial<Record<RelationshipType, number>>>;
  onRelationshipTypeToggle: (type: RelationshipType, enabled: boolean) => void;
  showEdgeLabels: boolean;
  onShowEdgeLabelsChange: (show: boolean) => void;
  nodeTotal: number;
  edgeTotal: number;
  comparisonPathActive: boolean;
  onComparisonPathChange: (active: boolean) => void;
  legendCollapsed?: boolean;
  onLegendCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  onRequestClose?: () => void;
}

export function GraphSidebar({
  scenarios,
  selectedScenarioId,
  onScenarioChange,
  searchQuery,
  searchResults,
  onSearchQueryChange,
  onSearchResultSelect,
  enabledNodeTypes,
  nodeTypeCounts,
  onNodeTypeToggle,
  enabledRelationshipTypes,
  relationshipTypeCounts,
  onRelationshipTypeToggle,
  showEdgeLabels,
  onShowEdgeLabelsChange,
  nodeTotal,
  edgeTotal,
  comparisonPathActive,
  onComparisonPathChange,
  legendCollapsed,
  onLegendCollapsedChange,
  className,
  onRequestClose,
}: GraphSidebarProps) {
  const id = useId();
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId);
  const normalizedQuery = searchQuery.trim();

  return (
    <aside
      className={["fg-sidebar", className].filter(Boolean).join(" ")}
      aria-label="Graph filters and scenarios"
    >
      <div className="fg-sidebar__scroll-region">
        <header className="fg-sidebar__brand">
          <div className="fg-sidebar__brand-row">
            <div>
              <p className="fg-sidebar__eyebrow">Capability intelligence</p>
              <h1 className="fg-sidebar__title">FunctionGraph</h1>
            </div>
            {onRequestClose ? (
              <button
                className="fg-sidebar__close"
                type="button"
                aria-label="Close filters"
                title="Close filters"
                onClick={onRequestClose}
              >
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>
          <p className="fg-sidebar__intro">
            Explore how products, capabilities, outcomes, accessories, and constraints
            connect before deciding what to buy.
          </p>
        </header>

        <section className="fg-sidebar__section" aria-labelledby={`${id}-scenario-heading`}>
          <div className="fg-sidebar__section-heading">
            <h2 id={`${id}-scenario-heading`}>Comparison scenario</h2>
            <span className="fg-sidebar__section-step">01</span>
          </div>
          <label className="fg-field-label" htmlFor={`${id}-scenario-select`}>
            Choose a product comparison
          </label>
          <div className="fg-select-wrap">
            <select
              id={`${id}-scenario-select`}
              className="fg-select"
              value={selectedScenarioId}
              onChange={(event) => onScenarioChange(event.currentTarget.value)}
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.title || scenario.name}
                </option>
              ))}
            </select>
            <span className="fg-select-wrap__icon" aria-hidden="true">
              ▾
            </span>
          </div>
          {selectedScenario ? (
            <p className="fg-sidebar__scenario-description">
              {selectedScenario.shortDescription}
            </p>
          ) : null}
        </section>

        <section className="fg-sidebar__section" aria-labelledby={`${id}-search-heading`}>
          <div className="fg-sidebar__section-heading">
            <h2 id={`${id}-search-heading`}>Find a node</h2>
            <span className="fg-sidebar__section-step">02</span>
          </div>
          <label className="fg-field-label" htmlFor={`${id}-node-search`}>
            Search by name
          </label>
          <div className="fg-search">
            <span className="fg-search__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              id={`${id}-node-search`}
              className="fg-search__input"
              type="search"
              value={searchQuery}
              placeholder="e.g. convection cooking"
              autoComplete="off"
              aria-controls={`${id}-search-results`}
              aria-expanded={normalizedQuery.length > 0}
              onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
            />
          </div>
          {normalizedQuery ? (
            <div className="fg-search-results" id={`${id}-search-results`}>
              {searchResults.length > 0 ? (
                <ul className="fg-search-results__list" aria-label="Search results">
                  {searchResults.map((node) => (
                    <li key={node.id}>
                      <button
                        className="fg-search-results__button"
                        type="button"
                        onClick={() => onSearchResultSelect(node.id)}
                      >
                        <span
                          className={`fg-search-results__marker fg-search-results__marker--${node.type}`}
                          aria-hidden="true"
                        >
                          {NODE_TYPE_PRESENTATION[node.type].symbol}
                        </span>
                        <span className="fg-search-results__copy">
                          <span className="fg-search-results__name">{node.label}</span>
                          <span className="fg-search-results__type">
                            {NODE_TYPE_PRESENTATION[node.type].label}
                          </span>
                        </span>
                        <span className="fg-search-results__action" aria-hidden="true">
                          Locate
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fg-search-results__empty" role="status">
                  No nodes match “{normalizedQuery}”.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section className="fg-sidebar__section" aria-labelledby={`${id}-filter-heading`}>
          <div className="fg-sidebar__section-heading">
            <h2 id={`${id}-filter-heading`}>Filter the graph</h2>
            <span className="fg-sidebar__section-step">03</span>
          </div>

          <fieldset className="fg-filter-group">
            <legend className="fg-filter-group__legend">Node types</legend>
            <div className="fg-filter-group__options">
              {NODE_TYPE_ORDER.map((type) => {
                const presentation = NODE_TYPE_PRESENTATION[type];
                const checked = enabledNodeTypes.has(type);
                return (
                  <label className="fg-filter-option" key={type}>
                    <input
                      className="fg-filter-option__input"
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        onNodeTypeToggle(type, event.currentTarget.checked)
                      }
                    />
                    <span
                      className={`fg-filter-option__marker fg-filter-option__marker--${type}`}
                      aria-hidden="true"
                    >
                      {presentation.symbol}
                    </span>
                    <span className="fg-filter-option__label">{presentation.label}</span>
                    <span className="fg-filter-option__count">
                      {nodeTypeCounts[type] ?? 0}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="fg-filter-group">
            <legend className="fg-filter-group__legend">Relationships</legend>
            <div className="fg-filter-group__options">
              {RELATIONSHIP_TYPE_ORDER.map((type) => {
                const presentation = RELATIONSHIP_TYPE_PRESENTATION[type];
                const checked = enabledRelationshipTypes.has(type);
                return (
                  <label className="fg-filter-option" key={type}>
                    <input
                      className="fg-filter-option__input"
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        onRelationshipTypeToggle(type, event.currentTarget.checked)
                      }
                    />
                    <span
                      className={`fg-filter-option__edge fg-filter-option__edge--${type}`}
                      aria-hidden="true"
                    >
                      {presentation.symbol}
                    </span>
                    <span className="fg-filter-option__label">{presentation.label}</span>
                    <span className="fg-filter-option__count">
                      {relationshipTypeCounts[type] ?? 0}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="fg-switch-row">
            <span className="fg-switch-row__copy">
              <span className="fg-switch-row__label">Edge labels</span>
              <span className="fg-switch-row__description">
                Show relationship names on the canvas
              </span>
            </span>
            <span className="fg-switch">
              <input
                className="fg-switch__input"
                type="checkbox"
                checked={showEdgeLabels}
                onChange={(event) => onShowEdgeLabelsChange(event.currentTarget.checked)}
              />
              <span className="fg-switch__track" aria-hidden="true">
                <span className="fg-switch__thumb" />
              </span>
            </span>
          </label>
        </section>

        <section className="fg-sidebar__section fg-sidebar__section--guide" aria-labelledby={`${id}-guide-heading`}>
          <div className="fg-sidebar__section-heading">
            <h2 id={`${id}-guide-heading`}>Guided comparison</h2>
            <span className="fg-sidebar__section-step">04</span>
          </div>
          <p className="fg-sidebar__guide-copy">
            Trace the candidate through its capabilities to owned products that already
            provide them.
          </p>
          <button
            className="fg-comparison-button"
            type="button"
            aria-pressed={comparisonPathActive}
            onClick={() => onComparisonPathChange(!comparisonPathActive)}
          >
            <span className="fg-comparison-button__icon" aria-hidden="true">
              ↝
            </span>
            <span>Show comparison path</span>
            <span className="fg-comparison-button__state">
              {comparisonPathActive ? "On" : "Off"}
            </span>
          </button>
        </section>

        <GraphLegend
          collapsed={legendCollapsed}
          onCollapsedChange={onLegendCollapsedChange}
        />
      </div>

      <footer className="fg-sidebar__footer" aria-label="Visible graph totals">
        <div className="fg-sidebar__total">
          <span className="fg-sidebar__total-value">{nodeTotal}</span>
          <span className="fg-sidebar__total-label">nodes</span>
        </div>
        <span className="fg-sidebar__total-divider" aria-hidden="true" />
        <div className="fg-sidebar__total">
          <span className="fg-sidebar__total-value">{edgeTotal}</span>
          <span className="fg-sidebar__total-label">relationships</span>
        </div>
      </footer>
    </aside>
  );
}
