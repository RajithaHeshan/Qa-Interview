"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const dedent_1 = __importDefault(require("dedent"));
const client_function_builder_1 = __importDefault(require("../client-function-builder"));
const replicator_1 = require("../replicator");
const runtime_1 = require("../../errors/runtime");
const builder_symbol_1 = __importDefault(require("../builder-symbol"));
const types_1 = require("../../errors/types");
const type_assertions_1 = require("../../errors/runtime/type-assertions");
const observation_1 = require("../../test-run/commands/observation");
const define_lazy_property_1 = __importDefault(require("../../utils/define-lazy-property"));
const add_api_1 = require("./add-api");
const create_snapshot_methods_1 = __importDefault(require("./create-snapshot-methods"));
const prepare_api_args_1 = __importDefault(require("./prepare-api-args"));
const return_single_prop_mode_1 = __importDefault(require("../return-single-prop-mode"));
const selector_api_execution_mode_1 = __importDefault(require("../selector-api-execution-mode"));
class SelectorBuilder extends client_function_builder_1.default {
    constructor(fn, options, callsiteNames, callsite) {
        const apiFn = options && options.apiFn;
        const apiFnID = options && options.apiFnID;
        const builderFromSelector = fn && fn[builder_symbol_1.default];
        const builderFromPromiseOrSnapshot = fn && fn.selector && fn.selector[builder_symbol_1.default];
        let builder = builderFromSelector || builderFromPromiseOrSnapshot;
        builder = builder instanceof SelectorBuilder ? builder : null;
        if (builder) {
            fn = builder.fn;
            if (options === void 0 || typeof options === 'object')
                options = (0, lodash_1.merge)({}, builder.options, options, { sourceSelectorBuilder: builder });
        }
        super(fn, options, callsiteNames);
        if (!this.options.apiFnChain) {
            const fnType = typeof this.fn;
            let item = fnType === 'string' ? `'${this.fn}'` : `[${fnType}]`;
            item = `Selector(${item})`;
            this.options.apiFn = item;
            this.options.apiFnChain = [item];
        }
        if (apiFn)
            this.options.apiFnChain.push(apiFn);
        this.options.apiFnID = typeof apiFnID === 'number' ? apiFnID : this.options.apiFnChain.length - 1;
        this.callsite = callsite;
    }
    _getCompiledFnCode() {
        // OPTIMIZATION: if selector was produced from another selector and
        // it has same dependencies as source selector, then we can
        // avoid recompilation and just re-use already compiled code.
        const hasSameDependenciesAsSourceSelector = this.options.sourceSelectorBuilder &&
            this.options.sourceSelectorBuilder.options.dependencies ===
                this.options.dependencies;
        if (hasSameDependenciesAsSourceSelector)
            return this.options.sourceSelectorBuilder.compiledFnCode;
        const code = typeof this.fn === 'string' ?
            `(function(){return document.querySelectorAll(${JSON.stringify(this.fn)});});` :
            super._getCompiledFnCode();
        if (code) {
            return (0, dedent_1.default)(`(function(){
                    var __f$=${code};
                    return function(){
                        var args           = __dependencies$.boundArgs || arguments;
                        var selectorFilter = __dependencies$.selectorFilter;

                        var nodes = __f$.apply(this, args);
                        nodes     = selectorFilter.cast(nodes);

                        if (!nodes.length && !selectorFilter.error)
                            selectorFilter.error = __dependencies$.apiInfo.apiFnID;

                        return selectorFilter.filter(nodes, __dependencies$.filterOptions, __dependencies$.apiInfo);
                    };
                 })();`);
        }
        return null;
    }
    _createInvalidFnTypeError() {
        return new runtime_1.ClientFunctionAPIError(this.callsiteNames.instantiation, this.callsiteNames.instantiation, types_1.RUNTIME_ERRORS.selectorInitializedWithWrongType, typeof this.fn);
    }
    _executeCommand(args, testRun, callsite) {
        const resultPromise = super._executeCommand(args, testRun, this.callsite || callsite);
        this._addBoundArgsSelectorGetter(resultPromise, args);
        // OPTIMIZATION: use buffer function as selector not to trigger lazy property ahead of time
        (0, add_api_1.addAPI)(resultPromise, () => resultPromise.selector, SelectorBuilder, this.options.customDOMProperties, this.options.customMethods);
        return resultPromise;
    }
    _getSourceSelectorBuilderApiFnID() {
        let selectorAncestor = this;
        while (selectorAncestor.options.sourceSelectorBuilder)
            selectorAncestor = selectorAncestor.options.sourceSelectorBuilder;
        return selectorAncestor.options.apiFnID;
    }
    getFunctionDependencies() {
        const dependencies = super.getFunctionDependencies();
        const { filterVisible, filterHidden, counterMode, collectionMode, getVisibleValueMode, index, customDOMProperties, customMethods, apiFnChain, boundArgs, } = this.options;
        return (0, lodash_1.merge)({}, dependencies, {
            filterOptions: {
                filterVisible,
                filterHidden,
                counterMode,
                collectionMode,
                index: (0, lodash_1.isNil)(index) ? null : index,
                getVisibleValueMode,
            },
            apiInfo: {
                apiFnChain,
                apiFnID: this._getSourceSelectorBuilderApiFnID(),
            },
            boundArgs,
            customDOMProperties,
            customMethods,
        });
    }
    _createTestRunCommand(encodedArgs, encodedDependencies) {
        return new observation_1.ExecuteSelectorCommand({
            instantiationCallsiteName: this.callsiteNames.instantiation,
            fnCode: this.compiledFnCode,
            args: encodedArgs,
            dependencies: encodedDependencies,
            needError: this.options.needError,
            apiFnChain: this.options.apiFnChain,
            visibilityCheck: !!this.options.visibilityCheck,
            timeout: this.options.timeout,
            strictError: this.options.strictError,
        });
    }
    _validateOptions(options) {
        super._validateOptions(options);
        if (!(0, lodash_1.isNil)(options.visibilityCheck))
            (0, type_assertions_1.assertType)(type_assertions_1.is.boolean, this.callsiteNames.instantiation, 'The "visibilityCheck" option', options.visibilityCheck);
        if (!(0, lodash_1.isNil)(options.timeout))
            (0, type_assertions_1.assertType)(type_assertions_1.is.nonNegativeNumber, this.callsiteNames.instantiation, 'The "timeout" option', options.timeout);
    }
    _getReplicatorTransforms() {
        const transforms = super._getReplicatorTransforms();
        transforms.push(new replicator_1.SelectorNodeTransform());
        return transforms;
    }
    _addBoundArgsSelectorGetter(obj, selectorArgs) {
        (0, define_lazy_property_1.default)(obj, 'selector', () => {
            const builder = new SelectorBuilder(this.getFunction(), { boundArgs: selectorArgs });
            return builder.getFunction();
        });
    }
    _decorateFunction(selectorFn) {
        super._decorateFunction(selectorFn);
        (0, add_api_1.addAPI)(selectorFn, () => selectorFn, SelectorBuilder, this.options.customDOMProperties, this.options.customMethods, this._getObservedCallsites());
    }
    _getClientFnWithOverriddenOptions(options) {
        const apiFn = (0, prepare_api_args_1.default)('with', options);
        const previousSelectorID = this.options.apiFnChain.length - 1;
        return super._getClientFnWithOverriddenOptions(Object.assign(options, { apiFn, apiFnID: previousSelectorID }));
    }
    _processResult(result, selectorArgs) {
        const snapshot = super._processResult(result, selectorArgs);
        if (snapshot && !(0, return_single_prop_mode_1.default)(this.options)) {
            this._addBoundArgsSelectorGetter(snapshot, selectorArgs);
            (0, create_snapshot_methods_1.default)(snapshot);
            if (this.options.customMethods)
                (0, add_api_1.addCustomMethods)(snapshot, () => snapshot.selector, SelectorBuilder, this.options.customMethods);
            if (selector_api_execution_mode_1.default.isSync) {
                (0, add_api_1.addAPI)(snapshot, () => snapshot.selector, SelectorBuilder, this.options.customDOMProperties, this.options.customMethods, this._getObservedCallsites(), true);
            }
        }
        return snapshot;
    }
}
exports.default = SelectorBuilder;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VsZWN0b3ItYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGllbnQtZnVuY3Rpb25zL3NlbGVjdG9ycy9zZWxlY3Rvci1idWlsZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUNBQTJEO0FBQzNELG9EQUE0QjtBQUM1Qix5RkFBK0Q7QUFDL0QsOENBQXNEO0FBQ3RELGtEQUE4RDtBQUM5RCx1RUFBc0Q7QUFDdEQsOENBQW9EO0FBQ3BELDBFQUFzRTtBQUN0RSxxRUFBNkU7QUFDN0UsNEZBQWtFO0FBQ2xFLHVDQUFxRDtBQUNyRCx3RkFBOEQ7QUFDOUQsMEVBQWtEO0FBQ2xELHlGQUE4RDtBQUM5RCxpR0FBc0U7QUFFdEUsTUFBcUIsZUFBZ0IsU0FBUSxpQ0FBcUI7SUFDOUQsWUFBYSxFQUFFLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxRQUFRO1FBQzdDLE1BQU0sS0FBSyxHQUEwQixPQUFPLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQztRQUM5RCxNQUFNLE9BQU8sR0FBd0IsT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDaEUsTUFBTSxtQkFBbUIsR0FBWSxFQUFFLElBQUksRUFBRSxDQUFDLHdCQUFxQixDQUFDLENBQUM7UUFDckUsTUFBTSw0QkFBNEIsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLHdCQUFxQixDQUFDLENBQUM7UUFDN0YsSUFBSSxPQUFPLEdBQTBCLG1CQUFtQixJQUFJLDRCQUE0QixDQUFDO1FBRXpGLE9BQU8sR0FBRyxPQUFPLFlBQVksZUFBZSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUU5RCxJQUFJLE9BQU8sRUFBRTtZQUNULEVBQUUsR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBRWhCLElBQUksT0FBTyxLQUFLLEtBQUssQ0FBQyxJQUFJLE9B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QyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDakQsSUFBSSxDQUFDLDJCQUEyQixDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUN6RCxJQUFBLGlDQUFxQixFQUFDLFFBQVEsQ0FBQyxDQUFDO1lBRWhDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhO2dCQUMxQixJQUFBLDBCQUFnQixFQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBRXJHLElBQUkscUNBQXdCLENBQUMsTUFBTSxFQUFFO2dCQUNqQyxJQUFBLGdCQUFNLEVBQ0YsUUFBUSxFQUNSLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQ3ZCLGVBQWUsRUFDZixJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixFQUNoQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFDMUIsSUFBSSxDQUFDLHFCQUFxQixFQUFFLEVBQzVCLElBQUksQ0FDUCxDQUFDO2FBQ0w7U0FDSjtRQUVELE9BQU8sUUFBUSxDQUFDO0lBQ3BCLENBQUM7Q0FDSjtBQXpORCxrQ0F5TkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc05pbCBhcyBpc051bGxPclVuZGVmaW5lZCwgbWVyZ2UgfSBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IGRlZGVudCBmcm9tICdkZWRlbnQnO1xuaW1wb3J0IENsaWVudEZ1bmN0aW9uQnVpbGRlciBmcm9tICcuLi9jbGllbnQtZnVuY3Rpb24tYnVpbGRlcic7XG5pbXBvcnQgeyBTZWxlY3Rvck5vZGVUcmFuc2Zvcm0gfSBmcm9tICcuLi9yZXBsaWNhdG9yJztcbmltcG9ydCB7IENsaWVudEZ1bmN0aW9uQVBJRXJyb3IgfSBmcm9tICcuLi8uLi9lcnJvcnMvcnVudGltZSc7XG5pbXBvcnQgZnVuY3Rpb25CdWlsZGVyU3ltYm9sIGZyb20gJy4uL2J1aWxkZXItc3ltYm9sJztcbmltcG9ydCB7IFJVTlRJTUVfRVJST1JTIH0gZnJvbSAnLi4vLi4vZXJyb3JzL3R5cGVzJztcbmltcG9ydCB7IGFzc2VydFR5cGUsIGlzIH0gZnJvbSAnLi4vLi4vZXJyb3JzL3J1bnRpbWUvdHlwZS1hc3NlcnRpb25zJztcbmltcG9ydCB7IEV4ZWN1dGVTZWxlY3RvckNvbW1hbmQgfSBmcm9tICcuLi8uLi90ZXN0LXJ1bi9jb21tYW5kcy9vYnNlcnZhdGlvbic7XG5pbXBvcnQgZGVmaW5lTGF6eVByb3BlcnR5IGZyb20gJy4uLy4uL3V0aWxzL2RlZmluZS1sYXp5LXByb3BlcnR5JztcbmltcG9ydCB7IGFkZEFQSSwgYWRkQ3VzdG9tTWV0aG9kcyB9IGZyb20gJy4vYWRkLWFwaSc7XG5pbXBvcnQgY3JlYXRlU25hcHNob3RNZXRob2RzIGZyb20gJy4vY3JlYXRlLXNuYXBzaG90LW1ldGhvZHMnO1xuaW1wb3J0IHByZXBhcmVBcGlGbkFyZ3MgZnJvbSAnLi9wcmVwYXJlLWFwaS1hcmdzJztcbmltcG9ydCByZXR1cm5TaW5nbGVQcm9wTW9kZSBmcm9tICcuLi9yZXR1cm4tc2luZ2xlLXByb3AtbW9kZSc7XG5pbXBvcnQgc2VsZWN0b3JBcGlFeGVjdXRpb25Nb2RlIGZyb20gJy4uL3NlbGVjdG9yLWFwaS1leGVjdXRpb24tbW9kZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNlbGVjdG9yQnVpbGRlciBleHRlbmRzIENsaWVudEZ1bmN0aW9uQnVpbGRlciB7XG4gICAgY29uc3RydWN0b3IgKGZuLCBvcHRpb25zLCBjYWxsc2l0ZU5hbWVzLCBjYWxsc2l0ZSkge1xuICAgICAgICBjb25zdCBhcGlGbiAgICAgICAgICAgICAgICAgICAgICAgID0gb3B0aW9ucyAmJiBvcHRpb25zLmFwaUZuO1xuICAgICAgICBjb25zdCBhcGlGbklEICAgICAgICAgICAgICAgICAgICAgID0gb3B0aW9ucyAmJiBvcHRpb25zLmFwaUZuSUQ7XG4gICAgICAgIGNvbnN0IGJ1aWxkZXJGcm9tU2VsZWN0b3IgICAgICAgICAgPSBmbiAmJiBmbltmdW5jdGlvbkJ1aWxkZXJTeW1ib2xdO1xuICAgICAgICBjb25zdCBidWlsZGVyRnJvbVByb21pc2VPclNuYXBzaG90ID0gZm4gJiYgZm4uc2VsZWN0b3IgJiYgZm4uc2VsZWN0b3JbZnVuY3Rpb25CdWlsZGVyU3ltYm9sXTtcbiAgICAgICAgbGV0IGJ1aWxkZXIgICAgICAgICAgICAgICAgICAgICAgICA9IGJ1aWxkZXJGcm9tU2VsZWN0b3IgfHwgYnVpbGRlckZyb21Qcm9taXNlT3JTbmFwc2hvdDtcblxuICAgICAgICBidWlsZGVyID0gYnVpbGRlciBpbnN0YW5jZW9mIFNlbGVjdG9yQnVpbGRlciA/IGJ1aWxkZXIgOiBudWxsO1xuXG4gICAgICAgIGlmIChidWlsZGVyKSB7XG4gICAgICAgICAgICBmbiA9IGJ1aWxkZXIuZm47XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zID09PSB2b2lkIDAgfHwgdHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnKVxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBtZXJnZSh7fSwgYnVpbGRlci5vcHRpb25zLCBvcHRpb25zLCB7IHNvdXJjZVNlbGVjdG9yQnVpbGRlcjogYnVpbGRlciB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyKGZuLCBvcHRpb25zLCBjYWxsc2l0ZU5hbWVzKTtcblxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5hcGlGbkNoYWluKSB7XG4gICAgICAgICAgICBjb25zdCBmblR5cGUgPSB0eXBlb2YgdGhpcy5mbjtcbiAgICAgICAgICAgIGxldCBpdGVtICAgICA9IGZuVHlwZSA9PT0gJ3N0cmluZycgPyBgJyR7dGhpcy5mbn0nYCA6IGBbJHtmblR5cGV9XWA7XG5cbiAgICAgICAgICAgIGl0ZW0gICAgICAgICAgICAgICAgICAgID0gYFNlbGVjdG9yKCR7aXRlbX0pYDtcbiAgICAgICAgICAgIHRoaXMub3B0aW9ucy5hcGlGbiAgICAgID0gaXRlbTtcbiAgICAgICAgICAgIHRoaXMub3B0aW9ucy5hcGlGbkNoYWluID0gW2l0ZW1dO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwaUZuKVxuICAgICAgICAgICAgdGhpcy5vcHRpb25zLmFwaUZuQ2hhaW4ucHVzaChhcGlGbik7XG5cbiAgICAgICAgdGhpcy5vcHRpb25zLmFwaUZuSUQgPSB0eXBlb2YgYXBpRm5JRCA9PT0gJ251bWJlcicgPyBhcGlGbklEIDogdGhpcy5vcHRpb25zLmFwaUZuQ2hhaW4ubGVuZ3RoIC0gMTtcbiAgICAgICAgdGhpcy5jYWxsc2l0ZSAgICAgICAgPSBjYWxsc2l0ZTtcbiAgICB9XG5cbiAgICBfZ2V0Q29tcGlsZWRGbkNvZGUgKCkge1xuICAgICAgICAvLyBPUFRJTUlaQVRJT046IGlmIHNlbGVjdG9yIHdhcyBwcm9kdWNlZCBmcm9tIGFub3RoZXIgc2VsZWN0b3IgYW5kXG4gICAgICAgIC8vIGl0IGhhcyBzYW1lIGRlcGVuZGVuY2llcyBhcyBzb3VyY2Ugc2VsZWN0b3IsIHRoZW4gd2UgY2FuXG4gICAgICAgIC8vIGF2b2lkIHJlY29tcGlsYXRpb24gYW5kIGp1c3QgcmUtdXNlIGFscmVhZHkgY29tcGlsZWQgY29kZS5cbiAgICAgICAgY29uc3QgaGFzU2FtZURlcGVuZGVuY2llc0FzU291cmNlU2VsZWN0b3IgPSB0aGlzLm9wdGlvbnMuc291cmNlU2VsZWN0b3JCdWlsZGVyICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLnNvdXJjZVNlbGVjdG9yQnVpbGRlci5vcHRpb25zLmRlcGVuZGVuY2llcyA9PT1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9wdGlvbnMuZGVwZW5kZW5jaWVzO1xuXG4gICAgICAgIGlmIChoYXNTYW1lRGVwZW5kZW5jaWVzQXNTb3VyY2VTZWxlY3RvcilcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuc291cmNlU2VsZWN0b3JCdWlsZGVyLmNvbXBpbGVkRm5Db2RlO1xuXG4gICAgICAgIGNvbnN0IGNvZGUgPSB0eXBlb2YgdGhpcy5mbiA9PT0gJ3N0cmluZycgP1xuICAgICAgICAgICAgYChmdW5jdGlvbigpe3JldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCR7SlNPTi5zdHJpbmdpZnkodGhpcy5mbil9KTt9KTtgIDpcbiAgICAgICAgICAgIHN1cGVyLl9nZXRDb21waWxlZEZuQ29kZSgpO1xuXG4gICAgICAgIGlmIChjb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVkZW50KFxuICAgICAgICAgICAgICAgIGAoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIF9fZiQ9JHtjb2RlfTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyAgICAgICAgICAgPSBfX2RlcGVuZGVuY2llcyQuYm91bmRBcmdzIHx8IGFyZ3VtZW50cztcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzZWxlY3RvckZpbHRlciA9IF9fZGVwZW5kZW5jaWVzJC5zZWxlY3RvckZpbHRlcjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5vZGVzID0gX19mJC5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVzICAgICA9IHNlbGVjdG9yRmlsdGVyLmNhc3Qobm9kZXMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW5vZGVzLmxlbmd0aCAmJiAhc2VsZWN0b3JGaWx0ZXIuZXJyb3IpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0b3JGaWx0ZXIuZXJyb3IgPSBfX2RlcGVuZGVuY2llcyQuYXBpSW5mby5hcGlGbklEO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZWN0b3JGaWx0ZXIuZmlsdGVyKG5vZGVzLCBfX2RlcGVuZGVuY2llcyQuZmlsdGVyT3B0aW9ucywgX19kZXBlbmRlbmNpZXMkLmFwaUluZm8pO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICB9KSgpO2BcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBfY3JlYXRlSW52YWxpZEZuVHlwZUVycm9yICgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDbGllbnRGdW5jdGlvbkFQSUVycm9yKHRoaXMuY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLCB0aGlzLmNhbGxzaXRlTmFtZXMuaW5zdGFudGlhdGlvbiwgUlVOVElNRV9FUlJPUlMuc2VsZWN0b3JJbml0aWFsaXplZFdpdGhXcm9uZ1R5cGUsIHR5cGVvZiB0aGlzLmZuKTtcbiAgICB9XG5cbiAgICBfZXhlY3V0ZUNvbW1hbmQgKGFyZ3MsIHRlc3RSdW4sIGNhbGxzaXRlKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdFByb21pc2UgPSBzdXBlci5fZXhlY3V0ZUNvbW1hbmQoYXJncywgdGVzdFJ1biwgdGhpcy5jYWxsc2l0ZSB8fCBjYWxsc2l0ZSk7XG5cbiAgICAgICAgdGhpcy5fYWRkQm91bmRBcmdzU2VsZWN0b3JHZXR0ZXIocmVzdWx0UHJvbWlzZSwgYXJncyk7XG5cbiAgICAgICAgLy8gT1BUSU1JWkFUSU9OOiB1c2UgYnVmZmVyIGZ1bmN0aW9uIGFzIHNlbGVjdG9yIG5vdCB0byB0cmlnZ2VyIGxhenkgcHJvcGVydHkgYWhlYWQgb2YgdGltZVxuICAgICAgICBhZGRBUEkocmVzdWx0UHJvbWlzZSwgKCkgPT4gcmVzdWx0UHJvbWlzZS5zZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyLCB0aGlzLm9wdGlvbnMuY3VzdG9tRE9NUHJvcGVydGllcywgdGhpcy5vcHRpb25zLmN1c3RvbU1ldGhvZHMpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHRQcm9taXNlO1xuICAgIH1cblxuICAgIF9nZXRTb3VyY2VTZWxlY3RvckJ1aWxkZXJBcGlGbklEICgpIHtcbiAgICAgICAgbGV0IHNlbGVjdG9yQW5jZXN0b3IgPSB0aGlzO1xuXG4gICAgICAgIHdoaWxlIChzZWxlY3RvckFuY2VzdG9yLm9wdGlvbnMuc291cmNlU2VsZWN0b3JCdWlsZGVyKVxuICAgICAgICAgICAgc2VsZWN0b3JBbmNlc3RvciA9IHNlbGVjdG9yQW5jZXN0b3Iub3B0aW9ucy5zb3VyY2VTZWxlY3RvckJ1aWxkZXI7XG5cbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yQW5jZXN0b3Iub3B0aW9ucy5hcGlGbklEO1xuICAgIH1cblxuICAgIGdldEZ1bmN0aW9uRGVwZW5kZW5jaWVzICgpIHtcbiAgICAgICAgY29uc3QgZGVwZW5kZW5jaWVzID0gc3VwZXIuZ2V0RnVuY3Rpb25EZXBlbmRlbmNpZXMoKTtcblxuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBmaWx0ZXJWaXNpYmxlLFxuICAgICAgICAgICAgZmlsdGVySGlkZGVuLFxuICAgICAgICAgICAgY291bnRlck1vZGUsXG4gICAgICAgICAgICBjb2xsZWN0aW9uTW9kZSxcbiAgICAgICAgICAgIGdldFZpc2libGVWYWx1ZU1vZGUsXG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIGN1c3RvbURPTVByb3BlcnRpZXMsXG4gICAgICAgICAgICBjdXN0b21NZXRob2RzLFxuICAgICAgICAgICAgYXBpRm5DaGFpbixcbiAgICAgICAgICAgIGJvdW5kQXJncyxcbiAgICAgICAgfSA9IHRoaXMub3B0aW9ucztcblxuICAgICAgICByZXR1cm4gbWVyZ2Uoe30sIGRlcGVuZGVuY2llcywge1xuICAgICAgICAgICAgZmlsdGVyT3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGZpbHRlclZpc2libGUsXG4gICAgICAgICAgICAgICAgZmlsdGVySGlkZGVuLFxuICAgICAgICAgICAgICAgIGNvdW50ZXJNb2RlLFxuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb25Nb2RlLFxuICAgICAgICAgICAgICAgIGluZGV4OiBpc051bGxPclVuZGVmaW5lZChpbmRleCkgPyBudWxsIDogaW5kZXgsXG4gICAgICAgICAgICAgICAgZ2V0VmlzaWJsZVZhbHVlTW9kZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhcGlJbmZvOiB7XG4gICAgICAgICAgICAgICAgYXBpRm5DaGFpbixcbiAgICAgICAgICAgICAgICBhcGlGbklEOiB0aGlzLl9nZXRTb3VyY2VTZWxlY3RvckJ1aWxkZXJBcGlGbklEKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm91bmRBcmdzLFxuICAgICAgICAgICAgY3VzdG9tRE9NUHJvcGVydGllcyxcbiAgICAgICAgICAgIGN1c3RvbU1ldGhvZHMsXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF9jcmVhdGVUZXN0UnVuQ29tbWFuZCAoZW5jb2RlZEFyZ3MsIGVuY29kZWREZXBlbmRlbmNpZXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBFeGVjdXRlU2VsZWN0b3JDb21tYW5kKHtcbiAgICAgICAgICAgIGluc3RhbnRpYXRpb25DYWxsc2l0ZU5hbWU6IHRoaXMuY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLFxuICAgICAgICAgICAgZm5Db2RlOiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb21waWxlZEZuQ29kZSxcbiAgICAgICAgICAgIGFyZ3M6ICAgICAgICAgICAgICAgICAgICAgIGVuY29kZWRBcmdzLFxuICAgICAgICAgICAgZGVwZW5kZW5jaWVzOiAgICAgICAgICAgICAgZW5jb2RlZERlcGVuZGVuY2llcyxcbiAgICAgICAgICAgIG5lZWRFcnJvcjogICAgICAgICAgICAgICAgIHRoaXMub3B0aW9ucy5uZWVkRXJyb3IsXG4gICAgICAgICAgICBhcGlGbkNoYWluOiAgICAgICAgICAgICAgICB0aGlzLm9wdGlvbnMuYXBpRm5DaGFpbixcbiAgICAgICAgICAgIHZpc2liaWxpdHlDaGVjazogICAgICAgICAgICEhdGhpcy5vcHRpb25zLnZpc2liaWxpdHlDaGVjayxcbiAgICAgICAgICAgIHRpbWVvdXQ6ICAgICAgICAgICAgICAgICAgIHRoaXMub3B0aW9ucy50aW1lb3V0LFxuICAgICAgICAgICAgc3RyaWN0RXJyb3I6ICAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLnN0cmljdEVycm9yLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBfdmFsaWRhdGVPcHRpb25zIChvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyLl92YWxpZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgaWYgKCFpc051bGxPclVuZGVmaW5lZChvcHRpb25zLnZpc2liaWxpdHlDaGVjaykpXG4gICAgICAgICAgICBhc3NlcnRUeXBlKGlzLmJvb2xlYW4sIHRoaXMuY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLCAnVGhlIFwidmlzaWJpbGl0eUNoZWNrXCIgb3B0aW9uJywgb3B0aW9ucy52aXNpYmlsaXR5Q2hlY2spO1xuXG4gICAgICAgIGlmICghaXNOdWxsT3JVbmRlZmluZWQob3B0aW9ucy50aW1lb3V0KSlcbiAgICAgICAgICAgIGFzc2VydFR5cGUoaXMubm9uTmVnYXRpdmVOdW1iZXIsIHRoaXMuY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLCAnVGhlIFwidGltZW91dFwiIG9wdGlvbicsIG9wdGlvbnMudGltZW91dCk7XG4gICAgfVxuXG4gICAgX2dldFJlcGxpY2F0b3JUcmFuc2Zvcm1zICgpIHtcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtcyA9IHN1cGVyLl9nZXRSZXBsaWNhdG9yVHJhbnNmb3JtcygpO1xuXG4gICAgICAgIHRyYW5zZm9ybXMucHVzaChuZXcgU2VsZWN0b3JOb2RlVHJhbnNmb3JtKCkpO1xuXG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1zO1xuICAgIH1cblxuICAgIF9hZGRCb3VuZEFyZ3NTZWxlY3RvckdldHRlciAob2JqLCBzZWxlY3RvckFyZ3MpIHtcbiAgICAgICAgZGVmaW5lTGF6eVByb3BlcnR5KG9iaiwgJ3NlbGVjdG9yJywgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYnVpbGRlciA9IG5ldyBTZWxlY3RvckJ1aWxkZXIodGhpcy5nZXRGdW5jdGlvbigpLCB7IGJvdW5kQXJnczogc2VsZWN0b3JBcmdzIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gYnVpbGRlci5nZXRGdW5jdGlvbigpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBfZGVjb3JhdGVGdW5jdGlvbiAoc2VsZWN0b3JGbikge1xuICAgICAgICBzdXBlci5fZGVjb3JhdGVGdW5jdGlvbihzZWxlY3RvckZuKTtcblxuICAgICAgICBhZGRBUEkoXG4gICAgICAgICAgICBzZWxlY3RvckZuLFxuICAgICAgICAgICAgKCkgPT4gc2VsZWN0b3JGbixcbiAgICAgICAgICAgIFNlbGVjdG9yQnVpbGRlcixcbiAgICAgICAgICAgIHRoaXMub3B0aW9ucy5jdXN0b21ET01Qcm9wZXJ0aWVzLFxuICAgICAgICAgICAgdGhpcy5vcHRpb25zLmN1c3RvbU1ldGhvZHMsXG4gICAgICAgICAgICB0aGlzLl9nZXRPYnNlcnZlZENhbGxzaXRlcygpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgX2dldENsaWVudEZuV2l0aE92ZXJyaWRkZW5PcHRpb25zIChvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGFwaUZuICAgICAgICAgICAgICA9IHByZXBhcmVBcGlGbkFyZ3MoJ3dpdGgnLCBvcHRpb25zKTtcbiAgICAgICAgY29uc3QgcHJldmlvdXNTZWxlY3RvcklEID0gdGhpcy5vcHRpb25zLmFwaUZuQ2hhaW4ubGVuZ3RoIC0gMTtcblxuICAgICAgICByZXR1cm4gc3VwZXIuX2dldENsaWVudEZuV2l0aE92ZXJyaWRkZW5PcHRpb25zKE9iamVjdC5hc3NpZ24ob3B0aW9ucywgeyBhcGlGbiwgYXBpRm5JRDogcHJldmlvdXNTZWxlY3RvcklEIH0pKTtcbiAgICB9XG5cbiAgICBfcHJvY2Vzc1Jlc3VsdCAocmVzdWx0LCBzZWxlY3RvckFyZ3MpIHtcbiAgICAgICAgY29uc3Qgc25hcHNob3QgPSBzdXBlci5fcHJvY2Vzc1Jlc3VsdChyZXN1bHQsIHNlbGVjdG9yQXJncyk7XG5cbiAgICAgICAgaWYgKHNuYXBzaG90ICYmICFyZXR1cm5TaW5nbGVQcm9wTW9kZSh0aGlzLm9wdGlvbnMpKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRCb3VuZEFyZ3NTZWxlY3RvckdldHRlcihzbmFwc2hvdCwgc2VsZWN0b3JBcmdzKTtcbiAgICAgICAgICAgIGNyZWF0ZVNuYXBzaG90TWV0aG9kcyhzbmFwc2hvdCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMuY3VzdG9tTWV0aG9kcylcbiAgICAgICAgICAgICAgICBhZGRDdXN0b21NZXRob2RzKHNuYXBzaG90LCAoKSA9PiBzbmFwc2hvdC5zZWxlY3RvciwgU2VsZWN0b3JCdWlsZGVyLCB0aGlzLm9wdGlvbnMuY3VzdG9tTWV0aG9kcyk7XG5cbiAgICAgICAgICAgIGlmIChzZWxlY3RvckFwaUV4ZWN1dGlvbk1vZGUuaXNTeW5jKSB7XG4gICAgICAgICAgICAgICAgYWRkQVBJKFxuICAgICAgICAgICAgICAgICAgICBzbmFwc2hvdCxcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4gc25hcHNob3Quc2VsZWN0b3IsXG4gICAgICAgICAgICAgICAgICAgIFNlbGVjdG9yQnVpbGRlcixcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLmN1c3RvbURPTVByb3BlcnRpZXMsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMub3B0aW9ucy5jdXN0b21NZXRob2RzLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nZXRPYnNlcnZlZENhbGxzaXRlcygpLFxuICAgICAgICAgICAgICAgICAgICB0cnVlXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzbmFwc2hvdDtcbiAgICB9XG59XG5cbiJdfQ==