function getType(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function typeMatches(value, expectedType) {
  if (!expectedType) return true
  const types = Array.isArray(expectedType) ? expectedType : [expectedType]
  return types.includes(getType(value))
}

function joinPath(path, key) {
  return path ? `${path}.${key}` : String(key)
}

export function validateJsonSchema(value, schema = {}, path = '') {
  const issues = []
  if (!schema || typeof schema !== 'object') {
    return { ok: true, issues }
  }

  if (!typeMatches(value, schema.type)) {
    issues.push({
      path,
      code: 'type-mismatch',
      message: `${path || 'value'} 类型不匹配，期望 ${schema.type}，实际 ${getType(value)}`
    })
    return { ok: false, issues }
  }

  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const field of required) {
      if (value[field] === undefined) {
        issues.push({
          path: joinPath(path, field),
          code: 'required',
          message: `缺少必填字段：${joinPath(path, field)}`
        })
      }
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
    for (const [field, childSchema] of Object.entries(properties)) {
      if (value[field] !== undefined) {
        issues.push(...validateJsonSchema(value[field], childSchema, joinPath(path, field)).issues)
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      issues.push(...validateJsonSchema(item, schema.items, `${path || 'value'}[${index}]`).issues)
    })
  }

  return {
    ok: issues.length === 0,
    issues
  }
}

export default {
  validateJsonSchema
}
