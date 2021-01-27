"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const companionApp_1 = require("./base/companionApp");
const commandError_1 = require("./base/commandError");
let requiredCompanionProtocol = 4;
var ConnectionStage;
(function (ConnectionStage) {
    ConnectionStage[ConnectionStage["NotConnected"] = 0] = "NotConnected";
    ConnectionStage[ConnectionStage["CheckingVersion"] = 1] = "CheckingVersion";
    ConnectionStage[ConnectionStage["EnablingEncryption"] = 2] = "EnablingEncryption";
    ConnectionStage[ConnectionStage["CreatingAgent"] = 3] = "CreatingAgent";
    ConnectionStage[ConnectionStage["Complete"] = 4] = "Complete";
})(ConnectionStage || (ConnectionStage = {}));
// NOTE: only escapes a " if it's not already escaped
function escapeDoubleQuotes(str) {
    return str.replace(/\\([\s\S])|(")/g, "\\$1$2");
}
class ConnectionInitializer {
    constructor() {
        this.connectionStage = ConnectionStage.NotConnected;
    }
    sendCommand(commandLine) {
        this.curCommandId = companionApp_1.getApp().server.sendCommand(commandLine);
    }
    onConnected() {
        this.connectionStage = ConnectionStage.CheckingVersion;
        this.sendCommand('geteduclientinfo');
        companionApp_1.getApp().debugLog('Client connected to AI Connection');
    }
    callback(error) {
        companionApp_1.getApp().onConnectionComplete.call(companionApp_1.getApp(), error);
    }
    verifyGetClientInfo(command) {
        let body = command.body;
        if (body == null) {
            companionApp_1.getApp().debugLog('Error getting client info');
            return commandError_1.ConnectionError.GetInfoError;
        }
        let cVersion = body.companionProtocolVersion;
        if (cVersion < requiredCompanionProtocol) {
            companionApp_1.getApp().debugLog('Connected Minecraft is out of date');
            companionApp_1.getApp().telemetry.fireConnectionFailureEvent(cVersion, requiredCompanionProtocol, commandError_1.ErrorCode.VersionMismatch, commandError_1.ConnectionError.MinecraftOutOfDate);
            return commandError_1.ConnectionError.MinecraftOutOfDate;
        }
        if (cVersion > requiredCompanionProtocol) {
            companionApp_1.getApp().debugLog('AI Connection is out of date');
            companionApp_1.getApp().telemetry.fireConnectionFailureEvent(cVersion, requiredCompanionProtocol, commandError_1.ErrorCode.VersionMismatch, commandError_1.ConnectionError.ThisOutOfDate);
            return commandError_1.ConnectionError.ThisOutOfDate;
        }
        companionApp_1.getApp().telemetry.clientId = body.clientuuid;
        companionApp_1.getApp().telemetry.playerSessionid = body.playersessionuuid;
        companionApp_1.getApp().telemetry.userId = body.userId;
        companionApp_1.getApp().setIsEdu(body.isEdu);
        return commandError_1.ConnectionError.None;
    }
    onCommandResponse(response) {
        if (response.header.requestId != this.curCommandId) {
            companionApp_1.getApp().debugLog('Returned command id did not match verification request id');
            return;
        }
        switch (this.connectionStage) {
            case ConnectionStage.CheckingVersion: {
                let verificationError = this.verifyGetClientInfo(response);
                if (verificationError != commandError_1.ConnectionError.None) {
                    this.callback(verificationError);
                    return;
                }
                companionApp_1.getApp().debugLog('Client is in education mode');
                this.connectionStage = ConnectionStage.EnablingEncryption;
                let params = companionApp_1.getApp().server.beginKeyExchange();
                this.sendCommand('enableencryption "' + escapeDoubleQuotes(params.publicKey) + '" "' + escapeDoubleQuotes(params.salt) + '"');
                break;
            }
            case ConnectionStage.EnablingEncryption: {
                if (response.body.publicKey == null || companionApp_1.getApp().server.completeKeyExchange(response.body.publicKey) == false) {
                    this.callback(commandError_1.ConnectionError.GetInfoError);
                    return;
                }
                companionApp_1.getApp().debugLog('Encryption enabled');
                this.connectionStage = ConnectionStage.CreatingAgent;
                this.sendCommand('agent create');
                //this.sendCommand('weather rain');
                break;
            }
            case ConnectionStage.CreatingAgent: {
                companionApp_1.getApp().debugLog('Agent created');
                this.connectionStage = ConnectionStage.Complete;
                this.callback(commandError_1.ConnectionError.None);
                break;
            }
            default: {
                companionApp_1.getApp().debugLog('Unexpected connection stage in command response');
                break;
            }
        }
    }
    onError(error) {
        // Close web socket connection if error occurs
        companionApp_1.getApp().server.closeConnection();
        companionApp_1.getApp().debugLog('Connection initialization error, aborting connection');
        let status;
        // Single out agent creation in case we decide to make this command unsupported under some condition or platform
        if (this.connectionStage == ConnectionStage.CreatingAgent) {
            status = commandError_1.ConnectionError.CreateAgentError;
        }
        // Lump in any encryption or get info errors into getinfoerror
        else {
            status = commandError_1.ConnectionError.GetInfoError;
        }
        companionApp_1.getApp().telemetry.fireConnectionFailureEvent(0, requiredCompanionProtocol, error.errorCode, status);
        this.callback(status);
    }
}
exports.ConnectionInitializer = ConnectionInitializer;
//# sourceMappingURL=connectionInitializer.js.map