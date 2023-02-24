"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const is_stream_1 = require("is-stream");
const plugin_host_1 = __importDefault(require("./plugin-host"));
const plugin_methods_1 = __importDefault(require("./plugin-methods"));
const format_command_1 = __importDefault(require("./command/format-command"));
const runtime_1 = require("../errors/runtime");
const reporter_1 = require("../utils/reporter");
const resolve_path_relatively_cwd_1 = __importDefault(require("../utils/resolve-path-relatively-cwd"));
const make_dir_1 = __importDefault(require("make-dir"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const debug_1 = __importDefault(require("debug"));
const debugLog = (0, debug_1.default)('testcafe:reporter');
class Reporter {
    constructor(plugin, messageBus, outStream, name) {
        this.plugin = new plugin_host_1.default(plugin, outStream, name);
        this.messageBus = messageBus;
        this.disposed = false;
        this.taskInfo = null;
        this.outStream = outStream;
        this._assignMessageBusEventHandlers();
    }
    static _isSpecialStream(stream) {
        return stream.isTTY || stream === process.stdout || stream === process.stderr;
    }
    static _createPendingPromise() {
        let resolver = null;
        const promise = new Promise(resolve => {
            resolver = resolve;
        });
        promise.resolve = resolver;
        return promise;
    }
    async init() {
        await this.dispatchToPlugin({
            method: plugin_methods_1.default.init,
            initialObject: null,
            args: [{}],
        });
    }
    async dispatchToPlugin({ method, initialObject, args = [] }) {
        try {
            // @ts-ignore
            await this.plugin[method](...args);
        }
        catch (originalError) {
            const uncaughtError = new runtime_1.ReporterPluginError({
                name: this.plugin.name,
                method,
                originalError,
            });
            debugLog('Plugin error: %O', uncaughtError);
            debugLog('Plugin error: initialObject: %O', initialObject);
            if (initialObject)
                await initialObject.emit('error', uncaughtError);
            else
                throw uncaughtError;
        }
    }
    _assignMessageBusEventHandlers() {
        const messageBus = this.messageBus;
        messageBus.on('warning-add', async (e) => await this._onWarningAddHandler(e));
        messageBus.once('start', async (task) => await this._onceTaskStartHandler(task));
        messageBus.on('test-run-start', async (testRun) => await this._onTaskTestRunStartHandler(testRun));
        messageBus.on('test-run-done', async (testRun) => await this._onTaskTestRunDoneHandler(testRun));
        messageBus.on('test-action-start', async (e) => await this._onTaskTestActionStart(e));
        messageBus.on('test-action-done', async (e) => await this._onTaskTestActionDone(e));
        messageBus.once('done', async () => await this._onceTaskDoneHandler());
    }
    async dispose() {
        var _a;
        if (this.disposed)
            return Promise.resolve();
        this.disposed = true;
        if (!(0, lodash_1.isFunction)((_a = this === null || this === void 0 ? void 0 : this.outStream) === null || _a === void 0 ? void 0 : _a.once)
            || Reporter._isSpecialStream(this.outStream)
            || !(0, is_stream_1.writable)(this.outStream))
            return Promise.resolve();
        const streamFinishedPromise = new Promise(resolve => {
            this.outStream.once('finish', resolve);
            this.outStream.once('error', resolve);
        });
        this.outStream.end();
        return streamFinishedPromise;
    }
    static async _ensureOutStream(outStream) {
        if (typeof outStream !== 'string')
            return outStream;
        const fullReporterOutputPath = (0, resolve_path_relatively_cwd_1.default)(outStream);
        await (0, make_dir_1.default)(path_1.default.dirname(fullReporterOutputPath));
        return fs_1.default.createWriteStream(fullReporterOutputPath);
    }
    static _addDefaultReporter(reporters) {
        reporters.push({
            name: 'spec',
            output: process.stdout,
        });
    }
    static async getReporterPlugins(reporters = []) {
        if (!reporters.length)
            Reporter._addDefaultReporter(reporters);
        return Promise.all(reporters.map(async ({ name, output, options }) => {
            const pluginFactory = (0, reporter_1.getPluginFactory)(name);
            const processedName = (0, reporter_1.processReporterName)(name);
            const outStream = output ? await Reporter._ensureOutStream(output) : void 0;
            return {
                plugin: pluginFactory(options),
                name: processedName,
                outStream,
            };
        }));
    }
    async _onWarningAddHandler({ message, testRun, actionId }) {
        await this.dispatchToPlugin({
            method: plugin_methods_1.default.reportWarnings,
            initialObject: this.messageBus,
            args: [
                {
                    message,
                    testRunId: testRun === null || testRun === void 0 ? void 0 : testRun.id,
                    actionId,
                },
            ],
        });
    }
    //Task
    static _createTestItem(test, runsPerTest) {
        return {
            fixture: test.fixture,
            test: test,
            testRunIds: [],
            screenshotPath: null,
            screenshots: [],
            videos: [],
            quarantine: null,
            errs: [],
            warnings: [],
            unstable: false,
            startTime: null,
            testRunInfo: null,
            pendingRuns: runsPerTest,
            pendingStarts: runsPerTest,
            pendingTestRunDonePromise: Reporter._createPendingPromise(),
            pendingTestRunStartPromise: Reporter._createPendingPromise(),
            browsers: [],
        };
    }
    static _createTestQueue(task) {
        const runsPerTest = task.browserConnectionGroups.length;
        return task.tests.map(test => Reporter._createTestItem(test, runsPerTest));
    }
    static _createTestRunInfo(reportItem) {
        return {
            errs: (0, lodash_1.sortBy)(reportItem.errs, ['userAgent', 'code']),
            warnings: reportItem.warnings,
            durationMs: +new Date() - reportItem.startTime,
            unstable: reportItem.unstable,
            screenshotPath: reportItem.screenshotPath,
            screenshots: reportItem.screenshots,
            videos: reportItem.videos,
            quarantine: reportItem.quarantine,
            skipped: reportItem.test.skip,
            browsers: reportItem.browsers,
            testId: reportItem.test.id,
            fixture: {
                id: reportItem.fixture.id,
                name: reportItem.fixture.name,
                path: reportItem.fixture.path,
                meta: reportItem.fixture.meta,
            },
        };
    }
    _getTestItemForTestRun(taskInfo, testRun) {
        return (0, lodash_1.find)(taskInfo.testQueue, i => i.test === testRun.test);
    }
    async _shiftTestQueue() {
        if (!this.taskInfo)
            return;
        let currentFixture = null;
        let nextReportItem = null;
        let testItem = null;
        const testQueue = this.taskInfo.testQueue;
        while (testQueue.length && testQueue[0].testRunInfo) {
            testItem = testQueue.shift();
            currentFixture = testItem.fixture;
            // NOTE: here we assume that tests are sorted by fixture.
            // Therefore, if the next report item has a different
            // fixture, we can report this fixture start.
            nextReportItem = testQueue[0];
            await this.dispatchToPlugin({
                method: plugin_methods_1.default.reportTestDone,
                initialObject: this.taskInfo.task,
                args: [
                    testItem.test.name,
                    testItem.testRunInfo,
                    testItem.test.meta,
                ],
            });
            if (!nextReportItem || nextReportItem.fixture === currentFixture)
                continue;
            await this.dispatchToPlugin({
                method: plugin_methods_1.default.reportFixtureStart,
                initialObject: this.taskInfo.task,
                args: [
                    nextReportItem.fixture.name,
                    nextReportItem.fixture.path,
                    nextReportItem.fixture.meta,
                ],
            });
        }
    }
    async _resolveTestItem(taskInfo, testItem, testRun) {
        if (!taskInfo.task)
            return;
        if (taskInfo.task.screenshots.hasCapturedFor(testRun.test)) {
            testItem.screenshotPath = taskInfo.task.screenshots.getPathFor(testRun.test);
            testItem.screenshots = taskInfo.task.screenshots.getScreenshotsInfo(testRun.test);
        }
        if (taskInfo.task.videos)
            testItem.videos = taskInfo.task.videos.getTestVideos(testItem.test.id);
        if (testRun.quarantine) {
            const testItemQuarantine = testRun.quarantine.attempts.reduce((result, { errors }, index) => {
                const passed = !errors.length;
                const quarantineAttempt = index + 1;
                result[quarantineAttempt] = { passed };
                return result;
            }, {});
            Object.assign(testItem.quarantine, testItemQuarantine);
        }
        if (!testItem.testRunInfo) {
            testItem.testRunInfo = Reporter._createTestRunInfo(testItem);
            if (testItem.test.skip)
                taskInfo.skipped++;
            else if (testItem.errs.length)
                taskInfo.failed++;
            else
                taskInfo.passed++;
        }
        await this._shiftTestQueue();
        testItem.pendingTestRunDonePromise.resolve();
    }
    _prepareReportTestActionEventArgs({ command, duration, result, testRun, err }) {
        const args = {};
        if (err)
            args.err = err;
        if (typeof duration === 'number')
            args.duration = duration;
        const testFixture = testRun.test.fixture;
        return Object.assign(args, {
            testRunId: testRun.id,
            test: {
                id: testRun.test.id,
                name: testRun.test.name,
                phase: testRun.phase,
            },
            fixture: {
                name: testFixture.name,
                id: testFixture.id,
            },
            command: (0, format_command_1.default)(command, result),
            browser: testRun.browser,
        });
    }
    async _onceTaskStartHandler(task) {
        this.taskInfo = {
            task: task,
            passed: 0,
            failed: 0,
            skipped: 0,
            testCount: task.tests.filter(test => !test.skip).length,
            testQueue: Reporter._createTestQueue(task),
            stopOnFirstFail: task.opts.stopOnFirstFail,
            pendingTaskDonePromise: Reporter._createPendingPromise(),
        };
        const startTime = task.startTime;
        const browserConnectionsInfo = []
            .concat(...task.browserConnectionGroups)
            .map(connection => connection.connectionInfo);
        const first = this.taskInfo.testQueue[0];
        const taskProperties = {
            configuration: task.opts,
            dashboardUrl: task.opts.dashboardUrl,
        };
        await this.dispatchToPlugin({
            method: plugin_methods_1.default.reportTaskStart,
            initialObject: task,
            args: [
                startTime,
                browserConnectionsInfo,
                this.taskInfo.testCount,
                task.testStructure,
                taskProperties,
            ],
        });
        if (first) {
            await this.dispatchToPlugin({
                method: plugin_methods_1.default.reportFixtureStart,
                initialObject: task,
                args: [
                    first.fixture.name,
                    first.fixture.path,
                    first.fixture.meta,
                ],
            });
        }
    }
    async _onTaskTestRunStartHandler(testRun) {
        if (!this.taskInfo)
            return void 0;
        const testItem = this._getTestItemForTestRun(this.taskInfo, testRun);
        testItem.testRunIds.push(testRun.id);
        if (!testItem.startTime)
            testItem.startTime = +new Date();
        testItem.pendingStarts--;
        if (!testItem.pendingStarts) {
            // @ts-ignore
            if (this.plugin.reportTestStart) {
                const testStartInfo = {
                    testRunIds: testItem.testRunIds,
                    testId: testItem.test.id,
                    startTime: new Date(testItem.startTime),
                    skipped: testItem.test.skip,
                };
                await this.dispatchToPlugin({
                    method: plugin_methods_1.default.reportTestStart,
                    initialObject: this.taskInfo.task,
                    args: [
                        testItem.test.name,
                        testItem.test.meta,
                        testStartInfo,
                    ],
                });
            }
            testItem.pendingTestRunStartPromise.resolve();
        }
        return testItem.pendingTestRunStartPromise;
    }
    async _onTaskTestRunDoneHandler(testRun) {
        if (!this.taskInfo)
            return;
        const reportItem = this._getTestItemForTestRun(this.taskInfo, testRun);
        const isTestRunStoppedTaskExecution = !!testRun.errs.length && this.taskInfo.stopOnFirstFail;
        const browser = Object.assign({ testRunId: testRun.id }, testRun.browser);
        reportItem.browsers.push(browser);
        reportItem.pendingRuns = isTestRunStoppedTaskExecution ? 0 : reportItem.pendingRuns - 1;
        reportItem.unstable = reportItem.unstable || testRun.unstable;
        reportItem.errs = reportItem.errs.concat(testRun.errs);
        reportItem.warnings = testRun.warningLog ? (0, lodash_1.union)(reportItem.warnings, testRun.warningLog.messages) : [];
        if (testRun.quarantine) {
            reportItem.quarantine = reportItem.quarantine || {};
            const reportItemQuarantine = testRun.quarantine.attempts.reduce((result, { errors, testRunId }) => {
                const passed = !errors.length;
                result[testRunId] = { passed, errors };
                browser.quarantineAttemptsTestRunIds = browser.quarantineAttemptsTestRunIds || [];
                browser.quarantineAttemptsTestRunIds.push(testRunId);
                return result;
            }, {});
            Object.assign(reportItem.quarantine, reportItemQuarantine);
        }
        if (!reportItem.pendingRuns)
            await this._resolveTestItem(this.taskInfo, reportItem, testRun);
        await reportItem.pendingTestRunDonePromise;
    }
    async _onTaskTestActionStart(_a) {
        var { apiActionName } = _a, restArgs = __rest(_a, ["apiActionName"]);
        if (!this.taskInfo)
            return;
        // @ts-ignore
        if (this.plugin.reportTestActionStart) {
            restArgs = this._prepareReportTestActionEventArgs(restArgs);
            await this.dispatchToPlugin({
                method: plugin_methods_1.default.reportTestActionStart,
                initialObject: this.taskInfo.task,
                args: [
                    apiActionName,
                    restArgs,
                ],
            });
        }
    }
    async _onTaskTestActionDone(_a) {
        var { apiActionName } = _a, restArgs = __rest(_a, ["apiActionName"]);
        if (!this.taskInfo)
            return;
        // @ts-ignore
        if (this.plugin.reportTestActionDone) {
            restArgs = this._prepareReportTestActionEventArgs(restArgs);
            await this.dispatchToPlugin({
                method: plugin_methods_1.default.reportTestActionDone,
                initialObject: this.taskInfo.task,
                args: [
                    apiActionName,
                    restArgs,
                ],
            });
        }
    }
    async _onceTaskDoneHandler() {
        var _a;
        if (!this.taskInfo)
            return;
        const endTime = new Date();
        const result = {
            passedCount: this.taskInfo.passed,
            failedCount: this.taskInfo.failed,
            skippedCount: this.taskInfo.skipped,
        };
        await this.dispatchToPlugin({
            method: plugin_methods_1.default.reportTaskDone,
            initialObject: this.taskInfo.task,
            args: [
                endTime,
                this.taskInfo.passed,
                (_a = this.taskInfo.task) === null || _a === void 0 ? void 0 : _a.warningLog.messages,
                result,
            ],
        });
        this.taskInfo.pendingTaskDonePromise.resolve();
    }
}
exports.default = Reporter;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcmVwb3J0ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG1DQUtnQjtBQUVoQix5Q0FBeUQ7QUFDekQsZ0VBQStDO0FBQy9DLHNFQUFvRDtBQUNwRCw4RUFBcUQ7QUFDckQsK0NBQXdEO0FBZ0J4RCxnREFBMEU7QUFDMUUsdUdBQTRFO0FBQzVFLHdEQUErQjtBQUMvQixnREFBd0I7QUFDeEIsNENBQW9CO0FBSXBCLGtEQUEwQjtBQTBGMUIsTUFBTSxRQUFRLEdBQUcsSUFBQSxlQUFLLEVBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUU1QyxNQUFxQixRQUFRO0lBT3pCLFlBQW9CLE1BQXNCLEVBQUUsVUFBc0IsRUFBRSxTQUFtQixFQUFFLElBQVk7UUFDakcsSUFBSSxDQUFDLE1BQU0sR0FBTyxJQUFJLHFCQUFrQixDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEUsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFFN0IsSUFBSSxDQUFDLFFBQVEsR0FBSSxLQUFLLENBQUM7UUFDdkIsSUFBSSxDQUFDLFFBQVEsR0FBSSxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFFM0IsSUFBSSxDQUFDLDhCQUE4QixFQUFFLENBQUM7SUFDMUMsQ0FBQztJQUVPLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBRSxNQUFnQjtRQUM3QyxPQUFRLE1BQXNCLENBQUMsS0FBSyxJQUFJLE1BQU0sS0FBSyxPQUFPLENBQUMsTUFBTSxJQUFJLE1BQU0sS0FBSyxPQUFPLENBQUMsTUFBTSxDQUFDO0lBQ25HLENBQUM7SUFFTyxNQUFNLENBQUMscUJBQXFCO1FBQ2hDLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQztRQUVwQixNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUNsQyxRQUFRLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLENBQUMsQ0FBOEIsQ0FBQztRQUVoQyxPQUFPLENBQUMsT0FBTyxHQUFHLFFBQVEsQ0FBQztRQUUzQixPQUFPLE9BQU8sQ0FBQztJQUNuQixDQUFDO0lBRU0sS0FBSyxDQUFDLElBQUk7UUFDYixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztZQUN4QixNQUFNLEVBQVMsd0JBQW9CLENBQUMsSUFBSTtZQUN4QyxhQUFhLEVBQUUsSUFBSTtZQUNuQixJQUFJLEVBQVcsQ0FBQyxFQUFFLENBQUM7U0FDdEIsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVNLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBRSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsSUFBSSxHQUFHLEVBQUUsRUFBeUI7UUFDdEYsSUFBSTtZQUNBLGFBQWE7WUFDYixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztTQUN0QztRQUNELE9BQU8sYUFBYSxFQUFFO1lBQ2xCLE1BQU0sYUFBYSxHQUFHLElBQUksNkJBQW1CLENBQUM7Z0JBQzFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUk7Z0JBQ3RCLE1BQU07Z0JBQ04sYUFBYTthQUNoQixDQUFDLENBQUM7WUFFSCxRQUFRLENBQUMsa0JBQWtCLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDNUMsUUFBUSxDQUFDLGlDQUFpQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBRTNELElBQUksYUFBYTtnQkFDYixNQUFNLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDOztnQkFFakQsTUFBTSxhQUFhLENBQUM7U0FDM0I7SUFDTCxDQUFDO0lBRU8sOEJBQThCO1FBQ2xDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFFbkMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLEVBQUUsS0FBSyxFQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU1RSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBVSxFQUFFLEVBQUUsQ0FBQyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRXZGLFVBQVUsQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxFQUFDLE9BQU8sRUFBQyxFQUFFLENBQUMsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUVqRyxVQUFVLENBQUMsRUFBRSxDQUFDLGVBQWUsRUFBRSxLQUFLLEVBQUMsT0FBTyxFQUFDLEVBQUUsQ0FBQyxNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBRS9GLFVBQVUsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLEVBQUUsS0FBSyxFQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVwRixVQUFVLENBQUMsRUFBRSxDQUFDLGtCQUFrQixFQUFFLEtBQUssRUFBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFbEYsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVNLEtBQUssQ0FBQyxPQUFPOztRQUNoQixJQUFJLElBQUksQ0FBQyxRQUFRO1lBQ2IsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFN0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFFckIsSUFBSSxDQUFDLElBQUEsbUJBQVUsRUFBQyxNQUFBLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxTQUFTLDBDQUFFLElBQUksQ0FBQztlQUMvQixRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztlQUN6QyxDQUFDLElBQUEsb0JBQWdCLEVBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNwQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUU3QixNQUFNLHFCQUFxQixHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ2hELElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN2QyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRXJCLE9BQU8scUJBQXFCLENBQUM7SUFDakMsQ0FBQztJQUVPLE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUUsU0FBa0M7UUFDckUsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRO1lBQzdCLE9BQU8sU0FBUyxDQUFDO1FBRXJCLE1BQU0sc0JBQXNCLEdBQUcsSUFBQSxxQ0FBd0IsRUFBQyxTQUFTLENBQUMsQ0FBQztRQUVuRSxNQUFNLElBQUEsa0JBQU8sRUFBQyxjQUFJLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQztRQUVwRCxPQUFPLFlBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFTyxNQUFNLENBQUMsbUJBQW1CLENBQUUsU0FBMkI7UUFDM0QsU0FBUyxDQUFDLElBQUksQ0FBQztZQUNYLElBQUksRUFBSSxNQUFNO1lBQ2QsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1NBQ3pCLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTSxNQUFNLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFFLFlBQThCLEVBQUU7UUFDcEUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNO1lBQ2pCLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUU1QyxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUU7WUFDakUsTUFBTSxhQUFhLEdBQUcsSUFBQSwyQkFBZ0IsRUFBQyxJQUFJLENBQUMsQ0FBQztZQUM3QyxNQUFNLGFBQWEsR0FBRyxJQUFBLDhCQUFtQixFQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hELE1BQU0sU0FBUyxHQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRWhGLE9BQU87Z0JBQ0gsTUFBTSxFQUFFLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQzlCLElBQUksRUFBSSxhQUFhO2dCQUNyQixTQUFTO2FBQ1osQ0FBQztRQUNOLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDUixDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFFLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQStCO1FBQzNGLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDO1lBQ3hCLE1BQU0sRUFBUyx3QkFBb0IsQ0FBQyxjQUF3QjtZQUM1RCxhQUFhLEVBQUUsSUFBSSxDQUFDLFVBQVU7WUFDOUIsSUFBSSxFQUFXO2dCQUNYO29CQUNJLE9BQU87b0JBQ1AsU0FBUyxFQUFFLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxFQUFFO29CQUN0QixRQUFRO2lCQUNYO2FBQ0o7U0FDSixDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQsTUFBTTtJQUNFLE1BQU0sQ0FBQyxlQUFlLENBQUUsSUFBVSxFQUFFLFdBQW1CO1FBQzNELE9BQU87WUFDSCxPQUFPLEVBQXFCLElBQUksQ0FBQyxPQUFrQjtZQUNuRCxJQUFJLEVBQXdCLElBQUk7WUFDaEMsVUFBVSxFQUFrQixFQUFFO1lBQzlCLGNBQWMsRUFBYyxJQUFJO1lBQ2hDLFdBQVcsRUFBaUIsRUFBRTtZQUM5QixNQUFNLEVBQXNCLEVBQUU7WUFDOUIsVUFBVSxFQUFrQixJQUFJO1lBQ2hDLElBQUksRUFBd0IsRUFBRTtZQUM5QixRQUFRLEVBQW9CLEVBQUU7WUFDOUIsUUFBUSxFQUFvQixLQUFLO1lBQ2pDLFNBQVMsRUFBbUIsSUFBSTtZQUNoQyxXQUFXLEVBQWlCLElBQUk7WUFDaEMsV0FBVyxFQUFpQixXQUFXO1lBQ3ZDLGFBQWEsRUFBZSxXQUFXO1lBQ3ZDLHlCQUF5QixFQUFHLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRTtZQUM1RCwwQkFBMEIsRUFBRSxRQUFRLENBQUMscUJBQXFCLEVBQUU7WUFDNUQsUUFBUSxFQUFvQixFQUFFO1NBQ2pDLENBQUM7SUFDTixDQUFDO0lBRU8sTUFBTSxDQUFDLGdCQUFnQixDQUFFLElBQVU7UUFDdkMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQztRQUV4RCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRU8sTUFBTSxDQUFDLGtCQUFrQixDQUFFLFVBQW9CO1FBQ25ELE9BQU87WUFDSCxJQUFJLEVBQVksSUFBQSxlQUFNLEVBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM5RCxRQUFRLEVBQVEsVUFBVSxDQUFDLFFBQVE7WUFDbkMsVUFBVSxFQUFNLENBQUMsSUFBSSxJQUFJLEVBQUUsR0FBSSxVQUFVLENBQUMsU0FBb0I7WUFDOUQsUUFBUSxFQUFRLFVBQVUsQ0FBQyxRQUFRO1lBQ25DLGNBQWMsRUFBRSxVQUFVLENBQUMsY0FBd0I7WUFDbkQsV0FBVyxFQUFLLFVBQVUsQ0FBQyxXQUFXO1lBQ3RDLE1BQU0sRUFBVSxVQUFVLENBQUMsTUFBTTtZQUNqQyxVQUFVLEVBQU0sVUFBVSxDQUFDLFVBQVU7WUFDckMsT0FBTyxFQUFTLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUNwQyxRQUFRLEVBQVEsVUFBVSxDQUFDLFFBQVE7WUFDbkMsTUFBTSxFQUFVLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNsQyxPQUFPLEVBQVM7Z0JBQ1osRUFBRSxFQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDM0IsSUFBSSxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSTtnQkFDN0IsSUFBSSxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSTtnQkFDN0IsSUFBSSxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSTthQUNoQztTQUNKLENBQUM7SUFDTixDQUFDO0lBRU8sc0JBQXNCLENBQUUsUUFBa0IsRUFBRSxPQUFnQjtRQUNoRSxPQUFPLElBQUEsYUFBSSxFQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRU8sS0FBSyxDQUFDLGVBQWU7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ2QsT0FBTztRQUVYLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQztRQUMxQixJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUM7UUFDMUIsSUFBSSxRQUFRLEdBQVMsSUFBSSxDQUFDO1FBQzFCLE1BQU0sU0FBUyxHQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDO1FBRTdDLE9BQU8sU0FBUyxDQUFDLE1BQU0sSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFO1lBQ2pELFFBQVEsR0FBUyxTQUFTLENBQUMsS0FBSyxFQUFjLENBQUM7WUFDL0MsY0FBYyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7WUFFbEMseURBQXlEO1lBQ3pELHFEQUFxRDtZQUNyRCw2Q0FBNkM7WUFDN0MsY0FBYyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUU5QixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDeEIsTUFBTSxFQUFTLHdCQUFvQixDQUFDLGNBQWM7Z0JBQ2xELGFBQWEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7Z0JBQ2pDLElBQUksRUFBVztvQkFDWCxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUk7b0JBQ2xCLFFBQVEsQ0FBQyxXQUFXO29CQUNwQixRQUFRLENBQUMsSUFBSSxDQUFDLElBQUk7aUJBQ3JCO2FBQ0osQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLGNBQWMsSUFBSSxjQUFjLENBQUMsT0FBTyxLQUFLLGNBQWM7Z0JBQzVELFNBQVM7WUFFYixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDeEIsTUFBTSxFQUFTLHdCQUFvQixDQUFDLGtCQUFrQjtnQkFDdEQsYUFBYSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSTtnQkFDakMsSUFBSSxFQUFXO29CQUNYLGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSTtvQkFDM0IsY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJO29CQUMzQixjQUFjLENBQUMsT0FBTyxDQUFDLElBQUk7aUJBQzlCO2FBQ0osQ0FBQyxDQUFDO1NBQ047SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGdCQUFnQixDQUFFLFFBQWtCLEVBQUUsUUFBa0IsRUFBRSxPQUFnQjtRQUNwRixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7WUFDZCxPQUFPO1FBRVgsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3hELFFBQVEsQ0FBQyxjQUFjLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3RSxRQUFRLENBQUMsV0FBVyxHQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN4RjtRQUVELElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNO1lBQ3BCLFFBQVEsQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFM0UsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1lBQ3BCLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBOEIsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEtBQWEsRUFBRSxFQUFFO2dCQUN4SCxNQUFNLE1BQU0sR0FBYyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7Z0JBQ3pDLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQztnQkFFcEMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQztnQkFFdkMsT0FBTyxNQUFNLENBQUM7WUFDbEIsQ0FBQyxFQUFFLEVBQUcsQ0FBQyxDQUFDO1lBRVIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1NBQ3BFO1FBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUU7WUFDdkIsUUFBUSxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFN0QsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUk7Z0JBQ2xCLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztpQkFDbEIsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU07Z0JBQ3pCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQzs7Z0JBRWxCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztTQUN6QjtRQUVELE1BQU0sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRTVCLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxPQUFvQixFQUFFLENBQUM7SUFDL0QsQ0FBQztJQUVPLGlDQUFpQyxDQUFFLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBa0M7UUFDbEgsTUFBTSxJQUFJLEdBQVEsRUFBRSxDQUFDO1FBRXJCLElBQUksR0FBRztZQUNILElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBRW5CLElBQUksT0FBTyxRQUFRLEtBQUssUUFBUTtZQUM1QixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUU3QixNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQWtCLENBQUM7UUFFcEQsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRTtZQUN2QixTQUFTLEVBQUUsT0FBTyxDQUFDLEVBQUU7WUFDckIsSUFBSSxFQUFPO2dCQUNQLEVBQUUsRUFBSyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3RCLElBQUksRUFBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUk7Z0JBQ3hCLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSzthQUN2QjtZQUNELE9BQU8sRUFBRTtnQkFDTCxJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUk7Z0JBQ3RCLEVBQUUsRUFBSSxXQUFXLENBQUMsRUFBRTthQUN2QjtZQUNELE9BQU8sRUFBRSxJQUFBLHdCQUFhLEVBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQztZQUN2QyxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87U0FDM0IsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUdPLEtBQUssQ0FBQyxxQkFBcUIsQ0FBRSxJQUFVO1FBQzNDLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDWixJQUFJLEVBQW9CLElBQUk7WUFDNUIsTUFBTSxFQUFrQixDQUFDO1lBQ3pCLE1BQU0sRUFBa0IsQ0FBQztZQUN6QixPQUFPLEVBQWlCLENBQUM7WUFDekIsU0FBUyxFQUFlLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTTtZQUNwRSxTQUFTLEVBQWUsUUFBUSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQztZQUN2RCxlQUFlLEVBQVMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUEwQjtZQUM1RCxzQkFBc0IsRUFBRSxRQUFRLENBQUMscUJBQXFCLEVBQUU7U0FDM0QsQ0FBQztRQUVGLE1BQU0sU0FBUyxHQUFnQixJQUFJLENBQUMsU0FBUyxDQUFDO1FBQzlDLE1BQU0sc0JBQXNCLEdBQUksRUFBMEI7YUFDckQsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDO2FBQ3ZDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNsRCxNQUFNLEtBQUssR0FBb0IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFMUQsTUFBTSxjQUFjLEdBQUc7WUFDbkIsYUFBYSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ3hCLFlBQVksRUFBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVk7U0FDeEMsQ0FBQztRQUVGLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDO1lBQ3hCLE1BQU0sRUFBUyx3QkFBb0IsQ0FBQyxlQUFlO1lBQ25ELGFBQWEsRUFBRSxJQUFJO1lBQ25CLElBQUksRUFBVztnQkFDWCxTQUFTO2dCQUNULHNCQUFzQjtnQkFDdEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTO2dCQUN2QixJQUFJLENBQUMsYUFBYTtnQkFDbEIsY0FBYzthQUNqQjtTQUNKLENBQUMsQ0FBQztRQUVILElBQUksS0FBSyxFQUFFO1lBQ1AsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ3hCLE1BQU0sRUFBUyx3QkFBb0IsQ0FBQyxrQkFBa0I7Z0JBQ3RELGFBQWEsRUFBRSxJQUFJO2dCQUNuQixJQUFJLEVBQVc7b0JBQ1gsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJO29CQUNsQixLQUFLLENBQUMsT0FBTyxDQUFDLElBQUk7b0JBQ2xCLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSTtpQkFDckI7YUFDSixDQUFDLENBQUM7U0FDTjtJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsMEJBQTBCLENBQUUsT0FBZ0I7UUFDdEQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ2QsT0FBTyxLQUFLLENBQUMsQ0FBQztRQUVsQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQWEsQ0FBQztRQUVqRixRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFckMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTO1lBQ25CLFFBQVEsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO1FBRXJDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUV6QixJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRTtZQUN6QixhQUFhO1lBQ2IsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRTtnQkFDN0IsTUFBTSxhQUFhLEdBQUc7b0JBQ2xCLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVTtvQkFDL0IsTUFBTSxFQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDNUIsU0FBUyxFQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7b0JBQ3hDLE9BQU8sRUFBSyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUk7aUJBQ2pDLENBQUM7Z0JBRUYsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUM7b0JBQ3hCLE1BQU0sRUFBUyx3QkFBb0IsQ0FBQyxlQUF5QjtvQkFDN0QsYUFBYSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSTtvQkFDakMsSUFBSSxFQUFXO3dCQUNYLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSTt3QkFDbEIsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJO3dCQUNsQixhQUFhO3FCQUNoQjtpQkFDSixDQUFDLENBQUM7YUFDTjtZQUVBLFFBQVEsQ0FBQywwQkFBMEIsQ0FBQyxPQUFvQixFQUFFLENBQUM7U0FDL0Q7UUFFRCxPQUFPLFFBQVEsQ0FBQywwQkFBMEIsQ0FBQztJQUMvQyxDQUFDO0lBRU8sS0FBSyxDQUFDLHlCQUF5QixDQUFFLE9BQWdCO1FBQ3JELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUNkLE9BQU87UUFFWCxNQUFNLFVBQVUsR0FBc0IsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFhLENBQUM7UUFDdEcsTUFBTSw2QkFBNkIsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUM7UUFDN0YsTUFBTSxPQUFPLEdBQXlCLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVoRyxVQUFVLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVsQyxVQUFVLENBQUMsV0FBVyxHQUFHLDZCQUE2QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1FBQ3hGLFVBQVUsQ0FBQyxRQUFRLEdBQU0sVUFBVSxDQUFDLFFBQVEsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDO1FBQ2pFLFVBQVUsQ0FBQyxJQUFJLEdBQVUsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlELFVBQVUsQ0FBQyxRQUFRLEdBQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBQSxjQUFLLEVBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFFM0csSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1lBQ3BCLFVBQVUsQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUM7WUFFcEQsTUFBTSxvQkFBb0IsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUE4QixFQUFFLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7Z0JBQ3RILE1BQU0sTUFBTSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztnQkFFOUIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFzQixFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQztnQkFDMUQsT0FBTyxDQUFDLDRCQUE0QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsSUFBSSxFQUFFLENBQUM7Z0JBRWxGLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBRXJELE9BQU8sTUFBTSxDQUFDO1lBQ2xCLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUVQLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1NBQzlEO1FBRUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXO1lBQ3ZCLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXBFLE1BQU0sVUFBVSxDQUFDLHlCQUF5QixDQUFDO0lBQy9DLENBQUM7SUFFTyxLQUFLLENBQUMsc0JBQXNCLENBQUUsRUFBOEQ7WUFBOUQsRUFBRSxhQUFhLE9BQStDLEVBQTFDLFFBQVEsY0FBNUIsaUJBQThCLENBQUY7UUFDOUQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ2QsT0FBTztRQUVYLGFBQWE7UUFDYixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMscUJBQXFCLEVBQUU7WUFDbkMsUUFBUSxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxRQUFxRCxDQUFDLENBQUM7WUFFekcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ3hCLE1BQU0sRUFBUyx3QkFBb0IsQ0FBQyxxQkFBK0I7Z0JBQ25FLGFBQWEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7Z0JBQ2pDLElBQUksRUFBVztvQkFDWCxhQUFhO29CQUNiLFFBQVE7aUJBQ1g7YUFDSixDQUFDLENBQUM7U0FDTjtJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMscUJBQXFCLENBQUUsRUFBOEQ7WUFBOUQsRUFBRSxhQUFhLE9BQStDLEVBQTFDLFFBQVEsY0FBNUIsaUJBQThCLENBQUY7UUFDN0QsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ2QsT0FBTztRQUVYLGFBQWE7UUFDYixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLEVBQUU7WUFDbEMsUUFBUSxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxRQUFxRCxDQUFDLENBQUM7WUFFekcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ3hCLE1BQU0sRUFBUyx3QkFBb0IsQ0FBQyxvQkFBOEI7Z0JBQ2xFLGFBQWEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7Z0JBQ2pDLElBQUksRUFBVztvQkFDWCxhQUFhO29CQUNiLFFBQVE7aUJBQ1g7YUFDSixDQUFDLENBQUM7U0FDTjtJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsb0JBQW9COztRQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFDZCxPQUFPO1FBRVgsTUFBTSxPQUFPLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUUzQixNQUFNLE1BQU0sR0FBRztZQUNYLFdBQVcsRUFBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU07WUFDbEMsV0FBVyxFQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTTtZQUNsQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPO1NBQ3RDLENBQUM7UUFFRixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztZQUN4QixNQUFNLEVBQVMsd0JBQW9CLENBQUMsY0FBYztZQUNsRCxhQUFhLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJO1lBQ2pDLElBQUksRUFBVztnQkFDWCxPQUFPO2dCQUNQLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTTtnQkFDcEIsTUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksMENBQUUsVUFBVSxDQUFDLFFBQVE7Z0JBQ3ZDLE1BQU07YUFDVDtTQUNKLENBQUMsQ0FBQztRQUVGLElBQUksQ0FBQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsT0FBb0IsRUFBRSxDQUFDO0lBQ2pFLENBQUM7Q0FDSjtBQTVmRCwyQkE0ZkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICAgIGZpbmQsXG4gICAgc29ydEJ5LFxuICAgIHVuaW9uLFxuICAgIGlzRnVuY3Rpb24sXG59IGZyb20gJ2xvZGFzaCc7XG5cbmltcG9ydCB7IHdyaXRhYmxlIGFzIGlzV3JpdGFibGVTdHJlYW0gfSBmcm9tICdpcy1zdHJlYW0nO1xuaW1wb3J0IFJlcG9ydGVyUGx1Z2luSG9zdCBmcm9tICcuL3BsdWdpbi1ob3N0JztcbmltcG9ydCBSZXBvcnRlclBsdWdpbk1ldGhvZCBmcm9tICcuL3BsdWdpbi1tZXRob2RzJztcbmltcG9ydCBmb3JtYXRDb21tYW5kIGZyb20gJy4vY29tbWFuZC9mb3JtYXQtY29tbWFuZCc7XG5pbXBvcnQgeyBSZXBvcnRlclBsdWdpbkVycm9yIH0gZnJvbSAnLi4vZXJyb3JzL3J1bnRpbWUnO1xuaW1wb3J0IFRhc2sgZnJvbSAnLi4vcnVubmVyL3Rhc2snO1xuaW1wb3J0IHsgV3JpdGFibGUgYXMgV3JpdGFibGVTdHJlYW0sIFdyaXRhYmxlIH0gZnJvbSAnc3RyZWFtJztcbmltcG9ydCB7IFdyaXRlU3RyZWFtIH0gZnJvbSAndHR5JztcbmltcG9ydCBUZXN0UnVuIGZyb20gJy4uL3Rlc3QtcnVuJztcbmltcG9ydCBUZXN0IGZyb20gJy4uL2FwaS9zdHJ1Y3R1cmUvdGVzdCc7XG5pbXBvcnQgRml4dHVyZSBmcm9tICcuLi9hcGkvc3RydWN0dXJlL2ZpeHR1cmUnO1xuaW1wb3J0IFRlc3RSdW5FcnJvckZvcm1hdHRhYmxlQWRhcHRlciBmcm9tICcuLi9lcnJvcnMvdGVzdC1ydW4vZm9ybWF0dGFibGUtYWRhcHRlcic7XG5pbXBvcnQgeyBDb21tYW5kQmFzZSB9IGZyb20gJy4uL3Rlc3QtcnVuL2NvbW1hbmRzL2Jhc2UnO1xuXG5pbXBvcnQge1xuICAgIFJlcG9ydGVyUGx1Z2luLFxuICAgIFJlcG9ydGVyUGx1Z2luU291cmNlLFxuICAgIFJlcG9ydGVyU291cmNlLFxufSBmcm9tICcuL2ludGVyZmFjZXMnO1xuXG5pbXBvcnQgeyBnZXRQbHVnaW5GYWN0b3J5LCBwcm9jZXNzUmVwb3J0ZXJOYW1lIH0gZnJvbSAnLi4vdXRpbHMvcmVwb3J0ZXInO1xuaW1wb3J0IHJlc29sdmVQYXRoUmVsYXRpdmVseUN3ZCBmcm9tICcuLi91dGlscy9yZXNvbHZlLXBhdGgtcmVsYXRpdmVseS1jd2QnO1xuaW1wb3J0IG1ha2VEaXIgZnJvbSAnbWFrZS1kaXInO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IE1lc3NhZ2VCdXMgZnJvbSAnLi4vdXRpbHMvbWVzc2FnZS1idXMnO1xuaW1wb3J0IEJyb3dzZXJDb25uZWN0aW9uIGZyb20gJy4uL2Jyb3dzZXIvY29ubmVjdGlvbic7XG5pbXBvcnQgeyBEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vY29uZmlndXJhdGlvbi9pbnRlcmZhY2VzJztcbmltcG9ydCBkZWJ1ZyBmcm9tICdkZWJ1Zyc7XG5cbmludGVyZmFjZSBQZW5kaW5nUHJvbWlzZSB7XG4gICAgcmVzb2x2ZTogRnVuY3Rpb24gfCBudWxsO1xuICAgIHRoZW46IEZ1bmN0aW9uO1xufVxuXG5pbnRlcmZhY2UgVGFza0luZm8ge1xuICAgIHRhc2s6IFRhc2sgfCBudWxsO1xuICAgIHBhc3NlZDogbnVtYmVyO1xuICAgIGZhaWxlZDogbnVtYmVyO1xuICAgIHNraXBwZWQ6IG51bWJlcjtcbiAgICB0ZXN0Q291bnQ6IG51bWJlcjtcbiAgICB0ZXN0UXVldWU6IFRlc3RJbmZvW107XG4gICAgcmVhZG9ubHkgc3RvcE9uRmlyc3RGYWlsOiBib29sZWFuO1xuICAgIHJlYWRvbmx5IHBlbmRpbmdUYXNrRG9uZVByb21pc2U6IFBlbmRpbmdQcm9taXNlO1xufVxuXG5pbnRlcmZhY2UgVGVzdEluZm8ge1xuICAgIGZpeHR1cmU6IEZpeHR1cmU7XG4gICAgdGVzdDogVGVzdDtcbiAgICB0ZXN0UnVuSWRzOiBzdHJpbmdbXTtcbiAgICBzY3JlZW5zaG90UGF0aDogbnVsbCB8IHN0cmluZztcbiAgICBzY3JlZW5zaG90czogdW5rbm93bltdO1xuICAgIHZpZGVvczogdW5rbm93bltdO1xuICAgIHF1YXJhbnRpbmU6IG51bGwgfCBSZWNvcmQ8c3RyaW5nLCBvYmplY3Q+O1xuICAgIGVycnM6IFRlc3RSdW5FcnJvckZvcm1hdHRhYmxlQWRhcHRlcltdO1xuICAgIHdhcm5pbmdzOiBzdHJpbmdbXTtcbiAgICB1bnN0YWJsZTogYm9vbGVhbjtcbiAgICBzdGFydFRpbWU6IG51bGwgfCBudW1iZXI7XG4gICAgdGVzdFJ1bkluZm86IG51bGwgfCBUZXN0UnVuSW5mbztcbiAgICBwZW5kaW5nUnVuczogbnVtYmVyO1xuICAgIHBlbmRpbmdTdGFydHM6IG51bWJlcjtcbiAgICBwZW5kaW5nVGVzdFJ1bkRvbmVQcm9taXNlOiBQZW5kaW5nUHJvbWlzZTtcbiAgICBwZW5kaW5nVGVzdFJ1blN0YXJ0UHJvbWlzZTogUGVuZGluZ1Byb21pc2U7XG4gICAgYnJvd3NlcnM6IEJyb3dzZXJSdW5JbmZvW107XG59XG5cbmludGVyZmFjZSBGaXh0dXJlSW5mbyB7XG4gICAgaWQ6IHN0cmluZztcbiAgICBuYW1lOiBzdHJpbmcgfCBudWxsO1xuICAgIHBhdGg6IHN0cmluZztcbiAgICBtZXRhOiBEaWN0aW9uYXJ5PHN0cmluZz47XG59XG5cbmludGVyZmFjZSBCcm93c2VyUnVuSW5mbyBleHRlbmRzIEJyb3dzZXIge1xuICAgIHRlc3RSdW5JZDogc3RyaW5nO1xuICAgIHF1YXJhbnRpbmVBdHRlbXB0c1Rlc3RSdW5JZHM/OiBzdHJpbmdbXTtcbn1cblxuaW50ZXJmYWNlIFRlc3RSdW5JbmZvIHtcbiAgICBlcnJzOiBUZXN0UnVuRXJyb3JGb3JtYXR0YWJsZUFkYXB0ZXJbXTtcbiAgICB3YXJuaW5nczogc3RyaW5nW107XG4gICAgZHVyYXRpb25NczogbnVtYmVyO1xuICAgIHVuc3RhYmxlOiBib29sZWFuO1xuICAgIHNjcmVlbnNob3RQYXRoOiBzdHJpbmc7XG4gICAgc2NyZWVuc2hvdHM6IHVua25vd247XG4gICAgdmlkZW9zOiB1bmtub3duO1xuICAgIHF1YXJhbnRpbmU6IHVua25vd247XG4gICAgc2tpcHBlZDogYm9vbGVhbjtcbiAgICBicm93c2VyczogdW5rbm93bltdO1xuICAgIHRlc3RJZDogc3RyaW5nO1xuICAgIGZpeHR1cmU6IEZpeHR1cmVJbmZvO1xufVxuXG5pbnRlcmZhY2UgUGx1Z2luTWV0aG9kQXJndW1lbnRzIHtcbiAgICBpbml0aWFsT2JqZWN0OiBUYXNrIHwgTWVzc2FnZUJ1cyB8IG51bGw7XG4gICAgbWV0aG9kOiBzdHJpbmc7XG4gICAgYXJnczogdW5rbm93bltdO1xufVxuXG5pbnRlcmZhY2UgUmVwb3J0VGVzdEFjdGlvbkV2ZW50QXJndW1lbnRzIHtcbiAgICBjb21tYW5kOiBDb21tYW5kQmFzZTtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIHJlc3VsdDogdW5rbm93bjtcbiAgICB0ZXN0UnVuOiBUZXN0UnVuO1xuICAgIGVycjogVGVzdFJ1bkVycm9yRm9ybWF0dGFibGVBZGFwdGVyO1xufVxuXG5pbnRlcmZhY2UgUmVwb3J0VGFza0FjdGlvbkV2ZW50QXJndW1lbnRzIHtcbiAgICBhcGlBY3Rpb25OYW1lOiBzdHJpbmc7XG4gICAgcmVzdEFyZ3M6IG9iamVjdDtcbn1cblxuaW50ZXJmYWNlIFJlcG9ydFdhcm5pbmdFdmVudEFyZ3VtZW50cyB7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIHRlc3RSdW4/OiBUZXN0UnVuO1xuICAgIGFjdGlvbklkPzogc3RyaW5nO1xufVxuXG5jb25zdCBkZWJ1Z0xvZyA9IGRlYnVnKCd0ZXN0Y2FmZTpyZXBvcnRlcicpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSZXBvcnRlciB7XG4gICAgcHVibGljIHJlYWRvbmx5IHBsdWdpbjogUmVwb3J0ZXJQbHVnaW5Ib3N0O1xuICAgIHB1YmxpYyByZWFkb25seSBtZXNzYWdlQnVzOiBNZXNzYWdlQnVzO1xuICAgIHB1YmxpYyBkaXNwb3NlZDogYm9vbGVhbjtcbiAgICBwdWJsaWMgdGFza0luZm86IFRhc2tJbmZvIHwgbnVsbDtcbiAgICBwdWJsaWMgcmVhZG9ubHkgb3V0U3RyZWFtOiBXcml0YWJsZTtcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvciAocGx1Z2luOiBSZXBvcnRlclBsdWdpbiwgbWVzc2FnZUJ1czogTWVzc2FnZUJ1cywgb3V0U3RyZWFtOiBXcml0YWJsZSwgbmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucGx1Z2luICAgICA9IG5ldyBSZXBvcnRlclBsdWdpbkhvc3QocGx1Z2luLCBvdXRTdHJlYW0sIG5hbWUpO1xuICAgICAgICB0aGlzLm1lc3NhZ2VCdXMgPSBtZXNzYWdlQnVzO1xuXG4gICAgICAgIHRoaXMuZGlzcG9zZWQgID0gZmFsc2U7XG4gICAgICAgIHRoaXMudGFza0luZm8gID0gbnVsbDtcbiAgICAgICAgdGhpcy5vdXRTdHJlYW0gPSBvdXRTdHJlYW07XG5cbiAgICAgICAgdGhpcy5fYXNzaWduTWVzc2FnZUJ1c0V2ZW50SGFuZGxlcnMoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBfaXNTcGVjaWFsU3RyZWFtIChzdHJlYW06IFdyaXRhYmxlKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiAoc3RyZWFtIGFzIFdyaXRlU3RyZWFtKS5pc1RUWSB8fCBzdHJlYW0gPT09IHByb2Nlc3Muc3Rkb3V0IHx8IHN0cmVhbSA9PT0gcHJvY2Vzcy5zdGRlcnI7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgX2NyZWF0ZVBlbmRpbmdQcm9taXNlICgpOiBQZW5kaW5nUHJvbWlzZSB7XG4gICAgICAgIGxldCByZXNvbHZlciA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZXIgPSByZXNvbHZlO1xuICAgICAgICB9KSBhcyB1bmtub3duIGFzIFBlbmRpbmdQcm9taXNlO1xuXG4gICAgICAgIHByb21pc2UucmVzb2x2ZSA9IHJlc29sdmVyO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBpbml0ICgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5kaXNwYXRjaFRvUGx1Z2luKHtcbiAgICAgICAgICAgIG1ldGhvZDogICAgICAgIFJlcG9ydGVyUGx1Z2luTWV0aG9kLmluaXQsXG4gICAgICAgICAgICBpbml0aWFsT2JqZWN0OiBudWxsLFxuICAgICAgICAgICAgYXJnczogICAgICAgICAgW3t9XSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRpc3BhdGNoVG9QbHVnaW4gKHsgbWV0aG9kLCBpbml0aWFsT2JqZWN0LCBhcmdzID0gW10gfTogUGx1Z2luTWV0aG9kQXJndW1lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpblttZXRob2RdKC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChvcmlnaW5hbEVycm9yKSB7XG4gICAgICAgICAgICBjb25zdCB1bmNhdWdodEVycm9yID0gbmV3IFJlcG9ydGVyUGx1Z2luRXJyb3Ioe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRoaXMucGx1Z2luLm5hbWUsXG4gICAgICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsRXJyb3IsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVidWdMb2coJ1BsdWdpbiBlcnJvcjogJU8nLCB1bmNhdWdodEVycm9yKTtcbiAgICAgICAgICAgIGRlYnVnTG9nKCdQbHVnaW4gZXJyb3I6IGluaXRpYWxPYmplY3Q6ICVPJywgaW5pdGlhbE9iamVjdCk7XG5cbiAgICAgICAgICAgIGlmIChpbml0aWFsT2JqZWN0KVxuICAgICAgICAgICAgICAgIGF3YWl0IGluaXRpYWxPYmplY3QuZW1pdCgnZXJyb3InLCB1bmNhdWdodEVycm9yKTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICB0aHJvdyB1bmNhdWdodEVycm9yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfYXNzaWduTWVzc2FnZUJ1c0V2ZW50SGFuZGxlcnMgKCk6IHZvaWQge1xuICAgICAgICBjb25zdCBtZXNzYWdlQnVzID0gdGhpcy5tZXNzYWdlQnVzO1xuXG4gICAgICAgIG1lc3NhZ2VCdXMub24oJ3dhcm5pbmctYWRkJywgYXN5bmMgZSA9PiBhd2FpdCB0aGlzLl9vbldhcm5pbmdBZGRIYW5kbGVyKGUpKTtcblxuICAgICAgICBtZXNzYWdlQnVzLm9uY2UoJ3N0YXJ0JywgYXN5bmMgKHRhc2s6IFRhc2spID0+IGF3YWl0IHRoaXMuX29uY2VUYXNrU3RhcnRIYW5kbGVyKHRhc2spKTtcblxuICAgICAgICBtZXNzYWdlQnVzLm9uKCd0ZXN0LXJ1bi1zdGFydCcsIGFzeW5jIHRlc3RSdW4gPT4gYXdhaXQgdGhpcy5fb25UYXNrVGVzdFJ1blN0YXJ0SGFuZGxlcih0ZXN0UnVuKSk7XG5cbiAgICAgICAgbWVzc2FnZUJ1cy5vbigndGVzdC1ydW4tZG9uZScsIGFzeW5jIHRlc3RSdW4gPT4gYXdhaXQgdGhpcy5fb25UYXNrVGVzdFJ1bkRvbmVIYW5kbGVyKHRlc3RSdW4pKTtcblxuICAgICAgICBtZXNzYWdlQnVzLm9uKCd0ZXN0LWFjdGlvbi1zdGFydCcsIGFzeW5jIGUgPT4gYXdhaXQgdGhpcy5fb25UYXNrVGVzdEFjdGlvblN0YXJ0KGUpKTtcblxuICAgICAgICBtZXNzYWdlQnVzLm9uKCd0ZXN0LWFjdGlvbi1kb25lJywgYXN5bmMgZSA9PiBhd2FpdCB0aGlzLl9vblRhc2tUZXN0QWN0aW9uRG9uZShlKSk7XG5cbiAgICAgICAgbWVzc2FnZUJ1cy5vbmNlKCdkb25lJywgYXN5bmMgKCkgPT4gYXdhaXQgdGhpcy5fb25jZVRhc2tEb25lSGFuZGxlcigpKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGlzcG9zZSAoKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgICAgIGlmICh0aGlzLmRpc3Bvc2VkKVxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXG4gICAgICAgIHRoaXMuZGlzcG9zZWQgPSB0cnVlO1xuXG4gICAgICAgIGlmICghaXNGdW5jdGlvbih0aGlzPy5vdXRTdHJlYW0/Lm9uY2UpXG4gICAgICAgICAgICB8fCBSZXBvcnRlci5faXNTcGVjaWFsU3RyZWFtKHRoaXMub3V0U3RyZWFtKVxuICAgICAgICAgICAgfHwgIWlzV3JpdGFibGVTdHJlYW0odGhpcy5vdXRTdHJlYW0pKVxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXG4gICAgICAgIGNvbnN0IHN0cmVhbUZpbmlzaGVkUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgdGhpcy5vdXRTdHJlYW0ub25jZSgnZmluaXNoJywgcmVzb2x2ZSk7XG4gICAgICAgICAgICB0aGlzLm91dFN0cmVhbS5vbmNlKCdlcnJvcicsIHJlc29sdmUpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm91dFN0cmVhbS5lbmQoKTtcblxuICAgICAgICByZXR1cm4gc3RyZWFtRmluaXNoZWRQcm9taXNlO1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIGFzeW5jIF9lbnN1cmVPdXRTdHJlYW0gKG91dFN0cmVhbTogc3RyaW5nIHwgV3JpdGFibGVTdHJlYW0pOiBQcm9taXNlPFdyaXRhYmxlU3RyZWFtPiB7XG4gICAgICAgIGlmICh0eXBlb2Ygb3V0U3RyZWFtICE9PSAnc3RyaW5nJylcbiAgICAgICAgICAgIHJldHVybiBvdXRTdHJlYW07XG5cbiAgICAgICAgY29uc3QgZnVsbFJlcG9ydGVyT3V0cHV0UGF0aCA9IHJlc29sdmVQYXRoUmVsYXRpdmVseUN3ZChvdXRTdHJlYW0pO1xuXG4gICAgICAgIGF3YWl0IG1ha2VEaXIocGF0aC5kaXJuYW1lKGZ1bGxSZXBvcnRlck91dHB1dFBhdGgpKTtcblxuICAgICAgICByZXR1cm4gZnMuY3JlYXRlV3JpdGVTdHJlYW0oZnVsbFJlcG9ydGVyT3V0cHV0UGF0aCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgX2FkZERlZmF1bHRSZXBvcnRlciAocmVwb3J0ZXJzOiBSZXBvcnRlclNvdXJjZVtdKTogdm9pZCB7XG4gICAgICAgIHJlcG9ydGVycy5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6ICAgJ3NwZWMnLFxuICAgICAgICAgICAgb3V0cHV0OiBwcm9jZXNzLnN0ZG91dCxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRSZXBvcnRlclBsdWdpbnMgKHJlcG9ydGVyczogUmVwb3J0ZXJTb3VyY2VbXSA9IFtdKTogUHJvbWlzZTxSZXBvcnRlclBsdWdpblNvdXJjZVtdPiB7XG4gICAgICAgIGlmICghcmVwb3J0ZXJzLmxlbmd0aClcbiAgICAgICAgICAgIFJlcG9ydGVyLl9hZGREZWZhdWx0UmVwb3J0ZXIocmVwb3J0ZXJzKTtcblxuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwocmVwb3J0ZXJzLm1hcChhc3luYyAoeyBuYW1lLCBvdXRwdXQsIG9wdGlvbnMgfSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGx1Z2luRmFjdG9yeSA9IGdldFBsdWdpbkZhY3RvcnkobmFtZSk7XG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzZWROYW1lID0gcHJvY2Vzc1JlcG9ydGVyTmFtZShuYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IG91dFN0cmVhbSAgICAgPSBvdXRwdXQgPyBhd2FpdCBSZXBvcnRlci5fZW5zdXJlT3V0U3RyZWFtKG91dHB1dCkgOiB2b2lkIDA7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcGx1Z2luOiBwbHVnaW5GYWN0b3J5KG9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIG5hbWU6ICAgcHJvY2Vzc2VkTmFtZSxcbiAgICAgICAgICAgICAgICBvdXRTdHJlYW0sXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfb25XYXJuaW5nQWRkSGFuZGxlciAoeyBtZXNzYWdlLCB0ZXN0UnVuLCBhY3Rpb25JZCB9OiBSZXBvcnRXYXJuaW5nRXZlbnRBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5kaXNwYXRjaFRvUGx1Z2luKHtcbiAgICAgICAgICAgIG1ldGhvZDogICAgICAgIFJlcG9ydGVyUGx1Z2luTWV0aG9kLnJlcG9ydFdhcm5pbmdzIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGluaXRpYWxPYmplY3Q6IHRoaXMubWVzc2FnZUJ1cyxcbiAgICAgICAgICAgIGFyZ3M6ICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIHRlc3RSdW5JZDogdGVzdFJ1bj8uaWQsXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbklkLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvL1Rhc2tcbiAgICBwcml2YXRlIHN0YXRpYyBfY3JlYXRlVGVzdEl0ZW0gKHRlc3Q6IFRlc3QsIHJ1bnNQZXJUZXN0OiBudW1iZXIpOiBUZXN0SW5mbyB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBmaXh0dXJlOiAgICAgICAgICAgICAgICAgICAgdGVzdC5maXh0dXJlIGFzIEZpeHR1cmUsXG4gICAgICAgICAgICB0ZXN0OiAgICAgICAgICAgICAgICAgICAgICAgdGVzdCxcbiAgICAgICAgICAgIHRlc3RSdW5JZHM6ICAgICAgICAgICAgICAgICBbXSxcbiAgICAgICAgICAgIHNjcmVlbnNob3RQYXRoOiAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgc2NyZWVuc2hvdHM6ICAgICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgdmlkZW9zOiAgICAgICAgICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgcXVhcmFudGluZTogICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICBlcnJzOiAgICAgICAgICAgICAgICAgICAgICAgW10sXG4gICAgICAgICAgICB3YXJuaW5nczogICAgICAgICAgICAgICAgICAgW10sXG4gICAgICAgICAgICB1bnN0YWJsZTogICAgICAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICBzdGFydFRpbWU6ICAgICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIHRlc3RSdW5JbmZvOiAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgcGVuZGluZ1J1bnM6ICAgICAgICAgICAgICAgIHJ1bnNQZXJUZXN0LFxuICAgICAgICAgICAgcGVuZGluZ1N0YXJ0czogICAgICAgICAgICAgIHJ1bnNQZXJUZXN0LFxuICAgICAgICAgICAgcGVuZGluZ1Rlc3RSdW5Eb25lUHJvbWlzZTogIFJlcG9ydGVyLl9jcmVhdGVQZW5kaW5nUHJvbWlzZSgpLFxuICAgICAgICAgICAgcGVuZGluZ1Rlc3RSdW5TdGFydFByb21pc2U6IFJlcG9ydGVyLl9jcmVhdGVQZW5kaW5nUHJvbWlzZSgpLFxuICAgICAgICAgICAgYnJvd3NlcnM6ICAgICAgICAgICAgICAgICAgIFtdLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIF9jcmVhdGVUZXN0UXVldWUgKHRhc2s6IFRhc2spOiBUZXN0SW5mb1tdIHtcbiAgICAgICAgY29uc3QgcnVuc1BlclRlc3QgPSB0YXNrLmJyb3dzZXJDb25uZWN0aW9uR3JvdXBzLmxlbmd0aDtcblxuICAgICAgICByZXR1cm4gdGFzay50ZXN0cy5tYXAodGVzdCA9PiBSZXBvcnRlci5fY3JlYXRlVGVzdEl0ZW0odGVzdCwgcnVuc1BlclRlc3QpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBfY3JlYXRlVGVzdFJ1bkluZm8gKHJlcG9ydEl0ZW06IFRlc3RJbmZvKTogVGVzdFJ1bkluZm8ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZXJyczogICAgICAgICAgIHNvcnRCeShyZXBvcnRJdGVtLmVycnMsIFsndXNlckFnZW50JywgJ2NvZGUnXSksXG4gICAgICAgICAgICB3YXJuaW5nczogICAgICAgcmVwb3J0SXRlbS53YXJuaW5ncyxcbiAgICAgICAgICAgIGR1cmF0aW9uTXM6ICAgICArbmV3IERhdGUoKSAtIChyZXBvcnRJdGVtLnN0YXJ0VGltZSBhcyBudW1iZXIpLCAvL2VzbGludC1kaXNhYmxlLWxpbmUgIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHRyYS1wYXJlbnNcbiAgICAgICAgICAgIHVuc3RhYmxlOiAgICAgICByZXBvcnRJdGVtLnVuc3RhYmxlLFxuICAgICAgICAgICAgc2NyZWVuc2hvdFBhdGg6IHJlcG9ydEl0ZW0uc2NyZWVuc2hvdFBhdGggYXMgc3RyaW5nLFxuICAgICAgICAgICAgc2NyZWVuc2hvdHM6ICAgIHJlcG9ydEl0ZW0uc2NyZWVuc2hvdHMsXG4gICAgICAgICAgICB2aWRlb3M6ICAgICAgICAgcmVwb3J0SXRlbS52aWRlb3MsXG4gICAgICAgICAgICBxdWFyYW50aW5lOiAgICAgcmVwb3J0SXRlbS5xdWFyYW50aW5lLFxuICAgICAgICAgICAgc2tpcHBlZDogICAgICAgIHJlcG9ydEl0ZW0udGVzdC5za2lwLFxuICAgICAgICAgICAgYnJvd3NlcnM6ICAgICAgIHJlcG9ydEl0ZW0uYnJvd3NlcnMsXG4gICAgICAgICAgICB0ZXN0SWQ6ICAgICAgICAgcmVwb3J0SXRlbS50ZXN0LmlkLFxuICAgICAgICAgICAgZml4dHVyZTogICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogICByZXBvcnRJdGVtLmZpeHR1cmUuaWQsXG4gICAgICAgICAgICAgICAgbmFtZTogcmVwb3J0SXRlbS5maXh0dXJlLm5hbWUsXG4gICAgICAgICAgICAgICAgcGF0aDogcmVwb3J0SXRlbS5maXh0dXJlLnBhdGgsXG4gICAgICAgICAgICAgICAgbWV0YTogcmVwb3J0SXRlbS5maXh0dXJlLm1ldGEsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgX2dldFRlc3RJdGVtRm9yVGVzdFJ1biAodGFza0luZm86IFRhc2tJbmZvLCB0ZXN0UnVuOiBUZXN0UnVuKTogVGVzdEluZm8gfCB1bmRlZmluZWQge1xuICAgICAgICByZXR1cm4gZmluZCh0YXNrSW5mby50ZXN0UXVldWUsIGkgPT4gaS50ZXN0ID09PSB0ZXN0UnVuLnRlc3QpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX3NoaWZ0VGVzdFF1ZXVlICgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKCF0aGlzLnRhc2tJbmZvKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCBjdXJyZW50Rml4dHVyZSA9IG51bGw7XG4gICAgICAgIGxldCBuZXh0UmVwb3J0SXRlbSA9IG51bGw7XG4gICAgICAgIGxldCB0ZXN0SXRlbSAgICAgICA9IG51bGw7XG4gICAgICAgIGNvbnN0IHRlc3RRdWV1ZSAgICA9IHRoaXMudGFza0luZm8udGVzdFF1ZXVlO1xuXG4gICAgICAgIHdoaWxlICh0ZXN0UXVldWUubGVuZ3RoICYmIHRlc3RRdWV1ZVswXS50ZXN0UnVuSW5mbykge1xuICAgICAgICAgICAgdGVzdEl0ZW0gICAgICAgPSB0ZXN0UXVldWUuc2hpZnQoKSBhcyBUZXN0SW5mbztcbiAgICAgICAgICAgIGN1cnJlbnRGaXh0dXJlID0gdGVzdEl0ZW0uZml4dHVyZTtcblxuICAgICAgICAgICAgLy8gTk9URTogaGVyZSB3ZSBhc3N1bWUgdGhhdCB0ZXN0cyBhcmUgc29ydGVkIGJ5IGZpeHR1cmUuXG4gICAgICAgICAgICAvLyBUaGVyZWZvcmUsIGlmIHRoZSBuZXh0IHJlcG9ydCBpdGVtIGhhcyBhIGRpZmZlcmVudFxuICAgICAgICAgICAgLy8gZml4dHVyZSwgd2UgY2FuIHJlcG9ydCB0aGlzIGZpeHR1cmUgc3RhcnQuXG4gICAgICAgICAgICBuZXh0UmVwb3J0SXRlbSA9IHRlc3RRdWV1ZVswXTtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5kaXNwYXRjaFRvUGx1Z2luKHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICAgICAgICBSZXBvcnRlclBsdWdpbk1ldGhvZC5yZXBvcnRUZXN0RG9uZSxcbiAgICAgICAgICAgICAgICBpbml0aWFsT2JqZWN0OiB0aGlzLnRhc2tJbmZvLnRhc2ssXG4gICAgICAgICAgICAgICAgYXJnczogICAgICAgICAgW1xuICAgICAgICAgICAgICAgICAgICB0ZXN0SXRlbS50ZXN0Lm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHRlc3RJdGVtLnRlc3RSdW5JbmZvLFxuICAgICAgICAgICAgICAgICAgICB0ZXN0SXRlbS50ZXN0Lm1ldGEsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAoIW5leHRSZXBvcnRJdGVtIHx8IG5leHRSZXBvcnRJdGVtLmZpeHR1cmUgPT09IGN1cnJlbnRGaXh0dXJlKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmRpc3BhdGNoVG9QbHVnaW4oe1xuICAgICAgICAgICAgICAgIG1ldGhvZDogICAgICAgIFJlcG9ydGVyUGx1Z2luTWV0aG9kLnJlcG9ydEZpeHR1cmVTdGFydCxcbiAgICAgICAgICAgICAgICBpbml0aWFsT2JqZWN0OiB0aGlzLnRhc2tJbmZvLnRhc2ssXG4gICAgICAgICAgICAgICAgYXJnczogICAgICAgICAgW1xuICAgICAgICAgICAgICAgICAgICBuZXh0UmVwb3J0SXRlbS5maXh0dXJlLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIG5leHRSZXBvcnRJdGVtLmZpeHR1cmUucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgbmV4dFJlcG9ydEl0ZW0uZml4dHVyZS5tZXRhLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX3Jlc29sdmVUZXN0SXRlbSAodGFza0luZm86IFRhc2tJbmZvLCB0ZXN0SXRlbTogVGVzdEluZm8sIHRlc3RSdW46IFRlc3RSdW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKCF0YXNrSW5mby50YXNrKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0YXNrSW5mby50YXNrLnNjcmVlbnNob3RzLmhhc0NhcHR1cmVkRm9yKHRlc3RSdW4udGVzdCkpIHtcbiAgICAgICAgICAgIHRlc3RJdGVtLnNjcmVlbnNob3RQYXRoID0gdGFza0luZm8udGFzay5zY3JlZW5zaG90cy5nZXRQYXRoRm9yKHRlc3RSdW4udGVzdCk7XG4gICAgICAgICAgICB0ZXN0SXRlbS5zY3JlZW5zaG90cyAgICA9IHRhc2tJbmZvLnRhc2suc2NyZWVuc2hvdHMuZ2V0U2NyZWVuc2hvdHNJbmZvKHRlc3RSdW4udGVzdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGFza0luZm8udGFzay52aWRlb3MpXG4gICAgICAgICAgICB0ZXN0SXRlbS52aWRlb3MgPSB0YXNrSW5mby50YXNrLnZpZGVvcy5nZXRUZXN0VmlkZW9zKHRlc3RJdGVtLnRlc3QuaWQpO1xuXG4gICAgICAgIGlmICh0ZXN0UnVuLnF1YXJhbnRpbmUpIHtcbiAgICAgICAgICAgIGNvbnN0IHRlc3RJdGVtUXVhcmFudGluZSA9IHRlc3RSdW4ucXVhcmFudGluZS5hdHRlbXB0cy5yZWR1Y2UoKHJlc3VsdDogUmVjb3JkPHN0cmluZywgb2JqZWN0PiwgeyBlcnJvcnMgfSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhc3NlZCAgICAgICAgICAgID0gIWVycm9ycy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgY29uc3QgcXVhcmFudGluZUF0dGVtcHQgPSBpbmRleCArIDE7XG5cbiAgICAgICAgICAgICAgICByZXN1bHRbcXVhcmFudGluZUF0dGVtcHRdID0geyBwYXNzZWQgfTtcblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9LCB7IH0pO1xuXG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKHRlc3RJdGVtLnF1YXJhbnRpbmUgYXMgb2JqZWN0LCB0ZXN0SXRlbVF1YXJhbnRpbmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0ZXN0SXRlbS50ZXN0UnVuSW5mbykge1xuICAgICAgICAgICAgdGVzdEl0ZW0udGVzdFJ1bkluZm8gPSBSZXBvcnRlci5fY3JlYXRlVGVzdFJ1bkluZm8odGVzdEl0ZW0pO1xuXG4gICAgICAgICAgICBpZiAodGVzdEl0ZW0udGVzdC5za2lwKVxuICAgICAgICAgICAgICAgIHRhc2tJbmZvLnNraXBwZWQrKztcbiAgICAgICAgICAgIGVsc2UgaWYgKHRlc3RJdGVtLmVycnMubGVuZ3RoKVxuICAgICAgICAgICAgICAgIHRhc2tJbmZvLmZhaWxlZCsrO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHRhc2tJbmZvLnBhc3NlZCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdGhpcy5fc2hpZnRUZXN0UXVldWUoKTtcblxuICAgICAgICAodGVzdEl0ZW0ucGVuZGluZ1Rlc3RSdW5Eb25lUHJvbWlzZS5yZXNvbHZlIGFzIEZ1bmN0aW9uKSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgX3ByZXBhcmVSZXBvcnRUZXN0QWN0aW9uRXZlbnRBcmdzICh7IGNvbW1hbmQsIGR1cmF0aW9uLCByZXN1bHQsIHRlc3RSdW4sIGVyciB9OiBSZXBvcnRUZXN0QWN0aW9uRXZlbnRBcmd1bWVudHMpOiBhbnkge1xuICAgICAgICBjb25zdCBhcmdzOiBhbnkgPSB7fTtcblxuICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgYXJncy5lcnIgPSBlcnI7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBkdXJhdGlvbiA9PT0gJ251bWJlcicpXG4gICAgICAgICAgICBhcmdzLmR1cmF0aW9uID0gZHVyYXRpb247XG5cbiAgICAgICAgY29uc3QgdGVzdEZpeHR1cmUgPSB0ZXN0UnVuLnRlc3QuZml4dHVyZSBhcyBGaXh0dXJlO1xuXG4gICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKGFyZ3MsIHtcbiAgICAgICAgICAgIHRlc3RSdW5JZDogdGVzdFJ1bi5pZCxcbiAgICAgICAgICAgIHRlc3Q6ICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAgICB0ZXN0UnVuLnRlc3QuaWQsXG4gICAgICAgICAgICAgICAgbmFtZTogIHRlc3RSdW4udGVzdC5uYW1lLFxuICAgICAgICAgICAgICAgIHBoYXNlOiB0ZXN0UnVuLnBoYXNlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZpeHR1cmU6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0ZXN0Rml4dHVyZS5uYW1lLFxuICAgICAgICAgICAgICAgIGlkOiAgIHRlc3RGaXh0dXJlLmlkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbW1hbmQ6IGZvcm1hdENvbW1hbmQoY29tbWFuZCwgcmVzdWx0KSxcbiAgICAgICAgICAgIGJyb3dzZXI6IHRlc3RSdW4uYnJvd3NlcixcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICBwcml2YXRlIGFzeW5jIF9vbmNlVGFza1N0YXJ0SGFuZGxlciAodGFzazogVGFzayk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0aGlzLnRhc2tJbmZvID0ge1xuICAgICAgICAgICAgdGFzazogICAgICAgICAgICAgICAgICAgdGFzayxcbiAgICAgICAgICAgIHBhc3NlZDogICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBmYWlsZWQ6ICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgc2tpcHBlZDogICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIHRlc3RDb3VudDogICAgICAgICAgICAgIHRhc2sudGVzdHMuZmlsdGVyKHRlc3QgPT4gIXRlc3Quc2tpcCkubGVuZ3RoLFxuICAgICAgICAgICAgdGVzdFF1ZXVlOiAgICAgICAgICAgICAgUmVwb3J0ZXIuX2NyZWF0ZVRlc3RRdWV1ZSh0YXNrKSxcbiAgICAgICAgICAgIHN0b3BPbkZpcnN0RmFpbDogICAgICAgIHRhc2sub3B0cy5zdG9wT25GaXJzdEZhaWwgYXMgYm9vbGVhbixcbiAgICAgICAgICAgIHBlbmRpbmdUYXNrRG9uZVByb21pc2U6IFJlcG9ydGVyLl9jcmVhdGVQZW5kaW5nUHJvbWlzZSgpLFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSAgICAgICAgICAgICAgPSB0YXNrLnN0YXJ0VGltZTtcbiAgICAgICAgY29uc3QgYnJvd3NlckNvbm5lY3Rpb25zSW5mbyA9IChbXSBhcyBCcm93c2VyQ29ubmVjdGlvbltdKVxuICAgICAgICAgICAgLmNvbmNhdCguLi50YXNrLmJyb3dzZXJDb25uZWN0aW9uR3JvdXBzKVxuICAgICAgICAgICAgLm1hcChjb25uZWN0aW9uID0+IGNvbm5lY3Rpb24uY29ubmVjdGlvbkluZm8pO1xuICAgICAgICBjb25zdCBmaXJzdCAgICAgICAgICAgICAgICAgID0gdGhpcy50YXNrSW5mby50ZXN0UXVldWVbMF07XG5cbiAgICAgICAgY29uc3QgdGFza1Byb3BlcnRpZXMgPSB7XG4gICAgICAgICAgICBjb25maWd1cmF0aW9uOiB0YXNrLm9wdHMsXG4gICAgICAgICAgICBkYXNoYm9hcmRVcmw6ICB0YXNrLm9wdHMuZGFzaGJvYXJkVXJsLFxuICAgICAgICB9O1xuXG4gICAgICAgIGF3YWl0IHRoaXMuZGlzcGF0Y2hUb1BsdWdpbih7XG4gICAgICAgICAgICBtZXRob2Q6ICAgICAgICBSZXBvcnRlclBsdWdpbk1ldGhvZC5yZXBvcnRUYXNrU3RhcnQsXG4gICAgICAgICAgICBpbml0aWFsT2JqZWN0OiB0YXNrLFxuICAgICAgICAgICAgYXJnczogICAgICAgICAgW1xuICAgICAgICAgICAgICAgIHN0YXJ0VGltZSxcbiAgICAgICAgICAgICAgICBicm93c2VyQ29ubmVjdGlvbnNJbmZvLFxuICAgICAgICAgICAgICAgIHRoaXMudGFza0luZm8udGVzdENvdW50LFxuICAgICAgICAgICAgICAgIHRhc2sudGVzdFN0cnVjdHVyZSxcbiAgICAgICAgICAgICAgICB0YXNrUHJvcGVydGllcyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChmaXJzdCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5kaXNwYXRjaFRvUGx1Z2luKHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICAgICAgICBSZXBvcnRlclBsdWdpbk1ldGhvZC5yZXBvcnRGaXh0dXJlU3RhcnQsXG4gICAgICAgICAgICAgICAgaW5pdGlhbE9iamVjdDogdGFzayxcbiAgICAgICAgICAgICAgICBhcmdzOiAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICAgIGZpcnN0LmZpeHR1cmUubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZmlyc3QuZml4dHVyZS5wYXRoLFxuICAgICAgICAgICAgICAgICAgICBmaXJzdC5maXh0dXJlLm1ldGEsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfb25UYXNrVGVzdFJ1blN0YXJ0SGFuZGxlciAodGVzdFJ1bjogVGVzdFJ1bik6IFByb21pc2U8dW5rbm93bj4ge1xuICAgICAgICBpZiAoIXRoaXMudGFza0luZm8pXG4gICAgICAgICAgICByZXR1cm4gdm9pZCAwO1xuXG4gICAgICAgIGNvbnN0IHRlc3RJdGVtID0gdGhpcy5fZ2V0VGVzdEl0ZW1Gb3JUZXN0UnVuKHRoaXMudGFza0luZm8sIHRlc3RSdW4pIGFzIFRlc3RJbmZvO1xuXG4gICAgICAgIHRlc3RJdGVtLnRlc3RSdW5JZHMucHVzaCh0ZXN0UnVuLmlkKTtcblxuICAgICAgICBpZiAoIXRlc3RJdGVtLnN0YXJ0VGltZSlcbiAgICAgICAgICAgIHRlc3RJdGVtLnN0YXJ0VGltZSA9ICtuZXcgRGF0ZSgpO1xuXG4gICAgICAgIHRlc3RJdGVtLnBlbmRpbmdTdGFydHMtLTtcblxuICAgICAgICBpZiAoIXRlc3RJdGVtLnBlbmRpbmdTdGFydHMpIHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGlmICh0aGlzLnBsdWdpbi5yZXBvcnRUZXN0U3RhcnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXN0U3RhcnRJbmZvID0ge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0UnVuSWRzOiB0ZXN0SXRlbS50ZXN0UnVuSWRzLFxuICAgICAgICAgICAgICAgICAgICB0ZXN0SWQ6ICAgICB0ZXN0SXRlbS50ZXN0LmlkLFxuICAgICAgICAgICAgICAgICAgICBzdGFydFRpbWU6ICBuZXcgRGF0ZSh0ZXN0SXRlbS5zdGFydFRpbWUpLFxuICAgICAgICAgICAgICAgICAgICBza2lwcGVkOiAgICB0ZXN0SXRlbS50ZXN0LnNraXAsXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZGlzcGF0Y2hUb1BsdWdpbih7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogICAgICAgIFJlcG9ydGVyUGx1Z2luTWV0aG9kLnJlcG9ydFRlc3RTdGFydCBhcyBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgIGluaXRpYWxPYmplY3Q6IHRoaXMudGFza0luZm8udGFzayxcbiAgICAgICAgICAgICAgICAgICAgYXJnczogICAgICAgICAgW1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVzdEl0ZW0udGVzdC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGVzdEl0ZW0udGVzdC5tZXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGVzdFN0YXJ0SW5mbyxcbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgKHRlc3RJdGVtLnBlbmRpbmdUZXN0UnVuU3RhcnRQcm9taXNlLnJlc29sdmUgYXMgRnVuY3Rpb24pKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGVzdEl0ZW0ucGVuZGluZ1Rlc3RSdW5TdGFydFByb21pc2U7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfb25UYXNrVGVzdFJ1bkRvbmVIYW5kbGVyICh0ZXN0UnVuOiBUZXN0UnVuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghdGhpcy50YXNrSW5mbylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCByZXBvcnRJdGVtICAgICAgICAgICAgICAgICAgICA9IHRoaXMuX2dldFRlc3RJdGVtRm9yVGVzdFJ1bih0aGlzLnRhc2tJbmZvLCB0ZXN0UnVuKSBhcyBUZXN0SW5mbztcbiAgICAgICAgY29uc3QgaXNUZXN0UnVuU3RvcHBlZFRhc2tFeGVjdXRpb24gPSAhIXRlc3RSdW4uZXJycy5sZW5ndGggJiYgdGhpcy50YXNrSW5mby5zdG9wT25GaXJzdEZhaWw7XG4gICAgICAgIGNvbnN0IGJyb3dzZXI6IEJyb3dzZXJSdW5JbmZvICAgICAgID0gT2JqZWN0LmFzc2lnbih7IHRlc3RSdW5JZDogdGVzdFJ1bi5pZCB9LCB0ZXN0UnVuLmJyb3dzZXIpO1xuXG4gICAgICAgIHJlcG9ydEl0ZW0uYnJvd3NlcnMucHVzaChicm93c2VyKTtcblxuICAgICAgICByZXBvcnRJdGVtLnBlbmRpbmdSdW5zID0gaXNUZXN0UnVuU3RvcHBlZFRhc2tFeGVjdXRpb24gPyAwIDogcmVwb3J0SXRlbS5wZW5kaW5nUnVucyAtIDE7XG4gICAgICAgIHJlcG9ydEl0ZW0udW5zdGFibGUgICAgPSByZXBvcnRJdGVtLnVuc3RhYmxlIHx8IHRlc3RSdW4udW5zdGFibGU7XG4gICAgICAgIHJlcG9ydEl0ZW0uZXJycyAgICAgICAgPSByZXBvcnRJdGVtLmVycnMuY29uY2F0KHRlc3RSdW4uZXJycyk7XG4gICAgICAgIHJlcG9ydEl0ZW0ud2FybmluZ3MgICAgPSB0ZXN0UnVuLndhcm5pbmdMb2cgPyB1bmlvbihyZXBvcnRJdGVtLndhcm5pbmdzLCB0ZXN0UnVuLndhcm5pbmdMb2cubWVzc2FnZXMpIDogW107XG5cbiAgICAgICAgaWYgKHRlc3RSdW4ucXVhcmFudGluZSkge1xuICAgICAgICAgICAgcmVwb3J0SXRlbS5xdWFyYW50aW5lID0gcmVwb3J0SXRlbS5xdWFyYW50aW5lIHx8IHt9O1xuXG4gICAgICAgICAgICBjb25zdCByZXBvcnRJdGVtUXVhcmFudGluZSA9IHRlc3RSdW4ucXVhcmFudGluZS5hdHRlbXB0cy5yZWR1Y2UoKHJlc3VsdDogUmVjb3JkPHN0cmluZywgb2JqZWN0PiwgeyBlcnJvcnMsIHRlc3RSdW5JZCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFzc2VkID0gIWVycm9ycy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICByZXN1bHRbdGVzdFJ1bklkXSAgICAgICAgICAgICAgICAgICAgPSB7IHBhc3NlZCwgZXJyb3JzIH07XG4gICAgICAgICAgICAgICAgYnJvd3Nlci5xdWFyYW50aW5lQXR0ZW1wdHNUZXN0UnVuSWRzID0gYnJvd3Nlci5xdWFyYW50aW5lQXR0ZW1wdHNUZXN0UnVuSWRzIHx8IFtdO1xuXG4gICAgICAgICAgICAgICAgYnJvd3Nlci5xdWFyYW50aW5lQXR0ZW1wdHNUZXN0UnVuSWRzLnB1c2godGVzdFJ1bklkKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9LCB7fSk7XG5cbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24ocmVwb3J0SXRlbS5xdWFyYW50aW5lLCByZXBvcnRJdGVtUXVhcmFudGluZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXJlcG9ydEl0ZW0ucGVuZGluZ1J1bnMpXG4gICAgICAgICAgICBhd2FpdCB0aGlzLl9yZXNvbHZlVGVzdEl0ZW0odGhpcy50YXNrSW5mbywgcmVwb3J0SXRlbSwgdGVzdFJ1bik7XG5cbiAgICAgICAgYXdhaXQgcmVwb3J0SXRlbS5wZW5kaW5nVGVzdFJ1bkRvbmVQcm9taXNlO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX29uVGFza1Rlc3RBY3Rpb25TdGFydCAoeyBhcGlBY3Rpb25OYW1lLCAuLi5yZXN0QXJncyB9OiBSZXBvcnRUYXNrQWN0aW9uRXZlbnRBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKCF0aGlzLnRhc2tJbmZvKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKHRoaXMucGx1Z2luLnJlcG9ydFRlc3RBY3Rpb25TdGFydCkge1xuICAgICAgICAgICAgcmVzdEFyZ3MgPSB0aGlzLl9wcmVwYXJlUmVwb3J0VGVzdEFjdGlvbkV2ZW50QXJncyhyZXN0QXJncyBhcyB1bmtub3duIGFzIFJlcG9ydFRlc3RBY3Rpb25FdmVudEFyZ3VtZW50cyk7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZGlzcGF0Y2hUb1BsdWdpbih7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAgICAgICAgUmVwb3J0ZXJQbHVnaW5NZXRob2QucmVwb3J0VGVzdEFjdGlvblN0YXJ0IGFzIHN0cmluZyxcbiAgICAgICAgICAgICAgICBpbml0aWFsT2JqZWN0OiB0aGlzLnRhc2tJbmZvLnRhc2ssXG4gICAgICAgICAgICAgICAgYXJnczogICAgICAgICAgW1xuICAgICAgICAgICAgICAgICAgICBhcGlBY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICByZXN0QXJncyxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIF9vblRhc2tUZXN0QWN0aW9uRG9uZSAoeyBhcGlBY3Rpb25OYW1lLCAuLi5yZXN0QXJncyB9OiBSZXBvcnRUYXNrQWN0aW9uRXZlbnRBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKCF0aGlzLnRhc2tJbmZvKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKHRoaXMucGx1Z2luLnJlcG9ydFRlc3RBY3Rpb25Eb25lKSB7XG4gICAgICAgICAgICByZXN0QXJncyA9IHRoaXMuX3ByZXBhcmVSZXBvcnRUZXN0QWN0aW9uRXZlbnRBcmdzKHJlc3RBcmdzIGFzIHVua25vd24gYXMgUmVwb3J0VGVzdEFjdGlvbkV2ZW50QXJndW1lbnRzKTtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5kaXNwYXRjaFRvUGx1Z2luKHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICAgICAgICBSZXBvcnRlclBsdWdpbk1ldGhvZC5yZXBvcnRUZXN0QWN0aW9uRG9uZSBhcyBzdHJpbmcsXG4gICAgICAgICAgICAgICAgaW5pdGlhbE9iamVjdDogdGhpcy50YXNrSW5mby50YXNrLFxuICAgICAgICAgICAgICAgIGFyZ3M6ICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgICAgYXBpQWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgcmVzdEFyZ3MsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfb25jZVRhc2tEb25lSGFuZGxlciAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghdGhpcy50YXNrSW5mbylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBlbmRUaW1lID0gbmV3IERhdGUoKTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBwYXNzZWRDb3VudDogIHRoaXMudGFza0luZm8ucGFzc2VkLFxuICAgICAgICAgICAgZmFpbGVkQ291bnQ6ICB0aGlzLnRhc2tJbmZvLmZhaWxlZCxcbiAgICAgICAgICAgIHNraXBwZWRDb3VudDogdGhpcy50YXNrSW5mby5za2lwcGVkLFxuICAgICAgICB9O1xuXG4gICAgICAgIGF3YWl0IHRoaXMuZGlzcGF0Y2hUb1BsdWdpbih7XG4gICAgICAgICAgICBtZXRob2Q6ICAgICAgICBSZXBvcnRlclBsdWdpbk1ldGhvZC5yZXBvcnRUYXNrRG9uZSxcbiAgICAgICAgICAgIGluaXRpYWxPYmplY3Q6IHRoaXMudGFza0luZm8udGFzayxcbiAgICAgICAgICAgIGFyZ3M6ICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICBlbmRUaW1lLFxuICAgICAgICAgICAgICAgIHRoaXMudGFza0luZm8ucGFzc2VkLFxuICAgICAgICAgICAgICAgIHRoaXMudGFza0luZm8udGFzaz8ud2FybmluZ0xvZy5tZXNzYWdlcyxcbiAgICAgICAgICAgICAgICByZXN1bHQsXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcblxuICAgICAgICAodGhpcy50YXNrSW5mby5wZW5kaW5nVGFza0RvbmVQcm9taXNlLnJlc29sdmUgYXMgRnVuY3Rpb24pKCk7XG4gICAgfVxufVxuIl19