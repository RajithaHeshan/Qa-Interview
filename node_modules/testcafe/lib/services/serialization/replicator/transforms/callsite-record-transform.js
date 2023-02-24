"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prerender_callsite_1 = __importDefault(require("../../../../utils/prerender-callsite"));
const base_transform_1 = __importDefault(require("./base-transform"));
const constants_1 = require("../../../../test-run/execute-js-expression/constants");
class CallsiteRecordTransform extends base_transform_1.default {
    constructor() {
        super(constants_1.CALLSITE_RECORD_CLASS_NAME);
    }
    shouldTransform(_, val) {
        return !!val &&
            (!!val.constructor && val.constructor.name === constants_1.CALLSITE_RECORD_CLASS_NAME) &&
            (!!val.filename && val.filename !== constants_1.ERROR_FILENAME); // Don't serialize callsites for RAW API)
    }
    toSerializable(callsite) {
        return (0, prerender_callsite_1.default)(callsite);
    }
}
exports.default = CallsiteRecordTransform;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbHNpdGUtcmVjb3JkLXRyYW5zZm9ybS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zZXJ2aWNlcy9zZXJpYWxpemF0aW9uL3JlcGxpY2F0b3IvdHJhbnNmb3Jtcy9jYWxsc2l0ZS1yZWNvcmQtdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQ0EsOEZBQTJGO0FBQzNGLHNFQUE2QztBQUM3QyxvRkFBa0g7QUFNbEgsTUFBcUIsdUJBQXdCLFNBQVEsd0JBQWE7SUFDOUQ7UUFDSSxLQUFLLENBQUMsc0NBQTBCLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRU0sZUFBZSxDQUFFLENBQVUsRUFBRSxHQUF1QjtRQUN2RCxPQUFPLENBQUMsQ0FBQyxHQUFHO1lBQ1IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksS0FBSyxzQ0FBMEIsQ0FBQztZQUMxRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLEdBQUcsQ0FBQyxRQUFRLEtBQUssMEJBQWMsQ0FBQyxDQUFDLENBQUMseUNBQXlDO0lBQ3RHLENBQUM7SUFFTSxjQUFjLENBQUUsUUFBd0I7UUFDM0MsT0FBTyxJQUFBLDRCQUFpQixFQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7Q0FDSjtBQWRELDBDQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2FsbHNpdGVSZWNvcmQgfSBmcm9tICdjYWxsc2l0ZS1yZWNvcmQnO1xuaW1wb3J0IHByZXJlbmRlckNhbGxzaXRlLCB7IFJlbmRlcmVkQ2FsbHNpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi91dGlscy9wcmVyZW5kZXItY2FsbHNpdGUnO1xuaW1wb3J0IEJhc2VUcmFuc2Zvcm0gZnJvbSAnLi9iYXNlLXRyYW5zZm9ybSc7XG5pbXBvcnQgeyBFUlJPUl9GSUxFTkFNRSwgQ0FMTFNJVEVfUkVDT1JEX0NMQVNTX05BTUUgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0LXJ1bi9leGVjdXRlLWpzLWV4cHJlc3Npb24vY29uc3RhbnRzJztcblxuaW50ZXJmYWNlIENhbGxzaXRlUmVjb3JkTGlrZSB7XG4gICAgZmlsZW5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2FsbHNpdGVSZWNvcmRUcmFuc2Zvcm0gZXh0ZW5kcyBCYXNlVHJhbnNmb3JtIHtcbiAgICBwdWJsaWMgY29uc3RydWN0b3IgKCkge1xuICAgICAgICBzdXBlcihDQUxMU0lURV9SRUNPUkRfQ0xBU1NfTkFNRSk7XG4gICAgfVxuXG4gICAgcHVibGljIHNob3VsZFRyYW5zZm9ybSAoXzogdW5rbm93biwgdmFsOiBDYWxsc2l0ZVJlY29yZExpa2UpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuICEhdmFsICYmXG4gICAgICAgICAgICAoISF2YWwuY29uc3RydWN0b3IgJiYgdmFsLmNvbnN0cnVjdG9yLm5hbWUgPT09IENBTExTSVRFX1JFQ09SRF9DTEFTU19OQU1FKSAmJlxuICAgICAgICAgICAgKCEhdmFsLmZpbGVuYW1lICYmIHZhbC5maWxlbmFtZSAhPT0gRVJST1JfRklMRU5BTUUpOyAvLyBEb24ndCBzZXJpYWxpemUgY2FsbHNpdGVzIGZvciBSQVcgQVBJKVxuICAgIH1cblxuICAgIHB1YmxpYyB0b1NlcmlhbGl6YWJsZSAoY2FsbHNpdGU6IENhbGxzaXRlUmVjb3JkKTogUmVuZGVyZWRDYWxsc2l0ZSB7XG4gICAgICAgIHJldHVybiBwcmVyZW5kZXJDYWxsc2l0ZShjYWxsc2l0ZSk7XG4gICAgfVxufVxuIl19