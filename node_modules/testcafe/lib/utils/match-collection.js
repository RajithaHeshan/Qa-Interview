"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
// NOTE: this method will duplicate the matching items
// currently cookies-tests use incorrect behavior of this method
// the method and cookies-tests should be rewritten
function matchCollection(items, filters) {
    if (!filters.length)
        return items;
    const result = [];
    for (const item of items) {
        for (const filter of filters) {
            if ((0, lodash_1.isMatch)(item, filter))
                result.push(item);
        }
    }
    return result;
}
exports.default = matchCollection;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0Y2gtY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9tYXRjaC1jb2xsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsbUNBQWlDO0FBRWpDLHNEQUFzRDtBQUN0RCxnRUFBZ0U7QUFDaEUsbURBQW1EO0FBQ25ELFNBQXdCLGVBQWUsQ0FBRSxLQUFlLEVBQUUsT0FBaUI7SUFDdkUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1FBQ2YsT0FBTyxLQUFLLENBQUM7SUFFakIsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBRWxCLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1FBQ3RCLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFO1lBQzFCLElBQUksSUFBQSxnQkFBTyxFQUFDLElBQUksRUFBRSxNQUFNLENBQUM7Z0JBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDekI7S0FDSjtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2xCLENBQUM7QUFkRCxrQ0FjQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzTWF0Y2ggfSBmcm9tICdsb2Rhc2gnO1xuXG4vLyBOT1RFOiB0aGlzIG1ldGhvZCB3aWxsIGR1cGxpY2F0ZSB0aGUgbWF0Y2hpbmcgaXRlbXNcbi8vIGN1cnJlbnRseSBjb29raWVzLXRlc3RzIHVzZSBpbmNvcnJlY3QgYmVoYXZpb3Igb2YgdGhpcyBtZXRob2Rcbi8vIHRoZSBtZXRob2QgYW5kIGNvb2tpZXMtdGVzdHMgc2hvdWxkIGJlIHJld3JpdHRlblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gbWF0Y2hDb2xsZWN0aW9uIChpdGVtczogb2JqZWN0W10sIGZpbHRlcnM6IG9iamVjdFtdKTogb2JqZWN0W10ge1xuICAgIGlmICghZmlsdGVycy5sZW5ndGgpXG4gICAgICAgIHJldHVybiBpdGVtcztcblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgIGZvciAoY29uc3QgZmlsdGVyIG9mIGZpbHRlcnMpIHtcbiAgICAgICAgICAgIGlmIChpc01hdGNoKGl0ZW0sIGZpbHRlcikpXG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goaXRlbSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuIl19