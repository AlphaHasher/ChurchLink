export function evaluateVisibility(visibleIf: string | undefined, values: Record<string, any>): boolean {
    if (!visibleIf) return true;

    // Parser: "name op literal" where op in == != >= <= > <
    const m = visibleIf.match(/^\s*(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)\s*$/);
    if (!m) return true;

    const [, name, op, rhsRaw] = m;
    const lhs = values?.[name];
    let rhs: any = rhsRaw;

    // Normalize rhs: strip quotes, parse number/boolean
    if (/^['"].*['"]$/.test(rhsRaw)) {
        rhs = rhsRaw.slice(1, -1);
    } else if (/^(true|false)$/i.test(rhsRaw)) {
        rhs = rhsRaw.toLowerCase() === "true";
    } else {
        const n = Number(rhsRaw);
        if (!Number.isNaN(n)) rhs = n;
    }

    // Evaluate condition
    switch (op) {
        case "==": return lhs == rhs;
        case "!=": return lhs != rhs;
        case ">=": return lhs >= rhs;
        case "<=": return lhs <= rhs;
        case ">": return lhs > rhs;
        case "<": return lhs < rhs;
        default: return true;
    }
}
