"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAPI = exports.addCustomMethods = void 0;
const util_1 = require("util");
const lodash_1 = require("lodash");
const builder_symbol_1 = __importDefault(require("../builder-symbol"));
const snapshot_properties_1 = require("./snapshot-properties");
const get_callsite_1 = require("../../errors/get-callsite");
const client_function_builder_1 = __importDefault(require("../client-function-builder"));
const re_executable_promise_1 = __importDefault(require("../../utils/re-executable-promise"));
const type_assertions_1 = require("../../errors/runtime/type-assertions");
const make_reg_exp_1 = require("../../utils/make-reg-exp");
const selector_text_filter_1 = __importDefault(require("./selector-text-filter"));
const selector_attribute_filter_1 = __importDefault(require("./selector-attribute-filter"));
const prepare_api_args_1 = __importDefault(require("./prepare-api-args"));
const callsite_1 = require("../../utils/callsite");
const selector_api_execution_mode_1 = __importDefault(require("../selector-api-execution-mode"));
const VISIBLE_PROP_NAME = 'visible';
const SNAPSHOT_PROP_PRIMITIVE = `[object ${re_executable_promise_1.default.name}]`;
const filterNodes = new client_function_builder_1.default((nodes, filter, querySelectorRoot, originNode, ...filterArgs) => {
    if (typeof filter === 'number') {
        const matchingNode = filter < 0 ? nodes[nodes.length + filter] : nodes[filter];
        return matchingNode ? [matchingNode] : [];
    }
    const result = [];
    if (typeof filter === 'string') {
        // NOTE: we can search for elements only in document/element/shadow root.
        if (querySelectorRoot.nodeType !== 1 && querySelectorRoot.nodeType !== 9 && querySelectorRoot.nodeType !== 11)
            return null;
        const matching = querySelectorRoot.querySelectorAll(filter);
        const matchingArr = [];
        for (let i = 0; i < matching.length; i++)
            matchingArr.push(matching[i]);
        filter = node => matchingArr.indexOf(node) > -1;
    }
    if (typeof filter === 'function') {
        for (let j = 0; j < nodes.length; j++) {
            if (filter(nodes[j], j, originNode, ...filterArgs))
                result.push(nodes[j]);
        }
    }
    return result;
}).getFunction();
const expandSelectorResults = new client_function_builder_1.default((selector, populateDerivativeNodes) => {
    const nodes = selector();
    if (!nodes.length)
        return null;
    const result = [];
    for (let i = 0; i < nodes.length; i++) {
        const derivativeNodes = populateDerivativeNodes(nodes[i]);
        if (derivativeNodes) {
            for (let j = 0; j < derivativeNodes.length; j++) {
                if (result.indexOf(derivativeNodes[j]) < 0)
                    result.push(derivativeNodes[j]);
            }
        }
    }
    return result;
}).getFunction();
async function getSnapshot(getSelector, callsite, SelectorBuilder, getVisibleValueMode) {
    let node = null;
    const selector = new SelectorBuilder(getSelector(), { getVisibleValueMode, needError: true }, { instantiation: 'Selector' }, callsite).getFunction();
    try {
        node = await selector();
    }
    catch (err) {
        err.callsite = callsite;
        throw err;
    }
    return node;
}
function getSnapshotSync(getSelector, callsite, SelectorBuilder, getVisibleValueMode) {
    let node = null;
    const selector = new SelectorBuilder(getSelector(), { getVisibleValueMode, needError: true }, { instantiation: 'Selector' }, callsite).getFunction();
    try {
        node = selector();
    }
    catch (err) {
        err.callsite = callsite;
        throw err;
    }
    return node;
}
function assertAddCustomDOMPropertiesOptions(properties) {
    (0, type_assertions_1.assertType)(type_assertions_1.is.nonNullObject, 'addCustomDOMProperties', 'The "addCustomDOMProperties" option', properties);
    Object.keys(properties).forEach(prop => {
        (0, type_assertions_1.assertType)(type_assertions_1.is.function, 'addCustomDOMProperties', `The custom DOM properties method '${prop}'`, properties[prop]);
    });
}
function assertAddCustomMethods(properties, opts) {
    (0, type_assertions_1.assertType)(type_assertions_1.is.nonNullObject, 'addCustomMethods', 'The "addCustomMethods" option', properties);
    if (opts !== void 0)
        (0, type_assertions_1.assertType)(type_assertions_1.is.nonNullObject, 'addCustomMethods', 'The "addCustomMethods" option', opts);
    Object.keys(properties).forEach(prop => {
        (0, type_assertions_1.assertType)(type_assertions_1.is.function, 'addCustomMethods', `The custom method '${prop}'`, properties[prop]);
    });
}
function getDerivativeSelectorArgs(options, selectorFn, apiFn, filter, additionalDependencies) {
    return Object.assign({}, options, { selectorFn, apiFn, filter, additionalDependencies });
}
function createPrimitiveGetterWrapper(observedCallsites, callsite) {
    return (depth, options) => {
        const isTestCafeInspect = options === null || options === void 0 ? void 0 : options.isTestCafeInspect;
        if (observedCallsites && !isTestCafeInspect)
            observedCallsites.unawaitedSnapshotCallsites.add(callsite);
        return SNAPSHOT_PROP_PRIMITIVE;
    };
}
function checkForExcessiveAwaits(snapshotPropertyCallsites, checkedCallsite) {
    const callsiteId = (0, callsite_1.getCallsiteId)(checkedCallsite);
    // NOTE: If there is an asserted callsite, it means that .expect() was already called.
    // We don't raise a warning and delete the callsite.
    if (snapshotPropertyCallsites[callsiteId] && snapshotPropertyCallsites[callsiteId].checked)
        delete snapshotPropertyCallsites[callsiteId];
    // NOTE: If the calliste already exists, but is not asserted, it means that there are
    // multiple awaited callsites in one assertion. We raise a warning for each of them.
    else if (snapshotPropertyCallsites[callsiteId] && !snapshotPropertyCallsites[callsiteId].checked)
        snapshotPropertyCallsites[callsiteId].callsites.push(checkedCallsite);
    else
        snapshotPropertyCallsites[callsiteId] = { callsites: [checkedCallsite], checked: false };
}
function addSnapshotProperties(obj, getSelector, SelectorBuilder, properties, observedCallsites) {
    properties.forEach(prop => {
        Object.defineProperty(obj, prop, {
            get: () => {
                const callsite = (0, get_callsite_1.getCallsiteForMethod)('get');
                if (selector_api_execution_mode_1.default.isSync)
                    return getSnapshotSync(getSelector, callsite, SelectorBuilder)[prop];
                const propertyPromise = re_executable_promise_1.default.fromFn(async () => {
                    const snapshot = await getSnapshot(getSelector, callsite, SelectorBuilder);
                    return snapshot[prop];
                });
                const primitiveGetterWrapper = createPrimitiveGetterWrapper(observedCallsites, callsite);
                propertyPromise[Symbol.toPrimitive] = primitiveGetterWrapper;
                propertyPromise[util_1.inspect.custom] = primitiveGetterWrapper;
                propertyPromise.then = function (onFulfilled, onRejected) {
                    if (observedCallsites)
                        checkForExcessiveAwaits(observedCallsites.snapshotPropertyCallsites, callsite);
                    this._ensureExecuting();
                    return this._taskPromise.then(onFulfilled, onRejected);
                };
                return propertyPromise;
            },
        });
    });
}
function addVisibleProperty({ obj, getSelector, SelectorBuilder }) {
    Object.defineProperty(obj, VISIBLE_PROP_NAME, {
        get: () => {
            const callsite = (0, get_callsite_1.getCallsiteForMethod)('get');
            if (selector_api_execution_mode_1.default.isSync) {
                const snapshot = getSnapshotSync(getSelector, callsite, SelectorBuilder, true);
                return !!snapshot && snapshot[VISIBLE_PROP_NAME];
            }
            return re_executable_promise_1.default.fromFn(async () => {
                const snapshot = await getSnapshot(getSelector, callsite, SelectorBuilder, true);
                return !!snapshot && snapshot[VISIBLE_PROP_NAME];
            });
        },
    });
}
function addCustomMethods(obj, getSelector, SelectorBuilder, customMethods) {
    const customMethodProps = customMethods ? Object.keys(customMethods) : [];
    customMethodProps.forEach(prop => {
        const { returnDOMNodes = false, method } = customMethods[prop];
        const dependencies = {
            customMethod: method,
            selector: getSelector(),
        };
        const callsiteNames = { instantiation: prop };
        if (returnDOMNodes) {
            obj[prop] = (...args) => {
                const selectorFn = () => {
                    /* eslint-disable no-undef */
                    const nodes = selector();
                    return customMethod.apply(customMethod, [nodes].concat(args));
                    /* eslint-enable no-undef */
                };
                const apiFn = (0, prepare_api_args_1.default)(prop, ...args);
                const filter = () => true;
                const additionalDependencies = {
                    args,
                    customMethod: method,
                };
                return createDerivativeSelectorWithFilter({ getSelector, SelectorBuilder, selectorFn, apiFn, filter, additionalDependencies });
            };
        }
        else {
            obj[prop] = new client_function_builder_1.default((...args) => {
                /* eslint-disable no-undef */
                const node = selector();
                return customMethod.apply(customMethod, [node].concat(args));
                /* eslint-enable no-undef */
            }, { dependencies }, callsiteNames).getFunction();
        }
    });
}
exports.addCustomMethods = addCustomMethods;
function prepareSnapshotPropertyList(customDOMProperties) {
    let properties = [...snapshot_properties_1.SNAPSHOT_PROPERTIES];
    // NOTE: The 'visible' snapshot property has a separate handler.
    (0, lodash_1.pull)(properties, VISIBLE_PROP_NAME);
    if (customDOMProperties)
        properties = properties.concat(Object.keys(customDOMProperties));
    return properties;
}
function getAttributeValue(attributes, attrName) {
    if (attributes && attributes.hasOwnProperty(attrName))
        return attributes[attrName];
    // NOTE: https://dom.spec.whatwg.org/#dom-element-getattribute (null result for nonexistent attributes)
    return null;
}
function addSnapshotPropertyShorthands({ obj, getSelector, SelectorBuilder, customDOMProperties, customMethods, observedCallsites }) {
    const properties = prepareSnapshotPropertyList(customDOMProperties);
    addSnapshotProperties(obj, getSelector, SelectorBuilder, properties, observedCallsites);
    addCustomMethods(obj, getSelector, SelectorBuilder, customMethods);
    obj.getStyleProperty = prop => {
        const callsite = (0, get_callsite_1.getCallsiteForMethod)('getStyleProperty');
        if (selector_api_execution_mode_1.default.isSync) {
            const snapshot = getSnapshotSync(getSelector, callsite, SelectorBuilder);
            return snapshot.style ? snapshot.style[prop] : void 0;
        }
        return re_executable_promise_1.default.fromFn(async () => {
            const snapshot = await getSnapshot(getSelector, callsite, SelectorBuilder);
            return snapshot.style ? snapshot.style[prop] : void 0;
        });
    };
    obj.getAttribute = attrName => {
        const callsite = (0, get_callsite_1.getCallsiteForMethod)('getAttribute');
        if (selector_api_execution_mode_1.default.isSync) {
            const snapshot = getSnapshotSync(getSelector, callsite, SelectorBuilder);
            return getAttributeValue(snapshot.attributes, attrName);
        }
        return re_executable_promise_1.default.fromFn(async () => {
            const snapshot = await getSnapshot(getSelector, callsite, SelectorBuilder);
            return getAttributeValue(snapshot.attributes, attrName);
        });
    };
    obj.hasAttribute = attrName => {
        const callsite = (0, get_callsite_1.getCallsiteForMethod)('hasAttribute');
        if (selector_api_execution_mode_1.default.isSync) {
            const snapshot = getSnapshotSync(getSelector, callsite, SelectorBuilder);
            return snapshot.attributes ? snapshot.attributes.hasOwnProperty(attrName) : false;
        }
        return re_executable_promise_1.default.fromFn(async () => {
            const snapshot = await getSnapshot(getSelector, callsite, SelectorBuilder);
            return snapshot.attributes ? snapshot.attributes.hasOwnProperty(attrName) : false;
        });
    };
    obj.getBoundingClientRectProperty = prop => {
        const callsite = (0, get_callsite_1.getCallsiteForMethod)('getBoundingClientRectProperty');
        if (selector_api_execution_mode_1.default.isSync) {
            const snapshot = getSnapshotSync(getSelector, callsite, SelectorBuilder);
            return snapshot.boundingClientRect ? snapshot.boundingClientRect[prop] : void 0;
        }
        return re_executable_promise_1.default.fromFn(async () => {
            const snapshot = await getSnapshot(getSelector, callsite, SelectorBuilder);
            return snapshot.boundingClientRect ? snapshot.boundingClientRect[prop] : void 0;
        });
    };
    obj.hasClass = name => {
        const callsite = (0, get_callsite_1.getCallsiteForMethod)('hasClass');
        if (selector_api_execution_mode_1.default.isSync) {
            const snapshot = getSnapshotSync(getSelector, callsite, SelectorBuilder);
            return snapshot.classNames ? snapshot.classNames.includes(name) : false;
        }
        return re_executable_promise_1.default.fromFn(async () => {
            const snapshot = await getSnapshot(getSelector, callsite, SelectorBuilder);
            return snapshot.classNames ? snapshot.classNames.includes(name) : false;
        });
    };
}
function createCounter(getSelector, SelectorBuilder) {
    const builder = new SelectorBuilder(getSelector(), { counterMode: true }, { instantiation: 'Selector' });
    const counter = builder.getFunction();
    const callsite = (0, get_callsite_1.getCallsiteForMethod)('get');
    return async () => {
        try {
            return await counter();
        }
        catch (err) {
            err.callsite = callsite;
            throw err;
        }
    };
}
function createCounterSync(getSelector, SelectorBuilder) {
    const builder = new SelectorBuilder(getSelector(), { counterMode: true }, { instantiation: 'Selector' });
    const counter = builder.getFunction();
    const callsite = (0, get_callsite_1.getCallsiteForMethod)('get');
    return () => {
        try {
            return counter();
        }
        catch (err) {
            err.callsite = callsite;
            throw err;
        }
    };
}
function addCounterProperties({ obj, getSelector, SelectorBuilder }) {
    Object.defineProperty(obj, 'count', {
        get: () => {
            if (selector_api_execution_mode_1.default.isSync)
                return createCounterSync(getSelector, SelectorBuilder)();
            const counter = createCounter(getSelector, SelectorBuilder);
            return re_executable_promise_1.default.fromFn(() => counter());
        },
    });
    Object.defineProperty(obj, 'exists', {
        get: () => {
            if (selector_api_execution_mode_1.default.isSync)
                return createCounterSync(getSelector, SelectorBuilder)() > 0;
            const counter = createCounter(getSelector, SelectorBuilder);
            return re_executable_promise_1.default.fromFn(async () => await counter() > 0);
        },
    });
}
function convertFilterToClientFunctionIfNecessary(callsiteName, filter, dependencies) {
    if (typeof filter === 'function') {
        const builder = filter[builder_symbol_1.default];
        const fn = builder ? builder.fn : filter;
        const options = builder ? (0, lodash_1.assign)({}, builder.options, { dependencies }) : { dependencies };
        return new client_function_builder_1.default(fn, options, { instantiation: callsiteName }).getFunction();
    }
    return filter;
}
function createDerivativeSelectorWithFilter({ getSelector, SelectorBuilder, selectorFn, apiFn, filter, additionalDependencies }) {
    const collectionModeSelectorBuilder = new SelectorBuilder(getSelector(), { collectionMode: true });
    const customDOMProperties = collectionModeSelectorBuilder.options.customDOMProperties;
    const customMethods = collectionModeSelectorBuilder.options.customMethods;
    let dependencies = {
        selector: collectionModeSelectorBuilder.getFunction(),
        filter: filter,
        filterNodes: filterNodes,
    };
    const { boundTestRun, timeout, visibilityCheck, apiFnChain } = collectionModeSelectorBuilder.options;
    dependencies = (0, lodash_1.assign)(dependencies, additionalDependencies);
    const builder = new SelectorBuilder(selectorFn, {
        dependencies,
        customDOMProperties,
        customMethods,
        boundTestRun,
        timeout,
        visibilityCheck,
        apiFnChain,
        apiFn,
    }, { instantiation: 'Selector' });
    return builder.getFunction();
}
const filterByText = convertFilterToClientFunctionIfNecessary('filter', selector_text_filter_1.default);
const filterByAttr = convertFilterToClientFunctionIfNecessary('filter', selector_attribute_filter_1.default);
function ensureRegExpContext(str) {
    // NOTE: if a regexp is created in a separate context (via the 'vm' module) we
    // should wrap it with new RegExp() to make the `instanceof RegExp` check successful.
    if (typeof str !== 'string' && !(str instanceof RegExp))
        return new RegExp(str);
    return str;
}
function addFilterMethods(options) {
    const { obj, getSelector, SelectorBuilder } = options;
    obj.nth = index => {
        (0, type_assertions_1.assertType)(type_assertions_1.is.number, 'nth', 'The "index" argument', index);
        const apiFn = (0, prepare_api_args_1.default)('nth', index);
        const builder = new SelectorBuilder(getSelector(), { index, apiFn }, { instantiation: 'Selector' });
        return builder.getFunction();
    };
    obj.withText = text => {
        (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.regExp], 'withText', 'The "text" argument', text);
        const apiFn = (0, prepare_api_args_1.default)('withText', text);
        text = ensureRegExpContext(text);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            const nodes = selector();
            if (!nodes.length)
                return null;
            return filterNodes(nodes, filter, document, void 0, textRe);
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filterByText, { textRe: (0, make_reg_exp_1.makeRegExp)(text) });
        return createDerivativeSelectorWithFilter(args);
    };
    obj.withExactText = text => {
        (0, type_assertions_1.assertType)(type_assertions_1.is.string, 'withExactText', 'The "text" argument', text);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            const nodes = selector();
            if (!nodes.length)
                return null;
            return filterNodes(nodes, filter, document, void 0, exactText);
            /* eslint-enable no-undef */
        };
        const apiFn = (0, prepare_api_args_1.default)('withExactText', text);
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filterByText, { exactText: text });
        return createDerivativeSelectorWithFilter(args);
    };
    obj.withAttribute = (attrName, attrValue) => {
        (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.regExp], 'withAttribute', 'The "attrName" argument', attrName);
        const apiFn = (0, prepare_api_args_1.default)('withAttribute', attrName, attrValue);
        attrName = ensureRegExpContext(attrName);
        if (attrValue !== void 0) {
            (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.regExp], 'withAttribute', 'The "attrValue" argument', attrValue);
            attrValue = ensureRegExpContext(attrValue);
        }
        const selectorFn = () => {
            /* eslint-disable no-undef */
            const nodes = selector();
            if (!nodes.length)
                return null;
            return filterNodes(nodes, filter, document, void 0, attrName, attrValue);
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filterByAttr, {
            attrName,
            attrValue,
        });
        return createDerivativeSelectorWithFilter(args);
    };
    obj.filter = (filter, dependencies) => {
        (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.function], 'filter', 'The "filter" argument', filter);
        const apiFn = (0, prepare_api_args_1.default)('filter', filter);
        filter = convertFilterToClientFunctionIfNecessary('filter', filter, dependencies);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            const nodes = selector();
            if (!nodes.length)
                return null;
            return filterNodes(nodes, filter, document, void 0);
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filter);
        return createDerivativeSelectorWithFilter(args);
    };
    obj.filterVisible = () => {
        const apiFn = (0, prepare_api_args_1.default)('filterVisible');
        const builder = new SelectorBuilder(getSelector(), { filterVisible: true, apiFn }, { instantiation: 'Selector' });
        return builder.getFunction();
    };
    obj.filterHidden = () => {
        const apiFn = (0, prepare_api_args_1.default)('filterHidden');
        const builder = new SelectorBuilder(getSelector(), { filterHidden: true, apiFn }, { instantiation: 'Selector' });
        return builder.getFunction();
    };
}
function addCustomDOMPropertiesMethod({ obj, getSelector, SelectorBuilder }) {
    obj.addCustomDOMProperties = customDOMProperties => {
        assertAddCustomDOMPropertiesOptions(customDOMProperties);
        const builder = new SelectorBuilder(getSelector(), { customDOMProperties }, { instantiation: 'Selector' });
        return builder.getFunction();
    };
}
function addCustomMethodsMethod({ obj, getSelector, SelectorBuilder }) {
    obj.addCustomMethods = function (methods, opts) {
        assertAddCustomMethods(methods, opts);
        const customMethods = {};
        Object.keys(methods).forEach(methodName => {
            customMethods[methodName] = {
                method: methods[methodName],
                returnDOMNodes: opts && !!opts.returnDOMNodes,
            };
        });
        const builder = new SelectorBuilder(getSelector(), { customMethods }, { instantiation: 'Selector' });
        return builder.getFunction();
    };
}
function addHierarchicalSelectors(options) {
    const { obj } = options;
    // Find
    obj.find = (filter, dependencies) => {
        (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.function], 'find', 'The "filter" argument', filter);
        const apiFn = (0, prepare_api_args_1.default)('find', filter);
        filter = convertFilterToClientFunctionIfNecessary('find', filter, dependencies);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            return expandSelectorResults(selector, node => {
                if (typeof filter === 'string') {
                    return typeof node.querySelectorAll === 'function' ?
                        node.querySelectorAll(filter) :
                        null;
                }
                const results = [];
                const visitNode = currentNode => {
                    const cnLength = currentNode.childNodes.length;
                    for (let i = 0; i < cnLength; i++) {
                        const child = currentNode.childNodes[i];
                        results.push(child);
                        visitNode(child);
                    }
                };
                visitNode(node);
                return filterNodes(results, filter, null, node);
            });
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filter, { expandSelectorResults });
        return createDerivativeSelectorWithFilter(args);
    };
    // Parent
    obj.parent = (filter, dependencies) => {
        if (filter !== void 0)
            (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.function, type_assertions_1.is.number], 'parent', 'The "filter" argument', filter);
        const apiFn = (0, prepare_api_args_1.default)('parent', filter);
        filter = convertFilterToClientFunctionIfNecessary('find', filter, dependencies);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            return expandSelectorResults(selector, node => {
                const parents = [];
                for (let parent = node.parentNode; parent; parent = parent.parentNode)
                    parents.push(parent);
                return filter !== void 0 ? filterNodes(parents, filter, document, node) : parents;
            });
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filter, { expandSelectorResults });
        return createDerivativeSelectorWithFilter(args);
    };
    // Child
    obj.child = (filter, dependencies) => {
        if (filter !== void 0)
            (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.function, type_assertions_1.is.number], 'child', 'The "filter" argument', filter);
        const apiFn = (0, prepare_api_args_1.default)('child', filter);
        filter = convertFilterToClientFunctionIfNecessary('find', filter, dependencies);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            return expandSelectorResults(selector, node => {
                const childElements = [];
                const cnLength = node.childNodes.length;
                for (let i = 0; i < cnLength; i++) {
                    const child = node.childNodes[i];
                    if (child.nodeType === 1)
                        childElements.push(child);
                }
                return filter !== void 0 ? filterNodes(childElements, filter, node, node) : childElements;
            });
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filter, { expandSelectorResults });
        return createDerivativeSelectorWithFilter(args);
    };
    // Sibling
    obj.sibling = (filter, dependencies) => {
        if (filter !== void 0)
            (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.function, type_assertions_1.is.number], 'sibling', 'The "filter" argument', filter);
        const apiFn = (0, prepare_api_args_1.default)('sibling', filter);
        filter = convertFilterToClientFunctionIfNecessary('find', filter, dependencies);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            return expandSelectorResults(selector, node => {
                const parent = node.parentNode;
                if (!parent)
                    return null;
                const siblings = [];
                const cnLength = parent.childNodes.length;
                for (let i = 0; i < cnLength; i++) {
                    const child = parent.childNodes[i];
                    if (child.nodeType === 1 && child !== node)
                        siblings.push(child);
                }
                return filter !== void 0 ? filterNodes(siblings, filter, parent, node) : siblings;
            });
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filter, { expandSelectorResults });
        return createDerivativeSelectorWithFilter(args);
    };
    // Next sibling
    obj.nextSibling = (filter, dependencies) => {
        if (filter !== void 0)
            (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.function, type_assertions_1.is.number], 'nextSibling', 'The "filter" argument', filter);
        const apiFn = (0, prepare_api_args_1.default)('nextSibling', filter);
        filter = convertFilterToClientFunctionIfNecessary('find', filter, dependencies);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            return expandSelectorResults(selector, node => {
                const parent = node.parentNode;
                if (!parent)
                    return null;
                const siblings = [];
                const cnLength = parent.childNodes.length;
                let afterNode = false;
                for (let i = 0; i < cnLength; i++) {
                    const child = parent.childNodes[i];
                    if (child === node)
                        afterNode = true;
                    else if (afterNode && child.nodeType === 1)
                        siblings.push(child);
                }
                return filter !== void 0 ? filterNodes(siblings, filter, parent, node) : siblings;
            });
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filter, { expandSelectorResults });
        return createDerivativeSelectorWithFilter(args);
    };
    // Prev sibling
    obj.prevSibling = (filter, dependencies) => {
        if (filter !== void 0)
            (0, type_assertions_1.assertType)([type_assertions_1.is.string, type_assertions_1.is.function, type_assertions_1.is.number], 'prevSibling', 'The "filter" argument', filter);
        const apiFn = (0, prepare_api_args_1.default)('prevSibling', filter);
        filter = convertFilterToClientFunctionIfNecessary('find', filter, dependencies);
        const selectorFn = () => {
            /* eslint-disable no-undef */
            return expandSelectorResults(selector, node => {
                const parent = node.parentNode;
                if (!parent)
                    return null;
                const siblings = [];
                const cnLength = parent.childNodes.length;
                for (let i = 0; i < cnLength; i++) {
                    const child = parent.childNodes[i];
                    if (child === node)
                        break;
                    if (child.nodeType === 1)
                        siblings.push(child);
                }
                return filter !== void 0 ? filterNodes(siblings, filter, parent, node) : siblings;
            });
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, filter, { expandSelectorResults });
        return createDerivativeSelectorWithFilter(args);
    };
    // ShadowRoot
    obj.shadowRoot = () => {
        const apiFn = (0, prepare_api_args_1.default)('shadowRoot');
        const selectorFn = () => {
            /* eslint-disable no-undef */
            return expandSelectorResults(selector, node => {
                return !node.shadowRoot ? null : [node.shadowRoot];
            });
            /* eslint-enable no-undef */
        };
        const args = getDerivativeSelectorArgs(options, selectorFn, apiFn, void 0, { expandSelectorResults });
        return createDerivativeSelectorWithFilter(args);
    };
}
function addAPI(selector, getSelector, SelectorBuilder, customDOMProperties, customMethods, observedCallsites, skipSnapshotProperties) {
    const options = { obj: selector, getSelector, SelectorBuilder, customDOMProperties, customMethods, observedCallsites };
    addFilterMethods(options);
    addHierarchicalSelectors(options);
    if (!skipSnapshotProperties)
        addSnapshotPropertyShorthands(options);
    addCustomDOMPropertiesMethod(options);
    addCustomMethodsMethod(options);
    addCounterProperties(options);
    addVisibleProperty(options);
}
exports.addAPI = addAPI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkLWFwaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGllbnQtZnVuY3Rpb25zL3NlbGVjdG9ycy9hZGQtYXBpLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLCtCQUErQjtBQUMvQixtQ0FBZ0Q7QUFDaEQsdUVBQTREO0FBQzVELCtEQUE0RDtBQUM1RCw0REFBaUU7QUFDakUseUZBQStEO0FBQy9ELDhGQUFvRTtBQUNwRSwwRUFBc0U7QUFDdEUsMkRBQXNEO0FBQ3RELGtGQUF3RDtBQUN4RCw0RkFBa0U7QUFDbEUsMEVBQWtEO0FBQ2xELG1EQUFxRDtBQUNyRCxpR0FBc0U7QUFFdEUsTUFBTSxpQkFBaUIsR0FBUyxTQUFTLENBQUM7QUFDMUMsTUFBTSx1QkFBdUIsR0FBRyxXQUFXLCtCQUFtQixDQUFDLElBQUksR0FBRyxDQUFDO0FBRXZFLE1BQU0sV0FBVyxHQUFHLElBQUksaUNBQXFCLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxHQUFHLFVBQVUsRUFBRSxFQUFFO0lBQzFHLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO1FBQzVCLE1BQU0sWUFBWSxHQUFHLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFL0UsT0FBTyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztLQUM3QztJQUVELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUVsQixJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtRQUM1Qix5RUFBeUU7UUFDekUsSUFBSSxpQkFBaUIsQ0FBQyxRQUFRLEtBQUssQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFFBQVEs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QztZQUN2RCxDQUFDLENBQUMsQ0FBQztZQUNILDRCQUE0QjtRQUNoQyxDQUFDLENBQUM7UUFFRixNQUFNLElBQUksR0FBRyx5QkFBeUIsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLHFCQUFxQixFQUFFLENBQUMsQ0FBQztRQUV0RyxPQUFPLGtDQUFrQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3BELENBQUMsQ0FBQztBQUNOLENBQUM7QUFFRCxTQUFnQixNQUFNLENBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixFQUFFLHNCQUFzQjtJQUN6SSxNQUFNLE9BQU8sR0FBRyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztJQUV2SCxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMxQix3QkFBd0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUVsQyxJQUFJLENBQUMsc0JBQXNCO1FBQ3ZCLDZCQUE2QixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRTNDLDRCQUE0QixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3RDLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2hDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzlCLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFiRCx3QkFhQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGluc3BlY3QgfSBmcm9tICd1dGlsJztcbmltcG9ydCB7IGFzc2lnbiwgcHVsbCBhcyByZW1vdmUgfSBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IGNsaWVudEZ1bmN0aW9uQnVpbGRlclN5bWJvbCBmcm9tICcuLi9idWlsZGVyLXN5bWJvbCc7XG5pbXBvcnQgeyBTTkFQU0hPVF9QUk9QRVJUSUVTIH0gZnJvbSAnLi9zbmFwc2hvdC1wcm9wZXJ0aWVzJztcbmltcG9ydCB7IGdldENhbGxzaXRlRm9yTWV0aG9kIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2dldC1jYWxsc2l0ZSc7XG5pbXBvcnQgQ2xpZW50RnVuY3Rpb25CdWlsZGVyIGZyb20gJy4uL2NsaWVudC1mdW5jdGlvbi1idWlsZGVyJztcbmltcG9ydCBSZUV4ZWN1dGFibGVQcm9taXNlIGZyb20gJy4uLy4uL3V0aWxzL3JlLWV4ZWN1dGFibGUtcHJvbWlzZSc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlLCBpcyB9IGZyb20gJy4uLy4uL2Vycm9ycy9ydW50aW1lL3R5cGUtYXNzZXJ0aW9ucyc7XG5pbXBvcnQgeyBtYWtlUmVnRXhwIH0gZnJvbSAnLi4vLi4vdXRpbHMvbWFrZS1yZWctZXhwJztcbmltcG9ydCBzZWxlY3RvclRleHRGaWx0ZXIgZnJvbSAnLi9zZWxlY3Rvci10ZXh0LWZpbHRlcic7XG5pbXBvcnQgc2VsZWN0b3JBdHRyaWJ1dGVGaWx0ZXIgZnJvbSAnLi9zZWxlY3Rvci1hdHRyaWJ1dGUtZmlsdGVyJztcbmltcG9ydCBwcmVwYXJlQXBpRm5BcmdzIGZyb20gJy4vcHJlcGFyZS1hcGktYXJncyc7XG5pbXBvcnQgeyBnZXRDYWxsc2l0ZUlkIH0gZnJvbSAnLi4vLi4vdXRpbHMvY2FsbHNpdGUnO1xuaW1wb3J0IHNlbGVjdG9yQXBpRXhlY3V0aW9uTW9kZSBmcm9tICcuLi9zZWxlY3Rvci1hcGktZXhlY3V0aW9uLW1vZGUnO1xuXG5jb25zdCBWSVNJQkxFX1BST1BfTkFNRSAgICAgICA9ICd2aXNpYmxlJztcbmNvbnN0IFNOQVBTSE9UX1BST1BfUFJJTUlUSVZFID0gYFtvYmplY3QgJHtSZUV4ZWN1dGFibGVQcm9taXNlLm5hbWV9XWA7XG5cbmNvbnN0IGZpbHRlck5vZGVzID0gbmV3IENsaWVudEZ1bmN0aW9uQnVpbGRlcigobm9kZXMsIGZpbHRlciwgcXVlcnlTZWxlY3RvclJvb3QsIG9yaWdpbk5vZGUsIC4uLmZpbHRlckFyZ3MpID0+IHtcbiAgICBpZiAodHlwZW9mIGZpbHRlciA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgY29uc3QgbWF0Y2hpbmdOb2RlID0gZmlsdGVyIDwgMCA/IG5vZGVzW25vZGVzLmxlbmd0aCArIGZpbHRlcl0gOiBub2Rlc1tmaWx0ZXJdO1xuXG4gICAgICAgIHJldHVybiBtYXRjaGluZ05vZGUgPyBbbWF0Y2hpbmdOb2RlXSA6IFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIE5PVEU6IHdlIGNhbiBzZWFyY2ggZm9yIGVsZW1lbnRzIG9ubHkgaW4gZG9jdW1lbnQvZWxlbWVudC9zaGFkb3cgcm9vdC5cbiAgICAgICAgaWYgKHF1ZXJ5U2VsZWN0b3JSb290Lm5vZGVUeXBlICE9PSAxICYmIHF1ZXJ5U2VsZWN0b3JSb290Lm5vZGVUeXBlICE9PSA5ICYmIHF1ZXJ5U2VsZWN0b3JSb290Lm5vZGVUeXBlICE9PSAxMSlcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIGNvbnN0IG1hdGNoaW5nICAgID0gcXVlcnlTZWxlY3RvclJvb3QucXVlcnlTZWxlY3RvckFsbChmaWx0ZXIpO1xuICAgICAgICBjb25zdCBtYXRjaGluZ0FyciA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF0Y2hpbmcubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICBtYXRjaGluZ0Fyci5wdXNoKG1hdGNoaW5nW2ldKTtcblxuICAgICAgICBmaWx0ZXIgPSBub2RlID0+IG1hdGNoaW5nQXJyLmluZGV4T2Yobm9kZSkgPiAtMTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGZpbHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG5vZGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAoZmlsdGVyKG5vZGVzW2pdLCBqLCBvcmlnaW5Ob2RlLCAuLi5maWx0ZXJBcmdzKSlcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChub2Rlc1tqXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufSkuZ2V0RnVuY3Rpb24oKTtcblxuY29uc3QgZXhwYW5kU2VsZWN0b3JSZXN1bHRzID0gbmV3IENsaWVudEZ1bmN0aW9uQnVpbGRlcigoc2VsZWN0b3IsIHBvcHVsYXRlRGVyaXZhdGl2ZU5vZGVzKSA9PiB7XG4gICAgY29uc3Qgbm9kZXMgPSBzZWxlY3RvcigpO1xuXG4gICAgaWYgKCFub2Rlcy5sZW5ndGgpXG4gICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGRlcml2YXRpdmVOb2RlcyA9IHBvcHVsYXRlRGVyaXZhdGl2ZU5vZGVzKG5vZGVzW2ldKTtcblxuICAgICAgICBpZiAoZGVyaXZhdGl2ZU5vZGVzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGRlcml2YXRpdmVOb2Rlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuaW5kZXhPZihkZXJpdmF0aXZlTm9kZXNbal0pIDwgMClcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goZGVyaXZhdGl2ZU5vZGVzW2pdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG5cbn0pLmdldEZ1bmN0aW9uKCk7XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFNuYXBzaG90IChnZXRTZWxlY3RvciwgY2FsbHNpdGUsIFNlbGVjdG9yQnVpbGRlciwgZ2V0VmlzaWJsZVZhbHVlTW9kZSkge1xuICAgIGxldCBub2RlICAgICAgID0gbnVsbDtcbiAgICBjb25zdCBzZWxlY3RvciA9IG5ldyBTZWxlY3RvckJ1aWxkZXIoZ2V0U2VsZWN0b3IoKSwgeyBnZXRWaXNpYmxlVmFsdWVNb2RlLCBuZWVkRXJyb3I6IHRydWUgfSwgeyBpbnN0YW50aWF0aW9uOiAnU2VsZWN0b3InIH0sIGNhbGxzaXRlKS5nZXRGdW5jdGlvbigpO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgbm9kZSA9IGF3YWl0IHNlbGVjdG9yKCk7XG4gICAgfVxuXG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgICBlcnIuY2FsbHNpdGUgPSBjYWxsc2l0ZTtcblxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGU7XG59XG5cbmZ1bmN0aW9uIGdldFNuYXBzaG90U3luYyAoZ2V0U2VsZWN0b3IsIGNhbGxzaXRlLCBTZWxlY3RvckJ1aWxkZXIsIGdldFZpc2libGVWYWx1ZU1vZGUpIHtcbiAgICBsZXQgbm9kZSAgICAgICA9IG51bGw7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSBuZXcgU2VsZWN0b3JCdWlsZGVyKGdldFNlbGVjdG9yKCksIHsgZ2V0VmlzaWJsZVZhbHVlTW9kZSwgbmVlZEVycm9yOiB0cnVlIH0sIHsgaW5zdGFudGlhdGlvbjogJ1NlbGVjdG9yJyB9LCBjYWxsc2l0ZSkuZ2V0RnVuY3Rpb24oKTtcblxuICAgIHRyeSB7XG4gICAgICAgIG5vZGUgPSBzZWxlY3RvcigpO1xuICAgIH1cblxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgZXJyLmNhbGxzaXRlID0gY2FsbHNpdGU7XG5cbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH1cblxuICAgIHJldHVybiBub2RlO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRBZGRDdXN0b21ET01Qcm9wZXJ0aWVzT3B0aW9ucyAocHJvcGVydGllcykge1xuICAgIGFzc2VydFR5cGUoaXMubm9uTnVsbE9iamVjdCwgJ2FkZEN1c3RvbURPTVByb3BlcnRpZXMnLCAnVGhlIFwiYWRkQ3VzdG9tRE9NUHJvcGVydGllc1wiIG9wdGlvbicsIHByb3BlcnRpZXMpO1xuXG4gICAgT2JqZWN0LmtleXMocHJvcGVydGllcykuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgICAgYXNzZXJ0VHlwZShpcy5mdW5jdGlvbiwgJ2FkZEN1c3RvbURPTVByb3BlcnRpZXMnLCBgVGhlIGN1c3RvbSBET00gcHJvcGVydGllcyBtZXRob2QgJyR7cHJvcH0nYCwgcHJvcGVydGllc1twcm9wXSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGFzc2VydEFkZEN1c3RvbU1ldGhvZHMgKHByb3BlcnRpZXMsIG9wdHMpIHtcbiAgICBhc3NlcnRUeXBlKGlzLm5vbk51bGxPYmplY3QsICdhZGRDdXN0b21NZXRob2RzJywgJ1RoZSBcImFkZEN1c3RvbU1ldGhvZHNcIiBvcHRpb24nLCBwcm9wZXJ0aWVzKTtcblxuICAgIGlmIChvcHRzICE9PSB2b2lkIDApXG4gICAgICAgIGFzc2VydFR5cGUoaXMubm9uTnVsbE9iamVjdCwgJ2FkZEN1c3RvbU1ldGhvZHMnLCAnVGhlIFwiYWRkQ3VzdG9tTWV0aG9kc1wiIG9wdGlvbicsIG9wdHMpO1xuXG4gICAgT2JqZWN0LmtleXMocHJvcGVydGllcykuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgICAgYXNzZXJ0VHlwZShpcy5mdW5jdGlvbiwgJ2FkZEN1c3RvbU1ldGhvZHMnLCBgVGhlIGN1c3RvbSBtZXRob2QgJyR7cHJvcH0nYCwgcHJvcGVydGllc1twcm9wXSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGdldERlcml2YXRpdmVTZWxlY3RvckFyZ3MgKG9wdGlvbnMsIHNlbGVjdG9yRm4sIGFwaUZuLCBmaWx0ZXIsIGFkZGl0aW9uYWxEZXBlbmRlbmNpZXMpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywgeyBzZWxlY3RvckZuLCBhcGlGbiwgZmlsdGVyLCBhZGRpdGlvbmFsRGVwZW5kZW5jaWVzIH0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQcmltaXRpdmVHZXR0ZXJXcmFwcGVyIChvYnNlcnZlZENhbGxzaXRlcywgY2FsbHNpdGUpIHtcbiAgICByZXR1cm4gKGRlcHRoLCBvcHRpb25zKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzVGVzdENhZmVJbnNwZWN0ID0gb3B0aW9ucz8uaXNUZXN0Q2FmZUluc3BlY3Q7XG5cbiAgICAgICAgaWYgKG9ic2VydmVkQ2FsbHNpdGVzICYmICFpc1Rlc3RDYWZlSW5zcGVjdClcbiAgICAgICAgICAgIG9ic2VydmVkQ2FsbHNpdGVzLnVuYXdhaXRlZFNuYXBzaG90Q2FsbHNpdGVzLmFkZChjYWxsc2l0ZSk7XG5cbiAgICAgICAgcmV0dXJuIFNOQVBTSE9UX1BST1BfUFJJTUlUSVZFO1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIGNoZWNrRm9yRXhjZXNzaXZlQXdhaXRzIChzbmFwc2hvdFByb3BlcnR5Q2FsbHNpdGVzLCBjaGVja2VkQ2FsbHNpdGUpIHtcbiAgICBjb25zdCBjYWxsc2l0ZUlkID0gZ2V0Q2FsbHNpdGVJZChjaGVja2VkQ2FsbHNpdGUpO1xuXG4gICAgLy8gTk9URTogSWYgdGhlcmUgaXMgYW4gYXNzZXJ0ZWQgY2FsbHNpdGUsIGl0IG1lYW5zIHRoYXQgLmV4cGVjdCgpIHdhcyBhbHJlYWR5IGNhbGxlZC5cbiAgICAvLyBXZSBkb24ndCByYWlzZSBhIHdhcm5pbmcgYW5kIGRlbGV0ZSB0aGUgY2FsbHNpdGUuXG4gICAgaWYgKHNuYXBzaG90UHJvcGVydHlDYWxsc2l0ZXNbY2FsbHNpdGVJZF0gJiYgc25hcHNob3RQcm9wZXJ0eUNhbGxzaXRlc1tjYWxsc2l0ZUlkXS5jaGVja2VkKVxuICAgICAgICBkZWxldGUgc25hcHNob3RQcm9wZXJ0eUNhbGxzaXRlc1tjYWxsc2l0ZUlkXTtcbiAgICAvLyBOT1RFOiBJZiB0aGUgY2FsbGlzdGUgYWxyZWFkeSBleGlzdHMsIGJ1dCBpcyBub3QgYXNzZXJ0ZWQsIGl0IG1lYW5zIHRoYXQgdGhlcmUgYXJlXG4gICAgLy8gbXVsdGlwbGUgYXdhaXRlZCBjYWxsc2l0ZXMgaW4gb25lIGFzc2VydGlvbi4gV2UgcmFpc2UgYSB3YXJuaW5nIGZvciBlYWNoIG9mIHRoZW0uXG4gICAgZWxzZSBpZiAoc25hcHNob3RQcm9wZXJ0eUNhbGxzaXRlc1tjYWxsc2l0ZUlkXSAmJiAhc25hcHNob3RQcm9wZXJ0eUNhbGxzaXRlc1tjYWxsc2l0ZUlkXS5jaGVja2VkKVxuICAgICAgICBzbmFwc2hvdFByb3BlcnR5Q2FsbHNpdGVzW2NhbGxzaXRlSWRdLmNhbGxzaXRlcy5wdXNoKGNoZWNrZWRDYWxsc2l0ZSk7XG4gICAgZWxzZVxuICAgICAgICBzbmFwc2hvdFByb3BlcnR5Q2FsbHNpdGVzW2NhbGxzaXRlSWRdID0geyBjYWxsc2l0ZXM6IFsgY2hlY2tlZENhbGxzaXRlIF0sIGNoZWNrZWQ6IGZhbHNlIH07XG59XG5cbmZ1bmN0aW9uIGFkZFNuYXBzaG90UHJvcGVydGllcyAob2JqLCBnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyLCBwcm9wZXJ0aWVzLCBvYnNlcnZlZENhbGxzaXRlcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChwcm9wID0+IHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgcHJvcCwge1xuICAgICAgICAgICAgZ2V0OiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FsbHNpdGUgPSBnZXRDYWxsc2l0ZUZvck1ldGhvZCgnZ2V0Jyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0b3JBcGlFeGVjdXRpb25Nb2RlLmlzU3luYylcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldFNuYXBzaG90U3luYyhnZXRTZWxlY3RvciwgY2FsbHNpdGUsIFNlbGVjdG9yQnVpbGRlcilbcHJvcF07XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwcm9wZXJ0eVByb21pc2UgPSBSZUV4ZWN1dGFibGVQcm9taXNlLmZyb21Gbihhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgZ2V0U25hcHNob3QoZ2V0U2VsZWN0b3IsIGNhbGxzaXRlLCBTZWxlY3RvckJ1aWxkZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzbmFwc2hvdFtwcm9wXTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZUdldHRlcldyYXBwZXIgPSBjcmVhdGVQcmltaXRpdmVHZXR0ZXJXcmFwcGVyKG9ic2VydmVkQ2FsbHNpdGVzLCBjYWxsc2l0ZSk7XG5cbiAgICAgICAgICAgICAgICBwcm9wZXJ0eVByb21pc2VbU3ltYm9sLnRvUHJpbWl0aXZlXSA9IHByaW1pdGl2ZUdldHRlcldyYXBwZXI7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlQcm9taXNlW2luc3BlY3QuY3VzdG9tXSAgICAgPSBwcmltaXRpdmVHZXR0ZXJXcmFwcGVyO1xuXG4gICAgICAgICAgICAgICAgcHJvcGVydHlQcm9taXNlLnRoZW4gPSBmdW5jdGlvbiAob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9ic2VydmVkQ2FsbHNpdGVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tGb3JFeGNlc3NpdmVBd2FpdHMob2JzZXJ2ZWRDYWxsc2l0ZXMuc25hcHNob3RQcm9wZXJ0eUNhbGxzaXRlcywgY2FsbHNpdGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2Vuc3VyZUV4ZWN1dGluZygpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl90YXNrUHJvbWlzZS50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHByb3BlcnR5UHJvbWlzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBhZGRWaXNpYmxlUHJvcGVydHkgKHsgb2JqLCBnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyIH0pIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBWSVNJQkxFX1BST1BfTkFNRSwge1xuICAgICAgICBnZXQ6ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNhbGxzaXRlID0gZ2V0Q2FsbHNpdGVGb3JNZXRob2QoJ2dldCcpO1xuXG4gICAgICAgICAgICBpZiAoc2VsZWN0b3JBcGlFeGVjdXRpb25Nb2RlLmlzU3luYykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNuYXBzaG90ID0gZ2V0U25hcHNob3RTeW5jKGdldFNlbGVjdG9yLCBjYWxsc2l0ZSwgU2VsZWN0b3JCdWlsZGVyLCB0cnVlKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiAhIXNuYXBzaG90ICYmIHNuYXBzaG90W1ZJU0lCTEVfUFJPUF9OQU1FXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIFJlRXhlY3V0YWJsZVByb21pc2UuZnJvbUZuKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzbmFwc2hvdCA9IGF3YWl0IGdldFNuYXBzaG90KGdldFNlbGVjdG9yLCBjYWxsc2l0ZSwgU2VsZWN0b3JCdWlsZGVyLCB0cnVlKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiAhIXNuYXBzaG90ICYmIHNuYXBzaG90W1ZJU0lCTEVfUFJPUF9OQU1FXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkQ3VzdG9tTWV0aG9kcyAob2JqLCBnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyLCBjdXN0b21NZXRob2RzKSB7XG4gICAgY29uc3QgY3VzdG9tTWV0aG9kUHJvcHMgPSBjdXN0b21NZXRob2RzID8gT2JqZWN0LmtleXMoY3VzdG9tTWV0aG9kcykgOiBbXTtcblxuICAgIGN1c3RvbU1ldGhvZFByb3BzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICAgIGNvbnN0IHsgcmV0dXJuRE9NTm9kZXMgPSBmYWxzZSwgbWV0aG9kIH0gPSBjdXN0b21NZXRob2RzW3Byb3BdO1xuXG4gICAgICAgIGNvbnN0IGRlcGVuZGVuY2llcyA9IHtcbiAgICAgICAgICAgIGN1c3RvbU1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgc2VsZWN0b3I6ICAgICBnZXRTZWxlY3RvcigpLFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGNhbGxzaXRlTmFtZXMgPSB7IGluc3RhbnRpYXRpb246IHByb3AgfTtcblxuICAgICAgICBpZiAocmV0dXJuRE9NTm9kZXMpIHtcbiAgICAgICAgICAgIG9ialtwcm9wXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0b3JGbiA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW5kZWYgKi9cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZXMgPSBzZWxlY3RvcigpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXN0b21NZXRob2QuYXBwbHkoY3VzdG9tTWV0aG9kLCBbbm9kZXNdLmNvbmNhdChhcmdzKSk7XG4gICAgICAgICAgICAgICAgICAgIC8qIGVzbGludC1lbmFibGUgbm8tdW5kZWYgKi9cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYXBpRm4gPSBwcmVwYXJlQXBpRm5BcmdzKHByb3AsIC4uLmFyZ3MpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbHRlciA9ICgpID0+IHRydWU7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBhZGRpdGlvbmFsRGVwZW5kZW5jaWVzID0ge1xuICAgICAgICAgICAgICAgICAgICBhcmdzLFxuICAgICAgICAgICAgICAgICAgICBjdXN0b21NZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZURlcml2YXRpdmVTZWxlY3RvcldpdGhGaWx0ZXIoeyBnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyLCBzZWxlY3RvckZuLCBhcGlGbiwgZmlsdGVyLCBhZGRpdGlvbmFsRGVwZW5kZW5jaWVzIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG9ialtwcm9wXSA9IG5ldyBDbGllbnRGdW5jdGlvbkJ1aWxkZXIoKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmRlZiAqL1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzZWxlY3RvcigpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1c3RvbU1ldGhvZC5hcHBseShjdXN0b21NZXRob2QsIFtub2RlXS5jb25jYXQoYXJncykpO1xuICAgICAgICAgICAgICAgIC8qIGVzbGludC1lbmFibGUgbm8tdW5kZWYgKi9cbiAgICAgICAgICAgIH0sIHsgZGVwZW5kZW5jaWVzIH0sIGNhbGxzaXRlTmFtZXMpLmdldEZ1bmN0aW9uKCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVNuYXBzaG90UHJvcGVydHlMaXN0IChjdXN0b21ET01Qcm9wZXJ0aWVzKSB7XG4gICAgbGV0IHByb3BlcnRpZXMgPSBbLi4uU05BUFNIT1RfUFJPUEVSVElFU107XG5cbiAgICAvLyBOT1RFOiBUaGUgJ3Zpc2libGUnIHNuYXBzaG90IHByb3BlcnR5IGhhcyBhIHNlcGFyYXRlIGhhbmRsZXIuXG4gICAgcmVtb3ZlKHByb3BlcnRpZXMsIFZJU0lCTEVfUFJPUF9OQU1FKTtcblxuICAgIGlmIChjdXN0b21ET01Qcm9wZXJ0aWVzKVxuICAgICAgICBwcm9wZXJ0aWVzID0gcHJvcGVydGllcy5jb25jYXQoT2JqZWN0LmtleXMoY3VzdG9tRE9NUHJvcGVydGllcykpO1xuXG4gICAgcmV0dXJuIHByb3BlcnRpZXM7XG59XG5cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZVZhbHVlIChhdHRyaWJ1dGVzLCBhdHRyTmFtZSkge1xuICAgIGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoYXR0ck5hbWUpKVxuICAgICAgICByZXR1cm4gYXR0cmlidXRlc1thdHRyTmFtZV07XG5cbiAgICAvLyBOT1RFOiBodHRwczovL2RvbS5zcGVjLndoYXR3Zy5vcmcvI2RvbS1lbGVtZW50LWdldGF0dHJpYnV0ZSAobnVsbCByZXN1bHQgZm9yIG5vbmV4aXN0ZW50IGF0dHJpYnV0ZXMpXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGFkZFNuYXBzaG90UHJvcGVydHlTaG9ydGhhbmRzICh7IG9iaiwgZ2V0U2VsZWN0b3IsIFNlbGVjdG9yQnVpbGRlciwgY3VzdG9tRE9NUHJvcGVydGllcywgY3VzdG9tTWV0aG9kcywgb2JzZXJ2ZWRDYWxsc2l0ZXMgfSkge1xuICAgIGNvbnN0IHByb3BlcnRpZXMgPSBwcmVwYXJlU25hcHNob3RQcm9wZXJ0eUxpc3QoY3VzdG9tRE9NUHJvcGVydGllcyk7XG5cbiAgICBhZGRTbmFwc2hvdFByb3BlcnRpZXMob2JqLCBnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyLCBwcm9wZXJ0aWVzLCBvYnNlcnZlZENhbGxzaXRlcyk7XG4gICAgYWRkQ3VzdG9tTWV0aG9kcyhvYmosIGdldFNlbGVjdG9yLCBTZWxlY3RvckJ1aWxkZXIsIGN1c3RvbU1ldGhvZHMpO1xuXG4gICAgb2JqLmdldFN0eWxlUHJvcGVydHkgPSBwcm9wID0+IHtcbiAgICAgICAgY29uc3QgY2FsbHNpdGUgPSBnZXRDYWxsc2l0ZUZvck1ldGhvZCgnZ2V0U3R5bGVQcm9wZXJ0eScpO1xuXG4gICAgICAgIGlmIChzZWxlY3RvckFwaUV4ZWN1dGlvbk1vZGUuaXNTeW5jKSB7XG4gICAgICAgICAgICBjb25zdCBzbmFwc2hvdCA9IGdldFNuYXBzaG90U3luYyhnZXRTZWxlY3RvciwgY2FsbHNpdGUsIFNlbGVjdG9yQnVpbGRlcik7XG5cbiAgICAgICAgICAgIHJldHVybiBzbmFwc2hvdC5zdHlsZSA/IHNuYXBzaG90LnN0eWxlW3Byb3BdIDogdm9pZCAwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFJlRXhlY3V0YWJsZVByb21pc2UuZnJvbUZuKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgZ2V0U25hcHNob3QoZ2V0U2VsZWN0b3IsIGNhbGxzaXRlLCBTZWxlY3RvckJ1aWxkZXIpO1xuXG4gICAgICAgICAgICByZXR1cm4gc25hcHNob3Quc3R5bGUgPyBzbmFwc2hvdC5zdHlsZVtwcm9wXSA6IHZvaWQgMDtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIG9iai5nZXRBdHRyaWJ1dGUgPSBhdHRyTmFtZSA9PiB7XG4gICAgICAgIGNvbnN0IGNhbGxzaXRlID0gZ2V0Q2FsbHNpdGVGb3JNZXRob2QoJ2dldEF0dHJpYnV0ZScpO1xuXG4gICAgICAgIGlmIChzZWxlY3RvckFwaUV4ZWN1dGlvbk1vZGUuaXNTeW5jKSB7XG4gICAgICAgICAgICBjb25zdCBzbmFwc2hvdCA9IGdldFNuYXBzaG90U3luYyhnZXRTZWxlY3RvciwgY2FsbHNpdGUsIFNlbGVjdG9yQnVpbGRlcik7XG5cbiAgICAgICAgICAgIHJldHVybiBnZXRBdHRyaWJ1dGVWYWx1ZShzbmFwc2hvdC5hdHRyaWJ1dGVzLCBhdHRyTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gUmVFeGVjdXRhYmxlUHJvbWlzZS5mcm9tRm4oYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc25hcHNob3QgPSBhd2FpdCBnZXRTbmFwc2hvdChnZXRTZWxlY3RvciwgY2FsbHNpdGUsIFNlbGVjdG9yQnVpbGRlcik7XG5cbiAgICAgICAgICAgIHJldHVybiBnZXRBdHRyaWJ1dGVWYWx1ZShzbmFwc2hvdC5hdHRyaWJ1dGVzLCBhdHRyTmFtZSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBvYmouaGFzQXR0cmlidXRlID0gYXR0ck5hbWUgPT4ge1xuICAgICAgICBjb25zdCBjYWxsc2l0ZSA9IGdldENhbGxzaXRlRm9yTWV0aG9kKCdoYXNBdHRyaWJ1dGUnKTtcblxuICAgICAgICBpZiAoc2VsZWN0b3JBcGlFeGVjdXRpb25Nb2RlLmlzU3luYykge1xuICAgICAgICAgICAgY29uc3Qgc25hcHNob3QgPSBnZXRTbmFwc2hvdFN5bmMoZ2V0U2VsZWN0b3IsIGNhbGxzaXRlLCBTZWxlY3RvckJ1aWxkZXIpO1xuXG4gICAgICAgICAgICByZXR1cm4gc25hcHNob3QuYXR0cmlidXRlcyA/IHNuYXBzaG90LmF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoYXR0ck5hbWUpIDogZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gUmVFeGVjdXRhYmxlUHJvbWlzZS5mcm9tRm4oYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc25hcHNob3QgPSBhd2FpdCBnZXRTbmFwc2hvdChnZXRTZWxlY3RvciwgY2FsbHNpdGUsIFNlbGVjdG9yQnVpbGRlcik7XG5cbiAgICAgICAgICAgIHJldHVybiBzbmFwc2hvdC5hdHRyaWJ1dGVzID8gc25hcHNob3QuYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyTmFtZSkgOiBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIG9iai5nZXRCb3VuZGluZ0NsaWVudFJlY3RQcm9wZXJ0eSA9IHByb3AgPT4ge1xuICAgICAgICBjb25zdCBjYWxsc2l0ZSA9IGdldENhbGxzaXRlRm9yTWV0aG9kKCdnZXRCb3VuZGluZ0NsaWVudFJlY3RQcm9wZXJ0eScpO1xuXG4gICAgICAgIGlmIChzZWxlY3RvckFwaUV4ZWN1dGlvbk1vZGUuaXNTeW5jKSB7XG4gICAgICAgICAgICBjb25zdCBzbmFwc2hvdCA9IGdldFNuYXBzaG90U3luYyhnZXRTZWxlY3RvciwgY2FsbHNpdGUsIFNlbGVjdG9yQnVpbGRlcik7XG5cbiAgICAgICAgICAgIHJldHVybiBzbmFwc2hvdC5ib3VuZGluZ0NsaWVudFJlY3QgPyBzbmFwc2hvdC5ib3VuZGluZ0NsaWVudFJlY3RbcHJvcF0gOiB2b2lkIDA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gUmVFeGVjdXRhYmxlUHJvbWlzZS5mcm9tRm4oYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc25hcHNob3QgPSBhd2FpdCBnZXRTbmFwc2hvdChnZXRTZWxlY3RvciwgY2FsbHNpdGUsIFNlbGVjdG9yQnVpbGRlcik7XG5cbiAgICAgICAgICAgIHJldHVybiBzbmFwc2hvdC5ib3VuZGluZ0NsaWVudFJlY3QgPyBzbmFwc2hvdC5ib3VuZGluZ0NsaWVudFJlY3RbcHJvcF0gOiB2b2lkIDA7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBvYmouaGFzQ2xhc3MgPSBuYW1lID0+IHtcbiAgICAgICAgY29uc3QgY2FsbHNpdGUgPSBnZXRDYWxsc2l0ZUZvck1ldGhvZCgnaGFzQ2xhc3MnKTtcblxuICAgICAgICBpZiAoc2VsZWN0b3JBcGlFeGVjdXRpb25Nb2RlLmlzU3luYykge1xuICAgICAgICAgICAgY29uc3Qgc25hcHNob3QgPSBnZXRTbmFwc2hvdFN5bmMoZ2V0U2VsZWN0b3IsIGNhbGxzaXRlLCBTZWxlY3RvckJ1aWxkZXIpO1xuXG4gICAgICAgICAgICByZXR1cm4gc25hcHNob3QuY2xhc3NOYW1lcyA/IHNuYXBzaG90LmNsYXNzTmFtZXMuaW5jbHVkZXMobmFtZSkgOiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBSZUV4ZWN1dGFibGVQcm9taXNlLmZyb21Gbihhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzbmFwc2hvdCA9IGF3YWl0IGdldFNuYXBzaG90KGdldFNlbGVjdG9yLCBjYWxsc2l0ZSwgU2VsZWN0b3JCdWlsZGVyKTtcblxuICAgICAgICAgICAgcmV0dXJuIHNuYXBzaG90LmNsYXNzTmFtZXMgPyBzbmFwc2hvdC5jbGFzc05hbWVzLmluY2x1ZGVzKG5hbWUpIDogZmFsc2U7XG4gICAgICAgIH0pO1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvdW50ZXIgKGdldFNlbGVjdG9yLCBTZWxlY3RvckJ1aWxkZXIpIHtcbiAgICBjb25zdCBidWlsZGVyICA9IG5ldyBTZWxlY3RvckJ1aWxkZXIoZ2V0U2VsZWN0b3IoKSwgeyBjb3VudGVyTW9kZTogdHJ1ZSB9LCB7IGluc3RhbnRpYXRpb246ICdTZWxlY3RvcicgfSk7XG4gICAgY29uc3QgY291bnRlciAgPSBidWlsZGVyLmdldEZ1bmN0aW9uKCk7XG4gICAgY29uc3QgY2FsbHNpdGUgPSBnZXRDYWxsc2l0ZUZvck1ldGhvZCgnZ2V0Jyk7XG5cbiAgICByZXR1cm4gYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGNvdW50ZXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGVyci5jYWxsc2l0ZSA9IGNhbGxzaXRlO1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ291bnRlclN5bmMgKGdldFNlbGVjdG9yLCBTZWxlY3RvckJ1aWxkZXIpIHtcbiAgICBjb25zdCBidWlsZGVyICA9IG5ldyBTZWxlY3RvckJ1aWxkZXIoZ2V0U2VsZWN0b3IoKSwgeyBjb3VudGVyTW9kZTogdHJ1ZSB9LCB7IGluc3RhbnRpYXRpb246ICdTZWxlY3RvcicgfSk7XG4gICAgY29uc3QgY291bnRlciAgPSBidWlsZGVyLmdldEZ1bmN0aW9uKCk7XG4gICAgY29uc3QgY2FsbHNpdGUgPSBnZXRDYWxsc2l0ZUZvck1ldGhvZCgnZ2V0Jyk7XG5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGNvdW50ZXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGVyci5jYWxsc2l0ZSA9IGNhbGxzaXRlO1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gYWRkQ291bnRlclByb3BlcnRpZXMgKHsgb2JqLCBnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyIH0pIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCAnY291bnQnLCB7XG4gICAgICAgIGdldDogKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHNlbGVjdG9yQXBpRXhlY3V0aW9uTW9kZS5pc1N5bmMpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUNvdW50ZXJTeW5jKGdldFNlbGVjdG9yLCBTZWxlY3RvckJ1aWxkZXIpKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGNvdW50ZXIgPSBjcmVhdGVDb3VudGVyKGdldFNlbGVjdG9yLCBTZWxlY3RvckJ1aWxkZXIpO1xuXG4gICAgICAgICAgICByZXR1cm4gUmVFeGVjdXRhYmxlUHJvbWlzZS5mcm9tRm4oKCkgPT4gY291bnRlcigpKTtcbiAgICAgICAgfSxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdleGlzdHMnLCB7XG4gICAgICAgIGdldDogKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHNlbGVjdG9yQXBpRXhlY3V0aW9uTW9kZS5pc1N5bmMpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZUNvdW50ZXJTeW5jKGdldFNlbGVjdG9yLCBTZWxlY3RvckJ1aWxkZXIpKCkgPiAwO1xuXG4gICAgICAgICAgICBjb25zdCBjb3VudGVyID0gY3JlYXRlQ291bnRlcihnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyKTtcblxuICAgICAgICAgICAgcmV0dXJuIFJlRXhlY3V0YWJsZVByb21pc2UuZnJvbUZuKGFzeW5jICgpID0+IGF3YWl0IGNvdW50ZXIoKSA+IDApO1xuICAgICAgICB9LFxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RmlsdGVyVG9DbGllbnRGdW5jdGlvbklmTmVjZXNzYXJ5IChjYWxsc2l0ZU5hbWUsIGZpbHRlciwgZGVwZW5kZW5jaWVzKSB7XG4gICAgaWYgKHR5cGVvZiBmaWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY29uc3QgYnVpbGRlciA9IGZpbHRlcltjbGllbnRGdW5jdGlvbkJ1aWxkZXJTeW1ib2xdO1xuICAgICAgICBjb25zdCBmbiAgICAgID0gYnVpbGRlciA/IGJ1aWxkZXIuZm4gOiBmaWx0ZXI7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyID8gYXNzaWduKHt9LCBidWlsZGVyLm9wdGlvbnMsIHsgZGVwZW5kZW5jaWVzIH0pIDogeyBkZXBlbmRlbmNpZXMgfTtcblxuICAgICAgICByZXR1cm4gbmV3IENsaWVudEZ1bmN0aW9uQnVpbGRlcihmbiwgb3B0aW9ucywgeyBpbnN0YW50aWF0aW9uOiBjYWxsc2l0ZU5hbWUgfSkuZ2V0RnVuY3Rpb24oKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmlsdGVyO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVEZXJpdmF0aXZlU2VsZWN0b3JXaXRoRmlsdGVyICh7IGdldFNlbGVjdG9yLCBTZWxlY3RvckJ1aWxkZXIsIHNlbGVjdG9yRm4sIGFwaUZuLCBmaWx0ZXIsIGFkZGl0aW9uYWxEZXBlbmRlbmNpZXMgfSkge1xuICAgIGNvbnN0IGNvbGxlY3Rpb25Nb2RlU2VsZWN0b3JCdWlsZGVyID0gbmV3IFNlbGVjdG9yQnVpbGRlcihnZXRTZWxlY3RvcigpLCB7IGNvbGxlY3Rpb25Nb2RlOiB0cnVlIH0pO1xuICAgIGNvbnN0IGN1c3RvbURPTVByb3BlcnRpZXMgICAgICAgICAgID0gY29sbGVjdGlvbk1vZGVTZWxlY3RvckJ1aWxkZXIub3B0aW9ucy5jdXN0b21ET01Qcm9wZXJ0aWVzO1xuICAgIGNvbnN0IGN1c3RvbU1ldGhvZHMgICAgICAgICAgICAgICAgID0gY29sbGVjdGlvbk1vZGVTZWxlY3RvckJ1aWxkZXIub3B0aW9ucy5jdXN0b21NZXRob2RzO1xuXG4gICAgbGV0IGRlcGVuZGVuY2llcyA9IHtcbiAgICAgICAgc2VsZWN0b3I6ICAgIGNvbGxlY3Rpb25Nb2RlU2VsZWN0b3JCdWlsZGVyLmdldEZ1bmN0aW9uKCksXG4gICAgICAgIGZpbHRlcjogICAgICBmaWx0ZXIsXG4gICAgICAgIGZpbHRlck5vZGVzOiBmaWx0ZXJOb2RlcyxcbiAgICB9O1xuXG4gICAgY29uc3QgeyBib3VuZFRlc3RSdW4sIHRpbWVvdXQsIHZpc2liaWxpdHlDaGVjaywgYXBpRm5DaGFpbiB9ID0gY29sbGVjdGlvbk1vZGVTZWxlY3RvckJ1aWxkZXIub3B0aW9ucztcblxuICAgIGRlcGVuZGVuY2llcyA9IGFzc2lnbihkZXBlbmRlbmNpZXMsIGFkZGl0aW9uYWxEZXBlbmRlbmNpZXMpO1xuXG4gICAgY29uc3QgYnVpbGRlciA9IG5ldyBTZWxlY3RvckJ1aWxkZXIoc2VsZWN0b3JGbiwge1xuICAgICAgICBkZXBlbmRlbmNpZXMsXG4gICAgICAgIGN1c3RvbURPTVByb3BlcnRpZXMsXG4gICAgICAgIGN1c3RvbU1ldGhvZHMsXG4gICAgICAgIGJvdW5kVGVzdFJ1bixcbiAgICAgICAgdGltZW91dCxcbiAgICAgICAgdmlzaWJpbGl0eUNoZWNrLFxuICAgICAgICBhcGlGbkNoYWluLFxuICAgICAgICBhcGlGbixcbiAgICB9LCB7IGluc3RhbnRpYXRpb246ICdTZWxlY3RvcicgfSk7XG5cbiAgICByZXR1cm4gYnVpbGRlci5nZXRGdW5jdGlvbigpO1xufVxuXG5jb25zdCBmaWx0ZXJCeVRleHQgPSBjb252ZXJ0RmlsdGVyVG9DbGllbnRGdW5jdGlvbklmTmVjZXNzYXJ5KCdmaWx0ZXInLCBzZWxlY3RvclRleHRGaWx0ZXIpO1xuY29uc3QgZmlsdGVyQnlBdHRyID0gY29udmVydEZpbHRlclRvQ2xpZW50RnVuY3Rpb25JZk5lY2Vzc2FyeSgnZmlsdGVyJywgc2VsZWN0b3JBdHRyaWJ1dGVGaWx0ZXIpO1xuXG5mdW5jdGlvbiBlbnN1cmVSZWdFeHBDb250ZXh0IChzdHIpIHtcbiAgICAvLyBOT1RFOiBpZiBhIHJlZ2V4cCBpcyBjcmVhdGVkIGluIGEgc2VwYXJhdGUgY29udGV4dCAodmlhIHRoZSAndm0nIG1vZHVsZSkgd2VcbiAgICAvLyBzaG91bGQgd3JhcCBpdCB3aXRoIG5ldyBSZWdFeHAoKSB0byBtYWtlIHRoZSBgaW5zdGFuY2VvZiBSZWdFeHBgIGNoZWNrIHN1Y2Nlc3NmdWwuXG4gICAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnICYmICEoc3RyIGluc3RhbmNlb2YgUmVnRXhwKSlcbiAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoc3RyKTtcblxuICAgIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIGFkZEZpbHRlck1ldGhvZHMgKG9wdGlvbnMpIHtcbiAgICBjb25zdCB7IG9iaiwgZ2V0U2VsZWN0b3IsIFNlbGVjdG9yQnVpbGRlciB9ID0gb3B0aW9ucztcblxuICAgIG9iai5udGggPSBpbmRleCA9PiB7XG4gICAgICAgIGFzc2VydFR5cGUoaXMubnVtYmVyLCAnbnRoJywgJ1RoZSBcImluZGV4XCIgYXJndW1lbnQnLCBpbmRleCk7XG5cbiAgICAgICAgY29uc3QgYXBpRm4gICA9IHByZXBhcmVBcGlGbkFyZ3MoJ250aCcsIGluZGV4KTtcbiAgICAgICAgY29uc3QgYnVpbGRlciA9IG5ldyBTZWxlY3RvckJ1aWxkZXIoZ2V0U2VsZWN0b3IoKSwgeyBpbmRleCwgYXBpRm4gfSwgeyBpbnN0YW50aWF0aW9uOiAnU2VsZWN0b3InIH0pO1xuXG4gICAgICAgIHJldHVybiBidWlsZGVyLmdldEZ1bmN0aW9uKCk7XG4gICAgfTtcblxuICAgIG9iai53aXRoVGV4dCA9IHRleHQgPT4ge1xuICAgICAgICBhc3NlcnRUeXBlKFtpcy5zdHJpbmcsIGlzLnJlZ0V4cF0sICd3aXRoVGV4dCcsICdUaGUgXCJ0ZXh0XCIgYXJndW1lbnQnLCB0ZXh0KTtcblxuICAgICAgICBjb25zdCBhcGlGbiA9IHByZXBhcmVBcGlGbkFyZ3MoJ3dpdGhUZXh0JywgdGV4dCk7XG5cbiAgICAgICAgdGV4dCA9IGVuc3VyZVJlZ0V4cENvbnRleHQodGV4dCk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0b3JGbiA9ICgpID0+IHtcbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVuZGVmICovXG4gICAgICAgICAgICBjb25zdCBub2RlcyA9IHNlbGVjdG9yKCk7XG5cbiAgICAgICAgICAgIGlmICghbm9kZXMubGVuZ3RoKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyTm9kZXMobm9kZXMsIGZpbHRlciwgZG9jdW1lbnQsIHZvaWQgMCwgdGV4dFJlKTtcbiAgICAgICAgICAgIC8qIGVzbGludC1lbmFibGUgbm8tdW5kZWYgKi9cbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBhcmdzID0gZ2V0RGVyaXZhdGl2ZVNlbGVjdG9yQXJncyhvcHRpb25zLCBzZWxlY3RvckZuLCBhcGlGbiwgZmlsdGVyQnlUZXh0LCB7IHRleHRSZTogbWFrZVJlZ0V4cCh0ZXh0KSB9KTtcblxuICAgICAgICByZXR1cm4gY3JlYXRlRGVyaXZhdGl2ZVNlbGVjdG9yV2l0aEZpbHRlcihhcmdzKTtcbiAgICB9O1xuXG4gICAgb2JqLndpdGhFeGFjdFRleHQgPSB0ZXh0ID0+IHtcbiAgICAgICAgYXNzZXJ0VHlwZShpcy5zdHJpbmcsICd3aXRoRXhhY3RUZXh0JywgJ1RoZSBcInRleHRcIiBhcmd1bWVudCcsIHRleHQpO1xuXG4gICAgICAgIGNvbnN0IHNlbGVjdG9yRm4gPSAoKSA9PiB7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmRlZiAqL1xuICAgICAgICAgICAgY29uc3Qgbm9kZXMgPSBzZWxlY3RvcigpO1xuXG4gICAgICAgICAgICBpZiAoIW5vZGVzLmxlbmd0aClcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgcmV0dXJuIGZpbHRlck5vZGVzKG5vZGVzLCBmaWx0ZXIsIGRvY3VtZW50LCB2b2lkIDAsIGV4YWN0VGV4dCk7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVuZGVmICovXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXBpRm4gPSBwcmVwYXJlQXBpRm5BcmdzKCd3aXRoRXhhY3RUZXh0JywgdGV4dCk7XG4gICAgICAgIGNvbnN0IGFyZ3MgID0gZ2V0RGVyaXZhdGl2ZVNlbGVjdG9yQXJncyhvcHRpb25zLCBzZWxlY3RvckZuLCBhcGlGbiwgZmlsdGVyQnlUZXh0LCB7IGV4YWN0VGV4dDogdGV4dCB9KTtcblxuICAgICAgICByZXR1cm4gY3JlYXRlRGVyaXZhdGl2ZVNlbGVjdG9yV2l0aEZpbHRlcihhcmdzKTtcbiAgICB9O1xuXG4gICAgb2JqLndpdGhBdHRyaWJ1dGUgPSAoYXR0ck5hbWUsIGF0dHJWYWx1ZSkgPT4ge1xuICAgICAgICBhc3NlcnRUeXBlKFtpcy5zdHJpbmcsIGlzLnJlZ0V4cF0sICd3aXRoQXR0cmlidXRlJywgJ1RoZSBcImF0dHJOYW1lXCIgYXJndW1lbnQnLCBhdHRyTmFtZSk7XG5cbiAgICAgICAgY29uc3QgYXBpRm4gPSBwcmVwYXJlQXBpRm5BcmdzKCd3aXRoQXR0cmlidXRlJywgYXR0ck5hbWUsIGF0dHJWYWx1ZSk7XG5cbiAgICAgICAgYXR0ck5hbWUgPSBlbnN1cmVSZWdFeHBDb250ZXh0KGF0dHJOYW1lKTtcblxuICAgICAgICBpZiAoYXR0clZhbHVlICE9PSB2b2lkIDApIHtcbiAgICAgICAgICAgIGFzc2VydFR5cGUoW2lzLnN0cmluZywgaXMucmVnRXhwXSwgJ3dpdGhBdHRyaWJ1dGUnLCAnVGhlIFwiYXR0clZhbHVlXCIgYXJndW1lbnQnLCBhdHRyVmFsdWUpO1xuICAgICAgICAgICAgYXR0clZhbHVlID0gZW5zdXJlUmVnRXhwQ29udGV4dChhdHRyVmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0b3JGbiA9ICgpID0+IHtcbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVuZGVmICovXG4gICAgICAgICAgICBjb25zdCBub2RlcyA9IHNlbGVjdG9yKCk7XG5cbiAgICAgICAgICAgIGlmICghbm9kZXMubGVuZ3RoKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyTm9kZXMobm9kZXMsIGZpbHRlciwgZG9jdW1lbnQsIHZvaWQgMCwgYXR0ck5hbWUsIGF0dHJWYWx1ZSk7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVuZGVmICovXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXJncyA9IGdldERlcml2YXRpdmVTZWxlY3RvckFyZ3Mob3B0aW9ucywgc2VsZWN0b3JGbiwgYXBpRm4sIGZpbHRlckJ5QXR0ciwge1xuICAgICAgICAgICAgYXR0ck5hbWUsXG4gICAgICAgICAgICBhdHRyVmFsdWUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBjcmVhdGVEZXJpdmF0aXZlU2VsZWN0b3JXaXRoRmlsdGVyKGFyZ3MpO1xuICAgIH07XG5cbiAgICBvYmouZmlsdGVyID0gKGZpbHRlciwgZGVwZW5kZW5jaWVzKSA9PiB7XG4gICAgICAgIGFzc2VydFR5cGUoW2lzLnN0cmluZywgaXMuZnVuY3Rpb25dLCAnZmlsdGVyJywgJ1RoZSBcImZpbHRlclwiIGFyZ3VtZW50JywgZmlsdGVyKTtcblxuICAgICAgICBjb25zdCBhcGlGbiA9IHByZXBhcmVBcGlGbkFyZ3MoJ2ZpbHRlcicsIGZpbHRlcik7XG5cbiAgICAgICAgZmlsdGVyID0gY29udmVydEZpbHRlclRvQ2xpZW50RnVuY3Rpb25JZk5lY2Vzc2FyeSgnZmlsdGVyJywgZmlsdGVyLCBkZXBlbmRlbmNpZXMpO1xuXG4gICAgICAgIGNvbnN0IHNlbGVjdG9yRm4gPSAoKSA9PiB7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmRlZiAqL1xuICAgICAgICAgICAgY29uc3Qgbm9kZXMgPSBzZWxlY3RvcigpO1xuXG4gICAgICAgICAgICBpZiAoIW5vZGVzLmxlbmd0aClcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgcmV0dXJuIGZpbHRlck5vZGVzKG5vZGVzLCBmaWx0ZXIsIGRvY3VtZW50LCB2b2lkIDApO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby11bmRlZiAqL1xuICAgICAgICB9O1xuXG5cbiAgICAgICAgY29uc3QgYXJncyA9IGdldERlcml2YXRpdmVTZWxlY3RvckFyZ3Mob3B0aW9ucywgc2VsZWN0b3JGbiwgYXBpRm4sIGZpbHRlcik7XG5cbiAgICAgICAgcmV0dXJuIGNyZWF0ZURlcml2YXRpdmVTZWxlY3RvcldpdGhGaWx0ZXIoYXJncyk7XG4gICAgfTtcblxuICAgIG9iai5maWx0ZXJWaXNpYmxlID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBhcGlGbiAgID0gcHJlcGFyZUFwaUZuQXJncygnZmlsdGVyVmlzaWJsZScpO1xuICAgICAgICBjb25zdCBidWlsZGVyID0gbmV3IFNlbGVjdG9yQnVpbGRlcihnZXRTZWxlY3RvcigpLCB7IGZpbHRlclZpc2libGU6IHRydWUsIGFwaUZuIH0sIHsgaW5zdGFudGlhdGlvbjogJ1NlbGVjdG9yJyB9KTtcblxuICAgICAgICByZXR1cm4gYnVpbGRlci5nZXRGdW5jdGlvbigpO1xuICAgIH07XG5cbiAgICBvYmouZmlsdGVySGlkZGVuID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBhcGlGbiAgID0gcHJlcGFyZUFwaUZuQXJncygnZmlsdGVySGlkZGVuJyk7XG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgU2VsZWN0b3JCdWlsZGVyKGdldFNlbGVjdG9yKCksIHsgZmlsdGVySGlkZGVuOiB0cnVlLCBhcGlGbiB9LCB7IGluc3RhbnRpYXRpb246ICdTZWxlY3RvcicgfSk7XG5cbiAgICAgICAgcmV0dXJuIGJ1aWxkZXIuZ2V0RnVuY3Rpb24oKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBhZGRDdXN0b21ET01Qcm9wZXJ0aWVzTWV0aG9kICh7IG9iaiwgZ2V0U2VsZWN0b3IsIFNlbGVjdG9yQnVpbGRlciB9KSB7XG4gICAgb2JqLmFkZEN1c3RvbURPTVByb3BlcnRpZXMgPSBjdXN0b21ET01Qcm9wZXJ0aWVzID0+IHtcbiAgICAgICAgYXNzZXJ0QWRkQ3VzdG9tRE9NUHJvcGVydGllc09wdGlvbnMoY3VzdG9tRE9NUHJvcGVydGllcyk7XG5cbiAgICAgICAgY29uc3QgYnVpbGRlciA9IG5ldyBTZWxlY3RvckJ1aWxkZXIoZ2V0U2VsZWN0b3IoKSwgeyBjdXN0b21ET01Qcm9wZXJ0aWVzIH0sIHsgaW5zdGFudGlhdGlvbjogJ1NlbGVjdG9yJyB9KTtcblxuICAgICAgICByZXR1cm4gYnVpbGRlci5nZXRGdW5jdGlvbigpO1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIGFkZEN1c3RvbU1ldGhvZHNNZXRob2QgKHsgb2JqLCBnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyIH0pIHtcbiAgICBvYmouYWRkQ3VzdG9tTWV0aG9kcyA9IGZ1bmN0aW9uIChtZXRob2RzLCBvcHRzKSB7XG4gICAgICAgIGFzc2VydEFkZEN1c3RvbU1ldGhvZHMobWV0aG9kcywgb3B0cyk7XG5cbiAgICAgICAgY29uc3QgY3VzdG9tTWV0aG9kcyA9IHt9O1xuXG4gICAgICAgIE9iamVjdC5rZXlzKG1ldGhvZHMpLmZvckVhY2gobWV0aG9kTmFtZSA9PiB7XG4gICAgICAgICAgICBjdXN0b21NZXRob2RzW21ldGhvZE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogICAgICAgICBtZXRob2RzW21ldGhvZE5hbWVdLFxuICAgICAgICAgICAgICAgIHJldHVybkRPTU5vZGVzOiBvcHRzICYmICEhb3B0cy5yZXR1cm5ET01Ob2RlcyxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgU2VsZWN0b3JCdWlsZGVyKGdldFNlbGVjdG9yKCksIHsgY3VzdG9tTWV0aG9kcyB9LCB7IGluc3RhbnRpYXRpb246ICdTZWxlY3RvcicgfSk7XG5cbiAgICAgICAgcmV0dXJuIGJ1aWxkZXIuZ2V0RnVuY3Rpb24oKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBhZGRIaWVyYXJjaGljYWxTZWxlY3RvcnMgKG9wdGlvbnMpIHtcbiAgICBjb25zdCB7IG9iaiB9ID0gb3B0aW9ucztcblxuICAgIC8vIEZpbmRcbiAgICBvYmouZmluZCA9IChmaWx0ZXIsIGRlcGVuZGVuY2llcykgPT4ge1xuICAgICAgICBhc3NlcnRUeXBlKFtpcy5zdHJpbmcsIGlzLmZ1bmN0aW9uXSwgJ2ZpbmQnLCAnVGhlIFwiZmlsdGVyXCIgYXJndW1lbnQnLCBmaWx0ZXIpO1xuXG4gICAgICAgIGNvbnN0IGFwaUZuID0gcHJlcGFyZUFwaUZuQXJncygnZmluZCcsIGZpbHRlcik7XG5cbiAgICAgICAgZmlsdGVyID0gY29udmVydEZpbHRlclRvQ2xpZW50RnVuY3Rpb25JZk5lY2Vzc2FyeSgnZmluZCcsIGZpbHRlciwgZGVwZW5kZW5jaWVzKTtcblxuICAgICAgICBjb25zdCBzZWxlY3RvckZuID0gKCkgPT4ge1xuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW5kZWYgKi9cbiAgICAgICAgICAgIHJldHVybiBleHBhbmRTZWxlY3RvclJlc3VsdHMoc2VsZWN0b3IsIG5vZGUgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsdGVyID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mIG5vZGUucXVlcnlTZWxlY3RvckFsbCA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoZmlsdGVyKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHZpc2l0Tm9kZSA9IGN1cnJlbnROb2RlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY25MZW5ndGggPSBjdXJyZW50Tm9kZS5jaGlsZE5vZGVzLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNuTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY3VycmVudE5vZGUuY2hpbGROb2Rlc1tpXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKGNoaWxkKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmlzaXROb2RlKGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB2aXNpdE5vZGUobm9kZSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyTm9kZXMocmVzdWx0cywgZmlsdGVyLCBudWxsLCBub2RlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby11bmRlZiAqL1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGFyZ3MgPSBnZXREZXJpdmF0aXZlU2VsZWN0b3JBcmdzKG9wdGlvbnMsIHNlbGVjdG9yRm4sIGFwaUZuLCBmaWx0ZXIsIHsgZXhwYW5kU2VsZWN0b3JSZXN1bHRzIH0pO1xuXG4gICAgICAgIHJldHVybiBjcmVhdGVEZXJpdmF0aXZlU2VsZWN0b3JXaXRoRmlsdGVyKGFyZ3MpO1xuICAgIH07XG5cbiAgICAvLyBQYXJlbnRcbiAgICBvYmoucGFyZW50ID0gKGZpbHRlciwgZGVwZW5kZW5jaWVzKSA9PiB7XG4gICAgICAgIGlmIChmaWx0ZXIgIT09IHZvaWQgMClcbiAgICAgICAgICAgIGFzc2VydFR5cGUoW2lzLnN0cmluZywgaXMuZnVuY3Rpb24sIGlzLm51bWJlcl0sICdwYXJlbnQnLCAnVGhlIFwiZmlsdGVyXCIgYXJndW1lbnQnLCBmaWx0ZXIpO1xuXG4gICAgICAgIGNvbnN0IGFwaUZuID0gcHJlcGFyZUFwaUZuQXJncygncGFyZW50JywgZmlsdGVyKTtcblxuICAgICAgICBmaWx0ZXIgPSBjb252ZXJ0RmlsdGVyVG9DbGllbnRGdW5jdGlvbklmTmVjZXNzYXJ5KCdmaW5kJywgZmlsdGVyLCBkZXBlbmRlbmNpZXMpO1xuXG4gICAgICAgIGNvbnN0IHNlbGVjdG9yRm4gPSAoKSA9PiB7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby11bmRlZiAqL1xuICAgICAgICAgICAgcmV0dXJuIGV4cGFuZFNlbGVjdG9yUmVzdWx0cyhzZWxlY3Rvciwgbm9kZSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyZW50cyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgcGFyZW50ID0gbm9kZS5wYXJlbnROb2RlOyBwYXJlbnQ7IHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlKVxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRzLnB1c2gocGFyZW50KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBmaWx0ZXIgIT09IHZvaWQgMCA/IGZpbHRlck5vZGVzKHBhcmVudHMsIGZpbHRlciwgZG9jdW1lbnQsIG5vZGUpIDogcGFyZW50cztcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby11bmRlZiAqL1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGFyZ3MgPSBnZXREZXJpdmF0aXZlU2VsZWN0b3JBcmdzKG9wdGlvbnMsIHNlbGVjdG9yRm4sIGFwaUZuLCBmaWx0ZXIsIHsgZXhwYW5kU2VsZWN0b3JSZXN1bHRzIH0pO1xuXG4gICAgICAgIHJldHVybiBjcmVhdGVEZXJpdmF0aXZlU2VsZWN0b3JXaXRoRmlsdGVyKGFyZ3MpO1xuICAgIH07XG5cbiAgICAvLyBDaGlsZFxuICAgIG9iai5jaGlsZCA9IChmaWx0ZXIsIGRlcGVuZGVuY2llcykgPT4ge1xuICAgICAgICBpZiAoZmlsdGVyICE9PSB2b2lkIDApXG4gICAgICAgICAgICBhc3NlcnRUeXBlKFtpcy5zdHJpbmcsIGlzLmZ1bmN0aW9uLCBpcy5udW1iZXJdLCAnY2hpbGQnLCAnVGhlIFwiZmlsdGVyXCIgYXJndW1lbnQnLCBmaWx0ZXIpO1xuXG4gICAgICAgIGNvbnN0IGFwaUZuID0gcHJlcGFyZUFwaUZuQXJncygnY2hpbGQnLCBmaWx0ZXIpO1xuXG4gICAgICAgIGZpbHRlciA9IGNvbnZlcnRGaWx0ZXJUb0NsaWVudEZ1bmN0aW9uSWZOZWNlc3NhcnkoJ2ZpbmQnLCBmaWx0ZXIsIGRlcGVuZGVuY2llcyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0b3JGbiA9ICgpID0+IHtcbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVuZGVmICovXG4gICAgICAgICAgICByZXR1cm4gZXhwYW5kU2VsZWN0b3JSZXN1bHRzKHNlbGVjdG9yLCBub2RlID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEVsZW1lbnRzID0gW107XG4gICAgICAgICAgICAgICAgY29uc3QgY25MZW5ndGggICAgICA9IG5vZGUuY2hpbGROb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNuTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBub2RlLmNoaWxkTm9kZXNbaV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkLm5vZGVUeXBlID09PSAxKVxuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGRFbGVtZW50cy5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyICE9PSB2b2lkIDAgPyBmaWx0ZXJOb2RlcyhjaGlsZEVsZW1lbnRzLCBmaWx0ZXIsIG5vZGUsIG5vZGUpIDogY2hpbGRFbGVtZW50cztcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby11bmRlZiAqL1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGFyZ3MgPSBnZXREZXJpdmF0aXZlU2VsZWN0b3JBcmdzKG9wdGlvbnMsIHNlbGVjdG9yRm4sIGFwaUZuLCBmaWx0ZXIsIHsgZXhwYW5kU2VsZWN0b3JSZXN1bHRzIH0pO1xuXG4gICAgICAgIHJldHVybiBjcmVhdGVEZXJpdmF0aXZlU2VsZWN0b3JXaXRoRmlsdGVyKGFyZ3MpO1xuICAgIH07XG5cbiAgICAvLyBTaWJsaW5nXG4gICAgb2JqLnNpYmxpbmcgPSAoZmlsdGVyLCBkZXBlbmRlbmNpZXMpID0+IHtcbiAgICAgICAgaWYgKGZpbHRlciAhPT0gdm9pZCAwKVxuICAgICAgICAgICAgYXNzZXJ0VHlwZShbaXMuc3RyaW5nLCBpcy5mdW5jdGlvbiwgaXMubnVtYmVyXSwgJ3NpYmxpbmcnLCAnVGhlIFwiZmlsdGVyXCIgYXJndW1lbnQnLCBmaWx0ZXIpO1xuXG4gICAgICAgIGNvbnN0IGFwaUZuID0gcHJlcGFyZUFwaUZuQXJncygnc2libGluZycsIGZpbHRlcik7XG5cbiAgICAgICAgZmlsdGVyID0gY29udmVydEZpbHRlclRvQ2xpZW50RnVuY3Rpb25JZk5lY2Vzc2FyeSgnZmluZCcsIGZpbHRlciwgZGVwZW5kZW5jaWVzKTtcblxuICAgICAgICBjb25zdCBzZWxlY3RvckZuID0gKCkgPT4ge1xuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW5kZWYgKi9cbiAgICAgICAgICAgIHJldHVybiBleHBhbmRTZWxlY3RvclJlc3VsdHMoc2VsZWN0b3IsIG5vZGUgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGUucGFyZW50Tm9kZTtcblxuICAgICAgICAgICAgICAgIGlmICghcGFyZW50KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHNpYmxpbmdzID0gW107XG4gICAgICAgICAgICAgICAgY29uc3QgY25MZW5ndGggPSBwYXJlbnQuY2hpbGROb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNuTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBwYXJlbnQuY2hpbGROb2Rlc1tpXTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2hpbGQubm9kZVR5cGUgPT09IDEgJiYgY2hpbGQgIT09IG5vZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICBzaWJsaW5ncy5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyICE9PSB2b2lkIDAgPyBmaWx0ZXJOb2RlcyhzaWJsaW5ncywgZmlsdGVyLCBwYXJlbnQsIG5vZGUpIDogc2libGluZ3M7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8qIGVzbGludC1lbmFibGUgbm8tdW5kZWYgKi9cbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBhcmdzID0gZ2V0RGVyaXZhdGl2ZVNlbGVjdG9yQXJncyhvcHRpb25zLCBzZWxlY3RvckZuLCBhcGlGbiwgZmlsdGVyLCB7IGV4cGFuZFNlbGVjdG9yUmVzdWx0cyB9KTtcblxuICAgICAgICByZXR1cm4gY3JlYXRlRGVyaXZhdGl2ZVNlbGVjdG9yV2l0aEZpbHRlcihhcmdzKTtcbiAgICB9O1xuXG4gICAgLy8gTmV4dCBzaWJsaW5nXG4gICAgb2JqLm5leHRTaWJsaW5nID0gKGZpbHRlciwgZGVwZW5kZW5jaWVzKSA9PiB7XG4gICAgICAgIGlmIChmaWx0ZXIgIT09IHZvaWQgMClcbiAgICAgICAgICAgIGFzc2VydFR5cGUoW2lzLnN0cmluZywgaXMuZnVuY3Rpb24sIGlzLm51bWJlcl0sICduZXh0U2libGluZycsICdUaGUgXCJmaWx0ZXJcIiBhcmd1bWVudCcsIGZpbHRlcik7XG5cbiAgICAgICAgY29uc3QgYXBpRm4gPSBwcmVwYXJlQXBpRm5BcmdzKCduZXh0U2libGluZycsIGZpbHRlcik7XG5cbiAgICAgICAgZmlsdGVyID0gY29udmVydEZpbHRlclRvQ2xpZW50RnVuY3Rpb25JZk5lY2Vzc2FyeSgnZmluZCcsIGZpbHRlciwgZGVwZW5kZW5jaWVzKTtcblxuICAgICAgICBjb25zdCBzZWxlY3RvckZuID0gKCkgPT4ge1xuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW5kZWYgKi9cbiAgICAgICAgICAgIHJldHVybiBleHBhbmRTZWxlY3RvclJlc3VsdHMoc2VsZWN0b3IsIG5vZGUgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGUucGFyZW50Tm9kZTtcblxuICAgICAgICAgICAgICAgIGlmICghcGFyZW50KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHNpYmxpbmdzID0gW107XG4gICAgICAgICAgICAgICAgY29uc3QgY25MZW5ndGggPSBwYXJlbnQuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGFmdGVyTm9kZSAgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY25MZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHBhcmVudC5jaGlsZE5vZGVzW2ldO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZCA9PT0gbm9kZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGFmdGVyTm9kZSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoYWZ0ZXJOb2RlICYmIGNoaWxkLm5vZGVUeXBlID09PSAxKVxuICAgICAgICAgICAgICAgICAgICAgICAgc2libGluZ3MucHVzaChjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbHRlciAhPT0gdm9pZCAwID8gZmlsdGVyTm9kZXMoc2libGluZ3MsIGZpbHRlciwgcGFyZW50LCBub2RlKSA6IHNpYmxpbmdzO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVuZGVmICovXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXJncyA9IGdldERlcml2YXRpdmVTZWxlY3RvckFyZ3Mob3B0aW9ucywgc2VsZWN0b3JGbiwgYXBpRm4sIGZpbHRlciwgeyBleHBhbmRTZWxlY3RvclJlc3VsdHMgfSk7XG5cbiAgICAgICAgcmV0dXJuIGNyZWF0ZURlcml2YXRpdmVTZWxlY3RvcldpdGhGaWx0ZXIoYXJncyk7XG4gICAgfTtcblxuICAgIC8vIFByZXYgc2libGluZ1xuICAgIG9iai5wcmV2U2libGluZyA9IChmaWx0ZXIsIGRlcGVuZGVuY2llcykgPT4ge1xuICAgICAgICBpZiAoZmlsdGVyICE9PSB2b2lkIDApXG4gICAgICAgICAgICBhc3NlcnRUeXBlKFtpcy5zdHJpbmcsIGlzLmZ1bmN0aW9uLCBpcy5udW1iZXJdLCAncHJldlNpYmxpbmcnLCAnVGhlIFwiZmlsdGVyXCIgYXJndW1lbnQnLCBmaWx0ZXIpO1xuXG4gICAgICAgIGNvbnN0IGFwaUZuID0gcHJlcGFyZUFwaUZuQXJncygncHJldlNpYmxpbmcnLCBmaWx0ZXIpO1xuXG4gICAgICAgIGZpbHRlciA9IGNvbnZlcnRGaWx0ZXJUb0NsaWVudEZ1bmN0aW9uSWZOZWNlc3NhcnkoJ2ZpbmQnLCBmaWx0ZXIsIGRlcGVuZGVuY2llcyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0b3JGbiA9ICgpID0+IHtcbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVuZGVmICovXG4gICAgICAgICAgICByZXR1cm4gZXhwYW5kU2VsZWN0b3JSZXN1bHRzKHNlbGVjdG9yLCBub2RlID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBub2RlLnBhcmVudE5vZGU7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXBhcmVudClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzaWJsaW5ncyA9IFtdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNuTGVuZ3RoID0gcGFyZW50LmNoaWxkTm9kZXMubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbkxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gcGFyZW50LmNoaWxkTm9kZXNbaV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkID09PSBub2RlKVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkLm5vZGVUeXBlID09PSAxKVxuICAgICAgICAgICAgICAgICAgICAgICAgc2libGluZ3MucHVzaChjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbHRlciAhPT0gdm9pZCAwID8gZmlsdGVyTm9kZXMoc2libGluZ3MsIGZpbHRlciwgcGFyZW50LCBub2RlKSA6IHNpYmxpbmdzO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVuZGVmICovXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXJncyA9IGdldERlcml2YXRpdmVTZWxlY3RvckFyZ3Mob3B0aW9ucywgc2VsZWN0b3JGbiwgYXBpRm4sIGZpbHRlciwgeyBleHBhbmRTZWxlY3RvclJlc3VsdHMgfSk7XG5cbiAgICAgICAgcmV0dXJuIGNyZWF0ZURlcml2YXRpdmVTZWxlY3RvcldpdGhGaWx0ZXIoYXJncyk7XG4gICAgfTtcblxuICAgIC8vIFNoYWRvd1Jvb3RcbiAgICBvYmouc2hhZG93Um9vdCA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgYXBpRm4gPSBwcmVwYXJlQXBpRm5BcmdzKCdzaGFkb3dSb290Jyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0b3JGbiA9ICgpID0+IHtcbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVuZGVmICovXG4gICAgICAgICAgICByZXR1cm4gZXhwYW5kU2VsZWN0b3JSZXN1bHRzKHNlbGVjdG9yLCBub2RlID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gIW5vZGUuc2hhZG93Um9vdCA/IG51bGwgOiBbbm9kZS5zaGFkb3dSb290XTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby11bmRlZiAqL1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGFyZ3MgPSBnZXREZXJpdmF0aXZlU2VsZWN0b3JBcmdzKG9wdGlvbnMsIHNlbGVjdG9yRm4sIGFwaUZuLCB2b2lkIDAsIHsgZXhwYW5kU2VsZWN0b3JSZXN1bHRzIH0pO1xuXG4gICAgICAgIHJldHVybiBjcmVhdGVEZXJpdmF0aXZlU2VsZWN0b3JXaXRoRmlsdGVyKGFyZ3MpO1xuICAgIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRBUEkgKHNlbGVjdG9yLCBnZXRTZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyLCBjdXN0b21ET01Qcm9wZXJ0aWVzLCBjdXN0b21NZXRob2RzLCBvYnNlcnZlZENhbGxzaXRlcywgc2tpcFNuYXBzaG90UHJvcGVydGllcykge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7IG9iajogc2VsZWN0b3IsIGdldFNlbGVjdG9yLCBTZWxlY3RvckJ1aWxkZXIsIGN1c3RvbURPTVByb3BlcnRpZXMsIGN1c3RvbU1ldGhvZHMsIG9ic2VydmVkQ2FsbHNpdGVzIH07XG5cbiAgICBhZGRGaWx0ZXJNZXRob2RzKG9wdGlvbnMpO1xuICAgIGFkZEhpZXJhcmNoaWNhbFNlbGVjdG9ycyhvcHRpb25zKTtcblxuICAgIGlmICghc2tpcFNuYXBzaG90UHJvcGVydGllcylcbiAgICAgICAgYWRkU25hcHNob3RQcm9wZXJ0eVNob3J0aGFuZHMob3B0aW9ucyk7XG5cbiAgICBhZGRDdXN0b21ET01Qcm9wZXJ0aWVzTWV0aG9kKG9wdGlvbnMpO1xuICAgIGFkZEN1c3RvbU1ldGhvZHNNZXRob2Qob3B0aW9ucyk7XG4gICAgYWRkQ291bnRlclByb3BlcnRpZXMob3B0aW9ucyk7XG4gICAgYWRkVmlzaWJsZVByb3BlcnR5KG9wdGlvbnMpO1xufVxuIl19