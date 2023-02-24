"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const test_run_tracker_1 = __importDefault(require("../api/test-run-tracker"));
const builder_symbol_1 = __importDefault(require("./builder-symbol"));
const replicator_1 = require("./replicator");
const observation_1 = require("../test-run/commands/observation");
const compile_client_function_1 = __importDefault(require("../compiler/compile-client-function"));
const runtime_1 = require("../errors/runtime");
const type_assertions_1 = require("../errors/runtime/type-assertions");
const types_1 = require("../errors/types");
const get_callsite_1 = require("../errors/get-callsite");
const re_executable_promise_1 = __importDefault(require("../utils/re-executable-promise"));
const marker_symbol_1 = __importDefault(require("../test-run/marker-symbol"));
const selector_api_execution_mode_1 = __importDefault(require("./selector-api-execution-mode"));
const check_element_delay_1 = __importDefault(require("../client/driver/command-executors/client-functions/selector-executor/check-element-delay"));
const templates_1 = __importDefault(require("../errors/test-run/templates"));
const dedent_1 = __importDefault(require("dedent"));
const DEFAULT_EXECUTION_CALLSITE_NAME = '__$$clientFunction$$';
class ClientFunctionBuilder {
    constructor(fn, options, callsiteNames = {}) {
        this.callsiteNames = {
            instantiation: callsiteNames.instantiation,
            execution: callsiteNames.execution || DEFAULT_EXECUTION_CALLSITE_NAME,
        };
        if ((0, lodash_1.isNil)(options))
            options = {};
        this._validateOptions(options);
        this.fn = fn;
        this.options = options;
        this.compiledFnCode = this._getCompiledFnCode();
        if (!this.compiledFnCode)
            throw this._createInvalidFnTypeError();
        this.replicator = (0, replicator_1.createReplicator)(this._getReplicatorTransforms());
    }
    _renderError(error) {
        // The rendered template is shown in the Watch panel of browser dev tools or IDE.
        // Viewport size is unlimited there.
        const viewportWidth = Number.MIN_SAFE_INTEGER;
        const renderedMessage = templates_1.default[error.code](error, viewportWidth);
        return (0, dedent_1.default)(renderedMessage);
    }
    _decorateFunction(clientFn) {
        clientFn[builder_symbol_1.default] = this;
        clientFn.with = options => {
            return this._getClientFnWithOverriddenOptions(options);
        };
    }
    _getClientFnWithOverriddenOptions(options) {
        if (typeof options === 'object')
            options = (0, lodash_1.assign)({}, this.options, options);
        const builder = new this.constructor(this.fn, options, {
            instantiation: 'with',
            execution: this.callsiteNames.execution,
        });
        return builder.getFunction();
    }
    getBoundTestRun() {
        // NOTE: `boundTestRun` can be either TestController or TestRun instance.
        if (this.options.boundTestRun)
            return this.options.boundTestRun.testRun || this.options.boundTestRun;
        return null;
    }
    _getTestRun() {
        return this.getBoundTestRun() || test_run_tracker_1.default.resolveContextTestRun();
    }
    _getObservedCallsites() {
        var _a;
        return ((_a = this._getTestRun()) === null || _a === void 0 ? void 0 : _a.observedCallsites) || null;
    }
    getFunction() {
        const builder = this;
        const clientFn = function __$$clientFunction$$() {
            const testRun = builder._getTestRun();
            const callsite = (0, get_callsite_1.getCallsiteForMethod)(builder.callsiteNames.execution);
            const args = [];
            // OPTIMIZATION: don't leak `arguments` object.
            for (let i = 0; i < arguments.length; i++)
                args.push(arguments[i]);
            if (selector_api_execution_mode_1.default.isSync)
                return builder._executeCommandSync(args, testRun, callsite);
            return builder._executeCommand(args, testRun, callsite);
        };
        this._decorateFunction(clientFn);
        return clientFn;
    }
    getCommand(args = []) {
        const encodedArgs = this.replicator.encode(args);
        const encodedDependencies = this.replicator.encode(this.getFunctionDependencies());
        return this._createTestRunCommand(encodedArgs, encodedDependencies);
    }
    // Overridable methods
    getFunctionDependencies() {
        return this.options.dependencies || {};
    }
    _createTestRunCommand(encodedArgs, encodedDependencies) {
        return new observation_1.ExecuteClientFunctionCommand({
            instantiationCallsiteName: this.callsiteNames.instantiation,
            fnCode: this.compiledFnCode,
            args: encodedArgs,
            dependencies: encodedDependencies,
        }, this._getTestRun());
    }
    _getCompiledFnCode() {
        if (typeof this.fn === 'function')
            return (0, compile_client_function_1.default)(this.fn.toString(), this.options.dependencies, this.callsiteNames.instantiation, this.callsiteNames.instantiation);
        return null;
    }
    _createInvalidFnTypeError() {
        return new runtime_1.ClientFunctionAPIError(this.callsiteNames.instantiation, this.callsiteNames.instantiation, types_1.RUNTIME_ERRORS.clientFunctionCodeIsNotAFunction, typeof this.fn);
    }
    _executeCommand(args, testRun, callsite) {
        // NOTE: should be kept outside of lazy promise to preserve
        // correct callsite in case of replicator error.
        const command = this.getCommand(args);
        return re_executable_promise_1.default.fromFn(async () => {
            if (!testRun) {
                const err = new runtime_1.ClientFunctionAPIError(this.callsiteNames.execution, this.callsiteNames.instantiation, types_1.RUNTIME_ERRORS.clientFunctionCannotResolveTestRun);
                // NOTE: force callsite here, because more likely it will
                // be impossible to resolve it by method name from a lazy promise.
                err.callsite = callsite;
                throw err;
            }
            const result = await testRun.executeCommand(command, callsite);
            return this._processResult(result, args);
        });
    }
    _executeCommandSync(args, testRun, callsite) {
        // NOTE: should be kept outside of lazy promise to preserve
        // correct callsite in case of replicator error.
        const command = this.getCommand(args);
        if (!testRun) {
            const err = new runtime_1.ClientFunctionAPIError(this.callsiteNames.execution, this.callsiteNames.instantiation, types_1.RUNTIME_ERRORS.clientFunctionCannotResolveTestRun);
            // NOTE: force callsite here, because more likely it will
            // be impossible to resolve it by method name from a lazy promise.
            err.callsite = callsite;
            throw err;
        }
        // NOTE: reset the command timeout to minimal check interval to
        // ensure the find element loop will execute only one time.
        if (typeof command.timeout !== 'number')
            command.timeout = check_element_delay_1.default;
        try {
            const result = testRun.executeCommandSync(command, callsite);
            return this._processResult(result, args);
        }
        catch (err) {
            throw this._renderError(err);
        }
    }
    _processResult(result) {
        return this.replicator.decode(result);
    }
    _validateOptions(options) {
        (0, type_assertions_1.assertType)(type_assertions_1.is.nonNullObject, this.callsiteNames.instantiation, 'The "options" argument', options);
        if (!(0, lodash_1.isNil)(options.boundTestRun)) {
            // NOTE: `boundTestRun` can be either TestController or TestRun instance.
            const boundTestRun = options.boundTestRun.testRun || options.boundTestRun;
            if (!boundTestRun[marker_symbol_1.default])
                throw new runtime_1.APIError(this.callsiteNames.instantiation, types_1.RUNTIME_ERRORS.invalidClientFunctionTestRunBinding);
        }
        if (!(0, lodash_1.isNil)(options.dependencies))
            (0, type_assertions_1.assertType)(type_assertions_1.is.nonNullObject, this.callsiteNames.instantiation, 'The "dependencies" option', options.dependencies);
    }
    _getReplicatorTransforms() {
        return [
            new replicator_1.FunctionTransform(this.callsiteNames),
        ];
    }
}
exports.default = ClientFunctionBuilder;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50LWZ1bmN0aW9uLWJ1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY2xpZW50LWZ1bmN0aW9ucy9jbGllbnQtZnVuY3Rpb24tYnVpbGRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1DQUE0RDtBQUM1RCwrRUFBcUQ7QUFDckQsc0VBQXFEO0FBQ3JELDZDQUFtRTtBQUNuRSxrRUFBZ0Y7QUFDaEYsa0dBQXdFO0FBQ3hFLCtDQUFxRTtBQUNyRSx1RUFBbUU7QUFDbkUsMkNBQWlEO0FBQ2pELHlEQUE4RDtBQUM5RCwyRkFBaUU7QUFDakUsOEVBQXNEO0FBQ3RELGdHQUFxRTtBQUNyRSxvSkFBNEg7QUFDNUgsNkVBQXFEO0FBQ3JELG9EQUE0QjtBQUU1QixNQUFNLCtCQUErQixHQUFHLHNCQUFzQixDQUFDO0FBRS9ELE1BQXFCLHFCQUFxQjtJQUN0QyxZQUFhLEVBQUUsRUFBRSxPQUFPLEVBQUUsYUFBYSxHQUFHLEVBQUU7UUFDeEMsSUFBSSxDQUFDLGFBQWEsR0FBRztZQUNqQixhQUFhLEVBQUUsYUFBYSxDQUFDLGFBQWE7WUFDMUMsU0FBUyxFQUFNLGFBQWEsQ0FBQyxTQUFTLElBQUksK0JBQStCO1NBQzVFLENBQUM7UUFFRixJQUFJLElBQUEsY0FBaUIsRUFBQyxPQUFPLENBQUM7WUFDMUIsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUVqQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFL0IsSUFBSSxDQUFDLEVBQUUsR0FBZSxFQUFFLENBQUM7UUFDekIsSUFBSSxDQUFDLE9BQU8sR0FBVSxPQUFPLENBQUM7UUFDOUIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUVoRCxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWM7WUFDcEIsTUFBTSxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUUzQyxJQUFJLENBQUMsVUFBVSxH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QUEsY0FBaUIsRUFBQyxPQUFPLENBQUMsWUFBWSxDQUFDO1lBQ3hDLElBQUEsNEJBQVUsRUFBQyxvQkFBRSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBRSwyQkFBMkIsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDMUgsQ0FBQztJQUVELHdCQUF3QjtRQUNwQixPQUFPO1lBQ0gsSUFBSSw4QkFBaUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO1NBQzVDLENBQUM7SUFDTixDQUFDO0NBQ0o7QUF2TUQsd0NBdU1DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNOaWwgYXMgaXNOdWxsT3JVbmRlZmluZWQsIGFzc2lnbiB9IGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgdGVzdFJ1blRyYWNrZXIgZnJvbSAnLi4vYXBpL3Rlc3QtcnVuLXRyYWNrZXInO1xuaW1wb3J0IGZ1bmN0aW9uQnVpbGRlclN5bWJvbCBmcm9tICcuL2J1aWxkZXItc3ltYm9sJztcbmltcG9ydCB7IGNyZWF0ZVJlcGxpY2F0b3IsIEZ1bmN0aW9uVHJhbnNmb3JtIH0gZnJvbSAnLi9yZXBsaWNhdG9yJztcbmltcG9ydCB7IEV4ZWN1dGVDbGllbnRGdW5jdGlvbkNvbW1hbmQgfSBmcm9tICcuLi90ZXN0LXJ1bi9jb21tYW5kcy9vYnNlcnZhdGlvbic7XG5pbXBvcnQgY29tcGlsZUNsaWVudEZ1bmN0aW9uIGZyb20gJy4uL2NvbXBpbGVyL2NvbXBpbGUtY2xpZW50LWZ1bmN0aW9uJztcbmltcG9ydCB7IEFQSUVycm9yLCBDbGllbnRGdW5jdGlvbkFQSUVycm9yIH0gZnJvbSAnLi4vZXJyb3JzL3J1bnRpbWUnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSwgaXMgfSBmcm9tICcuLi9lcnJvcnMvcnVudGltZS90eXBlLWFzc2VydGlvbnMnO1xuaW1wb3J0IHsgUlVOVElNRV9FUlJPUlMgfSBmcm9tICcuLi9lcnJvcnMvdHlwZXMnO1xuaW1wb3J0IHsgZ2V0Q2FsbHNpdGVGb3JNZXRob2QgfSBmcm9tICcuLi9lcnJvcnMvZ2V0LWNhbGxzaXRlJztcbmltcG9ydCBSZUV4ZWN1dGFibGVQcm9taXNlIGZyb20gJy4uL3V0aWxzL3JlLWV4ZWN1dGFibGUtcHJvbWlzZSc7XG5pbXBvcnQgdGVzdFJ1bk1hcmtlciBmcm9tICcuLi90ZXN0LXJ1bi9tYXJrZXItc3ltYm9sJztcbmltcG9ydCBzZWxlY3RvckFwaUV4ZWN1dGlvbk1vZGUgZnJvbSAnLi9zZWxlY3Rvci1hcGktZXhlY3V0aW9uLW1vZGUnO1xuaW1wb3J0IENIRUNLX0VMRU1FTlRfREVMQVkgZnJvbSAnLi4vY2xpZW50L2RyaXZlci9jb21tYW5kLWV4ZWN1dG9ycy9jbGllbnQtZnVuY3Rpb25zL3NlbGVjdG9yLWV4ZWN1dG9yL2NoZWNrLWVsZW1lbnQtZGVsYXknO1xuaW1wb3J0IFRFTVBMQVRFUyBmcm9tICcuLi9lcnJvcnMvdGVzdC1ydW4vdGVtcGxhdGVzJztcbmltcG9ydCBkZWRlbnQgZnJvbSAnZGVkZW50JztcblxuY29uc3QgREVGQVVMVF9FWEVDVVRJT05fQ0FMTFNJVEVfTkFNRSA9ICdfXyQkY2xpZW50RnVuY3Rpb24kJCc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENsaWVudEZ1bmN0aW9uQnVpbGRlciB7XG4gICAgY29uc3RydWN0b3IgKGZuLCBvcHRpb25zLCBjYWxsc2l0ZU5hbWVzID0ge30pIHtcbiAgICAgICAgdGhpcy5jYWxsc2l0ZU5hbWVzID0ge1xuICAgICAgICAgICAgaW5zdGFudGlhdGlvbjogY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLFxuICAgICAgICAgICAgZXhlY3V0aW9uOiAgICAgY2FsbHNpdGVOYW1lcy5leGVjdXRpb24gfHwgREVGQVVMVF9FWEVDVVRJT05fQ0FMTFNJVEVfTkFNRSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoaXNOdWxsT3JVbmRlZmluZWQob3B0aW9ucykpXG4gICAgICAgICAgICBvcHRpb25zID0ge307XG5cbiAgICAgICAgdGhpcy5fdmFsaWRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHRoaXMuZm4gICAgICAgICAgICAgPSBmbjtcbiAgICAgICAgdGhpcy5vcHRpb25zICAgICAgICA9IG9wdGlvbnM7XG4gICAgICAgIHRoaXMuY29tcGlsZWRGbkNvZGUgPSB0aGlzLl9nZXRDb21waWxlZEZuQ29kZSgpO1xuXG4gICAgICAgIGlmICghdGhpcy5jb21waWxlZEZuQ29kZSlcbiAgICAgICAgICAgIHRocm93IHRoaXMuX2NyZWF0ZUludmFsaWRGblR5cGVFcnJvcigpO1xuXG4gICAgICAgIHRoaXMucmVwbGljYXRvciA9IGNyZWF0ZVJlcGxpY2F0b3IodGhpcy5fZ2V0UmVwbGljYXRvclRyYW5zZm9ybXMoKSk7XG4gICAgfVxuXG4gICAgX3JlbmRlckVycm9yIChlcnJvcikge1xuICAgICAgICAvLyBUaGUgcmVuZGVyZWQgdGVtcGxhdGUgaXMgc2hvd24gaW4gdGhlIFdhdGNoIHBhbmVsIG9mIGJyb3dzZXIgZGV2IHRvb2xzIG9yIElERS5cbiAgICAgICAgLy8gVmlld3BvcnQgc2l6ZSBpcyB1bmxpbWl0ZWQgdGhlcmUuXG4gICAgICAgIGNvbnN0IHZpZXdwb3J0V2lkdGggICA9IE51bWJlci5NSU5fU0FGRV9JTlRFR0VSO1xuICAgICAgICBjb25zdCByZW5kZXJlZE1lc3NhZ2UgPSBURU1QTEFURVNbZXJyb3IuY29kZV0oZXJyb3IsIHZpZXdwb3J0V2lkdGgpO1xuXG4gICAgICAgIHJldHVybiBkZWRlbnQocmVuZGVyZWRNZXNzYWdlKTtcbiAgICB9XG5cbiAgICBfZGVjb3JhdGVGdW5jdGlvbiAoY2xpZW50Rm4pIHtcbiAgICAgICAgY2xpZW50Rm5bZnVuY3Rpb25CdWlsZGVyU3ltYm9sXSA9IHRoaXM7XG5cbiAgICAgICAgY2xpZW50Rm4ud2l0aCA9IG9wdGlvbnMgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldENsaWVudEZuV2l0aE92ZXJyaWRkZW5PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIF9nZXRDbGllbnRGbldpdGhPdmVycmlkZGVuT3B0aW9ucyAob3B0aW9ucykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnKVxuICAgICAgICAgICAgb3B0aW9ucyA9IGFzc2lnbih7fSwgdGhpcy5vcHRpb25zLCBvcHRpb25zKTtcblxuICAgICAgICBjb25zdCBidWlsZGVyID0gbmV3IHRoaXMuY29uc3RydWN0b3IodGhpcy5mbiwgb3B0aW9ucywge1xuICAgICAgICAgICAgaW5zdGFudGlhdGlvbjogJ3dpdGgnLFxuICAgICAgICAgICAgZXhlY3V0aW9uOiAgICAgdGhpcy5jYWxsc2l0ZU5hbWVzLmV4ZWN1dGlvbixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGJ1aWxkZXIuZ2V0RnVuY3Rpb24oKTtcbiAgICB9XG5cbiAgICBnZXRCb3VuZFRlc3RSdW4gKCkge1xuICAgICAgICAvLyBOT1RFOiBgYm91bmRUZXN0UnVuYCBjYW4gYmUgZWl0aGVyIFRlc3RDb250cm9sbGVyIG9yIFRlc3RSdW4gaW5zdGFuY2UuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYm91bmRUZXN0UnVuKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5ib3VuZFRlc3RSdW4udGVzdFJ1biB8fCB0aGlzLm9wdGlvbnMuYm91bmRUZXN0UnVuO1xuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIF9nZXRUZXN0UnVuICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Qm91bmRUZXN0UnVuKCkgfHwgdGVzdFJ1blRyYWNrZXIucmVzb2x2ZUNvbnRleHRUZXN0UnVuKCk7XG4gICAgfVxuXG4gICAgX2dldE9ic2VydmVkQ2FsbHNpdGVzICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFRlc3RSdW4oKT8ub2JzZXJ2ZWRDYWxsc2l0ZXMgfHwgbnVsbDtcbiAgICB9XG5cbiAgICBnZXRGdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSB0aGlzO1xuXG4gICAgICAgIGNvbnN0IGNsaWVudEZuID0gZnVuY3Rpb24gX18kJGNsaWVudEZ1bmN0aW9uJCQgKCkge1xuICAgICAgICAgICAgY29uc3QgdGVzdFJ1biAgPSBidWlsZGVyLl9nZXRUZXN0UnVuKCk7XG4gICAgICAgICAgICBjb25zdCBjYWxsc2l0ZSA9IGdldENhbGxzaXRlRm9yTWV0aG9kKGJ1aWxkZXIuY2FsbHNpdGVOYW1lcy5leGVjdXRpb24pO1xuICAgICAgICAgICAgY29uc3QgYXJncyAgICAgPSBbXTtcblxuICAgICAgICAgICAgLy8gT1BUSU1JWkFUSU9OOiBkb24ndCBsZWFrIGBhcmd1bWVudHNgIG9iamVjdC5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgICAgIGFyZ3MucHVzaChhcmd1bWVudHNbaV0pO1xuXG4gICAgICAgICAgICBpZiAoc2VsZWN0b3JBcGlFeGVjdXRpb25Nb2RlLmlzU3luYylcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVpbGRlci5fZXhlY3V0ZUNvbW1hbmRTeW5jKGFyZ3MsIHRlc3RSdW4sIGNhbGxzaXRlKTtcblxuICAgICAgICAgICAgcmV0dXJuIGJ1aWxkZXIuX2V4ZWN1dGVDb21tYW5kKGFyZ3MsIHRlc3RSdW4sIGNhbGxzaXRlKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9kZWNvcmF0ZUZ1bmN0aW9uKGNsaWVudEZuKTtcblxuICAgICAgICByZXR1cm4gY2xpZW50Rm47XG4gICAgfVxuXG4gICAgZ2V0Q29tbWFuZCAoYXJncyA9IFtdKSB7XG4gICAgICAgIGNvbnN0IGVuY29kZWRBcmdzICAgICAgICAgPSB0aGlzLnJlcGxpY2F0b3IuZW5jb2RlKGFyZ3MpO1xuICAgICAgICBjb25zdCBlbmNvZGVkRGVwZW5kZW5jaWVzID0gdGhpcy5yZXBsaWNhdG9yLmVuY29kZSh0aGlzLmdldEZ1bmN0aW9uRGVwZW5kZW5jaWVzKCkpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9jcmVhdGVUZXN0UnVuQ29tbWFuZChlbmNvZGVkQXJncywgZW5jb2RlZERlcGVuZGVuY2llcyk7XG4gICAgfVxuXG5cbiAgICAvLyBPdmVycmlkYWJsZSBtZXRob2RzXG4gICAgZ2V0RnVuY3Rpb25EZXBlbmRlbmNpZXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmRlcGVuZGVuY2llcyB8fCB7fTtcbiAgICB9XG5cbiAgICBfY3JlYXRlVGVzdFJ1bkNvbW1hbmQgKGVuY29kZWRBcmdzLCBlbmNvZGVkRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIHJldHVybiBuZXcgRXhlY3V0ZUNsaWVudEZ1bmN0aW9uQ29tbWFuZCh7XG4gICAgICAgICAgICBpbnN0YW50aWF0aW9uQ2FsbHNpdGVOYW1lOiB0aGlzLmNhbGxzaXRlTmFtZXMuaW5zdGFudGlhdGlvbixcbiAgICAgICAgICAgIGZuQ29kZTogICAgICAgICAgICAgICAgICAgIHRoaXMuY29tcGlsZWRGbkNvZGUsXG4gICAgICAgICAgICBhcmdzOiAgICAgICAgICAgICAgICAgICAgICBlbmNvZGVkQXJncyxcbiAgICAgICAgICAgIGRlcGVuZGVuY2llczogICAgICAgICAgICAgIGVuY29kZWREZXBlbmRlbmNpZXMsXG4gICAgICAgIH0sIHRoaXMuX2dldFRlc3RSdW4oKSk7XG4gICAgfVxuXG4gICAgX2dldENvbXBpbGVkRm5Db2RlICgpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmZuID09PSAnZnVuY3Rpb24nKVxuICAgICAgICAgICAgcmV0dXJuIGNvbXBpbGVDbGllbnRGdW5jdGlvbih0aGlzLmZuLnRvU3RyaW5nKCksIHRoaXMub3B0aW9ucy5kZXBlbmRlbmNpZXMsIHRoaXMuY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLCB0aGlzLmNhbGxzaXRlTmFtZXMuaW5zdGFudGlhdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgX2NyZWF0ZUludmFsaWRGblR5cGVFcnJvciAoKSB7XG4gICAgICAgIHJldHVybiBuZXcgQ2xpZW50RnVuY3Rpb25BUElFcnJvcih0aGlzLmNhbGxzaXRlTmFtZXMuaW5zdGFudGlhdGlvbiwgdGhpcy5jYWxsc2l0ZU5hbWVzLmluc3RhbnRpYXRpb24sIFJVTlRJTUVfRVJST1JTLmNsaWVudEZ1bmN0aW9uQ29kZUlzTm90QUZ1bmN0aW9uLCB0eXBlb2YgdGhpcy5mbik7XG4gICAgfVxuXG4gICAgX2V4ZWN1dGVDb21tYW5kIChhcmdzLCB0ZXN0UnVuLCBjYWxsc2l0ZSkge1xuICAgICAgICAvLyBOT1RFOiBzaG91bGQgYmUga2VwdCBvdXRzaWRlIG9mIGxhenkgcHJvbWlzZSB0byBwcmVzZXJ2ZVxuICAgICAgICAvLyBjb3JyZWN0IGNhbGxzaXRlIGluIGNhc2Ugb2YgcmVwbGljYXRvciBlcnJvci5cbiAgICAgICAgY29uc3QgY29tbWFuZCA9IHRoaXMuZ2V0Q29tbWFuZChhcmdzKTtcblxuICAgICAgICByZXR1cm4gUmVFeGVjdXRhYmxlUHJvbWlzZS5mcm9tRm4oYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0ZXN0UnVuKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IENsaWVudEZ1bmN0aW9uQVBJRXJyb3IodGhpcy5jYWxsc2l0ZU5hbWVzLmV4ZWN1dGlvbiwgdGhpcy5jYWxsc2l0ZU5hbWVzLmluc3RhbnRpYXRpb24sIFJVTlRJTUVfRVJST1JTLmNsaWVudEZ1bmN0aW9uQ2Fubm90UmVzb2x2ZVRlc3RSdW4pO1xuXG4gICAgICAgICAgICAgICAgLy8gTk9URTogZm9yY2UgY2FsbHNpdGUgaGVyZSwgYmVjYXVzZSBtb3JlIGxpa2VseSBpdCB3aWxsXG4gICAgICAgICAgICAgICAgLy8gYmUgaW1wb3NzaWJsZSB0byByZXNvbHZlIGl0IGJ5IG1ldGhvZCBuYW1lIGZyb20gYSBsYXp5IHByb21pc2UuXG4gICAgICAgICAgICAgICAgZXJyLmNhbGxzaXRlID0gY2FsbHNpdGU7XG5cbiAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlc3RSdW4uZXhlY3V0ZUNvbW1hbmQoY29tbWFuZCwgY2FsbHNpdGUpO1xuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJvY2Vzc1Jlc3VsdChyZXN1bHQsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBfZXhlY3V0ZUNvbW1hbmRTeW5jIChhcmdzLCB0ZXN0UnVuLCBjYWxsc2l0ZSkge1xuICAgICAgICAvLyBOT1RFOiBzaG91bGQgYmUga2VwdCBvdXRzaWRlIG9mIGxhenkgcHJvbWlzZSB0byBwcmVzZXJ2ZVxuICAgICAgICAvLyBjb3JyZWN0IGNhbGxzaXRlIGluIGNhc2Ugb2YgcmVwbGljYXRvciBlcnJvci5cbiAgICAgICAgY29uc3QgY29tbWFuZCA9IHRoaXMuZ2V0Q29tbWFuZChhcmdzKTtcblxuICAgICAgICBpZiAoIXRlc3RSdW4pIHtcbiAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBDbGllbnRGdW5jdGlvbkFQSUVycm9yKHRoaXMuY2FsbHNpdGVOYW1lcy5leGVjdXRpb24sIHRoaXMuY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLCBSVU5USU1FX0VSUk9SUy5jbGllbnRGdW5jdGlvbkNhbm5vdFJlc29sdmVUZXN0UnVuKTtcblxuICAgICAgICAgICAgLy8gTk9URTogZm9yY2UgY2FsbHNpdGUgaGVyZSwgYmVjYXVzZSBtb3JlIGxpa2VseSBpdCB3aWxsXG4gICAgICAgICAgICAvLyBiZSBpbXBvc3NpYmxlIHRvIHJlc29sdmUgaXQgYnkgbWV0aG9kIG5hbWUgZnJvbSBhIGxhenkgcHJvbWlzZS5cbiAgICAgICAgICAgIGVyci5jYWxsc2l0ZSA9IGNhbGxzaXRlO1xuXG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOT1RFOiByZXNldCB0aGUgY29tbWFuZCB0aW1lb3V0IHRvIG1pbmltYWwgY2hlY2sgaW50ZXJ2YWwgdG9cbiAgICAgICAgLy8gZW5zdXJlIHRoZSBmaW5kIGVsZW1lbnQgbG9vcCB3aWxsIGV4ZWN1dGUgb25seSBvbmUgdGltZS5cbiAgICAgICAgaWYgKHR5cGVvZiBjb21tYW5kLnRpbWVvdXQgIT09ICdudW1iZXInKVxuICAgICAgICAgICAgY29tbWFuZC50aW1lb3V0ID0gQ0hFQ0tfRUxFTUVOVF9ERUxBWTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdGVzdFJ1bi5leGVjdXRlQ29tbWFuZFN5bmMoY29tbWFuZCwgY2FsbHNpdGUpO1xuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJvY2Vzc1Jlc3VsdChyZXN1bHQsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRocm93IHRoaXMuX3JlbmRlckVycm9yKGVycik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcHJvY2Vzc1Jlc3VsdCAocmVzdWx0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxpY2F0b3IuZGVjb2RlKHJlc3VsdCk7XG4gICAgfVxuXG4gICAgX3ZhbGlkYXRlT3B0aW9ucyAob3B0aW9ucykge1xuICAgICAgICBhc3NlcnRUeXBlKGlzLm5vbk51bGxPYmplY3QsIHRoaXMuY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLCAnVGhlIFwib3B0aW9uc1wiIGFyZ3VtZW50Jywgb3B0aW9ucyk7XG5cbiAgICAgICAgaWYgKCFpc051bGxPclVuZGVmaW5lZChvcHRpb25zLmJvdW5kVGVzdFJ1bikpIHtcbiAgICAgICAgICAgIC8vIE5PVEU6IGBib3VuZFRlc3RSdW5gIGNhbiBiZSBlaXRoZXIgVGVzdENvbnRyb2xsZXIgb3IgVGVzdFJ1biBpbnN0YW5jZS5cbiAgICAgICAgICAgIGNvbnN0IGJvdW5kVGVzdFJ1biA9IG9wdGlvbnMuYm91bmRUZXN0UnVuLnRlc3RSdW4gfHwgb3B0aW9ucy5ib3VuZFRlc3RSdW47XG5cbiAgICAgICAgICAgIGlmICghYm91bmRUZXN0UnVuW3Rlc3RSdW5NYXJrZXJdKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBBUElFcnJvcih0aGlzLmNhbGxzaXRlTmFtZXMuaW5zdGFudGlhdGlvbiwgUlVOVElNRV9FUlJPUlMuaW52YWxpZENsaWVudEZ1bmN0aW9uVGVzdFJ1bkJpbmRpbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc051bGxPclVuZGVmaW5lZChvcHRpb25zLmRlcGVuZGVuY2llcykpXG4gICAgICAgICAgICBhc3NlcnRUeXBlKGlzLm5vbk51bGxPYmplY3QsIHRoaXMuY2FsbHNpdGVOYW1lcy5pbnN0YW50aWF0aW9uLCAnVGhlIFwiZGVwZW5kZW5jaWVzXCIgb3B0aW9uJywgb3B0aW9ucy5kZXBlbmRlbmNpZXMpO1xuICAgIH1cblxuICAgIF9nZXRSZXBsaWNhdG9yVHJhbnNmb3JtcyAoKSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBuZXcgRnVuY3Rpb25UcmFuc2Zvcm0odGhpcy5jYWxsc2l0ZU5hbWVzKSxcbiAgICAgICAgXTtcbiAgICB9XG59XG4iXX0=