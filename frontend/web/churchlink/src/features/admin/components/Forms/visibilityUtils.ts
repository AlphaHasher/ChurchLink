/**
 * Evaluate a single condition expression
 * @param condition - Single condition like "age >= 18"
 * @param values - Current form values
 * @returns boolean result of the condition
 */
function evaluateSingleCondition(condition: string, values: Record<string, any>): boolean {
    // Parser: "name op literal" where op in == != >= <= > <
    const m = condition.match(/^\s*(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)\s*$/);
    if (!m) return true; // Invalid condition syntax, default to visible

    const [, name, op, rhsRaw] = m;
    const lhs = values?.[name];
    let rhs: any = rhsRaw.trim();

    // Normalize rhs: strip quotes, parse number/boolean
    if (/^['"].*['"]$/.test(rhs)) {
        rhs = rhs.slice(1, -1);
    } else if (/^(true|false)$/i.test(rhs)) {
        rhs = rhs.toLowerCase() === "true";
    } else {
        const n = Number(rhs);
        if (!Number.isNaN(n)) rhs = n;
    }

    // Evaluate condition
    try {
        switch (op) {
            case "==": return lhs == rhs;
            case "!=": return lhs != rhs;
            case ">=": return lhs >= rhs;
            case "<=": return lhs <= rhs;
            case ">": return lhs > rhs;
            case "<": return lhs < rhs;
            default: return true;
        }
    } catch {
        return true; // Comparison failed, default to visible
    }
}

/**
 * Evaluate visibility condition with support for unlimited conditions chained with && (AND) or || (OR)
 * 
 * Syntax: "fieldName operator value" or chained conditions
 * Operators: ==, !=, >=, <=, >, <
 * Logical operators: && (AND), || (OR)
 * 
 * AND has higher precedence than OR.
 * You can chain as many conditions as needed.
 * 
 * Examples:
 * - "age >= 18"
 * - "subscribe == true"
 * - "country == \"USA\""
 * - "age >= 18 && subscribe == true"
 * - "country == \"USA\" || country == \"Canada\""
 * - "age >= 18 && subscribe == true && member == true"
 * - "age >= 18 && subscribe == true || admin == true"
 * - "country == \"USA\" || country == \"Canada\" || country == \"Mexico\""
 * - "age >= 18 && (subscribe == true || member == true)"
 * 
 * @param visibleIf - Condition string or undefined
 * @param values - Current form values
 * @returns True if field should be visible, False otherwise
 */
export function evaluateVisibility(visibleIf: string | undefined, values: Record<string, any>): boolean {
    if (!visibleIf) return true;

    const trimmed = visibleIf.trim();
    if (!trimmed) return true;

    // Check for OR operator first (lower precedence)
    // Split on || and evaluate each part - at least one must be true
    if (trimmed.includes('||')) {
        const orParts = trimmed.split('||').map(s => s.trim()).filter(s => s.length > 0);
        // At least one part must be true for OR
        return orParts.some(part => evaluateVisibility(part, values));
    }

    // Check for AND operator (higher precedence)
    // Split on && and evaluate each part - all must be true
    if (trimmed.includes('&&')) {
        const andParts = trimmed.split('&&').map(s => s.trim()).filter(s => s.length > 0);
        // All parts must be true for AND
        return andParts.every(part => evaluateVisibility(part, values));
    }

    // Single condition - evaluate it
    return evaluateSingleCondition(trimmed, values);
}
