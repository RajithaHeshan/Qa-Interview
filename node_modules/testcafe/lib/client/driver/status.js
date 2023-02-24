"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assignable_1 = __importDefault(require("../../utils/assignable"));
const generate_id_1 = __importDefault(require("./generate-id"));
class DriverStatus extends assignable_1.default {
    constructor(obj) {
        super(obj);
        this.id = (0, generate_id_1.default)();
        this.isCommandResult = false;
        this.executionError = null;
        this.pageError = null;
        this.resent = false;
        this.result = null;
        this.consoleMessages = null;
        this.isPendingWindowSwitching = false;
        this.isObservingFileDownloadingInNewWindow = false;
        this.isFirstRequestAfterWindowSwitching = false;
        this.debug = '';
        this.warnings = null;
        this._assignFrom(obj, true);
    }
    getAssignableProperties() {
        return [
            { name: 'isCommandResult' },
            { name: 'executionError' },
            { name: 'pageError' },
            { name: 'result' },
            { name: 'consoleMessages' },
            { name: 'isPendingWindowSwitching' },
            { name: 'isObservingFileDownloadingInNewWindow' },
            { name: 'isFirstRequestAfterWindowSwitching' },
            { name: 'warnings' },
        ];
    }
}
exports.default = DriverStatus;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NsaWVudC9kcml2ZXIvc3RhdHVzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0VBQWdEO0FBQ2hELGdFQUF1QztBQUd2QyxNQUFxQixZQUFhLFNBQVEsb0JBQVU7SUFDaEQsWUFBYSxHQUFHO1FBQ1osS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRVgsSUFBSSxDQUFDLEVBQUUsR0FBc0MsSUFBQSxxQkFBVSxHQUFFLENBQUM7UUFDMUQsSUFBSSxDQUFDLGVBQWUsR0FBeUIsS0FBSyxDQUFDO1FBQ25ELElBQUksQ0FBQyxjQUFjLEdBQTBCLElBQUksQ0FBQztRQUNsRCxJQUFJLENBQUMsU0FBUyxHQUErQixJQUFJLENBQUM7UUFDbEQsSUFBSSxDQUFDLE1BQU0sR0FBa0MsS0FBSyxDQUFDO1FBQ25ELElBQUksQ0FBQyxNQUFNLEdBQWtDLElBQUksQ0FBQztRQUNsRCxJQUFJLENBQUMsZUFBZSxHQUF5QixJQUFJLENBQUM7UUFDbEQsSUFBSSxDQUFDLHdCQUF3QixHQUFnQixLQUFLLENBQUM7UUFDbkQsSUFBSSxDQUFDLHFDQUFxQyxHQUFHLEtBQUssQ0FBQztRQUNuRCxJQUFJLENBQUMsa0NBQWtDLEdBQU0sS0FBSyxDQUFDO1FBQ25ELElBQUksQ0FBQyxLQUFLLEdBQW1DLEVBQUUsQ0FBQztRQUNoRCxJQUFJLENBQUMsUUFBUSxHQUFnQyxJQUFJLENBQUM7UUFFbEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVELHVCQUF1QjtRQUNuQixPQUFPO1lBQ0gsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDM0IsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDMUIsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ3JCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUNsQixFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUMzQixFQUFFLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNwQyxFQUFFLElBQUksRUFBRSx1Q0FBdUMsRUFBRTtZQUNqRCxFQUFFLElBQUksRUFBRSxvQ0FBb0MsRUFBRTtZQUM5QyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUU7U0FDdkIsQ0FBQztJQUNOLENBQUM7Q0FDSjtBQWpDRCwrQkFpQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQXNzaWduYWJsZSBmcm9tICcuLi8uLi91dGlscy9hc3NpZ25hYmxlJztcbmltcG9ydCBnZW5lcmF0ZUlkIGZyb20gJy4vZ2VuZXJhdGUtaWQnO1xuXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERyaXZlclN0YXR1cyBleHRlbmRzIEFzc2lnbmFibGUge1xuICAgIGNvbnN0cnVjdG9yIChvYmopIHtcbiAgICAgICAgc3VwZXIob2JqKTtcblxuICAgICAgICB0aGlzLmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPSBnZW5lcmF0ZUlkKCk7XG4gICAgICAgIHRoaXMuaXNDb21tYW5kUmVzdWx0ICAgICAgICAgICAgICAgICAgICAgICA9IGZhbHNlO1xuICAgICAgICB0aGlzLmV4ZWN1dGlvbkVycm9yICAgICAgICAgICAgICAgICAgICAgICAgPSBudWxsO1xuICAgICAgICB0aGlzLnBhZ2VFcnJvciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPSBudWxsO1xuICAgICAgICB0aGlzLnJlc2VudCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5yZXN1bHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb25zb2xlTWVzc2FnZXMgICAgICAgICAgICAgICAgICAgICAgID0gbnVsbDtcbiAgICAgICAgdGhpcy5pc1BlbmRpbmdXaW5kb3dTd2l0Y2hpbmcgICAgICAgICAgICAgID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaXNPYnNlcnZpbmdGaWxlRG93bmxvYWRpbmdJbk5ld1dpbmRvdyA9IGZhbHNlO1xuICAgICAgICB0aGlzLmlzRmlyc3RSZXF1ZXN0QWZ0ZXJXaW5kb3dTd2l0Y2hpbmcgICAgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kZWJ1ZyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID0gJyc7XG4gICAgICAgIHRoaXMud2FybmluZ3MgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYXNzaWduRnJvbShvYmosIHRydWUpO1xuICAgIH1cblxuICAgIGdldEFzc2lnbmFibGVQcm9wZXJ0aWVzICgpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHsgbmFtZTogJ2lzQ29tbWFuZFJlc3VsdCcgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2V4ZWN1dGlvbkVycm9yJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAncGFnZUVycm9yJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAncmVzdWx0JyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnY29uc29sZU1lc3NhZ2VzJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnaXNQZW5kaW5nV2luZG93U3dpdGNoaW5nJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnaXNPYnNlcnZpbmdGaWxlRG93bmxvYWRpbmdJbk5ld1dpbmRvdycgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2lzRmlyc3RSZXF1ZXN0QWZ0ZXJXaW5kb3dTd2l0Y2hpbmcnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICd3YXJuaW5ncycgfSxcbiAgICAgICAgXTtcbiAgICB9XG59XG4iXX0=