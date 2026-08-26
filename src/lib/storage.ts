import { sampleWorkspace } from '../data/sample'
import type {
  AccessRequest,
  Condition,
  ConditionOperator,
  DecisionValue,
  Effect,
  Rule,
  Scenario,
  Workspace,
} from '../types'

export const STORAGE_KEY = 'access-verdict:workspace:v1'

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, maximum = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${label} must be a non-empty string up to ${maximum} characters`)
  }
  return value.trim()
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error(`${label} must be an array`)
  return value.map((entry, index) => text(entry, `${label}[${index}]`))
}

function oneOf<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) {
    throw new Error(`${label} is invalid`)
  }
  return value as T
}

function normalizeContext(value: unknown): Record<string, string> {
  const source = record(value, 'request.context')
  const entries = Object.entries(source)
  if (entries.length > 30) throw new Error('request.context has too many entries')
  return Object.fromEntries(
    entries.map(([key, entry]) => [text(key, 'context key', 80), text(entry, 'context value')]),
  )
}

function normalizeRequest(value: unknown): AccessRequest {
  const source = record(value, 'request')
  return {
    principal: text(source.principal, 'request.principal'),
    groups: stringList(source.groups, 'request.groups'),
    action: text(source.action, 'request.action'),
    resource: text(source.resource, 'request.resource'),
    context: normalizeContext(source.context),
  }
}

function normalizeCondition(value: unknown, index: number): Condition {
  const source = record(value, `condition ${index}`)
  return {
    key: text(source.key, 'condition.key', 80),
    operator: oneOf<ConditionOperator>(
      source.operator,
      ['equals', 'not_equals', 'in', 'exists'],
      'condition.operator',
    ),
    value: source.operator === 'exists' ? '' : text(source.value, 'condition.value'),
  }
}

function normalizeRule(value: unknown, index: number): Rule {
  const source = record(value, `rule ${index}`)
  if (!Array.isArray(source.conditions) || source.conditions.length > 20) {
    throw new Error(`rule ${index}.conditions must be an array`)
  }
  if (typeof source.enabled !== 'boolean') throw new Error(`rule ${index}.enabled must be boolean`)
  return {
    id: text(source.id, `rule ${index}.id`, 100),
    name: text(source.name, `rule ${index}.name`),
    description: text(source.description, `rule ${index}.description`, 500),
    effect: oneOf<Effect>(source.effect, ['allow', 'deny'], `rule ${index}.effect`),
    enabled: source.enabled,
    principals: stringList(source.principals, `rule ${index}.principals`),
    actions: stringList(source.actions, `rule ${index}.actions`),
    resources: stringList(source.resources, `rule ${index}.resources`),
    conditions: source.conditions.map(normalizeCondition),
  }
}

function normalizeScenario(value: unknown, index: number): Scenario {
  const source = record(value, `scenario ${index}`)
  return {
    id: text(source.id, `scenario ${index}.id`, 100),
    name: text(source.name, `scenario ${index}.name`),
    expected: oneOf<DecisionValue>(
      source.expected,
      ['allow', 'deny'],
      `scenario ${index}.expected`,
    ),
    request: normalizeRequest(source.request),
  }
}

export function normalizeWorkspace(value: unknown): Workspace {
  const source = record(value, 'workspace')
  if (source.schemaVersion !== 1) throw new Error('unsupported workspace schema version')
  const policy = record(source.policy, 'policy')
  if (!Array.isArray(policy.rules) || policy.rules.length < 1 || policy.rules.length > 100) {
    throw new Error('policy.rules must contain between 1 and 100 entries')
  }
  if (!Array.isArray(source.scenarios) || source.scenarios.length > 100) {
    throw new Error('scenarios must contain at most 100 entries')
  }
  const rules = policy.rules.map(normalizeRule)
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) {
    throw new Error('rule ids must be unique')
  }
  return {
    schemaVersion: 1,
    policy: {
      name: text(policy.name, 'policy.name'),
      defaultDecision: oneOf(policy.defaultDecision, ['deny'] as const, 'policy.defaultDecision'),
      rules,
    },
    request: normalizeRequest(source.request),
    scenarios: source.scenarios.map(normalizeScenario),
  }
}

export function cloneSample(): Workspace {
  return JSON.parse(JSON.stringify(sampleWorkspace)) as Workspace
}

export function loadWorkspace(): Workspace {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? normalizeWorkspace(JSON.parse(stored)) : cloneSample()
  } catch {
    return cloneSample()
  }
}

export function saveWorkspace(workspace: Workspace): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
    return true
  } catch {
    return false
  }
}

export function parseWorkspace(contents: string): Workspace {
  return normalizeWorkspace(JSON.parse(contents))
}

export function serializeWorkspace(workspace: Workspace): string {
  return `${JSON.stringify(workspace, null, 2)}\n`
}
