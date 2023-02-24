"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisableDebugCommand = exports.DebugCommand = exports.ExecuteSelectorCommand = exports.ExecuteClientFunctionCommand = exports.ExecuteClientFunctionCommandBase = exports.WaitCommand = void 0;
const type_1 = __importDefault(require("./type"));
const base_1 = require("./base");
const argument_1 = require("./validations/argument");
const lodash_1 = require("lodash");
// Commands
class WaitCommand extends base_1.ActionCommandBase {
    constructor(obj, testRun) {
        super(obj, testRun, type_1.default.wait);
    }
    getAssignableProperties() {
        return [
            { name: 'timeout', type: argument_1.positiveIntegerArgument, required: true },
        ];
    }
}
exports.WaitCommand = WaitCommand;
WaitCommand.methodName = (0, lodash_1.camelCase)(type_1.default.wait);
class ExecuteClientFunctionCommandBase extends base_1.ActionCommandBase {
    constructor(obj, testRun, type) {
        super(obj, testRun, type, false);
    }
    getAssignableProperties() {
        return [
            { name: 'instantiationCallsiteName', defaultValue: '' },
            { name: 'fnCode', defaultValue: '' },
            { name: 'args', defaultValue: [] },
            { name: 'dependencies', defaultValue: [] },
            { name: 'esmRuntime', defaultValue: null },
        ];
    }
}
exports.ExecuteClientFunctionCommandBase = ExecuteClientFunctionCommandBase;
class ExecuteClientFunctionCommand extends ExecuteClientFunctionCommandBase {
    constructor(obj, testRun) {
        super(obj, testRun, type_1.default.executeClientFunction);
    }
}
exports.ExecuteClientFunctionCommand = ExecuteClientFunctionCommand;
ExecuteClientFunctionCommand.methodName = type_1.default.executeClientFunction;
class ExecuteSelectorCommand extends ExecuteClientFunctionCommandBase {
    constructor(obj, testRun) {
        super(obj, testRun, type_1.default.executeSelector);
    }
    getAssignableProperties() {
        return [
            { name: 'visibilityCheck', defaultValue: false },
            { name: 'timeout', defaultValue: null },
            { name: 'apiFnChain' },
            { name: 'needError' },
            { name: 'index', defaultValue: 0 },
            { name: 'strictError' },
        ];
    }
}
exports.ExecuteSelectorCommand = ExecuteSelectorCommand;
ExecuteSelectorCommand.methodName = type_1.default.executeSelector;
class DebugCommand extends base_1.ActionCommandBase {
    constructor() {
        super(null, null, type_1.default.debug);
    }
}
exports.DebugCommand = DebugCommand;
DebugCommand.methodName = (0, lodash_1.camelCase)(type_1.default.debug);
class DisableDebugCommand extends base_1.ActionCommandBase {
    constructor() {
        super(null, null, type_1.default.disableDebug);
    }
}
exports.DisableDebugCommand = DisableDebugCommand;
DisableDebugCommand.methodName = (0, lodash_1.camelCase)(type_1.default.disableDebug);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdGVzdC1ydW4vY29tbWFuZHMvb2JzZXJ2YXRpb24uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsa0RBQTBCO0FBQzFCLGlDQUEyQztBQUMzQyxxREFBaUU7QUFDakUsbUNBQW1DO0FBRW5DLFdBQVc7QUFDWCxNQUFhLFdBQVksU0FBUSx3QkFBaUI7SUFHOUMsWUFBYSxHQUFHLEVBQUUsT0FBTztRQUNyQixLQUFLLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxjQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVELHVCQUF1QjtRQUNuQixPQUFPO1lBQ0gsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxrQ0FBdUIsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO1NBQ3JFLENBQUM7SUFDTixDQUFDOztBQVhMLGtDQVlDO0FBWFUsc0JBQVUsR0FBRyxJQUFBLGtCQUFTLEVBQUMsY0FBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBYTdDLE1BQWEsZ0NBQWlDLFNBQVEsd0JBQWlCO0lBQ25FLFlBQWEsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJO1FBQzNCLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsdUJBQXVCO1FBQ25CLE9BQU87WUFDSCxFQUFFLElBQUksRUFBRSwyQkFBMkIsRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFO1lBQ3ZELEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFO1lBQ3BDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFO1lBQ2xDLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFO1lBQzFDLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFO1NBQzdDLENBQUM7SUFDTixDQUFDO0NBQ0o7QUFkRCw0RUFjQztBQUVELE1BQWEsNEJBQTZCLFNBQVEsZ0NBQWdDO0lBRzlFLFlBQWEsR0FBRyxFQUFFLE9BQU87UUFDckIsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsY0FBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDcEQsQ0FBQzs7QUFMTCxvRUFNQztBQUxVLHVDQUFVLEdBQUcsY0FBSSxDQUFDLHFCQUFxQixDQUFDO0FBT25ELE1BQWEsc0JBQXVCLFNBQVEsZ0NBQWdDO0lBR3hFLFlBQWEsR0FBRyxFQUFFLE9BQU87UUFDckIsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsY0FBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCx1QkFBdUI7UUFDbkIsT0FBTztZQUNILEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUU7WUFDaEQsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUU7WUFDdkMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3RCLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNyQixFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLENBQUMsRUFBRTtZQUNsQyxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUU7U0FDMUIsQ0FBQztJQUNOLENBQUM7O0FBaEJMLHdEQWlCQztBQWhCVSxpQ0FBVSxHQUFHLGNBQUksQ0FBQyxlQUFlLENBQUM7QUFrQjdDLE1BQWEsWUFBYSxTQUFRLHdCQUFpQjtJQUcvQztRQUNJLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLGNBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNsQyxDQUFDOztBQUxMLG9DQU1DO0FBTFUsdUJBQVUsR0FBRyxJQUFBLGtCQUFTLEVBQUMsY0FBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBTzlDLE1BQWEsbUJBQW9CLFNBQVEsd0JBQWlCO0lBR3REO1FBQ0ksS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsY0FBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7O0FBTEwsa0RBTUM7QUFMVSw4QkFBVSxHQUFHLElBQUEsa0JBQVMsRUFBQyxjQUFJLENBQUMsWUFBWSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgVFlQRSBmcm9tICcuL3R5cGUnO1xuaW1wb3J0IHsgQWN0aW9uQ29tbWFuZEJhc2UgfSBmcm9tICcuL2Jhc2UnO1xuaW1wb3J0IHsgcG9zaXRpdmVJbnRlZ2VyQXJndW1lbnQgfSBmcm9tICcuL3ZhbGlkYXRpb25zL2FyZ3VtZW50JztcbmltcG9ydCB7IGNhbWVsQ2FzZSB9IGZyb20gJ2xvZGFzaCc7XG5cbi8vIENvbW1hbmRzXG5leHBvcnQgY2xhc3MgV2FpdENvbW1hbmQgZXh0ZW5kcyBBY3Rpb25Db21tYW5kQmFzZSB7XG4gICAgc3RhdGljIG1ldGhvZE5hbWUgPSBjYW1lbENhc2UoVFlQRS53YWl0KTtcblxuICAgIGNvbnN0cnVjdG9yIChvYmosIHRlc3RSdW4pIHtcbiAgICAgICAgc3VwZXIob2JqLCB0ZXN0UnVuLCBUWVBFLndhaXQpO1xuICAgIH1cblxuICAgIGdldEFzc2lnbmFibGVQcm9wZXJ0aWVzICgpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHsgbmFtZTogJ3RpbWVvdXQnLCB0eXBlOiBwb3NpdGl2ZUludGVnZXJBcmd1bWVudCwgcmVxdWlyZWQ6IHRydWUgfSxcbiAgICAgICAgXTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeGVjdXRlQ2xpZW50RnVuY3Rpb25Db21tYW5kQmFzZSBleHRlbmRzIEFjdGlvbkNvbW1hbmRCYXNlIHtcbiAgICBjb25zdHJ1Y3RvciAob2JqLCB0ZXN0UnVuLCB0eXBlKSB7XG4gICAgICAgIHN1cGVyKG9iaiwgdGVzdFJ1biwgdHlwZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIGdldEFzc2lnbmFibGVQcm9wZXJ0aWVzICgpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHsgbmFtZTogJ2luc3RhbnRpYXRpb25DYWxsc2l0ZU5hbWUnLCBkZWZhdWx0VmFsdWU6ICcnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdmbkNvZGUnLCBkZWZhdWx0VmFsdWU6ICcnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdhcmdzJywgZGVmYXVsdFZhbHVlOiBbXSB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnZGVwZW5kZW5jaWVzJywgZGVmYXVsdFZhbHVlOiBbXSB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnZXNtUnVudGltZScsIGRlZmF1bHRWYWx1ZTogbnVsbCB9LFxuICAgICAgICBdO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4ZWN1dGVDbGllbnRGdW5jdGlvbkNvbW1hbmQgZXh0ZW5kcyBFeGVjdXRlQ2xpZW50RnVuY3Rpb25Db21tYW5kQmFzZSB7XG4gICAgc3RhdGljIG1ldGhvZE5hbWUgPSBUWVBFLmV4ZWN1dGVDbGllbnRGdW5jdGlvbjtcblxuICAgIGNvbnN0cnVjdG9yIChvYmosIHRlc3RSdW4pIHtcbiAgICAgICAgc3VwZXIob2JqLCB0ZXN0UnVuLCBUWVBFLmV4ZWN1dGVDbGllbnRGdW5jdGlvbik7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXhlY3V0ZVNlbGVjdG9yQ29tbWFuZCBleHRlbmRzIEV4ZWN1dGVDbGllbnRGdW5jdGlvbkNvbW1hbmRCYXNlIHtcbiAgICBzdGF0aWMgbWV0aG9kTmFtZSA9IFRZUEUuZXhlY3V0ZVNlbGVjdG9yO1xuXG4gICAgY29uc3RydWN0b3IgKG9iaiwgdGVzdFJ1bikge1xuICAgICAgICBzdXBlcihvYmosIHRlc3RSdW4sIFRZUEUuZXhlY3V0ZVNlbGVjdG9yKTtcbiAgICB9XG5cbiAgICBnZXRBc3NpZ25hYmxlUHJvcGVydGllcyAoKSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICB7IG5hbWU6ICd2aXNpYmlsaXR5Q2hlY2snLCBkZWZhdWx0VmFsdWU6IGZhbHNlIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICd0aW1lb3V0JywgZGVmYXVsdFZhbHVlOiBudWxsIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdhcGlGbkNoYWluJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnbmVlZEVycm9yJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnaW5kZXgnLCBkZWZhdWx0VmFsdWU6IDAgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ3N0cmljdEVycm9yJyB9LFxuICAgICAgICBdO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIERlYnVnQ29tbWFuZCBleHRlbmRzIEFjdGlvbkNvbW1hbmRCYXNlIHtcbiAgICBzdGF0aWMgbWV0aG9kTmFtZSA9IGNhbWVsQ2FzZShUWVBFLmRlYnVnKTtcblxuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgc3VwZXIobnVsbCwgbnVsbCwgVFlQRS5kZWJ1Zyk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGlzYWJsZURlYnVnQ29tbWFuZCBleHRlbmRzIEFjdGlvbkNvbW1hbmRCYXNlIHtcbiAgICBzdGF0aWMgbWV0aG9kTmFtZSA9IGNhbWVsQ2FzZShUWVBFLmRpc2FibGVEZWJ1Zyk7XG5cbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHN1cGVyKG51bGwsIG51bGwsIFRZUEUuZGlzYWJsZURlYnVnKTtcbiAgICB9XG59XG5cbiJdfQ==