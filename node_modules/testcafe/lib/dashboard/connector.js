"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const get_testcafe_version_1 = __importDefault(require("../utils/get-testcafe-version"));
const get_dashboard_url_1 = __importDefault(require("./get-dashboard-url"));
const https_1 = __importDefault(require("https"));
const debug_1 = __importDefault(require("debug"));
const DEBUG_LOGGER = (0, debug_1.default)('testcafe:dashboard:connector');
class DashboardConnector {
    constructor(baseUrl = (0, get_dashboard_url_1.default)()) {
        this.baseUrl = baseUrl;
    }
    async _sendPostJsonRequest(relativeUrl, body) {
        const url = new URL(relativeUrl, this.baseUrl);
        const postData = JSON.stringify(body);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };
        return new Promise((resolve, reject) => {
            const req = https_1.default.request(url, options, res => {
                res.setEncoding('utf8');
                let responseBody = '';
                res.on('data', chunk => {
                    responseBody += chunk.toString();
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: responseBody,
                    });
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }
    async _postRequest(relativeUrl, body) {
        try {
            const response = await this._sendPostJsonRequest(relativeUrl, body);
            if (response.statusCode >= 200 && response.statusCode <= 299)
                return { success: true };
            return {
                success: false,
                errorMessage: response.body,
                isDashboardError: true,
            };
        }
        catch (err) {
            DEBUG_LOGGER(err);
            return {
                success: false,
                errorMessage: err.message,
                isDashboardError: false,
            };
        }
    }
    async sendEmail(email) {
        return this._postRequest(DashboardConnector.API_URLS.sendMagicLinkMail, {
            email,
            thirdPartyRegistration: true,
        });
    }
    async validateToken(token) {
        return this._postRequest(DashboardConnector.API_URLS.validateToken, {
            token,
            testcafeVersion: (0, get_testcafe_version_1.default)(),
        });
    }
}
exports.default = DashboardConnector;
DashboardConnector.API_URLS = {
    sendMagicLinkMail: '/api/sendMagicLinkMail',
    validateToken: '/api/validateAuthToken',
};
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29ubmVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2Rhc2hib2FyZC9jb25uZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx5RkFBK0Q7QUFDL0QsNEVBQWtEO0FBQ2xELGtEQUEwQjtBQUMxQixrREFBMEI7QUFFMUIsTUFBTSxZQUFZLEdBQUcsSUFBQSxlQUFLLEVBQUMsOEJBQThCLENBQUMsQ0FBQztBQUUzRCxNQUFxQixrQkFBa0I7SUFRbkMsWUFBb0IsT0FBTyxHQUFHLElBQUEsMkJBQWUsR0FBRTtRQUMzQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztJQUMzQixDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFFLFdBQW1CLEVBQUUsSUFBWTtRQUNqRSxNQUFNLEdBQUcsR0FBUSxJQUFJLEdBQUcsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEMsTUFBTSxPQUFPLEdBQUc7WUFDWixNQUFNLEVBQUcsTUFBTTtZQUNmLE9BQU8sRUFBRTtnQkFDTCxjQUFjLEVBQUksa0JBQWtCO2dCQUNwQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQzthQUNoRDtTQUNKLENBQUM7UUFFRixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ25DLE1BQU0sR0FBRyxHQUFHLGVBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBRTtnQkFDMUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFFeEIsSUFBSSxZQUFZLEdBQUcsRUFBRSxDQUFDO2dCQUV0QixHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsRUFBRTtvQkFDbkIsWUFBWSxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDckMsQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFO29CQUNmLE9BQU8sQ0FBQzt3QkFDSixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVU7d0JBQzFCLE9BQU8sRUFBSyxHQUFHLENBQUMsT0FBTzt3QkFDdkIsSUFBSSxFQUFRLFlBQVk7cUJBQzNCLENBQUMsQ0FBQztnQkFDUCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFDO1lBRUgsR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFFeEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNwQixHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDZCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxLQUFLLENBQUMsWUFBWSxDQUFFLFdBQW1CLEVBQUUsSUFBUztRQUN0RCxJQUFJO1lBQ0EsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRXBFLElBQUksUUFBUSxDQUFDLFVBQVUsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLFVBQVUsSUFBSSxHQUFHO2dCQUN4RCxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO1lBRTdCLE9BQU87Z0JBQ0gsT0FBTyxFQUFXLEtBQUs7Z0JBQ3ZCLFlBQVksRUFBTSxRQUFRLENBQUMsSUFBSTtnQkFDL0IsZ0JBQWdCLEVBQUUsSUFBSTthQUN6QixDQUFDO1NBQ0w7UUFDRCxPQUFPLEdBQVEsRUFBRTtZQUNiLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUVsQixPQUFPO2dCQUNILE9BQU8sRUFBVyxLQUFLO2dCQUN2QixZQUFZLEVBQU0sR0FBRyxDQUFDLE9BQU87Z0JBQzdCLGdCQUFnQixFQUFFLEtBQUs7YUFDMUIsQ0FBQztTQUNMO0lBQ0wsQ0FBQztJQUVNLEtBQUssQ0FBQyxTQUFTLENBQUUsS0FBYTtRQUNqQyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFO1lBQ3BFLEtBQUs7WUFDTCxzQkFBc0IsRUFBRSxJQUFJO1NBQy9CLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTSxLQUFLLENBQUMsYUFBYSxDQUFFLEtBQWE7UUFDckMsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUU7WUFDaEUsS0FBSztZQUNMLGVBQWUsRUFBRSxJQUFBLDhCQUFrQixHQUFFO1NBQ3hDLENBQUMsQ0FBQztJQUNQLENBQUM7O0FBckZMLHFDQXNGQztBQW5GaUIsMkJBQVEsR0FBRztJQUNyQixpQkFBaUIsRUFBRSx3QkFBd0I7SUFDM0MsYUFBYSxFQUFNLHdCQUF3QjtDQUM5QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGdldFRlc3RjYWZlVmVyc2lvbiBmcm9tICcuLi91dGlscy9nZXQtdGVzdGNhZmUtdmVyc2lvbic7XG5pbXBvcnQgZ2V0RGFzaGJvYXJkVXJsIGZyb20gJy4vZ2V0LWRhc2hib2FyZC11cmwnO1xuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCBkZWJ1ZyBmcm9tICdkZWJ1Zyc7XG5cbmNvbnN0IERFQlVHX0xPR0dFUiA9IGRlYnVnKCd0ZXN0Y2FmZTpkYXNoYm9hcmQ6Y29ubmVjdG9yJyk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERhc2hib2FyZENvbm5lY3RvciB7XG4gICAgcHJpdmF0ZSByZWFkb25seSBiYXNlVXJsOiBzdHJpbmc7XG5cbiAgICBwdWJsaWMgc3RhdGljIEFQSV9VUkxTID0ge1xuICAgICAgICBzZW5kTWFnaWNMaW5rTWFpbDogJy9hcGkvc2VuZE1hZ2ljTGlua01haWwnLFxuICAgICAgICB2YWxpZGF0ZVRva2VuOiAgICAgJy9hcGkvdmFsaWRhdGVBdXRoVG9rZW4nLFxuICAgIH07XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IgKGJhc2VVcmwgPSBnZXREYXNoYm9hcmRVcmwoKSkge1xuICAgICAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX3NlbmRQb3N0SnNvblJlcXVlc3QgKHJlbGF0aXZlVXJsOiBzdHJpbmcsIGJvZHk6IG9iamVjdCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHVybCAgICAgID0gbmV3IFVSTChyZWxhdGl2ZVVybCwgdGhpcy5iYXNlVXJsKTtcbiAgICAgICAgY29uc3QgcG9zdERhdGEgPSBKU09OLnN0cmluZ2lmeShib2R5KTtcblxuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgbWV0aG9kOiAgJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAgICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBCdWZmZXIuYnl0ZUxlbmd0aChwb3N0RGF0YSksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXEgPSBodHRwcy5yZXF1ZXN0KHVybCwgb3B0aW9ucywgcmVzID0+IHtcbiAgICAgICAgICAgICAgICByZXMuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcblxuICAgICAgICAgICAgICAgIGxldCByZXNwb25zZUJvZHkgPSAnJztcblxuICAgICAgICAgICAgICAgIHJlcy5vbignZGF0YScsIGNodW5rID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VCb2R5ICs9IGNodW5rLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogcmVzLnN0YXR1c0NvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiAgICByZXMuaGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6ICAgICAgIHJlc3BvbnNlQm9keSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmVxLm9uKCdlcnJvcicsIHJlamVjdCk7XG5cbiAgICAgICAgICAgIHJlcS53cml0ZShwb3N0RGF0YSk7XG4gICAgICAgICAgICByZXEuZW5kKCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX3Bvc3RSZXF1ZXN0IChyZWxhdGl2ZVVybDogc3RyaW5nLCBib2R5OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLl9zZW5kUG9zdEpzb25SZXF1ZXN0KHJlbGF0aXZlVXJsLCBib2R5KTtcblxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1c0NvZGUgPD0gMjk5KVxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvck1lc3NhZ2U6ICAgICByZXNwb25zZS5ib2R5LFxuICAgICAgICAgICAgICAgIGlzRGFzaGJvYXJkRXJyb3I6IHRydWUsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgREVCVUdfTE9HR0VSKGVycik7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3JNZXNzYWdlOiAgICAgZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgaXNEYXNoYm9hcmRFcnJvcjogZmFsc2UsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNlbmRFbWFpbCAoZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wb3N0UmVxdWVzdChEYXNoYm9hcmRDb25uZWN0b3IuQVBJX1VSTFMuc2VuZE1hZ2ljTGlua01haWwsIHtcbiAgICAgICAgICAgIGVtYWlsLFxuICAgICAgICAgICAgdGhpcmRQYXJ0eVJlZ2lzdHJhdGlvbjogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHZhbGlkYXRlVG9rZW4gKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fcG9zdFJlcXVlc3QoRGFzaGJvYXJkQ29ubmVjdG9yLkFQSV9VUkxTLnZhbGlkYXRlVG9rZW4sIHtcbiAgICAgICAgICAgIHRva2VuLFxuICAgICAgICAgICAgdGVzdGNhZmVWZXJzaW9uOiBnZXRUZXN0Y2FmZVZlcnNpb24oKSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuIl19