"use strict";
/**
 * camaro template parsing and evaluation.
 *
 * Templates use the same JSON-shaped syntax as upstream camaro. A string leaf
 * is an XPath expression; the first character `#` makes it a string constant;
 * an array is a projection `[xpath, shape]`; an object describes the output
 * object. The small fast paths below mirror the ones in src/camaro.cpp so that
 * simple navigation keeps pugixml's exact scalar semantics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTemplate = parseTemplate;
exports.evaluateTemplate = evaluateTemplate;
const xpath_1 = require("./xpath");
const INVALID = { valid: false, value: {} };
/** Parse the JSON-serialised template into camaro's compact representation. */
function parseTemplate(value) {
    if (typeof value === 'string')
        return { kind: 'string', value };
    if (Array.isArray(value)) {
        const items = [];
        for (const item of value) {
            const parsed = parseTemplate(item);
            if (!parsed)
                return null;
            items.push(parsed);
        }
        return { kind: 'array', items };
    }
    if (value !== null && typeof value === 'object') {
        const members = [];
        for (const key of Object.keys(value)) {
            const parsed = parseTemplate(value[key]);
            if (!parsed)
                return null;
            members.push({ key, value: parsed });
        }
        return { kind: 'object', members };
    }
    return null;
}
function evaluateTemplate(template, context) {
    return evaluateValue(template, context);
}
function evaluateValue(template, context) {
    if (template.kind === 'object') {
        const output = {};
        for (const member of template.members) {
            const result = evaluateValue(member.value, context);
            if (!result.valid)
                return INVALID;
            output[member.key] = result.value;
        }
        return { valid: true, value: output };
    }
    if (template.kind === 'array')
        return evaluateArray(template, context);
    return { valid: true, value: evaluateScalar(template.value, context) };
}
function evaluateArray(template, context) {
    if (template.items.length === 0)
        return { valid: true, value: [] };
    if (template.items.length < 2)
        return INVALID;
    const path = template.items[0];
    const inner = template.items[1];
    if (path.kind !== 'string')
        return INVALID;
    const nodes = evaluateArrayPath(path.value, context);
    const output = [];
    for (const item of nodes) {
        const itemContext = (0, xpath_1.createItemContext)(item);
        if (inner.kind === 'object') {
            const result = evaluateValue(inner, itemContext);
            if (!result.valid)
                return INVALID;
            output.push(result.value);
        }
        else if (inner.kind === 'string') {
            output.push(evaluateScalar(inner.value, itemContext));
        }
        // An array nested directly inside an array is accepted by the parser but
        // contributes no item, matching writeArrayItem() in the C++ core.
    }
    return { valid: true, value: output };
}
function isAsciiAlphaNumeric(char) {
    return /[A-Za-z0-9]/.test(char);
}
function isSimpleNavPath(path) {
    if (path.length === 0)
        return false;
    for (const char of path) {
        if (isAsciiAlphaNumeric(char) || char === '/' || char === '@' || char === '_' || char === '-')
            continue;
        return false;
    }
    for (let index = 1; index < path.length; index++) {
        if (path[index - 1] === '/' && path[index] === '/')
            return false;
    }
    return true;
}
function parseNavPath(path) {
    const segments = [];
    let attribute = null;
    let start = path.startsWith('/') ? 1 : 0;
    while (start < path.length) {
        let end = path.indexOf('/', start);
        if (end === -1)
            end = path.length;
        if (path[start] === '@') {
            if (end !== path.length)
                return null;
            attribute = path.slice(start + 1, end);
        }
        else {
            segments.push(path.slice(start, end));
        }
        start = end + 1;
    }
    return { segments, attribute };
}
const navPathCache = new Map();
function cachedNavPath(path) {
    let cached = navPathCache.get(path);
    if (cached === undefined) {
        cached = isSimpleNavPath(path) ? parseNavPath(path) : null;
        navPathCache.set(path, cached);
    }
    return cached;
}
function firstElementChild(node, name) {
    for (const child of node.children) {
        if (child.type === 'element' && child.name === name)
            return child;
    }
    return null;
}
function firstChildValue(node) {
    for (const child of node.children) {
        if (child.type === 'text' || child.type === 'cdata')
            return child.value;
    }
    return '';
}
function findAttribute(node, name) {
    for (const attribute of node.attributes) {
        if (attribute.name === name)
            return attribute;
    }
    return null;
}
function followNavPath(item, path) {
    let node = item.kind === 'attribute' ? item.attribute.owner : item.node;
    for (const segment of path.segments) {
        if (!node)
            return null;
        node = firstElementChild(node, segment);
    }
    return node;
}
function simpleStringValue(path, item) {
    const target = followNavPath(item, path);
    if (!target)
        return '';
    if (path.attribute !== null) {
        if (target.type !== 'element')
            return '';
        const attribute = findAttribute(target, path.attribute);
        return attribute ? attribute.value : '';
    }
    return firstChildValue(target);
}
/**
 * pugixml's fast number path uses xml_text/xml_attribute::as_double(), which
 * parses a leading numeric prefix and defaults to 0. It is intentionally more
 * lenient than the XPath number() function.
 */
