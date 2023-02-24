"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const testcafe_browser_tools_1 = require("testcafe-browser-tools");
const crop_1 = require("./crop");
const async_queue_1 = require("../utils/async-queue");
const warning_message_1 = __importDefault(require("../notifications/warning-message"));
const escape_user_agent_1 = __importDefault(require("../utils/escape-user-agent"));
const correct_file_path_1 = __importDefault(require("../utils/correct-file-path"));
const promisified_functions_1 = require("../utils/promisified-functions");
const default_extension_1 = __importDefault(require("./default-extension"));
const make_dir_1 = __importDefault(require("make-dir"));
class Capturer {
    // TODO: refactor to use dictionary
    constructor(baseScreenshotsPath, testEntry, connection, pathPattern, fullPage, thumbnails, warningLog, tempDirectoryPath, autoTakeOnFails) {
        this.enabled = !!baseScreenshotsPath;
        this.baseScreenshotsPath = baseScreenshotsPath;
        this.testEntry = testEntry;
        this.provider = connection.provider;
        this.browserId = connection.id;
        this.warningLog = warningLog;
        this.pathPattern = pathPattern;
        this.fullPage = fullPage;
        this.thumbnails = thumbnails;
        this.tempDirectoryPath = tempDirectoryPath;
        this.autoTakeOnFails = autoTakeOnFails;
    }
    static _getDimensionWithoutScrollbar(fullDimension, documentDimension, bodyDimension) {
        if (bodyDimension > fullDimension)
            return documentDimension;
        if (documentDimension > fullDimension)
            return bodyDimension;
        return Math.max(documentDimension, bodyDimension);
    }
    static _getCropDimensions(cropDimensions, pageDimensions) {
        if (!cropDimensions || !pageDimensions)
            return null;
        const { dpr } = pageDimensions;
        const { top, left, bottom, right } = cropDimensions;
        return {
            top: Math.round(top * dpr),
            left: Math.round(left * dpr),
            bottom: Math.round(bottom * dpr),
            right: Math.round(right * dpr),
        };
    }
    static _getClientAreaDimensions(pageDimensions) {
        if (!pageDimensions)
            return null;
        const { innerWidth, documentWidth, bodyWidth, innerHeight, documentHeight, bodyHeight, dpr } = pageDimensions;
        return {
            width: Math.floor(Capturer._getDimensionWithoutScrollbar(innerWidth, documentWidth, bodyWidth) * dpr),
            height: Math.floor(Capturer._getDimensionWithoutScrollbar(innerHeight, documentHeight, bodyHeight) * dpr),
        };
    }
    static async _isScreenshotCaptured(screenshotPath) {
        try {
            const stats = await (0, promisified_functions_1.stat)(screenshotPath);
            return stats.isFile();
        }
        catch (e) {
            return false;
        }
    }
    _joinWithBaseScreenshotPath(path) {
        return (0, path_1.join)(this.baseScreenshotsPath, path);
    }
    _incrementFileIndexes(forError) {
        if (forError)
            this.pathPattern.data.errorFileIndex++;
        else
            this.pathPattern.data.fileIndex++;
    }
    _getCustomScreenshotPath(customPath) {
        const correctedCustomPath = (0, correct_file_path_1.default)(customPath, default_extension_1.default);
        return this._joinWithBaseScreenshotPath(correctedCustomPath);
    }
    _getScreenshotPath(forError) {
        const path = this.pathPattern.getPath(forError);
        this._incrementFileIndexes(forError);
        return this._joinWithBaseScreenshotPath(path);
    }
    _getThumbnailPath(screenshotPath) {
        const imageName = (0, path_1.basename)(screenshotPath);
        const imageDir = (0, path_1.dirname)(screenshotPath);
        return (0, path_1.join)(imageDir, 'thumbnails', imageName);
    }
    async _takeScreenshot({ filePath, pageWidth, pageHeight, fullPage = this.fullPage }) {
        await this.provider.takeScreenshot(this.browserId, filePath, pageWidth, pageHeight, fullPage);
    }
    async _capture(forError, { actionId, failedActionId, pageDimensions, cropDimensions, markSeed, customPath, fullPage, thumbnails } = {}) {
        if (!this.enabled)
            return null;
        thumbnails = thumbnails === void 0 ? this.thumbnails : thumbnails;
        const screenshotPath = customPath ? this._getCustomScreenshotPath(customPath) : this._getScreenshotPath(forError);
        const thumbnailPath = this._getThumbnailPath(screenshotPath);
        const tempPath = screenshotPath.replace(this.baseScreenshotsPath, this.tempDirectoryPath);
        let screenshotData;
        if ((0, async_queue_1.isInQueue)(screenshotPath))
            this.warningLog.addWarning(warning_message_1.default.screenshotRewritingError, screenshotPath);
        await (0, async_queue_1.addToQueue)(screenshotPath, async () => {
            const clientAreaDimensions = Capturer._getClientAreaDimensions(pageDimensions);
            const { width: pageWidth, height: pageHeight } = clientAreaDimensions || {};
            const takeScreenshotOptions = {
                filePath: tempPath,
                pageWidth,
                pageHeight,
                fullPage,
            };
            await this._takeScreenshot(takeScreenshotOptions);
            if (!await Capturer._isScreenshotCaptured(tempPath))
                return;
            const image = await (0, promisified_functions_1.readPngFile)(tempPath);
            const markSeedPosition = markSeed ? (0, crop_1.calculateMarkPosition)(image, markSeed) : null;
            if (markSeed && !markSeedPosition)
                this.warningLog.addWarning(warning_message_1.default.screenshotMarkNotFound, tempPath, (0, crop_1.markSeedToId)(markSeed));
            const croppedImage = await (0, crop_1.cropScreenshot)(image, {
                markSeedPosition,
                clientAreaDimensions,
                path: tempPath,
                cropDimensions: Capturer._getCropDimensions(cropDimensions, pageDimensions),
            });
            if (croppedImage)
                await (0, promisified_functions_1.writePng)(tempPath, croppedImage);
            screenshotData = await (0, promisified_functions_1.readFile)(tempPath);
            if (forError && this.autoTakeOnFails)
                return;
            await (0, make_dir_1.default)((0, path_1.dirname)(screenshotPath));
            await (0, promisified_functions_1.writeFile)(screenshotPath, screenshotData);
            if (thumbnails)
                await (0, testcafe_browser_tools_1.generateThumbnail)(screenshotPath, thumbnailPath);
        });
        const testRunId = this.testEntry.testRuns[this.browserId].id;
        const userAgent = (0, escape_user_agent_1.default)(this.pathPattern.data.parsedUserAgent.prettyUserAgent);
        const quarantineAttempt = this.pathPattern.data.quarantineAttempt;
        const takenOnFail = forError;
        const screenshot = {
            testRunId,
            screenshotPath,
            screenshotData,
            thumbnailPath,
            userAgent,
            quarantineAttempt,
            takenOnFail,
            actionId: failedActionId || actionId,
        };
        this.testEntry.screenshots.push(screenshot);
        return screenshotPath;
    }
    async captureAction(options) {
        return await this._capture(false, options);
    }
    async captureError(options) {
        return await this._capture(true, options);
    }
}
exports.default = Capturer;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FwdHVyZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc2NyZWVuc2hvdHMvY2FwdHVyZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwrQkFJYztBQUVkLG1FQUEyRDtBQUMzRCxpQ0FJZ0I7QUFDaEIsc0RBQTZEO0FBQzdELHVGQUErRDtBQUMvRCxtRkFBeUQ7QUFDekQsbUZBQXlEO0FBQ3pELDBFQU13QztBQUV4Qyw0RUFBK0Q7QUFDL0Qsd0RBQStCO0FBRy9CLE1BQXFCLFFBQVE7SUFDekIsbUNBQW1DO0lBQ25DLFlBQWEsbUJBQW1CLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsZUFBZTtRQUN0SSxJQUFJLENBQUMsT0FBTyxHQUFlLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztRQUNqRCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsbUJBQW1CLENBQUM7UUFDL0MsSUFBSSxDQUFDLFNBQVMsR0FBYSxTQUFTLENBQUM7UUFDckMsSUFBSSxDQUFDLFFBQVEsR0FBYyxVQUFVLENBQUMsUUFBUSxDQUFDO1FBQy9DLElBQUksQ0FBQyxTQUFTLEdBQWEsVUFBVSxDQUFDLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsVUFBVSxHQUFZLFVBQVUsQ0FBQztRQUN0QyxJQUFJLENBQUMsV0FBVyxHQUFXLFdBQVcsQ0FBQztRQUN2QyxJQUFJLENBQUMsUUFBUSxHQUFjLFFBQVEsQ0FBQztRQUNwQyxJQUFJLENBQUMsVUFBVSxHQUFZLFVBQVUsQ0FBQztRQUN0QyxJQUFJLENBQUMsaUJBQWlCLEdBQUssaUJBQWlCLENBQUM7UUFDN0MsSUFBSSxDQUFDLGVBQWUsR0FBTyxlQUFlLENBQUM7SUFDL0MsQ0FBQztJQUVELE1BQU0sQ0FBQyw2QkFBNkIsQ0FBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsYUFBYTtRQUNqRixJQUFJLGFBQWEs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O1lBQ2pCLFdBQVc7WUFDWCxRQUFRLEVBQUUsY0FBYyxJQUFJLFFBQVE7U0FDdkMsQ0FBQztRQUVGLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU1QyxPQUFPLGNBQWMsQ0FBQztJQUMxQixDQUFDO0lBRUQsS0FBSyxDQUFDLGFBQWEsQ0FBRSxPQUFPO1FBQ3hCLE9BQU8sTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsS0FBSyxDQUFDLFlBQVksQ0FBRSxPQUFPO1FBQ3ZCLE9BQU8sTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0o7QUE3TEQsMkJBNkxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBqb2luIGFzIGpvaW5QYXRoLFxuICAgIGRpcm5hbWUsXG4gICAgYmFzZW5hbWUsXG59IGZyb20gJ3BhdGgnO1xuXG5pbXBvcnQgeyBnZW5lcmF0ZVRodW1ibmFpbCB9IGZyb20gJ3Rlc3RjYWZlLWJyb3dzZXItdG9vbHMnO1xuaW1wb3J0IHtcbiAgICBjcm9wU2NyZWVuc2hvdCxcbiAgICBjYWxjdWxhdGVNYXJrUG9zaXRpb24sXG4gICAgbWFya1NlZWRUb0lkLFxufSBmcm9tICcuL2Nyb3AnO1xuaW1wb3J0IHsgaXNJblF1ZXVlLCBhZGRUb1F1ZXVlIH0gZnJvbSAnLi4vdXRpbHMvYXN5bmMtcXVldWUnO1xuaW1wb3J0IFdBUk5JTkdfTUVTU0FHRSBmcm9tICcuLi9ub3RpZmljYXRpb25zL3dhcm5pbmctbWVzc2FnZSc7XG5pbXBvcnQgZXNjYXBlVXNlckFnZW50IGZyb20gJy4uL3V0aWxzL2VzY2FwZS11c2VyLWFnZW50JztcbmltcG9ydCBjb3JyZWN0RmlsZVBhdGggZnJvbSAnLi4vdXRpbHMvY29ycmVjdC1maWxlLXBhdGgnO1xuaW1wb3J0IHtcbiAgICByZWFkRmlsZSxcbiAgICByZWFkUG5nRmlsZSxcbiAgICBzdGF0LFxuICAgIHdyaXRlRmlsZSxcbiAgICB3cml0ZVBuZyxcbn0gZnJvbSAnLi4vdXRpbHMvcHJvbWlzaWZpZWQtZnVuY3Rpb25zJztcblxuaW1wb3J0IERFRkFVTFRfU0NSRUVOU0hPVF9FWFRFTlNJT04gZnJvbSAnLi9kZWZhdWx0LWV4dGVuc2lvbic7XG5pbXBvcnQgbWFrZURpciBmcm9tICdtYWtlLWRpcic7XG5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2FwdHVyZXIge1xuICAgIC8vIFRPRE86IHJlZmFjdG9yIHRvIHVzZSBkaWN0aW9uYXJ5XG4gICAgY29uc3RydWN0b3IgKGJhc2VTY3JlZW5zaG90c1BhdGgsIHRlc3RFbnRyeSwgY29ubmVjdGlvbiwgcGF0aFBhdHRlcm4sIGZ1bGxQYWdlLCB0aHVtYm5haWxzLCB3YXJuaW5nTG9nLCB0ZW1wRGlyZWN0b3J5UGF0aCwgYXV0b1Rha2VPbkZhaWxzKSB7XG4gICAgICAgIHRoaXMuZW5hYmxlZCAgICAgICAgICAgICA9ICEhYmFzZVNjcmVlbnNob3RzUGF0aDtcbiAgICAgICAgdGhpcy5iYXNlU2NyZWVuc2hvdHNQYXRoID0gYmFzZVNjcmVlbnNob3RzUGF0aDtcbiAgICAgICAgdGhpcy50ZXN0RW50cnkgICAgICAgICAgID0gdGVzdEVudHJ5O1xuICAgICAgICB0aGlzLnByb3ZpZGVyICAgICAgICAgICAgPSBjb25uZWN0aW9uLnByb3ZpZGVyO1xuICAgICAgICB0aGlzLmJyb3dzZXJJZCAgICAgICAgICAgPSBjb25uZWN0aW9uLmlkO1xuICAgICAgICB0aGlzLndhcm5pbmdMb2cgICAgICAgICAgPSB3YXJuaW5nTG9nO1xuICAgICAgICB0aGlzLnBhdGhQYXR0ZXJuICAgICAgICAgPSBwYXRoUGF0dGVybjtcbiAgICAgICAgdGhpcy5mdWxsUGFnZSAgICAgICAgICAgID0gZnVsbFBhZ2U7XG4gICAgICAgIHRoaXMudGh1bWJuYWlscyAgICAgICAgICA9IHRodW1ibmFpbHM7XG4gICAgICAgIHRoaXMudGVtcERpcmVjdG9yeVBhdGggICA9IHRlbXBEaXJlY3RvcnlQYXRoO1xuICAgICAgICB0aGlzLmF1dG9UYWtlT25GYWlscyAgICAgPSBhdXRvVGFrZU9uRmFpbHM7XG4gICAgfVxuXG4gICAgc3RhdGljIF9nZXREaW1lbnNpb25XaXRob3V0U2Nyb2xsYmFyIChmdWxsRGltZW5zaW9uLCBkb2N1bWVudERpbWVuc2lvbiwgYm9keURpbWVuc2lvbikge1xuICAgICAgICBpZiAoYm9keURpbWVuc2lvbiA+IGZ1bGxEaW1lbnNpb24pXG4gICAgICAgICAgICByZXR1cm4gZG9jdW1lbnREaW1lbnNpb247XG5cbiAgICAgICAgaWYgKGRvY3VtZW50RGltZW5zaW9uID4gZnVsbERpbWVuc2lvbilcbiAgICAgICAgICAgIHJldHVybiBib2R5RGltZW5zaW9uO1xuXG4gICAgICAgIHJldHVybiBNYXRoLm1heChkb2N1bWVudERpbWVuc2lvbiwgYm9keURpbWVuc2lvbik7XG4gICAgfVxuXG4gICAgc3RhdGljIF9nZXRDcm9wRGltZW5zaW9ucyAoY3JvcERpbWVuc2lvbnMsIHBhZ2VEaW1lbnNpb25zKSB7XG4gICAgICAgIGlmICghY3JvcERpbWVuc2lvbnMgfHwgIXBhZ2VEaW1lbnNpb25zKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgeyBkcHIgfSAgICAgICAgICAgICAgICAgICAgICA9IHBhZ2VEaW1lbnNpb25zO1xuICAgICAgICBjb25zdCB7IHRvcCwgbGVmdCwgYm90dG9tLCByaWdodCB9ID0gY3JvcERpbWVuc2lvbnM7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHRvcDogICAgTWF0aC5yb3VuZCh0b3AgKiBkcHIpLFxuICAgICAgICAgICAgbGVmdDogICBNYXRoLnJvdW5kKGxlZnQgKiBkcHIpLFxuICAgICAgICAgICAgYm90dG9tOiBNYXRoLnJvdW5kKGJvdHRvbSAqIGRwciksXG4gICAgICAgICAgICByaWdodDogIE1hdGgucm91bmQocmlnaHQgKiBkcHIpLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHN0YXRpYyBfZ2V0Q2xpZW50QXJlYURpbWVuc2lvbnMgKHBhZ2VEaW1lbnNpb25zKSB7XG4gICAgICAgIGlmICghcGFnZURpbWVuc2lvbnMpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCB7IGlubmVyV2lkdGgsIGRvY3VtZW50V2lkdGgsIGJvZHlXaWR0aCwgaW5uZXJIZWlnaHQsIGRvY3VtZW50SGVpZ2h0LCBib2R5SGVpZ2h0LCBkcHIgfSA9IHBhZ2VEaW1lbnNpb25zO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogIE1hdGguZmxvb3IoQ2FwdHVyZXIuX2dldERpbWVuc2lvbldpdGhvdXRTY3JvbGxiYXIoaW5uZXJXaWR0aCwgZG9jdW1lbnRXaWR0aCwgYm9keVdpZHRoKSAqIGRwciksXG4gICAgICAgICAgICBoZWlnaHQ6IE1hdGguZmxvb3IoQ2FwdHVyZXIuX2dldERpbWVuc2lvbldpdGhvdXRTY3JvbGxiYXIoaW5uZXJIZWlnaHQsIGRvY3VtZW50SGVpZ2h0LCBib2R5SGVpZ2h0KSAqIGRwciksXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgc3RhdGljIGFzeW5jIF9pc1NjcmVlbnNob3RDYXB0dXJlZCAoc2NyZWVuc2hvdFBhdGgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgc3RhdChzY3JlZW5zaG90UGF0aCk7XG5cbiAgICAgICAgICAgIHJldHVybiBzdGF0cy5pc0ZpbGUoKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2pvaW5XaXRoQmFzZVNjcmVlbnNob3RQYXRoIChwYXRoKSB7XG4gICAgICAgIHJldHVybiBqb2luUGF0aCh0aGlzLmJhc2VTY3JlZW5zaG90c1BhdGgsIHBhdGgpO1xuICAgIH1cblxuICAgIF9pbmNyZW1lbnRGaWxlSW5kZXhlcyAoZm9yRXJyb3IpIHtcbiAgICAgICAgaWYgKGZvckVycm9yKVxuICAgICAgICAgICAgdGhpcy5wYXRoUGF0dGVybi5kYXRhLmVycm9yRmlsZUluZGV4Kys7XG5cbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5wYXRoUGF0dGVybi5kYXRhLmZpbGVJbmRleCsrO1xuICAgIH1cblxuICAgIF9nZXRDdXN0b21TY3JlZW5zaG90UGF0aCAoY3VzdG9tUGF0aCkge1xuICAgICAgICBjb25zdCBjb3JyZWN0ZWRDdXN0b21QYXRoID0gY29ycmVjdEZpbGVQYXRoKGN1c3RvbVBhdGgsIERFRkFVTFRfU0NSRUVOU0hPVF9FWFRFTlNJT04pO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9qb2luV2l0aEJhc2VTY3JlZW5zaG90UGF0aChjb3JyZWN0ZWRDdXN0b21QYXRoKTtcbiAgICB9XG5cbiAgICBfZ2V0U2NyZWVuc2hvdFBhdGggKGZvckVycm9yKSB7XG4gICAgICAgIGNvbnN0IHBhdGggPSB0aGlzLnBhdGhQYXR0ZXJuLmdldFBhdGgoZm9yRXJyb3IpO1xuXG4gICAgICAgIHRoaXMuX2luY3JlbWVudEZpbGVJbmRleGVzKGZvckVycm9yKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fam9pbldpdGhCYXNlU2NyZWVuc2hvdFBhdGgocGF0aCk7XG4gICAgfVxuXG4gICAgX2dldFRodW1ibmFpbFBhdGggKHNjcmVlbnNob3RQYXRoKSB7XG4gICAgICAgIGNvbnN0IGltYWdlTmFtZSA9IGJhc2VuYW1lKHNjcmVlbnNob3RQYXRoKTtcbiAgICAgICAgY29uc3QgaW1hZ2VEaXIgID0gZGlybmFtZShzY3JlZW5zaG90UGF0aCk7XG5cbiAgICAgICAgcmV0dXJuIGpvaW5QYXRoKGltYWdlRGlyLCAndGh1bWJuYWlscycsIGltYWdlTmFtZSk7XG4gICAgfVxuXG4gICAgYXN5bmMgX3Rha2VTY3JlZW5zaG90ICh7IGZpbGVQYXRoLCBwYWdlV2lkdGgsIHBhZ2VIZWlnaHQsIGZ1bGxQYWdlID0gdGhpcy5mdWxsUGFnZSB9KSB7XG4gICAgICAgIGF3YWl0IHRoaXMucHJvdmlkZXIudGFrZVNjcmVlbnNob3QodGhpcy5icm93c2VySWQsIGZpbGVQYXRoLCBwYWdlV2lkdGgsIHBhZ2VIZWlnaHQsIGZ1bGxQYWdlKTtcbiAgICB9XG5cbiAgICBhc3luYyBfY2FwdHVyZSAoZm9yRXJyb3IsIHsgYWN0aW9uSWQsIGZhaWxlZEFjdGlvbklkLCBwYWdlRGltZW5zaW9ucywgY3JvcERpbWVuc2lvbnMsIG1hcmtTZWVkLCBjdXN0b21QYXRoLCBmdWxsUGFnZSwgdGh1bWJuYWlscyB9ID0ge30pIHtcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICB0aHVtYm5haWxzID0gdGh1bWJuYWlscyA9PT0gdm9pZCAwID8gdGhpcy50aHVtYm5haWxzIDogdGh1bWJuYWlscztcblxuICAgICAgICBjb25zdCBzY3JlZW5zaG90UGF0aCA9IGN1c3RvbVBhdGggPyB0aGlzLl9nZXRDdXN0b21TY3JlZW5zaG90UGF0aChjdXN0b21QYXRoKSA6IHRoaXMuX2dldFNjcmVlbnNob3RQYXRoKGZvckVycm9yKTtcbiAgICAgICAgY29uc3QgdGh1bWJuYWlsUGF0aCAgPSB0aGlzLl9nZXRUaHVtYm5haWxQYXRoKHNjcmVlbnNob3RQYXRoKTtcbiAgICAgICAgY29uc3QgdGVtcFBhdGggICAgICAgPSBzY3JlZW5zaG90UGF0aC5yZXBsYWNlKHRoaXMuYmFzZVNjcmVlbnNob3RzUGF0aCwgdGhpcy50ZW1wRGlyZWN0b3J5UGF0aCk7XG4gICAgICAgIGxldCBzY3JlZW5zaG90RGF0YTtcblxuICAgICAgICBpZiAoaXNJblF1ZXVlKHNjcmVlbnNob3RQYXRoKSlcbiAgICAgICAgICAgIHRoaXMud2FybmluZ0xvZy5hZGRXYXJuaW5nKFdBUk5JTkdfTUVTU0FHRS5zY3JlZW5zaG90UmV3cml0aW5nRXJyb3IsIHNjcmVlbnNob3RQYXRoKTtcblxuICAgICAgICBhd2FpdCBhZGRUb1F1ZXVlKHNjcmVlbnNob3RQYXRoLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjbGllbnRBcmVhRGltZW5zaW9ucyA9IENhcHR1cmVyLl9nZXRDbGllbnRBcmVhRGltZW5zaW9ucyhwYWdlRGltZW5zaW9ucyk7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgd2lkdGg6IHBhZ2VXaWR0aCwgaGVpZ2h0OiBwYWdlSGVpZ2h0IH0gPSBjbGllbnRBcmVhRGltZW5zaW9ucyB8fCB7fTtcblxuICAgICAgICAgICAgY29uc3QgdGFrZVNjcmVlbnNob3RPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGZpbGVQYXRoOiB0ZW1wUGF0aCxcbiAgICAgICAgICAgICAgICBwYWdlV2lkdGgsXG4gICAgICAgICAgICAgICAgcGFnZUhlaWdodCxcbiAgICAgICAgICAgICAgICBmdWxsUGFnZSxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuX3Rha2VTY3JlZW5zaG90KHRha2VTY3JlZW5zaG90T3B0aW9ucyk7XG5cbiAgICAgICAgICAgIGlmICghYXdhaXQgQ2FwdHVyZXIuX2lzU2NyZWVuc2hvdENhcHR1cmVkKHRlbXBQYXRoKSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIGNvbnN0IGltYWdlID0gYXdhaXQgcmVhZFBuZ0ZpbGUodGVtcFBhdGgpO1xuXG4gICAgICAgICAgICBjb25zdCBtYXJrU2VlZFBvc2l0aW9uID0gbWFya1NlZWQgPyBjYWxjdWxhdGVNYXJrUG9zaXRpb24oaW1hZ2UsIG1hcmtTZWVkKSA6IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChtYXJrU2VlZCAmJiAhbWFya1NlZWRQb3NpdGlvbilcbiAgICAgICAgICAgICAgICB0aGlzLndhcm5pbmdMb2cuYWRkV2FybmluZyhXQVJOSU5HX01FU1NBR0Uuc2NyZWVuc2hvdE1hcmtOb3RGb3VuZCwgdGVtcFBhdGgsIG1hcmtTZWVkVG9JZChtYXJrU2VlZCkpO1xuXG4gICAgICAgICAgICBjb25zdCBjcm9wcGVkSW1hZ2UgPSBhd2FpdCBjcm9wU2NyZWVuc2hvdChpbWFnZSwge1xuICAgICAgICAgICAgICAgIG1hcmtTZWVkUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgY2xpZW50QXJlYURpbWVuc2lvbnMsXG4gICAgICAgICAgICAgICAgcGF0aDogICAgICAgICAgIHRlbXBQYXRoLFxuICAgICAgICAgICAgICAgIGNyb3BEaW1lbnNpb25zOiBDYXB0dXJlci5fZ2V0Q3JvcERpbWVuc2lvbnMoY3JvcERpbWVuc2lvbnMsIHBhZ2VEaW1lbnNpb25zKSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAoY3JvcHBlZEltYWdlKVxuICAgICAgICAgICAgICAgIGF3YWl0IHdyaXRlUG5nKHRlbXBQYXRoLCBjcm9wcGVkSW1hZ2UpO1xuXG4gICAgICAgICAgICBzY3JlZW5zaG90RGF0YSA9IGF3YWl0IHJlYWRGaWxlKHRlbXBQYXRoKTtcblxuICAgICAgICAgICAgaWYgKGZvckVycm9yICYmIHRoaXMuYXV0b1Rha2VPbkZhaWxzKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgYXdhaXQgbWFrZURpcihkaXJuYW1lKHNjcmVlbnNob3RQYXRoKSk7XG4gICAgICAgICAgICBhd2FpdCB3cml0ZUZpbGUoc2NyZWVuc2hvdFBhdGgsIHNjcmVlbnNob3REYXRhKTtcblxuICAgICAgICAgICAgaWYgKHRodW1ibmFpbHMpXG4gICAgICAgICAgICAgICAgYXdhaXQgZ2VuZXJhdGVUaHVtYm5haWwoc2NyZWVuc2hvdFBhdGgsIHRodW1ibmFpbFBhdGgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB0ZXN0UnVuSWQgICAgICAgICA9IHRoaXMudGVzdEVudHJ5LnRlc3RSdW5zW3RoaXMuYnJvd3NlcklkXS5pZDtcbiAgICAgICAgY29uc3QgdXNlckFnZW50ICAgICAgICAgPSBlc2NhcGVVc2VyQWdlbnQodGhpcy5wYXRoUGF0dGVybi5kYXRhLnBhcnNlZFVzZXJBZ2VudC5wcmV0dHlVc2VyQWdlbnQpO1xuICAgICAgICBjb25zdCBxdWFyYW50aW5lQXR0ZW1wdCA9IHRoaXMucGF0aFBhdHRlcm4uZGF0YS5xdWFyYW50aW5lQXR0ZW1wdDtcbiAgICAgICAgY29uc3QgdGFrZW5PbkZhaWwgICAgICAgPSBmb3JFcnJvcjtcblxuICAgICAgICBjb25zdCBzY3JlZW5zaG90ID0ge1xuICAgICAgICAgICAgdGVzdFJ1bklkLFxuICAgICAgICAgICAgc2NyZWVuc2hvdFBhdGgsXG4gICAgICAgICAgICBzY3JlZW5zaG90RGF0YSxcbiAgICAgICAgICAgIHRodW1ibmFpbFBhdGgsXG4gICAgICAgICAgICB1c2VyQWdlbnQsXG4gICAgICAgICAgICBxdWFyYW50aW5lQXR0ZW1wdCxcbiAgICAgICAgICAgIHRha2VuT25GYWlsLFxuICAgICAgICAgICAgYWN0aW9uSWQ6IGZhaWxlZEFjdGlvbklkIHx8IGFjdGlvbklkLFxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMudGVzdEVudHJ5LnNjcmVlbnNob3RzLnB1c2goc2NyZWVuc2hvdCk7XG5cbiAgICAgICAgcmV0dXJuIHNjcmVlbnNob3RQYXRoO1xuICAgIH1cblxuICAgIGFzeW5jIGNhcHR1cmVBY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuX2NhcHR1cmUoZmFsc2UsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIGFzeW5jIGNhcHR1cmVFcnJvciAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5fY2FwdHVyZSh0cnVlLCBvcHRpb25zKTtcbiAgICB9XG59XG5cbiJdfQ==