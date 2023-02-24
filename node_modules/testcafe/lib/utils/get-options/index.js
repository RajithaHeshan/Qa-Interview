"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSkipJsErrorsOptions = exports.getDashboardOptions = exports.getCompilerOptions = exports.getGrepOptions = exports.getMetaOptions = exports.getVideoOptions = exports.getScreenshotOptions = exports.getQuarantineOptions = exports.getSSLOptions = void 0;
const ssl_1 = __importDefault(require("./ssl"));
exports.getSSLOptions = ssl_1.default;
const quarantine_1 = require("./quarantine");
Object.defineProperty(exports, "getQuarantineOptions", { enumerable: true, get: function () { return quarantine_1.getQuarantineOptions; } });
const screenshot_1 = __importDefault(require("./screenshot"));
exports.getScreenshotOptions = screenshot_1.default;
const video_1 = __importDefault(require("./video"));
exports.getVideoOptions = video_1.default;
const meta_1 = __importDefault(require("./meta"));
exports.getMetaOptions = meta_1.default;
const grep_1 = __importDefault(require("./grep"));
exports.getGrepOptions = grep_1.default;
const compiler_1 = __importDefault(require("./compiler"));
exports.getCompilerOptions = compiler_1.default;
const dashboard_1 = __importDefault(require("./dashboard"));
exports.getDashboardOptions = dashboard_1.default;
const skip_js_errors_1 = require("./skip-js-errors");
Object.defineProperty(exports, "getSkipJsErrorsOptions", { enumerable: true, get: function () { return skip_js_errors_1.getSkipJsErrorsOptions; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdXRpbHMvZ2V0LW9wdGlvbnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsZ0RBQWtDO0FBVzlCLHdCQVhHLGFBQWEsQ0FXSDtBQVZqQiw2Q0FBb0Q7QUFXaEQscUdBWEssaUNBQW9CLE9BV0w7QUFWeEIsOERBQWdEO0FBVzVDLCtCQVhHLG9CQUFvQixDQVdIO0FBVnhCLG9EQUFzQztBQVdsQywwQkFYRyxlQUFlLENBV0g7QUFWbkIsa0RBQW9DO0FBV2hDLHlCQVhHLGNBQWMsQ0FXSDtBQVZsQixrREFBb0M7QUFXaEMseUJBWEcsY0FBYyxDQVdIO0FBVmxCLDBEQUE0QztBQVd4Qyw2QkFYRyxrQkFBa0IsQ0FXSDtBQVZ0Qiw0REFBOEM7QUFXMUMsOEJBWEcsbUJBQW1CLENBV0g7QUFWdkIscURBQTBEO0FBV3RELHVHQVhLLHVDQUFzQixPQVdMIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGdldFNTTE9wdGlvbnMgZnJvbSAnLi9zc2wnO1xuaW1wb3J0IHsgZ2V0UXVhcmFudGluZU9wdGlvbnMgfSBmcm9tICcuL3F1YXJhbnRpbmUnO1xuaW1wb3J0IGdldFNjcmVlbnNob3RPcHRpb25zIGZyb20gJy4vc2NyZWVuc2hvdCc7XG5pbXBvcnQgZ2V0VmlkZW9PcHRpb25zIGZyb20gJy4vdmlkZW8nO1xuaW1wb3J0IGdldE1ldGFPcHRpb25zIGZyb20gJy4vbWV0YSc7XG5pbXBvcnQgZ2V0R3JlcE9wdGlvbnMgZnJvbSAnLi9ncmVwJztcbmltcG9ydCBnZXRDb21waWxlck9wdGlvbnMgZnJvbSAnLi9jb21waWxlcic7XG5pbXBvcnQgZ2V0RGFzaGJvYXJkT3B0aW9ucyBmcm9tICcuL2Rhc2hib2FyZCc7XG5pbXBvcnQgeyBnZXRTa2lwSnNFcnJvcnNPcHRpb25zIH0gZnJvbSAnLi9za2lwLWpzLWVycm9ycyc7XG5cbmV4cG9ydCB7XG4gICAgZ2V0U1NMT3B0aW9ucyxcbiAgICBnZXRRdWFyYW50aW5lT3B0aW9ucyxcbiAgICBnZXRTY3JlZW5zaG90T3B0aW9ucyxcbiAgICBnZXRWaWRlb09wdGlvbnMsXG4gICAgZ2V0TWV0YU9wdGlvbnMsXG4gICAgZ2V0R3JlcE9wdGlvbnMsXG4gICAgZ2V0Q29tcGlsZXJPcHRpb25zLFxuICAgIGdldERhc2hib2FyZE9wdGlvbnMsXG4gICAgZ2V0U2tpcEpzRXJyb3JzT3B0aW9ucyxcbn07XG4iXX0=