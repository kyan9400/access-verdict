import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { sampleWorkspace } from './data/sample'
import { createRule, evaluate, runScenarios } from './lib/evaluate'
import {
  cloneSample,
  loadWorkspace,
  parseWorkspace,
  saveWorkspace,
  serializeWorkspace,
} from './lib/storage'
import type { AccessRequest, Condition, Rule, Workspace } from './types'

const CONTEXT_KEYS = ['environment', 'region', 'legalHold', 'incidentActive'] as const

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function downloadWorkspace(workspace: Workspace): void {
  const url = URL.createObjectURL(
    new Blob([serializeWorkspace(workspace)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'access-verdict-policy.json'
  link.click()
  URL.revokeObjectURL(url)
}

interface RequestEditorProps {
  request: AccessRequest
  onChange: (request: AccessRequest) => void
}

function RequestEditor({ request, onChange }: RequestEditorProps) {
  const updateContext = (key: string, value: string) => {
    const context = { ...request.context }
    if (value.trim()) context[key] = value
    else delete context[key]
    onChange({ ...request, context })
  }

  return (
    <section className="request-console" aria-labelledby="request-title">
      <header className="module-header dark">
        <span className="module-number">02</span>
        <div>
          <p>Evaluation input</p>
          <h2 id="request-title">Access request</h2>
        </div>
      </header>
      <div className="request-fields">
        <label>
          Principal
          <input
            value={request.principal}
            onChange={(event) => onChange({ ...request, principal: event.target.value })}
          />
        </label>
        <label>
          Groups <span>comma separated</span>
          <input
            value={request.groups.join(', ')}
            onChange={(event) => onChange({ ...request, groups: splitList(event.target.value) })}
          />
        </label>
        <label>
          Action
          <input
            value={request.action}
            onChange={(event) => onChange({ ...request, action: event.target.value })}
          />
        </label>
        <label>
          Resource
          <input
            value={request.resource}
            onChange={(event) => onChange({ ...request, resource: event.target.value })}
          />
        </label>
      </div>
      <fieldset className="context-grid">
        <legend>Request context</legend>
        {CONTEXT_KEYS.map((key) => (
          <label key={key}>
            {key}
            <input
              value={request.context[key] ?? ''}
              placeholder="unset"
              onChange={(event) => updateContext(key, event.target.value)}
            />
          </label>
        ))}
      </fieldset>
    </section>
  )
}

interface RuleEditorProps {
  rule: Rule
  onChange: (rule: Rule) => void
}

function RuleEditor({ rule, onChange }: RuleEditorProps) {
  const updateCondition = (index: number, condition: Condition) => {
    const conditions = rule.conditions.map((entry, entryIndex) =>
      entryIndex === index ? condition : entry,
    )
    onChange({ ...rule, conditions })
  }

  return (
    <div className="rule-editor">
      <div className="editor-row split">
        <label>
          Rule name
          <input value={rule.name} onChange={(event) => onChange({ ...rule, name: event.target.value })} />
        </label>
        <label>
          Effect
          <select
            value={rule.effect}
            onChange={(event) => onChange({ ...rule, effect: event.target.value as Rule['effect'] })}
          >
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
        </label>
      </div>
      <label>
        Intent
        <textarea
          rows={2}
          value={rule.description}
          onChange={(event) => onChange({ ...rule, description: event.target.value })}
        />
      </label>
      <label>
        Principals <span>user:name, group:name, or *</span>
        <input
          value={rule.principals.join(', ')}
          onChange={(event) => onChange({ ...rule, principals: splitList(event.target.value) })}
        />
      </label>
      <label>
        Actions <span>wildcards supported</span>
        <input
          value={rule.actions.join(', ')}
          onChange={(event) => onChange({ ...rule, actions: splitList(event.target.value) })}
        />
      </label>
      <label>
        Resources <span>wildcards supported</span>
        <input
          value={rule.resources.join(', ')}
          onChange={(event) => onChange({ ...rule, resources: splitList(event.target.value) })}
        />
      </label>
      <div className="conditions-head">
        <strong>Context conditions</strong>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...rule,
              conditions: [
                ...rule.conditions,
                { key: 'environment', operator: 'equals', value: 'prod' },
              ],
            })
          }
        >
          + Add condition
        </button>
      </div>
      {rule.conditions.length ? (
        <div className="condition-list">
          {rule.conditions.map((condition, index) => (
            <div className="condition-row" key={`${rule.id}-${index}`}>
              <input
                aria-label={`Condition ${index + 1} key`}
                value={condition.key}
                onChange={(event) =>
                  updateCondition(index, { ...condition, key: event.target.value })
                }
              />
              <select
                aria-label={`Condition ${index + 1} operator`}
                value={condition.operator}
                onChange={(event) =>
                  updateCondition(index, {
                    ...condition,
                    operator: event.target.value as Condition['operator'],
                  })
                }
              >
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="in">is one of</option>
                <option value="exists">exists</option>
              </select>
              <input
                aria-label={`Condition ${index + 1} value`}
                value={condition.value}
                disabled={condition.operator === 'exists'}
                onChange={(event) =>
                  updateCondition(index, { ...condition, value: event.target.value })
                }
              />
              <button
                className="remove-condition"
                type="button"
                aria-label={`Remove condition ${index + 1}`}
                onClick={() =>
                  onChange({
                    ...rule,
                    conditions: rule.conditions.filter((_, entryIndex) => entryIndex !== index),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-condition">No context constraint. Identity, action, and resource decide.</p>
      )}
    </div>
  )
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(loadWorkspace)
  const [selectedRuleId, setSelectedRuleId] = useState(sampleWorkspace.policy.rules[0].id)
  const [notice, setNotice] = useState('Policy changes are saved on this device.')
  const importInput = useRef<HTMLInputElement>(null)
  const result = useMemo(
    () => evaluate(workspace.policy, workspace.request),
    [workspace.policy, workspace.request],
  )
  const scenarioResults = useMemo(
    () => runScenarios(workspace.policy, workspace.scenarios),
    [workspace.policy, workspace.scenarios],
  )
  const selectedRule =
    workspace.policy.rules.find((rule) => rule.id === selectedRuleId) ?? workspace.policy.rules[0]!
  const passingScenarios = scenarioResults.filter((scenario) => scenario.passed).length

  const commit = (next: Workspace, message = 'Saved locally.') => {
    setWorkspace(next)
    setNotice(saveWorkspace(next) ? message : 'Storage is unavailable; export to keep these changes.')
  }

  const updateRule = (nextRule: Rule) => {
    commit({
      ...workspace,
      policy: {
        ...workspace.policy,
        rules: workspace.policy.rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule)),
      },
    })
  }

  const addRule = () => {
    const rule = createRule(workspace.policy.rules.length)
    setSelectedRuleId(rule.id)
    commit(
      {
        ...workspace,
        policy: { ...workspace.policy, rules: [...workspace.policy.rules, rule] },
      },
      'New rule added.',
    )
  }

  const importPolicy = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = parseWorkspace(await file.text())
      setSelectedRuleId(imported.policy.rules[0]?.id ?? '')
      commit(imported, `Imported ${file.name}.`)
    } catch (error) {
      setNotice(error instanceof Error ? `Import rejected: ${error.message}` : 'Import rejected.')
    }
  }

  const reset = () => {
    if (!window.confirm('Replace local changes with the example policy?')) return
    const next = cloneSample()
    setSelectedRuleId(next.policy.rules[0].id)
    commit(next, 'Example policy restored.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Access Verdict home">
          <span className="wordmark-mark">AV</span>
          <span>Access<br />Verdict</span>
        </a>
        <div className="topbar-center">
          <span>Policy</span>
          <strong>{workspace.policy.name}</strong>
        </div>
        <nav aria-label="Workspace actions">
          <button type="button" onClick={() => importInput.current?.click()}>Import</button>
          <button type="button" onClick={() => downloadWorkspace(workspace)}>Export</button>
          <button type="button" onClick={reset}>Reset</button>
          <a href="https://github.com/kyan9400/access-verdict" target="_blank" rel="noreferrer">Source ↗</a>
        </nav>
        <input ref={importInput} className="visually-hidden" type="file" accept="application/json" onChange={importPolicy} />
      </header>

      <main id="top">
        <section className={`verdict-hero ${result.decision}`} aria-live="polite">
          <div className="verdict-copy">
            <p className="kicker">Authorization decision / live evaluation</p>
            <h1>Know exactly<br /><em>why access wins.</em></h1>
            <p>Test deny-first authorization rules against real requests, inspect every failed check, and keep expected decisions executable.</p>
          </div>
          <div className="request-ticket" aria-label="Current access request">
            <span className="ticket-label">Request 00–{String(workspace.policy.rules.length).padStart(2, '0')}</span>
            <dl>
              <div><dt>Who</dt><dd>{workspace.request.principal}</dd></div>
              <div><dt>Action</dt><dd>{workspace.request.action}</dd></div>
              <div><dt>Resource</dt><dd>{workspace.request.resource}</dd></div>
            </dl>
            <div className="ticket-stripes" aria-hidden="true" />
          </div>
          <div className="verdict-stamp">
            <span>Decision</span>
            <strong>{result.decision}</strong>
            <p>{result.defaulted ? 'No rule matched · default deny' : `${result.matchedRuleIds.length} matching rule${result.matchedRuleIds.length === 1 ? '' : 's'}`}</p>
          </div>
        </section>

        <section className="workbench">
          <aside className="rule-ledger" aria-labelledby="rules-title">
            <header className="module-header">
              <span className="module-number">01</span>
              <div><p>Policy ledger</p><h2 id="rules-title">Rules</h2></div>
              <button className="add-rule" type="button" onClick={addRule}>+ New</button>
            </header>
            <div className="rule-list">
              {workspace.policy.rules.map((rule, index) => {
                const step = result.trace[index]
                return (
                  <div className={`rule-row ${selectedRule.id === rule.id ? 'selected' : ''}`} key={rule.id}>
                    <button className="rule-select" type="button" onClick={() => setSelectedRuleId(rule.id)}>
                      <span className="rule-index">{String(index + 1).padStart(2, '0')}</span>
                      <span><strong>{rule.name}</strong><small>{rule.effect} · {step.matched ? 'matched' : 'skipped'}</small></span>
                    </button>
                    <button
                      className={`rule-toggle ${rule.enabled ? 'on' : ''}`}
                      type="button"
                      aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
                      aria-pressed={rule.enabled}
                      onClick={() => updateRule({ ...rule, enabled: !rule.enabled })}
                    ><span /></button>
                  </div>
                )
              })}
            </div>
          </aside>

          <RequestEditor
            request={workspace.request}
            onChange={(request) => commit({ ...workspace, request })}
          />

          <section className="trace-panel" aria-labelledby="trace-title">
            <header className="module-header">
              <span className="module-number">03</span>
              <div><p>Decision evidence</p><h2 id="trace-title">Evaluation trace</h2></div>
              <span className={`decision-chip ${result.decision}`}>{result.decision}</span>
            </header>
            <div className="trace-list">
              {result.trace.map((step, index) => (
                <article className={`trace-step ${step.matched ? 'matched' : ''}`} key={step.ruleId}>
                  <header><span>{String(index + 1).padStart(2, '0')}</span><strong>{step.ruleName}</strong><b>{step.effect}</b></header>
                  <div className="check-grid">
                    {step.checks.map((check) => (
                      <div className={check.matched ? 'pass' : 'fail'} key={check.key} title={check.detail}>
                        <span>{check.matched ? '✓' : '×'}</span>{check.key}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="rule-detail">
          <header className="detail-heading">
            <div><p className="kicker">Selected policy clause</p><h2>{selectedRule.name}</h2></div>
            <span className={`effect-block ${selectedRule.effect}`}>{selectedRule.effect}</span>
          </header>
          <RuleEditor rule={selectedRule} onChange={updateRule} />
        </section>

        <section className="scenario-section" aria-labelledby="scenario-title">
          <header className="scenario-heading">
            <div><p className="kicker">Executable expectations</p><h2 id="scenario-title">Decision matrix</h2></div>
            <div className="scenario-score"><strong>{passingScenarios}/{scenarioResults.length}</strong><span>scenarios passing</span></div>
          </header>
          <div className="scenario-table" aria-label="Authorization scenarios">
            <div className="scenario-row scenario-columns"><span>Scenario</span><span>Principal</span><span>Action</span><span>Expected</span><span>Actual</span></div>
            {scenarioResults.map((scenario, index) => (
              <button
                className="scenario-row"
                type="button"
                key={scenario.id}
                onClick={() => commit({ ...workspace, request: scenario.request }, `Loaded scenario ${index + 1}.`)}
              >
                <span><i>{String(index + 1).padStart(2, '0')}</i><strong>{scenario.name}</strong></span>
                <span>{scenario.request.principal}</span>
                <span>{scenario.request.action}</span>
                <span className={scenario.expected}>{scenario.expected}</span>
                <span className={`${scenario.actual} ${scenario.passed ? 'passed' : 'failed'}`}>{scenario.actual} {scenario.passed ? '✓' : '×'}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer><span>{notice}</span><span>Deny overrides allow · default deny · schema v1</span></footer>
    </div>
  )
}
