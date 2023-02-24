"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prerender_callsite_1 = __importDefault(require("../../../../utils/prerender-callsite"));
const base_transform_1 = __importDefault(require("./base-transform"));
const raw_command_callsite_record_1 = require("../../../../utils/raw-command-callsite-record");
class RawCommandCallsiteRecordTransform extends base_transform_1.default {
    constructor() {
        super('RawCommandCallsiteRecord');
    }
    shouldTransform(_, val) {
        return val instanceof raw_command_callsite_record_1.RawCommandCallsiteRecord;
    }
    toSerializable(callsite) {
        return (0, prerender_callsite_1.default)(callsite);
    }
}
exports.default = RawCommandCallsiteRecordTransform;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmF3LWNvbW1hbmQtY2FsbHNpdGUtcmVjb3JkLXRyYW5zZm9ybS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zZXJ2aWNlcy9zZXJpYWxpemF0aW9uL3JlcGxpY2F0b3IvdHJhbnNmb3Jtcy9yYXctY29tbWFuZC1jYWxsc2l0ZS1yZWNvcmQtdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsOEZBQTJGO0FBQzNGLHNFQUE2QztBQUM3QywrRkFBeUY7QUFFekYsTUFBcUIsaUNBQWtDLFNBQVEsd0JBQWE7SUFDeEU7UUFDSSxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRU0sZUFBZSxDQUFFLENBQVUsRUFBRSxHQUFZO1FBQzVDLE9BQU8sR0FBRyxZQUFZLHNEQUF3QixDQUFDO0lBQ25ELENBQUM7SUFFTSxjQUFjLENBQUUsUUFBa0M7UUFDckQsT0FBTyxJQUFBLDRCQUFpQixFQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7Q0FDSjtBQVpELG9EQVlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHByZXJlbmRlckNhbGxzaXRlLCB7IFJlbmRlcmVkQ2FsbHNpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi91dGlscy9wcmVyZW5kZXItY2FsbHNpdGUnO1xuaW1wb3J0IEJhc2VUcmFuc2Zvcm0gZnJvbSAnLi9iYXNlLXRyYW5zZm9ybSc7XG5pbXBvcnQgeyBSYXdDb21tYW5kQ2FsbHNpdGVSZWNvcmQgfSBmcm9tICcuLi8uLi8uLi8uLi91dGlscy9yYXctY29tbWFuZC1jYWxsc2l0ZS1yZWNvcmQnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSYXdDb21tYW5kQ2FsbHNpdGVSZWNvcmRUcmFuc2Zvcm0gZXh0ZW5kcyBCYXNlVHJhbnNmb3JtIHtcbiAgICBwdWJsaWMgY29uc3RydWN0b3IgKCkge1xuICAgICAgICBzdXBlcignUmF3Q29tbWFuZENhbGxzaXRlUmVjb3JkJyk7XG4gICAgfVxuXG4gICAgcHVibGljIHNob3VsZFRyYW5zZm9ybSAoXzogdW5rbm93biwgdmFsOiB1bmtub3duKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB2YWwgaW5zdGFuY2VvZiBSYXdDb21tYW5kQ2FsbHNpdGVSZWNvcmQ7XG4gICAgfVxuXG4gICAgcHVibGljIHRvU2VyaWFsaXphYmxlIChjYWxsc2l0ZTogUmF3Q29tbWFuZENhbGxzaXRlUmVjb3JkKTogUmVuZGVyZWRDYWxsc2l0ZSB7XG4gICAgICAgIHJldHVybiBwcmVyZW5kZXJDYWxsc2l0ZShjYWxsc2l0ZSk7XG4gICAgfVxufVxuIl19