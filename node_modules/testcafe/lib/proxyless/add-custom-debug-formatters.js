"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const cdp_1 = require("./utils/cdp");
function default_1() {
    debug_1.default.formatters.r = (event) => {
        const requestStr = (0, cdp_1.isRequest)(event) ? 'request' : 'response';
        return `requestPaused ${event.networkId} ${event.requestId} ${requestStr} ${event.request.url}`;
    };
    debug_1.default.formatters.f = (event) => {
        return `frameNavigated ${event.frame.url} ${event.type}`;
    };
    debug_1.default.formatters.l = (event) => {
        return `loadingFailed ${event.requestId} ${event.errorText}`;
    };
}
exports.default = default_1;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkLWN1c3RvbS1kZWJ1Zy1mb3JtYXR0ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3Byb3h5bGVzcy9hZGQtY3VzdG9tLWRlYnVnLWZvcm1hdHRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxrREFBMEI7QUFLMUIscUNBQXdDO0FBR3hDO0lBQ0ksZUFBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUF5QixFQUFVLEVBQUU7UUFDdkQsTUFBTSxVQUFVLEdBQUcsSUFBQSxlQUFTLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO1FBRTdELE9BQU8saUJBQWlCLEtBQUssQ0FBQyxTQUFTLElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxVQUFVLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNwRyxDQUFDLENBQUM7SUFFRixlQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQTBCLEVBQVUsRUFBRTtRQUN4RCxPQUFPLGtCQUFrQixLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDN0QsQ0FBQyxDQUFDO0lBRUYsZUFBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUF5QixFQUFVLEVBQUU7UUFDdkQsT0FBTyxpQkFBaUIsS0FBSyxDQUFDLFNBQVMsSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUM7SUFDakUsQ0FBQyxDQUFDO0FBQ04sQ0FBQztBQWRELDRCQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGRlYnVnIGZyb20gJ2RlYnVnJztcbmltcG9ydCBQcm90b2NvbCBmcm9tICdkZXZ0b29scy1wcm90b2NvbCc7XG5pbXBvcnQgUmVxdWVzdFBhdXNlZEV2ZW50ID0gUHJvdG9jb2wuRmV0Y2guUmVxdWVzdFBhdXNlZEV2ZW50O1xuaW1wb3J0IEZyYW1lTmF2aWdhdGVkRXZlbnQgPSBQcm90b2NvbC5QYWdlLkZyYW1lTmF2aWdhdGVkRXZlbnQ7XG5pbXBvcnQgTG9hZGluZ0ZhaWxlZEV2ZW50ID0gUHJvdG9jb2wuTmV0d29yay5Mb2FkaW5nRmFpbGVkRXZlbnQ7XG5pbXBvcnQgeyBpc1JlcXVlc3QgfSBmcm9tICcuL3V0aWxzL2NkcCc7XG5cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKCk6IHZvaWQge1xuICAgIGRlYnVnLmZvcm1hdHRlcnMuciA9IChldmVudDogUmVxdWVzdFBhdXNlZEV2ZW50KTogc3RyaW5nID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdFN0ciA9IGlzUmVxdWVzdChldmVudCkgPyAncmVxdWVzdCcgOiAncmVzcG9uc2UnO1xuXG4gICAgICAgIHJldHVybiBgcmVxdWVzdFBhdXNlZCAke2V2ZW50Lm5ldHdvcmtJZH0gJHtldmVudC5yZXF1ZXN0SWR9ICR7cmVxdWVzdFN0cn0gJHtldmVudC5yZXF1ZXN0LnVybH1gO1xuICAgIH07XG5cbiAgICBkZWJ1Zy5mb3JtYXR0ZXJzLmYgPSAoZXZlbnQ6IEZyYW1lTmF2aWdhdGVkRXZlbnQpOiBzdHJpbmcgPT4ge1xuICAgICAgICByZXR1cm4gYGZyYW1lTmF2aWdhdGVkICR7ZXZlbnQuZnJhbWUudXJsfSAke2V2ZW50LnR5cGV9YDtcbiAgICB9O1xuXG4gICAgZGVidWcuZm9ybWF0dGVycy5sID0gKGV2ZW50OiBMb2FkaW5nRmFpbGVkRXZlbnQpOiBzdHJpbmcgPT4ge1xuICAgICAgICByZXR1cm4gYGxvYWRpbmdGYWlsZWQgJHtldmVudC5yZXF1ZXN0SWR9ICR7ZXZlbnQuZXJyb3JUZXh0fWA7XG4gICAgfTtcbn1cbiJdfQ==