"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const chalk_1 = __importDefault(require("chalk"));
const log_1 = __importDefault(require("./log"));
const promisify_event_1 = __importDefault(require("promisify-event"));
const dedent_1 = __importDefault(require("dedent"));
async function default_1(testCafe, remoteCount, showQRCode) {
    const connectionPromises = [];
    if (remoteCount) {
        log_1.default.hideSpinner();
        const description = (0, dedent_1.default)(`
            Connecting ${remoteCount} remote browser(s)...
            Navigate to the following URL from each remote browser.
        `);
        log_1.default.write(description);
        if (showQRCode)
            log_1.default.write('You can either enter the URL or scan the QR-code.');
        const connectionUrl = testCafe.browserConnectionGateway.connectUrl;
        log_1.default.write(`Connect URL: ${chalk_1.default.underline.blue(connectionUrl)}`);
        if (showQRCode)
            qrcode_terminal_1.default.generate(connectionUrl);
        for (let i = 0; i < remoteCount; i++) {
            connectionPromises.push(testCafe
                .createBrowserConnection()
                .then((bc) => (0, promisify_event_1.default)(bc, 'ready').then(() => bc))
                .then((bc) => {
                log_1.default.write(`${chalk_1.default.green('CONNECTED')} ${bc.userAgent}`);
                return bc;
            }));
        }
        log_1.default.showSpinner();
    }
    return await Promise.all(connectionPromises);
}
exports.default = default_1;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3Rlcy13aXphcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY2xpL3JlbW90ZXMtd2l6YXJkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsc0VBQXFDO0FBQ3JDLGtEQUEwQjtBQUMxQixnREFBd0I7QUFDeEIsc0VBQTZDO0FBQzdDLG9EQUE0QjtBQVViLEtBQUssb0JBQVcsUUFBa0IsRUFBRSxXQUFtQixFQUFFLFVBQW1CO0lBQ3ZGLE1BQU0sa0JBQWtCLEdBQUcsRUFBRSxDQUFDO0lBRTlCLElBQUksV0FBVyxFQUFFO1FBQ2IsYUFBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRWxCLE1BQU0sV0FBVyxHQUFHLElBQUEsZ0JBQU0sRUFBQzt5QkFDVixXQUFXOztTQUUzQixDQUFDLENBQUM7UUFFSCxhQUFHLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXZCLElBQUksVUFBVTtZQUNWLGFBQUcsQ0FBQyxLQUFLLENBQUMsbURBQW1ELENBQUMsQ0FBQztRQUVuRSxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsd0JBQXdCLENBQUMsVUFBVSxDQUFDO1FBRW5FLGFBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLGVBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVqRSxJQUFJLFVBQVU7WUFDVix5QkFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUVuQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ2xDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxRQUFRO2lCQUMzQix1QkFBdUIsRUFBRTtpQkFDekIsSUFBSSxDQUFDLENBQUMsRUFBcUIsRUFBRSxFQUFFLENBQUMsSUFBQSx5QkFBYyxFQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7aUJBQzNFLElBQUksQ0FBQyxDQUFDLEVBQXFCLEVBQUUsRUFBRTtnQkFDNUIsYUFBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLGVBQUssQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7Z0JBRXpELE9BQU8sRUFBRSxDQUFDO1lBQ2QsQ0FBQyxDQUFDLENBQ0wsQ0FBQztTQUNMO1FBRUQsYUFBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO0tBQ3JCO0lBRUQsT0FBTyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUNqRCxDQUFDO0FBdkNELDRCQXVDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBxcmNvZGUgZnJvbSAncXJjb2RlLXRlcm1pbmFsJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgbG9nIGZyb20gJy4vbG9nJztcbmltcG9ydCBwcm9taXNpZnlFdmVudCBmcm9tICdwcm9taXNpZnktZXZlbnQnO1xuaW1wb3J0IGRlZGVudCBmcm9tICdkZWRlbnQnO1xuXG5pbXBvcnQgQnJvd3NlckNvbm5lY3Rpb24gZnJvbSAnLi4vYnJvd3Nlci9jb25uZWN0aW9uJztcbmltcG9ydCBCcm93c2VyQ29ubmVjdGlvbkdhdGV3YXkgZnJvbSAnLi4vYnJvd3Nlci9jb25uZWN0aW9uL2dhdGV3YXknO1xuXG5pbnRlcmZhY2UgVGVzdENhZmUge1xuICAgIGJyb3dzZXJDb25uZWN0aW9uR2F0ZXdheTogQnJvd3NlckNvbm5lY3Rpb25HYXRld2F5O1xuICAgIGNyZWF0ZUJyb3dzZXJDb25uZWN0aW9uKCk6IFByb21pc2U8QnJvd3NlckNvbm5lY3Rpb24+O1xufVxuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiAodGVzdENhZmU6IFRlc3RDYWZlLCByZW1vdGVDb3VudDogbnVtYmVyLCBzaG93UVJDb2RlOiBib29sZWFuKTogUHJvbWlzZTxCcm93c2VyQ29ubmVjdGlvbltdPiB7XG4gICAgY29uc3QgY29ubmVjdGlvblByb21pc2VzID0gW107XG5cbiAgICBpZiAocmVtb3RlQ291bnQpIHtcbiAgICAgICAgbG9nLmhpZGVTcGlubmVyKCk7XG5cbiAgICAgICAgY29uc3QgZGVzY3JpcHRpb24gPSBkZWRlbnQoYFxuICAgICAgICAgICAgQ29ubmVjdGluZyAke3JlbW90ZUNvdW50fSByZW1vdGUgYnJvd3NlcihzKS4uLlxuICAgICAgICAgICAgTmF2aWdhdGUgdG8gdGhlIGZvbGxvd2luZyBVUkwgZnJvbSBlYWNoIHJlbW90ZSBicm93c2VyLlxuICAgICAgICBgKTtcblxuICAgICAgICBsb2cud3JpdGUoZGVzY3JpcHRpb24pO1xuXG4gICAgICAgIGlmIChzaG93UVJDb2RlKVxuICAgICAgICAgICAgbG9nLndyaXRlKCdZb3UgY2FuIGVpdGhlciBlbnRlciB0aGUgVVJMIG9yIHNjYW4gdGhlIFFSLWNvZGUuJyk7XG5cbiAgICAgICAgY29uc3QgY29ubmVjdGlvblVybCA9IHRlc3RDYWZlLmJyb3dzZXJDb25uZWN0aW9uR2F0ZXdheS5jb25uZWN0VXJsO1xuXG4gICAgICAgIGxvZy53cml0ZShgQ29ubmVjdCBVUkw6ICR7Y2hhbGsudW5kZXJsaW5lLmJsdWUoY29ubmVjdGlvblVybCl9YCk7XG5cbiAgICAgICAgaWYgKHNob3dRUkNvZGUpXG4gICAgICAgICAgICBxcmNvZGUuZ2VuZXJhdGUoY29ubmVjdGlvblVybCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW1vdGVDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25uZWN0aW9uUHJvbWlzZXMucHVzaCh0ZXN0Q2FmZVxuICAgICAgICAgICAgICAgIC5jcmVhdGVCcm93c2VyQ29ubmVjdGlvbigpXG4gICAgICAgICAgICAgICAgLnRoZW4oKGJjOiBCcm93c2VyQ29ubmVjdGlvbikgPT4gcHJvbWlzaWZ5RXZlbnQoYmMsICdyZWFkeScpLnRoZW4oKCkgPT4gYmMpKVxuICAgICAgICAgICAgICAgIC50aGVuKChiYzogQnJvd3NlckNvbm5lY3Rpb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndyaXRlKGAke2NoYWxrLmdyZWVuKCdDT05ORUNURUQnKX0gJHtiYy51c2VyQWdlbnR9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJjO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nLnNob3dTcGlubmVyKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGF3YWl0IFByb21pc2UuYWxsKGNvbm5lY3Rpb25Qcm9taXNlcyk7XG59XG4iXX0=