function asDouble(value) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}
function simpleNumberValue(path, item) {
    const target = followNavPath(item, path);
    if (!target)
        return Number.NaN;
    if (path.attribute !== null) {
        if (target.type !== 'element')
            return Number.NaN;
        const attribute = findAttribute(target, path.attribute);
        return attribute ? asDouble(attribute.value) : Number.NaN;
    }
    return asDouble(firstChildValue(target));
}
/* -------------------------------------------------------------------------- */
/* Scalar evaluation                                                          */
/* -------------------------------------------------------------------------- */
const expressionCache = new Map();
function expression(path) {
    let parsed = expressionCache.get(path);
    if (parsed === undefined) {
        parsed = (0, xpath_1.parseXPath)(path);
        expressionCache.set(path, parsed);
    }
    return parsed;
}
function contextNodeOf(item) {
    return item.kind === 'attribute' ? item.attribute.owner : item.node;
}
function visitSimplePath(node, segments) {
    let current = [node];
    for (const segment of segments) {
        const next = [];
        for (const parent of current) {
            for (const child of parent.children) {
                if (child.type === 'element' && child.name === segment)
                    next.push(child);
            }
        }
        current = next;
    }
    return current.map((element) => ({ kind: 'node', node: element, order: element.order }));
}
function visitDescendants(root, name) {
    const result = [];
    const stack = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (node.type === 'element' && node.name === name) {
            result.push({ kind: 'node', node, order: node.order });
        }
        const children = node.children;
        for (let index = children.length - 1; index >= 0; index--) {
            const child = children[index];
            if (child.type === 'element')
                stack.push(child);
        }
    }
    return result;
}
function evaluateArrayPath(path, context) {
    // Match the fast paths in writeArray()/src/camaro.cpp. In particular, these
    // fast paths walk from the current context node even for absolute-looking
    // simple paths, which is observable inside nested templates.
    const nav = cachedNavPath(path);
    if (nav && nav.attribute === null) {
        return visitSimplePath(contextNodeOf(context.item), nav.segments);
    }
    if (path.length >= 3 && path.startsWith('//') && path.indexOf('/', 2) === -1) {
        const name = path.slice(2);
        if (/^[A-Za-z0-9_@-]+$/.test(name)) {
            return visitDescendants(contextNodeOf(context.item), name);
        }
    }
    const parsed = expression(path);
    if (!parsed)
        return [];
    return (0, xpath_1.evaluateNodeSet)(parsed, context);
}
function returnType(path) {
    if (path.startsWith('count(') ||
        path.startsWith('ceiling(') ||
        path.startsWith('floor(') ||
        path.startsWith('round(') ||
        path.startsWith('sum(')) {
        return 'number';
    }
    if (path.startsWith('number(') && path.length >= 9 && path.endsWith(')'))
        return 'number';
    if (path.startsWith('boolean(') && path.length >= 10 && path.endsWith(')'))
        return 'boolean';
    return 'string';
}
function trimTemplateWhitespace(value) {
    return value.replace(/^[ \t]+|[ \t]+$/g, '');
}
function evaluateNumberScalar(path, context) {
    if (path.startsWith('number(') && path.length >= 9 && path.endsWith(')')) {
        const inner = path.slice(7, -1);
        const nav = cachedNavPath(inner);
        if (nav)
            return simpleNumberValue(nav, context.item);
    }
    const parsed = expression(path);
    if (!parsed)
        return Number.NaN;
    return (0, xpath_1.evaluateNumber)(parsed, context);
}
function evaluateBooleanScalar(path, context) {
    if (path.startsWith('boolean(') && path.length >= 10 && path.endsWith(')')) {
        const inner = path.slice(8, -1);
        const equal = inner.indexOf('=');
        if (equal !== -1) {
            let left = trimTemplateWhitespace(inner.slice(0, equal));
            let right = trimTemplateWhitespace(inner.slice(equal + 1));
            if (right.length >= 2) {
                const first = right[0];
                const last = right[right.length - 1];
                if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
                    right = right.slice(1, -1);
                }
            }
            const fast = left.indexOf('(') === -1 && left.indexOf('/') === -1 && left.indexOf('@') === -1;
            if (fast) {
                const node = context.item.kind === 'attribute' ? context.item.attribute.owner : context.item.node;
                const child = firstElementChild(node, left);
                return child !== null && firstChildValue(child) === right;
            }
        }
    }
    const parsed = expression(path);
    if (!parsed)
        return false;
    return (0, xpath_1.evaluateBoolean)(parsed, context);
}
function evaluateStringScalar(path, context) {
    if (path.length > 0 && path[0] === '#')
        return path.slice(1);
    const nav = cachedNavPath(path);
    if (nav)
        return simpleStringValue(nav, context.item);
    const parsed = expression(path);
    if (!parsed)
        return '';
    return (0, xpath_1.evaluateString)(parsed, context);
}
function evaluateScalar(path, context) {
    if (path.length === 0)
        return '';
    const type = returnType(path);
    if (type === 'number')
        return evaluateNumberScalar(path, context);
    if (type === 'boolean')
        return evaluateBooleanScalar(path, context);
    return evaluateStringScalar(path, context);
}
