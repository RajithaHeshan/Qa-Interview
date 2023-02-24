"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_repl_1 = __importDefault(require("../utils/is-repl"));
exports.default = {
    forcedSyncMode: false,
    forceSync() {
        this.forcedSyncMode = true;
    },
    resetForcedSync() {
        this.forcedSyncMode = false;
    },
    get isSync() {
        if (this.forcedSyncMode)
            return true;
        return (0, is_repl_1.default)();
    },
};
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VsZWN0b3ItYXBpLWV4ZWN1dGlvbi1tb2RlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NsaWVudC1mdW5jdGlvbnMvc2VsZWN0b3ItYXBpLWV4ZWN1dGlvbi1tb2RlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsK0RBQXNDO0FBR3RDLGtCQUFlO0lBQ1gsY0FBYyxFQUFFLEtBQUs7SUFFckIsU0FBUztRQUNMLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO0lBQy9CLENBQUM7SUFFRCxlQUFlO1FBQ1gsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7SUFDaEMsQ0FBQztJQUVELElBQUksTUFBTTtRQUNOLElBQUksSUFBSSxDQUFDLGNBQWM7WUFDbkIsT0FBTyxJQUFJLENBQUM7UUFFaEIsT0FBTyxJQUFBLGlCQUFNLEdBQUUsQ0FBQztJQUNwQixDQUFDO0NBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBpc1JFUEwgZnJvbSAnLi4vdXRpbHMvaXMtcmVwbCc7XG5cblxuZXhwb3J0IGRlZmF1bHQge1xuICAgIGZvcmNlZFN5bmNNb2RlOiBmYWxzZSxcblxuICAgIGZvcmNlU3luYyAoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuZm9yY2VkU3luY01vZGUgPSB0cnVlO1xuICAgIH0sXG5cbiAgICByZXNldEZvcmNlZFN5bmMgKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmZvcmNlZFN5bmNNb2RlID0gZmFsc2U7XG4gICAgfSxcblxuICAgIGdldCBpc1N5bmMgKCk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAodGhpcy5mb3JjZWRTeW5jTW9kZSlcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgICAgIHJldHVybiBpc1JFUEwoKTtcbiAgICB9LFxufTtcbiJdfQ==