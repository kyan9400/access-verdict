import type {
  AccessRequest,
  CheckResult,
  Condition,
  EvaluationResult,
  EvaluationStep,
  Policy,
  Rule,
  Scenario,
  ScenarioResult,
} from '../types'

function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === '*') return true
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
  return new RegExp(`^${escaped}$`, 'i').test(value)
}

function conditionMatches(condition: Condition, context: Record<string, string>): boolean {
  const actual = context[condition.key]
  if (condition.operator === 'exists') return actual !== undefined
  if (actual === undefined) return false
  if (condition.operator === 'equals') return actual === condition.value
  if (condition.operator === 'not_equals') return actual !== condition.value
  const candidates = new Set(condition.value.split(',').map((value) => value.trim()))
  return candidates.has(actual)
}

function checkRule(rule: Rule, request: AccessRequest): EvaluationStep {
  if (!rule.enabled) {
    const checks: CheckResult[] = [
      { key: 'principal', matched: false, detail: 'Rule is disabled' },
      { key: 'action', matched: false, detail: 'Not evaluated' },
      { key: 'resource', matched: false, detail: 'Not evaluated' },
      { key: 'conditions', matched: false, detail: 'Not evaluated' },
    ]
    return { ruleId: rule.id, ruleName: rule.name, effect: rule.effect, matched: false, checks }
  }

  const identities = new Set([
    '*',
    request.principal,
    `user:${request.principal}`,
    ...request.groups.flatMap((group) => [group, `group:${group}`]),
  ])
  const principal = rule.principals.some((pattern) =>
    [...identities].some((identity) => matchesPattern(pattern, identity)),
  )
  const action = rule.actions.some((pattern) => matchesPattern(pattern, request.action))
  const resource = rule.resources.some((pattern) => matchesPattern(pattern, request.resource))
  const conditions = rule.conditions.every((condition) => conditionMatches(condition, request.context))
  const checks: CheckResult[] = [
    {
      key: 'principal',
      matched: principal,
      detail: principal ? 'Principal or group matched' : 'No principal pattern matched',
    },
    {
      key: 'action',
      matched: action,
      detail: action ? `Action matched ${request.action}` : `Action ${request.action} did not match`,
    },
    {
      key: 'resource',
      matched: resource,
      detail: resource ? `Resource matched ${request.resource}` : 'No resource pattern matched',
    },
    {
      key: 'conditions',
      matched: conditions,
      detail: conditions
        ? `${rule.conditions.length} context condition${rule.conditions.length === 1 ? '' : 's'} passed`
        : 'A context condition failed',
    },
  ]
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    effect: rule.effect,
    matched: principal && action && resource && conditions,
    checks,
  }
}

export function evaluate(policy: Policy, request: AccessRequest): EvaluationResult {
  const trace = policy.rules.map((rule) => checkRule(rule, request))
  const matching = trace.filter((step) => step.matched)
  const decisive = matching.find((step) => step.effect === 'deny') ?? matching[0]
  return {
    decision: decisive?.effect ?? policy.defaultDecision,
    decisiveRuleId: decisive?.ruleId ?? null,
    defaulted: !decisive,
    matchedRuleIds: matching.map((step) => step.ruleId),
    trace,
  }
}

export function runScenarios(policy: Policy, scenarios: Scenario[]): ScenarioResult[] {
  return scenarios.map((scenario) => {
    const result = evaluate(policy, scenario.request)
    return {
      ...scenario,
      actual: result.decision,
      passed: result.decision === scenario.expected,
      decisiveRuleId: result.decisiveRuleId,
    }
  })
}

export function createRule(index: number): Rule {
  return {
    id: `rule-${Date.now()}-${index}`,
    name: 'Untitled rule',
    description: 'Describe the authorization intent.',
    effect: 'allow',
    enabled: true,
    principals: ['user:maya'],
    actions: ['document:read'],
    resources: ['docs/*'],
    conditions: [],
  }
}
